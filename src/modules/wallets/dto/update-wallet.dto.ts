// ============================================================
// UPDATE WALLET DTO
// ============================================================
// PartialType makes every field from CreateWalletDto optional.
// This means you can PATCH just { name: "New Name" } without
// providing all other fields.
//
// All class-validator rules from CreateWalletDto are preserved —
// if you DO supply a field, it still must pass validation.
// ============================================================

import { PartialType } from '@nestjs/mapped-types';
import { CreateWalletDto } from './create-wallet.dto.js';

export class UpdateWalletDto extends PartialType(CreateWalletDto) {}
