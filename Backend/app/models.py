from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    Unicode,
    UnicodeText,
    JSON,
    ForeignKey,
    DateTime,
    Boolean,
    UniqueConstraint,
    Numeric,
)
from sqlalchemy.orm import relationship
from app.database.database import Base
from datetime import datetime


class TranslationTask(Base):
    __tablename__ = "translation_tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    text = Column(UnicodeText, nullable=False)
    languages = Column(JSON, nullable=False)
    status = Column(Unicode(50), default="in progress")
    translations = Column(JSON, default={})


class Translation(Base):
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    original = Column(UnicodeText)
    translated = Column(UnicodeText)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserTranslationHistory(Base):
    """
    Lịch sử hiển thị cho user (cho phép user tự xóa),
    trong khi admin vẫn giữ dữ liệu gốc ở `translations`.
    """

    __tablename__ = "user_translation_history"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "source_translation_id",
            name="uq_user_translation_history_user_source",
        ),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Có thể null khi record được tạo trực tiếp mà không qua bảng `translations`
    source_translation_id = Column(
        Integer, ForeignKey("translations.id", ondelete="SET NULL"), nullable=True
    )

    original = Column(UnicodeText, nullable=False)
    translated = Column(UnicodeText, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserTranslationHistoryState(Base):
    __tablename__ = "user_translation_history_state"

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # Ẩn tất cả bản ghi (từ bảng gốc) có created_at <= purged_at
    purged_at = Column(DateTime, nullable=True)


# VOICE SESSION
class VoiceSession(Base):
    __tablename__ = "voice_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    created_at = Column(DateTime, default=datetime.utcnow)

    messages = relationship(
        "VoiceMessage",
        back_populates="session",
        cascade="all, delete",
        passive_deletes=True,
    )


#  VOICE MESSAGE (BẠN THIẾU CÁI NÀY)
class VoiceMessage(Base):
    __tablename__ = "voice_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("voice_sessions.id", ondelete="CASCADE"))

    original_text = Column(UnicodeText)
    translated_text = Column(UnicodeText)

    speaker_lang = Column(Unicode(10))  # "vi" hoặc "en"
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("VoiceSession", back_populates="messages")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    full_name = Column(Unicode(255))
    email = Column(Unicode(255), unique=True, nullable=False, index=True)
    password = Column(Unicode(255), nullable=False)
    role = Column(Unicode(50), default="user", index=True)
    avatar_url = Column(UnicodeText, nullable=True)

    translation_histories = relationship(
        "TranslationHistory",
        back_populates="user",
        cascade="all, delete",
    )
    tp_notifications = relationship(
        "TpNotification",
        back_populates="user",
        cascade="all, delete",
    )


class TranslationHistory(Base):
    """Lịch sử phiên dịch realtime (Soniox), tách bảng với `translations` của Cabin."""

    __tablename__ = "translation_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    original_text = Column(UnicodeText, nullable=False)
    translated_text = Column(UnicodeText, nullable=False)
    source_lang = Column(Unicode(10), default="vi")
    target_lang = Column(Unicode(10), default="en")
    speaker_lang = Column(Unicode(10), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    user = relationship("User", back_populates="translation_histories")


class TpNotification(Base):
    __tablename__ = "tp_notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Unicode(255), nullable=True)
    message = Column(UnicodeText, nullable=False)
    type = Column(Unicode(50), default="info", index=True) # info, success, warning, error, user_registration, revenue, support
    link = Column(Unicode(255), nullable=True)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    user = relationship("User", back_populates="tp_notifications")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(UnicodeText)
    status = Column(Unicode(50), default="pending")
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))


# ================= BILLING / USAGE =================

