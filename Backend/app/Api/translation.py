from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import User
from datetime import datetime
from app.models import Translation, UserTranslationHistory, UserTranslationHistoryState
from app.Core.auth import get_current_user, require_roles
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
from openai import RateLimitError
import os
import httpx
import re
from dotenv import load_dotenv

# Nạp biến môi trường ngay khi khởi động module
_current_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(os.path.dirname(_current_dir))
_env_path = os.path.join(_backend_dir, ".env")
load_dotenv(_env_path)

from sqlalchemy.orm import Session
from io import BytesIO

from app.database.database import get_db
from app.services.billing_service import charge_and_log_usage, estimate_tokens_from_text
from app.services.tts_edge import text_to_speech, text_to_speech_stream

from app.crud import save_translation_to_db

router = APIRouter(prefix="/translation", tags=["translation"])

class ConversationSegment(BaseModel):
    original: str
    translated: str
    speaker_lang: Optional[str] = None


class TranslationCreate(BaseModel):
    original: Optional[str] = None
    translated: Optional[str] = None
    # Hỗ trợ thêm các trường từ cuộc hội thoại (Conversation)
    segments: Optional[List[ConversationSegment]] = None
    summary: Optional[dict] = None
    type: Optional[str] = "text"
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None


class ConversationSummaryRequest(BaseModel):
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None
    segments: List[ConversationSegment]


# Tóm tắt
def _get_gemini_config():
    """Lấy cấu hình Gemini mới nhất từ môi trường."""
    # Nạp lại .env mỗi lần gọi để đảm bảo lấy được Key mới nhất mà không cần restart server
    load_dotenv(_env_path, override=True)
    key = os.getenv("GEMINI_API_KEY", "").strip().strip('"').strip("'")
    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip().strip('"').strip("'")
    return key, model


_openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "").strip().strip('"'))

