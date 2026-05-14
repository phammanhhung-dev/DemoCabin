import asyncio
import base64
import json
import os
import re
import threading
import traceback
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from langdetect import detect, LangDetectException
from dotenv import load_dotenv

import websockets
from soniox.client import SonioxClient
from soniox.types import RealtimeSTTConfig, TranslationConfig

# Load biến môi trường từ .env
load_dotenv()

# ==================== CAU HINH ====================
# Ưu tiên lấy từ .env, nếu không có mới dùng mã cứng
API_KEY = os.getenv("SONIOX_API_KEY", "ad9de78a4b11833e927dae042c78af657a8068c05a80e6c8cd24d2a1badd46c0")

# Debug: In ra 4 ký tự đầu và cuối của API Key để kiểm tra (không in hết để bảo mật)
if API_KEY:
    masked_key = f"{API_KEY[:4]}...{API_KEY[-4:]}"
    print(f"DEBUG: Using Soniox API Key: {masked_key}")
else:
    print("DEBUG: Soniox API Key is MISSING!")
# ==================================================
WS_HOST = "localhost"
WS_PORT = 8765
HTTP_HOST = "localhost"
HTTP_PORT = 8766
GOOGLE_TTS_API_KEY = os.environ.get("GOOGLE_TTS_API_KEY", "")
# ==================================================

os.environ.setdefault("SONIOX_API_KEY", API_KEY)


LANGUAGE_CODE_MAP = {
    "en": "en-US",
    "vi": "vi-VN",
    "zh": "cmn-CN",
    "ja": "ja-JP",
    "ko": "ko-KR",
    "fr": "fr-FR",
    "de": "de-DE",
    "es": "es-ES",
    "th": "th-TH",
    "ar": "ar-XA",
    "ru": "ru-RU",
    "pt": "pt-BR",
    "hi": "hi-IN",
    "id": "id-ID",
}


# Map detected language codes to LANGUAGE_CODE_MAP keys
LANG_DETECT_MAP = {
    "vi": "vi",
    "en": "en",
    "ja": "ja",
    "ko": "ko",
    "zh-cn": "zh",
    "zh-tw": "zh",
    "zh": "zh",
}


def detect_language(text: str) -> str:
    """
    Auto-detect language from text with confidence check.
    Returns language code: "vi", "en", "ja", "ko", "zh", or default "vi"
    """
    if not text or not text.strip():
        return "vi"
    
    try:
        sample_text = text[:500] if len(text) > 500 else text
        detected = detect(sample_text)
        mapped_lang = LANG_DETECT_MAP.get(detected, LANG_DETECT_MAP.get(detected.split("-")[0], "vi"))
        
        english_indicators = [
            "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
            "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
            "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
            "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
            "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
            "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
            "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
            "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
            "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
            "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
            "don't", "should", "couldn't", "won't", "it's", "i'm", "you're", "why"
        ]
        
        words = set(re.findall(r"[\w']+", sample_text.lower()))
        english_count = sum(1 for indicator in english_indicators if indicator in words)
        
        if english_count >= 2 and mapped_lang in ["vi", "zh"]:
            return "en"
        
        return mapped_lang
    except Exception:
        return "vi"


def synthesize_google_tts(text: str, lang: str) -> bytes:
    if not GOOGLE_TTS_API_KEY:
        raise RuntimeError("Missing GOOGLE_TTS_API_KEY")

    # Override logic: nếu lang là vi/zh nhưng thực tế là tiếng Anh, dùng 'en'
    actual_lang = detect_language(text)
    if lang in ["vi", "zh"] and actual_lang == "en":
        lang = "en"
    elif lang == "auto":
        lang = actual_lang

    language_code = LANGUAGE_CODE_MAP.get(lang, lang if "-" in lang else "en-US")
    payload = {
        "input": {"text": text},
        "voice": {"languageCode": language_code},
        "audioConfig": {"audioEncoding": "MP3"},
    }
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={GOOGLE_TTS_API_KEY}"
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Google TTS HTTP {exc.code}: {details}") from exc

    audio_content = body.get("audioContent")
    if not audio_content:
        raise RuntimeError("Google TTS returned empty audioContent")
    return base64.b64decode(audio_content)


class TTSHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_POST(self):
        if self.path != "/tts":
            self.send_error(HTTPStatus.NOT_FOUND, "Not Found")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(content_length)
            payload = json.loads(raw.decode("utf-8"))
            text = str(payload.get("text", "")).strip()
            lang = str(payload.get("lang", "en")).strip()
            if not text:
                self.send_error(HTTPStatus.BAD_REQUEST, "Missing text")
                return

            audio_bytes = synthesize_google_tts(text, lang)
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(audio_bytes)))
            self.end_headers()
            self.wfile.write(audio_bytes)
        except Exception as exc:
            message = json.dumps({"error": str(exc)}).encode("utf-8")
            self.send_response(HTTPStatus.BAD_GATEWAY)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(message)))
            self.end_headers()
            self.wfile.write(message)

    def log_message(self, format, *args):
        return


