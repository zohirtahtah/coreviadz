# Corevia ERP — Product Requirements Document

## 1. Overview

**Corevia** (منصة الإدارة الذكية الشاملة للشركات) is an AI-powered, multi-tenant ERP platform for Algerian e-commerce and small-to-medium businesses. It provides end-to-end management of sales orders, inventory (3-tier), products with color/size variants, supplier invoices, employee payroll, expense tracking, profit/loss analysis, team communication, and SaaS tenant administration.

- **Target Users**: Algerian e-commerce merchants, dropshippers, SME owners, and their employees.
- **Platform**: Web (PWA-ready), single-page application hosted on Vercel.
- **Tech Stack**: React 19, TypeScript 5.8, Vite 6, TailwindCSS 4, Supabase (Auth + PostgreSQL + Realtime), Lucide icons, Recharts, Leaflet maps.
- **AI Integration**: Google Gemini API for AI features (via environment variable).

---

## 2. User Roles

### 2.1 Super Admin
- **Identifier**: Email `coreviadz@gmail.com` or `admin@corevia.com`, or via `VITE_SUPER_ADMIN_EMAIL` env var.
- **Access**: Full SaaS tenant management panel (route `/super-admin`).
- **Capabilities**:
  - View all registered tenant companies in a directory.
  - Manage subscription plans (Free, Basic, Pro, Enterprise) per tenant.
  - Set seat limits, account status (Active, Suspended, Disabled, Pending Verification), expiration dates.
  - Simulate OTP verification for pending tenants.
  - View system-wide activity logs.
  - Sandbox reset (clear all tenant data).
  - Billing history and security configuration.

### 2.2 Admin (Company Owner)
- **Identifier**: Default role after sign-up.
- **Access**: Full ERP module access — Dashboard, Orders, Products, Inventory, Suppliers, Workers/HR, Expenses, Profit & Loss, Yearly Analysis, Team Chat, Settings, Activity Log, Trash.
- **Capabilities**:
  - All business CRUD operations.
  - Create/manage employee accounts with granular page permissions.
  - Configure company profile, passcode lock, custom colors.
  - Manage Google Sheets sync.
  - Invite employees via invitation links.
  - Must pass OTP email verification before first activation.
  - Subject to subscription seat limits when adding employees.

### 2.3 Employee
- **Identifier**: Role assigned via admin-created accounts.
- **Access**: Restricted to `allowedPages[]` array (admin-defined). "My Profile" and "Communication" are always accessible.
- **Capabilities**:
  - View permitted pages (read-only or full access depending on status).
  - Submit self-reports: overtime, missing hours, absence, expenses.
  - Communicate via internal team chat.
  - View personal profile.
- **Statuses**: Active, Read Only, Suspended.

---

## 3. Functional Modules

### 3.1 Authentication & Onboarding
- **Login methods**: Email, phone, or username via Supabase Auth + localStorage fallback.
- **OTP verification**: 6-digit code generated on account creation, displayed in a simulated mailbox hint, must be entered to activate the tenant.
- **Onboarding wizard**: 4-step setup — business type selection, company info (name, registry, tax number, etc.), volume estimation (orders, workers), initial preferences (currency, language, theme).
- **Session management**: React state-based, persisted to localStorage, synced with Supabase auth session.

### 3.2 Dashboard
- KPI cards: total orders, total sales, net profit, pending orders count.
- Charts: monthly profit trend (bar), order status distribution (pie).
- Top 3 performing models (products) by quantity sold.
- Top 3 colors by sales.
- Top 3 wilayas (regions) by delivery count.
- Interactive Algeria map with sales by wilaya.
- Quick-access buttons for key actions (new order, new product, etc.).

### 3.3 Orders Management
- **CRUD operations**: Create, read, update, soft-delete sales orders.
- **Fields**: Customer name, phone, wilaya, commune, delivery method/company, delivery price, product items (with color/size), pricing, discount, paid amount, customer-pays-delivery toggle, exchange flag, agent name, order source (1/2/3), status (pending/delivered/returned), return cost/date, notes.
- **Features**: 
  - Automatic inventory deduction on order creation.
  - Exchange orders with reference to original.
  - Invoice printing with barcode.
  - CSV import/export of orders.
  - Real-time stock movement logging.
  - 5-second undo on soft delete.

### 3.4 Products & Pricing
- **CRUD operations**: Create, read, update, delete products.
- **Fields**: Name, wholesale cost price, wholesale percentage, wholesale final price, retail cost price, retail percentage, retail final price, colors array, sizes array.
- **Supplier invoices**: Product purchases from suppliers with cost tracking.

