# Biashara SACCO - Roles Matrix

## Role Hierarchy
From highest to lowest authority:
1. **Admin** - Full system access
2. **Treasurer** - Financial operations and high-level approvals
3. **Committee** - Policy decisions and mid-level approvals
4. **Member** - Self-service access only

## Detailed Permissions Matrix

### 👑 ADMIN
**Purpose**: Complete system administration and oversight

**Permissions**:
- ✅ **All Manager permissions PLUS:**
- ✅ System configuration and settings
- ✅ User role management (assign/remove roles)
- ✅ Audit log access and monitoring
- ✅ Database maintenance operations
- ✅ System-wide reports and analytics
- ✅ Emergency override capabilities
- ✅ Backup and recovery operations

**Access Level**: 
- Can view and modify ALL data across the system
- Can perform ANY operation without restrictions

---

### 💰 TREASURER
**Purpose**: Financial operations and high-level approvals

**Permissions**:
- ✅ **All Committee permissions PLUS:**
- ✅ Final approval for loans (UGX 100,000 - UGX 500,000)
- ✅ Override committee decisions when necessary
- ✅ Access to all financial reports and analytics
- ✅ Authority to set operational policies
- ✅ Emergency fund management
- ✅ Staff supervision and performance review

**Data Access**:
- All member profiles and financial data
- Complete transaction history and reports
- Loan portfolio management
- Financial performance metrics and analytics

**Restrictions**:
- ❌ Cannot approve loans over UGX 500,000 (requires Admin)
- ❌ Cannot modify system configuration
- ❌ Cannot manage user roles

---

### 🏛️ COMMITTEE
**Purpose**: Policy enforcement and initial approvals

**Permissions**:
- ✅ Member registration and onboarding
- ✅ Initial loan application review and recommendations
- ✅ Deposits and withdrawals processing
- ✅ Account balance inquiries
- ✅ Transaction processing
- ✅ Customer support
- ✅ Document verification
- ✅ Policy compliance monitoring
- ✅ Guarantor verification

**Data Access**:
- Member profiles and basic financial information
- Loan applications for review
- Transaction processing capabilities
- Basic reports and summaries

**Restrictions**:
- ❌ Cannot give final approval for loans (only recommendations)
- ❌ Cannot access sensitive financial analytics
- ❌ Cannot override treasurer decisions

---

### 👤 MEMBER
**Purpose**: Self-service access to personal financial information

**Permissions**:
- ✅ View personal account balances
- ✅ View transaction history (own accounts only)
- ✅ Submit loan applications
- ✅ Update personal contact information
- ✅ View loan status and payment schedule
- ✅ Accept/decline guarantor requests
- ✅ Download personal statements

**Data Access**:
- Personal profile and contact information
- Own savings accounts and balances
- Own loan applications and repayment history
- Own transaction records
- Guarantor requests involving them

**Restrictions**:
- ❌ Cannot view other members' information
- ❌ Cannot process any transactions for others
- ❌ Cannot access administrative functions
- ❌ Cannot approve any applications

---

## Loan Approval Workflow by Amount

### Emergency Loans (< UGX 100,000)
- **Direct to Committee** (bypasses Treasurer for speed)
- **Committee Decision**: Approve/Reject
- **If Approved**: Immediate disbursement

### Standard Loans (UGX 100,000 - UGX 500,000)
1. **Committee**: Initial review and documentation
2. **Treasurer**: Final approval decision
3. **If Approved**: Disbursement authorization

### High-Value Loans (> UGX 500,000)
1. **Committee**: Initial review and documentation
2. **Treasurer**: Credit assessment and recommendation
3. **Admin**: Final approval authority
4. **If Approved**: Disbursement authorization

---

## Data Filtering Rules

### Admin
- **Sees**: Everything in the system
- **Filters**: None

### Treasurer
- **Sees**: All financial and operational data
- **Filters**: Can access all member and transaction data
  - Cannot access system configuration
  - Cannot manage user roles

### Committee
- **Sees**: Operational data for review
- **Filters**: 
  - Cannot see final approval decisions
  - Cannot access sensitive financial analytics
  - Cannot override treasurer decisions

### Member
- **Sees**: Personal data only
- **Filters**: 
  - All queries filtered by `userId`
  - Cannot access any data not directly related to them

---

## Security Features

### Role Assignment
- Only **Admins** can assign/remove roles
- Role changes are logged in audit trail
- Multiple roles per user supported
- Highest role determines access level

### Permission Enforcement
- Server-side validation on all operations
- UI elements hidden based on permissions
- API endpoints protected by role middleware
- Database queries automatically filtered

### Audit Trail
- All significant actions logged
- User, timestamp, and action details recorded
- Only Admins can access audit logs
- Automatic retention policy applied

---

## Role-Based Navigation

### Admin Dashboard
- System Overview
- User Management
- Audit Logs
- System Settings
- All Reports

### Treasurer Dashboard
- Pending Final Approvals
- Financial Analytics
- Loan Portfolio Management
- Strategic Reports

### Committee Dashboard
- Initial Loan Reviews
- Member Applications
- Policy Compliance
- Operational Reports

### Member Dashboard
- Account Summary
- Transaction History
- Loan Status
- Personal Settings