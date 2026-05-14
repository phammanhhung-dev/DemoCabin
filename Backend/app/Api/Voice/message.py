from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import VoiceMessage
from app.schemas import VoiceMessageCreate

router = APIRouter(prefix="/voice/message", tags=["Voice Message"])


@router.post("/save")
def save_message(
    data: VoiceMessageCreate,
    db: Session = Depends(get_db),
):
    msg = VoiceMessage(
        session_id=data.session_id,
        original_text=data.original,
        translated_text=data.translated,
        speaker_lang=data.speaker_lang
    )

    db.add(msg)
    db.commit()
    db.refresh(msg)

    return {"status": "saved"}