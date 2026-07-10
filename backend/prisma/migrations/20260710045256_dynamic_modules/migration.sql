-- CreateTable
CREATE TABLE "dynamic_module_definitions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "attachable_to_entity_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "statuses" TEXT[] DEFAULT ARRAY['open', 'closed']::TEXT[],
    "approval_workflow_id" TEXT,
    "show_in_nav" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dynamic_module_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dynamic_module_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "module_definition_id" TEXT NOT NULL,
    "attached_to_entity_type" TEXT,
    "attached_to_entity_id" TEXT,
    "status" TEXT NOT NULL,
    "title" TEXT,
    "branch_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dynamic_module_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dynamic_module_record_status_history" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "changed_by_user_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dynamic_module_record_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dynamic_module_definitions_tenant_id_idx" ON "dynamic_module_definitions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "dynamic_module_definitions_tenant_id_key_key" ON "dynamic_module_definitions"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "dynamic_module_records_tenant_id_idx" ON "dynamic_module_records"("tenant_id");

-- CreateIndex
CREATE INDEX "dynamic_module_records_tenant_id_module_definition_id_idx" ON "dynamic_module_records"("tenant_id", "module_definition_id");

-- CreateIndex
CREATE INDEX "dynamic_module_records_tenant_id_attached_to_entity_type_at_idx" ON "dynamic_module_records"("tenant_id", "attached_to_entity_type", "attached_to_entity_id");

-- CreateIndex
CREATE INDEX "dynamic_module_record_status_history_tenant_id_record_id_idx" ON "dynamic_module_record_status_history"("tenant_id", "record_id");

-- AddForeignKey
ALTER TABLE "dynamic_module_definitions" ADD CONSTRAINT "dynamic_module_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_module_definitions" ADD CONSTRAINT "dynamic_module_definitions_approval_workflow_id_fkey" FOREIGN KEY ("approval_workflow_id") REFERENCES "approval_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_module_records" ADD CONSTRAINT "dynamic_module_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_module_records" ADD CONSTRAINT "dynamic_module_records_module_definition_id_fkey" FOREIGN KEY ("module_definition_id") REFERENCES "dynamic_module_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_module_records" ADD CONSTRAINT "dynamic_module_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_module_records" ADD CONSTRAINT "dynamic_module_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_module_record_status_history" ADD CONSTRAINT "dynamic_module_record_status_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_module_record_status_history" ADD CONSTRAINT "dynamic_module_record_status_history_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "dynamic_module_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_module_record_status_history" ADD CONSTRAINT "dynamic_module_record_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