def _summarize_with_xai(prompt: str) -> str:
    """
    Fallback using xAI (Grok). OpenAI-compatible.
    """
    api_key = os.getenv("XAI_API_KEY", "").strip().strip('"')
    if not api_key:
        return "FAIL: No xAI API Key"
    
    try:
        # xAI dùng OpenAI-compatible API
        client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1")
        response = client.chat.completions.create(
            model="grok-2-latest", # Hoặc grok-beta
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes conversations."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"FAIL: xAI Error: {str(e)}"


def _summarize_with_gemini(prompt: str) -> str:
    """
    Fallback using Google Gemini (Google AI Studio).
    Tự động thử nghiệm các phiên bản API và Model để đảm bảo thành công.
    """
    api_key, model_env = _get_gemini_config()
    
    if not api_key:
        return "Không tạo được tóm tắt (chưa cấu hình GEMINI_API_KEY)."

    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    # Danh sách các tổ hợp model để thử nghiệm (ưu tiên model từ .env)
    configs = []
    if model_env:
        configs.append(("v1", model_env))
        configs.append(("v1beta", model_env))
    
    # Các tổ hợp dự phòng phổ biến (Cập nhật cho năm 2026)
    configs.extend([
        ("v1", "gemini-3.1-flash-lite-preview"),
        ("v1", "gemini-2.0-flash-lite"),
        ("v1", "gemini-2.5-flash"),
        ("v1", "gemini-2.0-flash"),
        ("v1beta", "gemini-3.1-flash-lite-preview"),
        ("v1beta", "gemini-2.0-flash-lite"),
    ])

    # Loại bỏ trùng lặp và giữ nguyên thứ tự
    seen = set()
    unique_configs = []
    for c in configs:
        if c not in seen:
            unique_configs.append(c)
            seen.add(c)

    last_err = ""
    with httpx.Client(timeout=30) as client:
        for version, model in unique_configs:
            if not model: continue
            url = f"https://generativelanguage.googleapis.com/{version}/models/{model}:generateContent"
            try:
                r = client.post(url, params={"key": api_key}, json=payload)
                
                if r.status_code == 200:
                    data = r.json()
                    parts = (data.get("candidates", [{}])[0].get("content", {}).get("parts", []))
                    out = "\n".join([p.get("text", "") for p in parts if "text" in p]).strip()
                    if out: return out
                    last_err = f"Model {model} ({version}) không trả về nội dung (có thể do bộ lọc an toàn)."
                    continue

                # Xử lý các lỗi đặc biệt
                err_json = {}
                try:
                    err_json = r.json()
                except:
                    pass
                
                err_msg = err_json.get("error", {}).get("message", r.text[:100])
                
                # Nếu hết hạn ngạch (429), dừng lại luôn và báo lỗi này vì thử model khác cũng vậy
                if r.status_code == 429:
                    return f"Không tạo được tóm tắt. Lỗi: Bạn đã hết hạn ngạch sử dụng Gemini (Quota Exceeded). Vui lòng thử lại sau hoặc đổi API Key."

                last_err = f"Model {model} ({version}) thất bại: {err_msg}"
                
                # Nếu lỗi là 404 (Not Found), tiếp tục thử model khác trong list
                continue
            except Exception as e:
                last_err = f"Lỗi kết nối tới {model} ({version}): {str(e)}"
                continue

    return f"Không tạo được tóm tắt. Lỗi từ Google: {last_err}"


def _split_bilingual_summary(text: str) -> tuple[str, str]:
    """
    Robustly split model output into (original_summary, translated_summary).
    Accepts variants:
    - "TÓM TẮT_GỐC:" / "TÓM TẮT_DỊCH:"
    - "TÓM TẮT GỐC" / "TÓM TẮT DỊCH" (with/without colon)
    """
    if not text:
        return "", ""

    t = text.strip()
    # Normalize common variants to a single marker format
    t = re.sub(r"(?i)\bTÓM\s*TẮT\s*_?\s*GỐC\b\s*:?", "TÓM TẮT_GỐC:", t)
    t = re.sub(r"(?i)\bTÓM\s*TẮT\s*_?\s*DỊCH\b\s*:?", "TÓM TẮT_DỊCH:", t)

    lower = t.lower()
    if "tóm tắt_gốc:" in lower and "tóm tắt_dịch:" in lower:
        # Split by the translated marker first (more stable)
        left, right = t.split("TÓM TẮT_DỊCH:", 1)
        orig = left.split("TÓM TẮT_GỐC:", 1)[-1].strip()
        tran = right.strip()
        return orig, tran

    return "", t


def _summarize_with_openai(prompt: str) -> str:
    """
    Fallback using OpenAI (GPT-4o mini).
    """
    api_key = os.getenv("OPENAI_API_KEY", "").strip().strip('"')
    if not api_key:
        return "FAIL: No OpenAI API Key"
    
    try:
        response = _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes conversations."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"FAIL: OpenAI Error: {str(e)}"


def _summarize_with_groq(prompt: str) -> str:
    """
    Fallback using Groq (Llama 3).
    """
    api_key = os.getenv("GROQ_API_KEY", "").strip().strip('"')
    if not api_key:
        return "FAIL: No Groq API Key"
    
    try:
        # Groq dùng OpenAI-compatible API
        client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes conversations in Vietnamese and English."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"FAIL: Groq Error: {str(e)}"


@router.post("/summary")
def summarize_conversation(
    payload: ConversationSummaryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Basic guardrails
    segments = payload.segments or []
    joined_original = "\n".join([s.original.strip() for s in segments if (s.original or "").strip()]).strip()
    joined_translated = "\n".join([s.translated.strip() for s in segments if (s.translated or "").strip()]).strip()
    if not joined_original and not joined_translated:
        return {"original": "", "translated": ""}

    prompt = (
        "Bạn là trợ lý tóm tắt cuộc hội thoại song ngữ.\n"
        "Hãy tóm tắt NGẮN GỌN, DỄ HIỂU, giữ đúng ý chính, dạng gạch đầu dòng nếu phù hợp.\n"
        "Trả về CHÍNH XÁC 2 phần theo đúng định dạng sau (bắt buộc giữ nguyên tiêu đề và dấu hai chấm):\n"
        "TÓM TẮT_GỐC: <nội dung>\n"
        "TÓM TẮT_DỊCH: <nội dung>\n"
        "Không thêm lời mở đầu/khép lại.\n\n"
        f"--- ORIGINAL ---\n{joined_original}\n\n"
        f"--- TRANSLATED ---\n{joined_translated}\n"
    )

    # Khởi tạo các biến billing mặc định
    provider = "gemini"
    _, model = _get_gemini_config()
    input_tokens = None
    output_tokens = None
    input_chars = len(prompt)

    # Lớp 1: Gemini (Miễn phí 15 RPM)
    text = _summarize_with_gemini(prompt)
    
    # Lớp 2: Groq (Miễn phí, cực nhanh)
    if "Không tạo được tóm tắt" in text or "Lỗi từ Google" in text:
        provider = "groq"
        model = "llama-3.3-70b"
        groq_text = _summarize_with_groq(prompt)
        if not groq_text.startswith("FAIL:"):
            text = groq_text
        else:
            # Lớp 3: xAI (Grok)
            provider = "xai"
            model = "grok-2-latest"
            xai_text = _summarize_with_xai(prompt)
            if not xai_text.startswith("FAIL:"):
                text = xai_text
            else:
                # Lớp 4: OpenAI
                provider = "openai"
                model = "gpt-4o-mini"
                openai_text = _summarize_with_openai(prompt)
                if not openai_text.startswith("FAIL:"):
                    text = openai_text
                else:
                    # Tất cả đều thất bại
                    return {
                        "original": "",
                        "translated": "Hệ thống đang quá tải hoặc hết hạn ngạch tất cả dịch vụ AI (Gemini, Groq, Grok, OpenAI). Vui lòng thử lại sau.",
                    }

    orig, tran = _split_bilingual_summary(text)


    # Billing: log usage (optionally debit credits)
    output_chars = len(text or "")
    if input_tokens is None and output_tokens is None:
        # Gemini may not return tokens -> estimate from text length
        input_tokens = estimate_tokens_from_text(prompt)
        output_tokens = estimate_tokens_from_text(text or "")

    try:
        charge_and_log_usage(
            db,
            user_id=current_user.id,
            provider=provider,
            model=model,
            feature="summary",
            endpoint="/translation/summary",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            input_chars=input_chars,
            output_chars=output_chars,
        )
    except ValueError as ve:
        if str(ve) == "INSUFFICIENT_CREDITS":
            return {
                "original": "",
                "translated": "Bạn không đủ credits để tạo tóm tắt. Vui lòng mua thêm token/credits.",
            }
        raise

    return {"original": orig, "translated": tran}

@router.post("/save")
def save_translation(
    data: TranslationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    original_text = data.original
    translated_text = data.translated

    # Nếu là dạng cuộc hội thoại và có segments
    if data.segments and not (original_text and translated_text):
        original_text = "\n".join([s.original for s in data.segments if s.original])
        translated_text = "\n".join([s.translated for s in data.segments if s.translated])
    
    # Nếu có tóm tắt, ưu tiên lưu tóm tắt vào lịch sử để dễ đọc
    if data.summary and isinstance(data.summary, dict):
        s_orig = data.summary.get("original")
        s_tran = data.summary.get("translated")
        if s_orig and s_tran:
            original_text = f"[Tóm tắt] {s_orig}"
            translated_text = f"[Tóm tắt] {s_tran}"

    if not original_text or not translated_text:
        raise HTTPException(status_code=400, detail="Không có nội dung để lưu")

    save_translation_to_db(db, current_user.id, original_text, translated_text)
    return {"message": "saved"}

@router.get("/history")
def get_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Luôn trả về từ bảng user để ID ổn định cho thao tác xóa.
    # Nếu chưa có data: backfill dần từ bảng gốc theo trang và trạng thái purge.

    state = db.query(UserTranslationHistoryState).filter(
        UserTranslationHistoryState.user_id == current_user.id
    ).first()
    purged_at = state.purged_at if state else None

    base_user_q = (
        db.query(UserTranslationHistory)
        .filter(UserTranslationHistory.user_id == current_user.id)
        .order_by(UserTranslationHistory.created_at.desc(), UserTranslationHistory.id.desc())
    )

    # Nếu đã có sẵn, trả thẳng theo trang
    existing = base_user_q.offset(skip).limit(limit).all()
    if existing:
        return existing

    # Backfill từ bảng gốc (chỉ những bản ghi sau mốc purge)
    t_q = db.query(Translation).filter(Translation.user_id == current_user.id)
    if purged_at:
        t_q = t_q.filter(Translation.created_at > purged_at)

    translations = (
        t_q.order_by(Translation.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    for t in translations:
        exists = (
            db.query(UserTranslationHistory.id)
            .filter(
                UserTranslationHistory.user_id == current_user.id,
                UserTranslationHistory.source_translation_id == t.id,
            )
            .first()
        )
        if exists:
            continue
        db.add(
            UserTranslationHistory(
                user_id=current_user.id,
                source_translation_id=t.id,
                original=t.original or "",
                translated=t.translated or "",
                created_at=t.created_at,
            )
        )
    db.commit()

    # Re-query bảng user để trả về đúng ID của bảng user
    return base_user_q.offset(skip).limit(limit).all()


@router.delete("/history/all")
def delete_all_my_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    state = db.query(UserTranslationHistoryState).filter(
        UserTranslationHistoryState.user_id == current_user.id
    ).first()
    if not state:
        state = UserTranslationHistoryState(user_id=current_user.id, purged_at=now)
        db.add(state)
    else:
        state.purged_at = now

    db.query(UserTranslationHistory).filter(
        UserTranslationHistory.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "deleted_all"}


@router.delete("/history/{id}")
def delete_my_history_item(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = (
        db.query(UserTranslationHistory)
        .filter(UserTranslationHistory.id == id, UserTranslationHistory.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"message": "deleted"}

@router.get("/admin/history/{user_id}")
def get_user_history(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))  # Chỉ admin
):
    translations = db.query(Translation)\
        .filter(Translation.user_id == user_id)\
        .order_by(Translation.created_at.desc())\
        .all()

    return [
        {
            "id": t.id,
            "original": t.original,
            "translated": t.translated,
            "created_at": t.created_at.isoformat() if t.created_at else None
        } for t in translations
    ]

@router.delete("/admin/delete/{id}")
def delete_translation(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    item = db.query(Translation).filter(Translation.id == id).first()

    if not item:
        return {"error": "Not found"}

    db.delete(item)
    db.commit()

    return {"message": "deleted"}


# ================= TTS (Text-to-Speech) =================

class TTSRequest(BaseModel):
    text: str
    lang: Optional[str] = "auto"  # "vi", "en", "ja", "ko", "zh", or "auto" for auto-detection


@router.post("/tts")
async def generate_tts(
    request: TTSRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate audio from text using Edge TTS (edge-tts library).
    Returns a streaming response for minimal latency.
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    # Billing: Charge for TTS
    try:
        charge_and_log_usage(
            db,
            user_id=current_user.id,
            provider="google_tts", # Dùng rule google_tts để tính giá cao theo yêu cầu
            model=None,
            feature="tts",
            endpoint="/translation/tts",
            input_chars=len(request.text),
        )
    except ValueError as ve:
        if str(ve) == "INSUFFICIENT_CREDITS":
            raise HTTPException(status_code=402, detail="INSUFFICIENT_CREDITS")
        raise

    return StreamingResponse(
        text_to_speech_stream(request.text, target_lang=request.lang),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=speech.mp3",
            "Cache-Control": "no-cache",
        }
    )

@router.get("/tts")
async def generate_tts_get(
    text: str = Query(...),
    lang: str = Query("auto"),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    GET version of TTS for direct use in <audio src="...">.
    Supports token in query parameter for authentication.
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    user_id = None
    # Manual token validation if provided via query
    if token:
        from app.Core.auth import SECRET_KEY, ALGORITHM
        from jose import jwt, JWTError
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            if email:
                user = db.query(User).filter(User.email == email).first()
                if user:
                    user_id = user.id
                    # Billing: Charge for TTS
                    try:
                        charge_and_log_usage(
                            db,
                            user_id=user.id,
                            provider="google_tts",
                            model=None,
                            feature="tts",
                            endpoint="/translation/tts",
                            input_chars=len(text),
                        )
                    except ValueError as ve:
                        if str(ve) == "INSUFFICIENT_CREDITS":
                            # Với GET request trả về audio, nếu hết credit có thể log lỗi hoặc raise 402
                            # Tuy nhiên Audio element có thể không handle được 402 tốt.
                            print(f"❌ User {email} insufficient credits for TTS")
                            raise HTTPException(status_code=402, detail="INSUFFICIENT_CREDITS")
                else:
                    print(f"GET /tts: User {email} not found")
            else:
                print("GET /tts: Invalid token payload")
        except JWTError as e:
            print(f"GET /tts: Token error: {e}")
            
    print(f"🔊 GET /tts: Streaming '{text[:30]}...' (lang: {lang}) (User: {user_id})")
    
    return StreamingResponse(
        text_to_speech_stream(text, target_lang=lang),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=speech.mp3",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "http://localhost:3000",
            "Access-Control-Allow-Credentials": "true",
        }
    )