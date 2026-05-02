// Quick test to read the Excel file and see its structure
import XLSX from 'xlsx';

try {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile('attached_assets/savings_1753029560040.xlsx');
  
  console.log('Sheet names:', workbook.SheetNames);
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON to see the structure
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log('Total rows:', data.length);
  console.log('Headers (first row):', data[0]);
  console.log('Sample data rows:');
  for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
    console.log(`Row ${i}:`, data[i]);
  }
  
} catch (error) {
  console.error('Error reading file:', error.message);
}