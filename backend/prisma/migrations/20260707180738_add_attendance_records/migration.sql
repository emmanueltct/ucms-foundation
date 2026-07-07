-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "member_id" TEXT,
    "service_type" TEXT NOT NULL,
    "attendance_method" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "attended_at" TIMESTAMP(3) NOT NULL,
    "recorded_by_user_id" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_idx" ON "attendance_records"("tenant_id");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_branch_id_idx" ON "attendance_records"("tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_member_id_idx" ON "attendance_records"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_attended_at_idx" ON "attendance_records"("tenant_id", "attended_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_tenant_id_branch_id_member_id_service_ty_key" ON "attendance_records"("tenant_id", "branch_id", "member_id", "service_type", "attended_at");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
