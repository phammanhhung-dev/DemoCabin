from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, desc, case
from sqlalchemy.orm import Session

from app.Core.auth import require_roles
from app.database.database import get_db
from app.models import User, TranslationHistory, Translation

router = APIRouter(prefix="/admin", tags=["admin-users"])


@router.get("/users_v2")
def list_users_v2(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(["admin"])),
):
    """
    Lấy danh sách người dùng với phân trang trực tiếp tại SQL để đảm bảo hiệu năng.
    Chỉ load đúng số lượng 'limit' bản ghi mỗi lần.
    Kết hợp dữ liệu từ cả TranslationHistory (Soniox) và Translation (Cabin).
    """
    try:
        # 1. Subquery lấy lần dịch cuối từ TranslationHistory (Soniox)
        soniox_sub = (
            db.query(
                TranslationHistory.user_id,
                func.max(TranslationHistory.created_at).label("last_soniox")
            )
            .group_by(TranslationHistory.user_id)
            .subquery()
        )

        # 2. Subquery lấy lần dịch cuối từ Translation (Cabin)
        cabin_sub = (
            db.query(
                Translation.user_id,
                func.max(Translation.created_at).label("last_cabin")
            )
            .group_by(Translation.user_id)
            .subquery()
        )

        # 3. Query chính: Join cả 2 bảng để lấy ngày dịch mới nhất thực tế
        # Định nghĩa final_last_translation một lần để dùng lại
        final_last_trans_expr = case(
            (soniox_sub.c.last_soniox > cabin_sub.c.last_cabin, soniox_sub.c.last_soniox),
            else_=func.coalesce(cabin_sub.c.last_cabin, soniox_sub.c.last_soniox)
        )

        query = db.query(
            User,
            final_last_trans_expr.label("final_last_translation")
        ).outerjoin(soniox_sub, User.id == soniox_sub.c.user_id) \
         .outerjoin(cabin_sub, User.id == cabin_sub.c.user_id)

        # Lọc theo search
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (User.email.ilike(search_term)) | (User.full_name.ilike(search_term))
            )

        # Tính tổng số bản ghi
        total = query.count()

        # 4. Xử lý sắp xếp
        if sort_by == "recent_translation":
            # Mới nhất trước, NULL xuống cuối
            query = query.order_by(
                case((final_last_trans_expr.isnot(None), 1), else_=0).desc(),
                desc("final_last_translation"),
                User.id.desc()
            )
        elif sort_by == "recent_translation_asc":
            # Cũ nhất trước, NULL xuống cuối
            query = query.order_by(
                case((final_last_trans_expr.isnot(None), 1), else_=0).desc(),
                "final_last_translation",
                User.id.desc()
            )
        else:
            query = query.order_by(User.id.asc())

        # 5. Phân trang
        results = query.offset(skip).limit(limit).all()

        # 6. Tính toán stats chi tiết cho 10 user này
        items = []
        for user, last_trans_at in results:
            # Lấy từ Soniox
            s_histories = db.query(TranslationHistory).filter(TranslationHistory.user_id == user.id).all()
            # Lấy từ Cabin
            c_histories = db.query(Translation).filter(Translation.user_id == user.id).all()
            
            recognized_words = 0
            translated_words = 0
            
            for h in s_histories:
                recognized_words += len((h.original_text or "").split())
                translated_words += len((h.translated_text or "").split())
            
            for h in c_histories:
                recognized_words += len((h.original or "").split())
                translated_words += len((h.translated or "").split())
            
            estimated_tokens = recognized_words + translated_words
            estimated_cost_usd = (estimated_tokens / 1000) * 0.002
            
            items.append({
                "id": user.id,
                "full_name": user.full_name or "",
                "email": user.email,
                "role": user.role,
                "avatar_url": user.avatar_url,
                "last_translation_at": last_trans_at.isoformat() if last_trans_at else None,
                "recognized_words": recognized_words,
                "translated_words": translated_words,
                "estimated_tokens": estimated_tokens,
                "estimated_cost_usd": round(estimated_cost_usd, 6)
            })

        return {
            "items": items,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        import traceback
        print(f"ERROR in list_users_v2: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Lỗi máy chủ: {str(e)}")
