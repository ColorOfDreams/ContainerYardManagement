import { Module } from '@nestjs/common';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';

// ============================================================
// ContractModule — "hộp" đóng gói mọi thứ liên quan tới 1 domain (Contract).
//
// controllers: [...] -> NestJS quét các route trong ContractController và
//   đăng ký vào app khi bootstrap.
// providers: [...]   -> NestJS biết cần tạo (và có thể tiêm đi nơi khác)
//   ContractService.
//
// Vì sao chia theo module domain (Contract/Shipment/YardVisit...) thay vì
// 1 module to duy nhất? Vì SRS đã chia theo 11 FR — mỗi module khớp 1 FR,
// dễ tìm code, dễ giao việc nếu làm nhóm, và module này có thể "import"
// module khác khi cần (vd sau này ShipmentModule cần gọi ContractService để
// kiểm tra Contract có Active không — FR-03 exception "Contract không
// Active" — lúc đó ContractModule sẽ export thêm ContractService).
// ============================================================
@Module({
  controllers: [ContractController],
  providers: [ContractService],
})
export class ContractModule {}
