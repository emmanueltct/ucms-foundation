-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "new_value" JSONB,
ADD COLUMN     "previous_value" JSONB,
ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assigned_branch_id" TEXT;

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "approver_role_name" TEXT,
    "approver_permission_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "current_step_order" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadlines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "extended_by_user_id" TEXT,
    "extension_reason" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_workflows_tenant_id_entity_type_idx" ON "approval_workflows"("tenant_id", "entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflows_tenant_id_entity_type_name_key" ON "approval_workflows"("tenant_id", "entity_type", "name");

-- CreateIndex
CREATE INDEX "approval_steps_tenant_id_idx" ON "approval_steps"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_workflow_id_step_order_key" ON "approval_steps"("workflow_id", "step_order");

-- CreateIndex
CREATE INDEX "approval_requests_tenant_id_workflow_id_idx" ON "approval_requests"("tenant_id", "workflow_id");

-- CreateIndex
CREATE INDEX "approval_requests_tenant_id_status_idx" ON "approval_requests"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_tenant_id_entity_type_entity_id_key" ON "approval_requests"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "deadlines_tenant_id_status_idx" ON "deadlines"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "deadlines_tenant_id_due_at_idx" ON "deadlines"("tenant_id", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "deadlines_tenant_id_entity_type_entity_id_key" ON "deadlines"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assigned_branch_id_fkey" FOREIGN KEY ("assigned_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_extended_by_user_id_fkey" FOREIGN KEY ("extended_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
