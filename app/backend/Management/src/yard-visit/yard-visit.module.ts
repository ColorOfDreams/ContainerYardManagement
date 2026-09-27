import { Module } from '@nestjs/common';
import { YardVisitController } from './yard-visit.controller';
import { YardVisitService } from './yard-visit.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [YardVisitController],
  providers: [YardVisitService],
})
export class YardVisitModule {}
