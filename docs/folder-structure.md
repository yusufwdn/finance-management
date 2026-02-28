# Folder Structure

Complete breakdown of every folder and file in this project with explanations of what each one does and **why** it exists.

---

## Root Level

```
finance-management/
├── src/                    ← All application source code lives here
├── prisma/                 ← Database schema and migrations
├── generated/              ← Auto-generated Prisma client (DO NOT EDIT)
├── docs/                   ← Project documentation (you are here)
├── test/                   ← End-to-end tests
├── .env                    ← Your local environment variables (git-ignored)
├── .env.example            ← Template showing what .env variables are needed
├── prisma.config.ts        ← Prisma v7 configuration file
├── nest-cli.json           ← NestJS CLI configuration
├── tsconfig.json           ← TypeScript compiler configuration
├── tsconfig.build.json     ← TypeScript config for production builds
├── package.json            ← Project dependencies and npm scripts
└── eslint.config.mjs       ← Code style/linting rules
```

---

## src/ — Application Source Code

```
src/
├── main.ts                 ← 🚀 Entry point — starts the HTTP server
├── app.module.ts           ← 🌳 Root module — imports all other modules
│
├── config/
│   └── app.config.ts       ← Typed environment variable configuration
│
├── prisma/
│   ├── prisma.service.ts   ← Database connection service (extends PrismaClient)
│   └── prisma.module.ts    ← Makes PrismaService globally available
│
├── common/                 ← Shared utilities used across all modules
│   ├── decorators/
│   │   └── current-user.decorator.ts  ← @CurrentUser() parameter decorator
│   ├── filters/
│   │   └── http-exception.filter.ts   ← Global error response formatter
│   ├── interceptors/
│   │   └── response-transform.interceptor.ts  ← Wrap responses in standard envelope
│   ├── guards/
│   │   └── jwt-auth.guard.ts          ← @UseGuards(JwtAuthGuard) — verifies JWT tokens
│   └── pipes/              ← (Future) Custom validation pipes go here
│
└── modules/                ← Feature modules (one per domain concept)
    ├── auth/               ← ✅ Phase 1: JWT register, login, token generation
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── strategies/
    │   │   └── jwt.strategy.ts        ← Validates JWT, loads user into request
    │   └── dto/
    │       ├── register.dto.ts
    │       └── login.dto.ts
    ├── users/              ← ✅ Phase 1: User CRUD + profile endpoints
    │   ├── users.module.ts
    │   ├── users.controller.ts
    │   ├── users.service.ts
    │   └── dto/
    │       ├── create-user.dto.ts
    │       └── update-user.dto.ts
    ├── accounts/           ← Phase 2: Financial account management
    ├── transactions/       ← Phase 3: Income/expense tracking
    ├── categories/         ← Phase 4: Transaction categories
    └── budgets/            ← Phase 5: Spending limit management
```

---

## How Each Feature Module Is Structured

Every module follows the **same pattern**. Here's the completed `users` module as a reference:

```
src/modules/users/
├── users.module.ts         ← Wires controller + service together, exports UsersService
├── users.controller.ts     ← HTTP routes: GET /api/users/me, PATCH /api/users/me
├── users.service.ts        ← Business logic: create, findById, findByEmail, update
└── dto/                    ← Data Transfer Objects (request body shapes)
    ├── create-user.dto.ts  ← email, password, firstName, lastName — with validation
    └── update-user.dto.ts  ← All fields optional via PartialType(CreateUserDto)
```

The `auth` module adds a `strategies/` folder for Passport strategies:

```
src/modules/auth/
├── auth.module.ts          ← Configures JwtModule + PassportModule
├── auth.controller.ts      ← POST /api/auth/register, POST /api/auth/login
├── auth.service.ts         ← register(), login(), generateToken()
├── strategies/
│   └── jwt.strategy.ts     ← Validates Bearer token, loads user into request
└── dto/
    ├── register.dto.ts     ← Extends CreateUserDto
    └── login.dto.ts        ← { email, password }
```

### What is a DTO?
DTO = **Data Transfer Object**. It defines the **shape and validation rules** for incoming request data.

```typescript
// Example: create-user.dto.ts
export class CreateUserDto {
  @IsEmail()           // ← class-validator decorator: must be valid email
  email: string;

  @MinLength(8)        // ← Password must be at least 8 characters
  password: string;

  @IsString()
  firstName: string;
}
```
When a request comes in with bad data (e.g., `email: "not-an-email"`), NestJS's `ValidationPipe` automatically rejects it with a `400 Bad Request` error — before it ever reaches your service.

---

## prisma/ — Database Schema

```
prisma/
├── schema.prisma           ← Database table definitions (source of truth)
└── migrations/             ← SQL migration history (auto-generated, commit to git)
    └── 20260228_init/
        └── migration.sql   ← The actual SQL that was run
```

### What is a Migration?
Every time you change `schema.prisma` and run `npx prisma migrate dev`, Prisma:
1. Creates a new SQL file in `prisma/migrations/`
2. Applies it to your database
3. Tracks which migrations have been run

This ensures your **code and database always stay in sync**, and your team members can replay the same changes.

---

## generated/ — Auto-Generated Prisma Client

```
generated/
└── prisma/                 ← NEVER edit these files manually
    ├── index.ts            ← Main Prisma client export
    ├── schema.prisma       ← Copy of your schema
    └── ...                 ← Type definitions for all your models
```

These files are **regenerated** every time you run `npx prisma generate`. They give you full TypeScript types for your database models.

> ⚠️ This folder is in `.gitignore` — each developer generates it locally.

---

## docs/ — Documentation

```
docs/
├── README.md               ← Index and quick start
├── architecture.md         ← Why NestJS, Prisma, PostgreSQL, JWT
├── folder-structure.md     ← This document
├── request-flow.md         ← Request lifecycle from HTTP to DB and back
├── auth-flow.md            ← How JWT authentication works step by step
├── database-relationships.md ← Entity diagrams and relationship explanations
└── phase-1-auth.md         ← ✅ Phase 1 complete reference (DI, request flow, security)
```

---

## Key Configuration Files

### tsconfig.json
Controls how TypeScript compiles your code. Important settings:
- `"experimentalDecorators": true` — Required for NestJS decorators (`@Module`, `@Injectable`, etc.)
- `"emitDecoratorMetadata": true` — Required for Dependency Injection to work
- `"strict": true` — Enables strict type checking (catches more bugs)

### nest-cli.json
Tells the NestJS CLI where source files are and how to build the project.

### package.json Scripts

| Script | Command | What it does |
|--------|---------|-------------|
| `start` | `nest start` | Start production server |
| `start:dev` | `nest start --watch` | Start with hot-reload (dev mode) |
| `start:debug` | `nest start --debug --watch` | Start with debugger |
| `build` | `nest build` | Compile TypeScript to JavaScript |
| `test` | `jest` | Run unit tests |
| `test:e2e` | `jest --config test/jest-e2e.json` | Run end-to-end tests |
