import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
// Dùng để xuất ra cho module khác import sử dụng
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
