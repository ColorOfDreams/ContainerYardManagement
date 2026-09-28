import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { ContractModule } from './contract/contract.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ContainerModule } from './container/container.module';
import { ShipmentModule } from './shipment/shipment.module';
import { YardVisitModule } from './yard-visit/yard-visit.module';
import { InspectionModule } from './inspection/inspection.module';
import { MovementModule } from './movement/movement.module';
import { EventModule } from './event/event.module';
import { InvoiceModule } from './invoice/invoice.module';
import { ReportsModule } from './reports/reports.module';

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
    DatabaseModule,
    AuthModule,
    ContractModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    ContainerModule,
    ShipmentModule,
    YardVisitModule,
    InspectionModule,
    MovementModule,
    EventModule,
    InvoiceModule,
    ReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
