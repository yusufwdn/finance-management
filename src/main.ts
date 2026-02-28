// ============================================================
// MAIN.TS — Application Entry Point
// ============================================================
// What:  This is the FIRST file that runs when you start the app.
//        It creates the NestJS application, applies global
//        middleware/pipes/filters, and starts the HTTP server.
//
// Why:   Global configurations applied here affect the ENTIRE app:
//        - ValidationPipe: validates all incoming request bodies
//        - ResponseTransformInterceptor: standardizes all responses
//        - HttpExceptionFilter: standardizes all error responses
//        - CORS: controls which origins can call our API
//        - API prefix: all routes start with /api
//
// How:   NestFactory.create() builds the app from AppModule.
//        We then configure it and call app.listen() to start.
// ============================================================

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create the NestJS application from the root AppModule
  const app = await NestFactory.create(AppModule);

  // Get the ConfigService to read typed config values
  // (These come from our src/config/app.config.ts factory)
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;
  const nodeEnv = configService.get<string>('nodeEnv') ?? 'development';

  // ---- Global API Prefix ----
  // All routes will be prefixed with /api
  // Example: GET /users becomes GET /api/users
  app.setGlobalPrefix('api');

  // ---- CORS (Cross-Origin Resource Sharing) ----
  // Allows the API to be called from different domains
  // In production, replace '*' with your specific frontend URL
  app.enableCors({
    origin: nodeEnv === 'production' ? process.env.FRONTEND_URL : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ---- Global Validation Pipe ----
  // Automatically validates incoming request bodies using class-validator decorators
  // Example: if a DTO has @IsEmail() on the email field, invalid emails are rejected
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Strip properties NOT in the DTO (prevents unwanted fields)
      forbidNonWhitelisted: true, // Throw error if extra properties are sent
      transform: true,       // Auto-convert strings to numbers/booleans based on DTO types
      transformOptions: {
        enableImplicitConversion: true, // Convert query params to their TS types automatically
      },
    }),
  );

  // ---- Global Exception Filter ----
  // Catches ALL HttpExceptions and formats them consistently
  // Defined in: src/common/filters/http-exception.filter.ts
  app.useGlobalFilters(new HttpExceptionFilter());

  // ---- Global Response Interceptor ----
  // Wraps ALL successful responses in: { success: true, data: ..., timestamp: ... }
  // Defined in: src/common/interceptors/response-transform.interceptor.ts
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // ---- Start the Server ----
  await app.listen(port);

  logger.log(`🚀 Application is running in [${nodeEnv}] mode`);
  logger.log(`📡 API is available at: http://localhost:${port}/api`);
}

// Call the bootstrap function to start everything
bootstrap();

