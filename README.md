# 🚕 Cab Booking System - Microservices & AI-Powered (DHHTTT18A-N21)

Hệ thống đặt xe công nghệ toàn diện được xây dựng theo kiến trúc **Microservices**, kết hợp sức mạnh của **Generative AI (LLM)** để thay thế cho các mô hình Machine Learning truyền thống trong việc điều phối xe, định giá (Pricing) và dự báo. 

Dự án chú trọng đặc biệt vào các khía cạnh cốt lõi của một hệ thống phân tán quy mô lớn: **Đảm bảo tính toàn vẹn dữ liệu (ACID/Saga), Khả năng chịu lỗi (Resilience), Hiệu năng cao (Performance)** và **Bảo mật tối đa (Zero Trust Security)**.

## 🌟 Tính năng nổi bật (Key Features)

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

## 🏗️ Kiến trúc Công nghệ (Tech Stack)

* **Backend:** Node.js, JavaScript/TypeScript.
* **Database:** PostgreSQL (lưu trữ ACID), Redis (Caching hiệu năng cao).
* **Message Broker:** Apache Kafka.
* **AI/LLM:** Google Gemini API.
* **Infrastructure:** Docker & Docker Compose (Auto-scaling, Containerization).

---

## 🧪 Chiến lược Kiểm thử Hệ thống (Comprehensive Testing Strategy)

Dự án được validate bằng hệ thống kịch bản kiểm thử (Test Cases) gồm 10 cấp độ, từ luồng cơ bản đến các bài test ép tải và phá hủy hệ thống:

* **Level 1-2: Core Flow & Edge Cases:** Xác thực người dùng, tạo Booking, kiểm tra tính hợp lệ của input, hết hạn JWT, xử lý logic tài xế Offline/Online.
* **Level 3-4: Distributed Systems:** Đảm bảo tính ACID của database, cơ chế Saga khi thanh toán lỗi, Outbox Pattern ghi nhận event, Xử lý Race Condition.
* **Level 5: AI Generative Reliability:** Kiểm thử AI ảo giác (Hallucination), Fallback khi AI lỗi, xử lý Outlier (dữ liệu cực đoan) và ML Drift detection.
* **Level 6: Multi-Agent Orchestration:** Kiểm thử AI Agent tự động chọn tool (Routing), xử lý khi thiếu context, và ưu tiên Multi-objective.
* **Level 7: Performance & Auto-scaling:** Chịu tải 1000 RPS, đảm bảo P95 Latency < 200ms, DB Pool limits, Redis Cache Hit-rate > 90%, và Auto-scale Pods theo CPU/Memory.
* **Level 8: Resilience (Chaos Engineering):** Chủ động đánh sập Kafka, ngắt mạng các service (Network Partition), test Circuit Breaker mở/đóng.
* **Level 9-10: Security & Zero Trust:** Khai thác SQLi, bypass API Gateway, test mTLS handshake, Token Tampering, và Audit Logging.

---

## 🚀 Hướng dẫn cài đặt (Getting Started)

### Yêu cầu hệ thống
* Docker & Docker Compose
* Node.js (>= 18.x)

### Cài đặt và khởi chạy
1. **Clone repository:**
   ```bash
   git clone [https://github.com/gnaht41/DHHTTT18A-N21-cab-system.git](https://github.com/gnaht41/DHHTTT18A-N21-cab-system.git)
   cd DHHTTT18A-N21-cab-system
