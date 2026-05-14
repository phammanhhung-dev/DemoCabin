from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models import User, TranslationHistory
from app.schemas_tp import HistoryResponse
from app.Core.auth import get_current_user

router = APIRouter(prefix="/tp/history", tags=["translation-project"])


@router.get("/", response_model=list[HistoryResponse])
def get_my_tp_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(TranslationHistory)
        .filter(TranslationHistory.user_id == current_user.id)
        .order_by(TranslationHistory.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.delete("/{history_id}")
def delete_tp_history(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = (
        db.query(TranslationHistory)
        .filter(
            TranslationHistory.id == history_id,
            TranslationHistory.user_id == current_user.id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Không tìm thấy")
    db.delete(record)
    db.commit()
    return {"message": "Đã xóa"}
