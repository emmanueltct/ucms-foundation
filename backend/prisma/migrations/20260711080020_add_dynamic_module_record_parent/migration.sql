-- AlterTable
ALTER TABLE "dynamic_module_records" ADD COLUMN     "parent_record_id" TEXT;

-- CreateIndex
CREATE INDEX "dynamic_module_records_tenant_id_parent_record_id_idx" ON "dynamic_module_records"("tenant_id", "parent_record_id");

-- AddForeignKey
ALTER TABLE "dynamic_module_records" ADD CONSTRAINT "dynamic_module_records_parent_record_id_fkey" FOREIGN KEY ("parent_record_id") REFERENCES "dynamic_module_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
