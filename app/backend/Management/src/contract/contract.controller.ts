import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

// ============================================================
// ContractController — LỚP GIAO TIẾP HTTP (presentation layer).
//
// So sánh với docs/API_Kho_bai_Container_v1.yaml — controller này implement
// đúng các path đã thiết kế trước: GET/POST /contracts, GET/PATCH
// /contracts/{id}, POST .../activate, POST .../terminate.
//
// Để ý: KHÔNG có logic if/else nghiệp vụ nào ở đây — mọi quyết định
// ("Draft mới được Active") nằm bên ContractService. Controller chỉ:
//   1. Khai báo route (@Get, @Post...)
//   2. Lấy dữ liệu từ request (@Body, @Param)
//   3. Gọi đúng hàm Service tương ứng
//   4. Trả kết quả (NestJS tự serialize object trả về thành JSON)
// Tách vậy để sau này đổi giao thức (vd thêm gRPC/GraphQL cho service khác
// gọi trực tiếp không qua HTTP) thì chỉ viết Controller mới, Service giữ
// nguyên — không phải viết lại nghiệp vụ.
// ============================================================
@ApiTags('management-contract')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  @RequirePermissions('contract:create')
  create(@Body() dto: CreateContractDto) {
    return this.contractService.create(dto);
  }

  @Get()
  @RequirePermissions('contract:read')
  findAll() {
    return this.contractService.findAll();
  }

  @Get(':contractId')
  @RequirePermissions('contract:read')
  findOne(@Param('contractId') contractId: string) {
    return this.contractService.findOne(contractId);
  }

  @Patch(':contractId')
  @RequirePermissions('contract:update')
  update(@Param('contractId') contractId: string, @Body() dto: UpdateContractDto) {
    return this.contractService.update(contractId, dto);
  }

  @Post(':contractId/activate')
  @RequirePermissions('contract:activate')
  activate(@Param('contractId') contractId: string) {
    return this.contractService.activate(contractId);
  }

  @Post(':contractId/terminate')
  @RequirePermissions('contract:terminate')
  terminate(@Param('contractId') contractId: string, @Body('reason') reason: string) {
    return this.contractService.terminate(contractId, reason);
  }
}
