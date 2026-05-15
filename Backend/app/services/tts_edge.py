import asyncio
import edge_tts
import re
from langdetect import detect, LangDetectException

# Map language codes to Edge TTS voices
VOICE_MAP = {
    "vi": "vi-VN-HoaiMyNeural",           # Vietnamese - Female
    "en": "en-AU-NatashaNeural",          # English (Australian) - Female
    "ja": "ja-JP-NanamiNeural",           # Japanese - Female
    "ko": "ko-KR-SunHiNeural",            # Korean - Female
    "zh": "zh-CN-XiaoxiaoNeural",         # Chinese (Simplified) - Female
}

# Map detected language codes to VOICE_MAP keys
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
        # Lấy 500 chars đầu để detect (tránh confusion từ tên người)
        sample_text = text[:500] if len(text) > 500 else text
        
        detected = detect(sample_text)
        mapped_lang = LANG_DETECT_MAP.get(detected, LANG_DETECT_MAP.get(detected.split("-")[0], "vi"))
        
        # Confidence check: nếu text chứa nhiều từ Anh thì force English
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
        
        # Đếm số lượng từ tiếng Anh xuất hiện (không trùng lặp trong indicators)
        # Tách từ, loại bỏ dấu câu dính liền, giữ lại dấu nháy đơn cho các từ như don't, i'm
        words = set(re.findall(r"[\w']+", sample_text.lower()))
        english_count = sum(1 for indicator in english_indicators if indicator in words)
        
        # Nếu có từ 2 từ tiếng Anh trở lên trong list phổ biến, khả năng cao là tiếng Anh
        if english_count >= 2 and mapped_lang in ["vi", "zh"]:
            print(f"Override: Detected {detected}, but found {english_count} English indicators -> using 'en'")
            return "en"
        
        print(f"Detected language: {detected} -> {mapped_lang} (English markers: {english_count})")
        return mapped_lang
    except LangDetectException as e:
        print(f"Language detection failed: {e}, defaulting to 'vi'")
        return "vi"
    except Exception as e:
        print(f"Unexpected error in language detection: {e}")
        return "vi"


async def text_to_speech_stream(text: str, target_lang: str = "auto"):
    """
    Generator function to stream Edge TTS chunks.
    """
    print(f"🎤 TTS Stream Request: '{text[:30]}...' lang={target_lang}")
    if not text or not text.strip():
        return

    actual_lang = detect_language(text)
    if target_lang == "auto" or not target_lang:
        target_lang = actual_lang
    elif target_lang in ["vi", "zh"] and actual_lang == "en":
        target_lang = "en"
    
    voice = VOICE_MAP.get(target_lang, VOICE_MAP["vi"])
    print(f"🎤 Using voice: {voice} for lang: {target_lang}")
    
    try:
        communicate = edge_tts.Communicate(text, voice=voice)
        chunk_count = 0
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunk_count += 1
                yield chunk["data"]
        print(f"🎤 TTS Stream Finished: {chunk_count} chunks sent")
    except Exception as e:
        print(f"TTS Stream Error: {e}")

async def text_to_speech(text: str, target_lang: str = "auto") -> bytes | None:
    """
    Generate audio from text using Edge TTS with timeout and retry.
    Auto-detects language if target_lang is "auto" or not provided.
    Returns MP3 audio bytes or None if failed.
    """
    if not text or not text.strip():
        return None

    # Detect actual language for override logic
    actual_lang = detect_language(text)

    # Nếu yêu cầu auto hoặc không có target_lang, dùng kết quả detect
    if target_lang == "auto" or not target_lang:
        target_lang = actual_lang
    # Nếu target_lang là vi/zh nhưng thực tế là tiếng Anh, ghi đè để có voice chuẩn hơn
    # Điều này giúp tránh trường hợp AI dịch chưa xong hoặc trả về tiếng Anh khi đang target tiếng Việt
    elif target_lang in ["vi", "zh"] and actual_lang == "en":
        print(f"Override: target_lang is {target_lang} but text is English -> using 'en' voice")
        target_lang = "en"
    
    voice = VOICE_MAP.get(target_lang, VOICE_MAP["vi"])
    
    # Retry 2 lần nếu lỗi
    for attempt in range(2):
        try:
            communicate = edge_tts.Communicate(text, voice=voice)
            audio_bytes = b""
            
            # Timeout 30 giây cho mỗi request
            async with asyncio.timeout(30):
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        audio_bytes += chunk["data"]
            
            if audio_bytes:
                print(f"TTS generated {len(audio_bytes)} bytes with voice '{voice}' for '{text[:30]}...'")
                return audio_bytes
            else:
                print(f"TTS returned empty audio on attempt {attempt + 1}")
                
        except asyncio.TimeoutError:
            print(f"TTS timeout on attempt {attempt + 1}")
        except Exception as e:
            print(f"TTS error (attempt {attempt + 1}): {str(e)[:100]}")
    
    print(f"TTS failed after 2 attempts")
    return None


def text_to_speech_sync(text: str, target_lang: str = "auto") -> bytes | None:
    """
    Sync wrapper cho FastAPI endpoints.
    Sử dụng asyncio.get_running_loop() nếu có, ngược lại dùng asyncio.run()
    """
    try:
        loop = asyncio.get_running_loop()
        # Đang trong async context, trả về task
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(
                asyncio.run,
                text_to_speech(text, target_lang)
            )
            return future.result(timeout=35)
    except RuntimeError:
        # Không có running loop, dùng asyncio.run()
        try:
            return asyncio.run(text_to_speech(text, target_lang))
        except Exception as e:
            print(f"❌ text_to_speech_sync failed: {str(e)[:100]}")
            return None

