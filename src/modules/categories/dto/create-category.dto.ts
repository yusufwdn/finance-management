// ============================================================
// CREATE CATEGORY DTO
// ============================================================
// Categories label transactions for reporting.
// Example INCOME categories:  Salary, Freelance, Bonus
// Example EXPENSE categories: Food, Transport, Entertainment
//
// WHY type matters:
//   When creating a transaction, we validate that the category
//   type matches the transaction type:
//   - An INCOME transaction should use an INCOME category
//   - An EXPENSE transaction should use an EXPENSE category
//   - TRANSFER transactions don't need a category at all
// ============================================================

import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';

import { CategoryType } from '../../../../generated/prisma/client.js';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(50, { message: 'Category name must be 50 characters or less' })
  name: string;

  // INCOME or EXPENSE
  // This field is final — once set, changing the type would
  // invalidate all transactions that reference this category.
  // Clients should delete and recreate if they need a different type.
  @IsEnum(CategoryType, {
    message: `type must be one of: ${Object.values(CategoryType).join(', ')}`,
  })
  type: CategoryType;

  // ----------------------------------------------------------
  // color — hex color code for UI rendering
  // Example: "#FF5733" for red-orange
  // The API doesn't validate the format here — a separate
  // @Matches decorator could enforce hex format if needed.
  // ----------------------------------------------------------
  @IsOptional()
  @IsString()
  @MaxLength(7, { message: 'Color should be a hex code like #FF5733' })
  color?: string;

  // icon — icon name or emoji for visual identification
  // Example: "🍔" or "food-icon" (depends on frontend icon library)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
