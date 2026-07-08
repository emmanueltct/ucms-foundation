import { PartialType } from '@nestjs/swagger';
import { CreateDocumentDto } from './create-document.dto';

/**
 * Metadata only — the file itself is replaced through the dedicated
 * `PATCH /documents/:id/file` action, not through this DTO, since it needs
 * `multipart/form-data` rather than JSON.
 */
export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}
