import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAssetDto } from './create-asset.dto';

/**
 * `assetCategory` is immutable — it selects which `asset:{category}` custom
 * field set applies, and changing it after custom field values already
 * exist under the old entityType would orphan them silently. If a category
 * was picked wrong, soft-delete the asset and create it again under the
 * right one, the same way a wrongly-picked `ConfigItem` type elsewhere is
 * corrected by re-selecting, not by mutating the type in place.
 */
export class UpdateAssetDto extends PartialType(OmitType(CreateAssetDto, ['assetCategory'] as const)) {}
