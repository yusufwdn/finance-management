// ============================================================
// CREATE WALLET DTO
// ============================================================
// Defines the shape and validation rules for creating a wallet.
// A "wallet" in our domain = an Account record in the database.
//
// Why the rename?
//   The database model is named `Account` (a common financial term).
//   Users of a personal finance app more naturally think of these
//   as "wallets" — their cash envelope, bank account, or credit card.
//   This DTO uses the domain language the user understands.
// ============================================================

import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
  IsBoolean,
} from 'class-validator';

import { AccountType } from '../../../../generated/prisma/client.js';

export class CreateWalletDto {
  // ----------------------------------------------------------
  // name — human-readable label for this wallet
  // Example: "Main Checking", "Emergency Fund", "Travel Cash"
  // ----------------------------------------------------------
  @IsString()
  @IsNotEmpty({ message: 'Wallet name is required' })
  @MaxLength(100, { message: 'Wallet name must be 100 characters or less' })
  name: string;

  // ----------------------------------------------------------
  // type — what kind of financial account this represents
  // Drives UI display (credit card shows negative balance as debt,
  // investment shows market value, etc.)
  // ----------------------------------------------------------
  @IsEnum(AccountType, {
    message: `type must be one of: ${Object.values(AccountType).join(', ')}`,
  })
  type: AccountType;

  // ----------------------------------------------------------
  // currency — ISO 4217 currency code (USD, EUR, IDR, etc.)
  // Defaults to "USD" in the database if not provided.
  // ----------------------------------------------------------
  @IsOptional()
  @IsString()
  @MaxLength(3, { message: 'Currency must be a 3-letter ISO code (e.g. USD)' })
  currency?: string;

  // ----------------------------------------------------------
  // description — optional notes about this wallet
  // Example: "Savings goal: laptop fund"
  // ----------------------------------------------------------
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Description must be 255 characters or less' })
  description?: string;

  // ----------------------------------------------------------
  // isActive — whether this wallet is shown in the UI
  // Soft-deleting a wallet sets this to false instead of
  // destroying the record (preserves transaction history).
  // ----------------------------------------------------------
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
