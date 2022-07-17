import { stringify } from 'csv-stringify';

/**
 * Stream an array of records to stdout as CSV. When `columns` is given it both
 * selects and orders the output columns (supporting dotted paths like
 * `bite.urn`); otherwise every key of the first record is emitted.
 */
export function printCSV(rows: Record<string, unknown>[], columns?: string[]): void {
  stringify(rows, { header: true, columns }).pipe(process.stdout);
}
