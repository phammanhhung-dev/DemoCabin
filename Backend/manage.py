#!/usr/bin/env python3
"""
Database management script
Usage:
    python manage.py seed-pricing-rules      # Seed pricing rules
    python manage.py create-tables            # Create all tables
    python manage.py list-pricing-rules       # List all pricing rules
"""

import sys
import os
from pathlib import Path

# Add app to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from seeds.pricing_rules import seed_pricing_rules
from app.models import Base, PricingRule
from app.database.database import engine, SessionLocal


def create_tables():
    """Create all database tables"""
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created!")


def list_pricing_rules():
    """List all pricing rules"""
    db = SessionLocal()
    try:
        rules = db.query(PricingRule).all()
        print("\n📋 Pricing Rules:")
        print("=" * 100)
        for rule in rules:
            print(
                f"ID: {rule.id:3d} | {rule.provider:15s} | {rule.model or '-':20s} | {rule.feature or '-':10s} | "
                f"Active: {rule.is_active}"
            )
            if rule.credit_per_input_token:
                print(f"       └─ Input Token: {rule.credit_per_input_token} credits")
            if rule.credit_per_output_token:
                print(f"       └─ Output Token: {rule.credit_per_output_token} credits")
            if rule.credit_per_input_char:
                print(f"       └─ Input Char: {rule.credit_per_input_char} credits")
            if rule.credit_per_audio_second:
                print(f"       └─ Audio Second: {rule.credit_per_audio_second} credits")
        print("=" * 100)
        print(f"Total: {len(rules)} rules\n")
    finally:
        db.close()


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == "seed-pricing-rules":
        seed_pricing_rules()
    elif command == "create-tables":
        create_tables()
    elif command == "list-pricing-rules":
        list_pricing_rules()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
