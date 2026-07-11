-- AlterTable
ALTER TABLE "approval_workflows" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "custom_field_definitions" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notification_templates" ADD COLUMN     "deleted_at" TIMESTAMP(3);
