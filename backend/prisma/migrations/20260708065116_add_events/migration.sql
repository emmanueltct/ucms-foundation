-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "event_type" TEXT,
    "description" TEXT,
    "location" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "member_id" TEXT,
    "guest_name" TEXT,
    "guest_contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_tenant_id_idx" ON "events"("tenant_id");

-- CreateIndex
CREATE INDEX "events_tenant_id_branch_id_idx" ON "events"("tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "events_tenant_id_starts_at_idx" ON "events"("tenant_id", "starts_at");

-- CreateIndex
CREATE INDEX "event_registrations_tenant_id_idx" ON "event_registrations"("tenant_id");

-- CreateIndex
CREATE INDEX "event_registrations_tenant_id_event_id_idx" ON "event_registrations"("tenant_id", "event_id");

-- CreateIndex
CREATE INDEX "event_registrations_tenant_id_member_id_idx" ON "event_registrations"("tenant_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_tenant_id_event_id_member_id_key" ON "event_registrations"("tenant_id", "event_id", "member_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
