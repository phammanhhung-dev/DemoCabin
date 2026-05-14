from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from app.Core.config import settings
from app.models import Base
from app.database.database import get_db, engine
from app.Api.translation import router as translation_router
from app.Api.Voice.session import router as voice_session_router
from app.Api.Voice.message import router as voice_message_router
from app.Api.voice_ws import router as voice_ws_router
from app.Api.tp_translate import router as tp_translate_router
from app.Api.tp_history import router as tp_history_router
from app.Api.tp_notifications import router as tp_notifications_router
from app.Api.tp_admin import router as tp_admin_router
from app.Api.billing import router as billing_router
from app.Api.admin_billing import router as admin_billing_router
from app.Api.admin_users import router as admin_users_router
from app.Api.users import router as users_router
from app.Api.support import router as support_router
from app.Api import auth, tasks
from app.Core.logging import setup_logging, logger

# Setup logging
setup_logging()

# Initialize FastAPI app
app = FastAPI(title=settings.PROJECT_NAME)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
def root():
    return {"message": f"{settings.PROJECT_NAME} Backend is running!"}

# Include routers
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(translation_router)
app.include_router(voice_session_router)
app.include_router(voice_message_router)
app.include_router(voice_ws_router)
app.include_router(tp_translate_router)
app.include_router(tp_history_router)
app.include_router(tp_notifications_router)
app.include_router(tp_admin_router)
app.include_router(billing_router)
app.include_router(admin_billing_router)
app.include_router(admin_users_router)
app.include_router(users_router)
app.include_router(support_router)

# Create database tables
Base.metadata.create_all(bind=engine)

# Jinja2 Templates
templates = Jinja2Templates(directory="templates")

