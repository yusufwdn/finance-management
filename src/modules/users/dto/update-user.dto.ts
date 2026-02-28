// ============================================================
// UPDATE USER DTO
// ============================================================
// What:  Defines the shape for updating an existing user's profile.
//
// Why:   A user might only want to update their first name, not
//        all fields at once. All fields here are completely optional.
//
// How:   PartialType(CreateUserDto) is a NestJS helper that takes
//        every field from CreateUserDto and makes them all optional
//        (adds `?` to each property) while keeping ALL validation
//        decorators active for fields that ARE provided.
//
// Example: If a user sends { "firstName": "Jane" }, only firstName
//          is validated and updated. Other fields are untouched.
// ============================================================

import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto.js';

// PartialType automatically:
//   1. Makes every field from CreateUserDto optional
//   2. Keeps all validation decorators (so if you send email, it must still be valid)
export class UpdateUserDto extends PartialType(CreateUserDto) {}
