import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.database import SessionLocal, get_db
from app.models import User, TranslationHistory, TpNotification
from app.Core.auth import decode_access_token, get_current_user
from app.services.soniox_engine import run_soniox_bidirectional
from app.services.tts_edge import text_to_speech as text_to_speech_edge
from app.services.billing_service import charge_and_log_usage

router = APIRouter(prefix="/tp", tags=["translation-project"])


@router.websocket("/translate/ws")
async def websocket_translate(websocket: WebSocket):
    await websocket.accept()
    db: Session = SessionLocal()
    loop = asyncio.get_event_loop()

    try:
        try:
            first_msg = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
            cfg = json.loads(first_msg)
        except Exception:
            await websocket.send_text(json.dumps({"error": "Cần gửi config JSON đầu tiên"}))
            await websocket.close()
            return

        token = cfg.get("token", "")
        source_lang = cfg.get("source_lang", "vi")
        target_lang = cfg.get("target_lang", "en")
        service_type = cfg.get("service_type", "voice") # "translate" or "voice"

        # Nếu là auto detect, chúng ta truyền danh sách các ngôn ngữ hỗ trợ làm hints
        if source_lang == "auto":
            source_lang_hints = ["vi", "en", "ja", "ko", "zh"]
        else:
            source_lang_hints = [source_lang]
        
        # Đảm bảo target_lang cũng nằm trong hints
        if target_lang not in source_lang_hints:
            source_lang_hints.append(target_lang)

        payload = decode_access_token(token)
        if not payload:
            await websocket.send_text(json.dumps({"error": "Token không hợp lệ"}))
            await websocket.close()
            return

        email = payload.get("sub")
        user = db.query(User).filter(User.email == email).first()
        if not user:
            await websocket.send_text(json.dumps({"error": "User không hợp lệ"}))
            await websocket.close()
            return

        display = user.full_name or user.email
        
        # Kiểm tra số dư ngay khi bắt đầu kết nối
        from app.services.billing_service import get_or_create_wallet
        wallet = get_or_create_wallet(db, user_id=user.id)
        if wallet.credits_balance <= 0:
            await websocket.send_text(json.dumps({"error": "INSUFFICIENT_CREDITS"}))
            await websocket.close()
            return

        await websocket.send_text(json.dumps({
            "message": f"Kết nối thành công! Xin chào {display}",
            "source_lang": source_lang,
            "target_lang": target_lang,
            "service_type": service_type,
        }))

        from decimal import Decimal
        from app.services.billing_service import estimate_tokens_from_text, get_or_create_wallet
        
        audio_queue = asyncio.Queue()
        final_results = []
        # Lưu vết thời gian bắt đầu thực tế cho mỗi đoạn audio final
        last_final_time = asyncio.get_event_loop().time()

        async def send_callback(data: dict):
            try:
                # Nếu là kết quả cuối cùng (is_final), thực hiện tính phí và gửi thông tin về
                if data.get("is_final") and data.get("original"):
                    final_results.append(data)
                    
                    try:
                        charged = 0
                        if service_type == "translate":
                            # Dịch văn bản: tính theo số từ
                            tokens = estimate_tokens_from_text(data["original"])
                            usage = charge_and_log_usage(
                                db,
                                user_id=user.id,
                                provider="soniox",
                                model="stt-rt-v4",
                                feature="translation",
                                endpoint="/tp/translate/ws",
                                input_tokens=tokens
                            )
                            charged = usage.credits_charged
                        else:
                            # Dịch voice: tính theo thời gian thực tế của đoạn vừa nói
                            nonlocal last_final_time
                            now = asyncio.get_event_loop().time()
                            duration = now - last_final_time
                            last_final_time = now
                            
                            usage = charge_and_log_usage(
                                db,
                                user_id=user.id,
                                provider="soniox",
                                model="stt-rt-v4",
                                feature="stt",
                                endpoint="/tp/translate/ws",
                                audio_seconds=Decimal(str(round(duration, 3)))
                            )
                            charged = usage.credits_charged
                        
                        # Gửi kèm số credits đã trừ và số dư mới
                        wallet = get_or_create_wallet(db, user_id=user.id)
                        data["credits_charged"] = charged
                        data["new_balance"] = int(wallet.credits_balance)
                        
                    except ValueError as ve:
                        if str(ve) == "INSUFFICIENT_CREDITS":
                            data["error"] = "INSUFFICIENT_CREDITS"
                        else:
                            print(f"Billing error: {ve}")
                    except Exception as b_err:
                        print(f"Billing error (Soniox WS callback): {b_err}")

                await websocket.send_text(json.dumps(data))
            except Exception as e:
                print(f"WS send error: {e}")

        async def receive_audio():
            try:
                while True:
                    msg = await websocket.receive()
                    if msg["type"] == "websocket.disconnect":
                        break
                    if msg["type"] != "websocket.receive":
                        continue
                    if msg.get("bytes") is not None:
                        await audio_queue.put(msg["bytes"])
                    elif msg.get("text"):
                        try:
                            ctrl = json.loads(msg["text"])
                            if ctrl.get("action") == "stop":
                                break
                        except json.JSONDecodeError:
                            pass
            except WebSocketDisconnect:
                pass
            finally:
                await audio_queue.put(None)

        recv_task = asyncio.create_task(receive_audio())
        try:
            await run_soniox_bidirectional(
                audio_queue, send_callback, source_lang, target_lang, loop,
                language_hints=source_lang_hints
            )
        finally:
            recv_task.cancel()
            try:
                await recv_task
            except asyncio.CancelledError:
                pass

        for result in final_results:
            db.add(
                TranslationHistory(
                    user_id=user.id,
                    original_text=result.get("original", ""),
                    translated_text=result.get("translated", ""),
                    source_lang=source_lang,
                    target_lang=target_lang,
                    speaker_lang=result.get("speaker_lang"),
                )
            )
        if final_results:
            db.add(
                TpNotification(
                    user_id=user.id,
                    message=f"Đã lưu {len(final_results)} câu dịch (Soniox) vào lịch sử.",
                )
            )
            db.commit()

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({"error": str(e)}))
        except Exception:
            pass
    finally:
        db.close()


@router.post("/translate/tts")
async def text_to_speech(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    text = body.get("text", "").strip()
    lang = body.get("lang", "en").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Missing text")

    try:
        audio_bytes = await text_to_speech_edge(text, lang)
        if not audio_bytes:
             raise HTTPException(status_code=500, detail="TTS generation failed")

        # Billing: log usage and deduct credits
        try:
            charge_and_log_usage(
                db,
                user_id=current_user.id,
                provider="google_tts", # Giữ nguyên provider name cho billing rule
                model=None,
                feature="tts",
                endpoint="/tp/translate/tts",
                input_chars=len(text),
            )
        except ValueError as ve:
            if str(ve) == "INSUFFICIENT_CREDITS":
                raise HTTPException(
                    status_code=402,
                    detail="Bạn không đủ credits để sử dụng text-to-speech. Vui lòng mua thêm token/credits."
                )
            raise

        return Response(content=audio_bytes, media_type="audio/mpeg")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
