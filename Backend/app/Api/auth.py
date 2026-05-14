from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case, nulls_last, nulls_first
from fastapi.security import OAuth2PasswordRequestForm
from typing import Optional
from pydantic import BaseModel, EmailStr # Thêm pydantic để nhận dữ liệu từ Body

from app.database.database import get_db
from app.models import User, Translation, TranslationHistory, TpNotification, Task, VoiceSession, VoiceMessage
from app.Core.auth import (require_roles,verify_password,create_access_token,get_current_user,hash_password)
from app.services.email_service import send_email
import secrets
import string

router = APIRouter()

# 1. Định nghĩa cấu trúc dữ liệu gửi lên từ Frontend (Schema)
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class AdminUserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = "user"


class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user:
        raise HTTPException(status_code=401, detail="User không tồn tại")

    if not verify_password(form_data.password, user.password):
        raise HTTPException(status_code=401, detail="Sai mật khẩu")

    token = create_access_token({
        "sub": user.email,
        "role": user.role
    })

    # Thông báo đăng nhập thành công
    from app.services.notification_service import create_notification
    create_notification(
        db,
        user_id=user.id,
        title="Đăng nhập thành công",
        message=f"Chào mừng {user.full_name} quay trở lại! Bạn vừa đăng nhập vào hệ thống.",
        type="success"
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "avatar_url": user.avatar_url
        }
    }

# --- ROUTE: REGISTER (Đã sửa để nhận JSON Body) ---
@router.post("/register")
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    from app.models import UserWallet

    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email đã tồn tại")
    if db.query(User).filter(User.full_name == user_in.full_name).first():
        raise HTTPException(status_code=400, detail="Tên đã tồn tại")
    user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        password=hash_password(user_in.password),
        role="user"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Tạo wallet với 0 credits khi user mới
    wallet = UserWallet(user_id=user.id, credits_balance=0)
    db.add(wallet)
    db.commit()

    # Thông báo cho admin về user mới
    from app.services.notification_service import notify_admins
    notify_admins(
        db,
        title="Thành viên mới",
        message=f"Người dùng {user.full_name} ({user.email}) vừa đăng ký tài khoản.",
        type="user_registration",
        link="/admin/users"
    )

    return {
        "msg": "Tạo tài khoản thành công",
        "email": user.email,
        "role": user.role
    }


