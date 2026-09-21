import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// ============================================================
// @Global() — module này "toàn cục": mọi module khác trong app dùng được
// PrismaService mà KHÔNG cần import PrismaModule lại từng nơi. Hợp lý vì
// hầu như module nghiệp vụ nào (Contract, Shipment, YardVisit...) cũng
// cần đọc/ghi DB.
//
// "exports: [PrismaService]" — nghĩa là: PrismaModule tạo ra PrismaService,
// và CHO PHÉP module khác "mượn" nó. Nếu không export, PrismaService chỉ
// dùng được trong nội bộ PrismaModule, module khác không thấy.
// ============================================================
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
