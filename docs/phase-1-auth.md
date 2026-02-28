# Phase 1 — Authentication & Project Foundation

## What Was Built in This Phase

| Area | Status | Details |
|------|--------|---------|
| Project initialization | ✅ | NestJS + TypeScript scaffolded |
| Environment configuration | ✅ | `.env`, `.env.example`, typed `app.config.ts` |
| Prisma setup | ✅ | Schema with 5 models, migrations-ready |
| PostgreSQL connection | ✅ | PrismaService with connection pooling via `@prisma/adapter-pg` |
| Global ValidationPipe | ✅ | Auto-validates all request bodies |
| Global exception filter | ✅ | Consistent error response format |
| Global response interceptor | ✅ | Wraps all responses in `{ success, data, timestamp }` |
| Users module | ✅ | GET `/api/users/me`, PATCH `/api/users/me` |
| Auth module | ✅ | POST `/api/auth/register`, POST `/api/auth/login` |
| JWT access tokens | ✅ | Signed with `JWT_SECRET`, expire after `JWT_EXPIRES_IN` |
| Password hashing | ✅ | bcrypt with 10 salt rounds |
| JWT Guard | ✅ | `@UseGuards(JwtAuthGuard)` for protected routes |

---

## API Endpoints

### Authentication

#### `POST /api/auth/register`
Creates a new user account and returns a JWT token.

**Request body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Success response (201 Created):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2026-02-28T10:00:00.000Z",
      "updatedAt": "2026-02-28T10:00:00.000Z"
    }
  },
  "timestamp": "2026-02-28T10:00:00.000Z"
}
```

**Error — duplicate email (409 Conflict):**
```json
{
  "statusCode": 409,
  "message": "A user with this email already exists",
  "error": "ConflictException",
  "timestamp": "2026-02-28T10:00:00.000Z",
  "path": "/api/auth/register"
}
```

---

#### `POST /api/auth/login`
Authenticates a user with email and password.

**Request body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Success response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  },
  "timestamp": "2026-02-28T10:00:00.000Z"
}
```

**Error — invalid credentials (401 Unauthorized):**
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "UnauthorizedException",
  "timestamp": "2026-02-28T10:00:00.000Z",
  "path": "/api/auth/login"
}
```

---

### Users (Protected — requires JWT)

#### `GET /api/users/me`
Returns the authenticated user's profile.

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Success response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2026-02-28T10:00:00.000Z",
    "updatedAt": "2026-02-28T10:00:00.000Z"
  },
  "timestamp": "2026-02-28T10:00:00.000Z"
}
```

---

#### `PATCH /api/users/me`
Updates the authenticated user's profile. All fields are optional.

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Request body (any field is optional):**
```json
{
  "firstName": "Jane"
}
```

---

## Part 1: How Dependency Injection Works in NestJS

Dependency Injection (DI) is one of the most important concepts in NestJS. If you don't understand it, the whole framework feels like magic. Let's demystify it.

### The Problem Without DI

In plain JavaScript/TypeScript, you'd do this:

```typescript
// ❌ Without DI — manual instantiation
class AuthService {
  private usersService: UsersService;
  private jwtService: JwtService;

  constructor() {
    this.usersService = new UsersService(); // ← are you creating UsersService correctly?
    this.jwtService = new JwtService();    // ← does JwtService need options?
  }
}
```

Problems:
- You have to know HOW to construct every dependency
- If `UsersService` changes its constructor, you update `AuthService`, `SomeOtherService`, and everywhere else it's created
- Testing is hard — you can't easily swap real services for mocks

### The Solution: Dependency Injection

In NestJS, you declare what you NEED and NestJS provides it:

```typescript
// ✅ With DI — NestJS provides dependencies
@Injectable()
class AuthService {
  constructor(
    private usersService: UsersService,  // "I need UsersService"
    private jwtService: JwtService,      // "I need JwtService"
  ) {
    // NestJS automatically creates and injects these
    // You never call `new UsersService()` yourself
  }
}
```

### The NestJS DI Container

NestJS maintains a **container** — think of it as a registry that maps class types to instances.