def start_http_server():
    server = ThreadingHTTPServer((HTTP_HOST, HTTP_PORT), TTSHandler)
    print(f"HTTP TTS   : http://{HTTP_HOST}:{HTTP_PORT}/tts")
    server.serve_forever()


async def audio_handler(websocket):
    print(f"Client ket noi: {websocket.remote_address}")

    audio_queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    source_lang = "vi"
    target_lang = "en"

    try:
        first_msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
        cfg = json.loads(first_msg)
        source_lang = cfg.get("source_lang", "vi")
        target_lang = cfg.get("target_lang", "en")
        print(f"Config: {source_lang} <-> {target_lang} (bidirectional)")
    except Exception:
        pass

    async def safe_send(payload: dict) -> bool:
        try:
            await websocket.send(json.dumps(payload))
            return True
        except websockets.exceptions.ConnectionClosed:
            return False

    async def receive_audio():
        try:
            async for message in websocket:
                if isinstance(message, bytes):
                    await audio_queue.put(message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await audio_queue.put(None)

    async def process_with_soniox():
        def run_soniox():
            client = SonioxClient(api_key=API_KEY)

            # Bidirectional: luôn nhận diện cả Việt lẫn Anh
            config = RealtimeSTTConfig(
                model="stt-rt-v4",
                audio_format="pcm_s16le",
                sample_rate=16000,
                num_channels=1,
                # Cho phép nhận diện cả 2 ngôn ngữ
                language_hints=[source_lang, target_lang],
                enable_endpoint_detection=True,
                translation=TranslationConfig(
                    # "two_way": dịch song phương giữa 2 ngôn ngữ
                    # Yêu cầu language_a + language_b, KHÔNG dùng target_language
                    type="two_way",
                    language_a=source_lang,  # "vi"
                    language_b=target_lang,  # "en"
                ),
                include_non_final=True,  # Bật để hiển thị chữ nhảy (interim)
            )

            print(f"Soniox config: hints={[source_lang, target_lang]}, target={target_lang}, type=two_way")

            try:
                # Tăng timeout lên 30s để người dùng có thời gian nhấn "Allow" micro
                first_chunk = asyncio.run_coroutine_threadsafe(
                    audio_queue.get(), loop
                ).result(timeout=30)
            except Exception as exc:
                print(f"Lỗi: Không nhận được audio chunk đầu tiên sau 30s hoặc kết nối lỗi: {exc}")
                print(traceback.format_exc())
                return

            if first_chunk is None:
                print("Client dong truoc khi gui audio.")
                return

            try:
                with client.realtime.stt.connect(config=config) as session:
                    send_done = threading.Event()
                    stop_flag = threading.Event()  # 🔥 Thêm flag điều khiển dừng Soniox

                    def send_audio():
                        try:
                            session.send_bytes(first_chunk, finish=False)
                            while True:
                                future = asyncio.run_coroutine_threadsafe(
                                    audio_queue.get(), loop
                                )
                                chunk = future.result(timeout=30)
                                if chunk is None:
                                    break
                                session.send_bytes(chunk, finish=False)
                        except Exception as exc:
                            print(f"Loi gui audio: {exc}")
                            print(traceback.format_exc())
                        finally:
                            stop_flag.set()  # 🔥 Báo dừng receive loop khi client disconnect
                            try:
                                session.close()
                            except Exception:
                                pass
                            send_done.set()

                    threading.Thread(target=send_audio, daemon=True).start()

                    pending_buffer = {}  # buffer gộp event original + translation

                    # ==================== FIX CHÍNH: receive loop có stop_flag ====================
                    try:
                        while not stop_flag.is_set():
                            try:
                                event = session.receive_event()
                            except Exception as e:
                                print("Soniox receive error:", e)
                                break
                            if event is None:
                                break

                            # Xử lý lỗi từ Soniox
                            err_code = getattr(event, "error_code", None)
                            if err_code:
                                err_msg = getattr(event, "error_message", str(err_code))
                                print(f"Loi server Soniox {err_code}: {err_msg}")
                                ok = asyncio.run_coroutine_threadsafe(
                                    safe_send({"error": f"{err_code}: {err_msg}"}),
                                    loop,
                                ).result(timeout=5)
                                if not ok:
                                    stop_flag.set()
                                    break
                                continue

                            # Soniox gửi original và translated trong 2 event riêng biệt
                            original_tokens = []
                            translated_tokens = []
                            is_final = False
                            event_speaker_lang = None  # ngôn ngữ của event này

                            for token in getattr(event, "tokens", []):
                                text = getattr(token, "text", "")
                                if not text or text == "<end>":
                                    continue

                                translation_status = getattr(token, "translation_status", None)
                                token_lang = getattr(token, "language", None)
                                token_is_final = getattr(token, "is_final", False)

                                # Lấy ngôn ngữ của event từ token đầu tiên có lang
                                if token_lang and event_speaker_lang is None:
                                    event_speaker_lang = token_lang.split("-")[0].lower()

                                if translation_status == "translation":
                                    translated_tokens.append(text)
                                else:
                                    original_tokens.append(text)

                                if token_is_final:
                                    is_final = True

                            original_text = "".join(original_tokens).strip()
                            translated_text = "".join(translated_tokens).strip()

                            if not original_text and not translated_text:
                                continue

                            # Phân loại event
                            if original_text and not translated_text:
                                # Event câu gốc → buffer
                                pending_buffer["original"] = original_text
                                pending_buffer["speaker_lang"] = event_speaker_lang or source_lang
                                pending_buffer["is_final"] = is_final

                                if not is_final:
                                    # Interim: gửi ngay phần gốc để FE hiển thị chữ nhảy
                                    payload = {
                                        "original": original_text,
                                        "translated": "",
                                        "speaker_lang": pending_buffer["speaker_lang"],
                                        "is_final": False,
                                    }
                                    ok = asyncio.run_coroutine_threadsafe(
                                        safe_send(payload), loop
                                    ).result(timeout=5)
                                    if not ok:
                                        stop_flag.set()
                                        break

                            elif translated_text and not original_text:
                                # Event bản dịch → gộp với buffer rồi gửi
                                buffered_original = pending_buffer.get("original", "")
                                buffered_speaker_lang = pending_buffer.get("speaker_lang", source_lang)
                                buffered_is_final = pending_buffer.get("is_final", is_final)

                                payload = {
                                    "original": buffered_original,
                                    "translated": translated_text,
                                    "speaker_lang": buffered_speaker_lang,
                                    "is_final": buffered_is_final,
                                }
                                print(
                                    f"[{'FINAL' if buffered_is_final else 'interim'}] "
                                    f"speaker={buffered_speaker_lang} | "
                                    f"original='{buffered_original}' | "
                                    f"translated='{translated_text}'"
                                )
                                ok = asyncio.run_coroutine_threadsafe(
                                    safe_send(payload), loop
                                ).result(timeout=5)
                                if not ok:
                                    stop_flag.set()
                                    break
                                # Reset buffer sau khi đã gửi final
                                if buffered_is_final:
                                    pending_buffer.clear()

                            else:
                                # Trường hợp hiếm: cả original lẫn translated trong cùng event
                                speaker_lang = event_speaker_lang or source_lang
                                payload = {
                                    "original": original_text,
                                    "translated": translated_text,
                                    "speaker_lang": speaker_lang,
                                    "is_final": is_final,
                                }
                                print(
                                    f"[{'FINAL' if is_final else 'interim'}] "
                                    f"speaker={speaker_lang} | "
                                    f"original='{original_text}' | "
                                    f"translated='{translated_text}'"
                                )
                                ok = asyncio.run_coroutine_threadsafe(
                                    safe_send(payload), loop
                                ).result(timeout=5)
                                if not ok:
                                    stop_flag.set()
                                    break

                    except Exception as e:
                        print("Soniox loop stopped:", e)
                    finally:
                        try:
                            session.close()
                        except:
                            pass

                    send_done.wait(timeout=5)

            except Exception as exc:
                print("Loi Soniox (exception day du):")
                print(traceback.format_exc())
                try:
                    asyncio.run_coroutine_threadsafe(
                        safe_send({"error": str(exc)}), loop
                    ).result(timeout=5)
                except Exception:
                    pass

        await loop.run_in_executor(None, run_soniox)

    await asyncio.gather(
        asyncio.create_task(receive_audio()),
        asyncio.create_task(process_with_soniox()),
    )
    print(f"Client ngat ket noi: {websocket.remote_address}")


async def main():
    print("=" * 50)
    print("AI Speech Translator Server - Bidirectional Vi<->En")
    print(f"WebSocket : ws://{WS_HOST}:{WS_PORT}")
    print(f"HTTP TTS  : http://{HTTP_HOST}:{HTTP_PORT}/tts")
    print("Model     : stt-rt-v4 | Bidirectional")
    print("=" * 50)
    threading.Thread(target=start_http_server, daemon=True).start()
    async with websockets.serve(audio_handler, WS_HOST, WS_PORT):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())