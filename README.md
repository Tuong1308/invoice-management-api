# Invoice Management API

A RESTful API for managing invoices built with **TypeScript**, **Express**, **PostgreSQL**, and **Prisma ORM**. Supports full invoice lifecycle: draft, issue, cancel, replace, and PDF export.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma (v5)
- **PDF**: PDFKit
- **Testing**: Jest + ts-jest

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v15+)

### Installation

```bash
git clone https://github.com/Tuong1308/invoice-management-api.git
cd invoice-management-api
npm install
```

### Database Setup

1. Create the database:

```bash
psql -U postgres
CREATE DATABASE invoice_management;
\q
```

2. Configure `.env`:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/invoice_management"
PORT=3000
```

3. Run migrations:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### Run the Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### Run Tests

```bash
npm test
```

## Database Schema

### Enum: InvoiceStatus

`DRAFT` | `ISSUED` | `CANCELED` | `REPLACED`

### Table: invoices

| Column | Type | Description |
|---|---|---|
| id | INT (PK, AI) | Primary key |
| invoiceNumber | VARCHAR (Unique) | Auto-generated: INV-YYYYMMDD-XXXX |
| status | InvoiceStatus | Default: DRAFT |
| customerName | VARCHAR | Required |
| customerAddress | VARCHAR | Optional |
| customerEmail | VARCHAR | Optional |
| totalAmount | FLOAT | Calculated from items |
| note | TEXT | Optional |
| cancelReason | TEXT | Required when canceling |
| canceledAt | DATETIME | Set when canceled |
| replacedInvoiceId | INT (FK, Unique) | References invoices.id |
| issuedAt | DATETIME | Set when issued |
| createdAt | DATETIME | Auto |
| updatedAt | DATETIME | Auto |

### Table: invoice_items

| Column | Type | Description |
|---|---|---|
| id | INT (PK, AI) | Primary key |
| invoiceId | INT (FK) | References invoices.id (CASCADE) |
| description | VARCHAR | Item description |
| quantity | INT | Default: 1 |
| unitPrice | FLOAT | Unit price |
| amount | FLOAT | quantity × unitPrice |

### Relationships

- `invoices` 1 — N `invoice_items` (ON DELETE CASCADE)
- `invoices` 1 — 1 `invoices` (self-reference via replacedInvoiceId)

## Invoice Lifecycle

![Invoice lifecycle](docs/invoice-lifecycle.png)

### Valid Transitions

| From | To | Action | Condition |
|---|---|---|---|
| DRAFT | ISSUED | Issue invoice | Must have items |
| ISSUED | CANCELED | Cancel invoice | Requires cancelReason |
| ISSUED | REPLACED | Replace invoice | Creates new DRAFT referencing old |
| DRAFT | (delete) | Delete draft | Only drafts can be deleted |

### Invalid Transitions (blocked)

- DRAFT → CANCELED (delete instead)
- DRAFT → REPLACED (not issued yet)
- ISSUED → DRAFT (cannot revert)
- ISSUED → edit content (cannot modify issued)
- CANCELED → any (terminal state)
- REPLACED → any (terminal state)

## API Endpoints

### CRUD

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/invoices` | Create draft invoice |
| GET | `/api/invoices` | List all invoices (optional `?status=DRAFT`) |
| GET | `/api/invoices/:id` | Get invoice by ID |
| PUT | `/api/invoices/:id` | Update draft invoice |
| DELETE | `/api/invoices/:id` | Delete draft invoice |

### Business Logic

| Method | Endpoint | Description |
|---|---|---|
| PATCH | `/api/invoices/:id/issue` | Issue invoice (DRAFT → ISSUED) |
| PATCH | `/api/invoices/:id/cancel` | Cancel invoice (ISSUED → CANCELED) |
| POST | `/api/invoices/:id/replace` | Replace invoice (ISSUED → REPLACED) |

### PDF

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/invoices/:id/pdf` | Download invoice as PDF |

### Example: Create Invoice

```json
POST /api/invoices
{
  "customerName": "Cong ty TNHH ABC",
  "customerAddress": "123 Nguyen Hue, Quan 1, TP.HCM",
  "customerEmail": "ketoan@abc.com.vn",
  "note": "Thanh toan trong vong 30 ngay",
  "items": [
    {
      "description": "Thiet ke website",
      "quantity": 1,
      "unitPrice": 5000000
    },
    {
      "description": "Hosting 1 nam",
      "quantity": 1,
      "unitPrice": 1200000
    }
  ]
}
```

## Project Structure

```
invoice-management-api/
├── docs/
│   └── Invoice-Management-API.postman_collection.json
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── controllers/
│   │   └── invoice-controller.ts
│   ├── routes/
│   │   └── invoice-routes.ts
│   ├── services/
│   │   ├── invoice-service.ts
│   │   └── pdf-service.ts
│   ├── test/
│   │   ├── test-helpers.ts
│   │   ├── crud.test.ts
│   │   └── state-machine.test.ts
│   ├── utils/
│   │   └── prisma.ts
│   ├── app.ts
│   └── server.ts
├── .env.example
├── jest.config.ts
├── package.json
└── tsconfig.json
```

## Testing

23 unit tests covering:

- **crud.test.ts**: Create, Read, Update, Delete operations (10 tests)
- **state-machine.test.ts**: Issue, Cancel, Replace transitions (13 tests)

Postman Collection available at `docs/Invoice-Management-API.postman_collection.json`.

## Estimate vs Actual

| Phase | Estimate | Actual |
|---|---|---|
| Setup project | 2–3h | 1h 30min |
| Research invoice business rules | 2–3h | 40min |
| Database schema + migration | 2–3h | 1h |
| API CRUD | 3–4h | 1h |
| Business logic (issue/cancel/replace) | 4–6h | 1h |
| PDF export + template | 4–6h | 30min |
| API download PDF | 1–2h | 30min |
| Unit tests | 3–4h | 1h |
| Postman Collection | 1–2h | 20min |
| README | 1–2h | 30min |
| Buffer / polish | 3–5h | ~1h 30min |
| **Total** | **26–40h** | **~9h 30min** |

## What I Learned

- **Prisma ORM**: First time using Prisma — learned schema definition, migrations, relations (self-referencing, one-to-many), and type-safe queries with Prisma Client.
- **Invoice business logic**: Understanding real-world invoice lifecycle with state machine pattern (DRAFT → ISSUED → CANCELED/REPLACED) and why issued invoices cannot be modified.
- **PDF generation with PDFKit**: Building a clean PDF template programmatically — positioning elements, drawing tables, handling column alignment and page margins.

## Challenges

- **Invoice business rules**: Understanding valid and invalid state transitions required research — especially the replace flow where two operations (mark old as REPLACED + create new DRAFT with reference) must happen in a single transaction.
- **PDF template layout**: Getting columns aligned, text not clipped at margins, and currency values fitting on one line took multiple iterations. PDFKit uses absolute positioning, so every element needs precise coordinate calculations.
- **Prisma version compatibility**: Prisma v7 changed how database URLs are configured, breaking the standard setup. Resolved by downgrading to Prisma v5.22.0.

## Issues & Decisions

- **Prisma v7 incompatible**: Prisma v7 removed `url` from schema datasource, requiring `prisma.config.ts`. Downgraded to Prisma v5.22.0 for stability and better documentation support.