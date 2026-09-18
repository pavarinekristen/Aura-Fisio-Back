-- Credenciais passam a ser opcionais: o paciente nasce como prontuário, sem acesso
-- ao app. O login só existe depois que o profissional o convida.
-- UNIQUE no Postgres aceita múltiplos NULL, então users_email_key continua válido.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- Senha sem e-mail é inutilizável (não há como fazer login).
ALTER TABLE "users" ADD CONSTRAINT "user_password_requires_email"
  CHECK ("password_hash" IS NULL OR "email" IS NOT NULL);

-- Profissional e admin precisam sempre conseguir entrar.
ALTER TABLE "users" ADD CONSTRAINT "staff_requires_credentials"
  CHECK ("role" = 'patient' OR ("email" IS NOT NULL AND "password_hash" IS NOT NULL));

-- CPF do paciente, armazenado somente com dígitos.
ALTER TABLE "profiles" ADD COLUMN "cpf" TEXT;
CREATE UNIQUE INDEX "profiles_cpf_key" ON "profiles"("cpf");
ALTER TABLE "profiles" ADD CONSTRAINT "profile_cpf_format"
  CHECK ("cpf" IS NULL OR "cpf" ~ '^[0-9]{11}$');
