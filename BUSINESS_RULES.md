# Biashara SACCO Business Rules

## 1. Membership Rules

### 1.1 Membership Application
- **BR-M001**: All new members must complete the membership application form with mandatory fields:
  - Full name, ID number, date of birth
  - Postal address and telephone contact
  - Department and section
  - Terms of service (Permanent, Temporary, Contract, Ex-staff)
  - Marital status
  - Beneficiary details (name, relationship, contact)

### 1.2 Financial Requirements
- **BR-M002**: Entrance fee of UGX 15,000 is mandatory for all new members
- **BR-M003**: Minimum share capital contribution of UGX 20,000 (4 shares at UGX 5,000 each)
- **BR-M004**: Members must commit to minimum monthly savings deposit
- **BR-M005**: Account number and branch must be provided for savings deposits

### 1.3 Approval Process
- **BR-M006**: All membership applications require committee approval
- **BR-M007**: Members receive unique membership numbers upon approval
- **BR-M008**: Only approved members can access loan facilities

## 2. Loan Application Rules

### 2.1 Eligibility Requirements
- **BR-L001**: Only active SACCO members can apply for loans
- **BR-L002**: Members cannot have more than one pending loan application
- **BR-L003**: Members must have minimum savings balance before loan eligibility
- **BR-L004**: Staff account number is required for employee members

### 2.2 Loan Application Process
- **BR-L005**: Loan applications must specify:
  - Amount applied for (in figures and words)
  - Purpose of the loan
  - Repayment period and monthly repayment amount
  - Security/collateral offered (if any)
  - Whether it's a top-up loan or new loan

### 2.3 Guarantor Requirements
- **BR-L006**: Most loans require guarantors (except emergency loans under certain limits)
- **BR-L007**: Guarantors must be active SACCO members
- **BR-L008**: Each guarantor must specify guaranteed amount
- **BR-L009**: Total guaranteed amount must cover loan principal
- **BR-L010**: Guarantors must approve before loan disbursement
- **BR-L011**: Members cannot guarantee themselves

### 2.4 Top-up Loans
- **BR-L012**: Top-up loans are allowed for existing borrowers
- **BR-L013**: Previous loan balance must be clearly stated
- **BR-L014**: New total loan amount calculation must be accurate
- **BR-L015**: Top-up eligibility based on repayment history

## 3. Approval Workflow Rules

### 3.1 Multi-Stage Approval
- **BR-A001**: Loans under UGX 100,000 (emergency) bypass teller stage
- **BR-A002**: Standard loans: Teller → Committee → Disbursement
- **BR-A003**: High-value loans (>UGX 500,000): Teller → Committee → Manager
- **BR-A004**: Each stage can approve, reject, or escalate

### 3.2 Role-Based Permissions
- **BR-A005**: Tellers can process deposits/withdrawals and initial loan review
- **BR-A006**: Committee members can approve standard loans
- **BR-A007**: Managers can approve high-value loans and override decisions
- **BR-A008**: Admins have full system access and can manage roles

## 4. Interest and Repayment Rules

### 4.1 Interest Calculation
- **BR-I001**: Interest rates are set per loan type/product
- **BR-I002**: Support for simple, compound, and reducing balance methods
- **BR-I003**: Interest calculation method must be specified per loan type
- **BR-I004**: Compounding frequency configurable (monthly, quarterly, annually)

### 4.2 Repayment Rules
- **BR-R001**: Monthly repayment amount must be calculated and agreed upon
- **BR-R002**: Signed repayment schedule required
- **BR-R003**: Early repayment allowed with interest savings calculation
- **BR-R004**: Late payment penalties as per loan terms

## 5. Savings Account Rules

### 5.1 Account Types
- **BR-S001**: Regular savings accounts for all members
- **BR-S002**: Fixed deposit accounts with higher interest rates
- **BR-S003**: Group savings accounts for collective saving

### 5.2 Transaction Rules
- **BR-S004**: Minimum balance requirements per account type
- **BR-S005**: Withdrawal limits and approval requirements
- **BR-S006**: Interest calculation and posting periods

## 6. Security and Audit Rules

### 6.1 Access Control
- **BR-SEC001**: Role-based access control for all system functions
- **BR-SEC002**: Audit trail for all financial transactions
- **BR-SEC003**: User activity logging and monitoring

### 6.2 Data Integrity
- **BR-SEC004**: All transactions must be properly authorized
- **BR-SEC005**: Financial records must be tamper-proof
- **BR-SEC006**: Regular backup and data protection measures

## 7. Notification Rules

### 7.1 Member Notifications
- **BR-N001**: Notify members of loan application status changes
- **BR-N002**: Send repayment reminders before due dates
- **BR-N003**: Alert members of deposits and withdrawals

### 7.2 Staff Notifications
- **BR-N004**: Notify relevant staff of new applications requiring approval
- **BR-N005**: Alert administrators of system issues and exceptions