from __future__ import annotations

import time
import json
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.Core.auth import get_current_user
from app.database.database import get_db
from app.models import BillingTransaction, User, UserWallet
from app.services.billing_service import get_or_create_wallet

router = APIRouter(prefix="/billing", tags=["billing"])


PlanId = Literal["basic", "pro", "vip", "premium"]


PLANS: dict[str, dict] = {
    "basic": {
        "id": "basic",
        "name": "Gói Khởi Đầu",
        "credits": 25_000,
        "price_vnd": 50_000,
        "desc": "Dịch ~250.000 từ. Phù hợp cho nhu cầu dịch thuật cá nhân.",
    },
    "pro": {
        "id": "pro",
        "name": "Gói Phổ Thông",
        "credits": 60_000,
        "price_vnd": 100_000,
        "desc": "Dịch ~600.000 từ hoặc 1.500 phút Voice. Lựa chọn phổ biến nhất.",
        "recommended": True,
    },
    "vip": {
        "id": "vip",
        "name": "Gói Chuyên Nghiệp",
        "credits": 150_000,
        "price_vnd": 200_000,
        "desc": "Dịch ~1.5 triệu từ. Phù hợp cho nhu cầu sử dụng Voice Mode cường độ cao.",
    },
    "premium": {
        "id": "premium",
        "name": "Gói Doanh Nghiệp",
        "credits": 400_000,
        "price_vnd": 500_000,
        "desc": "Dịch ~4 triệu từ. Giải pháp toàn diện và tiết kiệm nhất cho tổ chức.",
    },
}


class PurchaseRequest(BaseModel):
    plan_id: PlanId
    method: Literal["momo", "zalopay", "mock"] = "mock"
    external_ref: Optional[str] = None


@router.get("/plans")
def list_plans() -> list[dict]:
    return list(PLANS.values())


@router.get("/wallet")
def my_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wallet = get_or_create_wallet(db, user_id=current_user.id)
    return {
        "user_id": current_user.id,
        "credits_balance": int(wallet.credits_balance or 0),
    }


