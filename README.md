# Smart Expense Tracker - Backend

API server cho ứng dụng quản lý chi tiêu thông minh, xây dựng bằng NestJS với tích hợp AI và đồng bộ email tự động.

## Giới thiệu

Backend cung cấp REST API cho việc quản lý thu chi cá nhân, bao gồm:

- **Xác thực người dùng** - Đăng ký, đăng nhập với JWT
- **Quản lý chi tiêu & thu nhập** - CRUD với phân loại theo danh mục
- **Đồng bộ email tự động** - Kết nối Gmail, tự động đọc email ngân hàng và tạo giao dịch (hỗ trợ VietCombank, TechcomBank, MB Bank, ACB, VPBank, TPBank, BIDV, AgriBank)
- **Trợ lý AI** - Chat hỏi đáp tài chính, phân tích chi tiêu, hỗ trợ nhiều provider (OpenAI, Gemini, DeepSeek, Groq)
- **Thống kê** - Tổng hợp số liệu theo danh mục, thời gian

## Tech Stack

| Thành phần | Công nghệ |
|------------|-----------|
| Framework | NestJS 11 |
| Ngôn ngữ | TypeScript |
| ORM | Prisma 6 |
| Database | PostgreSQL 16 |
| Auth | JWT + Passport.js |
| AI | OpenAI / Gemini / DeepSeek / Groq |
| Email | Gmail API (OAuth2) |
| Docs | Swagger |
| Container | Docker |

## Yêu cầu

- Node.js 20+
- Docker & Docker Compose
- npm

## Hướng dẫn chạy

### 1. Cài đặt dependencies

```bash
cd BE
npm install
```

### 2. Cấu hình environment

```bash
cp .env.example .env
```

Chỉnh sửa file `.env` với các giá trị phù hợp:

| Biến | Mô tả | Bắt buộc |
|------|-------|----------|
| `DATABASE_URL` | Connection string PostgreSQL | Có |
| `PORT` | Port API (mặc định: 3001) | Không |
| `JWT_SECRET` | Secret key cho JWT, **đổi trong production** | Có |
| `FRONTEND_URL` | URL frontend cho CORS (mặc định: http://localhost:3000) | Không |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (cho Gmail sync) | Không |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Không |
| `GOOGLE_REDIRECT_URI` | Google OAuth redirect URI | Không |
| `DEEPSEEK_API_KEY` | API key DeepSeek (hoặc OpenAI/Gemini) | Không |

### 3. Khởi động PostgreSQL

```bash
npm run docker:db
```

PostgreSQL sẽ chạy tại `localhost:5432`.

### 4. Chạy migration database

```bash
npm run prisma:migrate
```

Nhập tên migration khi được hỏi (vd: `init`).

### 5. Khởi động server

```bash
npm run start:dev
```

API chạy tại `http://localhost:3001`. Swagger docs tại `http://localhost:3001/api/docs`.

## Chạy toàn bộ bằng Docker

Khởi động cả PostgreSQL và API trong Docker:

```bash
npm run docker:up
```

Dừng tất cả:

```bash
npm run docker:down
```

## Các lệnh có sẵn

| Lệnh | Mô tả |
|------|-------|
| `npm run start:dev` | Chạy dev server (watch mode) |
| `npm run build` | Build production |
| `npm run start:prod` | Chạy production server |
| `npm run docker:db` | Khởi động PostgreSQL |
| `npm run docker:up` | Khởi động tất cả container |
| `npm run docker:down` | Dừng tất cả container |
| `npm run prisma:generate` | Tạo Prisma client |
| `npm run prisma:migrate` | Chạy migration |
| `npm run prisma:studio` | Mở Prisma Studio (GUI quản lý DB) |
| `npm run lint` | Kiểm tra code style |
| `npm run test` | Chạy unit test |

## Cấu trúc thư mục

```
BE/
├── src/
│   ├── ai/              # Module AI chat & insights
│   ├── auth/             # Xác thực (JWT, login, register)
│   ├── email-sync/       # Đồng bộ Gmail & parse email bằng AI
│   ├── expense/          # Quản lý chi tiêu
│   ├── income/           # Quản lý thu nhập
│   ├── user/             # Quản lý người dùng
│   ├── prisma/           # Prisma service
│   ├── app.module.ts     # Root module
│   └── main.ts           # Entry point
├── prisma/
│   └── schema.prisma     # Database schema
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## Database Schema

```
User
├── id, email, password, name, role
├── Gmail OAuth tokens (accessToken, refreshToken, expiry)
└── Relations: expenses[], incomes[], syncedEmails[], chatMessages[]

Expense
├── id, amount, description, category, date
├── source (manual | email | sms), emailId
└── userId -> User

Income
├── id, amount, description, category, date
├── source (manual | email)
└── userId -> User

SyncedEmail
├── id, messageId, subject, from, syncedAt
└── userId -> User (unique: userId + messageId)

ChatMessage
├── id, role (user | assistant), content, createdAt
└── userId -> User
```

## API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/auth/register` | Đăng ký tài khoản |
| POST | `/auth/login` | Đăng nhập |
| GET | `/auth/profile` | Lấy thông tin user |
| GET/POST/PATCH/DELETE | `/expenses` | CRUD chi tiêu |
| GET | `/expenses/stats` | Thống kê chi tiêu |
| GET/POST/PATCH/DELETE | `/incomes` | CRUD thu nhập |
| GET | `/incomes/stats` | Thống kê thu nhập |
| POST | `/email-sync/sync` | Đồng bộ email thủ công |
| GET | `/email-sync/gmail/connect` | Lấy URL kết nối Gmail |
| DELETE | `/email-sync/gmail/disconnect` | Ngắt kết nối Gmail |
| POST | `/ai/chat` | Gửi tin nhắn cho AI |
| GET | `/ai/insights` | Lấy phân tích chi tiêu |
| GET | `/ai/history` | Lấy lịch sử chat |
| DELETE | `/ai/history` | Xóa lịch sử chat |

Xem chi tiết tại Swagger: `http://localhost:3001/api/docs`

## Xử lý lỗi thường gặp

**Port 5432 đã được sử dụng:** Dừng PostgreSQL đang chạy hoặc đổi port trong `docker-compose.yml`.

**Prisma client not found:**
```bash
npm run prisma:generate
```

**Không kết nối được database:**
```bash
docker ps  # Kiểm tra container đang chạy
npm run docker:db  # Khởi động lại nếu cần
```
