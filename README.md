# Container Yard Management System

Hệ thống quản lý kho bãi container: quản lý vòng đời container từ Hợp đồng, Shipment, Gate-in, gán vị trí lưu bãi (Slot Allocation), di chuyển nội bộ, Gate-out, đến Invoice/Payment.

## Kiến trúc

Backend gồm 2 service tách biệt hoàn toàn dữ liệu, giao tiếp bất đồng bộ qua Message Broker:

- **Management Service** — CRUD nghiệp vụ: Contract, Shipment, Container, Yard Visit, Inspection, Movement, Event, Invoice, Payment.
- **Yard Optimize Service** — Slot Allocation & re-plan khi có Event; sở hữu dữ liệu Slot (sơ đồ bãi) và thuật toán tối ưu vị trí.

```mermaid
flowchart TD
    Client["Client (Web / Mobile)"] -->|HTTPS| Gateway["API Gateway<br/>JWT/OAuth2 · Rate limit · CORS"]
    Gateway -->|REST| Mgmt["Management Service"]
    Gateway -->|REST| Opt["Yard Optimize Service"]

    Mgmt -->|read/write| MgmtDB[("Management DB")]
    Mgmt -->|cache| Redis[("Redis")]
    Opt -->|read/write| OptDB[("Optimize DB<br/>(Slot)")]

    Mgmt <-->|publish/consume| Broker[("Message Broker<br/>RabbitMQ / Kafka")]
    Opt <-->|publish/consume| Broker
```

Chi tiết luồng event (publish/consume qua Broker):

| Chiều | Event |
|---|---|
| Management → Broker → Optimize | `ContainerReadyForAllocation`, `ReplanRequested`, `ContainerDeparted` |
| Optimize → Broker → Management | `SlotAllocated`, `RelocationProposed` |

## Tech stack

- Backend: 2 service độc lập (Management Service, Yard Optimize Service) — mỗi service 1 database riêng
- API Gateway: xác thực JWT/OAuth2, rate limit, CORS, định tuyến
- Message Broker: RabbitMQ / Kafka (giao tiếp bất đồng bộ giữa 2 service)
- Cache: Redis
- Containerization: Docker / Docker Compose
- CI/CD: tự động build, test, deploy khi có thay đổi code
- API docs: Swagger / OpenAPI

## Cấu trúc thư mục

```
.
├── app/
│   ├── backend/
│   │   ├── Management/   # Management Service (NestJS + Prisma) — Auth/RBAC, Contract...
│   │   └── Optimize/     # Yard Optimize Service (NestJS + Prisma) — skeleton, chưa triển khai
│   └── frontend/
│       └── Managemnet/   # chưa triển khai
├── db/init/               # script tạo schema Postgres (management, optimize)
├── docs/                  # tài liệu nội bộ (SRS, ERD, HLD, API spec...), không push công khai
├── postman/               # collection/environment Postman để test API
├── tests/
├── docker-compose.yml
├── .env.example
└── README.md
```

## Chạy dự án

1. Tạo file cấu hình local (không commit):

   ```bash
   cp .env.example .env
   ```

2. Chạy hạ tầng. Mặc định chỉ chạy PostgreSQL và Management Service — đủ cho giai đoạn CRUD/Auth hiện tại:

   ```bash
   docker compose up -d --build
   ```

   Khi bắt đầu tích hợp Redis, RabbitMQ và Yard Optimize Service (Slot Allocation), chạy toàn bộ hạ tầng bằng:

   ```bash
   docker compose --profile full up -d --build
   ```

3. Lần chạy đầu tiên (hoặc sau khi thêm migration mới) cần apply schema Prisma và tạo tài khoản Admin đầu tiên — xem `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` trong `.env`:

   ```bash
   docker compose exec management-service npx prisma migrate deploy
   docker compose exec management-service npm run prisma:seed
   ```

4. (Tuỳ chọn) Sinh sẵn dữ liệu demo/test — hàng ngàn dòng trải đều mọi bảng (Contract, Container, Shipment, Yard Visit, Inspection, Movement, Event, Invoice, Payment...) và 6 tài khoản theo từng role, để có dữ liệu thật ngay khi mở Swagger/Postman thay vì phải tạo tay:

   ```bash
   docker compose exec management-service npm run prisma:seed:fake
   ```

   Chạy lại nhiều lần sẽ cộng dồn thêm dữ liệu mới (không xoá dữ liệu cũ). Tài khoản demo dùng chung mật khẩu `Passw0rd1`:

   | Email | Role |
   |---|---|
   | `admin2@example.local` | ADMIN (full quyền) |
   | `dispatcher@example.local` | DISPATCHER |
   | `operator@example.local` | OPERATOR |
   | `inspector@example.local` | INSPECTOR |
   | `accountant@example.local` | ACCOUNTANT |
   | `viewer@example.local` | VIEWER |

### Các endpoint chính (Management Service — mặc định cổng `3001`, đổi qua `MANAGEMENT_SERVICE_PORT`)

3 endpoint dưới đây là điểm vào đặc biệt để **kiểm tra/test** service — không phải API nghiệp vụ như các route còn lại:

| Endpoint | Công dụng |
|---|---|
| [http://localhost:3001/health](http://localhost:3001/health) | Health check — service (và kết nối DB) đã sẵn sàng hay chưa; dùng cho Docker healthcheck/CI. |
| [http://localhost:3001/docs](http://localhost:3001/docs) | **Swagger UI** — giao diện xem và thử trực tiếp toàn bộ API (request/response mẫu, thử nhanh không cần Postman). Endpoint cần JWT thì bấm nút "Authorize" và dán access token lấy từ `POST /auth/login`. |
| [http://localhost:3001/docs-json](http://localhost:3001/docs-json) | **OpenAPI spec (JSON)** tự sinh từ code — dùng để import vào Postman (Import → Link), hoặc các công cụ sinh client/API doc khác. Luôn khớp 1-1 với API thật vì lấy trực tiếp từ decorator trong code, không cần đồng bộ tay. |

Yard Optimize Service (`OPTIMIZE_SERVICE_PORT`, mặc định `3002`) hiện chỉ có `GET /health` — các endpoint Slot Allocation chưa triển khai.

### Test tự động bằng Postman

[postman/ContainerYardManagement.postman_collection.json](postman/ContainerYardManagement.postman_collection.json) — import vào Postman rồi bấm **Run** (Collection Runner) để chạy tuần tự toàn bộ API hiện có (login → tạo permission/role/user/contract → activate/terminate → refresh/logout), tự lưu token và id giữa các bước, mỗi request có sẵn assertion pass/fail — không cần tự tay gọi và kiểm tra từng endpoint. Chạy ngoài Postman (CI/terminal) bằng [Newman](https://www.npmjs.com/package/newman):

```bash
npx newman run postman/ContainerYardManagement.postman_collection.json
```
