# Biashara SACCO Management System

## Overview
This project is a comprehensive SACCO (Savings and Credit Cooperative Organization) management system designed to streamline operations for cooperative banking. It enables the management of members, savings accounts, loans, and financial transactions. The system aims to provide a robust, user-friendly platform for SACCOs to manage their core business processes efficiently, improving member services and financial oversight.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18 with TypeScript, built on Radix UI components and the shadcn/ui design system for a modern, accessible, and consistent user experience. Styling is managed with Tailwind CSS, incorporating custom CSS variables for flexible theming. The design emphasizes responsiveness, catering to both desktop and mobile users, and incorporates a custom SACCO-themed color palette. Key UI components include interactive analytics charts (Recharts), dynamic tables with pagination, and intuitive forms for various operations. Profile and settings functionalities are implemented as standalone pages for enhanced user experience, complemented by a collapsible sidebar for improved navigation.

### Technical Implementations
The system is divided into a `client/` (React frontend) and `server/` (Express.js backend) architecture, with `shared/` for common TypeScript types and database schema.
- **Frontend**: Wouter for routing, TanStack Query for server state management, and Vite for building.
- **Backend**: Node.js with Express.js, TypeScript, and ES modules. Drizzle ORM is used for type-safe database operations with PostgreSQL (Neon serverless). Authentication is handled via Replit Auth with OpenID Connect, and sessions are managed using Express sessions with PostgreSQL storage.
- **Authentication**: Role-based access control (Admin, Treasurer, Committee, Member) is enforced system-wide, with dynamic role and permission management capabilities.
- **Financial Operations**: Includes comprehensive management of savings accounts, loans (with multi-stage approval workflows, dynamic repayment calculations, and conditional guarantor workflows), and transactions. An advanced interest calculation system supports various methods (simple, compound, reducing balance) and manages financial years.
- **Business Logic**: A robust business rules validation system ensures compliance with SACCO regulations, providing real-time eligibility checks for loan applications based on membership duration, active saver status, and savings-to-loan ratios.
- **Notifications**: A real-time notification system with WebSocket support keeps users informed of critical activities, offering various notification types and priority levels.
- **Data Management**: Features include Excel file upload for bank statement processing and transaction import, comprehensive account statement generation, and an audit logging system for tracking all critical system activities.

### Feature Specifications
- **User Management**: Creation, profile management, and role assignment for SACCO members and staff.
- **Savings Accounts**: Creation, management, deposits, withdrawals, and detailed statement generation.
- **Loans**: Application, multi-stage approval, guarantor management, dynamic repayment schedules, and business rule validation.
- **Transactions**: Comprehensive tracking, auditing, and reporting.
- **Reporting & Analytics**: Dashboards with KPIs, transaction history, member activity, and financial summaries, including visual analytics charts.
- **System Settings**: Differentiated user and admin settings, allowing for personal preferences and system-wide configurations (e.g., loan limits, security policies, email setup, business rules).

## External Dependencies
- **Database**: Neon PostgreSQL (serverless)
- **Authentication**: Replit Auth (OpenID Connect provider)
- **Hosting**: Replit deployment platform
- **Frontend Libraries**: React, React Query, React Hook Form, Radix UI, Lucide icons, Tailwind CSS, Recharts
- **Backend Libraries**: Express, Passport, OpenID Client, Drizzle ORM
- **Utilities**: Zod (validation), date-fns, memoizee, Multer (file uploads)