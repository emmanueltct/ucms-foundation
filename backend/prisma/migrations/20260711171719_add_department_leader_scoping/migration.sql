-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "is_delegable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assigned_department_record_id" TEXT,
ADD COLUMN     "department_role" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assigned_department_record_id_fkey" FOREIGN KEY ("assigned_department_record_id") REFERENCES "dynamic_module_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
