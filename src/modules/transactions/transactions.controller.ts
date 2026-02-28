import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { type SafeUser } from '../users/users.service.js';
import { TransactionsService } from './transactions.service.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';
import { TransactionType } from '../../../generated/prisma/client.js';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  // POST /api/transactions
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(user.id, dto);
  }

  // GET /api/transactions
  // GET /api/transactions?walletId=<uuid>
  // GET /api/transactions?type=EXPENSE
  // GET /api/transactions?categoryId=<uuid>
  // GET /api/transactions?startDate=2026-01-01&endDate=2026-01-31
  // Multiple filters work together (AND logic)
  @Get()
  findAll(
    @CurrentUser() user: SafeUser,
    @Query('walletId') walletId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('type') type?: TransactionType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.transactionsService.findAll(user.id, {
      walletId,
      categoryId,
      type,
      startDate,
      endDate,
    });
  }

  // GET /api/transactions/:id
  @Get(':id')
  findOne(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.findOne(id, user.id);
  }

  // PATCH /api/transactions/:id
  @Patch(':id')
  update(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, user.id, dto);
  }

  // DELETE /api/transactions/:id
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.remove(id, user.id);
  }
}
