/**
 * Shared between every module that lets a tenant upload a file (Assets'
 * per-category `file` custom fields, Document Management's own records, and
 * whatever comes next) — one allowlist and one size cap to keep in sync
 * rather than a copy drifting per module.
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