class UserWallet(Base):
    """
    Ví "credits" nội bộ cho mỗi user.
    - credits: đơn vị bạn bán cho khách (có thể map 1 credit ~= 1 token, hoặc custom).
    """

    __tablename__ = "user_wallets"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    credits_balance = Column(BigInteger, nullable=False, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BillingTransaction(Base):
    """
    Sổ giao dịch nạp/trừ credits.
    type gợi ý: purchase, admin_grant, usage_debit, refund, adjustment
    """

    __tablename__ = "billing_transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(Unicode(50), nullable=False)
    credits_amount = Column(BigInteger, nullable=False)  # + nạp, - trừ
    currency = Column(Unicode(10), nullable=True)  # VND, USD...
    money_amount = Column(Numeric(18, 2), nullable=True)  # số tiền user trả (tuỳ bạn)
    external_ref = Column(Unicode(255), nullable=True)  # mã giao dịch (momo/vnpay/stripe)
    status = Column(Unicode(50), default="success")  # pending, success, failed
    note = Column(UnicodeText, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class AiUsageLog(Base):
    """
    Log tiêu thụ AI để đối soát/calc bill.
    - provider: openai | gemini | soniox | google_tts | edge_tts | ...
    - unit fields tuỳ loại: tokens/chars/seconds/bytes
    """

    __tablename__ = "ai_usage_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    provider = Column(Unicode(50), nullable=False, index=True)
    model = Column(Unicode(100), nullable=True, index=True)
    feature = Column(Unicode(50), nullable=True, index=True)  # translate | summary | stt | tts | ...
    endpoint = Column(Unicode(255), nullable=True)

    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    input_chars = Column(Integer, nullable=True)
    output_chars = Column(Integer, nullable=True)
    audio_seconds = Column(Numeric(18, 3), nullable=True)

    credits_charged = Column(BigInteger, nullable=False, default=0)
    raw_cost_usd = Column(Numeric(18, 6), nullable=True)  # optional: cost ước lượng theo bảng giá provider
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class PricingRule(Base):
    """
    Bảng cấu hình giá:
    - provider/model/feature: xác định loại request
    - credit_per_input_token, credit_per_output_token: số credit trừ cho user
    - cost_per_*_usd: để bạn tính lãi (optional)
    """

    __tablename__ = "pricing_rules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    provider = Column(Unicode(50), nullable=False, index=True)
    model = Column(Unicode(100), nullable=True, index=True)
    feature = Column(Unicode(50), nullable=True, index=True)

    credit_per_input_token = Column(Numeric(18, 6), nullable=True)
    credit_per_output_token = Column(Numeric(18, 6), nullable=True)
    credit_per_input_char = Column(Numeric(18, 6), nullable=True)
    credit_per_output_char = Column(Numeric(18, 6), nullable=True)
    credit_per_audio_second = Column(Numeric(18, 6), nullable=True)

    cost_per_input_token_usd = Column(Numeric(18, 9), nullable=True)
    cost_per_output_token_usd = Column(Numeric(18, 9), nullable=True)
    cost_per_audio_second_usd = Column(Numeric(18, 9), nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ================= SUPPORT & FAQ =================

class SupportTicket(Base):
    """
    Hệ thống tickets hỗ trợ khách hàng.
    """
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Unicode(255), nullable=False)
    description = Column(UnicodeText, nullable=False)
    status = Column(Unicode(50), default="open", index=True)  # open | in_progress | resolved | closed
    priority = Column(Unicode(50), default="normal")  # low | normal | high | urgent
    category = Column(Unicode(100), nullable=True)  # billing | technical | feature | other
    response = Column(UnicodeText, nullable=True)  # Phản hồi từ admin/staff
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class FAQ(Base):
    """
    FAQ (Frequently Asked Questions)
    """
    __tablename__ = "faqs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    question = Column(UnicodeText, nullable=False)
    answer = Column(UnicodeText, nullable=False)
    category = Column(Unicode(100), nullable=True)  # billing | technical | general | feature
    is_active = Column(Boolean, default=True)
    order = Column(Integer, default=0)  # Để sắp xếp thứ tự
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)