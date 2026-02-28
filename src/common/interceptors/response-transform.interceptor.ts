// ============================================================
// RESPONSE TRANSFORM INTERCEPTOR
// ============================================================
// What:  Wraps ALL successful API responses in a standard envelope.
//
// Why:   API consumers (mobile apps, frontends) expect a consistent
//        response format. Without this, some endpoints might return
//        just `{ id: 1, name: "John" }` while others return arrays.
//        With this interceptor, every successful response looks like:
//          {
//            "success": true,
//            "data": { ...your actual data... },
//            "timestamp": "2026-02-28T10:00:00.000Z"
//          }
//
// How:   NestJS interceptors use RxJS observables. We pipe the
//        response through map() to wrap it in our envelope.
//        NestJS calls this automatically for every request.
// ============================================================

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Define the shape of our standard API response
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  // -------------------------------------------------------
  // intercept
  // -------------------------------------------------------
  // What:  Called for every incoming request BEFORE and AFTER
  //        the route handler executes
  // Why:   Wrap the handler's return value in our standard shape
  // How:   We use next.handle() to get an Observable of the response,
  //        then pipe it through map() to transform the value
  // -------------------------------------------------------
  intercept(
    context: ExecutionContext,  // Info about the current request
    next: CallHandler,          // Lets us call the actual route handler
  ): Observable<ApiResponse<T>> {
    // next.handle() calls the route handler and returns an Observable
    return next.handle().pipe(
      // map() transforms the emitted value (the controller's return value)
      map((data: T) => ({
        success: true,
        data,                              // The actual response data
        timestamp: new Date().toISOString(), // When the response was sent
      })),
    );
  }
}