@router.post("/purchase")
async def purchase_plan(
    body: PurchaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Gói không hợp lệ")

    credits = int(plan["credits"])
    price_vnd = int(plan["price_vnd"])
    order_id = f"ORDER_{int(time.time())}_{current_user.id}"

    if body.method == "mock":
        # Demo flow: coi như thanh toán thành công và cộng ngay.
        wallet = get_or_create_wallet(db, user_id=current_user.id)
        wallet.credits_balance = int(wallet.credits_balance or 0) + credits
        db.add(
            BillingTransaction(
                user_id=current_user.id,
                type="purchase",
                credits_amount=credits,
                currency="VND",
                money_amount=Decimal(price_vnd),
                external_ref=body.external_ref or order_id,
                status="success",
                note=f"plan={body.plan_id}",
            )
        )
        db.commit()

        # Thông báo
        from app.services.notification_service import notify_admins, create_notification
        notify_admins(db, "Giao dịch mới", f"{current_user.full_name} mua {plan['name']}", "revenue")
        create_notification(db, current_user.id, "Thanh toán thành công", f"Nạp {credits:,} Credits", "success")

        return {"message": "Thanh toán thành công", "credits_added": credits, "credits_balance": int(wallet.credits_balance)}

    from app.services.payment_service import (
        create_momo_payment, 
        create_zalopay_payment, 
        verify_momo_signature, 
        verify_zalopay_mac
    )
    
    # Tạo transaction pending
    db.add(BillingTransaction(
        user_id=current_user.id,
        type="purchase",
        credits_amount=credits,
        currency="VND",
        money_amount=Decimal(price_vnd),
        external_ref=order_id,
        status="pending",
        note=f"plan={body.plan_id}, method={body.method}"
    ))
    db.commit()

    # base_url = "http://localhost:8000" # Change to real domain in production
    # redirect_url = "http://localhost:3000/billing"
    import os
    base_url = os.getenv("BASE_URL", "http://localhost:8000")
    redirect_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/billing"

    if body.method == "momo":
        res = await create_momo_payment(
            order_id=order_id,
            amount=price_vnd,
            order_info=f"Mua gói {plan['name']} tại Cabin AI",
            redirect_url=redirect_url,
            ipn_url=f"{base_url}/billing/callback/momo"
        )
        if res.get("resultCode") == 0:
            return {"payment_url": res.get("payUrl")}
        raise HTTPException(status_code=500, detail=res.get("message", "Lỗi tạo thanh toán MoMo"))

    elif body.method == "zalopay":
        res = await create_zalopay_payment(
            order_id=order_id,
            amount=price_vnd,
            order_info=f"Mua gói {plan['name']} tại Cabin AI",
            redirect_url=redirect_url,
            callback_url=f"{base_url}/billing/callback/zalopay",
            app_user=current_user.email or str(current_user.id)
        )
        if res.get("return_code") == 1:
            return {"payment_url": res.get("order_url")}
        raise HTTPException(status_code=500, detail=res.get("return_message", "Lỗi tạo thanh toán ZaloPay"))


@router.post("/callback/momo")
async def momo_callback(data: dict, db: Session = Depends(get_db)):
    from app.services.payment_service import verify_momo_signature
    
    # Verify signature
    if not verify_momo_signature(data):
        print(f"MoMo Callback: Invalid signature for order {data.get('orderId')}")
        return {"message": "Invalid signature"}

    if data.get("resultCode") == 0:
        order_id = data.get("orderId")
        tx = db.query(BillingTransaction).filter(
            BillingTransaction.external_ref == order_id, 
            BillingTransaction.status == "pending"
        ).first()
        
        if tx:
            tx.status = "success"
            wallet = get_or_create_wallet(db, user_id=tx.user_id)
            wallet.credits_balance = int(wallet.credits_balance or 0) + tx.credits_amount
            db.commit()
            
            # Create notification for user
            from app.services.notification_service import create_notification
            create_notification(db, tx.user_id, "Thanh toán thành công", f"Nạp {tx.credits_amount:,} Credits qua MoMo", "success")
            
            return {"message": "Success"}
    else:
        # Update transaction status to failed
        order_id = data.get("orderId")
        tx = db.query(BillingTransaction).filter(
            BillingTransaction.external_ref == order_id, 
            BillingTransaction.status == "pending"
        ).first()
        if tx:
            tx.status = "failed"
            tx.note = f"{tx.note}, error={data.get('message')}"
            db.commit()

    return {"message": "Processed"}


@router.post("/callback/zalopay")
async def zalopay_callback(data: dict, db: Session = Depends(get_db)):
    from app.services.payment_service import verify_zalopay_mac
    
    cb_data_str = data.get("data")
    cb_mac = data.get("mac")
    
    if not verify_zalopay_mac(cb_data_str, cb_mac):
        print("ZaloPay Callback: Invalid MAC")
        return {"return_code": -1, "return_message": "Invalid MAC"}

    cb_data = json.loads(cb_data_str)
    # ZaloPay type: 1 - create order, 2 - agreement
    # In sandbox/simple flow, we mostly care about the data content
    
    app_trans_id = cb_data.get("app_trans_id")
    # Extract original order_id from app_trans_id (format: yyMMdd_order_id)
    parts = app_trans_id.split("_")
    if len(parts) >= 2:
        order_id = "_".join(parts[1:])
        tx = db.query(BillingTransaction).filter(
            BillingTransaction.external_ref == order_id
        ).first()
        
        if tx:
            if tx.status == "success":
                return {"return_code": 1, "return_message": "Already processed"}
            
            if tx.status == "pending":
                tx.status = "success"
                wallet = get_or_create_wallet(db, user_id=tx.user_id)
                wallet.credits_balance = int(wallet.credits_balance or 0) + tx.credits_amount
                db.commit()
                
                # Create notification for user
                from app.services.notification_service import create_notification
                create_notification(db, tx.user_id, "Thanh toán thành công", f"Nạp {tx.credits_amount:,} Credits qua ZaloPay", "success")
                
                return {"return_code": 1, "return_message": "Success"}
            
    return {"return_code": 2, "return_message": "Order not found or invalid status"}

