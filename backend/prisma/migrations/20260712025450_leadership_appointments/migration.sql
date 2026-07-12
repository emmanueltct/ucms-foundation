-- CreateTable
CREATE TABLE "leadership_appointments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "target_entity_type" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'leader',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leadership_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leadership_appointments_tenant_id_target_entity_type_target_idx" ON "leadership_appointments"("tenant_id", "target_entity_type", "target_entity_id");

-- CreateIndex
CREATE INDEX "leadership_appointments_tenant_id_user_id_idx" ON "leadership_appointments"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leadership_appointments_tenant_id_target_entity_type_target_key" ON "leadership_appointments"("tenant_id", "target_entity_type", "target_entity_id", "user_id");

-- AddForeignKey
ALTER TABLE "leadership_appointments" ADD CONSTRAINT "leadership_appointments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_appointments" ADD CONSTRAINT "leadership_appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
