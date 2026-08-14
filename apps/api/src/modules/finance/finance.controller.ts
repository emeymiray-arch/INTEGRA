import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DiscountType } from '@prisma/client';
import { clampLimit, clampPage, PERMISSIONS } from '@integra/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { FinanceService } from './finance.service';

class InvoiceItemDto {
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  discountType?: DiscountType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;
}

class CreateDebtDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  debtorName!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('debts')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  findDebts(
    @CurrentUser() user: AuthUser,
    @Query('includeSettled') includeSettled?: string,
  ) {
    return this.financeService.findDebts(
      user.organizationId,
      String(includeSettled) === 'true',
    );
  }

  @Post('debts')
  @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
  createDebt(@CurrentUser() user: AuthUser, @Body() dto: CreateDebtDto) {
    return this.financeService.createDebt(user.organizationId, user.userId, {
      debtorName: dto.debtorName,
      amount: Number(dto.amount),
      note: dto.note,
    });
  }

  @Patch('debts/:id/settle')
  @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
  settleDebt(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.financeService.settleDebt(user.organizationId, id);
  }

  @Delete('debts/:id')
  @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
  removeDebt(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.financeService.removeDebt(user.organizationId, id);
  }

  @Get('invoices')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  findInvoices(
    @CurrentUser() user: AuthUser,
    @Query('patientId') patientId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.financeService.findInvoices(
      user.organizationId,
      patientId,
      clampPage(page),
      clampLimit(limit, 20, 50),
    );
  }

  @Get('invoices/:id')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  findInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.financeService.findInvoice(user.organizationId, id);
  }

  @Post('invoices')
  @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
  createInvoice(
    @CurrentUser() user: AuthUser,
    @Body()
    dto: {
      branchId: string;
      patientId: string;
      appointmentId?: string;
      notes?: string;
      items: InvoiceItemDto[];
    },
  ) {
    return this.financeService.createInvoice(user.organizationId, user.userId, dto);
  }

  @Post('invoices/:id/issue')
  @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
  issueInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.financeService.issueInvoice(user.organizationId, id, user.userId);
  }

  @Post('invoices/:invoiceId/payments')
  @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
  createPayment(
    @CurrentUser() user: AuthUser,
    @Param('invoiceId') invoiceId: string,
    @Body()
    dto: { amount: number; paymentMethodId: string; reference?: string; notes?: string },
  ) {
    return this.financeService.createPayment(
      user.organizationId,
      invoiceId,
      user.staffId,
      user.userId,
      dto,
    );
  }

  @Post('payments/:paymentId/refunds')
  @RequirePermissions(PERMISSIONS.FINANCE_REFUND)
  createRefund(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
    @Body() dto: { amount: number; reason?: string },
  ) {
    return this.financeService.createRefund(
      user.organizationId,
      paymentId,
      user.staffId,
      user.userId,
      dto,
    );
  }

  @Get('payment-methods')
  @RequirePermissions(PERMISSIONS.FINANCE_READ)
  findPaymentMethods(@CurrentUser() user: AuthUser) {
    return this.financeService.findPaymentMethods(user.organizationId);
  }

  @Post('payment-methods')
  @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
  createPaymentMethod(
    @CurrentUser() user: AuthUser,
    @Body() dto: { code: string; name: string; type: string; config?: Record<string, unknown> },
  ) {
    return this.financeService.createPaymentMethod(user.organizationId, dto);
  }
}
