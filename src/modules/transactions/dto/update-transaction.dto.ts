// ============================================================
// UPDATE TRANSACTION DTO
// ============================================================
// Extends CreateTransactionDto with PartialType so all fields
// are optional. Used for PATCH /api/transactions/:id.
//
// IMPORTANT: When updating a transaction, the service will:
//   1. Reverse the balance effect of the OLD transaction
//   2. Apply the balance effect of the NEW (merged) transaction
//
// This means partial updates are safe:
//   PATCH { amount: 150 } → only amount changes, all other
//   fields stay the same, balance is recalculated correctly.
//
// The @ValidateIf decorator from CreateTransactionDto is
// preserved by PartialType for conditional validation.
// ============================================================

import { PartialType } from '@nestjs/mapped-types';
import { CreateTransactionDto } from './create-transaction.dto.js';

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}
