import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// ============================================================
// PrismaService — "cầu nối" duy nhất giữa code và database.
//
// PrismaClient là lớp do Prisma TỰ SINH RA (generate) từ prisma/schema.prisma.
// Nó biết chính xác Contract có những cột gì, kiểu dữ liệu gì — vì đọc trực
// tiếp từ schema.prisma bạn đã viết. Đây là ORM (Object-Relational Mapping):
// thay vì viết tay câu lệnh SQL "SELECT * FROM management.contract WHERE...",
// bạn gọi hàm TypeScript có gõ kiểu (type-safe) như prisma.contract.findMany().
//
// @Injectable() là "nhãn" báo cho NestJS: class này có thể được TIÊM
// (inject) vào chỗ khác cần nó — xem thêm ở contract.service.ts bên dưới.
// ============================================================
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Mở kết nối tới Postgres khi NestJS khởi động app — chỉ 1 lần,
    // dùng lại (connection pool) cho mọi request sau đó, không mở/đóng
    // kết nối mới mỗi lần có request (rất tốn tài nguyên nếu làm vậy).
    await this.$connect();
  }

  async onModuleDestroy() {
    // Đóng kết nối gọn gàng khi app tắt (vd docker compose down).
    await this.$disconnect();
  }
}
