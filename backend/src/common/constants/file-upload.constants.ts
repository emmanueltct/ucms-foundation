/**
 * Shared between every module that lets a tenant upload a file (Assets'
 * per-category `file`/`image`/`video`/`audio` custom fields, Document
 * Management's own records, and whatever comes next) — one allowlist and
 * one size cap to keep in sync rather than a copy drifting per module.
 * Extended to cover image/video/audio (not just office documents) so
 * Document Management can preview them inline — see
 * docs/document-management/business-analysis.md.
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
]);

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB — raised from 10MB to fit short audio/video clips