### 3.5 Inventory (3-Tier)
- **Basic Inventory**: Product + color quantity tracking.
- **Sub Inventory**: Product + color + size quantity tracking.
- **Return Inventory**: Returned goods tracking.
- **Stock Movements**: Full audit trail of all inventory mutations (order creation, deletion, adjustments).
- **Automatic updates**: Orders create/destroy stock automatically.

### 3.6 Suppliers
- **CRUD operations**: Create, read, update, delete suppliers.
- **Supplier invoices**: Purchase invoices linked to products, payment tracking, debt balance.

### 3.7 Workers & Payroll (HR)
- **Employee cards**: Name, code, phone, base salary, daily hours, overtime rate, role, monthly salary.
- **Payroll expansion**: Monthly payroll records with overtime hours, absence days, missing hours, paid vacation days, and calculated salary breakdown (base, daily rate, hourly rate, overtime pay, absence deduction, expense deduction, net salary).
- **Salary sheets**: Per-worker monthly sheets with pay status (paid/unpaid), full calculated salary object.
- **Payslip printing**.
- **Employee self-submissions**: Overtime requests, missing hours reports, absence reports, expense claims (viewable by admin on the Workers page).

### 3.8 Expenses
- **Fixed expenses**: Monthly recurring costs.
- **Variable expenses**: Ad-hoc costs with month/year attribution.
- **Ad campaigns**: Facebook, Google, TikTok, Snapchat — with USD/DZD currency conversion, exchange rate, start/end dates.
- **Filters and monthly reporting**.

### 3.9 Profit & Loss
- Monthly P&L statement with revenue (delivered orders), costs (wholesale/procurement), expenses breakdown, gross/net profit.
- Charts: monthly profit trend (area), expense breakdown (pie), top profit models, top wilayas by revenue.
- Currency format toggle (DZD/USD).

### 3.10 Yearly Analysis
- Year-over-year comparison (select any two years).
- Cumulative annual profit chart.
- Monthly net profit trend.
- Profit growth percentage.

### 3.11 Team Communication
- Real-time internal chat via Supabase Realtime subscriptions.
- Message types: text, voice recordings (Blob storage).
- Typing indicators and read receipts (via BroadcastChannel).
- Message history with localStorage backup + Supabase sync.
- Contact list organized by company.

### 3.12 Employee Self-Service
- **My Profile**: View personal details, job title, assigned permissions.
- **Submit reports**: Overtime, missing hours, absence, expenses (each saved locally + synced to Supabase).
- **View personal submission history**.

### 3.13 Users & Permissions (Admin)
- Employee account management: create, edit, suspend, delete.
- Permission system: assign allowed pages per employee from a checklist.
- Status management: Active, Read Only, Suspended.
- Invitation system: generate unique invitation links with expiry; auto-login for new employees.
- Seat limit enforcement based on subscription plan.

### 3.14 Settings
- **Company profile**: Business name, type, registry, tax number, owner, contact, address, website, logo.
- **Passcode lock**: 4-digit passcode to protect sensitive pages (workers, expenses, suppliers, profit, yearly).
- **Custom colors**: Rename and set hex colors for the color selector used in products/orders.
- **Cloud sync**: Upload/download all data to/from Supabase with progress indicator.
- **Google Sheets sync**: OAuth-based bidirectional sync for orders (export/import).
- **Language & theme**: Arabic/French/English, Dark/Light mode.

### 3.15 Activity Log
- Full audit trail of all system actions with filters:
  - Search by keyword.
  - Filter by action type (Create, Update, Delete, Login, etc.).
  - Filter by page/module.
  - Date range picker.
  - Paginated view.

### 3.16 Trash (Soft Deletion)
- Deleted items (orders, products, supplier invoices, workers) moved to trash.
- 5-second undo window after deletion.
- 30-day auto-retention before permanent deletion.
- Restore or permanently delete items.
- Bulk empty trash.

### 3.17 Super Admin Panel
- Tenant directory with search and filters.
- Subscription management: plan, seats, status, expiration per tenant.
- Simulate OTP verification for pending tenants.
- System-wide activity logs.
- Billing history view.
- Security configuration (allowed login IPs, enforcement options).
- Sandbox reset (delete all tenant data from Supabase).
- Create new SaaS client (manual registration).

---

## 4. Technical Architecture

### 4.1 Data Flow
```
User Action → localStorage (instant UI) → Supabase (background sync)
              ↑                                    |
              └────── pullMultiTenantData() ←──────┘
```

- **Offline-first**: All CRUD writes to localStorage first, providing instant UI feedback.
- **Supabase sync**: `pushSingleDatasetToCloud()` pushes changes; `pullMultiTenantData()` pulls latest from cloud.
- **Real-time**: Supabase Realtime subscriptions on 8 tables; periodic 5-second polling as fallback.
- **Multi-tenant isolation**: localStorage keys suffixed with sanitized email; Supabase queries filtered by `company_id`.