```
┌─────────────────────────────────────────────┐
│            NestJS DI Container               │
│                                              │
│  PrismaService   → [single instance]        │
│  UsersService    → [single instance]        │
│  AuthService     → [single instance]        │
│  JwtService      → [single instance]        │
│  ConfigService   → [single instance]        │
└─────────────────────────────────────────────┘
```

When the app starts, NestJS:

1. Reads each `@Module({ providers: [...] })` declaration
2. Looks at each class's constructor parameters
3. Resolves any dependencies in the right order
4. Creates instances and passes them in

### Three Things `constructor(private readonly usersService: UsersService)` Does

```typescript
constructor(private readonly usersService: UsersService) {}
//          [1]     [2]       [3]         [4]
```

| # | Part | Meaning |
|---|------|---------|
| 1 | `private` | Makes it a class property: `this.usersService` |
| 2 | `readonly` | Cannot be reassigned after construction |
| 3 | `usersService` | The property name |
| 4 | `UsersService` | The TYPE — NestJS uses this to look up the instance in the container |

### The Module Wiring

For injection to work, modules must properly declare and export providers:

```
AuthModule imports UsersModule
    │
    │  UsersModule { exports: [UsersService] }
    │       ↓
    └──► UsersService is now available inside AuthModule
              │
              ▼
         AuthService can inject UsersService ✓
         JwtStrategy can inject UsersService ✓
```

```typescript
// UsersModule — exports UsersService for other modules to use
@Module({
  providers: [UsersService],
  exports: [UsersService],   // ← This is what makes it injectable in AuthModule
})
export class UsersModule {}

// AuthModule — imports UsersModule to access UsersService
@Module({
  imports: [UsersModule],    // ← This unlocks UsersService for injection
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

If you forget `exports` or `imports`, NestJS throws:
```
Nest can't resolve dependencies of the AuthService (?). 
Please make sure that the "UsersService" argument at index [0] is available in the AuthModule context.
```

### Singleton Pattern

By default, every NestJS provider is a **singleton** — one instance shared across the entire application.

```
Request 1 → AuthService.login() → uses the SAME UsersService instance
Request 2 → AuthService.login() → uses the SAME UsersService instance
```

This is efficient and correct for services that don't store per-request state. Services should be **stateless** — all data comes in as parameters and goes out as return values.

---

## Part 2: Request Flow — Controller → Service → Database

Every HTTP request goes through the same pipeline. Let's trace it completely.

### Full Flow: `POST /api/auth/register`

```
───────────────────────────────────────────────────────────────────
CLIENT
───────────────────────────────────────────────────────────────────
POST /api/auth/register
Headers: Content-Type: application/json
Body: { "email": "john@example.com", "password": "MyPass123", 
        "firstName": "John", "lastName": "Doe" }

───────────────────────────────────────────────────────────────────
STEP 1: NestJS HTTP Server (Express under the hood)
───────────────────────────────────────────────────────────────────
• Receives the TCP connection
• Parses HTTP headers and body
• Routes the request to the matching controller

───────────────────────────────────────────────────────────────────
STEP 2: CORS Middleware (configured in main.ts)
───────────────────────────────────────────────────────────────────
• Checks if the request origin is allowed
• Adds CORS headers to the response
• Passes through (no auth needed for register)

───────────────────────────────────────────────────────────────────
STEP 3: Global ValidationPipe (configured in main.ts)
───────────────────────────────────────────────────────────────────
• Sees @Body() dto: RegisterDto on the controller method
• Transforms raw JSON → RegisterDto class instance
• Runs class-validator checks:
    ✅ email: "john@example.com"  → @IsEmail() passes
    ✅ password: "MyPass123"      → @MinLength(8) passes
    ✅ firstName: "John"          → @IsNotEmpty() passes
    ✅ lastName: "Doe"            → @IsNotEmpty() passes
• If ANY check fails → stops here, returns 400 Bad Request
• If all pass → calls the controller method ↓

───────────────────────────────────────────────────────────────────
STEP 4: AuthController.register(dto: RegisterDto)
           src/modules/auth/auth.controller.ts
