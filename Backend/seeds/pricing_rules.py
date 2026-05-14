"""
Seed pricing rules để tính credits.
Chính sách giá mới (Tăng 10x):
- Dịch không voice (Gemini): 100 credits / 1,000 từ (~1,333 tokens).
- Dịch có voice (Soniox): 40 credits / 1 phút.
- Neural TTS: ~2,000,000 credits / 1,000,000 ký tự.
- Edge TTS: 150 USD / 1,000,000 ký tự (~1,500,000 credits).
"""

import sys
import os
from decimal import Decimal

# Add parent directory to path so we can import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models import PricingRule, Base
from app.database.database import engine, SessionLocal

# Ensure tables exist
Base.metadata.create_all(bind=engine)

PRICING_RULES = [
    # ============= Gemini (Dịch không voice) =============
    {
        "provider": "gemini",
        "model": "gemini-2.0-flash",
        "feature": "summary",
        # Price: 100 credits / 1,000 words (~1,333 tokens)
        "credit_per_input_token": Decimal("0.075"),
        "credit_per_output_token": Decimal("0"),
        "cost_per_input_token_usd": Decimal("0.000075"),
        "cost_per_output_token_usd": Decimal("0.0003"),
        "is_active": True,
    },
    {
        "provider": "gemini",
        "model": "gemini-1.5-flash",
        "feature": "summary",
        "credit_per_input_token": Decimal("0.075"),
        "credit_per_output_token": Decimal("0"),
        "cost_per_input_token_usd": Decimal("0.000075"),
        "cost_per_output_token_usd": Decimal("0.0003"),
        "is_active": True,
    },
    # ============= Soniox (Dịch có voice) =============
    {
        "provider": "soniox",
        "model": "stt-rt-v4",
        "feature": "stt",
        # Price: 40 credits / 1 phút = 0.6666 credits/s
        "credit_per_audio_second": Decimal("0.6666"),
        "cost_per_audio_second_usd": Decimal("0.0000277"),
        "is_active": True,
    },
    {
        "provider": "soniox",
        "model": "stt-rt-v4",
        "feature": "translation",
        # Price: 100 credits / 1,000 words (~1,333 tokens)
        "credit_per_input_token": Decimal("0.075"),
        "credit_per_output_token": Decimal("0"),
        "cost_per_input_token_usd": Decimal("0.000075"),
        "cost_per_output_token_usd": Decimal("0.0003"),
        "is_active": True,
    },
    # ============= Google Cloud Text-to-Speech (Neural TTS) =============
    {
        "provider": "google_tts",
        "model": None,
        "feature": "tts",
        # Price: 2,000,000 credits / 1,000,000 ký tự = 2.0 credits/char
        "credit_per_input_char": Decimal("2.0"),
        "cost_per_input_token_usd": None,
        "is_active": True,
    },
    # ============= Edge TTS (150 USD / 1M chars) =============
    {
        "provider": "edge_tts",
        "model": None,
        "feature": "tts",
        # 150 USD / 1,000,000 characters = 1.5 credits/char (assuming 1 USD = 10,000 credits)
        "credit_per_input_char": Decimal("1.5"),
        "cost_per_input_token_usd": None,
        "is_active": True,
    },
]



def seed_pricing_rules():
    """Insert pricing rules vào database"""
    db = SessionLocal()

    try:
        for rule_data in PRICING_RULES:
            # Check if rule already exists
            existing = (
                db.query(PricingRule)
                .filter(
                    PricingRule.provider == rule_data["provider"],
                    PricingRule.model == rule_data["model"],
                    PricingRule.feature == rule_data["feature"],
                )
                .first()
            )

            if not existing:
                rule = PricingRule(**rule_data)
                db.add(rule)
                print(f"Added: {rule_data['provider']} / {rule_data['model']} / {rule_data['feature']}")
            else:
                # Update existing rule
                for key, value in rule_data.items():
                    setattr(existing, key, value)
                print(f"Updated: {rule_data['provider']} / {rule_data['model']} / {rule_data['feature']}")

        db.commit()
        print("\nSeed pricing rules thanh cong!")
    except Exception as e:
        print(f"Seed pricing rules that bai: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_pricing_rules()
