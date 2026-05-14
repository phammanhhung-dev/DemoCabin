import base64
import json
import re
import urllib.error
import urllib.request
from langdetect import detect, LangDetectException

from app.services.tp_config import settings

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
    if not settings.GOOGLE_TTS_API_KEY:
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
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={settings.GOOGLE_TTS_API_KEY}"
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
