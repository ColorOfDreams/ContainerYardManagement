import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ContainerService } from './container.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';

@ApiTags('management-container')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('containers')
export class ContainerController {
  constructor(private readonly containerService: ContainerService) {}

  @Post()
  @RequirePermissions('container:create')
  create(@Body() dto: CreateContainerDto) {
    return this.containerService.create(dto);
  }

  @Get()
  @RequirePermissions('container:read')
  findAll() {
    return this.containerService.findAll();
  }

  @Get(':containerId')
  @RequirePermissions('container:read')
  findOne(@Param('containerId') containerId: string) {
    return this.containerService.findOne(containerId);
  }

  @Patch(':containerId')
  @RequirePermissions('container:update')
  update(@Param('containerId') containerId: string, @Body() dto: UpdateContainerDto) {
    return this.containerService.update(containerId, dto);
  }

  @Post(':containerId/maintenance')
  @RequirePermissions('container:update')
  maintenance(@Param('containerId') containerId: string) {
    return this.containerService.maintenance(containerId);
  }

  @Post(':containerId/available')
  @RequirePermissions('container:update')
  available(@Param('containerId') containerId: string) {
    return this.containerService.available(containerId);
  }

  @Post(':containerId/damage')
  @RequirePermissions('container:update')
  damage(@Param('containerId') containerId: string) {
    return this.containerService.damage(containerId);
  }
}
