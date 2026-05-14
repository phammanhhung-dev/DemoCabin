from openai import OpenAI
from sqlalchemy.orm import Session
from app.crud import update_translation_task
from dotenv import load_dotenv
import os

# 🔥 thêm Soniox
from soniox.transcribe import transcribe

# load env
load_dotenv()

# OpenAI client (dịch text)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Soniox key
SONIOX_API_KEY = os.getenv("SONIOX_API_KEY")


def perform_translation(
    task_id: int,
    text: str = None,
    languages: list = None,
    db: Session = None,
    audio_file: str = None  # 🔥 thêm audio
):
    translations = {}

    try:
        # ==================================================
        # 🔥 CASE 1: AUDIO → Soniox
        # ==================================================
        if audio_file:
            result = transcribe(
                api_key=SONIOX_API_KEY,
                file=audio_file
            )

            speech_text = result.get("text", "")
            translations["speech_to_text"] = speech_text

            # 👉 nếu có languages thì dịch tiếp
            if languages:
                for lang in languages:
                    try:
                        res = client.chat.completions.create(
                            model="gpt-4o-mini",
                            messages=[
                                {"role": "user", "content": f"Translate this to {lang}: {speech_text}"}
                            ]
                        )
                        translations[lang] = res.choices[0].message.content.strip()
                    except Exception as e:
                        translations[lang] = f"Error: {str(e)}"

        # ==================================================
        # 🔥 CASE 2: TEXT → dịch bình thường
        # ==================================================
        elif text:
            for lang in languages:
                try:
                    response = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "system", "content": "You are a translation assistant."},
                            {"role": "user", "content": f"Translate this to {lang}: {text}"}
                        ]
                    )

                    translated_text = response.choices[0].message.content.strip()
                    translations[lang] = translated_text

                except Exception as e:
                    translations[lang] = f"Error: {str(e)}"

        else:
            translations["error"] = "No input provided"

    except Exception as e:
        translations["error"] = str(e)

    # 🔥 lưu DB
    update_translation_task(db, task_id, translations)

    return translations