from fastapi import Depends, HTTPException
from app.Core.auth import get_current_user

def role_required(roles: list):
    def checker(user = Depends(get_current_user)):
        # hỗ trợ cả dict và ORM
        user_role = user["role"] if isinstance(user, dict) else user.role

        if user_role not in roles:
            raise HTTPException(
                status_code=403,
                detail="Không có quyền"
            )
        return user
    return checker