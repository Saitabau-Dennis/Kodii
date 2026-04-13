# KODII

<div align="center">

![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Neon](https://img.shields.io/badge/Neon_DB-00E5CC?style=for-the-badge&logo=neon&logoColor=black)
![Africa's Talking](https://img.shields.io/badge/Africa's_Talking-FF6B35?style=for-the-badge&logo=africaistalkinglogo&logoColor=white)

**A lightweight property management app built for small landlords in Kenya.**

Rent tracking · M-Pesa payment confirmation · Tenant SMS communication · Maintenance management

</div>

---

## Overview

KODII is a property operations platform designed for small landlords, caretakers, and agents in Kenya. Landlords and caretakers manage everything from a clean web app. Tenants interact entirely over SMS — no app download required.

```
Landlord / Caretaker → Web app (SvelteKit)
Tenant               → SMS (Africa's Talking shortcode)
```

---

## Features

### For Landlords
- **Dashboard** — real-time overview of rent, occupancy, overdue tenants, and open maintenance tickets with sparkline charts
- **Properties** — add and manage multiple properties with per-property stats
- **Units** — manage units, set rent amounts, track occupancy status
- **Tenants** — add tenants, assign them to units, track payment and issue history
- **Payments** — receive M-Pesa payment confirmations via SMS, verify payments, handle partial payments
- **Maintenance** — track and resolve repair tickets, assign caretakers, update status
- **Notices** — send SMS broadcasts to all tenants, a specific property, unit, or individual tenant
- **Reports** — financial summaries, occupancy rates, overdue tenants, CSV export
- **Team** — invite and manage caretakers with role-based access
- **Settings** — configure business info, Paybill/Till details, SMS reminder schedule

### For Tenants (via SMS)
- Confirm rent payments: `PAY B3 7000 QJD7X8Y2Z`
- Report maintenance issues: `REPORT B3 pipe is leaking`
- Receive rent reminders, payment confirmations, and maintenance updates automatically

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit + TypeScript |
| Database | Neon DB (serverless PostgreSQL) |
| ORM | Drizzle ORM |
| Styling | TailwindCSS + Flowbite Svelte |
| SMS | Africa's Talking |
| Auth | Custom session (jose JWT) + bcryptjs |
| Charts | Apache ECharts |
| Hosting | Vercel / Railway |

---

## Project Structure

```
kodii/
├── src/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts              # Neon + Drizzle client
│   │   │   ├── retry.ts              # Query retry helper
│   │   │   └── schema/               # All table definitions
│   │   ├── server/
│   │   │   ├── auth.ts               # Session management
│   │   │   ├── sms.ts                # Africa's Talking client
│   │   │   └── notifications.ts      # SMS message helpers
│   │   ├── services/                 # Database query layer
│   │   ├── components/               # Svelte UI components
│   │   ├── types/                    # TypeScript types
│   │   └── utils/                    # Helpers (format, CSV, trends)
│   └── routes/
│       ├── (auth)/                   # Login, register, verify
│       ├── (app)/                    # Protected app pages
│       └── api/                      # SMS webhook + cron endpoints
├── drizzle/                          # Migration files
├── drizzle.config.ts
└── .env
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- A [Neon DB](https://neon.tech) account
- An [Africa's Talking](https://africastalking.com) account

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/kodii.git
cd kodii
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
# Database
DATABASE_URL=your_neon_connection_string

# Auth
SESSION_SECRET=your_random_32_char_secret

# Africa's Talking SMS
AT_API_KEY=your_api_key
AT_USERNAME=sandbox          # use 'sandbox' for testing
AT_SHORTCODE=your_shortcode

# Cron security
CRON_SECRET=your_cron_secret

# App
APP_URL=http://localhost:5173
```

### 4. Push the database schema

```bash
pnpm db:push
```

### 5. Start the development server

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Database

KODII uses Drizzle ORM with Neon DB (serverless PostgreSQL).

### Available commands

```bash
pnpm db:push      # Push schema directly to database (development)
pnpm db:generate  # Generate migration files
pnpm db:migrate   # Apply migrations (production)
pnpm db:studio    # Open Drizzle Studio to browse data
```

### Tables

```
users               landlords and caretakers
properties          property records
units               individual units per property
tenants             tenant profiles
rent_invoices       monthly rent invoices
payments            payment records with M-Pesa codes
maintenance_tickets issue and repair tickets
ticket_comments     internal notes on tickets
notices             broadcast SMS messages
notice_replies      tenant SMS replies
otp_codes           one-time PINs for auth
settings            per-landlord configuration
caretaker_properties caretaker property assignments
activity_logs       audit trail of all actions
```

---

## SMS Flows

KODII uses Africa's Talking for two-way SMS communication.

### Inbound (tenant → KODII)

| Format | Action |
|---|---|
| `PAY B3 7000 QJD7X8Y2Z` | Submit a rent payment for Unit B3 |
| `REPORT B3 pipe is leaking` | Log a maintenance ticket for Unit B3 |
| Any other message | Saved as a notice reply |

### Outbound (KODII → tenant)

- Rent due reminders (X days before due date)
- Overdue alerts (after due date)
- Payment received confirmation (pending verification)
- Payment confirmed or rejected
- Maintenance ticket logged, in progress, resolved, closed
- Welcome SMS on move-in
- Move-out confirmation

### Webhook setup

Set these callback URLs in your Africa's Talking dashboard:

```
Incoming Messages:  https://yourdomain.com/api/sms
Delivery Reports:   https://yourdomain.com/api/sms/delivery
```

For local development use [ngrok](https://ngrok.com):

```bash
ngrok http 5173
# then set https://abc123.ngrok.io/api/sms as your callback
```

---

## Authentication

KODII uses a custom session system — no third-party auth library.

```
Landlord registers → password hashed with bcryptjs
                  → 6-digit OTP sent via SMS
                  → OTP verified → session created

Caretaker invited  → landlord creates account
                  → temp password sent via SMS
                  → caretaker logs in → sets own password

Session            → signed JWT in httpOnly cookie (jose)
                  → expires after 7 days
OTP                → expires after 10 minutes, single use
```

---

## User Roles

| Role | Access |
|---|---|
| Landlord | Full access — all properties, all modules, team management |
| Caretaker | Assigned properties only — view and manage, cannot access settings or team |
| Tenant | SMS only — no web app access |

---

## Cron Jobs

KODII has two cron endpoints for automated tasks:

```
POST /api/invoices   → Generate monthly rent invoices for all active tenants
POST /api/reminders  → Send rent due and overdue SMS reminders
```

Both are protected by a `CRON_SECRET` header. Set up with Vercel Cron, Railway Cron, or any external scheduler.

Example with Vercel (`vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/invoices",
      "schedule": "0 0 1 * *"
    },
    {
      "path": "/api/reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | Neon DB connection string | ✅ |
| `SESSION_SECRET` | 32-char secret for signing session cookies | ✅ |
| `AT_API_KEY` | Africa's Talking API key | ✅ |
| `AT_USERNAME` | Africa's Talking username (sandbox for dev) | ✅ |
| `AT_SHORTCODE` | Your AT shortcode for sending/receiving SMS | ✅ |
| `CRON_SECRET` | Secret header for protecting cron endpoints | ✅ |
| `APP_URL` | Your app's public URL | ✅ |

---

## Development Notes

### Neon DB cold starts

Neon DB is serverless and suspends after inactivity. KODII handles this with automatic query retries:

```typescript
// All DB queries are wrapped in withRetry()
const user = await withRetry(() =>
  db.query.users.findFirst({ where: eq(users.id, id) })
)
```

### Phone number format

All phone numbers are stored and used in E.164 format internally:

```
0712345678  →  +254712345678
```

### SMS character limit

All SMS messages are kept under 160 characters. Exceeding this splits the message into two SMS and doubles the cost.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a pull request

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
  Built for Kenya's landlords by <a href="https://github.com/yourusername">Saitabau Dennis</a>
</div>
