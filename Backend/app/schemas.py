from pydantic import BaseModel
from typing import List, Dict, Literal

class TranslationRequest(BaseModel):
    text: str
    languages: List[str]

class TaskResponse(BaseModel):
    task_id: int

class TranslationStatus(BaseModel):
    task_id: int
    status: str
    translations: Dict[str, str]

class TaskCreate(BaseModel):
    title: str

class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str
    avatar_url: str = None

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    avatar_url: str = None

    class Config:
        from_attributes = True

# Voice
class VoiceSessionResponse(BaseModel):
    session_id: int


class VoiceMessageCreate(BaseModel):
    session_id: int
    original: str
    translated: str
    speaker_lang: Literal["vi", "en"]