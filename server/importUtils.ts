import { storage } from './storage';
import { insertMemberSchema, insertSavingsAccountSchema, insertTransactionSchema } from '@shared/schema';
import { z } from 'zod';

interface ImportedMember {
  memberNumber?: string;
  fullName: string;
  nationalId: string;
  phoneNumber?: string;
  email?: string;
  department?: string;
  initialSavings?: number;
  [key: string]: any;
}

interface ImportedSavingsAccount {
  memberNumber: string;
  accountType: string;
  balance: number;
  [key: string]: any;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  successfulImports: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  importedMembers: number;
  importedAccounts: number;
}

export async function importSavingsFromExcel(filePath: string): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    successfulImports: 0,
    errors: [],
    importedMembers: 0,
    importedAccounts: 0
  };

  try {
    // Dynamic import for XLSX with proper ES module handling
    const XLSX = await import('xlsx');
    const fs = await import('fs');
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      result.errors.push({ row: 0, error: `File not found: ${filePath}` });
      return result;
    }
    
    // Read the Excel file using default export
    console.log('Reading file from:', filePath);
    const workbook = XLSX.default ? XLSX.default.readFile(filePath) : XLSX.readFile(filePath);
    console.log('Workbook sheets:', workbook.SheetNames);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON using utils
    const utils = XLSX.default ? XLSX.default.utils : XLSX.utils;
    const rawData = utils.sheet_to_json(worksheet, { header: 1 });
    
    if (rawData.length === 0) {
      result.errors.push({ row: 0, error: "File is empty" });
      return result;
    }

    console.log('Excel data analysis:');
    console.log('Total rows:', rawData.length);
    console.log('First few rows:', rawData.slice(0, 8));
    console.log('Sample transaction rows (rows 10-15):', rawData.slice(10, 16));

    // This appears to be a bank statement format, not a member list
    // Extract account holder information from the first rows
    let accountName = '';
    let accountNumber = '';
    let closingBalance = 0;

    // Parse account information from the header rows
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      const row = rawData[i] as any[];
      if (row[0] === 'ACCOUNT NAME: ' && row[1]) {
        accountName = row[1];
      }
      if (row[0] === 'ACCOUNT NUMBER:' && row[1]) {
        accountNumber = row[1].toString();
      }
      if (row[0] === 'ACCOUNT NAME: ' && row[4]) {
        closingBalance = parseFloat(row[4]) || 0;
      }
    }

    console.log('Extracted account info:', { accountName, accountNumber, closingBalance });

    // Find the transaction data header row
    let headerRowIndex = -1;
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      if (row.includes('POSTING DATE') && row.includes('DETAILS') && row.includes('BALANCE')) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      result.errors.push({ row: 0, error: "Could not find transaction data header" });
      return result;
    }

    const transactionRows = rawData.slice(headerRowIndex + 1);
    result.totalRows = 1; // We're creating one member from this statement

    if (!accountName) {
      result.errors.push({ row: 0, error: "Could not extract account holder name from statement" });
      return result;
    }

    try {
      // Create member data from the bank statement
      const memberData = {
        fullName: accountName,
        idNumber: `STMT${accountNumber}`,
        phoneNumber: '0700000000',
        email: `${accountName.toLowerCase().replace(/\s+/g, '.')}@email.com`,
        department: 'Import',
        monthlySavings: '100000',
        shareContribution: '20000', 
        numberOfShares: 4,
        status: 'active' as const,
        gender: 'male' as const,
        averageNetPay: Math.round(closingBalance / 12).toString(),
        staffAccountNumber: accountNumber,
        nextOfKinName: 'Next of Kin',
        nextOfKinPhone: '0700000000',
        // Add missing required fields
        dateOfBirth: '1990-01-01',
        address: '123 Main Street',
        maritalStatus: 'single' as const,
        section: 'General',
        termsOfService: 'permanent' as const,
        accountNumber: accountNumber,
        branch: 'Main Branch',
        beneficiaryName: accountName,
        beneficiaryRelationship: 'Self',
        beneficiaryContact: '0700000000',
        role: 'member' as const
      };

      // Check if member already exists
      const existingMember = await storage.getMemberByIdNumber(memberData.idNumber);
      
      let member;
      if (existingMember) {
        member = existingMember;
        console.log(`Member already exists: ${member.fullName} (${member.memberNumber})`);
      } else {
        // Generate member number
        const memberCount = await storage.getMembersCount();
        const memberNumber = `IMP${String(memberCount + 1).padStart(6, '0')}`;
        
        console.log('Member data before validation:', { ...memberData, memberNumber });
        
        const validatedMemberData = insertMemberSchema.parse({
          ...memberData,
          memberNumber
        });
        
        console.log('Member data after validation:', validatedMemberData);
        
        member = await storage.createMember(validatedMemberData);
        result.importedMembers++;
        console.log(`Created new member: ${member.fullName} (${member.memberNumber})`);
      }

      // Update existing savings account or create if none exists
      if (closingBalance > 0) {
        const existingAccounts = await storage.getSavingsAccountsByMember(member.id);
        let regularAccount = existingAccounts.find(acc => acc.accountType === 'regular');

        if (!regularAccount) {
          // Create new savings account only if none exists
          const savingsData = {
            memberId: member.id,
            accountNumber: `SAV${accountNumber}`,
            accountType: 'regular' as const,
            balance: closingBalance.toString(),
            status: 'active' as const
          };

          const validatedSavingsData = insertSavingsAccountSchema.parse(savingsData);
          regularAccount = await storage.createSavingsAccount(validatedSavingsData);
          result.importedAccounts++;
          console.log(`Created savings account: UGX ${closingBalance.toLocaleString()}`);
        } else {
          // Update existing account balance directly
          await storage.updateSavingsAccountBalanceDirect(regularAccount.id, closingBalance.toString());
          console.log(`Updated savings account balance: UGX ${closingBalance.toLocaleString()}`);
        }

        // Process transaction entries from the bank statement
        const transactionEntries = [];
        console.log(`Processing ${transactionRows.length} transaction rows starting from row ${headerRowIndex + 1}`);
        
        for (let i = 0; i < transactionRows.length; i++) {
          const row = transactionRows[i] as any[];
          console.log(`Row ${i + 1}:`, row);
          
          if (row.length >= 5 && row[0] && row[1]) {
            const postingDate = parseExcelDate(row[0]);
            const details = row[1]?.toString() || '';
            const debitAmount = parseFloat(row[2]) || 0;
            const creditAmount = parseFloat(row[3]) || 0;
            const balance = parseFloat(row[4]) || 0;

            console.log(`Transaction ${i + 1}:`, { postingDate, details, debitAmount, creditAmount, balance });

            if (creditAmount > 0 || debitAmount > 0) {
              const transactionData = {
                memberId: member.id,
                savingsAccountId: regularAccount.id,
                transactionType: creditAmount > 0 ? 'deposit' as const : 'withdrawal' as const,
                amount: (creditAmount > 0 ? creditAmount : debitAmount).toString(),
                description: details,
                transactionDate: new Date(postingDate),
                referenceNumber: `STMT-${accountNumber}-${i + 1}`,
                processedBy: 'system',
                status: 'completed' as const
              };

              console.log(`Creating transaction ${i + 1}:`, transactionData);
              
              try {
                const validatedTransactionData = insertTransactionSchema.parse(transactionData);
                transactionEntries.push(validatedTransactionData);
                console.log(`✓ Valid transaction ${i + 1} added`);
              } catch (error) {
                console.log(`✗ Invalid transaction on row ${i + 1}:`, error);
                console.log('Transaction data that failed:', transactionData);
              }
            }
          }
        }

        // Bulk create transactions
        if (transactionEntries.length > 0) {
          for (const transaction of transactionEntries) {
            await storage.createTransaction(transaction);
          }
          console.log(`Imported ${transactionEntries.length} transaction entries`);
        }
      }

      result.successfulImports = 1;

    } catch (error) {
      result.errors.push({
        row: 1,
        error: `Failed to process bank statement: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { accountName, accountNumber, closingBalance }
      });
    }

    result.success = result.errors.length < result.totalRows;
    console.log('Import completed:', result);
    return result;

  } catch (error) {
    console.error('Import failed:', error);
    result.errors.push({
      row: 0,
      error: `File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    return result;
  }
}

function extractMemberData(rowData: any, rowIndex: number): any {
  // Try to map common column names to our schema
  const memberData: any = {
    status: 'active', // Default status
    membershipDate: new Date(), // Default to today
    shareContribution: 0, // Default
    monthlySavings: 0 // Default
  };

  // Map various possible column names
  const columnMappings: Record<string, string[]> = {
    memberNumber: ['Member Number', 'Member ID', 'ID', 'MemberNo', 'Member_Number'],
    fullName: ['Full Name', 'Name', 'Member Name', 'Full_Name', 'Customer Name'],
    nationalId: ['National ID', 'ID Number', 'National_ID', 'NationalID', 'NIDA'],
    phoneNumber: ['Phone', 'Phone Number', 'Mobile', 'Contact', 'Phone_Number'],
    email: ['Email', 'Email Address', 'E-mail'],
    department: ['Department', 'Dept', 'Division'],
    balance: ['Balance', 'Amount', 'Savings', 'Current Balance', 'Account Balance'],
    gender: ['Gender', 'Sex'],
    averageNetPay: ['Net Pay', 'Salary', 'Average Net Pay', 'Monthly Pay'],
    staffAccountNumber: ['Staff Number', 'Staff ID', 'Employee ID', 'Staff_ID']
  };

  // Map the data
  Object.keys(columnMappings).forEach(field => {
    const possibleColumns = columnMappings[field];
    for (const col of possibleColumns) {
      if (rowData[col] !== undefined && rowData[col] !== null && rowData[col] !== '') {
        if (field === 'balance') {
          // Store balance separately for savings account creation
          memberData.initialBalance = parseFloat(rowData[col]) || 0;
        } else if (field === 'averageNetPay') {
          memberData[field] = parseFloat(rowData[col]) || 0;
        } else {
          memberData[field] = rowData[col];
        }
        break;
      }
    }
  });

  // Generate member number if not provided
  if (!memberData.memberNumber) {
    memberData.memberNumber = `IMP${String(rowIndex).padStart(6, '0')}`;
  }

  // Ensure required fields
  if (!memberData.fullName) {
    throw new Error('Full name is required');
  }

  if (!memberData.nationalId) {
    // Generate a temporary national ID if not provided
    memberData.nationalId = `TEMP${Date.now()}${rowIndex}`;
  }

  return memberData;
}

function extractSavingsData(rowData: any, rowIndex: number): any | null {
  // Extract balance from various possible column names
  const balanceColumns = ['Balance', 'Amount', 'Savings', 'Current Balance', 'Account Balance', 'Initial Amount'];
  let balance = 0;

  for (const col of balanceColumns) {
    if (rowData[col] !== undefined && rowData[col] !== null && rowData[col] !== '') {
      balance = parseFloat(rowData[col]) || 0;
      break;
    }
  }

  if (balance <= 0) {
    return null; // No savings account needed
  }

  // Extract account type
  const accountTypeColumns = ['Account Type', 'Type', 'Savings Type'];
  let accountType = 'regular'; // default

  for (const col of accountTypeColumns) {
    if (rowData[col] !== undefined && rowData[col] !== null && rowData[col] !== '') {
      accountType = rowData[col].toString().toLowerCase();
      break;
    }
  }

  // Generate account number
  const accountNumber = `SAV${String(Date.now()).slice(-6)}${String(rowIndex).padStart(3, '0')}`;

  return {
    accountNumber,
    accountType,
    balance,
    status: 'active'
  };
}

// Helper function to parse Excel date values
function parseExcelDate(excelDate: any): string {
  if (typeof excelDate === 'number') {
    // Excel date serial number to JavaScript Date
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  } else if (typeof excelDate === 'string') {
    // Try to parse as date string
    const date = new Date(excelDate);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  // Default to today if parsing fails
  return new Date().toISOString().split('T')[0];
}