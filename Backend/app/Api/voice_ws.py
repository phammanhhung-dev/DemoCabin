from fastapi import APIRouter, WebSocket, Depends
from jose import jwt, JWTError
import httpx
import traceback
import time
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import User
from app.crud import save_translation_to_db

router = APIRouter()

SECRET_KEY = "your_super_secret_key_here"
ALGORITHM = "HS256"


@router.websocket("/ws/translate")
async def websocket_translate(websocket: WebSocket, db: Session = Depends(get_db)):
    token = websocket.query_params.get("token")

    if not token:
        await websocket.close()
        print("❌ No token")
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")

        if not email:
            raise Exception("Invalid token")
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise Exception("User not found")

    except JWTError:
        await websocket.close()
        print("❌ Invalid token")
        return
    except Exception as e:
        await websocket.close()
        print(f"❌ Error: {e}")
        return

    await websocket.accept()
    print("✅ Client connected:", email)

    # 🔥 BUFFER AUDIO
    audio_buffer = b""
    last_process_time = time.time()

    try:
        async with httpx.AsyncClient() as client:
            while True:
                data = await websocket.receive_bytes()
                audio_buffer += data

                print("🔥 chunk:", len(data), "| total:", len(audio_buffer))

                # 👉 chỉ xử lý mỗi 1 giây
                if time.time() - last_process_time < 1:
                    continue

                print("🎤 PROCESSING AUDIO...")

                # 👉 GIẢ LẬP (sau thay Soniox)
                original = "xin chào"
                translated = "hello"

                # ✅ SAVE DB
                try:
                    save_translation_to_db(db, user.id, original, translated)
                except Exception as e:
                    print("❌ SAVE FAIL:", e)

                # ✅ TRẢ VỀ FRONTEND
                await websocket.send_json({
                    "original": original,
                    "translated": translated,
                    "is_final": True
                })

                # 🔥 RESET BUFFER
                audio_buffer = b""
                last_process_time = time.time()

    except Exception as e:
        print("❌ WS ERROR:")
        traceback.print_exc()