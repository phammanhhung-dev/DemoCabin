from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database.database import get_db
from app.models import User, TranslationHistory, TpNotification, UserWallet, BillingTransaction, AiUsageLog
from app.schemas_tp import HistoryResponse
from app.Core.auth import require_roles

router = APIRouter(prefix="/tp/admin", tags=["translation-project-admin"])


@router.post("/broadcast-notification")
def broadcast_notification(
    title: str,
    message: str,
    type: str = "info",
    link: str = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    from app.services.notification_service import broadcast_notification as broadcast_notif
    broadcast_notif(db, title, message, type, link)
    return {"message": "Đã gửi thông báo tới toàn bộ người dùng"}


@router.get("/stats")
def tp_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    try:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # 1. User Stats
        total_users = db.query(User).count()
        active_users = total_users # Giả định, có thể thêm field is_active vào model User sau
        banned_users = 0 # Giả định
        
        # 2. Token Stats
        total_tokens_issued = db.query(func.sum(BillingTransaction.credits_amount)).filter(BillingTransaction.type.in_(["purchase", "admin_grant"])).scalar() or 0
        total_tokens_used = db.query(func.abs(func.sum(BillingTransaction.credits_amount))).filter(BillingTransaction.type == "usage_debit").scalar() or 0
        current_total_balance = db.query(func.sum(UserWallet.credits_balance)).scalar() or 0
        
        # 3. Translation Stats
        total_translations = db.query(TranslationHistory).count()
        translations_today = db.query(TranslationHistory).filter(TranslationHistory.created_at >= today).count()
        
        # 4. Revenue Stats
        total_revenue = db.query(func.sum(BillingTransaction.money_amount)).filter(BillingTransaction.type == "purchase").scalar() or 0
        
        # 5. Monthly Data (Last 6-12 months for chart)
        # Giả định lấy dữ liệu 7 ngày gần nhất như trong hình (T2-CN)
        start_of_week = today - timedelta(days=today.weekday())
        monthly_data = []
        days_labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
        
        for i in range(7):
            day_start = start_of_week + timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            
            rev = db.query(func.sum(BillingTransaction.money_amount)).filter(
                BillingTransaction.type == "purchase",
                BillingTransaction.created_at >= day_start,
                BillingTransaction.created_at < day_end
            ).scalar() or 0
            
            trans = db.query(TranslationHistory).filter(
                TranslationHistory.created_at >= day_start,
                TranslationHistory.created_at < day_end
            ).count()
            
            monthly_data.append({
                "name": days_labels[i],
                "revenue": float(rev),
                "translations": trans
            })

        # 6. Recent Recharges
        recent_recharges = db.query(BillingTransaction, User).join(User, BillingTransaction.user_id == User.id).filter(
            BillingTransaction.type == "purchase"
        ).order_by(BillingTransaction.id.desc()).limit(5).all()
        
        recharges_list = []
        for trans, user in recent_recharges:
            recharges_list.append({
                "user_name": user.full_name or user.email,
                "amount": float(trans.money_amount or 0),
                "time": trans.created_at.isoformat() if hasattr(trans, 'created_at') else datetime.utcnow().isoformat()
            })

        # 7. Top Users (by usage_debit amount)
        top_users_query = db.query(
            User.full_name, 
            User.email,
            func.abs(func.sum(BillingTransaction.credits_amount)).label("total_used")
        ).join(BillingTransaction, User.id == BillingTransaction.user_id).filter(
            BillingTransaction.type == "usage_debit"
        ).group_by(User.id, User.full_name, User.email).order_by(func.sum(BillingTransaction.credits_amount).asc()).limit(5).all()
        
        top_users_list = []
        for name, email, used in top_users_query:
            top_users_list.append({
                "name": name or email,
                "used_tokens": int(used or 0)
            })

        return {
            "users": {
                "total": total_users,
                "active": active_users,
                "banned": banned_users
            },
            "tokens": {
                "total_issued": int(total_tokens_issued),
                "total_used": int(total_tokens_used),
                "current_balance": int(current_total_balance)
            },
            "translations": {
                "total": total_translations,
                "today": translations_today
            },
            "revenue": {
                "total": float(total_revenue)
            },
            "chart_data": monthly_data,
            "recent_recharges": recharges_list,
            "top_users": top_users_list
        }
    except Exception as e:
        print(f"ERROR in tp_stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")


@router.get("/history", response_model=list[HistoryResponse])
def tp_admin_all_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user_id: int = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    q = db.query(TranslationHistory)
    if user_id is not None:
        q = q.filter(TranslationHistory.user_id == user_id)
    return (
        q.order_by(TranslationHistory.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.delete("/history/{history_id}")
def tp_admin_delete_history(
    history_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    record = db.query(TranslationHistory).filter(TranslationHistory.id == history_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Không tìm thấy")
    db.delete(record)
    db.commit()
    return {"message": "Đã xóa"}


@router.post("/notify/{user_id}")
def tp_admin_notify(
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    
    title = body.get("title", "Thông báo từ hệ thống")
    message = body.get("message", "Thông báo mới")
    notify_type = body.get("type", "info")
    link = body.get("link")

    db.add(TpNotification(
        user_id=user_id, 
        title=title,
        message=message, 
        type=notify_type,
        link=link
    ))
    db.commit()
    return {"message": f"Đã gửi thông báo cho {user.email}"}
