import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "obrigatória"),
  SUPABASE_URL: z.url("precisa ser uma URL válida"),
  SUPABASE_ANON_KEY: z.string().min(20, "chave anon do Supabase ausente ou inválida"),
  RESTAURANT_SLUG: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use apenas letras minúsculas, números e hífen")
    .default("amigos-do-norte"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Validação preguiçosa: o build não precisa de credenciais, mas o primeiro
 * acesso em runtime falha com mensagem explícita se algo estiver faltando.
 */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Configuração de ambiente inválida:\n${issues}\n\nCopie apps/web/.env.example para apps/web/.env.local e preencha os valores.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** Usado apenas em testes para revalidar process.env entre casos. */
export function resetEnvCache(): void {
  cached = null;
}
