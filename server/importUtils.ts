import { storage } from './storage';
import { insertMemberSchema, insertSavingsAccountSchema, insertTransactionSchema, insertLoanSchema } from '@shared/schema';
import { z } from 'zod';

function excelDateToDate(excelDate: any): Date {
  if (typeof excelDate === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return new Date(excelEpoch.getTime() + (excelDate - 2) * millisecondsPerDay);
  }
  if (excelDate instanceof Date) {
    return excelDate;
  }
  if (typeof excelDate === 'string') {
    const trimmed = excelDate.trim();
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
      return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  console.log(`Warning: Could not parse date value: ${JSON.stringify(excelDate)} (type: ${typeof excelDate}), defaulting to current date`);
  return new Date();
}

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
  skippedDuplicates: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  importedMembers: number;
  importedAccounts: number;
  importedLoans?: number;
}

export async function importSavingsFromExcel(filePath: string, options?: { createNewMembers?: boolean; userId?: string }): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    successfulImports: 0,
    skippedDuplicates: 0,
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
      const shouldCreateMembers = options?.createNewMembers !== false;
      
      // Use account number as the unique reference to find existing members
      let member;
      const allMembers = await storage.getAllMembers();
      const existingMember = allMembers.find(m => 
        m.accountNumber === accountNumber || 
        m.staffAccountNumber === accountNumber
      );
      
      if (existingMember) {
        member = existingMember;
        console.log(`Member already exists (matched by account number ${accountNumber}): ${member.fullName} (${member.memberNumber})`);
      } else if (shouldCreateMembers) {
        const memberData = {
          fullName: accountName,
          idNumber: accountNumber,
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

        const memberCount = await storage.getMembersCount();
        const memberNumber = `BCS${String(memberCount + 1).padStart(6, '0')}`;
        
        const validatedMemberData = insertMemberSchema.parse({
          ...memberData,
          memberNumber
        });
        
        member = await storage.createMember(validatedMemberData);
        result.importedMembers++;
        console.log(`Created new member: ${member.fullName} (${member.memberNumber})`);
      } else {
        result.errors.push({
          row: 1,
          error: `Member not found for account number "${accountNumber}" (${accountName}) and member creation is disabled`,
          data: { accountName, accountNumber }
        });
        result.success = result.errors.length < result.totalRows;
        return result;
      }

      // Use account number as unique reference for savings account
      const savingsAccountRef = `SAV${accountNumber}`;
      const existingAccounts = await storage.getSavingsAccountsByMember(member.id);
      let regularAccount = existingAccounts.find(acc => acc.accountNumber === savingsAccountRef || acc.accountType === 'regular');

      if (!regularAccount) {
        const savingsData = {
          memberId: member.id,
          accountNumber: savingsAccountRef,
          accountType: 'regular' as const,
          balance: closingBalance.toString(),
          status: 'active' as const
        };

        const validatedSavingsData = insertSavingsAccountSchema.parse(savingsData);
        regularAccount = await storage.createSavingsAccount(validatedSavingsData);
        result.importedAccounts++;
        console.log(`Created savings account ${savingsAccountRef}: UGX ${closingBalance.toLocaleString()}`);
      } else {
        await storage.updateSavingsAccountBalanceDirect(regularAccount.id, closingBalance.toString());
        console.log(`Updated savings account ${regularAccount.accountNumber} balance: UGX ${closingBalance.toLocaleString()}`);
      }

      // Get existing transactions for this account to avoid duplicates
      const existingTransactions = await storage.getTransactionsByMember(member.id);
      const existingRefNumbers = new Set(existingTransactions.map((t: any) => t.referenceNumber));

      // Process transaction entries from the bank statement
      const transactionEntries = [];
      let skippedDuplicates = 0;
      
      for (let i = 0; i < transactionRows.length; i++) {
        const row = transactionRows[i] as any[];
        
        if (row.length >= 5 && row[0] && row[1]) {
          const postingDate = excelDateToDate(row[0]);
          if (i < 3) {
            console.log(`Row ${i + 1} raw date value: ${JSON.stringify(row[0])} (type: ${typeof row[0]}) -> parsed: ${postingDate.toISOString()}`);
          }
          const details = row[1]?.toString() || '';
          const debitAmount = parseFloat(row[2]) || 0;
          const creditAmount = parseFloat(row[3]) || 0;

          if (creditAmount > 0 || debitAmount > 0) {
            const refNumber = `STMT-${accountNumber}-${i + 1}`;
            
            if (existingRefNumbers.has(refNumber)) {
              skippedDuplicates++;
              continue;
            }

            const transactionData = {
              memberId: member.id,
              savingsAccountId: regularAccount.id,
              transactionType: creditAmount > 0 ? 'deposit' as const : 'withdrawal' as const,
              amount: (creditAmount > 0 ? creditAmount : debitAmount).toString(),
              description: details,
              transactionDate: postingDate,
              referenceNumber: refNumber,
              processedBy: options?.userId,
              status: 'completed' as const
            };
            
            try {
              const validatedTransactionData = insertTransactionSchema.parse(transactionData);
              transactionEntries.push(validatedTransactionData);
            } catch (error) {
              console.log(`✗ Invalid transaction on row ${i + 1}:`, error);
            }
          }
        }
      }

      if (skippedDuplicates > 0) {
        console.log(`Skipped ${skippedDuplicates} duplicate transactions`);
      }

      if (transactionEntries.length > 0) {
        for (const transaction of transactionEntries) {
          await storage.createTransaction(transaction);
        }
        console.log(`Imported ${transactionEntries.length} new transaction entries`);
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

export async function importMembersFromExcel(filePath: string, options?: { userId?: string }): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    successfulImports: 0,
    skippedDuplicates: 0,
    errors: [],
    importedMembers: 0,
    importedAccounts: 0
  };

  try {
    const XLSX = await import('xlsx');
    const fs = await import('fs');

    if (!fs.existsSync(filePath)) {
      result.errors.push({ row: 0, error: `File not found: ${filePath}` });
      return result;
    }

    const workbook = XLSX.default ? XLSX.default.readFile(filePath) : XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const utils = XLSX.default ? XLSX.default.utils : XLSX.utils;
    const rawData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (rawData.length < 2) {
      result.errors.push({ row: 0, error: "File has no data rows (only header or empty)" });
      return result;
    }

    const headers = rawData[0].map((h: any) => (h || '').toString().trim().toLowerCase());
    console.log('Member import headers:', headers);

    const colMap: Record<string, number> = {};
    const mappings: [string, string[]][] = [
      ['name', ['name (capital letters)', 'name', 'full name', 'fullname', 'member name']],
      ['idNumber', ['id number', 'id no', 'national id', 'id']],
      ['dateOfBirth', ['date of birth', 'dob', 'birth date', 'birthdate']],
      ['gender', ['gender', 'sex']],
      ['address', ['postal address', 'address', 'postal']],
      ['phone', ['tel contact', 'phone', 'phone number', 'telephone', 'mobile', 'contact']],
      ['email', ['email', 'email address', 'e-mail']],
      ['maritalStatus', ['marital status', 'marital']],
      ['department', ['department', 'dept']],
      ['section', ['section']],
      ['termsOfService', ['terms of service', 'terms', 'employment type', 'service terms']],
      ['averageNetPay', ['average net pay (ugx)', 'average net pay', 'net pay', 'salary']],
      ['staffAccountNumber', ['staff account number', 'staff account', 'staff acc', 'employee number']],
      ['nextOfKinName', ['next of kin name', 'next of kin', 'nok name', 'kin name']],
      ['nextOfKinPhone', ['nok phone number', 'nok phone', 'kin phone', 'next of kin phone']],
      ['monthlySavings', ['monthly deposit amount (ugx)', 'monthly deposit amount', 'monthly savings', 'monthly deposit', 'deposit amount']],
      ['accountNumber', ['account number', 'account no', 'acc number', 'bank account']],
      ['branch', ['branch', 'bank branch']],
      ['numberOfShares', ['number of shares', 'shares', 'no of shares']],
      ['shareContribution', ['share contribution (shs)', 'share contribution', 'share amount', 'contribution per share']],
      ['beneficiaryName', ['beneficiary name (in case of death)', 'beneficiary name', 'beneficiary']],
      ['beneficiaryRelationship', ['relationship']],
      ['beneficiaryContact', ['contact address', 'beneficiary contact', 'beneficiary address']],
      ['dateJoined', ['date joined', 'join date', 'joined', 'membership date', 'date of joining']],
    ];

    for (const [key, variants] of mappings) {
      const idx = headers.findIndex((h: string) => {
        if (colMap[key] !== undefined) return false;
        return variants.some(v => {
          if (h === v) return true;
          if (h.includes(v)) {
            const alreadyMapped = Object.values(colMap).includes(headers.indexOf(h));
            if (alreadyMapped) return false;
            return true;
          }
          return false;
        });
      });
      if (idx !== -1) colMap[key] = idx;
    }

    console.log('Column mapping:', colMap);

    if (colMap.name === undefined) {
      result.errors.push({ row: 0, error: "Could not find 'Name' column in the Excel file" });
      return result;
    }

    const dataRows = rawData.slice(1).filter((row: any[]) => row.length > 0 && row[colMap.name]);
    result.totalRows = dataRows.length;

    const allMembers = await storage.getAllMembers();
    const memberCount = await storage.getMembersCount();
    let newMemberIndex = memberCount;

    const seenIdNumbers = new Set<string>();
    const seenStaffAccounts = new Set<string>();
    const seenBankAccounts = new Set<string>();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;

      try {
        const fullName = (row[colMap.name] || '').toString().trim();
        if (!fullName) {
          result.errors.push({ row: rowNum, error: 'Missing name' });
          continue;
        }

        const idNumber = colMap.idNumber !== undefined ? (row[colMap.idNumber] || '').toString().trim() : '';
        const staffAccNum = colMap.staffAccountNumber !== undefined ? (row[colMap.staffAccountNumber] || '').toString().trim() : '';
        const accountNum = colMap.accountNumber !== undefined ? (row[colMap.accountNumber] || '').toString().trim() : '';

        if (!idNumber) {
          result.errors.push({
            row: rowNum,
            error: `Missing ID number for member "${fullName}". Every member must have a valid ID number.`,
            data: { fullName }
          });
          continue;
        }

        if (seenIdNumbers.has(idNumber)) {
          result.skippedDuplicates++;
          result.errors.push({
            row: rowNum,
            error: `Duplicate ID number "${idNumber}" within this file: member "${fullName}" has the same ID as another row in this import`,
            data: { fullName, idNumber, matchedField: 'idNumber' }
          });
          continue;
        }

        if (staffAccNum && seenStaffAccounts.has(staffAccNum)) {
          result.skippedDuplicates++;
          result.errors.push({
            row: rowNum,
            error: `Duplicate staff account "${staffAccNum}" within this file: member "${fullName}" has the same staff account as another row in this import`,
            data: { fullName, idNumber, matchedField: 'staffAccountNumber' }
          });
          continue;
        }

        if (accountNum && seenBankAccounts.has(accountNum)) {
          result.skippedDuplicates++;
          result.errors.push({
            row: rowNum,
            error: `Duplicate bank account "${accountNum}" within this file: member "${fullName}" has the same bank account as another row in this import`,
            data: { fullName, idNumber, matchedField: 'accountNumber' }
          });
          continue;
        }

        const duplicateByIdNumber = allMembers.find(m => idNumber && m.idNumber === idNumber);
        if (duplicateByIdNumber) {
          result.skippedDuplicates++;
          result.errors.push({
            row: rowNum,
            error: `Duplicate ID number "${idNumber}": matches existing member ${duplicateByIdNumber.fullName} (${duplicateByIdNumber.memberNumber})`,
            data: { fullName, idNumber, matchedField: 'idNumber' }
          });
          continue;
        }

        if (staffAccNum) {
          const duplicateByStaffAcc = allMembers.find(m => m.staffAccountNumber === staffAccNum);
          if (duplicateByStaffAcc) {
            result.skippedDuplicates++;
            result.errors.push({
              row: rowNum,
              error: `Duplicate staff account "${staffAccNum}": matches existing member ${duplicateByStaffAcc.fullName} (${duplicateByStaffAcc.memberNumber})`,
              data: { fullName, idNumber, matchedField: 'staffAccountNumber' }
            });
            continue;
          }
        }

        if (accountNum) {
          const duplicateByBankAcc = allMembers.find(m => m.accountNumber === accountNum);
          if (duplicateByBankAcc) {
            result.skippedDuplicates++;
            result.errors.push({
              row: rowNum,
              error: `Duplicate bank account "${accountNum}": matches existing member ${duplicateByBankAcc.fullName} (${duplicateByBankAcc.memberNumber})`,
              data: { fullName, idNumber, matchedField: 'accountNumber' }
            });
            continue;
          }
        }

        const rawGender = colMap.gender !== undefined ? (row[colMap.gender] || '').toString().trim().toLowerCase() : '';
        const gender = rawGender.startsWith('f') ? 'female' as const : 'male' as const;

        const rawMarital = colMap.maritalStatus !== undefined ? (row[colMap.maritalStatus] || '').toString().trim().toLowerCase() : '';
        let maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' = 'single';
        if (rawMarital.startsWith('m')) maritalStatus = 'married';
        else if (rawMarital.startsWith('d')) maritalStatus = 'divorced';
        else if (rawMarital.startsWith('w')) maritalStatus = 'widowed';

        const rawTerms = colMap.termsOfService !== undefined ? (row[colMap.termsOfService] || '').toString().trim().toLowerCase() : '';
        let termsOfService: 'permanent' | 'temporary' | 'contract' | 'ex-staff' = 'permanent';
        if (rawTerms.includes('temp')) termsOfService = 'temporary';
        else if (rawTerms.includes('contract')) termsOfService = 'contract';
        else if (rawTerms.includes('ex')) termsOfService = 'ex-staff';

        const dobRaw = colMap.dateOfBirth !== undefined ? row[colMap.dateOfBirth] : null;
        let dateOfBirth = '1990-01-01';
        if (dobRaw) {
          const parsed = excelDateToDate(dobRaw);
          if (!isNaN(parsed.getTime())) {
            dateOfBirth = parsed.toISOString().split('T')[0];
          }
        }

        const phone = colMap.phone !== undefined ? (row[colMap.phone] || '').toString().trim() : '0700000000';
        const email = colMap.email !== undefined ? (row[colMap.email] || '').toString().trim() : '';
        const address = colMap.address !== undefined ? (row[colMap.address] || '').toString().trim() : '';
        const department = colMap.department !== undefined ? (row[colMap.department] || '').toString().trim() : '';
        const section = colMap.section !== undefined ? (row[colMap.section] || '').toString().trim() : '';
        const averageNetPay = colMap.averageNetPay !== undefined ? (parseFloat(row[colMap.averageNetPay]) || 0).toString() : '0';
        const staffAccountNumber = staffAccNum;
        const nextOfKinName = colMap.nextOfKinName !== undefined ? (row[colMap.nextOfKinName] || '').toString().trim() : '';
        const nextOfKinPhone = colMap.nextOfKinPhone !== undefined ? (row[colMap.nextOfKinPhone] || '').toString().trim() : '';
        const monthlySavings = colMap.monthlySavings !== undefined ? (parseFloat(row[colMap.monthlySavings]) || 0).toString() : '0';
        const accountNumber = accountNum;
        const branch = colMap.branch !== undefined ? (row[colMap.branch] || '').toString().trim() : '';
        const numberOfShares = colMap.numberOfShares !== undefined ? (parseInt(row[colMap.numberOfShares]) || 4) : 4;
        const shareContribution = colMap.shareContribution !== undefined ? (parseFloat(row[colMap.shareContribution]) || 20000).toString() : '20000';
        const beneficiaryName = colMap.beneficiaryName !== undefined ? (row[colMap.beneficiaryName] || '').toString().trim() : '';
        const beneficiaryRelationship = colMap.beneficiaryRelationship !== undefined ? (row[colMap.beneficiaryRelationship] || '').toString().trim() : '';
        const beneficiaryContact = colMap.beneficiaryContact !== undefined ? (row[colMap.beneficiaryContact] || '').toString().trim() : '';

        const dateJoinedRaw = colMap.dateJoined !== undefined ? row[colMap.dateJoined] : null;
        let joinDate: string | null = null;
        if (dateJoinedRaw) {
          const parsedJoinDate = excelDateToDate(dateJoinedRaw);
          if (!isNaN(parsedJoinDate.getTime())) {
            joinDate = parsedJoinDate.toISOString();
          }
        }

        newMemberIndex++;
        const memberNumber = `BCS${String(newMemberIndex).padStart(6, '0')}`;

        const memberData = {
          memberNumber,
          fullName,
          idNumber,
          dateOfBirth,
          gender,
          phoneNumber: phone || '0700000000',
          email: email || `${fullName.toLowerCase().replace(/\s+/g, '.')}@import.local`,
          address: address || 'N/A',
          maritalStatus,
          department: department || 'General',
          section: section || 'General',
          termsOfService,
          averageNetPay,
          staffAccountNumber,
          monthlySavings,
          accountNumber,
          branch,
          shareContribution,
          numberOfShares,
          beneficiaryName,
          beneficiaryRelationship,
          beneficiaryContact,
          nextOfKinName,
          nextOfKinPhone,
          status: 'active' as const,
          role: 'member' as const,
          ...(joinDate ? { joinDate: new Date(joinDate) } : {}),
        };

        const validatedMemberData = insertMemberSchema.parse(memberData);
        const createdMember = await storage.createMember(validatedMemberData);
        result.importedMembers++;
        result.successfulImports++;

        seenIdNumbers.add(idNumber);
        if (staffAccountNumber) seenStaffAccounts.add(staffAccountNumber);
        if (accountNumber) seenBankAccounts.add(accountNumber);
        allMembers.push(createdMember);

        if (parseFloat(monthlySavings) > 0 || accountNumber) {
          try {
            const savingsAccountRef = `SAV${accountNumber || memberNumber}`;
            const savingsData = {
              memberId: createdMember.id,
              accountNumber: savingsAccountRef,
              accountType: 'regular' as const,
              balance: '0',
              status: 'active' as const
            };
            const validatedSavingsData = insertSavingsAccountSchema.parse(savingsData);
            await storage.createSavingsAccount(validatedSavingsData);
            result.importedAccounts++;
          } catch (err) {
            console.log(`Warning: Could not create savings account for ${fullName}:`, err);
          }
        }

        console.log(`Imported member ${rowNum}: ${fullName} (${memberNumber})`);
      } catch (error) {
        result.errors.push({
          row: rowNum,
          error: `Failed to import member: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: { name: row[colMap.name] }
        });
      }
    }

    result.success = result.importedMembers > 0;
    console.log('Member import completed:', result);
    return result;

  } catch (error) {
    console.error('Member import failed:', error);
    result.errors.push({
      row: 0,
      error: `File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    return result;
  }
}

// Function to import loans from Excel file
export async function importLoansFromExcel(filePath: string, options?: { userId?: string; loanTypeId?: number }): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    successfulImports: 0,
    skippedDuplicates: 0,
    errors: [],
    importedMembers: 0,
    importedAccounts: 0,
    importedLoans: 0
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
    
    // Read the Excel file
    console.log('Reading loan file from:', filePath);
    const workbook = XLSX.default ? XLSX.default.readFile(filePath) : XLSX.readFile(filePath);
    console.log('Workbook sheets:', workbook.SheetNames);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const utils = XLSX.default ? XLSX.default.utils : XLSX.utils;
    const rawData = utils.sheet_to_json(worksheet, { header: 1 });
    
    if (rawData.length === 0) {
      result.errors.push({ row: 0, error: "File is empty" });
      return result;
    }

    console.log('Loan Excel data analysis:');
    console.log('Total rows:', rawData.length);
    console.log('First few rows:', rawData.slice(0, 8));

    // Extract account information from the first few rows
    let accountName = '';
    let accountNumber = '';
    let closingBalance = 0;
    let interestEarned = 0;
    let interestRateValue = 0;
    let tenure = 0;

    // Look for account info in first few rows - scan all cells in each row
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      const row = rawData[i] as any[];
      if (row && row.length > 1) {
        for (let j = 0; j < row.length; j++) {
          const cellText = row[j]?.toString().toUpperCase().trim() || '';
          if (cellText.includes('ACCOUNT NAME') && row[j + 1]) {
            accountName = row[j + 1]?.toString() || '';
          } else if (cellText.includes('ACCOUNT NUMBER') && row[j + 1]) {
            accountNumber = row[j + 1]?.toString() || '';
          } else if (cellText.includes('CLOSING BALANCE') && row[j + 1] !== undefined) {
            closingBalance = parseFloat(row[j + 1]) || 0;
          } else if (cellText.includes('INTEREST EARNED') && row[j + 1] !== undefined) {
            interestEarned = parseFloat(row[j + 1]) || 0;
          } else if (cellText === 'INTEREST RATE' && row[j + 1] !== undefined) {
            interestRateValue = parseFloat(row[j + 1]) || 0;
          } else if (cellText.includes('TENURE') && row[j + 1] !== undefined) {
            tenure = parseInt(row[j + 1]) || 12;
          }
        }
      }
    }

    console.log('Account Info:', { accountName, accountNumber, closingBalance, interestEarned, interestRateValue, tenure });

    // Find transaction header row (POSTING DATE, DETAILS, etc.)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i] as any[];
      if (row && row.length >= 4) {
        const rowText = row.join(' ').toLowerCase();
        if (rowText.includes('posting') && (rowText.includes('details') || rowText.includes('balance'))) {
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      result.errors.push({ row: 0, error: "No valid transaction header row found. Expected columns like POSTING DATE, DETAILS, BALANCE." });
      return result;
    }

    console.log('Found transaction header row at index:', headerRowIndex);
    const headerRow = rawData[headerRowIndex] as any[];
    console.log('Header row:', headerRow);

    // Process the loan statement and create loan record
    if (!accountName) {
      result.errors.push({ row: 1, error: "Account name not found in the statement" });
      return result;
    }

    try {
      console.log('Processing loan statement for:', accountName);

      // Read values directly from the header - no calculations
      const headerInterestRate = interestRateValue; // INTEREST RATE from header (e.g., 0.08 for 8%)
      const headerClosingBalance = closingBalance; // CLOSING BALANCE from header

      // Find the first disbursement date and the last installment amount directly from rows
      let firstDisbursementDate: Date | null = null;
      let lastInstallmentAmount = 0;

      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        if (!row || row.length < 3) continue;
        const details = row[1]?.toString().toLowerCase() || '';
        const amt = parseFloat(row[2]) || 0;

        if (!firstDisbursementDate && (details.includes('disbursed') || details.includes('loan amount'))) {
          firstDisbursementDate = excelDateToDate(row[0]);
        }
        if (amt > 0 && (details.includes('installment') || details.includes('instalment'))) {
          lastInstallmentAmount = amt;
        }
      }

      console.log(`Loan header values: Closing Balance=${headerClosingBalance}, Interest Earned=${headerInterestRate}, Tenure=${tenure}, Monthly Payment=${lastInstallmentAmount}`);

      // Match to existing member only - no auto-creation
      const allMembers = await storage.getAllMembers();
      let member = allMembers.find(m => 
        m.accountNumber === accountNumber ||
        m.staffAccountNumber === accountNumber
      );

      if (!member) {
        member = allMembers.find(m => 
          m.fullName?.toLowerCase().trim() === accountName.toLowerCase().trim()
        );
      }

      if (!member) {
        member = allMembers.find(m => 
          m.fullName?.toLowerCase().includes(accountName.toLowerCase()) ||
          accountName.toLowerCase().includes(m.fullName?.toLowerCase() || '')
        );
      }

      if (!member) {
        result.errors.push({
          row: 1,
          error: `No existing member found matching "${accountName}" (account: ${accountNumber}). Loan import requires an existing member. Please import the member first.`,
          data: { accountName, accountNumber }
        });
        result.totalRows = 1;
        result.success = false;
        return result;
      }

      console.log(`Matched to existing member: ${member.fullName} (${member.memberNumber})`);

      // Get loan type name for the enum field
      let loanTypeName: 'personal' | 'business' | 'emergency' | 'asset' | 'development' = 'personal';
      if (options?.loanTypeId) {
        const loanTypeRecord = await storage.getLoanType(options.loanTypeId);
        if (loanTypeRecord) {
          const nameMap: Record<string, 'personal' | 'business' | 'emergency' | 'asset' | 'development'> = {
            'personal': 'personal', 'business': 'business', 'emergency': 'emergency',
            'asset': 'asset', 'development': 'development'
          };
          loanTypeName = nameMap[loanTypeRecord.name.toLowerCase()] || 'personal';
          console.log(`Using loan type: ${loanTypeRecord.displayName} (${loanTypeName})`);
        }
      }

      // Import loan as-is from header values - no calculations
      const disbursementDate = firstDisbursementDate || new Date();
      
      const loanData = {
        memberId: member.id,
        loanNumber: `LOAN${String(Date.now()).slice(-6)}`,
        loanType: loanTypeName,
        principalAmount: headerClosingBalance.toString(),
        interestRate: headerInterestRate.toString(),
        termMonths: tenure || 12,
        monthlyPayment: lastInstallmentAmount.toString(),
        outstandingBalance: headerClosingBalance.toString(),
        status: 'active' as const,
        purpose: 'Imported from loan statement',
        applicationDate: disbursementDate,
        approvalDate: disbursementDate,
        disbursementDate: disbursementDate,
        currentSavings: '0'
      };

      const validatedLoanData = insertLoanSchema.parse(loanData);
      const createdLoan = await storage.createLoan(validatedLoanData);
      
      result.importedLoans = (result.importedLoans || 0) + 1;
      console.log(`✓ Created loan: ${loanData.loanNumber} for ${member.fullName} - Balance: UGX ${headerClosingBalance.toLocaleString()}`);

      // Import each transaction row as-is from the statement
      const transactionEntries = [];
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        if (!row || row.length < 3 || !row[0]) continue;
        
        const postingDate = excelDateToDate(row[0]);
        const details = row[1]?.toString() || '';
        const detailsLower = details.toLowerCase();
        const amtDebited = parseFloat(row[2]) || 0;
        const principalRepyt = parseFloat(row[3]) || 0;
        
        // Determine type from description
        const isDisbursement = detailsLower.includes('disbursed') || 
                               detailsLower.includes('loan amount') || 
                               detailsLower.includes('top up') || 
                               detailsLower.includes('top-up') ||
                               detailsLower.includes('topup');
        
        if (isDisbursement) {
          // Use the amount as-is from whichever column has it
          const amount = Math.abs(principalRepyt) || Math.abs(amtDebited);
          if (amount > 0) {
            transactionEntries.push({
              memberId: member.id,
              loanId: createdLoan.id,
              transactionType: 'loan_disbursement' as const,
              amount: amount.toString(),
              description: details,
              referenceNumber: `LTX${Date.now()}_${i}`,
              status: 'completed' as const,
              processedBy: options?.userId,
              transactionDate: postingDate
            });
          }
        } else if (amtDebited > 0) {
          // Payment row - use AMT DEBITED as-is
          transactionEntries.push({
            memberId: member.id,
            loanId: createdLoan.id,
            transactionType: 'loan_payment' as const,
            amount: amtDebited.toString(),
            description: details,
            referenceNumber: `LTX${Date.now()}_${i}`,
            status: 'completed' as const,
            processedBy: options?.userId,
            transactionDate: postingDate
          });
        }
      }

      // Create transactions
      if (transactionEntries.length > 0) {
        for (const transaction of transactionEntries) {
          const validatedTransactionData = insertTransactionSchema.parse(transaction);
          await storage.createTransaction(validatedTransactionData);
        }
        console.log(`Imported ${transactionEntries.length} loan transactions`);
      }

      result.totalRows = 1; // One loan statement
      result.successfulImports = 1;

    } catch (error) {
      console.error('Error processing loan statement:', error);
      result.errors.push({
        row: 1,
        error: `Failed to process loan: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    result.success = result.errors.length === 0;
    
    console.log('Loan import completed:', result);
    return result;

  } catch (error) {
    console.error('Loan import failed:', error);
    result.errors.push({
      row: 0,
      error: `File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    return result;
  }
}

// Helper function to calculate monthly payment
function calculateMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (annualRate === 0) return principal / termMonths;
  
  const monthlyRate = annualRate / 100 / 12;
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
                  (Math.pow(1 + monthlyRate, termMonths) - 1);
  return Math.round(payment * 100) / 100;
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