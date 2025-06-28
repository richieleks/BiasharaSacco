-- Test script to demonstrate guarantor approval workflow
-- This creates a complete scenario with loan application and guarantor requests

-- First, let's create a loan application that needs guarantors
INSERT INTO loans (
  member_id, 
  loan_number, 
  loan_type, 
  principal_amount, 
  interest_rate, 
  term_months, 
  purpose, 
  employment_status, 
  monthly_income, 
  other_loans, 
  collateral_description, 
  application_date, 
  status
) VALUES (
  6, -- Member ID (current user)
  'LOAN' || LPAD(EXTRACT(EPOCH FROM NOW())::text, 10, '0'),
  'personal',
  750000.00, -- UGX 750,000 loan
  12.5,
  24,
  'Business expansion',
  'employed',
  850000.00,
  'None',
  'Business assets and equipment',
  NOW(),
  'pending'
);

-- Get the loan ID for the guarantor requests
WITH new_loan AS (
  SELECT id FROM loans WHERE member_id = 6 ORDER BY created_at DESC LIMIT 1
)
-- Create guarantor requests for this loan
INSERT INTO guarantors (loan_id, guarantor_member_id, guarantee_amount, status)
SELECT 
  new_loan.id,
  member_id,
  amount
FROM new_loan
CROSS JOIN (VALUES 
  (1, 300000.00), -- First guarantor for UGX 300K
  (2, 250000.00), -- Second guarantor for UGX 250K  
  (3, 200000.00)  -- Third guarantor for UGX 200K
) AS guarantor_data(member_id, amount);

-- Update loan status to show it's waiting for guarantor approval
UPDATE loans 
SET status = 'pending_guarantors'
WHERE member_id = 6 
AND id = (SELECT id FROM loans WHERE member_id = 6 ORDER BY created_at DESC LIMIT 1);