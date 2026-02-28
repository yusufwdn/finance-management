// ============================================================
// LOGIN DTO
// ============================================================
// What:  Defines the shape and validation for POST /auth/login body.
//
// Why:   Login only needs an email and password — no name required.
//        This DTO is intentionally smaller than RegisterDto.
//
// Example valid body:
// {
//   "email": "john@example.com",
//   "password": "MyPass123!"
// }
// ============================================================

import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  // We don't use @MinLength here because:
  //   - If the user already registered with a valid password, it's valid
  //   - We don't want to reveal password rules to potential attackers
  //   - The actual credential check happens in AuthService
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
