// ============================================================
// JWT STRATEGY — Token Validation Logic
// ============================================================
// What:  This class teaches Passport HOW to validate a JWT token.
//        When a request comes in with a Bearer token, Passport
//        automatically calls this strategy's validate() method.
//
// Why:   Passport is an authentication middleware library. It handles
//        the mechanics of extracting tokens from requests, but it
//        needs YOU to tell it:
//          1. Where is the token? (extractor)
//          2. What secret was used to sign it? (secretOrKey)
//          3. What should we do with the decoded payload? (validate())
//
// HOW IT FITS IN THE SYSTEM:
//
//   Request with "Authorization: Bearer <token>"
//         │
//         ▼
//   JwtAuthGuard (src/common/guards/jwt-auth.guard.ts)
//         │  extends AuthGuard('jwt')
//         │  tells Passport: "use the 'jwt' strategy"
//         ▼
//   JwtStrategy (this file) — Passport calls it automatically
//         │  1. Extracts token from Authorization header
//         │  2. Verifies signature using jwtSecret
//         │  3. Checks expiry
//         │  4. Calls validate(payload) → returns user
//         ▼
//   request.user = { id, email, firstName, lastName, ... }
//         │
//         ▼
//   Controller method receives the user via @CurrentUser()
//
// ============================================================

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import { UsersService } from '../../users/users.service.js';
import { SafeUser } from '../../users/users.service.js';

// -------------------------------------------------------
// JWT PAYLOAD INTERFACE
// -------------------------------------------------------
// This defines the shape of the data INSIDE the JWT token.
// When we create a token in AuthService, we put these fields in.
// When the token is decoded here, TypeScript knows what to expect.
// -------------------------------------------------------
export interface JwtPayload {
  sub: string;    // "subject" — standard JWT claim. We store the user's UUID here.
  email: string;  // User's email — stored for convenience
  iat?: number;   // "issued at" — Unix timestamp, auto-added by JwtService
  exp?: number;   // "expires at" — Unix timestamp, auto-added by JwtService
}

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy, // Use the passport-jwt Strategy
  'jwt',    // The name 'jwt' is what AuthGuard('jwt') references
) {
  constructor(
    // ConfigService lets us read from our typed config factory
    // (src/config/app.config.ts)
    private readonly configService: ConfigService,
    // UsersService is needed to fetch the full user from DB
    private readonly usersService: UsersService,
  ) {
    // `super()` configures the Passport strategy options
    super({
      // ExtractJwt.fromAuthHeaderAsBearerToken() teaches Passport where to find the token:
      // It looks at the "Authorization" header and extracts the token from "Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // ignoreExpiration: false means Passport WILL check if the token has expired.
      // If the token is expired, Passport automatically rejects it with a 401.
      ignoreExpiration: false,

      // secretOrKey is the secret used to verify the token's signature.
      // It MUST match the secret used when the token was created (in AuthService).
      // We read it from the CONFIG (which reads from JWT_SECRET in .env).
      secretOrKey: configService.get<string>('jwt.secret') ?? 'fallback_secret',
    });
  }

  // -------------------------------------------------------
  // validate()
  // -------------------------------------------------------
  // What:  Called by Passport AFTER it successfully verifies the
  //        token's signature and expiry. The payload is the decoded
  //        token body (the data we put in when creating the token).
  //
  // Why:   We use the payload to load the FULL, CURRENT user from
  //        the database. This ensures:
  //          a) The user account still exists
  //          b) We get the latest user data (not just what's in the token)
  //          c) We can check if the user has been banned/deleted
  //
  // How:   We take `payload.sub` (which is the user's UUID) and call
  //        usersService.findById() to get the full user object.
  //        Whatever we return from this method gets attached to
  //        `request.user` automatically by Passport.
  //
  // Return value: Becomes request.user
  // -------------------------------------------------------
  async validate(payload: JwtPayload): Promise<SafeUser> {
    // payload.sub contains the user's UUID (set in AuthService when creating token)
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      // This shouldn't happen normally (the user would have to be deleted
      // after the token was issued), but we handle it defensively
      throw new UnauthorizedException('User account no longer exists');
    }

    // Whatever we return here becomes `request.user`
    // The @CurrentUser() decorator then reads it from request.user
    return user;
  }
}
