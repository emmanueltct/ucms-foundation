-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "last_used_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tenant_security_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "access_token_ttl_minutes" INTEGER,
    "refresh_token_ttl_days" INTEGER,
    "inactivity_logout_minutes" INTEGER,
    "max_concurrent_sessions" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_security_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_security_settings_tenant_id_key" ON "tenant_security_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_security_settings" ADD CONSTRAINT "tenant_security_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
