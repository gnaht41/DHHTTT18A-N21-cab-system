# Cab Booking System - Microservices & AI-Powered (DHHTTT18A-N21)

Hệ thống đặt xe công nghệ toàn diện được xây dựng theo kiến trúc **Microservices**, kết hợp sức mạnh của **Generative AI (LLM)** để thay thế cho các mô hình Machine Learning truyền thống trong việc điều phối xe, định giá (Pricing) và dự báo. 

Dự án chú trọng đặc biệt vào các khía cạnh cốt lõi của một hệ thống phân tán quy mô lớn: **Đảm bảo tính toàn vẹn dữ liệu (ACID/Saga), Khả năng chịu lỗi (Resilience), Hiệu năng cao (Performance)** và **Bảo mật tối đa (Zero Trust Security)**.

## Tính năng nổi bật (Key Features)

### 1. Kiến trúc Microservices & Hệ thống phân tán
* **API Gateway:** Định tuyến (routing), Rate Limiting, và xác thực tập trung.
* **Event-Driven Architecture:** Giao tiếp bất đồng bộ giữa các service thông qua **Kafka** với cơ chế **Outbox Pattern** chống mất dữ liệu.
* **Distributed Transactions:** Xử lý giao dịch phân tán sử dụng **Saga Pattern** (tự động rollback/compensation khi thanh toán lỗi).
* **Idempotency:** Ngăn chặn trừ tiền/tạo đơn trùng lặp khi request bị gửi nhiều lần do lỗi mạng.

### 2. Tích hợp Generative AI & AI Agent
Sử dụng **Gemini 2.5 Flash Lite** để suy luận thời gian thực thay vì hard-code rule-based:
* **AI ETA & Surge Pricing:** Ước tính thời gian đến và nhân hệ số giá (Surge) dựa trên thời tiết, giờ cao điểm, và nhu cầu.
* **AI Fraud Detection:** Phát hiện gian lận đa biến (thiết bị, IP, lịch sử).
* **AI Dispatch Agent (Multi-objective):** Tự động chọn tài xế tốt nhất dựa trên sự cân bằng giữa **ETA (thời gian)** và **Price (giá tiền)**, thay vì chỉ quét bán kính gần nhất.
* **Graceful Degradation:** Hệ thống tự động Fallback về thuật toán rule-based (công thức vật lý) nếu AI Service bị sập, đảm bảo hệ thống không bao giờ crash.

### 3. Độ tin cậy & Tự phục hồi (Resilience & Self-healing)
* **Circuit Breaker:** Ngắt mạch hệ thống khi một service (VD: Pricing) bị sập để tránh hiệu ứng domino, tự động áp dụng giá dự phòng.
* **Retry & Exponential Backoff:** Tự động thử lại kết nối với độ trễ tăng dần khi gặp lỗi mạng tạm thời.
* **Network Partition Handling:** Hệ thống vẫn nhận booking và chuyển sang trạng thái `PENDING` nếu Driver Service bị chia cắt mạng.

### 4. Zero Trust Security & Bảo mật
* **mTLS (Mutual TLS):** Bắt buộc xác thực chứng chỉ số hai chiều cho mọi giao tiếp nội bộ giữa các microservices.
* **RBAC (Role-Based Access Control):** Phân quyền nghiêm ngặt, chặn truy cập vượt quyền tại Gateway.
* **Data Encryption:** Mã hóa dữ liệu nhạy cảm (thẻ tín dụng, mật khẩu) tại tầng lưu trữ (Encryption at rest) và che dấu dữ liệu (Data Masking) trên log/API.
* **Bảo vệ toàn diện:** Chống SQL Injection, XSS, JWT Tampering, và tấn công Spam/DDoS.

---

## Kiến trúc Công nghệ (Tech Stack)

* **Backend:** Node.js, JavaScript/TypeScript.
* **Database:** PostgreSQL (lưu trữ ACID), Redis (Caching hiệu năng cao).
* **Message Broker:** Apache Kafka.
* **AI/LLM:** Google Gemini API.
* **Infrastructure:** Docker & Docker Compose (Auto-scaling, Containerization).

---

## 🚀 Hướng dẫn cài đặt (Getting Started)

### Yêu cầu hệ thống
* Docker & Docker Compose
* Node.js (>= 18.x)

```
npm i
docker compose up -d --build
docker compose down -v
```
