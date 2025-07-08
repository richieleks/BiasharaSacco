-- Test SQL to create sample data for business rules validation

-- Create test members with proper membership dates and savings data
UPDATE members 
SET 
  membership_date = CURRENT_DATE - INTERVAL '4 months',
  last_activity_date = CURRENT_DATE - INTERVAL '1 day',
  share_capital = 500000,
  total_savings = 750000,
  is_fully_paid_shareholder = true,
  is_active_saver = true,
  is_defaulter = false
WHERE status = 'active';

-- Update savings accounts with proper first deposit dates
UPDATE savings_accounts 
SET 
  first_deposit_date = CURRENT_DATE - INTERVAL '4 months',
  is_gradually_built = true,
  balance = '750000'
WHERE status = 'active';

-- Add some transactions to establish savings pattern
INSERT INTO transactions (
  member_id, savings_account_id, type, amount, description, 
  processed_by_id, reference_number, status
) 
SELECT 
  m.id, 
  sa.id, 
  'deposit', 
  150000, 
  'Monthly savings deposit',
  m.id,
  'TXN' || FLOOR(RANDOM() * 1000000),
  'completed'
FROM members m
JOIN savings_accounts sa ON sa.member_id = m.id
WHERE m.status = 'active'
AND NOT EXISTS (
  SELECT 1 FROM transactions t 
  WHERE t.member_id = m.id 
  AND t.savings_account_id = sa.id
  AND t.created_at > CURRENT_DATE - INTERVAL '1 month'
);

-- Create some defaulter test cases
UPDATE members 
SET is_defaulter = true
WHERE id = (SELECT id FROM members WHERE status = 'active' LIMIT 1 OFFSET 1);

-- Create member with insufficient membership duration
INSERT INTO members (
  user_id, member_number, full_name, id_number, phone_number, email,
  date_of_birth, gender, occupation, employer, status,
  membership_date, last_activity_date, share_capital, total_savings,
  is_fully_paid_shareholder, is_active_saver, is_defaulter
) VALUES (
  '99999999', 'BCS000999', 'Test Newmember', '999999999', '+256777999999', 'test@example.com',
  '1990-01-01', 'Male', 'Teacher', 'Test School', 'active',
  CURRENT_DATE - INTERVAL '2 months', -- Only 2 months membership
  CURRENT_DATE,
  100000,
  200000,
  true,
  false, -- Not an active saver
  false
) ON CONFLICT (id_number) DO NOTHING;

-- Create savings account for new member with recent first deposit
INSERT INTO savings_accounts (
  member_id, account_number, account_type, balance, status,
  first_deposit_date, is_gradually_built
) 
SELECT 
  m.id,
  'SAV00000999',
  'Regular Savings',
  '200000',
  'active',
  CURRENT_DATE - INTERVAL '1 month', -- Recent first deposit
  false
FROM members m 
WHERE m.member_number = 'BCS000999'
ON CONFLICT (account_number) DO NOTHING;

-- Verify data
SELECT 
  m.member_number,
  m.full_name,
  m.membership_date,
  m.share_capital,
  m.total_savings,
  m.is_fully_paid_shareholder,
  m.is_active_saver,
  m.is_defaulter,
  sa.first_deposit_date,
  sa.is_gradually_built,
  sa.balance
FROM members m
LEFT JOIN savings_accounts sa ON sa.member_id = m.id
WHERE m.status = 'active'
ORDER BY m.created_at;