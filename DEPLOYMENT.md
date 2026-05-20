# SchoolManSys - Production Deployment Guide

## Database Setup (MySQL 8.0)

### Connection Details
- **Host:** da30.host-ww.net
- **Database:** schoolm2_mansys_db
- **User:** schoolm2_mansys_db_admin

### Step 1: Deploy Schema to MySQL

Run these commands from the project root:

```bash
# Set the MySQL connection string
export DATABASE_URL="mysql://schoolm2_mansys_db_admin:Admincyber@da30.host-ww.net:3306/schoolm2_mansys_db"

# Push the schema (creates all tables)
npx prisma db push

# Generate the Prisma client
npx prisma generate
```

### Step 2: Create the Global Admin User

After schema is pushed, run the seed:

```bash
npx tsx prisma/seed.ts
```

### Step 3: Create Accept-Invite Page

Create `src/app/accept-invite/page.tsx` for the invite flow.

### Step 4: SMTP Configuration

Email is already configured via Nodemailer:
- **Host:** mail.schoolmansys.co.ke
- **Port:** 587 (STARTTLS)
- **User:** noreply@schoolmansys.co.ke
- **Password:** As configured in .env

Email features:
- Invite emails sent on school creation (5-second timeout, graceful fallback)
- Force reset password emails
- HTML email templates with SchoolManSys branding

### Step 5: cPanel Deployment

1. Build the Next.js app:
   ```bash
   npm run build
   ```

2. Upload the `.next/standalone/` folder to your hosting
3. Configure Phusion Passenger to point to the standalone server
4. Set environment variables in cPanel
5. Point `*.schoolmansys.co.ke` A-record to your hosting IP
6. Setup AutoSSL for `admin.schoolmansys.co.ke`

### Step 6: DNS Configuration

| Record | Type | Value |
|--------|------|-------|
| `*.schoolmansys.co.ke` | A | Your Hosting IP |
| `admin.schoolmansys.co.ke` | A | Your Hosting IP |

### Step 7: Cron Jobs (cPanel)

Add these cron jobs:

```bash
# Delete audit logs older than 6 months (daily at 2 AM)
0 2 * * * cd /path/to/app && node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.auditLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 180*24*60*60*1000) } } }).then(() => db.\$disconnect());
"
```

### Environment Variables Checklist

Set these in cPanel's Node.js environment or `.env` file:

- [x] `DATABASE_URL` - MySQL connection string
- [x] `SMTP_HOST` - mail.schoolmansys.co.ke
- [x] `SMTP_PORT` - 587
- [x] `SMTP_USER` - noreply@schoolmansys.co.ke
- [x] `SMTP_PASS` - (configured)
- [x] `APP_URL` - https://schoolmansys.co.ke
- [ ] `MPESA_CONSUMER_KEY` - (configure when enabling M-Pesa)
- [ ] `MPESA_CONSUMER_SECRET` - (configure when enabling M-Pesa)
- [ ] `MPESA_PASSKEY` - (configure when enabling M-Pesa)
- [ ] `MPESA_SHORTCODE` - (configure when enabling M-Pesa)

### Architecture Constraints Compliance

| # | Constraint | Status |
|---|-----------|--------|
| 1 | No Background Workers | ✅ All synchronous |
| 2 | No External Caching | ✅ MySQL indexes only |
| 3 | bcryptjs Only | ✅ No bcrypt C++ native |
| 4 | 5s Email Timeout | ✅ Promise.race pattern |
| 5 | Path-Based Callbacks | ✅ admin.schoolmansys.co.ke/api/... |
| 6 | No Dynamic SQL Scoping | ✅ Explicit tenantId |
| 7 | Pessimistic Locking | ✅ Fee payment transactions |
| 8 | Copy Link over Email | ✅ inviteLink in response |
| 9 | No Public PDF Storage | ✅ Private storage path |
| 10 | Soft Deletes | ✅ deleted_at on all tables |
| 11 | UPI Validation | ✅ 10-12 numeric chars |
| 12 | No Multi-Branch | ✅ tenant = one school |
