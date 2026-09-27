import { Module } from '@nestjs/common';
import { ShipmentController } from './shipment.controller';
import { CargoController } from './cargo.controller';
import { ShipmentService } from './shipment.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ShipmentController, CargoController],
  providers: [ShipmentService],
})
export class ShipmentModule {}
