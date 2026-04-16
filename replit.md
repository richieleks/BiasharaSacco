# Biashara SACCO Management System

## Overview
This project is a comprehensive SACCO (Savings and Credit Cooperative Organization) management system designed to streamline operations for cooperative banking. It enables the management of members, savings accounts, loans, and financial transactions. The system aims to provide a robust, user-friendly platform for SACCOs to manage their core business processes efficiently, improving member services and financial oversight.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript, Radix UI components, shadcn/ui design system, and Tailwind CSS for a modern, accessible, and responsive user experience. It features a custom SACCO-themed color palette, interactive analytics charts (Recharts), dynamic tables with server-side pagination, and intuitive forms.

### Technical Implementations
The system employs a `client/` (React frontend) and `server/` (Express.js backend) architecture, with `shared/` for common TypeScript types and database schema.
- **Frontend**: Wouter for routing, TanStack Query for server state management, and Vite for building.
- **Backend**: Node.js with Express.js, TypeScript, and ES modules. Drizzle ORM is used with PostgreSQL (Neon serverless).
- **Authentication**: Local username/password authentication with bcrypt, Express sessions, and fully DB-driven Role-Based Access Control (RBAC). Roles (admin, treasurer, committee, member) and permissions are managed in the database and enforced by backend middleware and frontend hooks. Granular function-level permissions control specific operations: `record:deposits`, `request:withdrawals`, `approve:withdrawals`, `disburse:loans`, `record:loan-repayments`, `create:loan-applications`, and `execute:data-import`. These are enforced on both backend (middleware) and frontend (UI visibility). **Admin role is exclusive**: admin users do not have member profiles, the admin role cannot be combined with other roles, and admin role assignment is only available through User Management (not RBAC member role assignment).
- **User-Member Separation**: The `users` table has a `userType` column (`system` | `member`) to distinguish system staff from SACCO members. System users (admin, manager, committee) do not get member profiles and are managed in the "System Users" tab of Admin Settings. Member users get linked member profiles and are managed in the Members page. The auto-sync (`ensureMemberProfile`) only runs for member-type users.
- **Financial Operations**: Manages savings accounts, loans with a multi-approver committee workflow (configurable minimum approvers), dynamic repayment calculations, and conditional guarantor workflows. An advanced interest calculation system supports various methods and manages financial years. Share capital calculations use a system-wide share price.
- **Guarantor Requests**: Members can view and respond to guarantor requests through a dedicated page.
- **Currency Formatting**: All monetary amounts are formatted using `formatCurrency(amount, prefix="UGX")` with 0 decimal precision.
- **Business Logic**: Includes robust business rules validation for loan eligibility based on membership duration, active saver status, and savings-to-loan ratios.
- **Notifications**: A real-time notification system with WebSocket support.
- **User Preferences**: Per-user settings (theme, language, notification toggles, auto-logout timer) are persisted in the `user_settings` table.
- **Dark Mode**: Full dark mode support implemented via a `useTheme` hook, applying CSS class-based styling.
- **SACCO Operational Accounts**: Chart of Accounts system with five account types. Default accounts and mappings are seeded on startup. Double-entry journal entries are automatically created for key financial operations (deposits, withdrawals, loan disbursements, repayments, fees, share capital) using database transactions for atomicity.
- **Data Management**: Supports Excel file upload for bank statement processing and transaction import, account statement generation, and an audit logging system. Loan import maps to existing members.
- **Bank Transfer Schedules**: Generates KCB-format Excel files for monthly salary deductions for savings and loan repayments. SACCO bank details are configurable in Admin Settings.
- **Member Activity Tracking**: Automatically tracks member savings activity (`lastSavingsDate`) to determine `active`, `inactive`, and `dormant` statuses. An activity checker runs periodically, and a report provides a summary and detailed member lists.
- **Member Exit Workflow**: A two-step treasurer approval process for member exits. Eligibility checks include active loans (if covered by savings) and guarantor obligations.
- **User-Member Auto-Sync**: The `users` and `members` tables are kept synchronized; every user has a corresponding member profile.
- **User Management**: Creation, profile management, and role assignment for SACCO members and staff.
- **Savings Accounts**: Creation, management, deposits, withdrawals, and detailed statement generation. Members can self-service withdrawal requests, subject to treasurer approval.
- **Loans**: Application, multi-stage approval, guarantor management, dynamic repayment schedules, business rule validation, and a loan top-up module.
- **Transactions**: Comprehensive tracking, auditing, and reporting.
- **Reporting & Analytics**: Dashboards with KPIs, transaction history, member activity, and financial summaries, including visual analytics charts. Includes standard financial statements (Trial Balance, Balance Sheet, Income Statement).
- **Portfolio at Risk (PAR) Analysis**: PAR 30/60/90 reporting with aging buckets for loan portfolio quality assessment.
- **Loan Loss Provisioning**: Automated provisioning with standard categories (Current 1%, Watch 5%, Substandard 25%, Doubtful 50%, Loss 100%).
- **Loan Write-Off Workflow**: Request and approval process for writing off irrecoverable loans, accessible from loan details.
- **Loan Restructuring**: Request revised terms (rate, term) for distressed loans. Restructure requests require admin approval. On approval, new terms are applied to the loan. History tracked per loan. Rates stored as decimals (consistent with loan creation). Routes in `server/financial-reports.ts`, UI in `client/src/pages/loan-details.tsx` and `client/src/pages/reports.tsx`.
- **Dividend Management**: Calculate, approve, and distribute dividends on member share capital by financial year. Supports credit-to-savings distribution.
- **System Settings**: Differentiated user and admin settings for personal preferences and system-wide configurations (e.g., loan limits, security policies, email setup, business rules).
- **Security Features**: Includes session timeout based on inactivity, configurable password complexity, login lockout after failed attempts, and Two-Factor Authentication (TOTP) with setup, verification, and disable options. Admin can enforce mandatory 2FA for all users via the `twoFactorRequired` system setting; non-enrolled users are forced through a full-screen 2FA enrollment flow (QR code + verification) after login and password change, with both server-side (`/api/auth/user` returns `mustSetup2FA`) and client-side (App.tsx route interception) enforcement preventing bypass.
- **Database Backup System**: Exports major tables to JSON files. Supports manual and scheduled backups with automatic cleanup of old backups.
- **Savings Total Sync**: `members.total_savings` is automatically kept in sync with actual `savings_accounts` balances. Sync triggers on every balance change (deposits, withdrawals, interest credits, payment credits) and runs a bulk startup sync. Admin can manually trigger sync via `/api/admin/sync-savings-totals`.
- **Reconciliation Report**: Compares savings account balances against transaction history (credits: deposits, interest, share capital vs debits: withdrawals, fees) to identify discrepancies. Available in Reports > Reconciliation tab with summary stats, searchable table, and pagination.

## External Dependencies
- **Database**: Neon PostgreSQL (serverless)
- **Authentication**: Local username/password authentication with bcrypt, otpauth for TOTP 2FA
- **Hosting**: Replit deployment platform
- **Frontend Libraries**: React, React Query, React Hook Form, Radix UI, Lucide icons, Tailwind CSS, Recharts
- **Backend Libraries**: Express, Passport, bcryptjs, Drizzle ORM, otpauth
- **Utilities**: Zod (validation), date-fns, memoizee, Multer (file uploads)