def _generate_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Nhập email -> hệ thống tạo mật khẩu mới random, cập nhật DB (hash) và gửi về email đó.
    """
    user = db.query(User).filter(User.email == body.email).first()

    # Trả message chung để tránh dò email (an toàn hơn)
    if not user:
        return {"message": "Nếu email tồn tại, mật khẩu mới đã được gửi về email."}

    new_password = _generate_password(10)
    user.password = hash_password(new_password)

    # Chỉ commit khi gửi mail thành công
    try:
        db.flush()
        send_email(
            to_email=user.email,
            subject="Cabin - Mật khẩu mới",
            body=(
                "Bạn đã yêu cầu đặt lại mật khẩu.\n\n"
                f"Mật khẩu mới của bạn là: {new_password}\n\n"
                "Vui lòng đăng nhập và đổi mật khẩu ngay sau khi đăng nhập."
            ),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Gửi email thất bại. Vui lòng thử lại.")

    return {"message": "Nếu email tồn tại, mật khẩu mới đã được gửi về email."}

# --- ROUTE: admin ---
@router.get("/admin")
def admin_route(user: User = Depends(require_roles(["admin"]))):
    return {"msg": "Chỉ admin vào được"}

# --- ROUTE: staff ---
@router.get("/staff")
def staff_route(user: User = Depends(require_roles(["admin", "staff"]))):
    return {"msg": "Staff + Admin"}

# --- ROUTE: user ---
@router.get("/user")
def user_route(user: User = Depends(get_current_user)):
    return {"msg": "User đã login"}

# --- ROUTE: ME ---
@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models import UserWallet
    
    # Get user's wallet info
    wallet = db.query(UserWallet).filter(UserWallet.user_id == user.id).first()
    
    # Nếu user chưa có wallet, tạo mới
    if not wallet:
        wallet = UserWallet(user_id=user.id, credits_balance=0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    
    token_balance = wallet.credits_balance if wallet else 0
    
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "name": user.full_name,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "balance": 0,
        "token_balance": int(token_balance),
    }


@router.get("/admin/users")
def list_users_admin(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: str = Query(None),
    sort_by: str = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    import sys
    sys.stderr.write(f"[DEBUG] sort_by={sort_by}\n")
    sys.stderr.flush()
    
    # Get last translation for each user
    last_trans_subquery = db.query(
        TranslationHistory.user_id,
        func.max(TranslationHistory.created_at).label("last_translation_at")
    ).group_by(TranslationHistory.user_id).subquery()

    # Main query with LEFT JOIN
    q = db.query(
        User,
        last_trans_subquery.c.last_translation_at.label("last_translation_at_col")
    ).outerjoin(
        last_trans_subquery,
        User.id == last_trans_subquery.c.user_id
    )

    if search:
        search_filter = f"%{search}%"
        q = q.filter(
            (User.full_name.ilike(search_filter)) | 
            (User.email.ilike(search_filter))
        )
    
    # Sort BEFORE limit/offset
    if sort_by == "recent_translation":
        sys.stderr.write(f"[DEBUG] Applying recent_translation sort\n")
        sys.stderr.flush()
        q = q.order_by(nulls_last(desc(last_trans_subquery.c.last_translation_at)))
    elif sort_by == "recent_translation_asc":
        sys.stderr.write(f"[DEBUG] Applying recent_translation_asc sort\n")
        sys.stderr.flush()
        q = q.order_by(nulls_last(last_trans_subquery.c.last_translation_at.asc()))
    else:
        sys.stderr.write(f"[DEBUG] Applying default (id) sort\n")
        sys.stderr.flush()
        q = q.order_by(User.id.asc())
    
    total = q.count()
    rows = q.offset(skip).limit(limit).all()
    
    return {
        "items": [
            {
                "id": u[0].id,
                "email": u[0].email,
                "full_name": u[0].full_name,
                "role": u[0].role,
                "last_translation_at": u[1].isoformat() if u[1] else None
            }
            for u in rows
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/admin/users/{user_id}")
def admin_get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role}


@router.post("/admin/users")
def admin_create_user(
    body: AdminUserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email đã tồn tại")

    u = User(
        full_name=body.full_name,
        email=body.email,
        password=hash_password(body.password),
        role=body.role or "user",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role}


@router.put("/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    body: AdminUserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User không tồn tại")

    if body.email and body.email != u.email:
        if db.query(User).filter(User.email == body.email).first():
            raise HTTPException(status_code=400, detail="Email đã tồn tại")
        u.email = body.email

    if body.full_name is not None:
        u.full_name = body.full_name
    if body.role is not None and body.role != "":
        u.role = body.role
    if body.password:
        u.password = hash_password(body.password)

    db.commit()
    db.refresh(u)
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role}


@router.delete("/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User không tồn tại")

    # Đếm dữ liệu liên quan
    related = {
        "translations": db.query(Translation).filter(Translation.user_id == user_id).count(),
        "translation_history": db.query(TranslationHistory).filter(TranslationHistory.user_id == user_id).count(),
        "tp_notifications": db.query(TpNotification).filter(TpNotification.user_id == user_id).count(),
        "tasks": db.query(Task).filter(Task.user_id == user_id).count(),
        "voice_sessions": db.query(VoiceSession).filter(VoiceSession.user_id == user_id).count(),
    }
    total_related = sum(int(v or 0) for v in related.values())

    if total_related > 0 and not force:
        parts = [f"{k}={v}" for k, v in related.items() if v]
        raise HTTPException(
            status_code=400,
            detail="Không thể xoá user vì có dữ liệu liên quan: " + ", ".join(parts),
        )

    # Xóa cưỡng bức: xóa bảng con trước để không vướng FK
    try:
        session_ids = [sid for (sid,) in db.query(VoiceSession.id).filter(VoiceSession.user_id == user_id).all()]
        if session_ids:
            db.query(VoiceMessage).filter(VoiceMessage.session_id.in_(session_ids)).delete(synchronize_session=False)
        db.query(VoiceSession).filter(VoiceSession.user_id == user_id).delete(synchronize_session=False)

        db.query(TranslationHistory).filter(TranslationHistory.user_id == user_id).delete(synchronize_session=False)
        db.query(TpNotification).filter(TpNotification.user_id == user_id).delete(synchronize_session=False)
        db.query(Task).filter(Task.user_id == user_id).delete(synchronize_session=False)
        db.query(Translation).filter(Translation.user_id == user_id).delete(synchronize_session=False)

        db.delete(u)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Đã xoá user" if total_related == 0 else "Đã xoá user và toàn bộ dữ liệu liên quan"}

