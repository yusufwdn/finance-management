# Request Flow

This document explains **exactly what happens** when an HTTP request hits our API, step by step. Understanding this flow is essential for debugging and building new features.

---

## The Complete Request Lifecycle

```
Client (Browser/Postman/Mobile App)
          │
          │  HTTP Request
          │  POST /api/transactions
          │  Headers: Authorization: Bearer <jwt_token>
          │  Body: { "amount": 50.00, "type": "EXPENSE", ... }
          ▼
┌─────────────────────────────────┐
│          NestJS HTTP Server      │
│  (Express.js under the hood)     │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│    1. MIDDLEWARE LAYER           │
│                                  │
│  • CORS check: Is this origin    │
│    allowed to make requests?     │
│  • Body parsing: JSON → object   │
│    (Express's json() middleware) │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│    2. GUARDS                     │
│                                  │
│  • JwtAuthGuard checks:          │
│    - Is Authorization header set?│
│    - Is the JWT token valid?     │
│    - Is the token expired?       │
│                                  │
│  ✅ Valid  → Continue            │
│  ❌ Invalid → 401 Unauthorized   │
│             (stops here)         │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│    3. INTERCEPTORS (Before)      │
│                                  │
│  • ResponseTransformInterceptor  │
│    wraps around the handler      │
│    (sets up the "envelope" that  │
│    will wrap the final response) │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│    4. PIPES (Validation)         │
│                                  │
│  • ValidationPipe runs           │
│  • Transforms raw request body   │
│    into a typed DTO class        │
│  • class-validator checks all    │
│    decorators (@IsNumber,        │
│    @IsEnum, @IsDate, etc.)       │
│                                  │
│  ✅ Valid  → DTO object created  │
│  ❌ Invalid → 400 Bad Request    │
│    with list of validation errors│
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│    5. CONTROLLER                 │
│                                  │
│  • Route matched:                │
│    @Post() createTransaction()   │
│  • @CurrentUser() extracts user  │
│    from request (set by guard)   │
│  • Calls service method          │
│  • Returns the result            │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│    6. SERVICE (Business Logic)   │
│                                  │
│  • Validates business rules:     │
│    - Does account belong to user?│
│    - Does category exist?        │
│  • Calls Prisma to write to DB   │
│  • Updates account balance       │
│  • Returns result to controller  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│    7. PRISMA (Data Access)       │
│                                  │
│  prisma.transaction.create({})   │
│  • Builds type-safe SQL query    │
│  • Sends to PostgreSQL           │
│  • Returns typed result          │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│    8. PostgreSQL Database        │
│                                  │
│  • Executes INSERT SQL           │
│  • Enforces constraints          │
│  • Returns new row data          │
└────────────────┬────────────────┘
                 │
         (Response travels back UP)
                 │
                 ▼
┌─────────────────────────────────┐
│    9. INTERCEPTORS (After)       │
│                                  │
│  • ResponseTransformInterceptor  │
│    wraps the returned data:      │
│    {                             │
│      "success": true,            │
│      "data": { ...transaction }, │
│      "timestamp": "2026-02-28"   │
│    }                             │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│   10. HTTP Response Sent         │
│                                  │
│  Status: 201 Created             │
│  Body: { "success": true, ... }  │
└─────────────────────────────────┘
```

---

## What Happens When Things Go Wrong

### Error Flow (Exception Path)

```
Service throws: throw new NotFoundException('Account not found')
                     │
                     ▼
           HttpExceptionFilter catches it
                     │
                     ▼
           Formats standardized error:
           {
             "statusCode": 404,
             "message": "Account not found",
             "error": "NotFoundException",
             "timestamp": "2026-02-28T10:00:00Z",
             "path": "/api/transactions"
           }
                     │
                     ▼
           Sent back to client with HTTP 404 status
```

### Validation Error Flow

```
Client sends: POST /api/transactions
Body: { "amount": "not-a-number" }  ← Invalid!
                     │
                     ▼
           ValidationPipe rejects it BEFORE reaching controller
                     │
                     ▼
           Returns 400 Bad Request:
           {
             "statusCode": 400,
             "message": ["amount must be a number"],
             "error": "Bad Request",
             ...
           }
```

---

## Request Flow Summary Table

| Step | Layer | File | Responsibility |
|------|-------|------|----------------|
| 1 | Middleware | (Express built-in) | Parse JSON body, apply CORS |
| 2 | Guard | `guards/jwt-auth.guard.ts` | Verify JWT token |
| 3 | Interceptor (before) | `interceptors/response-transform.interceptor.ts` | Set up response wrapper |
| 4 | Pipe | `main.ts` (global ValidationPipe) | Validate and transform request body |
| 5 | Controller | `modules/*/controller.ts` | Route to correct handler method |
| 6 | Service | `modules/*/service.ts` | Business logic |
| 7 | Prisma | `prisma/prisma.service.ts` | Database query |
| 8 | Database | PostgreSQL | Store/retrieve data |
| 9 | Interceptor (after) | `interceptors/response-transform.interceptor.ts` | Wrap response in envelope |
| 10 | Filter (on error) | `filters/http-exception.filter.ts` | Format errors consistently |

---

## Code Trace Example

Here's how the code looks for each step for a `GET /api/users/me` request:

```typescript
// Step 2 — Guard (verifies JWT)
@UseGuards(JwtAuthGuard)

// Step 5 — Controller
@Get('me')
getProfile(@CurrentUser() user: User) {
  return this.usersService.findById(user.id); // calls step 6
}

// Step 6 — Service
async findById(id: string): Promise<User> {
  const user = await this.prisma.user.findUnique({ // calls step 7
    where: { id },
  });
  if (!user) throw new NotFoundException('User not found'); // triggers error flow
  return user;
}
```
