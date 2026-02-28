# Architecture Decisions

## Overview

This document explains the architectural choices made for the Personal Finance Management API and **why** each decision was made. Understanding architecture helps you build scalable, maintainable systems.

---

## 1. Why NestJS?

NestJS is a **progressive Node.js framework** built on top of Express.js. Here's why it's ideal for this project:

### The Problem with plain Express.js (for beginners)
In plain Express.js, you have complete freedom — but that means **no enforced structure**:
```
// Express — everything is manual, no structure enforced
app.get('/users', async (req, res) => {
  const users = await db.query('SELECT * FROM users');
  res.json(users);
});
```
As the project grows, this becomes a mess. Files get huge, logic is scattered.

### How NestJS Solves It
NestJS enforces **separation of concerns** through a module system:
```
src/
  modules/users/
    users.controller.ts  ← Only handles HTTP (routes, request, response)
    users.service.ts     ← Only handles business logic
    users.module.ts      ← Wires everything together
```

### Key NestJS Features We Use

| Feature | What It Is | Why We Use It |
|---------|-----------|---------------|
| **Modules** | Logical units of code | Organize related features together |
| **Controllers** | Handle HTTP requests | Separation of routing from logic |
| **Services** | Business logic | Reusable, testable logic |
| **Dependency Injection** | Automatic service wiring | Loose coupling, easy testing |
| **Decorators** | `@Get()`, `@Body()`, `@Injectable()` | Clean, readable code |
| **Guards** | Protect routes | JWT authentication enforcement |
| **Pipes** | Transform/validate input | Auto-validate request bodies |
| **Interceptors** | Intercept requests/responses | Standardize API responses |
| **Filters** | Catch exceptions | Standardize error responses |

---

## 2. Why PostgreSQL?

PostgreSQL is a **relational database** — data is stored in tables with rows and columns, connected via foreign keys.

### Why Not MongoDB (NoSQL)?
For a finance app, relationships between data are critical:
- A Transaction **must** belong to an Account
- An Account **must** belong to a User
- A Budget **must** reference a Category

Relational databases enforce these rules at the database level. If you try to create a transaction for a non-existent account, PostgreSQL will **reject it**. MongoDB would silently accept bad data.

### ACID Compliance
PostgreSQL is ACID-compliant:
- **A**tomicity: All operations in a transaction succeed or all fail
- **C**onsistency: Data always remains in a valid state
- **I**solation: Concurrent transactions don't interfere
- **D**urability: Committed data survives system failures

This is essential for financial data. You never want money to "disappear" due to a failed partial update.

---

## 3. Why Prisma ORM?

ORM = Object-Relational Mapper. It lets you write **TypeScript code** instead of SQL.

### Without Prisma (raw SQL):
```typescript
// Unsafe, error-prone, no TypeScript types
const result = await db.query(
  'SELECT * FROM users WHERE email = $1',
  ['john@example.com']
);
// result has type: any — no autocompletion, no type safety
```

### With Prisma:
```typescript
// Type-safe, autocompletion, no SQL strings
const user = await prisma.user.findUnique({
  where: { email: 'john@example.com' }
});
// user has type: User | null — TypeScript knows exactly what fields exist
```

### Key Prisma Benefits

| Benefit | Description |
|---------|-------------|
| **Type safety** | Full TypeScript types for all queries |
| **Migrations** | Schema changes tracked as SQL migration files |
| **Schema as code** | Database structure defined in `prisma/schema.prisma` |
| **Relationships** | Easy eager loading with `include` |
| **Prisma Client** | Auto-generated from your schema |

---

## 4. Why JWT Authentication?

JWT = JSON Web Token. It's the industry standard for **stateless** API authentication.

### How It Works (Brief)
1. User logs in with email + password
2. Server verifies the password and creates a **signed JWT token**
3. Client stores the token and sends it with every request: `Authorization: Bearer <token>`
4. Server verifies the token signature — no database lookup needed
5. If valid, the request is allowed; if invalid/expired, it's rejected

### Why Not Sessions?
Sessions store data on the server. JWT tokens are **self-contained** (the user data is inside the token). This means:
- ✅ Stateless — scales horizontally (multiple servers)
- ✅ Works for mobile apps and SPAs
- ✅ No session store needed

---

## 5. Clean Architecture Pattern

We follow a **layered architecture**:

```
┌─────────────────────────────────────────────┐
│              HTTP Request                   │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│         Controller (Route Handler)          │
│   - Handles HTTP routes                     │
│   - Validates input (via pipes)             │
│   - Calls service methods                   │
│   - Returns HTTP response                   │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│              Service (Business Logic)       │
│   - Contains all business rules             │
│   - Calls Prisma for database operations    │
│   - Throws exceptions on errors             │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│           Prisma (Data Access Layer)        │
│   - Executes type-safe SQL queries          │
│   - Returns typed TypeScript objects        │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│              PostgreSQL Database            │
└─────────────────────────────────────────────┘
```

### The Golden Rule
> **Controllers know about HTTP. Services know about business logic. Neither knows about each other's concerns.**

This makes code:
- **Testable**: You can unit-test a service without an HTTP server
- **Maintainable**: Changing the database doesn't affect controllers
- **Scalable**: Each layer can be extracted into a microservice later

---

## 6. Future Microservices Scalability

The module structure we built is **microservices-ready**:

```
Current (Monolith):
  finance-management/src/modules/auth/
  finance-management/src/modules/users/
  finance-management/src/modules/transactions/

Future (Microservices):
  auth-service/           ← Auth module extracted
  user-service/           ← Users module extracted  
  transaction-service/    ← Transactions module extracted
  api-gateway/            ← Routes between services
```

NestJS natively supports microservices with TCP, Redis, gRPC, and more — your modules would just use `ClientProxy` instead of direct service injection.
