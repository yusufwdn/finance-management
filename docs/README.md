# Personal Finance Management API — Documentation

## 📚 Table of Contents

| Document | Description |
|----------|-------------|
| [Architecture Decisions](./architecture.md) | Why we chose NestJS, Prisma, PostgreSQL and how the system is structured |
| [Folder Structure](./folder-structure.md) | Complete breakdown of every folder and file and what it does |
| [Request Flow](./request-flow.md) | Step-by-step: what happens from HTTP request to HTTP response |
| [Authentication Flow](./auth-flow.md) | How JWT registration/login/protected routes work |
| [Database Relationships](./database-relationships.md) | Entity diagrams, table relationships, and foreign keys explained |
| [Phase 1 — Auth Reference](./phase-1-auth.md) | DI deep-dive, request traces, security decisions, API examples |
| [Postman Collection](./postman/finance-management.postman_collection.json) | Import into Postman — auto-saves JWT token, includes tests |

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file and fill in values
cp .env.example .env

# 3. Generate Prisma client
npx prisma generate

# 4. Run database migrations (requires PostgreSQL running)
npx prisma migrate dev --name init

# 5. Start development server
npm run start:dev
```

The API will be available at: `http://localhost:3000/api`

---

## 🏗️ Tech Stack

| Technology | Role | Why? |
|-----------|------|------|
| **NestJS** | HTTP Framework | Structure, DI, modules, decorators |
| **PostgreSQL** | Database | Relational, ACID-compliant, production-grade |
| **Prisma ORM** | Database toolkit | Type-safe queries, migrations, schema-as-code |
| **JWT** | Authentication | Stateless, scalable, industry standard |
| **bcryptjs** | Password hashing | Secure one-way hashing |
| **class-validator** | Input validation | Declarative validation via decorators |

---

## 📦 Project Phases

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Project setup, architecture, Prisma schema, global config |
| Phase 2 | 🔜 Next | Users module (register, profile management) |
| Phase 3 | 🔜 | Authentication (JWT login, guards, token refresh) |
| Phase 4 | 🔜 | Accounts module (CRUD for financial accounts) |
| Phase 5 | 🔜 | Categories module |
| Phase 6 | 🔜 | Transactions module |
| Phase 7 | 🔜 | Budgets module |
| Phase 8 | 🔜 | Reports & analytics |
