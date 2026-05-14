from sqlalchemy.orm import Session
from app.models import Task, TranslationTask, User, Translation, UserTranslationHistory

# ================= TRANSLATION =================

def save_translation_to_db(db: Session, user_id: int, original: str, translated: str):
    new_item = Translation(
        user_id=user_id,
        original=original,
        translated=translated
    )

    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    # Lưu thêm bản sao lịch sử cho user (để user xóa mà admin vẫn còn)
    user_item = UserTranslationHistory(
        user_id=user_id,
        source_translation_id=new_item.id,
        original=original,
        translated=translated,
        created_at=new_item.created_at,
    )
    db.add(user_item)
    db.commit()
    return new_item

def create_translation_task(db: Session, text: str, languages: list):
    # đảm bảo languages là list
    if not isinstance(languages, list):
        return None

    task = TranslationTask(
        text=text,
        languages=languages,
        status="in progress",
        translations={}
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def get_translation_task(db: Session, task_id: int):
    return db.query(TranslationTask).filter(TranslationTask.id == task_id).first()


def update_translation_task(db: Session, task_id: int, translations: dict):
    task = db.query(TranslationTask).filter(TranslationTask.id == task_id).first()

    if not task:
        return None

    # chỉ update nếu hợp lệ
    if isinstance(translations, dict):
        task.translations = translations
        task.status = "completed"

        db.commit()
        db.refresh(task)

    return task


# ================= TASK =================

def create_task(db: Session, title: str, user_id: int):
    # check user tồn tại (tránh lỗi foreign key)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None

    task = Task(
        title=title,
        status="pending",
        user_id=user_id
    )

    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def get_tasks(db: Session, skip: int = 0, limit: int = 10):
    return db.query(Task).offset(skip).limit(limit).all()


def get_tasks_by_user(db: Session, user_id: int):
    return db.query(Task).filter(Task.user_id == user_id).all()