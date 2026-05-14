from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HistoryResponse(BaseModel):
    id: int
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    speaker_lang: Optional[str]
    created_at: datetime
    user_id: int

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    title: Optional[str] = None
    message: str
    type: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
