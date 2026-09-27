import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@ApiTags('management-invoice')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @RequirePermissions('invoice:read')
  findAll(
    @Query('contract_id') contractId?: string,
    @Query('payment_status') paymentStatus?: string,
    @Query('invoice_type') invoiceType?: string,
  ) {
    return this.invoiceService.findAll({ contractId, paymentStatus, invoiceType });
  }

  @Post()
  @RequirePermissions('invoice:create')
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoiceService.create(dto);
  }

  @Get(':invoiceId')
  @RequirePermissions('invoice:read')
  findOne(@Param('invoiceId') invoiceId: string) {
    return this.invoiceService.findOne(invoiceId);
  }

  @Get(':invoiceId/payments')
  @RequirePermissions('payment:read')
  listPayments(@Param('invoiceId') invoiceId: string) {
    return this.invoiceService.listPayments(invoiceId);
  }

  @Post(':invoiceId/payments')
  @RequirePermissions('payment:create')
  createPayment(@Param('invoiceId') invoiceId: string, @Body() dto: CreatePaymentDto) {
    return this.invoiceService.createPayment(invoiceId, dto);
  }
}
