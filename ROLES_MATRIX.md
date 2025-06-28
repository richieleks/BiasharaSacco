# Biashara SACCO - Roles Matrix

## Role Hierarchy
From highest to lowest authority:
1. **Admin** - Full system access
2. **Manager** - Strategic oversight and final approvals
3. **Committee** - Policy decisions and mid-level approvals
4. **Teller** - Daily operations and customer service
5. **Member** - Self-service access only

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

### 🏢 MANAGER
**Purpose**: Senior management oversight and high-value approvals

**Permissions**:
- ✅ **All Committee permissions PLUS:**
- ✅ Final approval for loans > UGX 500,000
- ✅ Member suspension/reactivation
- ✅ Financial policy adjustments
- ✅ Staff performance monitoring
- ✅ Strategic reports and dashboards
- ✅ Emergency fund access
- ✅ Loan write-offs and restructuring

**Data Access**:
- All member information
- All financial transactions
- All loan applications and history
- Performance metrics and analytics

---

### 🏛️ COMMITTEE
**Purpose**: Policy enforcement and mid-level approvals

**Permissions**:
- ✅ **All Teller permissions PLUS:**
- ✅ Loan approval (UGX 100,000 - UGX 500,000)
- ✅ Member application final approval
- ✅ Large withdrawal approvals (> UGX 200,000)
- ✅ Interest rate recommendations
- ✅ Policy compliance monitoring
- ✅ Guarantor verification
- ✅ Loan restructuring requests

**Data Access**:
- All member profiles and histories
- Loan applications requiring committee review
- Transaction patterns and reports
- Financial performance metrics

---

### 🏪 TELLER
**Purpose**: Front-line customer service and daily operations

**Permissions**:
- ✅ Member registration and onboarding
- ✅ Initial loan application processing
- ✅ Deposits and small withdrawals (< UGX 200,000)
- ✅ Account balance inquiries
- ✅ Transaction processing
- ✅ Basic customer support
- ✅ Document verification
- ✅ Daily cash reconciliation

**Data Access**:
- Member information (view and edit basic details)
- Transaction processing for assigned members
- Loan applications (initial review only)
- Savings account operations

**Restrictions**:
- ❌ Cannot approve loans over UGX 100,000
- ❌ Cannot access sensitive member data
- ❌ Cannot override system limits

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
- **Direct to Committee** (bypasses Teller for speed)
- **Committee Decision**: Approve/Reject
- **If Approved**: Immediate disbursement

### Standard Loans (UGX 100,000 - UGX 500,000)
1. **Teller**: Initial review and documentation
2. **Committee**: Credit assessment and approval decision
3. **If Approved**: Disbursement authorization

### High-Value Loans (> UGX 500,000)
1. **Teller**: Initial review and documentation
2. **Committee**: Credit assessment and recommendation
3. **Manager**: Final approval authority
4. **If Approved**: Disbursement authorization

---

## Data Filtering Rules

### Admin/Manager
- **Sees**: Everything in the system
- **Filters**: None

### Committee
- **Sees**: All data relevant to oversight
- **Filters**: Can access all member and transaction data

### Teller
- **Sees**: Operational data only
- **Filters**: 
  - Cannot see other staff's approval decisions
  - Cannot access audit logs
  - Cannot see system configuration

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

### Manager Dashboard
- Performance Metrics
- High-Value Approvals
- Staff Monitoring
- Strategic Reports

### Committee Dashboard
- Pending Approvals
- Member Applications
- Policy Compliance
- Financial Reports

### Teller Dashboard
- Daily Operations
- Member Services
- Transaction Processing
- Basic Reports

### Member Dashboard
- Account Summary
- Transaction History
- Loan Status
- Personal Settings