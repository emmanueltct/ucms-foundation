-- AlterTable
ALTER TABLE "users" ADD COLUMN     "locked_at" TIMESTAMP(3),
ADD COLUMN     "locked_reason" TEXT;
