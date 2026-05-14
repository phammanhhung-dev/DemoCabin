from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os

from app.database.database import get_db
from app.models import SupportTicket, FAQ, User
from app.Core.auth import get_current_user

router = APIRouter(prefix="/api/support", tags=["support"])

# ================= SCHEMAS =================

class SupportTicketCreate(BaseModel):
    title: str
    description: str
    category: Optional[str] = "technical"
    priority: Optional[str] = "normal"

class SupportTicketResponse(BaseModel):
    id: int
    title: str
    description: str
    status: str
    priority: str
    category: Optional[str]
    response: Optional[str]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True

class SupportTicketUpdate(BaseModel):
    response: Optional[str] = None
    status: Optional[str] = None

class FAQResponse(BaseModel):
    id: int
    question: str
    answer: str
    category: Optional[str]

    class Config:
        from_attributes = True

class AIChatMessage(BaseModel):
    message: str

class AIChatResponse(BaseModel):
    reply: str
    is_ai: bool = True

# ================= SUPPORT TICKETS =================

@router.post("/tickets", response_model=SupportTicketResponse)
def create_support_ticket(
    ticket_data: SupportTicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Tạo ticket hỗ trợ mới"""
    ticket = SupportTicket(
        user_id=current_user.id,
        title=ticket_data.title,
        description=ticket_data.description,
        category=ticket_data.category,
        priority=ticket_data.priority,
        status="open"
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Thông báo cho admin về yêu cầu hỗ trợ mới
    from app.services.notification_service import notify_admins
    notify_admins(
        db,
        title="Yêu cầu hỗ trợ mới",
        message=f"Người dùng {current_user.full_name} đã tạo một yêu cầu: {ticket.title}",
        type="support",
        link="/admin/support"
    )

    return ticket

@router.get("/tickets", response_model=List[SupportTicketResponse])
def get_user_tickets(
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lấy danh sách tickets của user"""
    query = db.query(SupportTicket).filter(SupportTicket.user_id == current_user.id)
    
    if status:
        query = query.filter(SupportTicket.status == status)
    
    tickets = query.order_by(SupportTicket.created_at.desc()).all()
    return tickets

@router.get("/tickets/{ticket_id}", response_model=SupportTicketResponse)
def get_ticket_detail(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lấy chi tiết ticket"""
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == current_user.id
    ).first()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket không tồn tại")
    
    return ticket

# ================= FAQ =================

@router.get("/faq", response_model=List[FAQResponse])
def get_faqs(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Lấy danh sách FAQ (public)"""
    query = db.query(FAQ).filter(FAQ.is_active == True)
    
    if category:
        query = query.filter(FAQ.category == category)
    
    faqs = query.order_by(FAQ.order, FAQ.id).all()
    return faqs

@router.get("/faq/categories")
def get_faq_categories(db: Session = Depends(get_db)):
    """Lấy danh sách categories của FAQ"""
    categories = db.query(FAQ.category).filter(FAQ.is_active == True).distinct().all()
    return {"categories": [cat[0] for cat in categories if cat[0]]}

# ================= ADMIN: MANAGE TICKETS & FAQ =================

@router.put("/tickets/{ticket_id}")
def update_ticket(
    ticket_id: int,
    update_data: SupportTicketUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin/Staff: Cập nhật ticket"""
    # Check if admin/staff
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Bạn không có quyền")
    
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket không tồn tại")
    
    if update_data.response:
        ticket.response = update_data.response
    
    if update_data.status:
        ticket.status = update_data.status
        if update_data.status == "resolved":
            ticket.resolved_at = datetime.utcnow()
    
    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)

    # Thông báo cho user về cập nhật ticket
    from app.services.notification_service import create_notification
    msg = f"Yêu cầu hỗ trợ '{ticket.title}' của bạn đã có phản hồi mới."
    if update_data.status == "resolved":
        msg = f"Yêu cầu hỗ trợ '{ticket.title}' của bạn đã được giải quyết."

    create_notification(
        db,
        user_id=ticket.user_id,
        title="Cập nhật yêu cầu hỗ trợ",
        message=msg,
        type="support",
        link=f"/support"
    )

    return ticket

@router.get("/tickets-admin", response_model=List[SupportTicketResponse])
def get_all_tickets_admin(
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin: Lấy tất cả tickets"""
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Bạn không có quyền")
    
    query = db.query(SupportTicket)
    
    if status:
        query = query.filter(SupportTicket.status == status)
    
    tickets = query.order_by(SupportTicket.created_at.desc()).all()
    return tickets

@router.post("/faq")
def create_faq(
    faq_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin: Tạo FAQ mới"""
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Bạn không có quyền")
    
    faq = FAQ(
        question=faq_data.get("question"),
        answer=faq_data.get("answer"),
        category=faq_data.get("category"),
        order=faq_data.get("order", 0)
    )
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return faq

@router.put("/faq/{faq_id}")
def update_faq(
    faq_id: int,
    faq_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin: Cập nhật FAQ"""
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Bạn không có quyền")
    
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ không tồn tại")
    
    if "question" in faq_data:
        faq.question = faq_data["question"]
    if "answer" in faq_data:
        faq.answer = faq_data["answer"]
    if "category" in faq_data:
        faq.category = faq_data["category"]
    if "is_active" in faq_data:
        faq.is_active = faq_data["is_active"]
    if "order" in faq_data:
        faq.order = faq_data["order"]
    
    faq.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(faq)
    return faq

@router.delete("/faq/{faq_id}")
def delete_faq(
    faq_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin: Xóa FAQ"""
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Bạn không có quyền")
    
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ không tồn tại")
    
    db.delete(faq)
    db.commit()
    return {"message": "FAQ deleted successfully"}

# ================= AI CHAT SUPPORT =================

@router.post("/ai-chat", response_model=AIChatResponse)
def ai_chat_support(
    chat_data: AIChatMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI Chat hỗ trợ 24/7 khi không có nhân viên.
    Có thể dùng OpenAI hoặc LLM local.
    """
    user_message = chat_data.message.strip()
    
    if not user_message:
        raise HTTPException(status_code=400, detail="Tin nhắn không được trống")
    
    # Simple AI responses - có thể thay bằng OpenAI / LLM
    ai_responses = {
        "token": "Bạn có thể nạp thêm token bằng cách vào mục Billing, chọn gói phù hợp và thanh toán. Các gói có giá từ 50.000đ đến 500.000đ.",
        "dịch": "Cabin hỗ trợ dịch thô từ hơn 100 ngôn ngữ với độ chính xác lên đến 95%. Hãy vào mục Dịch để bắt đầu.",
        "lỗi": "Nếu bạn gặp lỗi, hãy thử: 1) Làm mới trang, 2) Xoá cache trình duyệt, 3) Thử trình duyệt khác. Nếu vẫn lỗi, vui lòng gửi ticket hỗ trợ.",
        "giọng nói": "Để dịch giọng nói được, hãy: 1) Cho phép quyền Microphone, 2) Kiểm tra kết nối internet, 3) Sử dụng trình duyệt Chrome hoặc Edge.",
        "tài khoản": "Bạn có thể quản lý tài khoản trong mục Profile. Hỗ trợ đổi mật khẩu, cập nhật thông tin cá nhân, upload ảnh đại diện.",
        "default": "Xin lỗi, tôi không hiểu câu hỏi của bạn. Bạn có thể hỏi về: Token, Dịch, Lỗi, Giọng nói, Tài khoản. Hoặc gửi ticket hỗ trợ để được nhân viên giúp đỡ."
    }
    
    # Detect keyword
    lower_msg = user_message.lower()
    ai_reply = ai_responses["default"]
    
    for keyword, response in ai_responses.items():
        if keyword != "default" and keyword in lower_msg:
            ai_reply = response
            break
    
    return AIChatResponse(reply=ai_reply, is_ai=True)
