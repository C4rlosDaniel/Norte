# Ambiente e comandos

## Requisitos

- Node.js 24+ e npm 11+
- Projeto Supabase (Postgres + Auth)

## Configurar o Supabase

1. Criar projeto em https://supabase.com.
2. Em **Project Settings → Database**, copiar:
   - Connection string **Transaction pooler** (porta 6543) → `DATABASE_URL`
   - Connection string **Session pooler** (porta 5432) → `DIRECT_URL`.
     Em projetos novos a conexão "Direct" é só IPv6; se sua rede não tiver
     IPv6, use o session pooler para migrações. Nunca use a 6543 para DDL.
3. Em **Project Settings → API**, copiar:
   - Project URL → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
4. Em **Authentication → Providers**, manter e-mail/senha habilitado e
   **desligar cadastro público** ("Allow new users to sign up" = off).
5. Em **Authentication → URL Configuration**, definir `APP_URL` como Site URL e
   adicionar `http://localhost:3000/**` em Redirect URLs (desenvolvimento).
6. Copiar `apps/web/.env.example` para `apps/web/.env.local` e preencher.

A `SUPABASE_SERVICE_ROLE_KEY` só é usada pelo script `create:admin`, executado
na sua máquina. Nunca coloque essa chave em variável `NEXT_PUBLIC_*`, no
frontend ou no deploy.

## Variáveis

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `DATABASE_URL` | sim | runtime (pooler, porta 6543) |
| `DIRECT_URL` | sim | migrações (porta 5432) |
| `SUPABASE_URL` | sim | Auth no servidor |
| `SUPABASE_ANON_KEY` | sim | Auth no servidor |
| `APP_URL` | não | links absolutos (padrão `http://localhost:3000`) |
| `RESTAURANT_SLUG` | não | slug usado na home e no seed |
| `LOG_LEVEL` | não | `debug`/`info`/`warn`/`error` |
| `SUPABASE_SERVICE_ROLE_KEY` | só scripts | criar usuário do painel |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | só scripts | acesso inicial |
| `WHATSAPP_*` | Fase 5 | credenciais da Cloud API |

A validação é preguiçosa: o build não exige credenciais; a primeira requisição
que precisar do banco falha com mensagem listando o que falta.

## Comandos (dentro de `apps/web`)

```bash
npm install          # dependências
npm run dev          # desenvolvimento em http://localhost:3000
npm run build        # build de produção
npm start            # servir o build
npm run lint         # ESLint (sem regras desligadas)
npm run typecheck    # tsc --noEmit
npm test             # Vitest (unitários + integração PGlite)
npm run test:watch   # Vitest em watch
npm run test:e2e     # Playwright (login, configurações e cardápio; exige Supabase real)

npm run db:generate  # gerar migração a partir do schema
npm run db:migrate   # aplicar migrações (usa DIRECT_URL)
npm run db:studio    # Drizzle Studio
npm run db:seed      # dados de demonstração (idempotente, não sobrescreve cardápio)
npm run create:admin # cria/atualiza acesso do painel (service role)
```

Para reimportar o cardápio de demonstração do zero (destrutivo, só em
desenvolvimento): `SEED_RESET_MENU=1 npm run db:seed`.

## Migrações

O schema fica em `src/server/db/schema.ts` e o histórico em `drizzle/`.

```bash
# depois de editar o schema
npm run db:generate
# revisar o SQL gerado em drizzle/*.sql e commitar
npm run db:migrate
```

Nunca editar uma migração já aplicada em produção. Nunca rodar DDL pela porta
6543 (transaction pooler).

O app usa `prepare: false` no postgres-js porque o pooler em modo transaction
não suporta prepared statements. O pool é pequeno (5 conexões) e reaproveitado
por processo.

## Testes

`npm test` roda sem banco externo:

- **Unitários**: horário de funcionamento (fuso, múltiplos períodos, virada de
  meia-noite, entrega), dinheiro, schemas de configurações e cardápio,
  integridade dos dados importados do protótipo.
- **Integração**: Postgres real em WASM (PGlite) com as mesmas migrações;
  valida SQL, constraints, autorização de configurações, CRUD do cardápio,
  isolamento entre restaurantes e filtros do cardápio público.

Os testes de unidade/integração **não** cobrem login real no Supabase, RLS nem o
navegador. Login, configurações e o fluxo do cardápio são cobertos pelo E2E
abaixo.

## E2E (Playwright)

Somente fluxos críticos, contra build de produção e Supabase real:

```bash
npm run build
E2E_EMAIL="voce@restaurante.com" E2E_PASSWORD="sua-senha" npm run test:e2e
```

- `playwright.config.ts` sobe `next start` na porta 3100 e reutiliza um servidor
  já aberto.
- Sem `E2E_EMAIL`/`E2E_PASSWORD` os testes autenticados são pulados (o CI não
  tem segredo).
- O teste da Fase 1 altera a taxa de entrega, recarrega para provar a
  persistência e restaura o valor original.
- O teste da Fase 2 cria categoria, produto e adicional, confere no cardápio
  público, tenta excluir a categoria com produto (bloqueado), remove tudo e
  limpa os dados mesmo se falhar.
- Instalação do navegador: `npx playwright install chromium`.

## Latência e região

Projetos Supabase fora do Brasil adicionam ~250 ms por consulta e até alguns
segundos para abrir conexão. O painel faz várias consultas por requisição.
Para produção, criar o projeto em **sa-east-1 (São Paulo)**.

## Acesso do painel

Não existe cadastro público. Crie o usuário em `Authentication → Users → Add
user` (marque Auto Confirm) e rode `npm run create:admin` com `ADMIN_EMAIL`.
O script só vincula o usuário ao restaurante; não precisa de service role.

**Desligue "Allow new users to sign up"** em `Authentication → Sign In / Up`
para que ninguém crie conta pela API pública.

## Primeiro acesso

```bash
cd apps/web
npm run db:migrate
npm run db:seed
# preencha SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL e ADMIN_PASSWORD no .env.local
npm run create:admin
npm run dev
```

Acesse `/painel` e entre com o e-mail/senha definidos. Não existe tela de
cadastro.

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| `Configuração de ambiente inválida` | `.env.local` ausente ou incompleto |
| `password authentication failed` | senha do banco com caracteres não escapados na URL |
| `prepared statement already exists` | `DATABASE_URL` apontando para porta 5432 em runtime (ou `prepare: false` removido) |
| Login sempre falha com usuário correto | cadastro não criado (`create:admin`) ou e-mail não confirmado |
| `/painel` redireciona para `/login?erro=sem-acesso` | usuário autenticado sem linha em `restaurant_users` |
