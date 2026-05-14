import logging
import os
import re
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base

Base = declarative_base()

# ! important
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)


def ensure_mssql_unicode_schema(engine) -> None:
    """
    SQLAlchemy create_all() không đổi kiểu cột đã có. Cột VARCHAR cũ làm mất dấu tiếng Việt.
    Tự ALTER sang NVARCHAR/NCHAR cho các bảng ứng dụng (chỉ khi dialect là MSSQL).
    """
    if engine is None or engine.dialect.name != "mssql":
        return
    if os.getenv("SKIP_MSSQL_UNICODE_FIX", "").lower() in ("1", "true", "yes"):
        return

    ident = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
    tables = frozenset(
        {
            "users",
            "translation_tasks",
            "translations",
            "user_translation_history",
            "user_translation_history_state",
            "voice_messages",
            "voice_sessions",
            "translation_history",
            "tp_notifications",
            "tasks",
            "user_wallets",
            "billing_transactions",
            "ai_usage_logs",
            "pricing_rules",
        }
    )

    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE,
                       CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'dbo'
                  AND DATA_TYPE IN ('varchar', 'char', 'text')
                """
            )
        ).fetchall()

        for table, col, dtype, char_len, is_nullable in rows:
            if table not in tables:
                continue
            if not ident.match(table) or not ident.match(col):
                continue
            null_sql = "NULL" if (is_nullable or "").upper() == "YES" else "NOT NULL"
            if dtype == "text":
                sql_type = "NVARCHAR(MAX)"
            elif dtype == "char" and char_len is not None and int(char_len) > 0:
                sql_type = f"NCHAR({int(char_len)})"
            elif char_len is None or int(char_len) < 0:
                sql_type = "NVARCHAR(MAX)"
            else:
                sql_type = f"NVARCHAR({int(char_len)})"

            ddl = f"ALTER TABLE dbo.[{table}] ALTER COLUMN [{col}] {sql_type} {null_sql}"
            try:
                conn.execute(text(ddl))
                # logger.info("MSSQL Unicode: %s", ddl)
            except Exception:
                # Tránh hiển thị lỗi rườm rà khi cột có ràng buộc (như email)
                pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(SQLALCHEMY_DATABASE_URL)

ensure_mssql_unicode_schema(engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)