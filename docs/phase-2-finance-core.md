# Phase 2 — Finance Core Modules

## What Was Built in This Phase

| Area | Status | Details |
|------|--------|---------|
| Wallets module | ✅ | CRUD for user's financial accounts |
| Categories module | ✅ | CRUD for income/expense labels |
| Transactions module | ✅ | CRUD with automatic balance updates |
| Transaction types | ✅ | INCOME, EXPENSE, TRANSFER |
| Balance auto-update | ✅ | Atomic updates via Prisma `$transaction` |
| Schema changes | ✅ | Added `TRANSFER` type, `toAccountId` field, named relations |

---

## API Endpoints Summary

### Wallets

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/wallets` | List all active wallets |
| `POST` | `/api/wallets` | Create a new wallet |
| `GET` | `/api/wallets/:id` | Get wallet by ID |
| `PATCH` | `/api/wallets/:id` | Update wallet metadata |
| `DELETE` | `/api/wallets/:id` | Deactivate wallet (soft delete) |

### Categories

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/categories` | List all categories |
| `GET` | `/api/categories?type=EXPENSE` | Filter by INCOME or EXPENSE |
| `POST` | `/api/categories` | Create a new category |
| `GET` | `/api/categories/:id` | Get category by ID |
| `PATCH` | `/api/categories/:id` | Update category |
| `DELETE` | `/api/categories/:id` | Delete category |

### Transactions

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/transactions` | List transactions (supports filters) |
| `GET` | `/api/transactions?walletId=X` | Filter by wallet |
| `GET` | `/api/transactions?type=EXPENSE` | Filter by type |
| `GET` | `/api/transactions?categoryId=X` | Filter by category |
| `GET` | `/api/transactions?startDate=2026-01-01&endDate=2026-01-31` | Date range filter |
| `POST` | `/api/transactions` | Create transaction (updates balance) |
| `GET` | `/api/transactions/:id` | Get transaction by ID |
| `PATCH` | `/api/transactions/:id` | Update transaction (recalculates balance) |
| `DELETE` | `/api/transactions/:id` | Delete transaction (reverses balance) |

---

## Part 1: Understanding the Domain Model

Before getting into code, it's important to understand **what these entities represent** and **how they relate to each other**.

### Wallets (stored as `Account` in DB)

A wallet is a financial container that holds a balance. In real life:
- A bank checking account
- A savings account
- A credit card
- A physical cash envelope
- An investment portfolio

Every wallet has:
- A **balance** — the current amount of money
- A **type** — what kind of financial instrument it is (`CHECKING`, `SAVINGS`, `CREDIT_CARD`, `INVESTMENT`, `CASH`, `OTHER`)
- A **currency** — what currency the balance is in (USD, EUR, IDR, etc.)

> **Why is it called `Account` in the database but `Wallet` in the API?**
> The Prisma schema uses `Account` (the universal financial term). The module and routes use `Wallet` because that's the term most personal finance apps use for a user-facing "money container." The two are synonymous here.

### Categories

A category is a **label** for a transaction. It answers "what was this money for?"

Examples:
- INCOME categories: `Salary`, `Freelance`, `Bonus`, `Investment Returns`
- EXPENSE categories: `Food`, `Transport`, `Entertainment`, `Utilities`

Categories have a **type** (INCOME or EXPENSE) that must match the transaction using them.

> TRANSFER transactions do **not** need a category — moving money between your own wallets is neither income nor expense.

### Transactions

A transaction is a **financial event** that changes balances. The `type` field is the most important field:

| Type | What it means | Effect |
|------|--------------|--------|
| `INCOME` | Money entered from outside | `wallet.balance += amount` |
| `EXPENSE` | Money left to outside | `wallet.balance -= amount` |
| `TRANSFER` | Money moved between your wallets | `from.balance -= amount` AND `to.balance += amount` |

---

## Part 2: Schema Changes from Phase 1

The Prisma schema was updated with three changes:

### 1. Added `TRANSFER` to `TransactionType` enum

```prisma
enum TransactionType {
  INCOME
  EXPENSE
  TRANSFER  // ← NEW
}
```

### 2. Added `toAccountId` for transfers

```prisma
model Transaction {
  // ...existing fields...

  // Source account — always required
  accountId String  @map("account_id")
  account   Account @relation("TransactionFromAccount", ...)

  // Destination account — only set when type = TRANSFER
  toAccountId String?  @map("to_account_id")     // ← NEW (nullable)
  toAccount   Account? @relation("TransactionToAccount", ...)  // ← NEW
}
```

### 3. Named relations (required when two relations exist between same models)

Without naming, Prisma would not know which relation is which when `Transaction` has two fields pointing to `Account`.

```prisma
// Transaction side
account   Account @relation("TransactionFromAccount", ...)
toAccount Account @relation("TransactionToAccount", ...)

