CREATE TYPE "AuraActionStatus" AS ENUM ('pending', 'executed', 'cancelled', 'failed');

-- Uma linha por ação da Aura, do que foi proposto ao que foi de fato gravado.
-- A mesma linha serve de auditoria e de trava de idempotência: a execução só
-- acontece para quem conseguir mover o status de 'pending' para 'executed'.
CREATE TABLE "aura_action_plans" (
    "id"               UUID NOT NULL,
    "professional_id"  UUID NOT NULL,
    "patient_id"       UUID,
    "type"             TEXT NOT NULL,
    "status"           "AuraActionStatus" NOT NULL DEFAULT 'pending',
    "source_text"      TEXT NOT NULL,
    "model"            TEXT NOT NULL,
    "intent_source"    TEXT NOT NULL DEFAULT 'llm',
    "extracted"        JSONB NOT NULL DEFAULT '{}',
    "payload"          JSONB NOT NULL DEFAULT '{}',
    "executed_payload" JSONB,
    "edited_fields"    TEXT[] NOT NULL DEFAULT '{}',
    "result"           JSONB,
    "error"            TEXT,
    "expires_at"       TIMESTAMPTZ NOT NULL,
    "executed_at"      TIMESTAMPTZ,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMPTZ NOT NULL,
    CONSTRAINT "aura_action_plans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "aura_action_plans_professional_id_created_at_idx" ON "aura_action_plans"("professional_id", "created_at");
CREATE INDEX "aura_action_plans_status_expires_at_idx" ON "aura_action_plans"("status", "expires_at");
ALTER TABLE "aura_action_plans" ADD CONSTRAINT "aura_action_plans_professional_id_fkey"
    FOREIGN KEY ("professional_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "aura_action_plans" ADD CONSTRAINT "aura_action_plans_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Expediente e preferências da clínica. professional_id NULL = configuração global,
-- usada como fallback enquanto o profissional não tiver a sua própria linha.
-- business_hours: { "&lt;dia 0=domingo&gt;": [["HH:MM","HH:MM"], ...] }; dia ausente = fechado.
CREATE TABLE "clinic_settings" (
    "id"                       UUID NOT NULL,
    "professional_id"          UUID,
    "timezone"                 TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "business_hours"           JSONB NOT NULL DEFAULT '{"1":[["08:00","12:00"],["13:00","18:00"]],"2":[["08:00","12:00"],["13:00","18:00"]],"3":[["08:00","12:00"],["13:00","18:00"]],"4":[["08:00","12:00"],["13:00","18:00"]],"5":[["08:00","12:00"],["13:00","18:00"]]}',
    "slot_minutes"             INTEGER NOT NULL DEFAULT 30,
    "default_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "morning_hour"             TEXT NOT NULL DEFAULT '09:00',
    "afternoon_hour"           TEXT NOT NULL DEFAULT '14:00',
    "evening_hour"             TEXT NOT NULL DEFAULT '18:00',
    "default_ddd"              TEXT,
    "created_at"               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMPTZ NOT NULL,
    CONSTRAINT "clinic_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clinic_settings_professional_id_key" ON "clinic_settings"("professional_id");
ALTER TABLE "clinic_settings" ADD CONSTRAINT "clinic_settings_professional_id_fkey"
    FOREIGN KEY ("professional_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_settings" ADD CONSTRAINT "clinic_settings_slot_positive" CHECK ("slot_minutes" > 0);
ALTER TABLE "clinic_settings" ADD CONSTRAINT "clinic_settings_duration_positive" CHECK ("default_duration_minutes" > 0);

-- Busca de paciente por nome no banco, em vez de injetar a lista inteira no prompt.
-- O índice cobre lower(full_name): unaccent() não é IMMUTABLE e não pode entrar em
-- expressão de índice; a tolerância a acento fica na pontuação do operador %.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE INDEX "profiles_full_name_trgm_idx" ON "profiles" USING gin (lower("full_name") gin_trgm_ops);

-- A detecção de conflito filtra por profissional + janela de tempo.
CREATE INDEX "calendar_events_professional_id_start_date_idx" ON "calendar_events"("professional_id", "start_date");
