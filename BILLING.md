# 💳 Billing & Pricing System

## Overview

Hệ thống billing của Cabin AI:
- **Credits**: đơn vị nội bộ để tính tiêu thụ API
- **Pricing Rules**: quy tắc tính bao nhiêu credits/token hoặc bao nhiêu credits/character
- **Auto-debit**: khi user dùng API, credits tự động bị trừ (nếu đủ)
- **Transaction Log**: lưu lại tất cả giao dịch để audit

## Architecture

```
┌─────────────────────────────────────────┐
│ Frontend (billing.js, admin/billing.js) │
├─────────────────────────────────────────┤
│ Backend Endpoints:
│ - GET /billing/plans              (list plans)
│ - GET /billing/wallet             (check balance)
│ - POST /billing/purchase          (buy credits)
│ - GET /admin/billing/wallets      (list all wallets)
│ - POST /admin/billing/credit      (admin grant credits)
│ - GET /admin/billing/pricing-rules
│ - POST /admin/billing/pricing-rules
├─────────────────────────────────────────┤
│ Core Services:
│ - get_or_create_wallet()          (create if not exist)
│ - resolve_pricing_rule()          (find rule by provider/model/feature)
│ - calc_credits()                  (calculate credits to charge)
│ - charge_and_log_usage()          (debit + log)
├─────────────────────────────────────────┤
│ API Endpoints (with auto-billing):
│ - POST /translation/summary       (OpenAI/Gemini)
│ - POST /tp/translate/tts          (Google TTS)
│ - WebSocket /tp/translate/ws      (Soniox STT)
└─────────────────────────────────────────┘
```

## Database Schema

### 1. `user_wallets`
```sql
user_id          INT PRIMARY KEY
credits_balance  BIGINT
updated_at       DATETIME2
```

### 2. `billing_transactions`
```sql
id               INT IDENTITY
user_id          INT (FK users)
type             NVARCHAR(50)  -- 'purchase', 'usage_debit', 'admin_grant'
credits_amount   BIGINT        -- positive or negative
currency         NVARCHAR(10)  -- 'VND'
money_amount     DECIMAL(18,2) -- real $$$ amount
external_ref     NVARCHAR(255) -- payment gateway ref
note             NVARCHAR(MAX)
created_at       DATETIME2
```

### 3. `ai_usage_logs`
```sql
id                  INT IDENTITY
user_id             INT
provider            NVARCHAR(50)  -- 'openai', 'gemini', 'soniox', 'google_tts', etc.
model               NVARCHAR(100)
feature             NVARCHAR(50)  -- 'summary', 'stt', 'tts', 'translate'
endpoint            NVARCHAR(255)
input_tokens        INT
output_tokens       INT
input_chars         INT
output_chars        INT
audio_seconds       DECIMAL(18,3)
credits_charged     BIGINT        -- actual credits deducted
raw_cost_usd        DECIMAL(18,6) -- actual cost from provider
created_at          DATETIME2
```

### 4. `pricing_rules`
```sql
id                        INT IDENTITY
provider                  NVARCHAR(50)  -- 'openai', 'gemini', 'soniox', 'google_tts'
model                     NVARCHAR(100) -- 'gpt-4o', 'gemini-2.0-flash', NULL for wildcard
feature                   NVARCHAR(50)  -- 'summary', 'stt', 'tts', NULL for wildcard
credit_per_input_token    DECIMAL(18,6)
credit_per_output_token   DECIMAL(18,6)
credit_per_input_char     DECIMAL(18,6)
credit_per_output_char    DECIMAL(18,6)
credit_per_audio_second   DECIMAL(18,6)
cost_per_input_token_usd  DECIMAL(18,9) -- for accounting
cost_per_output_token_usd DECIMAL(18,9)
cost_per_audio_second_usd DECIMAL(18,9)
is_active                 BIT
created_at                DATETIME2
```

## Configuration

### Environment Variables

```env
# Enable credit debit on API usage (0/1)
BILLING_DEBIT=1

# Enforce minimum credit balance - reject if insufficient (0/1)
BILLING_ENFORCE=0
```

**Important**: 
- `BILLING_DEBIT=0`: API logs usage but doesn't deduct credits (safe for dev/testing)
- `BILLING_DEBIT=1`: API actually deducts credits
- `BILLING_ENFORCE=0`: Allows negative balance (user keeps using even if out of credits)
- `BILLING_ENFORCE=1`: Rejects API call if insufficient balance

## Setup

### 1. Create Database Tables

```bash
cd Backend
python manage.py create-tables
```

Hoặc chạy SQL script:
```bash
sqlcmd -S <server> -U sa -P <password> -i billing_schema.sql
```

### 2. Seed Pricing Rules

```bash
cd Backend
python manage.py seed-pricing-rules
```

