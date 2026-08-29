import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parseBankImportCsv } from './csvUtils';

const fixturesDirectory = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

test('parses quoted commas, escaped quotes, and blank fields', async () => {
  const csv = await readFile(join(fixturesDirectory, 'bank-import-quoted.csv'), 'utf8');
  const records = parseBankImportCsv(csv);

  assert.equal(records.length, 3);
  assert.deepEqual(records[2], [
    '2026-08-01',
    '2026-08-01',
    'TX-1',
    'foo',
    'foo',
    'foo',
    'Success',
    'REF-1',
    '',
    '1000',
    'ACC-1',
    'Loan repayment, "March" installment',
  ]);
});

test('rejects malformed CSV syntax', async () => {
  const csv = await readFile(join(fixturesDirectory, 'bank-import-malformed.csv'), 'utf8');

  assert.throws(() => parseBankImportCsv(csv), /quote|record|CSV/i);
});