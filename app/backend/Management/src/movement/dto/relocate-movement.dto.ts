import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class RelocateMovementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  yardVisitId: string;

  @ApiProperty() @IsString() reason: string;
}
