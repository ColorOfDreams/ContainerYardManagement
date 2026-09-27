import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('admin-users') @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Post() @RequirePermissions('user:create') create(@Body() dto: CreateUserDto) { return this.usersService.create(dto); }
  @Get() @RequirePermissions('user:read') findAll() { return this.usersService.findAll(); }
  @Get(':userId') @RequirePermissions('user:read') findOne(@Param('userId') userId: string) { return this.usersService.findOne(userId); }
  @Patch(':userId') @RequirePermissions('user:update') update(@Param('userId') userId: string, @Body() dto: UpdateUserDto) { return this.usersService.update(userId, dto); }
  @Delete(':userId') @RequirePermissions('user:delete') remove(@Param('userId') userId: string) { return this.usersService.remove(userId); }
}
