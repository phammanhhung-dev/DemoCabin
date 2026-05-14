from __future__ import annotations

import math
import os
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models import AiUsageLog, BillingTransaction, PricingRule, UserWallet


def _env_flag(name: str, default: bool = False) -> bool:
    v = (os.getenv(name, "") or "").strip().lower()
    if not v:
        return default
    return v in ("1", "true", "yes", "y", "on")


def get_or_create_wallet(db: Session, user_id: int) -> UserWallet:
    w = db.query(UserWallet).filter(UserWallet.user_id == user_id).first()
    if w:
        return w
    w = UserWallet(user_id=user_id, credits_balance=0)
    db.add(w)
    db.commit()
    db.refresh(w)
    return w


def estimate_tokens_from_text(text: str) -> int:
    """
    Fallback ước lượng token khi provider không trả usage.
    Quy ước thô: 1 token ~ 4 ký tự (ASCII) / 2-3 ký tự (Unicode).
    Dùng 4 để tránh overcharge; bạn có thể tinh chỉnh.
    """
    if not text:
        return 0
    return int(math.ceil(len(text) / 4))


def resolve_pricing_rule(
    db: Session,
    provider: str,
    model: Optional[str],
    feature: Optional[str],
) -> Optional[PricingRule]:
    q = db.query(PricingRule).filter(PricingRule.provider == provider, PricingRule.is_active == True)  # noqa: E712
    # ưu tiên khớp đủ model+feature, rồi rơi dần
    candidates = [
        q.filter(PricingRule.model == model, PricingRule.feature == feature).first(),
        q.filter(PricingRule.model == model, PricingRule.feature.is_(None)).first(),
        q.filter(PricingRule.model.is_(None), PricingRule.feature == feature).first(),
        q.filter(PricingRule.model.is_(None), PricingRule.feature.is_(None)).first(),
    ]
    for c in candidates:
        if c:
            return c
    return None


def calc_credits(
    rule: Optional[PricingRule],
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    input_chars: Optional[int] = None,
    output_chars: Optional[int] = None,
    audio_seconds: Optional[Decimal] = None,
) -> int:
    """
    Tính credits cần trừ dựa trên pricing rule.
    Nếu chưa có rule: mặc định 1 credit / 1 token (input+output).
    """
    it = int(input_tokens or 0)
    ot = int(output_tokens or 0)
    ic = int(input_chars or 0)
    oc = int(output_chars or 0)
    sec = Decimal(audio_seconds or 0)

    if not rule:
        return it + ot

    total = Decimal(0)
    if rule.credit_per_input_token is not None:
        total += Decimal(rule.credit_per_input_token) * Decimal(it)
    if rule.credit_per_output_token is not None:
        total += Decimal(rule.credit_per_output_token) * Decimal(ot)
    if rule.credit_per_input_char is not None:
        total += Decimal(rule.credit_per_input_char) * Decimal(ic)
    if rule.credit_per_output_char is not None:
        total += Decimal(rule.credit_per_output_char) * Decimal(oc)
    if rule.credit_per_audio_second is not None:
        total += Decimal(rule.credit_per_audio_second) * sec

    return int(total.to_integral_value(rounding="ROUND_CEILING"))


def charge_and_log_usage(
    db: Session,
    *,
    user_id: int,
    provider: str,
    model: Optional[str],
    feature: Optional[str],
    endpoint: Optional[str],
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    input_chars: Optional[int] = None,
    output_chars: Optional[int] = None,
    audio_seconds: Optional[Decimal] = None,
    raw_cost_usd: Optional[Decimal] = None,
) -> AiUsageLog:
    """
    - Tạo usage log
    - (Tuỳ cấu hình) trừ credits vào ví + ghi transaction

    Env:
    - BILLING_ENFORCE=1: nếu không đủ credits thì raise ValueError
    - BILLING_DEBIT=1: bật trừ credits thực sự (mặc định tắt để không phá flow dev)
    """
    wallet = get_or_create_wallet(db, user_id=user_id)
    rule = resolve_pricing_rule(db, provider=provider, model=model, feature=feature)
    credits = calc_credits(
        rule,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        input_chars=input_chars,
        output_chars=output_chars,
        audio_seconds=audio_seconds,
    )

    do_debit = _env_flag("BILLING_DEBIT", default=False)
    enforce = _env_flag("BILLING_ENFORCE", default=False)

    if do_debit:
        if wallet.credits_balance < credits:
            if enforce:
                raise ValueError("INSUFFICIENT_CREDITS")
            # Nếu không enforce nhưng vẫn muốn chặn âm:
            wallet.credits_balance = 0
        else:
            wallet.credits_balance = int(wallet.credits_balance) - int(credits)
            
        db.add(
            BillingTransaction(
                user_id=user_id,
                type="usage_debit",
                credits_amount=-int(credits),
                note=f"{provider}:{feature or ''}:{model or ''}",
            )
        )

    log = AiUsageLog(
        user_id=user_id,
        provider=provider,
        model=model,
        feature=feature,
        endpoint=endpoint,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        input_chars=input_chars,
        output_chars=output_chars,
        audio_seconds=audio_seconds,
        credits_charged=int(credits),
        raw_cost_usd=raw_cost_usd,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

