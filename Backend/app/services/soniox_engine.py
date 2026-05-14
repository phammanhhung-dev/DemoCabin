import asyncio
import os
import threading
import traceback

from app.services.tp_config import settings

os.environ.setdefault("SONIOX_API_KEY", settings.SONIOX_API_KEY)


async def run_soniox_bidirectional(
    audio_queue: asyncio.Queue,
    send_callback,
    source_lang: str = "vi",
    target_lang: str = "en",
    loop: asyncio.AbstractEventLoop = None,
):
    from soniox.client import SonioxClient
    from soniox.types import RealtimeSTTConfig, TranslationConfig

    if loop is None:
        loop = asyncio.get_event_loop()

    def _run():
        client = SonioxClient(api_key=settings.SONIOX_API_KEY)
        config = RealtimeSTTConfig(
            model="stt-rt-v4",
            audio_format="pcm_s16le",
            sample_rate=16000,
            num_channels=1,
            language_hints=[source_lang, target_lang],
            enable_endpoint_detection=True,
            translation=TranslationConfig(
                type="two_way",
                language_a=source_lang,
                language_b=target_lang,
            ),
            include_non_final=True,
        )

        try:
            first_chunk = asyncio.run_coroutine_threadsafe(
                audio_queue.get(), loop
            ).result(timeout=10)
        except Exception as exc:
            print(f"Không nhận được audio chunk đầu tiên: {exc}")
            return

        if first_chunk is None:
            return

        try:
            with client.realtime.stt.connect(config=config) as session:
                send_done = threading.Event()

                def send_audio():
                    try:
                        session.send_bytes(first_chunk, finish=False)
                        while True:
                            future = asyncio.run_coroutine_threadsafe(audio_queue.get(), loop)
                            chunk = future.result(timeout=30)
                            if chunk is None:
                                break
                            session.send_bytes(chunk, finish=False)
                    except Exception as exc:
                        print(f"Lỗi gửi audio: {exc}")
                        print(traceback.format_exc())
                    finally:
                        try:
                            session.close()
                        except Exception:
                            pass
                        send_done.set()

                threading.Thread(target=send_audio, daemon=True).start()

                pending_buffer = {}

                for event in session.receive_events():
                    err_code = getattr(event, "error_code", None)
                    if err_code:
                        err_msg = getattr(event, "error_message", str(err_code))
                        asyncio.run_coroutine_threadsafe(
                            send_callback({"error": f"{err_code}: {err_msg}"}), loop
                        ).result(timeout=5)
                        continue

                    original_tokens = []
                    translated_tokens = []
                    is_final = False
                    event_speaker_lang = None

                    for token in getattr(event, "tokens", []):
                        text = getattr(token, "text", "")
                        # Filter out: empty, <end>, standalone punctuation
                        if not text or text == "<end>":
                            continue
                        # Skip punctuation-only tokens (., ,, ?, !, etc.)
                        if text.strip() and all(c in ".,!?;:-–—…'" for c in text.strip()):
                            continue

                        translation_status = getattr(token, "translation_status", None)
                        token_lang = getattr(token, "language", None)
                        token_is_final = getattr(token, "is_final", False)

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

                    if original_text and not translated_text:
                        pending_buffer["original"] = original_text
                        pending_buffer["speaker_lang"] = event_speaker_lang or source_lang
                        pending_buffer["is_final"] = is_final

                        if not is_final:
                            asyncio.run_coroutine_threadsafe(
                                send_callback({
                                    "original": original_text,
                                    "translated": "",
                                    "speaker_lang": pending_buffer["speaker_lang"],
                                    "is_final": False,
                                }), loop
                            ).result(timeout=5)

                    elif translated_text and not original_text:
                        payload = {
                            "original": pending_buffer.get("original", ""),
                            "translated": translated_text,
                            "speaker_lang": pending_buffer.get("speaker_lang", source_lang),
                            "is_final": pending_buffer.get("is_final", is_final),
                        }
                        asyncio.run_coroutine_threadsafe(
                            send_callback(payload), loop
                        ).result(timeout=5)
                        if pending_buffer.get("is_final"):
                            pending_buffer.clear()

                    else:
                        asyncio.run_coroutine_threadsafe(
                            send_callback({
                                "original": original_text,
                                "translated": translated_text,
                                "speaker_lang": event_speaker_lang or source_lang,
                                "is_final": is_final,
                            }), loop
                        ).result(timeout=5)

                send_done.wait(timeout=5)

        except Exception as exc:
            print(f"Lỗi Soniox:\n{traceback.format_exc()}")
            try:
                asyncio.run_coroutine_threadsafe(
                    send_callback({"error": str(exc)}), loop
                ).result(timeout=5)
            except Exception:
                pass

    await loop.run_in_executor(None, _run)
