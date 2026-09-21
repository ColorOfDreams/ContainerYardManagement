import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    // TODO: khi có Prisma/Redis/Queue thật, kiểm tra kết nối ở đây theo đúng
    // HealthStatus schema trong docs/API_Kho_bai_Container_v1.yaml
    return {
      status: 'ok',
      service: 'management-service',
      timestamp: new Date().toISOString(),
    };
  }
}
