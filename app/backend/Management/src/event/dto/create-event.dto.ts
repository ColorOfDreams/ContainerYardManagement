import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum YardEventTypeDto {
  CustomsHold = 'CustomsHold',
  Rejected = 'Rejected',
  Dispute = 'Dispute',
  DamageDuringMovement = 'DamageDuringMovement',
  OwnerRequest = 'OwnerRequest',
}

export class CreateEventDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  yardVisitId: string;

  @ApiProperty({ enum: YardEventTypeDto })
  @IsEnum(YardEventTypeDto)
  eventType: YardEventTypeDto;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() requestedBy?: string;
}