Output:
```
✅ Added: openai / gpt-4o / summary
✅ Added: openai / gpt-4-turbo / summary
✅ Added: gemini / gemini-2.0-flash / summary
✅ Added: soniox / stt-rt-v4 / stt
✅ Added: google_tts / None / tts
✅ Added: edge_tts / None / tts
✅ Seed pricing rules thành công!
```

### 3. List Pricing Rules

```bash
python manage.py list-pricing-rules
```

## Pricing Strategy

Current pricing (with 100% markup):

| Provider | Model | Feature | Rate |
|----------|-------|---------|------|
| OpenAI | gpt-4o | summary | 0.01 input token, 0.03 output token |
| OpenAI | gpt-4-turbo | summary | 0.02 input token, 0.06 output token |
| Gemini | gemini-2.0-flash | summary | 0.15 input token, 0.6 output token |
| Soniox | stt-rt-v4 | stt | 0.13 credits per second |
| Google TTS | - | tts | 0.2 credits per character |
| Edge TTS | - | tts | 0.15 credits per character |

**Adjustment**:
- Use admin endpoint `POST /admin/billing/pricing-rules` to update rates
- Or edit `Backend/seeds/pricing_rules.py` and reseed

## Testing

### Flow 1: User Purchase Plan

1. User login → `/billing`
2. Click "Mua ngay" gói → `POST /billing/purchase`
3. Response: wallet updated, credits added
4. Verify: `GET /billing/wallet` shows new balance

### Flow 2: Auto-debit on Summary

1. User login → `/translate`
2. Input text, click "Tóm tắt"
3. Backend calls OpenAI → logs usage → deducts credits
4. Check: 
   - `GET /billing/wallet` → balance decreased
   - Admin: `GET /admin/billing/wallets` → user balance ↓
   - DB: `SELECT * FROM ai_usage_logs WHERE user_id = ?`

### Flow 3: Insufficient Credits

1. User buys 10 credits (gói cơ bản)
2. Try to summarize → uses 20 credits
3. If `BILLING_ENFORCE=1`: 
   - Error: "Bạn không đủ credits"
4. If `BILLING_ENFORCE=0`:
   - Success, balance = -10 credits (user can keep using)

### Flow 4: Admin Operations

1. Admin login → `/admin/billing`
2. **Section 1 (User)**: Admin can buy plans like normal user
3. **Section 2 (Admin)**:
   - Form: Input User ID, Credits amount, Note
   - Click "Cộng Credits"
   - Transaction created: `type='admin_grant'`
   - Verify in "Danh sách Ví"

### Flow 5: Manage Pricing Rules

```bash
# List all rules
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:8000/admin/billing/pricing-rules

# Create new rule
curl -X POST \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "feature": "summary",
    "credit_per_input_token": 0.01,
    "credit_per_output_token": 0.03,
    "is_active": true
  }' \
  http://localhost:8000/admin/billing/pricing-rules
```

## Monitoring

### Check Usage

```sql
-- Usage by provider
SELECT provider, COUNT(*) as count, SUM(credits_charged) as total_credits
FROM ai_usage_logs
GROUP BY provider

-- Top users by spending
SELECT TOP 10
  u.email,
  COUNT(l.id) as usage_count,
  SUM(l.credits_charged) as total_credits
FROM ai_usage_logs l
JOIN users u ON l.user_id = u.id
GROUP BY u.email, u.id
ORDER BY total_credits DESC

-- Wallet balances
SELECT
  w.user_id,
  u.email,
  w.credits_balance
FROM user_wallets w
JOIN users u ON w.user_id = u.id
ORDER BY w.credits_balance DESC
```

## Troubleshooting

### Problem: Credits not deducting
**Solution**: Check `.env`:
- `BILLING_DEBIT=1` ✓
- Pricing rules exist: `python manage.py list-pricing-rules`
- DB connected: check `ai_usage_logs` table

### Problem: "Insufficient credits" but should work
**Solution**: 
- If `BILLING_ENFORCE=1`: user really out of credits → buy more
- If should allow: set `BILLING_ENFORCE=0` in `.env`

### Problem: Pricing rule not found
**Solution**:
- Check rule exists: `python manage.py list-pricing-rules`
- Verify provider/model/feature match exactly
- Fallback rule (NULL model/feature) should exist

## Next Steps

1. **Real Payment Gateway** (Option 3):
   - Integrate MoMo / VNPay / Stripe
   - Implement webhook handlers
   - Change `type='purchase'` flow: pending → paid

2. **Analytics**:
   - Admin dashboard showing costs, revenue, usage trends
   - Per-user usage report

3. **Rate Limiting**:
   - Implement API rate limits based on credit balance
   - Quota per tier

4. **Refunds**:
   - Admin endpoint to refund credits
   - Transaction: `type='refund'`
