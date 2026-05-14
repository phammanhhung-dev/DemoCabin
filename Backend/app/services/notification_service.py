from sqlalchemy.orm import Session
from app.models import User, TpNotification

def create_notification(db: Session, user_id: int, title: str, message: str, type: str = "info", link: str = None):
    notification = TpNotification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        link=link
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification

def notify_admins(db: Session, title: str, message: str, type: str = "info", link: str = None):
    admins = db.query(User).filter(User.role == "admin").all()
    for admin in admins:
        create_notification(db, admin.id, title, message, type, link)

def broadcast_notification(db: Session, title: str, message: str, type: str = "info", link: str = None):
    users = db.query(User).all()
    for user in users:
        # Tránh commit liên tục trong vòng lặp để tăng hiệu năng
        notification = TpNotification(
            user_id=user.id,
            title=title,
            message=message,
            type=type,
            link=link
        )
        db.add(notification)
    db.commit()
