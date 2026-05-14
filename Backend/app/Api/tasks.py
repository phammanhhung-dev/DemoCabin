from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import tempfile
import subprocess
import os
import asyncio
from app.services.translation_service import perform_translation

router = APIRouter()

@router.websocket("/ws")
async def websocket_audio(websocket: WebSocket):
    await websocket.accept()
    print("Client connected")

    audio_chunks = []

    try:
        while True:
            chunk = await websocket.receive_bytes()

            if not chunk:
                continue

            audio_chunks.append(chunk)

            if len(audio_chunks) >= 5:
                webm_path = None
                wav_path = None

                try:
                    # 1. ghi file
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as f:
                        for c in audio_chunks:
                            f.write(c)
                        webm_path = f.name

                    wav_path = webm_path.replace(".webm", ".wav")

                    # 2. convert
                    subprocess.run([
                        "ffmpeg",
                        "-y",
                        "-i", webm_path,
                        wav_path
                    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

                    # 3. xử lý AI (NON-BLOCK)
                    result = await asyncio.to_thread(
                        perform_translation,
                        task_id=0,
                        audio_file=wav_path,
                        languages=["vi"],
                        db=None
                    )

                    # 4. gửi về
                    await websocket.send_json({
                        "translations": result
                    })

                except Exception as e:
                    print("ERROR:", e)

                finally:
                    audio_chunks = []

                    if webm_path and os.path.exists(webm_path):
                        os.remove(webm_path)

                    if wav_path and os.path.exists(wav_path):
                        os.remove(wav_path)

    except WebSocketDisconnect:
        print("Client disconnected")