───────────────────────────────────────────────────────────────────
• NestJS matches route: POST /api/auth/register
• Calls register(dto) where dto is the validated RegisterDto
• AuthController has NO business logic — it just delegates:

  return this.authService.register(dto);   ← delegates to service

───────────────────────────────────────────────────────────────────
STEP 5: AuthService.register(dto: RegisterDto)
           src/modules/auth/auth.service.ts
───────────────────────────────────────────────────────────────────
• Delegates user creation to UsersService:
  const user = await this.usersService.create(dto);

───────────────────────────────────────────────────────────────────
STEP 6: UsersService.create(dto: CreateUserDto)
           src/modules/users/users.service.ts
───────────────────────────────────────────────────────────────────
• Checks email uniqueness:
  await this.prisma.user.findUnique({ where: { email: dto.email } })
  → If found: throw new ConflictException('Email already exists') → 409

• Hashes the password:
  const hashedPassword = await bcrypt.hash(dto.password, 10)
  → "MyPass123" becomes "$2b$10$randomsalt...hashedvalue"

• Inserts new user into DB:
  await this.prisma.user.create({ data: {...}, select: userSelect })

───────────────────────────────────────────────────────────────────
STEP 7: Prisma ORM → PostgreSQL
           src/prisma/prisma.service.ts
───────────────────────────────────────────────────────────────────
• Prisma translates the create() call to SQL:

  INSERT INTO users (id, email, password, first_name, last_name, 
                     created_at, updated_at)
  VALUES ('uuid-here', 'john@example.com', '$2b$10$...hash',
          'John', 'Doe', NOW(), NOW())
  RETURNING id, email, first_name, last_name, created_at, updated_at;
  -- Note: password is NOT in RETURNING (userSelect excludes it)

• PostgreSQL executes the SQL and returns the new row
• Prisma converts the row into a TypeScript object
• Returns SafeUser (no password field)

───────────────────────────────────────────────────────────────────
STEP 8: Back in AuthService.register()
───────────────────────────────────────────────────────────────────
• user = the SafeUser object from Prisma
• Generates JWT token:
  const accessToken = await this.jwtService.signAsync({
    sub: user.id,
    email: user.email,
  });
  → Produces: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1dWlkIiwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIn0.signature"

• Returns: { accessToken, user }

───────────────────────────────────────────────────────────────────
STEP 9: ResponseTransformInterceptor (global, main.ts)
───────────────────────────────────────────────────────────────────
• Receives the return value: { accessToken, user }
• Wraps it:
  {
    "success": true,
    "data": { "accessToken": "...", "user": { ... } },
    "timestamp": "2026-02-28T10:00:00.000Z"
  }

───────────────────────────────────────────────────────────────────
CLIENT RECEIVES: 201 Created
───────────────────────────────────────────────────────────────────
```

---

### Full Flow: `GET /api/users/me` (Protected Route)

This shows how JWT authentication works end-to-end:

```
───────────────────────────────────────────────────────────────────
CLIENT
───────────────────────────────────────────────────────────────────
GET /api/users/me
Headers: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

───────────────────────────────────────────────────────────────────
STEP 1: JwtAuthGuard (on the controller method)
          src/common/guards/jwt-auth.guard.ts
───────────────────────────────────────────────────────────────────
• NestJS sees @UseGuards(JwtAuthGuard) before calling the controller
• JwtAuthGuard extends AuthGuard('jwt') → triggers JwtStrategy

───────────────────────────────────────────────────────────────────
STEP 2: Passport extracts the token
───────────────────────────────────────────────────────────────────
• ExtractJwt.fromAuthHeaderAsBearerToken() looks at:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ↑ prefix         ↑ the token

• If header is missing or not "Bearer ..." → 401 Unauthorized

───────────────────────────────────────────────────────────────────
STEP 3: Passport verifies the token (automatically)
───────────────────────────────────────────────────────────────────
• Uses JWT_SECRET (from our JwtModule config) to verify signature
• Checks if token is expired
• If invalid/expired → 401 Unauthorized
• If valid → decodes the payload:
  { sub: "user-uuid-here", email: "john@example.com", iat: ..., exp: ... }

───────────────────────────────────────────────────────────────────
STEP 4: JwtStrategy.validate(payload)
           src/modules/auth/strategies/jwt.strategy.ts
