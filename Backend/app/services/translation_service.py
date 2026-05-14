from sqlalchemy.orm import Session
from app.crud import update_translation_task
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def perform_translation(
    task_id: int,
    text: str = None,
    languages: list = None,
    db: Session = None,
    audio_file: str = None
):
    translations = {}

    try:
        # TEXT
        if text and languages:
            for lang in languages:
                try:
                    response = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "user", "content": f"Translate this to {lang}: {text}"}
                        ]
                    )

                    translations[lang] = response.choices[0].message.content.strip()

                except Exception as e:
                    translations[lang] = f"Error: {str(e)}"

        # AUDIO (mock nếu chưa fix Soniox)
        elif audio_file:
            translations["speech_to_text"] = "audio received"

        else:
            translations["error"] = "No input provided"

    except Exception as e:
        translations["error"] = str(e)

    # ✅ chỉ update DB nếu có
    if db:
        update_translation_task(db, task_id, translations)

    return translations