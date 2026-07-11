-- CreateTable
CREATE TABLE "hierarchy_level_definitions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_type_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "allowed_parent_type_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowed_child_type_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hierarchy_level_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hierarchy_level_definitions_tenant_id_idx" ON "hierarchy_level_definitions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "hierarchy_level_definitions_tenant_id_branch_type_key_key" ON "hierarchy_level_definitions"("tenant_id", "branch_type_key");

-- AddForeignKey
ALTER TABLE "hierarchy_level_definitions" ADD CONSTRAINT "hierarchy_level_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
