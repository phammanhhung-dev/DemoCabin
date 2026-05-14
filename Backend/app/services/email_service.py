import os
import smtplib
from email.message import EmailMessage


def send_email(to_email: str, subject: str, body: str) -> None:
    """
    Gửi email qua SMTP. Dùng biến môi trường:
    - SMTP_HOST (vd smtp.gmail.com)
    - SMTP_PORT (vd 465)
    - SMTP_USER (tài khoản gửi)
    - SMTP_PASS (app password)
    - SMTP_FROM (optional, default SMTP_USER)
    """
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "465"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASS", "").strip()
    from_email = (os.getenv("SMTP_FROM") or user).strip()

    if not host or not user or not password or not from_email:
        raise RuntimeError("Thiếu cấu hình SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM)")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(body)

    # Gmail: dùng SSL port 465
    with smtplib.SMTP_SSL(host, port) as smtp:
        smtp.login(user, password)
        smtp.send_message(msg)