───────────────────────────────────────────────────────────────────
• Called with the decoded payload
• Fetches the user from the database:
  await this.usersService.findById(payload.sub)
• If user not found → throws UnauthorizedException
• Returns the SafeUser object

───────────────────────────────────────────────────────────────────
STEP 5: Passport attaches user to request
───────────────────────────────────────────────────────────────────
• request.user = the SafeUser returned by validate()

───────────────────────────────────────────────────────────────────
STEP 6: UsersController.getProfile() runs
───────────────────────────────────────────────────────────────────
• @CurrentUser() reads from request.user (set in step 5)
• Returns the user object

───────────────────────────────────────────────────────────────────
CLIENT RECEIVES: 200 OK with user profile
───────────────────────────────────────────────────────────────────
```

---

## Part 3: File-by-File Guide

### `src/modules/auth/dto/register.dto.ts`

```typescript
export class RegisterDto extends CreateUserDto {}
```

**What it does:** Defines what a valid register request body looks like.

**Key concept:** `RegisterDto` extends `CreateUserDto` — they're the same shape but named differently. This is intentional so the code is self-documenting ("registering" vs "creating a user internally").

**Validation happens here, not in the service.** If an invalid body is sent (e.g., email without @), the `ValidationPipe` rejects it with a 400 before the service is ever called.

---

### `src/modules/auth/dto/login.dto.ts`

```typescript
export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
```

**Why no `@MinLength` on password?** Because we're verifying an existing password, not creating one. We don't want to reject a valid existing password (e.g., if someone registered before we added the rule), and we don't want to leak information about password requirements to potential attackers.

---

### `src/modules/auth/strategies/jwt.strategy.ts`

This is the bridge between Passport.js and NestJS.

```
Passport receives token
       ↓
JwtStrategy.validate(decoded_payload)
       ↓
Returns user → becomes request.user
```

**Why do we fetch the user from DB in validate()?**

The JWT token contains `{ sub: userId, email }`. We could just trust that payload and return it as the current user. But:

1. The user might have been deleted after the token was issued
2. The user's email might have changed
3. We want the latest data (createdAt, updatedAt, etc.)

By fetching from DB, we always have fresh, accurate user data.

---

### `src/modules/users/users.service.ts` — `userSelect` constant

```typescript
export const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  createdAt: true,
  updatedAt: true,
  // password is NOT in this list
} as const;
```

**Why does this exist?**

Prisma fetches ALL columns by default. If we do `prisma.user.findUnique({ where: { id } })`, we get back the password hash too. By specifying `select: userSelect`, Prisma tells PostgreSQL to only return those specific columns.

This is more secure than fetching the password and then deleting it — the password never even leaves the database engine.

---

### `src/modules/auth/auth.service.ts` — `generateToken()`

```typescript
private async generateToken(user: SafeUser): Promise<string> {
  const payload = {
    sub: user.id,       // Standard JWT "subject" claim
    email: user.email,
  };
  return this.jwtService.signAsync(payload);
}
```

**Why is it `private`?** 

Only `register()` and `login()` need to generate tokens. Making it private prevents calling it accidentally from elsewhere. It's a helper method, not a public API.

**Why use `signAsync()` instead of `sign()`?**

`signAsync()` is the async version. Since it handles crypto operations, the async version avoids blocking the Node.js event loop (which would hurt performance under high load).

---

## Part 4: Security Decisions

### Why bcrypt with 10 rounds?

```typescript
const hashedPassword = await bcrypt.hash(dto.password, 10);
```

bcrypt is a password hashing algorithm designed to be **deliberately slow**. 10 rounds means it runs the hashing function $2^{10} = 1024$ times. On a modern server:

| Rounds | Time per hash | Security |
|--------|--------------|----------|
| 10 | ~100ms | ✅ Good balance |
| 12 | ~400ms | Better, but slower UX |
| 14 | ~1600ms | Very slow for login |

100ms is slow for an attacker trying millions of passwords, but invisible to a user logging in once.

### Why "Invalid credentials" instead of specific errors?

```typescript
if (!userWithPassword) {
  throw new UnauthorizedException('Invalid credentials'); // Not "Email not found"
}
if (!isPasswordValid) {
  throw new UnauthorizedException('Invalid credentials'); // Not "Wrong password"
}
```

If we returned different errors:
- "Email not found" → attacker knows which emails are NOT in the system
- "Wrong password" → attacker knows the email IS valid, and just needs to crack the password

**User enumeration attacks** use login endpoints to harvest valid email addresses for spam, phishing, or targeted attacks. The vague "Invalid credentials" response prevents this.

### Why UUID instead of auto-increment IDs?

```typescript
id String @id @default(uuid())
// "550e8400-e29b-41d4-a716-446655440000"
// vs 1, 2, 3...
```

- Sequential IDs expose business data: if your user ID is 200, you know there are ~200 users
- Sequential IDs are enumerable: an attacker can try `/users/1`, `/users/2`, `/users/3`...
- UUIDs are random and unguessable

### Why never return `password` in responses?

Even though it's a hash, you should never return it:
1. It confirms to attackers that the field exists
2. Even hashes can be cracked offline if leaked
3. It's unnecessary data

We use `userSelect` (an explicit allowlist) to ensure the password column is never fetched when building response objects.

---

## Part 5: How to Test the API

Once you have PostgreSQL running and migration applied:

```bash
# Run the database migration to create tables
npx prisma migrate dev --name init

