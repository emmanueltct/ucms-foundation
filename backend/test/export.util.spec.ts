import { toCsv, toXlsx, toPdf } from '../src/common/exports/export.util';

describe('export.util', () => {
  const table = {
    title: 'Giving by month',
    columns: [
      { key: 'month', header: 'Month' },
      { key: 'total', header: 'Total' },
    ],
    rows: [
      { month: '2026-06', total: 150000 },
      { month: '2026-07', total: 'contains, a comma' },
    ],
  };

  describe('toCsv', () => {
    it('writes a header row, a title comment, and escapes cells containing commas', () => {
      const csv = toCsv([table]);

      expect(csv).toContain('# Giving by month');
      expect(csv).toContain('Month,Total');
      expect(csv).toContain('2026-06,150000');
      expect(csv).toContain('"contains, a comma"');
    });

    it('separates multiple tables with a blank line', () => {
      const csv = toCsv([table, { ...table, title: 'Giving by type' }]);
      expect(csv).toContain('# Giving by month');
      expect(csv).toContain('# Giving by type');
      expect(csv.split('\r\n\r\n')).toHaveLength(2);
    });

    it('renders null/undefined as an empty cell', () => {
      const csv = toCsv([{ ...table, rows: [{ month: '2026-06', total: null }] }]);
      expect(csv).toContain('2026-06,');
    });
  });

  describe('toXlsx', () => {
    it('produces a non-empty XLSX buffer', async () => {
      const buffer = await toXlsx([table]);
      expect(buffer.length).toBeGreaterThan(0);
      // XLSX files are zip archives — "PK" magic bytes at the start
      expect(buffer.subarray(0, 2).toString()).toBe('PK');
    });
  });

  describe('toPdf', () => {
    it('produces a non-empty PDF buffer', async () => {
      const buffer = await toPdf([table], 'Finance Summary');
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    });
  });
});
