// ============================================================
// CREATE TRANSACTION DTO
// ============================================================
// This DTO contains the most complex validation logic in the app
// because transactions have conditional rules depending on type.
//
// THE THREE TRANSACTION TYPES:
//
//   INCOME  — Money coming INTO a wallet from outside.
//             Examples: salary deposit, freelance payment, gift.
//             Effect: wallet.balance += amount
//             Requires: accountId (destination)
//             Optional: categoryId (should be INCOME type)
//
//   EXPENSE — Money going OUT of a wallet to outside.
//             Examples: grocery purchase, bill payment, subscription.
//             Effect: wallet.balance -= amount
//             Requires: accountId (source)
//             Optional: categoryId (should be EXPENSE type)
//
//   TRANSFER — Money moving BETWEEN two of the user's own wallets.
//              Examples: move $500 from Checking to Savings.
//              Effect: fromWallet.balance -= amount
//                      toWallet.balance   += amount
//              Requires: accountId (from), toAccountId (to)
//              NOT categorized — it's not income or expense, just movement.
// ============================================================

import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumber,
  Min,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../../../../generated/prisma/client.js';

export class CreateTransactionDto {
  // ----------------------------------------------------------
  // amount — how much money is involved
  // Must be positive (> 0). The direction (+ or -) is determined
  // by the `type` field, not the sign of the amount.
  // Stored as Decimal(15,2) — up to 15 digits, 2 decimal places.
  // ----------------------------------------------------------
  @Type(() => Number) // class-transformer: coerce string "10.50" → number 10.5
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  // ----------------------------------------------------------
  // type — INCOME, EXPENSE, or TRANSFER
  // This single field drives all balance calculation logic.
  // ----------------------------------------------------------
  @IsEnum(TransactionType, {
    message: `type must be one of: ${Object.values(TransactionType).join(', ')}`,
  })
  type: TransactionType;

  // ----------------------------------------------------------
  // accountId — the SOURCE wallet
  // For INCOME:    the wallet receiving money
  // For EXPENSE:   the wallet losing money
  // For TRANSFER:  the wallet sending money (the "from" wallet)
  // ----------------------------------------------------------
  @IsUUID('4', { message: 'accountId must be a valid UUID' })
  accountId: string;

  // ----------------------------------------------------------
  // toAccountId — the DESTINATION wallet (TRANSFER only)
  //
  // @ValidateIf((o) => o.type === 'TRANSFER')
  //   → This field is only required/validated when type=TRANSFER
  //   → For INCOME and EXPENSE, this field is completely ignored
  //      even if accidentally sent. The service-level validation
  //      will also reject it with a 400 if provided for non-TRANSFER.
  //
  // @IsNotEmpty ensures that if type=TRANSFER, this field
  // cannot be an empty string.
  // ----------------------------------------------------------
  @ValidateIf((o: CreateTransactionDto) => o.type === TransactionType.TRANSFER)
  @IsNotEmpty({ message: 'toAccountId is required for TRANSFER transactions' })
  @IsUUID('4', { message: 'toAccountId must be a valid UUID' })
  toAccountId?: string;

  // ----------------------------------------------------------
  // categoryId — optional label for reporting
  // Should match the transaction type (INCOME cat for INCOME tx),
  // but this is enforced at the service layer, not here.
  // TRANSFER transactions should NOT have a category.
  // ----------------------------------------------------------
  @IsOptional()
  @IsUUID('4', { message: 'categoryId must be a valid UUID' })
  categoryId?: string;

  // ----------------------------------------------------------
  // date — when the transaction occurred
  // Sent as ISO 8601 string: "2026-02-28" or "2026-02-28T10:00:00Z"
  // Stored as DateTime in the database.
  // ----------------------------------------------------------
  @IsDateString({}, { message: 'date must be a valid ISO 8601 date string (e.g. 2026-02-28)' })
  date: string;

  // ----------------------------------------------------------
  // description — optional memo or note
  // Example: "March rent", "Coffee with client", "Transfer to emergency fund"
  // ----------------------------------------------------------
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
