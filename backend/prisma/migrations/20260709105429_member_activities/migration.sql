-- CreateTable
CREATE TABLE "member_activities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "activity_type" TEXT NOT NULL,
    "activity_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT,
    "notes" TEXT,
    "performed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_activities_tenant_id_idx" ON "member_activities"("tenant_id");

-- CreateIndex
CREATE INDEX "member_activities_tenant_id_member_id_idx" ON "member_activities"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "member_activities_tenant_id_activity_type_idx" ON "member_activities"("tenant_id", "activity_type");

-- AddForeignKey
ALTER TABLE "member_activities" ADD CONSTRAINT "member_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_activities" ADD CONSTRAINT "member_activities_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_activities" ADD CONSTRAINT "member_activities_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
