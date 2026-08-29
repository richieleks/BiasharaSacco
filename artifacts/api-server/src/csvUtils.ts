import { parse } from 'csv-parse/sync';

/**
 * Parse bank-export CSV records while leaving column-count validation to the
 * import routes, which report short rows as row-level failures.
 */
export function parseBankImportCsv(content: string): string[][] {
  return parse(content, {
    bom: true,
    columns: false,
    relax_column_count: true,
    skip_empty_lines: true,
  }) as string[][];
}