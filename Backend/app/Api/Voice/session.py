from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import VoiceSession

router = APIRouter(prefix="/voice/session", tags=["Voice Session"])


@router.post("/")
def create_session(db: Session = Depends(get_db)):
    session = VoiceSession(user_id=None)  # hoặc gán tạm 1 user có thật
    db.add(session)
    db.commit()
    db.refresh(session)

    return {"session_id": session.id}