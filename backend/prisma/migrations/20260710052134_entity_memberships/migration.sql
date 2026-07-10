-- CreateTable
CREATE TABLE "entity_memberships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "attached_to_entity_type" TEXT NOT NULL,
    "attached_to_entity_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entity_memberships_tenant_id_idx" ON "entity_memberships"("tenant_id");

-- CreateIndex
CREATE INDEX "entity_memberships_tenant_id_attached_to_entity_type_attach_idx" ON "entity_memberships"("tenant_id", "attached_to_entity_type", "attached_to_entity_id");

-- CreateIndex
CREATE INDEX "entity_memberships_tenant_id_member_id_idx" ON "entity_memberships"("tenant_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_memberships_tenant_id_attached_to_entity_type_attach_key" ON "entity_memberships"("tenant_id", "attached_to_entity_type", "attached_to_entity_id", "member_id");

-- AddForeignKey
ALTER TABLE "entity_memberships" ADD CONSTRAINT "entity_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_memberships" ADD CONSTRAINT "entity_memberships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