// Account side (the reverse)
transactions   Transaction[] @relation("TransactionFromAccount")
toTransactions Transaction[] @relation("TransactionToAccount")
```

---

## Part 3: Business Logic Deep Dive — Balance Calculation

This is the most critical logic in the entire application. Getting this wrong means financial data is incorrect.

### The Core Rule

**Every transaction write (CREATE, UPDATE, DELETE) must update account balance(s) atomically.**

"Atomically" means: either BOTH the transaction record change AND the balance update succeed, or NEITHER does.

This is enforced with Prisma's `$transaction`:

```typescript
await this.prisma.$transaction(async (tx) => {
  // All database operations here are wrapped in a single
  // PostgreSQL transaction (BEGIN ... COMMIT / ROLLBACK)
  
  await tx.transaction.create({ ... }); // insert record
  await tx.account.update({ ... });     // update balance
  
  // If anything throws above, PostgreSQL rolls back BOTH.
  // Either all of this happens, or none of it.
});
```

### CREATE — Applying Balance Effect

```
                         ┌─────────────────────────────────────────┐
                         │          Transaction Created             │
                         └────────────────┬────────────────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
         INCOME                       EXPENSE                    TRANSFER
              │                           │                           │
              ▼                           ▼                    ┌──────┴──────┐
  account.balance += amount  account.balance -= amount         │             │
                                                        from.balance   to.balance
                                                         -= amount    += amount
```

In code (`applyBalanceEffect`):
```typescript
if (type === 'INCOME') {
  // increment is atomic: balance = balance + amount (SQL-level)
  await tx.account.update({ data: { balance: { increment: amount } } });
}
if (type === 'EXPENSE') {
  await tx.account.update({ data: { balance: { decrement: amount } } });
}
if (type === 'TRANSFER') {
  await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: amount } } });
  await tx.account.update({ where: { id: toAccountId }, data: { balance: { increment: amount } } });
}
```

> **Why `increment`/`decrement` instead of `balance = currentBalance + amount`?**
>
> If you read the balance first and then write it back:
> ```typescript
> const wallet = await tx.account.findUnique(...); // read: balance = 1000
> await tx.account.update({ data: { balance: wallet.balance + 100 } }); // write: 1100
> ```
> Under concurrent requests, two requests could both read `1000` and both write `1100`, losing one update.
>
> With `{ increment: 100 }`, the SQL is:
> ```sql
> UPDATE accounts SET balance = balance + 100 WHERE id = '...';
> ```
> PostgreSQL handles the locking — concurrent updates are serialized correctly.

### DELETE — Reversing Balance Effect

Delete simply reverses whatever the transaction did:

```
INCOME was created → balance went UP   → delete: balance goes DOWN
EXPENSE was created → balance went DOWN → delete: balance goes UP
TRANSFER was created → from went DOWN, to went UP
                     → delete: from goes UP, to goes DOWN
