import { storage } from './storage';
import { insertMemberSchema, insertSavingsAccountSchema, insertTransactionSchema, insertLoanSchema } from '@shared/schema';
import { z } from 'zod';
import { hashPassword } from './localAuth';

function generateDefaultPassword(fullName: string): string {
  const namePart = fullName.trim().split(/\s+/)[0] || 'Member';
  return `${namePart}@2026!`;
}

function generateUsername(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0]?.toLowerCase() || 'member';
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  return `${firstName[0]}${lastName}`.toLowerCase();
}

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
  exceptions: Array<{
    sheet: string;
    type: string;
    detail: string;
    data?: any;
  }>;
  importedMembers: number;
  importedAccounts: number;
  importedLoans?: number;
  totalSheets?: number;
  processedSheets?: number;
  skippedSheets?: number;
}

export type JournalEntryCallback = (mappingKey: string, amount: number, description: string, reference: string, userId: string) => Promise<void>;

export async function importSavingsFromExcel(filePath: string, options?: { createNewMembers?: boolean; userId?: string; onJournalEntry?: JournalEntryCallback }): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    successfulImports: 0,
    skippedDuplicates: 0,
    errors: [],
    exceptions: [],
    importedMembers: 0,
    importedAccounts: 0,
    totalSheets: 0,
    processedSheets: 0,
    skippedSheets: 0
  };

  try {
    const XLSX = await import('xlsx');
    const fs = await import('fs');
    
    if (!fs.existsSync(filePath)) {
      result.errors.push({ row: 0, error: `File not found: ${filePath}` });
      return result;
    }
    
    console.log('Reading file from:', filePath);
    const workbook = XLSX.default ? XLSX.default.readFile(filePath) : XLSX.readFile(filePath);
    const utils = XLSX.default ? XLSX.default.utils : XLSX.utils;
    console.log('Workbook sheets:', workbook.SheetNames);

    result.totalSheets = workbook.SheetNames.length;

    const sheetsToProcess = workbook.SheetNames.filter(name => {
      const ws = workbook.Sheets[name];
      const data = utils.sheet_to_json(ws, { header: 1 });
      return data.length > 0;
    });

    const emptySheets = workbook.SheetNames.filter(name => !sheetsToProcess.includes(name));
    for (const name of emptySheets) {
      result.exceptions.push({ sheet: name, type: 'skipped_empty', detail: 'Sheet has no data' });
    }

    if (sheetsToProcess.length === 0) {
      result.errors.push({ row: 0, error: "File is empty — no sheets with data found" });
      return result;
    }

    console.log(`Processing ${sheetsToProcess.length} sheet(s) with data: ${sheetsToProcess.join(', ')}`);
    const allMembers = await storage.getAllMembers();

    for (const sheetName of sheetsToProcess) {
      const worksheet = workbook.Sheets[sheetName];
      const rawData = utils.sheet_to_json(worksheet, { header: 1 });

      console.log(`\n--- Processing sheet: "${sheetName}" (${rawData.length} rows) ---`);

      let headerRowIndex = -1;
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        if (row.includes('POSTING DATE') && row.includes('DETAILS') && row.includes('BALANCE')) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        console.log(`Sheet "${sheetName}": No statement structure found, skipping`);
        result.skippedSheets!++;
        result.exceptions.push({ sheet: sheetName, type: 'skipped_no_structure', detail: 'No transaction header found (expected POSTING DATE, DETAILS, BALANCE columns)' });
        continue;
      }

      let accountName = '';
      const accountNumbers: string[] = [];
      let closingBalance = 0;

      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const row = rawData[i] as any[];
        if (row[0] === 'ACCOUNT NAME: ' && row[1]) {
          accountName = row[1];
        }
        if (row[0] === 'ACCOUNT NUMBER:' && row[1]) {
          accountNumbers.push(row[1].toString());
        }
        if (row[0] === 'ACCOUNT NAME: ' && row[4]) {
          closingBalance = parseFloat(row[4]) || 0;
        }
      }

      const isLikelyAccountNumber = (val: any) => {
        if (!val) return false;
        const str = val.toString().trim();
        return /^\d{5,}$/.test(str);
      };

      const row1 = (rawData[0] as any[]) || [];
      const row2 = (rawData[1] as any[]) || [];
      if (isLikelyAccountNumber(row1[2])) accountNumbers.push(row1[2].toString().trim());  // C1
      if (isLikelyAccountNumber(row2[2])) accountNumbers.push(row2[2].toString().trim());  // C2
      if (isLikelyAccountNumber(row2[1])) accountNumbers.push(row2[1].toString().trim());  // B2

      const uniqueAccountNumbers = [...new Set(accountNumbers)];

      let accountNumber = '';
      if (uniqueAccountNumbers.length > 0) {
        const startsWith2 = uniqueAccountNumbers.find(n => n.startsWith('2'));
        const startsWith1 = uniqueAccountNumbers.find(n => n.startsWith('1'));
        accountNumber = startsWith2 || startsWith1 || uniqueAccountNumbers[0];
      }

      console.log(`Sheet "${sheetName}" account info:`, { accountName, accountNumber, allAccountNumbers: accountNumbers, closingBalance });

      const transactionRows = rawData.slice(headerRowIndex + 1);
      result.totalRows++;

      if (!accountName) {
        console.log(`Sheet "${sheetName}": No account name found, skipping`);
        result.skippedSheets!++;
        result.exceptions.push({ sheet: sheetName, type: 'skipped_no_account_name', detail: 'Could not extract account holder name from statement header' });
        result.totalRows--;
        continue;
      }

      if (!accountNumber) {
        console.log(`Sheet "${sheetName}": No account number found, skipping`);
        result.skippedSheets!++;
        result.exceptions.push({ sheet: sheetName, type: 'skipped_no_account_number', detail: 'Could not find an account number in any expected cell position', data: { accountName } });
        result.totalRows--;
        continue;
      }

      try {
        const shouldCreateMembers = options?.createNewMembers !== false;

        let member;
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
          allMembers.push(member as any);
          result.importedMembers++;
          console.log(`Created new member: ${member.fullName} (${member.memberNumber})`);
        } else {
          result.errors.push({
            row: result.totalRows,
            error: `Sheet "${sheetName}": Member not found for account number "${accountNumber}" (${accountName}) and member creation is disabled`,
            data: { accountName, accountNumber }
          });
          continue;
        }

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

        const existingTransactions = await storage.getTransactionsByMember(member.id);
        const existingRefNumbers = new Set(existingTransactions.map((t: any) => t.referenceNumber));

        const transactionEntries = [];
        let skippedDuplicates = 0;

        for (let i = 0; i < transactionRows.length; i++) {
          const row = transactionRows[i] as any[];

          if (row.length >= 5 && row[0] && row[1]) {
            const postingDate = excelDateToDate(row[0]);
            if (i < 3) {
              console.log(`Sheet "${sheetName}" row ${i + 1} raw date: ${JSON.stringify(row[0])} -> parsed: ${postingDate.toISOString()}`);
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
                console.log(`✗ Sheet "${sheetName}" invalid transaction on row ${i + 1}:`, error);
              }
            }
          }
        }

        if (skippedDuplicates > 0) {
          console.log(`Sheet "${sheetName}": Skipped ${skippedDuplicates} duplicate transactions`);
        }

        if (transactionEntries.length > 0) {
          for (const transaction of transactionEntries) {
            await storage.createTransaction(transaction);
            if (options?.onJournalEntry && options?.userId) {
              const mappingKey = transaction.transactionType === 'deposit' ? 'member_deposit' : 'member_withdrawal';
              const amt = parseFloat(transaction.amount?.toString() || '0');
              if (amt > 0) {
                await options.onJournalEntry(
                  mappingKey,
                  amt,
                  `Imported ${transaction.transactionType} - ${accountNumber}`,
                  transaction.referenceNumber || `IMP-${Date.now()}`,
                  options.userId
                );
              }
            }
          }
          console.log(`Sheet "${sheetName}": Imported ${transactionEntries.length} new transaction entries`);
        }

        const depositEntries = transactionEntries.filter(t => t.transactionType === 'deposit' && t.transactionDate);
        let latestSavingsDate: Date = new Date();
        if (depositEntries.length > 0) {
          latestSavingsDate = depositEntries.reduce((latest, t) => {
            const d = new Date(t.transactionDate!);
            return d > latest ? d : latest;
          }, new Date(0));
        }
        await storage.updateMember(member.id, { lastSavingsDate: latestSavingsDate, isActiveSaver: true } as any);
        console.log(`Updated member ${member.fullName} lastSavingsDate to ${latestSavingsDate.toISOString()}`);

        result.successfulImports++;
        result.processedSheets!++;

      } catch (error) {
        result.errors.push({
          row: result.totalRows,
          error: `Sheet "${sheetName}": Failed to process — ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: { accountName, accountNumber, closingBalance }
        });
        result.exceptions.push({ sheet: sheetName, type: 'processing_error', detail: error instanceof Error ? error.message : 'Unknown error', data: { accountName, accountNumber } });
      }
    }

    result.success = result.successfulImports > 0;
    console.log('Import completed:', result);
    console.log(`Sheets summary: ${result.totalSheets} total, ${result.processedSheets} processed, ${result.skippedSheets} skipped, ${result.exceptions.length} exceptions`);
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

export async function importMembersFromExcel(filePath: string, options?: { userId?: string; updateExisting?: boolean }): Promise<ImportResult> {
  const updateExisting = options?.updateExisting || false;
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    successfulImports: 0,
    skippedDuplicates: 0,
    errors: [],
    exceptions: [],
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

        let existingMember = allMembers.find(m => idNumber && m.idNumber === idNumber);
        let matchedBy = 'idNumber';
        if (!existingMember && accountNum) {
          existingMember = allMembers.find(m => m.accountNumber === accountNum || m.staffAccountNumber === accountNum);
          if (existingMember) matchedBy = 'accountNumber';
        }
        if (!existingMember && staffAccNum) {
          existingMember = allMembers.find(m => m.staffAccountNumber === staffAccNum);
          if (existingMember) matchedBy = 'staffAccountNumber';
        }

        if (existingMember) {
          if (updateExisting) {
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
            let dateOfBirth = existingMember.dateOfBirth || '1990-01-01';
            if (dobRaw) {
              const parsed = excelDateToDate(dobRaw);
              if (!isNaN(parsed.getTime())) dateOfBirth = parsed.toISOString().split('T')[0];
            }
            const phone = colMap.phone !== undefined ? (row[colMap.phone] || '').toString().trim() : '';
            const emailVal = colMap.email !== undefined ? (row[colMap.email] || '').toString().trim() : '';
            const address = colMap.address !== undefined ? (row[colMap.address] || '').toString().trim() : '';
            const department = colMap.department !== undefined ? (row[colMap.department] || '').toString().trim() : '';
            const section = colMap.section !== undefined ? (row[colMap.section] || '').toString().trim() : '';
            const averageNetPay = colMap.averageNetPay !== undefined ? (parseFloat(row[colMap.averageNetPay]) || 0).toString() : undefined;
            const monthlySavings = colMap.monthlySavings !== undefined ? (parseFloat(row[colMap.monthlySavings]) || 0).toString() : undefined;
            const branch = colMap.branch !== undefined ? (row[colMap.branch] || '').toString().trim() : '';
            const numberOfShares = colMap.numberOfShares !== undefined ? (parseInt(row[colMap.numberOfShares]) || undefined) : undefined;
            const shareContribution = colMap.shareContribution !== undefined ? (parseFloat(row[colMap.shareContribution]) || undefined)?.toString() : undefined;
            const beneficiaryName = colMap.beneficiaryName !== undefined ? (row[colMap.beneficiaryName] || '').toString().trim() : '';
            const beneficiaryRelationship = colMap.beneficiaryRelationship !== undefined ? (row[colMap.beneficiaryRelationship] || '').toString().trim() : '';
            const beneficiaryContact = colMap.beneficiaryContact !== undefined ? (row[colMap.beneficiaryContact] || '').toString().trim() : '';
            const nextOfKinName = colMap.nextOfKinName !== undefined ? (row[colMap.nextOfKinName] || '').toString().trim() : '';
            const nextOfKinPhone = colMap.nextOfKinPhone !== undefined ? (row[colMap.nextOfKinPhone] || '').toString().trim() : '';
            const dateJoinedRaw = colMap.dateJoined !== undefined ? row[colMap.dateJoined] : null;
            let joinDate: Date | null = null;
            if (dateJoinedRaw) {
              const parsedJoinDate = excelDateToDate(dateJoinedRaw);
              if (!isNaN(parsedJoinDate.getTime())) joinDate = parsedJoinDate;
            }

            const updateData: Record<string, any> = {};
            if (fullName) updateData.fullName = fullName;
            if (idNumber) updateData.idNumber = idNumber;
            if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
            if (joinDate) updateData.joinDate = joinDate;
            updateData.gender = gender;
            updateData.maritalStatus = maritalStatus;
            updateData.termsOfService = termsOfService;
            if (phone) updateData.phoneNumber = phone;
            if (emailVal) updateData.email = emailVal;
            if (address) updateData.address = address;
            if (department) updateData.department = department;
            if (section) updateData.section = section;
            if (averageNetPay !== undefined) updateData.averageNetPay = averageNetPay;
            if (staffAccNum) updateData.staffAccountNumber = staffAccNum;
            if (monthlySavings !== undefined) updateData.monthlySavings = monthlySavings;
            if (accountNum) updateData.accountNumber = accountNum;
            if (branch) updateData.branch = branch;
            if (numberOfShares !== undefined) updateData.numberOfShares = numberOfShares;
            if (shareContribution !== undefined) updateData.shareContribution = shareContribution;
            if (beneficiaryName) updateData.beneficiaryName = beneficiaryName;
            if (beneficiaryRelationship) updateData.beneficiaryRelationship = beneficiaryRelationship;
            if (beneficiaryContact) updateData.beneficiaryContact = beneficiaryContact;
            if (nextOfKinName) updateData.nextOfKinName = nextOfKinName;
            if (nextOfKinPhone) updateData.nextOfKinPhone = nextOfKinPhone;

            try {
              await storage.updateMember(existingMember.id, updateData);
              result.successfulImports++;
              console.log(`Updated existing member ${rowNum} (matched by ${matchedBy}): ${fullName} (${existingMember.memberNumber})`);
            } catch (updateErr) {
              result.errors.push({
                row: rowNum,
                error: `Failed to update member "${fullName}": ${updateErr instanceof Error ? updateErr.message : 'Unknown error'}`,
                data: { fullName, idNumber, matchedBy }
              });
            }
            if (idNumber) seenIdNumbers.add(idNumber);
            if (staffAccNum) seenStaffAccounts.add(staffAccNum);
            if (accountNum) seenBankAccounts.add(accountNum);
            continue;
          }
          result.skippedDuplicates++;
          result.errors.push({
            row: rowNum,
            error: `Duplicate ${matchedBy === 'accountNumber' ? 'account number' : matchedBy === 'staffAccountNumber' ? 'staff account' : 'ID number'}: matches existing member ${existingMember.fullName} (${existingMember.memberNumber})`,
            data: { fullName, idNumber, matchedField: matchedBy }
          });
          continue;
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

        const memberEmail = email || `${fullName.toLowerCase().replace(/\s+/g, '.')}@import.local`;

        const username = generateUsername(fullName);
        let newUserId: string | undefined;
        try {
          const existingUser = await storage.getUserByUsername(username);
          if (!existingUser) {
            const defaultPassword = generateDefaultPassword(fullName);
            const hashedPwd = await hashPassword(defaultPassword);
            const nameParts = fullName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            const newUser = await storage.upsertUser({
              id: `member-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              username,
              password: hashedPwd,
              email: memberEmail,
              firstName,
              lastName,
              role: 'member',
              authMethod: 'local',
              mustChangePassword: true,
            });
            newUserId = newUser.id;
            console.log(`Created user account for ${fullName}: username=${username}, password=${defaultPassword}`);
          } else {
            newUserId = existingUser.id;
            console.log(`User account already exists for ${fullName}: username=${username}`);
          }
        } catch (userErr) {
          console.log(`Warning: Could not create user account for ${fullName}:`, userErr);
        }

        const memberData = {
          memberNumber,
          fullName,
          idNumber,
          dateOfBirth,
          gender,
          phoneNumber: phone || '0700000000',
          email: memberEmail,
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
          ...(newUserId ? { userId: newUserId } : {}),
          ...(joinDate ? { joinDate: new Date(joinDate) } : {}),
        };

        const validatedMemberData = insertMemberSchema.parse(memberData);
        const createdMember = await storage.createMember(validatedMemberData);
        const memberLastSavingsDate = joinDate ? new Date(joinDate) : new Date();
        await storage.updateMember(createdMember.id, { lastSavingsDate: memberLastSavingsDate } as any);
        result.importedMembers++;
        result.successfulImports++;

        if (newUserId) {
          try {
            await storage.addMemberRole(createdMember.id, 'member', newUserId);
          } catch (roleErr) {
            console.log(`Warning: Could not assign member role for ${fullName}:`, roleErr);
          }
        }

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

    result.success = result.importedMembers > 0 || result.successfulImports > 0;
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
export async function importLoansFromExcel(filePath: string, options?: { userId?: string; loanTypeId?: number; onJournalEntry?: JournalEntryCallback }): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    successfulImports: 0,
    skippedDuplicates: 0,
    errors: [],
    exceptions: [],
    importedMembers: 0,
    importedAccounts: 0,
    importedLoans: 0,
    totalSheets: 0,
    processedSheets: 0,
    skippedSheets: 0
  };

  try {
    const XLSX = await import('xlsx');
    const fs = await import('fs');
    
    if (!fs.existsSync(filePath)) {
      result.errors.push({ row: 0, error: `File not found: ${filePath}` });
      return result;
    }
    
    console.log('Reading loan file from:', filePath);
    const workbook = XLSX.default ? XLSX.default.readFile(filePath) : XLSX.readFile(filePath);
    const utils = XLSX.default ? XLSX.default.utils : XLSX.utils;
    console.log('Workbook sheets:', workbook.SheetNames);

    result.totalSheets = workbook.SheetNames.length;

    const sheetsWithData = workbook.SheetNames.filter(name => {
      const ws = workbook.Sheets[name];
      const data = utils.sheet_to_json(ws, { header: 1 });
      return data.length > 0;
    });

    const emptySheets = workbook.SheetNames.filter(name => !sheetsWithData.includes(name));
    for (const name of emptySheets) {
      result.skippedSheets = (result.skippedSheets || 0) + 1;
      result.exceptions.push({ sheet: name, type: 'skipped_empty', detail: 'Sheet has no data' });
    }

    if (sheetsWithData.length === 0) {
      result.errors.push({ row: 0, error: "File is empty — no sheets with data found" });
      return result;
    }

    console.log(`Processing ${sheetsWithData.length} sheet(s) with data: ${sheetsWithData.join(', ')}`);
    const allMembers = await storage.getAllMembers();
    const allLoanTypes = await storage.getAllLoanTypes();

    let fallbackLoanTypeName: 'personal' | 'business' | 'emergency' | 'asset' | 'development' = 'personal';
    if (options?.loanTypeId) {
      const loanTypeRecord = await storage.getLoanType(options.loanTypeId);
      if (loanTypeRecord) {
        const nameMap: Record<string, 'personal' | 'business' | 'emergency' | 'asset' | 'development'> = {
          'personal': 'personal', 'business': 'business', 'emergency': 'emergency',
          'asset': 'asset', 'development': 'development'
        };
        fallbackLoanTypeName = nameMap[loanTypeRecord.name.toLowerCase()] || 'personal';
        console.log(`Fallback loan type from dropdown: ${loanTypeRecord.displayName} (${fallbackLoanTypeName})`);
      }
    }

    const loanTypeEnum = ['personal', 'business', 'emergency', 'asset', 'development'] as const;
    type LoanTypeEnum = typeof loanTypeEnum[number];

    const detectLoanTypeFromDetails = (transactionRows: any[], headerRowIdx: number): { detected: LoanTypeEnum; source: string } => {
      const detailTexts: string[] = [];
      for (let i = headerRowIdx + 1; i < transactionRows.length; i++) {
        const row = transactionRows[i] as any[];
        if (!row || row.length < 2) continue;
        const detail = row[1]?.toString() || '';
        if (detail.trim()) detailTexts.push(detail);
      }
      const allDetailsJoined = detailTexts.join(' ').toLowerCase();

      const keywordMap: { keywords: string[]; type: LoanTypeEnum }[] = [
        { keywords: ['emergency'], type: 'emergency' },
        { keywords: ['business'], type: 'business' },
        { keywords: ['asset financing', 'asset loan'], type: 'asset' },
        { keywords: ['development', 'school fees', 'education'], type: 'development' },
        { keywords: ['special loan', 'special'], type: 'development' },
        { keywords: ['top up', 'top-up', 'topup'], type: 'personal' },
        { keywords: ['personal'], type: 'personal' },
      ];

      const dbNameToEnum: Record<string, LoanTypeEnum> = {};
      for (const dbType of allLoanTypes) {
        const dbName = dbType.name.toLowerCase();
        const directMatch = loanTypeEnum.find(e => e === dbName);
        if (directMatch) {
          dbNameToEnum[dbName] = directMatch;
        } else {
          for (const mapping of keywordMap) {
            if (mapping.keywords.some(kw => dbName.includes(kw) || dbType.displayName.toLowerCase().includes(kw))) {
              dbNameToEnum[dbName] = mapping.type;
              break;
            }
          }
        }
      }

      for (const dbType of allLoanTypes) {
        const dbName = dbType.name.toLowerCase();
        const dbDisplayName = dbType.displayName.toLowerCase();
        for (const detail of detailTexts) {
          const d = detail.toLowerCase();
          if (d.includes(dbName) || d.includes(dbDisplayName)) {
            const enumMatch = dbNameToEnum[dbName];
            if (enumMatch) {
              return { detected: enumMatch, source: `matched DB loan type "${dbType.displayName}" from detail: "${detail}"` };
            }
          }
        }
      }

      for (const mapping of keywordMap) {
        for (const kw of mapping.keywords) {
          if (allDetailsJoined.includes(kw)) {
            return { detected: mapping.type, source: `keyword "${kw}" detected in transaction details` };
          }
        }
      }

      return { detected: fallbackLoanTypeName, source: 'fallback (no loan type detected from details)' };
    };

    for (const sheetName of sheetsWithData) {
      const worksheet = workbook.Sheets[sheetName];
      const rawData = utils.sheet_to_json(worksheet, { header: 1 });

      console.log(`\n--- Processing loan sheet: "${sheetName}" (${rawData.length} rows) ---`);

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
        console.log(`Sheet "${sheetName}": No loan statement structure found, skipping`);
        result.skippedSheets = (result.skippedSheets || 0) + 1;
        result.exceptions.push({ sheet: sheetName, type: 'skipped_no_structure', detail: 'No transaction header found (expected POSTING DATE, DETAILS, BALANCE columns)' });
        continue;
      }

      let accountName = '';
      let accountNumber = '';
      let closingBalance = 0;
      let interestRateValue = 0;
      let tenure = 0;
      let headerLoanAmount = 0;
      let headerMonthlyRepayment = 0;
      let headerTermMonths = 0;

      for (let i = 0; i < Math.min(headerRowIndex, rawData.length); i++) {
        const row = rawData[i] as any[];
        if (row && row.length > 1) {
          for (let j = 0; j < row.length; j++) {
            const cellText = row[j]?.toString().toUpperCase().trim() || '';
            if ((cellText.includes('ACCOUNT NAME') || cellText === 'ACCOUNT NAME:') && row[j + 1]) {
              accountName = row[j + 1]?.toString().trim() || '';
            } else if ((cellText.includes('ACCOUNT NUMBER') || cellText === 'ACCOUNT NUMBER:') && row[j + 1]) {
              accountNumber = row[j + 1]?.toString().trim() || '';
            } else if (cellText.includes('CLOSING BALANCE') && row[j + 1] !== undefined) {
              closingBalance = parseFloat(row[j + 1]) || 0;
            } else if ((cellText === 'INTEREST RATE' || cellText === 'INT.' || cellText === 'INT') && row[j + 1] !== undefined) {
              interestRateValue = parseFloat(row[j + 1]) || 0;
            } else if (cellText.includes('TENURE') && row[j + 1] !== undefined) {
              tenure = parseInt(row[j + 1]) || 12;
            } else if ((cellText.includes('TIME') && cellText.includes('MONTH'))) {
              const val = parseFloat(row[4]);
              if (val > 0) headerTermMonths = val;
            } else if (cellText.includes('MONTHLY REPAYMENT')) {
              const val = parseFloat(row[4]);
              if (val > 0) headerMonthlyRepayment = val;
            } else if ((cellText.includes('LOAN AMOUNT') || cellText === 'LOAN AMOUNT DISBURSED')) {
              const val = parseFloat(row[4]);
              if (val > 0) headerLoanAmount = val;
            }
          }
        }
      }

      console.log(`Sheet "${sheetName}" loan info:`, { accountName, accountNumber, closingBalance, interestRateValue, tenure, headerLoanAmount, headerMonthlyRepayment, headerTermMonths });

      if (!accountName) {
        const sheetNameTrimmed = sheetName.trim();
        if (sheetNameTrimmed && sheetNameTrimmed.length > 2) {
          accountName = sheetNameTrimmed;
          console.log(`Sheet "${sheetName}": Using sheet name as account name: "${accountName}"`);
        }
      }

      if (!accountName) {
        console.log(`Sheet "${sheetName}": No account name found, skipping`);
        result.skippedSheets = (result.skippedSheets || 0) + 1;
        result.exceptions.push({ sheet: sheetName, type: 'skipped_no_account_name', detail: 'Could not extract account holder name from statement header' });
        continue;
      }

      result.totalRows++;

      try {
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
            row: result.totalRows,
            error: `Sheet "${sheetName}": No existing member found matching "${accountName}" (account: ${accountNumber}). Please import the member first.`,
            data: { accountName, accountNumber }
          });
          result.exceptions.push({ sheet: sheetName, type: 'processing_error', detail: `No member found for "${accountName}" (${accountNumber})`, data: { accountName, accountNumber } });
          continue;
        }

        console.log(`Sheet "${sheetName}": Matched to member ${member.fullName} (${member.memberNumber})`);

        interface LoanGroup {
          category: string;
          loanType: LoanTypeEnum;
          disbursements: { date: Date; amount: number; details: string; rowIndex: number }[];
          repayments: { date: Date; amount: number; details: string; rowIndex: number }[];
          totalDisbursed: number;
          totalRepaid: number;
          firstDisbursementDate: Date | null;
          lastInstallmentAmount: number;
        }

        const { detected: detectedOrdinaryType } = detectLoanTypeFromDetails(rawData, headerRowIndex);

        const ordinaryGroup: LoanGroup = {
          category: 'ordinary',
          loanType: detectedOrdinaryType,
          disbursements: [],
          repayments: [],
          totalDisbursed: 0,
          totalRepaid: 0,
          firstDisbursementDate: null,
          lastInstallmentAmount: 0,
        };

        const specialGroup: LoanGroup = {
          category: 'special',
          loanType: 'development' as LoanTypeEnum,
          disbursements: [],
          repayments: [],
          totalDisbursed: 0,
          totalRepaid: 0,
          firstDisbursementDate: null,
          lastInstallmentAmount: 0,
        };

        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i] as any[];
          if (!row || row.length < 2 || !row[0]) continue;

          const postingDate = excelDateToDate(row[0]);
          if (i <= headerRowIndex + 3) {
            console.log(`Sheet "${sheetName}" loan row ${i - headerRowIndex}: raw date=${JSON.stringify(row[0])} (type=${typeof row[0]}), parsed=${postingDate.toISOString()}, details="${row[1]}", debit=${row[2]}, credit=${row[3]}`);
          }
          const details = row[1]?.toString() || '';
          const detailsLower = details.toLowerCase().trim();
          if (!detailsLower) continue;

          const amtDebited = parseFloat(row[2]) || 0;
          const principalRepyt = parseFloat(row[3]) || 0;
          const interestAmt = parseFloat(row[4]) || 0;
          const balanceAmt = parseFloat(row[5]) || 0;

          const isSpecialDisbursement = detailsLower === 'special loan' || detailsLower.startsWith('special loan ');
          const isSpecialRepayment = detailsLower.includes('installment - special') || detailsLower.includes('instalment - special');

          const isOrdinaryDisbursement = detailsLower.includes('disbursed') ||
                                          detailsLower.includes('loan amount') ||
                                          detailsLower.includes('top up') ||
                                          detailsLower.includes('top-up') ||
                                          detailsLower.includes('topup') ||
                                          detailsLower.includes('loan topup');

          if (isSpecialDisbursement) {
            const amount = Math.abs(principalRepyt) || Math.abs(amtDebited);
            if (amount > 0) {
              specialGroup.disbursements.push({ date: postingDate, amount, details, rowIndex: i });
              specialGroup.totalDisbursed += amount;
              if (!specialGroup.firstDisbursementDate) specialGroup.firstDisbursementDate = postingDate;
            }
          } else if (isSpecialRepayment) {
            const repayAmount = amtDebited > 0 ? amtDebited : Math.abs(principalRepyt);
            if (repayAmount > 0) {
              specialGroup.repayments.push({ date: postingDate, amount: repayAmount, details, rowIndex: i });
              specialGroup.totalRepaid += repayAmount;
              specialGroup.lastInstallmentAmount = repayAmount;
            }
          } else if (isOrdinaryDisbursement) {
            const amount = Math.abs(principalRepyt) || Math.abs(amtDebited);
            if (amount > 0) {
              ordinaryGroup.disbursements.push({ date: postingDate, amount, details, rowIndex: i });
              ordinaryGroup.totalDisbursed += amount;
              if (!ordinaryGroup.firstDisbursementDate) ordinaryGroup.firstDisbursementDate = postingDate;
            }
          } else if (amtDebited > 0 && (detailsLower.includes('installment') || detailsLower.includes('instalment'))) {
            ordinaryGroup.repayments.push({ date: postingDate, amount: amtDebited, details, rowIndex: i });
            ordinaryGroup.totalRepaid += amtDebited;
            ordinaryGroup.lastInstallmentAmount = amtDebited;
          } else if (amtDebited > 0) {
            ordinaryGroup.repayments.push({ date: postingDate, amount: amtDebited, details, rowIndex: i });
            ordinaryGroup.totalRepaid += amtDebited;
          }
        }

        const loanGroups = [ordinaryGroup, specialGroup].filter(g =>
          g.disbursements.length > 0 || g.repayments.length > 0
        );

        if (loanGroups.length === 0) {
          result.exceptions.push({ sheet: sheetName, type: 'processing_error', detail: 'No loan transactions found in this sheet' });
          continue;
        }

        console.log(`Sheet "${sheetName}": Found ${loanGroups.length} loan group(s): ${loanGroups.map(g => `${g.category} (${g.disbursements.length} disbursements, ${g.repayments.length} repayments)`).join(', ')}`);

        for (const group of loanGroups) {
          const disbursementDate = group.firstDisbursementDate || new Date();

          const principalAmount = (loanGroups.length === 1 && headerLoanAmount > 0)
            ? headerLoanAmount
            : (headerLoanAmount > 0 && group.category === 'ordinary')
              ? headerLoanAmount
              : group.totalDisbursed;

          const outstandingBalance = (loanGroups.length === 1 && closingBalance > 0)
            ? closingBalance
            : (closingBalance > 0 && group.category === 'ordinary')
              ? closingBalance
              : Math.max(0, group.totalDisbursed - group.totalRepaid);

          const termMonths = headerTermMonths || tenure || 12;
          const monthlyPayment = (group.category === 'ordinary' && headerMonthlyRepayment > 0)
            ? headerMonthlyRepayment
            : group.lastInstallmentAmount;

          const loanData = {
            memberId: member.id,
            loanNumber: `LOAN${String(Date.now()).slice(-6)}${group.category === 'special' ? 'S' : ''}`,
            loanType: group.loanType,
            principalAmount: principalAmount.toString(),
            interestRate: interestRateValue.toString(),
            termMonths: termMonths,
            monthlyPayment: monthlyPayment.toString(),
            outstandingBalance: outstandingBalance.toString(),
            status: (outstandingBalance > 0 ? 'active' : 'completed') as 'active' | 'completed',
            purpose: `Imported from loan statement - ${group.category} loan`,
            applicationDate: disbursementDate,
            approvalDate: disbursementDate,
            disbursementDate: disbursementDate,
            currentSavings: '0'
          };

          const validatedLoanData = insertLoanSchema.parse(loanData);
          const createdLoan = await storage.createLoan(validatedLoanData);

          result.importedLoans = (result.importedLoans || 0) + 1;
          console.log(`✓ Sheet "${sheetName}": Created ${group.category} (${group.loanType}) loan ${loanData.loanNumber} for ${member.fullName} - Principal: UGX ${principalAmount.toLocaleString()}, Outstanding: UGX ${outstandingBalance.toLocaleString()} (header loan amount: ${headerLoanAmount}, header closing balance: ${closingBalance})`);

          const transactionEntries = [];

          for (const d of group.disbursements) {
            transactionEntries.push({
              memberId: member.id,
              loanId: createdLoan.id,
              transactionType: 'loan_disbursement' as const,
              amount: d.amount.toString(),
              description: d.details,
              referenceNumber: `LTX${Date.now()}_${d.rowIndex}`,
              status: 'completed' as const,
              processedBy: options?.userId,
              transactionDate: d.date
            });
          }

          for (const r of group.repayments) {
            transactionEntries.push({
              memberId: member.id,
              loanId: createdLoan.id,
              transactionType: 'loan_payment' as const,
              amount: r.amount.toString(),
              description: r.details,
              referenceNumber: `LTX${Date.now()}_${r.rowIndex}`,
              status: 'completed' as const,
              processedBy: options?.userId,
              transactionDate: r.date
            });
          }

          if (transactionEntries.length > 0) {
            for (const transaction of transactionEntries) {
              const validatedTransactionData = insertTransactionSchema.parse(transaction);
              await storage.createTransaction(validatedTransactionData);
              if (options?.onJournalEntry && options?.userId) {
                const mappingKey = transaction.transactionType === 'loan_disbursement' ? 'loan_disbursement' : 'loan_repayment_principal';
                const amt = parseFloat(transaction.amount?.toString() || '0');
                if (amt > 0) {
                  await options.onJournalEntry(
                    mappingKey,
                    amt,
                    `Imported ${transaction.transactionType === 'loan_disbursement' ? 'loan disbursement' : 'loan repayment'} - ${member.memberNumber} (${group.category})`,
                    transaction.referenceNumber || `IMP-L-${Date.now()}`,
                    options.userId
                  );
                }
              }
            }
            console.log(`Sheet "${sheetName}": Imported ${transactionEntries.length} ${group.category} loan transactions`);
          }
        }

        result.successfulImports++;
        result.processedSheets = (result.processedSheets || 0) + 1;

      } catch (error) {
        console.error(`Sheet "${sheetName}": Error processing loan statement:`, error);
        result.errors.push({
          row: result.totalRows,
          error: `Sheet "${sheetName}": Failed to process — ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        result.exceptions.push({ sheet: sheetName, type: 'processing_error', detail: error instanceof Error ? error.message : 'Unknown error', data: { accountName, accountNumber } });
      }
    }

    result.success = result.successfulImports > 0;
    console.log('Loan import completed:', result);
    console.log(`Sheets summary: ${result.totalSheets} total, ${result.processedSheets || 0} processed, ${result.skippedSheets || 0} skipped, ${result.exceptions.length} exceptions`);
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