-- CreateTable
CREATE TABLE "resource_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "scope_entity_type" TEXT NOT NULL,
    "scope_entity_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resource_assignments_tenant_id_scope_entity_type_scope_enti_idx" ON "resource_assignments"("tenant_id", "scope_entity_type", "scope_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_assignments_tenant_id_scope_entity_type_scope_enti_key" ON "resource_assignments"("tenant_id", "scope_entity_type", "scope_entity_id", "resource_type", "resource_key");

-- AddForeignKey
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
