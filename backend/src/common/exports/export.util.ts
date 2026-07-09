import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ExportColumn {
  key: string;
  header: string;
}

export interface ExportTable {
  /** Sheet/section title — used as the PDF heading and the XLSX sheet name. */
  title: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
}

/**
 * Turns whatever tabular data a report/list endpoint already returns into a
 * downloadable file — no new data model, no persisted "report definition,"
 * matching the same "reports read, they don't own new tables" discipline
 * documented in docs/reports/business-analysis.md. CSV is written by hand
 * (a handful of lines of escaping, not worth a dependency); XLSX and PDF use
 * `exceljs`/`pdfkit` since generating either format by hand would be a much
 * larger undertaking than the two dependencies are worth. A single table is
 * the common case (a list-view export); multiple tables let a single Reports
 * & Analytics export carry both its byMonth and byKey breakdowns in one file.
 */
export function toCsv(tables: ExportTable[]): string {
  const sections = tables.map(({ title, columns, rows }) => {
    const header = columns.map((c) => escapeCsvCell(c.header)).join(',');
    const body = rows.map((row) => columns.map((c) => escapeCsvCell(row[c.key])).join(','));
    return [`# ${title}`, header, ...body].join('\r\n');
  });
  return sections.join('\r\n\r\n');
}

export async function toXlsx(tables: ExportTable[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const { title, columns, rows } of tables) {
    const sheet = workbook.addWorksheet(title.slice(0, 31)); // Excel sheet-name limit
    sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: 20 }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function toPdf(tables: ExportTable[], reportTitle: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(reportTitle, { underline: true });
    doc.moveDown();

    for (const { title, columns, rows } of tables) {
      doc.fontSize(13).text(title);
      doc.moveDown(0.5);
      doc.fontSize(9);
      const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / columns.length;

      doc.font('Helvetica-Bold');
      columns.forEach((c, i) => doc.text(c.header, doc.page.margins.left + i * colWidth, doc.y, { width: colWidth, continued: i < columns.length - 1 }));
      doc.font('Helvetica').moveDown(0.3);

      for (const row of rows) {
        const y = doc.y;
        columns.forEach((c, i) => doc.text(formatCell(row[c.key]), doc.page.margins.left + i * colWidth, y, { width: colWidth, continued: i < columns.length - 1 }));
        doc.moveDown(0.3);
      }
      doc.moveDown();
    }

    doc.end();
  });
}

export async function sendExportFile(
  res: Response,
  format: ExportFormat,
  filenameBase: string,
  tables: ExportTable[],
  reportTitle: string,
): Promise<void> {
  const filename = `${filenameBase}.${format}`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(toCsv(tables));
    return;
  }
  if (format === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(await toXlsx(tables));
    return;
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.send(await toPdf(tables, reportTitle));
}

function escapeCsvCell(value: unknown): string {
  const str = formatCell(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
