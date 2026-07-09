-- AlterTable
ALTER TABLE "custom_field_definitions" ADD COLUMN     "lookup_entity_type" TEXT,
ADD COLUMN     "section" TEXT,
ADD COLUMN     "validation_rules" JSONB,
ADD COLUMN     "visible_to_role_names" TEXT[] DEFAULT ARRAY[]::TEXT[];
