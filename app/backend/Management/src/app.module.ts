import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ContractModule } from './contract/contract.module';

// ============================================================
// AppModule — module GỐC (root), nơi "lắp ráp" toàn bộ ứng dụng.
// "imports" ghép các module con lại — mỗi FR mới (Container, Shipment...)
// sau này chỉ cần thêm 1 dòng vào đây, y hệt cách ContractModule được thêm.
// ============================================================
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ContractModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
