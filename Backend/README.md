# Hướng dẫn cấu hình và triển khai Backend - Cabin AI

Tài liệu này hướng dẫn chi tiết các bước để thiết lập, cấu hình và khởi chạy hệ thống Backend cho dự án Cabin AI.

---

## 1. Cấu trúc dự án (Đã tối ưu)

Dự án được thiết kế theo kiến trúc modular để đảm bảo tính mở rộng và bảo mật:

- `app/Core`: Quản lý cấu hình tập trung (`config.py`), xác thực (`auth.py`), phân quyền (`permission.py`) và logging.
- `app/Api`: Chứa các endpoint API phân chia theo module (Auth, Translation, Voice, Billing, Admin...).
- `app/models.py`: Định nghĩa các bảng cơ sở dữ liệu SQLAlchemy (Đã được đánh Index tối ưu).
- `app/services`: Các dịch vụ xử lý logic (Thanh toán MoMo/ZaloPay, Phiên dịch, Email...).
- `app/database`: Cấu hình kết nối Database.

---

## 2. Hướng dẫn cài đặt

Thực hiện các bước sau để thiết lập môi trường phát triển:

### Bước 1: Tạo và kích hoạt môi trường ảo (Virtual Environment)
```powershell
# Tạo .venv (nếu chưa có)
python -m venv .venv

# Kích hoạt .venv trên Windows
.venv\Scripts\Activate
```

### Bước 2: Cài đặt các thư viện cần thiết
```powershell
pip install -r requirements.txt
```

**Lưu ý:** Nếu gặp lỗi liên quan đến `pyodbc`, `email-validator` hoặc `python-multipart`, hãy cài đặt thủ công:
```powershell
pip install pyodbc email-validator python-multipart
```

---

## 3. Cấu hình môi trường (.env)

Tạo tệp `.env` tại thư mục gốc của Backend và cấu hình các thông số sau:

### Cấu hình Cơ sở dữ liệu (SQL Server)
Cập nhật dòng kết nối theo thông tin máy chủ SQL Server của bạn:
```env
DATABASE_URL=mssql+pyodbc://sa:123@LAPTOP-KM869EF7\MSSQLSERVER_1/translate_db?driver=ODBC+Driver+17+for+SQL+Server
```

### Cấu hình Email (SMTP) cho chức năng khôi phục mật khẩu
Sử dụng Gmail SMTP với App Password:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@gmail.com
```
*Lưu ý: Bạn cần kích hoạt Xác thực 2 yếu tố (2FA) trên Gmail và tạo App Password.*

### Cấu hình AI Models (OpenAI & Ollama)
```env
OPENAI_API_KEY=your_openai_key

# Cấu hình Ollama (Dùng cho fallback local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

---

## 4. Cấu hình Ollama (Chạy Local AI)

Hệ thống hỗ trợ tự động chuyển sang Ollama nếu OpenAI gặp lỗi (ví dụ: hết quota).

1. Cài đặt Ollama cho Windows.
2. Mở ứng dụng Ollama để khởi chạy service.
3. Tải model cần thiết:
```powershell
ollama pull llama3.1
```

---

## 5. Khởi chạy ứng dụng

Sau khi đã cài đặt và cấu hình đầy đủ, chạy lệnh sau để bắt đầu:

```powershell
uvicorn app.main:app --reload
```
Hệ thống sẽ chạy tại địa chỉ mặc định: `http://127.0.0.1:8000`

---

## 6. Các tính năng nổi bật

### Khôi phục mật khẩu qua Email
- Endpoint: `POST /forgot-password`
- Quy trình: Người dùng nhập email -> Hệ thống tạo mật khẩu ngẫu nhiên -> Mã hóa (hash) mật khẩu -> Cập nhật DB -> Gửi mật khẩu mới qua email.

### Tóm tắt hội thoại AI (Hybrid)
- Endpoint: `POST /translation/summary`
- Cơ chế: Mặc định dùng OpenAI -> Tự động **fallback** sang **Ollama local** nếu OpenAI lỗi.

---

## 7. Xử lý sự cố (Troubleshooting)

### Lỗi liên quan đến .venv hoặc thư viện
Nếu gặp lỗi không xác định, hãy thử xóa và tạo lại môi trường ảo:
```powershell
# Thoát venv
deactivate

# Xóa venv cũ
Remove-Item -Recurse -Force .venv

# Tạo và cài đặt lại
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Lỗi xác thực Bcrypt/Passlib
Nếu gặp lỗi về hash mật khẩu, chạy các lệnh sau:
```powershell
pip uninstall bcrypt passlib -y
pip install passlib[bcrypt]==1.7.4 bcrypt==3.2.2
```

### Lỗi Cache (Frontend/Next.js)
Nếu chạy Frontend bị lỗi cache, hãy xóa thư mục `.next`:
```powershell
Remove-Item -Recurse -Force .next
```
