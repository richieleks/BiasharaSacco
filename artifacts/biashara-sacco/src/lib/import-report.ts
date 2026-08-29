export function sanitizeTsvCell(value: unknown): string {
  const normalized = (value == null ? '' : String(value))
    .replace(/\t/g, ' ')
    .replace(/\r\n|\r|\n/g, ' ');

  return /^\s*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

export function createTsvRow(values: unknown[]): string {
  return values.map(sanitizeTsvCell).join('\t');
}