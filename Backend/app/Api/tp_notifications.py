from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models import User, TpNotification
from app.schemas_tp import NotificationResponse
from app.Core.auth import get_current_user

router = APIRouter(prefix="/tp/notifications", tags=["translation-project"])


@router.get("/", response_model=list[NotificationResponse])
def get_tp_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 10,
):
    query = db.query(TpNotification).filter(TpNotification.user_id == current_user.id)
    query = query.order_by(TpNotification.created_at.desc())
    
    return query.offset(skip).limit(limit).all()


@router.post("/{notification_id}/read")
def mark_tp_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = db.query(TpNotification).filter(
        TpNotification.id == notification_id,
        TpNotification.user_id == current_user.id
    ).first()
    
    if not notification:
        return {"error": "Không tìm thấy thông báo"}
    
    notification.is_read = True
    db.commit()
    return {"message": "Đã đọc thông báo"}


@router.post("/{notification_id}/unread")
def mark_tp_notification_unread(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = db.query(TpNotification).filter(
        TpNotification.id == notification_id,
        TpNotification.user_id == current_user.id
    ).first()
    
    if not notification:
        return {"error": "Không tìm thấy thông báo"}
    
    notification.is_read = False
    db.commit()
    return {"message": "Đã đánh dấu chưa đọc"}


@router.delete("/{notification_id}")
def delete_tp_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = db.query(TpNotification).filter(
        TpNotification.id == notification_id,
        TpNotification.user_id == current_user.id
    ).first()
    
    if not notification:
        return {"error": "Không tìm thấy thông báo"}
    
    db.delete(notification)
    db.commit()
    return {"message": "Đã xóa thông báo"}


@router.delete("/")
def delete_all_tp_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(TpNotification).filter(TpNotification.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Đã xóa tất cả thông báo"}


@router.get("/unread-count")
def get_tp_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(TpNotification)
        .filter(
            TpNotification.user_id == current_user.id,
            TpNotification.is_read == False,
        )
        .count()
    )
    return {"count": count}


@router.post("/read-all")
def mark_tp_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(TpNotification).filter(
        TpNotification.user_id == current_user.id,
        TpNotification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "Đã đọc tất cả"}
