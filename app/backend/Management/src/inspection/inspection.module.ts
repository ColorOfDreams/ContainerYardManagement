import { Module } from '@nestjs/common';
import { InspectionController } from './inspection.controller';
import { InspectionService } from './inspection.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InspectionController],
  providers: [InspectionService],
})
export class InspectionModule {}
