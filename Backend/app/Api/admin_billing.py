from __future__ import annotations

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.Core.auth import require_roles
from app.database.database import get_db
from app.models import BillingTransaction, User, UserWallet, PricingRule
from app.services.billing_service import get_or_create_wallet

router = APIRouter(prefix="/admin/billing", tags=["admin-billing"])


class AdminCreditRequest(BaseModel):
    user_id: int
    credits: int
    note: Optional[str] = None
    external_ref: Optional[str] = None


class PricingRuleRequest(BaseModel):
    provider: str
    model: Optional[str] = None
    feature: Optional[str] = None
    credit_per_input_token: Optional[Decimal] = None
    credit_per_output_token: Optional[Decimal] = None
    credit_per_input_char: Optional[Decimal] = None
    credit_per_output_char: Optional[Decimal] = None
    credit_per_audio_second: Optional[Decimal] = None
    cost_per_input_token_usd: Optional[Decimal] = None
    cost_per_output_token_usd: Optional[Decimal] = None
    cost_per_audio_second_usd: Optional[Decimal] = None
    is_active: bool = True


@router.get("/wallets")
def list_wallets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    q = db.query(UserWallet).order_by(UserWallet.user_id).offset(skip).limit(limit)
    items = q.all()
    return {
        "items": [
            {"user_id": w.user_id, "credits_balance": int(w.credits_balance or 0)}
            for w in items
        ],
        "skip": skip,
        "limit": limit,
    }


@router.post("/credit")
def admin_credit_user(
    body: AdminCreditRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    if body.credits == 0:
        raise HTTPException(status_code=400, detail="credits phải khác 0")

    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")

    wallet = get_or_create_wallet(db, user_id=body.user_id)
    wallet.credits_balance = int(wallet.credits_balance or 0) + int(body.credits)
    db.add(
        BillingTransaction(
            user_id=body.user_id,
            type="admin_grant",
            credits_amount=int(body.credits),
            currency=None,
            money_amount=Decimal(0),
            external_ref=body.external_ref,
            note=body.note or "admin credit",
        )
    )
    db.commit()

    # Thông báo cho người dùng
    from app.services.notification_service import create_notification
    action_text = "cộng" if body.credits > 0 else "trừ"
    create_notification(
        db,
        user_id=body.user_id,
        title="Biến động số dư",
        message=f"Hệ thống vừa {action_text} {abs(body.credits):,} Token vào tài khoản của bạn. Lý do: {body.note or 'Điều chỉnh từ Admin'}.",
        type="info" if body.credits > 0 else "warning"
    )

    wallet = db.query(UserWallet).filter(UserWallet.user_id == body.user_id).first()
    return {
        "message": "Đã cộng credits cho user",
        "user_id": body.user_id,
        "credits_balance": int(wallet.credits_balance or 0) if wallet else 0,
    }


# ================= PRICING RULES =================


@router.get("/pricing-rules")
def list_pricing_rules(
    provider: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    q = db.query(PricingRule)
    if provider:
        q = q.filter(PricingRule.provider == provider)
    if is_active is not None:
        q = q.filter(PricingRule.is_active == is_active)

    total = q.count()
    items = q.order_by(PricingRule.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "items": [
            {
                "id": r.id,
                "provider": r.provider,
                "model": r.model,
                "feature": r.feature,
                "credit_per_input_token": float(r.credit_per_input_token or 0),
                "credit_per_output_token": float(r.credit_per_output_token or 0),
                "credit_per_input_char": float(r.credit_per_input_char or 0),
                "credit_per_output_char": float(r.credit_per_output_char or 0),
                "credit_per_audio_second": float(r.credit_per_audio_second or 0),
                "is_active": r.is_active,
            }
            for r in items
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/pricing-rules")
def create_pricing_rule(
    body: PricingRuleRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    rule = PricingRule(
        provider=body.provider,
        model=body.model,
        feature=body.feature,
        credit_per_input_token=body.credit_per_input_token,
        credit_per_output_token=body.credit_per_output_token,
        credit_per_input_char=body.credit_per_input_char,
        credit_per_output_char=body.credit_per_output_char,
        credit_per_audio_second=body.credit_per_audio_second,
        cost_per_input_token_usd=body.cost_per_input_token_usd,
        cost_per_output_token_usd=body.cost_per_output_token_usd,
        cost_per_audio_second_usd=body.cost_per_audio_second_usd,
        is_active=body.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {
        "message": "Đã tạo pricing rule",
        "id": rule.id,
        "provider": rule.provider,
    }


@router.put("/pricing-rules/{rule_id}")
def update_pricing_rule(
    rule_id: int,
    body: PricingRuleRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    rule = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Pricing rule không tồn tại")

    rule.provider = body.provider
    rule.model = body.model
    rule.feature = body.feature
    rule.credit_per_input_token = body.credit_per_input_token
    rule.credit_per_output_token = body.credit_per_output_token
    rule.credit_per_input_char = body.credit_per_input_char
    rule.credit_per_output_char = body.credit_per_output_char
    rule.credit_per_audio_second = body.credit_per_audio_second
    rule.cost_per_input_token_usd = body.cost_per_input_token_usd
    rule.cost_per_output_token_usd = body.cost_per_output_token_usd
    rule.cost_per_audio_second_usd = body.cost_per_audio_second_usd
    rule.is_active = body.is_active

    db.commit()
    db.refresh(rule)
    return {
        "message": "Đã cập nhật pricing rule",
        "id": rule.id,
    }


@router.delete("/pricing-rules/{rule_id}")
def delete_pricing_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    rule = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Pricing rule không tồn tại")

    db.delete(rule)
    db.commit()
    return {"message": "Đã xóa pricing rule"}
