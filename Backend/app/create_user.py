from app.database.database import SessionLocal, engine
from app.models import User
from app.Core.auth import hash_password

print("HELLO USER SCRIPT")
print("DB:", engine.url)

db = SessionLocal()

try:
    users = [
        User(full_name="Admin", email="admin@gmail.com", password=hash_password("123456"), role="admin"),
        User(full_name="Staff", email="staff@gmail.com", password=hash_password("123456"), role="staff"),
        User(full_name="User", email="user@gmail.com", password=hash_password("123456"), role="user"),
    ]

    for u in users:
        db.add(u)

    print("Before commit")
    db.commit()
    print("After commit")

    all_users = db.query(User).all()
    print("Users trong DB:", [(u.email, u.role) for u in all_users])

except Exception as e:
    print("LỖI:", e)
    db.rollback()

finally:
    db.close()