/*
  Warnings:

  - You are about to drop the `visitor_follow_ups` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "visitor_follow_ups" DROP CONSTRAINT "visitor_follow_ups_performed_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "visitor_follow_ups" DROP CONSTRAINT "visitor_follow_ups_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "visitor_follow_ups" DROP CONSTRAINT "visitor_follow_ups_visitor_id_fkey";

-- AlterTable
ALTER TABLE "visitors" ADD COLUMN     "visitor_group_id" TEXT;

-- DropTable
DROP TABLE "visitor_follow_ups";

-- CreateTable
CREATE TABLE "visitor_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "group_type" TEXT NOT NULL,
    "visit_date" TIMESTAMP(3) NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "expected_size" INTEGER,
    "source" TEXT,
    "assigned_to_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "visitor_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_activities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "visitor_id" TEXT,
    "visitor_group_id" TEXT,
    "activity_type" TEXT NOT NULL,
    "activity_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT,
    "notes" TEXT,
    "performed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visitor_groups_tenant_id_idx" ON "visitor_groups"("tenant_id");

-- CreateIndex
CREATE INDEX "visitor_groups_tenant_id_branch_id_idx" ON "visitor_groups"("tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "visitor_activities_tenant_id_idx" ON "visitor_activities"("tenant_id");

-- CreateIndex
CREATE INDEX "visitor_activities_tenant_id_visitor_id_idx" ON "visitor_activities"("tenant_id", "visitor_id");

-- CreateIndex
CREATE INDEX "visitor_activities_tenant_id_visitor_group_id_idx" ON "visitor_activities"("tenant_id", "visitor_group_id");

-- CreateIndex
CREATE INDEX "visitor_activities_tenant_id_activity_type_idx" ON "visitor_activities"("tenant_id", "activity_type");

-- CreateIndex
CREATE INDEX "visitors_tenant_id_visitor_group_id_idx" ON "visitors"("tenant_id", "visitor_group_id");

-- AddForeignKey
ALTER TABLE "visitor_groups" ADD CONSTRAINT "visitor_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_groups" ADD CONSTRAINT "visitor_groups_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_groups" ADD CONSTRAINT "visitor_groups_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_visitor_group_id_fkey" FOREIGN KEY ("visitor_group_id") REFERENCES "visitor_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_activities" ADD CONSTRAINT "visitor_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_activities" ADD CONSTRAINT "visitor_activities_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_activities" ADD CONSTRAINT "visitor_activities_visitor_group_id_fkey" FOREIGN KEY ("visitor_group_id") REFERENCES "visitor_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_activities" ADD CONSTRAINT "visitor_activities_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