```

```typescript
// reverseBalanceEffect — the exact OPPOSITE of applyBalanceEffect
if (type === 'INCOME')   tx.account.update({ data: { balance: { decrement: amount } } });
if (type === 'EXPENSE')  tx.account.update({ data: { balance: { increment: amount } } });
if (type === 'TRANSFER') {
  tx.account.update({ where: { id: accountId },   data: { balance: { increment: amount } } });
  tx.account.update({ where: { id: toAccountId }, data: { balance: { decrement: amount } } });
}
```

### UPDATE — The "Reverse + Apply" Pattern

Update is the trickiest case because any field can change:
- amount might change
- type might change (INCOME → EXPENSE)
- accountId might change (moved to a different wallet)
- toAccountId might be added or removed

**The pattern: treat UPDATE as DELETE(old) + CREATE(new).**

```typescript
await this.prisma.$transaction(async (tx) => {
  // Step 1: Undo what the OLD transaction did to balances
  await this.reverseBalanceEffect(tx, {
    type: existing.type,
    amount: existing.amount,
    accountId: existing.accountId,
    toAccountId: existing.toAccountId,
  });

  // Step 2: Apply what the NEW transaction will do to balances
  await this.applyBalanceEffect(tx, {
    type: newType,       // may be same or different
    amount: newAmount,   // may be same or different
    accountId: newAccountId,       // may be same wallet or different
    toAccountId: newToAccountId,   // may be added, removed, or changed
  });

  // Step 3: Actually update the record
  return tx.transaction.update({ where: { id }, data: { ... } });
});
```

**Worked example — changing an INCOME to an EXPENSE:**

Before update:
- `Checking` balance: `$1,500` (started at $1,000, had $500 INCOME)
- Transaction: INCOME $500 to `Checking`

User changes the transaction to EXPENSE $300 from `Checking`.

Step 1 — Reverse old INCOME:
- `Checking.balance -= $500` → `$1,000`

Step 2 — Apply new EXPENSE:
- `Checking.balance -= $300` → `$700`

Step 3 — Update record to `type=EXPENSE, amount=300`.

Final state: `Checking` = $700. ✅ Correct.

**Worked example — changing wallet:**

Before:
- `Checking` = $800 (started $1,000, had $200 EXPENSE)
- `Savings` = $2,000
- Transaction: EXPENSE $200 from `Checking`

User changes to EXPENSE $200 from `Savings`.

Step 1 — Reverse EXPENSE from Checking:
- `Checking.balance += $200` → `$1,000`

Step 2 — Apply EXPENSE from Savings:
- `Savings.balance -= $200` → `$1,800`

Final state: `Checking` = $1,000, `Savings` = $1,800. ✅ Correct.

---

## Part 4: Validation Rules & Business Rules

### Wallet Validation

| Rule | Enforcement |
|------|------------|
| Name unique per user | `ConflictException` if name exists |
| Balance NOT directly settable | No balance field in DTO |
| Cannot delete wallet with transactions | `BadRequestException` with count |
| Cannot transact on inactive wallet | Checked in TransactionsService |

### Category Validation

| Rule | Enforcement |
|------|------------|
| Name + type unique per user | `ConflictException` |
| Deleting sets `categoryId = NULL` on transactions | Prisma `onDelete: SetNull` |

### Transaction Validation

| Rule | Enforcement |
|------|------------|
| `toAccountId` required when type=TRANSFER | `@ValidateIf` in DTO |
| `toAccountId` CANNOT be same as `accountId` | Service-level check |
| TRANSFER cannot have a category | Service-level check |
| INCOME transaction → INCOME category | Service-level check |
| EXPENSE transaction → EXPENSE category | Service-level check |
| Wallet must belong to the user | `findFirst({ where: { id, userId } })` |
| Category must belong to the user | `findFirst({ where: { id, userId } })` |
| Both wallets must be active for TRANSFER | Service-level check |

---

## Part 5: Request/Response Examples

### Create a Wallet

```
POST /api/wallets
Authorization: Bearer <token>

{
  "name": "Main Checking",
  "type": "CHECKING",
  "currency": "USD",
  "description": "Primary day-to-day account"
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "id": "uuid-wallet-1",
    "name": "Main Checking",
    "type": "CHECKING",
    "balance": "0",
    "currency": "USD",
    "description": "Primary day-to-day account",
    "isActive": true,
    "createdAt": "2026-02-28T10:00:00.000Z",
    "updatedAt": "2026-02-28T10:00:00.000Z",
    "userId": "uuid-user-1"
  },
  "timestamp": "2026-02-28T10:00:00.000Z"
}
```

### Create a Category

```
POST /api/categories
Authorization: Bearer <token>

