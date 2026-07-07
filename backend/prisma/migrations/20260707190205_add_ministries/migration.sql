-- CreateTable
CREATE TABLE "ministries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "ministry_type" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ministries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ministry_memberships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ministry_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ministry_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ministries_tenant_id_idx" ON "ministries"("tenant_id");

-- CreateIndex
CREATE INDEX "ministries_tenant_id_branch_id_idx" ON "ministries"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "ministries_tenant_id_name_key" ON "ministries"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "ministry_memberships_tenant_id_idx" ON "ministry_memberships"("tenant_id");

-- CreateIndex
CREATE INDEX "ministry_memberships_tenant_id_ministry_id_idx" ON "ministry_memberships"("tenant_id", "ministry_id");

-- CreateIndex
CREATE INDEX "ministry_memberships_tenant_id_member_id_idx" ON "ministry_memberships"("tenant_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "ministry_memberships_tenant_id_ministry_id_member_id_key" ON "ministry_memberships"("tenant_id", "ministry_id", "member_id");

-- AddForeignKey
ALTER TABLE "ministries" ADD CONSTRAINT "ministries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ministries" ADD CONSTRAINT "ministries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ministry_memberships" ADD CONSTRAINT "ministry_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ministry_memberships" ADD CONSTRAINT "ministry_memberships_ministry_id_fkey" FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ministry_memberships" ADD CONSTRAINT "ministry_memberships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
