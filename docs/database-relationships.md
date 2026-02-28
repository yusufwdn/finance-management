# Database Relationships

This document explains the database structure, how tables relate to each other, and the decisions behind each design choice.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USERS                                        │
│  id (PK, UUID)                                                       │
│  email (UNIQUE)                                                      │
│  password                                                            │
│  first_name                                                          │
│  last_name                                                           │
│  created_at                                                          │
│  updated_at                                                          │
└──────┬─────────────────────────┬──────────────────────┬─────────────┘
       │ 1                       │ 1                    │ 1
       │                         │                      │ 1
       │ has many                │ has many             │ has many
       │                         │                      │
       ▼ N                       ▼ N                    ▼ N
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│   ACCOUNTS       │  │   CATEGORIES     │  │      BUDGETS         │
│  id (PK)         │  │  id (PK)         │  │  id (PK)             │
│  user_id (FK) ───┘  │  user_id (FK) ───┘  │  user_id (FK) ───────┘
│  name            │  │  name            │  │  category_id (FK) ──┐
│  type (enum)     │  │  type (enum)     │  │  amount              │
│  balance         │  │  color           │  │  month               │
│  currency        │  │  icon            │  │  year                │
│  is_active       │  │  description     │  │  UNIQUE(user_id,     │
│  created_at      │  │  created_at      │  │    category_id,      │
│  updated_at      │  │  updated_at      │  │    month, year)      │
└────────┬─────────┘  └────────┬─────────┘  └──────────────────────┘
         │ 1                   │ 1                       ▲
         │                     │                         │
         │ has many            │ has many                │
         │                     └────────────┐            │
         ▼ N                                ▼ N          │
┌─────────────────────────────────────────────────────┐ │
│                    TRANSACTIONS                       │ │
│  id (PK)                                             │ │
│  user_id (FK) ──────────────────────────────────────┘ │
│  account_id (FK) ──────────────────────────────────── │ (to ACCOUNTS)
│  category_id (FK, nullable) ──────────────────────────┘ (to CATEGORIES)
│  amount                                               │
│  type (enum: INCOME | EXPENSE)                        │
│  description                                          │
│  date                                                 │
│  created_at                                           │
│  updated_at                                           │
└───────────────────────────────────────────────────────┘
```

---

## Relationship Explanations

### 1. User → Accounts (One-to-Many)

```
User ──────── Account
(1)             (N)
```

**One user can have MANY accounts.**
- A user might have: Checking Account, Savings Account, Credit Card
- Each account has exactly one owner (user)
- Foreign key: `accounts.user_id` references `users.id`

**SQL equivalent:**
```sql
CREATE TABLE accounts (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
```

**`ON DELETE CASCADE`** means: if a user is deleted, all their accounts are automatically deleted too. This keeps the database consistent (no orphaned accounts).

---

### 2. User → Categories (One-to-Many)

```
User ──────── Category
(1)              (N)
```

**One user can have MANY categories.**
- Categories are **user-specific** — this is intentional
- User A's "Food" category is separate from User B's "Food" category
- This allows users to customize their own category names and colors

**Why not shared categories?**
A future enhancement could include "default categories" (seeded at signup), but keeping them user-scoped ensures complete data isolation between users.

---

### 3. User → Transactions (One-to-Many)

```
User ──────── Transaction
(1)               (N)
```

**One user can have MANY transactions.**
- `user_id` on transactions is redundant (we could derive it from the account) but:
  - Makes queries faster (no join needed to filter by user)
  - Provides an extra security check ("Does this transaction belong to this user?")
  - Industry best practice for multi-tenant applications

---

### 4. Account → Transactions (One-to-Many)

```
Account ──────── Transaction
(1)                  (N)
```

**One account can have MANY transactions.**
- Every transaction must be linked to an account (which account was the money taken from/deposited to?)
- `account_id` is required (NOT NULL)

---

### 5. Category → Transactions (One-to-Many, Optional)

```
Category ──────── Transaction
(1)                  (0..N)
```

**One category can have MANY transactions, but a transaction's category is OPTIONAL.**
- `category_id` is nullable (`String?` in Prisma schema)
- This allows "uncategorized" transactions
- `ON DELETE SET NULL` — if a category is deleted, transactions in that category become uncategorized (not deleted)

---

### 6. Category → Budgets (One-to-Many)

```
Category ──────── Budget
(1)                 (N)
```

**One category can have MANY budgets** (one per month/year combination).
- You can set a budget for "Food" every month
- The `@@unique([userId, categoryId, month, year])` constraint ensures you can't create two budgets for the same category in the same month

---

## Cardinality Summary Table

| Relationship | Type | Nullable? | On Delete |
|-------------|------|-----------|-----------|
| User → Accounts | 1:N | Required | CASCADE |
| User → Categories | 1:N | Required | CASCADE |
| User → Transactions | 1:N | Required | CASCADE |
| User → Budgets | 1:N | Required | CASCADE |
| Account → Transactions | 1:N | Required | CASCADE |
| Category → Transactions | 1:N | Optional | SET NULL |
| Category → Budgets | 1:N | Required | CASCADE |

---

## Database Design Decisions

### Why UUID instead of Auto-increment IDs?

```typescript
id String @id @default(uuid())
// generates: "550e8400-e29b-41d4-a716-446655440000"
// instead of: 1, 2, 3, 4...
```

**Benefits:**
1. **Security**: Sequential IDs reveal information (`/accounts/1` — how many accounts are there?)
2. **Distributed systems**: Multiple servers can generate IDs without coordination
3. **Non-guessable**: An attacker can't iterate through IDs to find all resources

---

### Why `@map` Decorators?

```typescript
firstName String @map("first_name")
```

- TypeScript convention: `camelCase` (firstName)
- Database convention: `snake_case` (first_name)
- `@map` lets us use both conventions properly without compromise

---

### Why Decimal for Money Fields?

```typescript
amount Decimal @db.Decimal(15, 2)
```

**Never use `Float` or `Double` for money!**

```typescript
// Floating point problem:
0.1 + 0.2 === 0.30000000000000004  // ← WRONG!

// Decimal avoids this entirely
// Decimal(15, 2) means: up to 15 digits total, 2 decimal places
// Examples: 9999999999999.99, 50.00, 1000000.50
```

This is a critical financial application concern — rounding errors in money calculations can cause real financial discrepancies.

---

### Why `@@map("table_name")`?

```typescript
@@map("users")
```

Without `@@map`, Prisma would create a table called `User` (capitalized). `@@map` ensures the PostgreSQL table follows the snake_case convention: `users`, `accounts`, `transactions`.

---

## Prisma Query Examples

Here are example queries you'll write when building feature modules:

```typescript
// Find all transactions for a user with account and category details
const transactions = await prisma.transaction.findMany({
  where: { userId: user.id },
  include: {
    account: true,    // ← joins the accounts table
    category: true,   // ← joins the categories table
  },
  orderBy: { date: 'desc' }, // newest first
});

// Get account balance with transaction count
const account = await prisma.account.findUnique({
  where: { id: accountId },
  include: {
    _count: { select: { transactions: true } } // count related transactions
  }
});

// Sum of expenses by category for a month
const report = await prisma.transaction.groupBy({
  by: ['categoryId'],
  where: {
    userId: user.id,
    type: 'EXPENSE',
    date: {
      gte: new Date('2026-02-01'),
      lte: new Date('2026-02-28'),
    }
  },
  _sum: { amount: true },
});
```