{
  "name": "Salary",
  "type": "INCOME",
  "color": "#4CAF50",
  "icon": "💰"
}
```

### Create an INCOME Transaction

```
POST /api/transactions
Authorization: Bearer <token>

{
  "amount": 5000.00,
  "type": "INCOME",
  "accountId": "uuid-wallet-1",
  "categoryId": "uuid-salary-category",
  "date": "2026-02-28",
  "description": "February salary"
}
```

**Effect:** `Main Checking.balance` goes from `0` → `5000.00`

Response includes embedded wallet and category:
```json
{
  "success": true,
  "data": {
    "id": "uuid-tx-1",
    "amount": "5000",
    "type": "INCOME",
    "date": "2026-02-28T00:00:00.000Z",
    "description": "February salary",
    "account": {
      "id": "uuid-wallet-1",
      "name": "Main Checking",
      "type": "CHECKING",
      "currency": "USD"
    },
    "toAccount": null,
    "category": {
      "id": "uuid-salary-category",
      "name": "Salary",
      "type": "INCOME",
      "color": "#4CAF50",
      "icon": "💰"
    }
  },
  "timestamp": "2026-02-28T10:00:00.000Z"
}
```

### Create an EXPENSE Transaction

```json
{
  "amount": 120.50,
  "type": "EXPENSE",
  "accountId": "uuid-wallet-1",
  "categoryId": "uuid-food-category",
  "date": "2026-02-28",
  "description": "Weekly groceries"
}
```

**Effect:** `Main Checking.balance` goes from `5000.00` → `4879.50`

### Create a TRANSFER Transaction

```json
{
  "amount": 1000.00,
  "type": "TRANSFER",
  "accountId": "uuid-wallet-1",
  "toAccountId": "uuid-wallet-2",
  "date": "2026-02-28",
  "description": "Transfer to savings"
}
```

**Effect:**
- `Main Checking.balance`: `4879.50` → `3879.50` (decreased)
- `Savings.balance`: `0` → `1000.00` (increased)

> No `categoryId` — TRANSFER is not income or expense.

---

## Part 6: File Map — Phase 2

```
src/
├── modules/
│   ├── wallets/
│   │   ├── wallets.module.ts              ← Wires controller + service
│   │   ├── wallets.controller.ts          ← CRUD routes /api/wallets
│   │   ├── wallets.service.ts             ← Business logic, soft-delete
│   │   └── dto/
│   │       ├── create-wallet.dto.ts       ← name, type, currency, description
│   │       └── update-wallet.dto.ts       ← PartialType(CreateWalletDto)
│   ├── categories/
│   │   ├── categories.module.ts
│   │   ├── categories.controller.ts       ← CRUD routes /api/categories
│   │   ├── categories.service.ts          ← Category CRUD, type validation
│   │   └── dto/
│   │       ├── create-category.dto.ts     ← name, type, color, icon
│   │       └── update-category.dto.ts
│   └── transactions/
│       ├── transactions.module.ts
│       ├── transactions.controller.ts     ← CRUD routes /api/transactions
│       ├── transactions.service.ts        ← Balance logic, $transaction
│       └── dto/
│           ├── create-transaction.dto.ts  ← @ValidateIf for transfer fields
│           └── update-transaction.dto.ts
│
prisma/
├── schema.prisma                          ← Updated: TRANSFER type, toAccountId
└── migrations/
    └── 20260228034152_phase2_add_transfer/
        └── migration.sql                  ← ALTER TABLE + ADD COLUMN
```

---

## Common Mistakes Prevented

| Mistake | Prevention |
|---------|-----------|
| Race condition on balance update | `{ increment: x }` not `balance = balance + x` |
| Partial update (tx saved, balance not) | Prisma `$transaction` wraps both |
| TRANSFER to self | Service checks `accountId !== toAccountId` |
| Wrong category type for transaction | Service enforces INCOME↔INCOME, EXPENSE↔EXPENSE |
| Accessing another user's wallet | All queries include `userId` in `where` clause |
| Updating balance directly | No `balance` field exposed in DTOs |
| Ghost balance after delete | Delete reverses balance before removing record |
| Incorrect balance after update | Reverse(old) + Apply(new) pattern handles all cases |
