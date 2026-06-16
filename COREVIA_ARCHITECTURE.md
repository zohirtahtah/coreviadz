# COREVIA ERP — ENTERPRISE EMPLOYEE MANAGEMENT ARCHITECTURE

This document outlines the architectural specifications and database isolation guidelines implemented for the **Corevia ERP** platform, mirroring the high-availability security standards of global solutions like Odoo, Zoho, and SAP Business One.

---

## 1. Multi-Tenant Directory Boundary Isolation

Every customer entity, worker, order, inventory record, and employee is bound contextually to the parent corporation via `company_id`. 
* **Row-Level Security (RLS)** is enforced across both backend tables and live local memory trees.
* Database queries in both client-side modules and server endpoints require explicit `company_id` parameterized criteria to prevent cross-company visibility.
* All hardcoded fake, default simulation ("mock") corporations have been systematically pruned from the active cloud storage to ensure zero database noise and complete security.

---

## 2. Global Administrator Security Gateways

Dedicated gatekeepers have been enforced server-side to guarantee that the Super Admin panel is strictly accessible to the platform orchestrator.
* Authorized Super Admins are securely validated based on verified email domains (`coreviadz@gmail.com` and `admin@corevia.com`) crossed-checked against database records of `corevia_saas_users`.
* Local storage cache structures are fully bypassed when reading secure SaaS configurations; the primary state is fetched directly from Supabase via Node.js server proxy relays (`/api/auth/verify-super-admin`).

---

## 3. Account Suspension Cascades

1. **Employee Suspension (`status = suspended`):**
   * Instantaneous session invalidation in active memory.
   * Automated lockout from pages and APIs.
   * Hard stop displaying warning: `"تم إيقاف حسابك من طرف إدارة الشركة."`
2. **Company Suspension (`status = suspended`):**
   * Recursive state lock applied to the entire corporation.
   * Lockout applied to both owner and workers.
   * Read-only mode activated on data grids with top-panel warning indicator: `"حساب الشركة موقوف حالياً. يرجى التواصل مع الدعم."`

---

## 4. Real-time Multi-User State Synchronization

Synchronizations are routed dynamically via active real-time channels.
* Creation, updates, and deletion payloads for products, orders, and expenses propagate to all clients matching the `company_id` without requiring window reloads.
* Double-entry ledger calculations verify storage persistence before completing client-facing animations.
