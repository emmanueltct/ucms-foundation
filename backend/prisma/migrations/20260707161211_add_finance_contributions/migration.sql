-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "member_id" TEXT,
    "contribution_type" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "receipt_number" TEXT,
    "contributed_at" TIMESTAMP(3) NOT NULL,
    "recorded_by_user_id" TEXT,
    "notes" TEXT,
    "is_voided" BOOLEAN NOT NULL DEFAULT false,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "voided_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contributions_tenant_id_idx" ON "contributions"("tenant_id");

-- CreateIndex
CREATE INDEX "contributions_tenant_id_branch_id_idx" ON "contributions"("tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "contributions_tenant_id_member_id_idx" ON "contributions"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "contributions_tenant_id_contributed_at_idx" ON "contributions"("tenant_id", "contributed_at");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_tenant_id_receipt_number_key" ON "contributions"("tenant_id", "receipt_number");

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
