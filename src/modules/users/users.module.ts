// ============================================================
// USERS MODULE
// ============================================================
// What:  The NestJS module that groups all user-related components
//        (controller, service, DTOs) into a single logical unit.
//
// Why:   Every controller and service must belong to a module.
//        The module declares what this feature provides and what
//        it makes available to other modules.
//
// How:   @Module() has three key properties:
//   - controllers: List of controllers (handle HTTP routes)
//   - providers:   List of services (contain business logic)
//   - exports:     What to share with OTHER modules that import this one
//
// WHO IMPORTS THIS?
//   AuthModule imports UsersModule to get access to UsersService.
//   AuthService uses UsersService to create and find users.
//
// WHY EXPORT UsersService?
//   AuthService needs to call usersService.create() during registration
//   and usersService.findByEmail() during login.
//   By exporting UsersService, any module that imports UsersModule
//   can inject and use UsersService.
// ============================================================

import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController], // Register HTTP route handlers
  providers: [UsersService],      // Register injectable services
  exports: [UsersService],        // Share UsersService with AuthModule
})
export class UsersModule {}
