-- CreateTable
CREATE TABLE "hierarchy_requirements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parent_branch_type" TEXT NOT NULL,
    "child_branch_type" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'once',
    "due_day_of_period" INTEGER,
    "approval_workflow_id" TEXT,
    "notify_role_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hierarchy_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hierarchy_requirement_submissions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "period_label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attached_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submitted_by_user_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hierarchy_requirement_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hierarchy_requirements_tenant_id_idx" ON "hierarchy_requirements"("tenant_id");

-- CreateIndex
CREATE INDEX "hierarchy_requirements_tenant_id_parent_branch_type_child_b_idx" ON "hierarchy_requirements"("tenant_id", "parent_branch_type", "child_branch_type");

-- CreateIndex
CREATE INDEX "hierarchy_requirement_submissions_tenant_id_idx" ON "hierarchy_requirement_submissions"("tenant_id");

-- CreateIndex
CREATE INDEX "hierarchy_requirement_submissions_tenant_id_requirement_id_idx" ON "hierarchy_requirement_submissions"("tenant_id", "requirement_id");

-- CreateIndex
CREATE INDEX "hierarchy_requirement_submissions_tenant_id_branch_id_idx" ON "hierarchy_requirement_submissions"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "hierarchy_requirement_submissions_tenant_id_requirement_id__key" ON "hierarchy_requirement_submissions"("tenant_id", "requirement_id", "branch_id", "period_label");

-- AddForeignKey
ALTER TABLE "hierarchy_requirements" ADD CONSTRAINT "hierarchy_requirements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hierarchy_requirements" ADD CONSTRAINT "hierarchy_requirements_approval_workflow_id_fkey" FOREIGN KEY ("approval_workflow_id") REFERENCES "approval_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hierarchy_requirement_submissions" ADD CONSTRAINT "hierarchy_requirement_submissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hierarchy_requirement_submissions" ADD CONSTRAINT "hierarchy_requirement_submissions_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "hierarchy_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hierarchy_requirement_submissions" ADD CONSTRAINT "hierarchy_requirement_submissions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hierarchy_requirement_submissions" ADD CONSTRAINT "hierarchy_requirement_submissions_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
