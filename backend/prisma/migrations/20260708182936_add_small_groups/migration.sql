-- CreateTable
CREATE TABLE "small_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "group_type" TEXT,
    "description" TEXT,
    "meeting_day" TEXT,
    "meeting_time" TEXT,
    "location" TEXT,
    "capacity" INTEGER,
    "min_age" INTEGER,
    "max_age" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "small_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "small_group_memberships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "small_group_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "small_group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "small_groups_tenant_id_idx" ON "small_groups"("tenant_id");

-- CreateIndex
CREATE INDEX "small_groups_tenant_id_branch_id_idx" ON "small_groups"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "small_groups_tenant_id_name_key" ON "small_groups"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "small_group_memberships_tenant_id_idx" ON "small_group_memberships"("tenant_id");

-- CreateIndex
CREATE INDEX "small_group_memberships_tenant_id_small_group_id_idx" ON "small_group_memberships"("tenant_id", "small_group_id");

-- CreateIndex
CREATE INDEX "small_group_memberships_tenant_id_member_id_idx" ON "small_group_memberships"("tenant_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "small_group_memberships_tenant_id_small_group_id_member_id_key" ON "small_group_memberships"("tenant_id", "small_group_id", "member_id");

-- AddForeignKey
ALTER TABLE "small_groups" ADD CONSTRAINT "small_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "small_groups" ADD CONSTRAINT "small_groups_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "small_group_memberships" ADD CONSTRAINT "small_group_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "small_group_memberships" ADD CONSTRAINT "small_group_memberships_small_group_id_fkey" FOREIGN KEY ("small_group_id") REFERENCES "small_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "small_group_memberships" ADD CONSTRAINT "small_group_memberships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