### 4.2 State Management
- Primarily React `useState` in App.tsx (central orchestrator) plus per-component state.
- `refreshKey` state incremented on real-time data pull to trigger child component re-fetches.
- Data passed as props from App.tsx to child views.
- LocalStorage as the source of truth for persisted data.

### 4.3 Routing
- State-based routing via `activeTab` string state (no react-router).
- URL path synchronization: reads `window.location.pathname` on mount, writes via `window.history.pushState` on tab change.
- `vercel.json` rewrites all paths to `index.html` for SPA support.
- Legacy route aliases: `/purchases` → `suppliers` tab, `/super-admin` → `super-admin` tab.

### 4.4 Security & Access Control
- **Role-based gates**: App.tsx JSX role guards prevent rendering of unauthorized pages.
- **Passcode lock**: Sensitive pages require a 4-digit passcode (configurable in Settings).
- **Read-only enforcement**: Checks at mutation points block writes for Read-Only accounts.
- **SaaS tenant gates**: Disabled/Suspended/Pending Verification statuses block or restrict access.
- **OTP verification**: Required for initial tenant activation.
- **RLS**: Must be disabled on all tables for anon key CRUD/real-time to function.

### 4.5 Service Layer
| File | Purpose |
|------|---------|
| `storageUtils.ts` | LocalStorage CRUD with multi-tenant key isolation, helper functions for each data type |
| `supabaseClient.ts` | Supabase client initialization (URL + anon key) |
| `supabaseSync.ts` | Cloud push/pull engine, `fetchUserSaaSMeta()`, `pushSingleDatasetToCloud()`, `pullMultiTenantData()` |
| `employeeService.ts` | Employee CRUD (localStorage-first) |
| `employeeSubmissionsService.ts` | Employee self-report submissions |
| `communicationService.ts` | Chat messages with local + Supabase merge |
| `activityLogService.ts` | Activity logging with batch local storage + Supabase upsert |
| `googleSyncUtils.ts` | Google Sheets OAuth + bidirectional sync |

---

## 5. Database Schema (Supabase Tables)

| Table | Purpose |
|-------|---------|
| `corevia_saas_users` | User metadata, role (admin/super_admin/suspended), company binding, onboarding status |
| `corevia_companies` | Company profile (name, owner, country, phone), subscription plan, seat limits, account status, OTP code |
| `corevia_profile` | Business profile form data (address, registry, tax number, etc.) |
| `corevia_products` | Product catalog with pricing, colors, sizes |
| `corevia_orders` | Sales orders with items, delivery, pricing, status |
| `corevia_suppliers` | Supplier contacts and info |
| `corevia_expenses` | Unified expenses (fixed, variable, ads) with amounts, platform, dates |
| `corevia_workers` | Employee/worker cards with salary config and payrolls array |
| `corevia_salary_sheets` | Monthly salary records per worker |
| `corevia_inventory_basic` | Product+color stock levels |
| `corevia_inventory_sub` | Product+color+size stock levels |
| `corevia_inventory_return` | Returned goods inventory |
| `corevia_stock_movements` | Audit trail for all stock changes |
| `corevia_company_users` | Employee accounts (name, email, role, allowedPages, status, companyId) |
| `corevia_employee_submissions` | Employee self-reports (overtime, expenses, absences, missing hours) |
| `corevia_chat_messages` | Team chat messages with sender, content, timestamp, seenBy |
| `corevia_activity_center` | Business activity logs |
| `corevia_activity_logs` | Super admin activity logs |

---

## 6. Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous API key |
| `VITE_GEMINI_API_KEY` | Google Gemini AI API key |
| `VITE_SUPER_ADMIN_EMAIL` | Email override for super admin role |
| `APP_URL` | Application base URL (for Google Sheets OAuth) |
| `VITE_APP_URL` | Alternative app URL variable |

---

## 7. Deployment

- **Platform**: Vercel (SPA with rewrites).
- **Build command**: `npm run build` (Vite).
- **Output directory**: `dist/`.
- **Git repository**: `https://github.com/zohirtahtah/coreviadz.git`.
- **Supabase**: `https://yuuqxprqvlqvoyoltwiw.supabase.co`.

---

## 8. Constraints & Known Issues

- RLS must be **disabled** on all Supabase tables for anon key access to work.
- Real-time cross-device sync requires RLS disabled (anon key currently blocked).
- Tests require manual Vercel redeployment after each push.
- OTP verification flow includes a simulated mailbox hint (OTP displayed on screen) — not a real email delivery system.
- Super admin access requires `coreviadz@gmail.com` or explicit env var override.
- All dates stored in ISO format, displayed in Algerian timezone (UTC+1).
- Currency conversion uses manually entered exchange rates (not live API).
