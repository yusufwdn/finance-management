// ============================================================
// HTTP EXCEPTION FILTER
// ============================================================
// What:  A global error handler that catches ALL HttpExceptions
//        thrown anywhere in the application and formats them
//        into a consistent JSON response.
//
// Why:   Without this, different errors would return different
//        response shapes, making the API unpredictable for
//        frontend developers and API consumers.
//        With this filter, every error always looks like:
//          {
//            "statusCode": 404,
//            "message": "User not found",
//            "error": "Not Found",
//            "timestamp": "2026-02-28T10:00:00.000Z",
//            "path": "/api/users/123"
//          }
//
// How:   We use @Catch(HttpException) to listen for that specific
//        exception type. NestJS calls catch() automatically.
//        We then shape the response and send it.
// ============================================================

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// @Catch(HttpException) — this filter only handles HttpExceptions
// (includes NotFoundException, UnauthorizedException, BadRequestException, etc.)
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  // Logger for printing error details to the console
  private readonly logger = new Logger(HttpExceptionFilter.name);

  // -------------------------------------------------------
  // catch
  // -------------------------------------------------------
  // What:  Called automatically by NestJS when an HttpException is thrown
  // Why:   Format the error response consistently
  // How:   Extract error details from the exception, build a standard
  //        response object, and send it with the correct HTTP status code
  // -------------------------------------------------------
  catch(exception: HttpException, host: ArgumentsHost): void {
    // Get HTTP context to access request and response objects
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Get the HTTP status code (e.g., 400, 401, 404, 500)
    const status = exception.getStatus() ?? HttpStatus.INTERNAL_SERVER_ERROR;

    // getResponse() returns either a string or an object
    // For validation errors, it returns an object with an array of messages
    const exceptionResponse = exception.getResponse();

    // Extract the human-readable message
    const message =
      typeof exceptionResponse === 'object' &&
      'message' in (exceptionResponse as object)
        ? (exceptionResponse as { message: string | string[] }).message
        : exception.message;

    // Build the standardized error response body
    const errorResponse = {
      statusCode: status,
      message,                             // The error message(s)
      error: exception.name,               // e.g., "NotFoundException"
      timestamp: new Date().toISOString(), // When the error occurred
      path: request.url,                   // Which endpoint triggered the error
    };

    // Log the error (useful for debugging)
    this.logger.error(
      `${request.method} ${request.url} → ${status}: ${JSON.stringify(message)}`,
    );

    // Send the formatted error response to the client
    response.status(status).json(errorResponse);
  }
}
