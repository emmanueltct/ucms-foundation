-- CreateTable
CREATE TABLE "visitors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "visit_date" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "invited_by_member_id" TEXT,
    "assigned_to_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "converted_member_id" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_follow_ups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "follow_up_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT,
    "performed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visitors_converted_member_id_key" ON "visitors"("converted_member_id");

-- CreateIndex
CREATE INDEX "visitors_tenant_id_idx" ON "visitors"("tenant_id");

-- CreateIndex
CREATE INDEX "visitors_tenant_id_branch_id_idx" ON "visitors"("tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "visitors_tenant_id_status_idx" ON "visitors"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "visitor_follow_ups_tenant_id_idx" ON "visitor_follow_ups"("tenant_id");

-- CreateIndex
CREATE INDEX "visitor_follow_ups_tenant_id_visitor_id_idx" ON "visitor_follow_ups"("tenant_id", "visitor_id");

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_invited_by_member_id_fkey" FOREIGN KEY ("invited_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_converted_member_id_fkey" FOREIGN KEY ("converted_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_follow_ups" ADD CONSTRAINT "visitor_follow_ups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_follow_ups" ADD CONSTRAINT "visitor_follow_ups_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_follow_ups" ADD CONSTRAINT "visitor_follow_ups_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
