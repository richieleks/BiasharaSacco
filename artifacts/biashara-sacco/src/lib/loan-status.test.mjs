import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind } from 'typescript';

const source = readFileSync(new URL('./loan-status.ts', import.meta.url), 'utf8');
const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext } }).outputText;
const { isOperationalLoan } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

test('only disbursed or active loans count as operational debt', () => {
  for (const status of ['active', 'disbursed']) {
    assert.equal(isOperationalLoan(status), true, status);
  }
  for (const status of ['pending', 'rejected', 'approved', 'completed', 'recalled', 'defaulted']) {
    assert.equal(isOperationalLoan(status), false, status);
  }
});