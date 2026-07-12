-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "recipient_user_id" TEXT;

-- AlterTable
ALTER TABLE "resource_assignments" ADD COLUMN     "due_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
