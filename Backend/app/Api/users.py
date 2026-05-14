from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database.database import get_db
from app.models import User
from app.Core.auth import get_current_user, hash_password
import base64

router = APIRouter(prefix="/api/users", tags=["users"])

class UpdateAvatarRequest(BaseModel):
    avatar_url: str  # Base64 encoded image or URL

class UpdateProfileRequest(BaseModel):
    full_name: str = None
    email: str = None
    old_password: str = None
    new_password: str = None

class UserProfileResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    avatar_url: str = None

    class Config:
        from_attributes = True

@router.get("/profile", response_model=UserProfileResponse)
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lấy thông tin tài khoản hiện tại"""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    return user

@router.put("/profile", response_model=UserProfileResponse)
def update_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cập nhật thông tin hồ sơ"""
    from app.Core.auth import verify_password
    
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    
    if request.full_name:
        user.full_name = request.full_name
    
    if request.email and request.email != user.email:
        # Check if email already exists
        existing = db.query(User).filter(User.email == request.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email đã tồn tại")
        user.email = request.email
    
    if request.new_password:
        if not request.old_password:
            raise HTTPException(status_code=400, detail="Cần nhập mật khẩu cũ")
        if not verify_password(request.old_password, user.password):
            raise HTTPException(status_code=400, detail="Mật khẩu cũ không đúng")
        user.password = hash_password(request.new_password)
    
    db.commit()
    db.refresh(user)
    return user

@router.put("/profile/avatar", response_model=UserProfileResponse)
def update_avatar(
    request: UpdateAvatarRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cập nhật ảnh đại diện của người dùng"""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    
    user.avatar_url = request.avatar_url
    db.commit()
    db.refresh(user)
    return user

@router.post("/profile/avatar-upload")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload ảnh đại diện"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File phải là hình ảnh")
    
    # Đọc file và convert to base64
    contents = await file.read()
    base64_image = base64.b64encode(contents).decode("utf-8")
    data_url = f"data:{file.content_type};base64,{base64_image}"
    
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    
    user.avatar_url = data_url
    db.commit()
    db.refresh(user)
    
    return {
        "message": "Avatar updated successfully",
        "avatar_url": user.avatar_url,
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "avatar_url": user.avatar_url
        }
    }
