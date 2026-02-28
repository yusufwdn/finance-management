// ============================================================
// CREATE USER DTO — Data Transfer Object
// ============================================================
// What:  Defines the exact shape and validation rules for the
//        request body when creating (registering) a new user.
//
// Why:   Without a DTO, we'd have to manually validate every
//        field inside the service — messy and easy to forget.
//        With a DTO + ValidationPipe (global in main.ts), NestJS
//        automatically rejects invalid requests before they
//        even reach the service layer.
//
// How:   class-validator decorators (@IsEmail, @MinLength, etc.)
//        are read by the global ValidationPipe. If any rule fails,
//        a 400 Bad Request is sent immediately with error details.
//
// Example valid request body:
// {
//   "email": "john@example.com",
//   "password": "MyPass123!",
//   "firstName": "John",
//   "lastName": "Doe"
// }
// ============================================================

import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  // @IsEmail() — rejects anything that isn't a valid email format
  // e.g., "not-an-email" → ValidationPipe throws 400
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  // @MinLength(8) — password must be at least 8 characters long
  // @MaxLength(100) — reasonable upper limit to prevent abuse
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(100, { message: 'Password must not exceed 100 characters' })
  password: string;

  // @IsNotEmpty() — field must not be an empty string ""
  // @IsString() — field must be a string type
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(50)
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MaxLength(50)
  lastName: string;
}