# Start the development server
npm run start:dev
```

### Step 1: Register a new user

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Step 2: Copy the `accessToken` from the response

### Step 3: Use the token to access a protected route

```bash
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Step 4: Login with the same credentials

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123"
  }'
```

---

## File Map — Phase 1

```
src/
├── app.module.ts                              ← Root module, imports Auth + Users
├── main.ts                                    ← Bootstrap, global config
├── config/
│   └── app.config.ts                          ← Typed env config factory
├── prisma/
│   ├── prisma.service.ts                      ← DB connection (pg.Pool + PrismaPg adapter)
│   └── prisma.module.ts                       ← Global module, exports PrismaService
├── common/
│   ├── decorators/
│   │   └── current-user.decorator.ts          ← @CurrentUser() — reads request.user
│   ├── filters/
│   │   └── http-exception.filter.ts           ← Standardizes error responses
│   ├── guards/
│   │   └── jwt-auth.guard.ts                  ← @UseGuards(JwtAuthGuard) — verify JWT
│   └── interceptors/
│       └── response-transform.interceptor.ts  ← Wraps responses in {success, data, ts}
└── modules/
    ├── users/
    │   ├── users.module.ts                    ← Wires controller + service, exports service
    │   ├── users.controller.ts                ← GET/PATCH /api/users/me
    │   ├── users.service.ts                   ← Business logic: create, findById, update
    │   └── dto/
    │       ├── create-user.dto.ts             ← Validates register body fields
    │       └── update-user.dto.ts             ← All fields optional (PartialType)
    └── auth/
        ├── auth.module.ts                     ← Configures JwtModule, PassportModule
        ├── auth.controller.ts                 ← POST /api/auth/register, /login
        ├── auth.service.ts                    ← register(), login(), generateToken()
        ├── strategies/
        │   └── jwt.strategy.ts                ← Validates JWT, loads user into request
        └── dto/
            ├── register.dto.ts                ← Extends CreateUserDto
            └── login.dto.ts                   ← { email, password }
```

---

## Common Mistakes & How We Prevent Them

| Mistake | How We Handle It |
|---------|-----------------|
| Storing plain text passwords | bcrypt.hash() — irreversible hash |
| Returning password in response | `userSelect` constant excludes it |
| Exposing whether email exists | Same "Invalid credentials" for both errors |
| Sequential/guessable IDs | UUID v4 for all primary keys |
| Hardcoded JWT secret | Read from `JWT_SECRET` env variable |
| No input validation | GlobalValidationPipe + class-validator DTOs |
| Inconsistent error format | GlobalHttpExceptionFilter |
| Inconsistent response format | GlobalResponseTransformInterceptor |
| Unhandled expired tokens | `ignoreExpiration: false` in JwtStrategy |
