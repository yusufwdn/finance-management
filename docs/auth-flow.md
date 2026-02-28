# Authentication Flow

This document explains **how JWT authentication works** in this API — from user registration to accessing protected routes.

---

## Overview

We use **JWT (JSON Web Token)** authentication. This is the most common approach for REST APIs today.

> **Key Concept:** After a user logs in, they receive a **token**. They must include this token in every subsequent request to prove who they are. The server never stores session data — the token itself contains all needed information.

---

## Part 1: Registration Flow

```
Client sends:
POST /api/auth/register
{
  "email": "john@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
          │
          ▼
┌─────────────────────────────────────┐
│  1. AuthController.register()       │
│     Receives CreateUserDto          │
│     Validates input (ValidationPipe)│
└────────────────┬────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│  2. AuthService.register()           │
│                                      │
│  a) Check if email already exists:   │
│     prisma.user.findUnique(email)    │
│     → If exists: throw               │
│       ConflictException(409)         │
│                                      │
│  b) Hash the password:               │
│     bcrypt.hash(password, 10)        │
│     → "SecurePass123!" becomes       │
│       "$2b$10$xyz..." (irreversible) │
│                                      │
│  c) Create user in database:         │
│     prisma.user.create({             │
│       email,                         │
│       password: hashedPassword,      │
│       firstName,                     │
│       lastName                       │
│     })                               │
│                                      │
│  d) Generate JWT token               │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│  3. JwtService.sign(payload)         │
│                                      │
│  Payload (data inside token):        │
│  {                                   │
│    "sub": "user-uuid",               │
│    "email": "john@example.com"       │
│  }                                   │
│                                      │
│  Signs with JWT_SECRET from .env     │
│  Sets expiry to JWT_EXPIRES_IN       │
└────────────────┬─────────────────────┘
                 │
                 ▼
Client receives:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR...",
    "user": { "id": "...", "email": "...", "firstName": "..." }
  }
}
```

---

## Part 2: Login Flow

```
Client sends:
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
          │
          ▼
┌──────────────────────────────────────┐
│  1. AuthController.login()           │
│     Validates input                  │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│  2. AuthService.login()              │
│                                      │
│  a) Find user by email:              │
│     prisma.user.findUnique(email)    │
│     → Not found: throw               │
│       UnauthorizedException(401)     │
│     (We say "Invalid credentials"    │
│      NOT "Email not found" —         │
│      this prevents user enumeration) │
│                                      │
│  b) Compare password:                │
│     bcrypt.compare(                  │
│       "SecurePass123!",              │
│       "$2b$10$xyz..."  ← from DB     │
│     )                                │
│     → Mismatch: throw                │
│       UnauthorizedException(401)     │
│                                      │
│  c) Generate and return JWT token    │
└────────────────┬─────────────────────┘
                 │
                 ▼
Client receives:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR...",
    "user": { "id": "...", "email": "...", "firstName": "..." }
  }
}
```

---

## Part 3: Accessing a Protected Route

```
Client sends:
GET /api/accounts
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR...
                                  │
                                  ▼
┌──────────────────────────────────────────────────┐
│  1. JwtAuthGuard intercepts the request          │
│                                                  │
│  It extracts the token from the header:          │
│  "Bearer eyJhbGciOiJIUzI1NiIsInR..."             │
│       ↑ prefix    ↑ the actual token             │
└─────────────────────┬────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────┐
│  2. Passport JWT Strategy validates token         │
│                                                   │
│  a) Verify signature using JWT_SECRET             │
│     → If tampered with: 401 Unauthorized          │
│                                                   │
│  b) Check expiry                                  │
│     → If expired: 401 Unauthorized                │
│                                                   │
│  c) Extract payload from token:                   │
│     { sub: "user-uuid", email: "john@..." }       │
└─────────────────────┬─────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────┐
│  3. JwtStrategy.validate() is called              │
│                                                   │
│  Fetches full user from database:                 │
│  prisma.user.findUnique({ where: { id: sub } })   │
│                                                   │
│  Returns user object                              │
│  → NestJS attaches it to request.user             │
└─────────────────────┬─────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────┐
│  4. Request proceeds to Controller                │
│                                                   │
│  @Get()                                           │
│  @UseGuards(JwtAuthGuard)                         │
│  getAccounts(@CurrentUser() user: User) {         │
│    // user is now available here!                 │
│    return this.accountsService.findAll(user.id);  │
│  }                                                │
└───────────────────────────────────────────────────┘
```

---

## Understanding JWT Token Structure

A JWT token has 3 parts separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLXV1aWQiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJpYXQiOjE3MDk1MTM2MDAsImV4cCI6MTcxMDExODQwMH0.SomeSignatureHash
│                                       │                                                                                                                                    │
│                                       │                                                                                                                                    │
▼                                       ▼                                                                                                                                    ▼
HEADER (Base64)                         PAYLOAD (Base64)                                                                                                        SIGNATURE
{                                       {
  "alg": "HS256",                         "sub": "user-uuid",
  "typ": "JWT"                            "email": "john@example.com",
}                                         "iat": 1709513600,   ← issued at
                                          "exp": 1710118400    ← expires at
                                        }
```

> ⚠️ **Important**: The payload is **base64 encoded, NOT encrypted**. Anyone can decode and read it. Never put sensitive data (passwords, credit cards) in a JWT payload. The **signature** ensures it hasn't been tampered with.

---

## Security Best Practices We Follow

| Practice | Why |
|---------|-----|
| **Hash passwords with bcrypt** | If DB is leaked, passwords are unreadable. `cost=10` means ~100ms per hash — slow enough to resist brute force |
| **Use UUID for user IDs** | Sequential IDs (1, 2, 3) are guessable. UUIDs are random |
| **Return "Invalid credentials"** | Not "Email not found" or "Wrong password" — prevents attackers from knowing if an email exists |
| **Expire tokens (7d)** | If a token is stolen, it stops working after 7 days |
| **Store JWT_SECRET in .env** | Never hardcode secrets in source code |
| **Strip password from responses** | Never return `user.password` in API responses |

---

## Files Involved in Authentication

| File | Phase | Purpose |
|------|-------|---------|
| `src/modules/auth/auth.module.ts` | Phase 3 | Wires JWT, Passport, AuthService |
| `src/modules/auth/auth.controller.ts` | Phase 3 | POST /auth/register, POST /auth/login |
| `src/modules/auth/auth.service.ts` | Phase 3 | Registration, login business logic |
| `src/modules/auth/strategies/jwt.strategy.ts` | Phase 3 | Validates JWT, fetches user |
| `src/common/guards/jwt-auth.guard.ts` | Phase 3 | Protects routes |
| `src/common/decorators/current-user.decorator.ts` | Phase 1 ✅ | Extracts user from request |
