// ============================================================
// JWT AUTH GUARD
// ============================================================
// What:  A route guard that blocks access to protected endpoints
//        unless the request contains a valid JWT token.
//
// Why:   Many routes require authentication. Rather than writing
//        manual token-checking code inside every controller method,
//        we use a guard. Just add @UseGuards(JwtAuthGuard) to any
//        controller or method to protect it automatically.
//
// How:   By extending AuthGuard('jwt'), NestJS + Passport knows to:
//          1. Look for a Bearer token in the Authorization header
//          2. Run it through our JwtStrategy (jwt.strategy.ts)
//          3. If valid → set request.user and allow the request through
//          4. If invalid/missing → throw UnauthorizedException (401)
//
// Usage (in any controller):
//   @Get('protected-route')
//   @UseGuards(JwtAuthGuard)        ← Add this line
//   async someMethod(@CurrentUser() user: SafeUser) {
//     // Only authenticated users reach here
//   }
//
// You can also apply it to the entire controller class:
//   @UseGuards(JwtAuthGuard)        ← Applies to ALL methods in this controller
//   @Controller('accounts')
//   export class AccountsController { ... }
// ============================================================

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // AuthGuard('jwt') wires this guard to our JwtStrategy (registered as 'jwt')
  //
  // We extend it here (without overriding anything) so that:
  //   1. We have a named class to import across the codebase
  //   2. We can add custom behavior in the future if needed
  //      (e.g., check user roles, log access attempts, etc.)
  //
  // The 'jwt' string matches the name we gave in JwtStrategy's PassportStrategy('jwt')
}
