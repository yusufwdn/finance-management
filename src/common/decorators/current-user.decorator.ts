// ============================================================
// CURRENT USER DECORATOR
// ============================================================
// What:  A custom parameter decorator that extracts the currently
//        authenticated user from the HTTP request object.
//
// Why:   After JWT authentication, Passport.js attaches the user
//        to `request.user`. Without this decorator, you'd have to
//        write this boilerplate in every controller method:
//          @Req() req: Request
//          const user = req.user;
//
//        With this decorator, you just write:
//          @CurrentUser() user: User
//
// How:   createParamDecorator receives the ExecutionContext, gets
//        the HTTP request from it, and returns request.user.
//
// Usage example in a controller:
//   @Get('profile')
//   @UseGuards(JwtAuthGuard)
//   getProfile(@CurrentUser() user: User) {
//     return user;
//   }
// ============================================================

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  // The factory function receives:
  //   data: anything passed to the decorator (e.g., @CurrentUser('email'))
  //   ctx:  execution context, which wraps the HTTP request/response
  (data: unknown, ctx: ExecutionContext) => {
    // Switch to the HTTP context and get the Express/Fastify request
    const request = ctx.switchToHttp().getRequest();

    // If 'data' is provided, return just that field from the user object
    // Example: @CurrentUser('email') returns just the user's email
    if (data) {
      return request.user?.[data as string];
    }

    // Otherwise return the entire user object
    return request.user;
  },
);
