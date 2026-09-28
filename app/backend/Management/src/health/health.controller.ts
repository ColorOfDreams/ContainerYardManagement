// Chekc xem service hệ thoogns còn ổn không

import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}
  // Gọi GET thôi
  @Get()
  async check() {
    const result = await this.db.query('SELECT NOW() AS server_time');

    //  return output nếu ổn
    return {
      status: 'ok',
      service: 'management-service',
      timestamp: new Date().toISOString(),
      dbTime: result.rows[0].server_time,
    };
  }
}
