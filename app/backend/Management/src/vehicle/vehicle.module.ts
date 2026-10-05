import { Module } from '@nestjs/common';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [VehicleController],
  providers: [VehicleService],
})
export class VehicleModule {}
