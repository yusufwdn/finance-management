// ============================================================
// REGISTER DTO
// ============================================================
// What:  Defines the shape and validation for the POST /auth/register body.
//
// Why:   Registration needs the same fields as CreateUserDto.
//        We simply re-export it under the "Auth" naming convention
//        so the Auth module is self-contained and clear about intent.
// ============================================================

import { CreateUserDto } from '../../users/dto/create-user.dto.js';

// RegisterDto IS CreateUserDto — same fields, same validation.
// We alias it here so that AuthController can import from within
// the auth module itself, and the naming reflects the action.
export class RegisterDto extends CreateUserDto {}
