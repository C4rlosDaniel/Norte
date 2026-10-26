# Fase 1 — Fundação

Data: 26/10/2026

## Entregue

- Monorepo simples: `apps/web` (Next.js) + `docs/`. Sem workspaces npm nesta
  fase; o agente de impressão entra como `apps/print-agent` na Fase 4.
- Next.js 16.4.3 (App Router, Turbopack), React 19.3.1, TypeScript 5.9.3
  estrito (`noUncheckedIndexedAccess`, `noImplicitOverride`), Tailwind 4.
- Banco: PostgreSQL (Supabase) com Drizzle ORM, `postgres-js` com
  `prepare: false` para o pooler, singleton por processo e migração inicial
  versionada.
- Schema da fundação: `restaurants`, `restaurant_users`,
  `restaurant_settings`, `business_hours`, `rate_limits`.
- Autenticação: Supabase Auth com `@supabase/ssr`, `proxy.ts` (Next 16) para
  renovação de sessão, login por Server Action, logout, sem cadastro público.
- Autorização real: `requireMember()` exige vínculo em `restaurant_users`;
  usuário autenticado sem vínculo vê "sem acesso" e não entra no painel.
- Painel: layout com estado aberto/fechado calculado no servidor, navegação
  Pedidos / Cardápio / Configurações, sessão e saída.
- Configurações: formulário com validação Zod no servidor, conversão de BRL para
  centavos, estados de carregando/sucesso/erro, gravação transacional.
- Horário de funcionamento: fuso do restaurante, vários períodos por dia,
  virada de meia-noite, dia fechado, fechamento manual e limite de entrega.
- Cardápio público: página inicial dinâmica com nome, status, taxa, endereço,
  telefone e mensagem de fechamento; estados vazio (sem restaurante), erro e
  carregamento.
- Scripts: `db:seed` idempotente e não destrutivo, `create:admin` via service
  role, geração de migração.
- Testes: unitários de horário/dinheiro/schema e integração em Postgres real
  (PGlite) com as mesmas migrações.
- CI no GitHub Actions rodando lint, typecheck, testes e build.

## Arquivos principais

```
apps/web/src/app/                     páginas, layouts, Server Actions, proxy
apps/web/src/server/env.ts            validação de ambiente
apps/web/src/server/db/               client, schema, tipos
apps/web/src/server/auth/             sessão, cliente Supabase, requireMember
apps/web/src/server/restaurant/       consultas, horários, configurações, membros
apps/web/src/components/status-badge  estado aberto/fechado
apps/web/scripts/                     seed e criação de acesso
apps/web/tests/                       unitários e integração
apps/web/drizzle/                     migração inicial
docs/                                 roadmap, decisões, dados, segurança, runbooks
```

## Verificação executada

Tudo rodando em `apps/web`, Node 24.19.0, npm 11.17.0, Windows.

| Comando | Resultado |
| --- | --- |
| `npm run lint` | sem erros e sem avisos (regras do Next + TypeScript, nenhuma desligada) |
| `npm run typecheck` | sem erros |
| `npm test` | 5 arquivos, 38 testes, todos passando |
| `npm run build` | build de produção concluído; rotas `/`, `/login`, `/painel`, `/painel/pedidos`, `/painel/cardapio`, `/painel/configuracoes` |

A integração usa PGlite (Postgres compilado para WASM) e aplica as migrações
reais, validando SQL, `CHECK`, `UNIQUE`, `ON DELETE CASCADE` e o caso de uso de
configurações.

## Smoke test de runtime

Build de produção servido localmente (`next start`, porta 3123) com credenciais
falsas para testar o comportamento sem Supabase:

| Requisição | Resultado real |
| --- | --- |
| `GET /login` | 200 com o formulário de login renderizado |
| `GET /painel` | 307 para `/login?next=%2Fpainel` (guarda do proxy funcionando) |
| `GET /` com banco fora do ar | shell com `loading.tsx` e, no streaming, o boundary de erro assume a tela |

Observação: como a página usa streaming com `loading.tsx`, o status HTTP é 200 e
o erro é renderizado pelo boundary no cliente — comportamento esperado do Next,
não um 500. O log do servidor mostra a causa real (`ECONNREFUSED`).

## Verificação no Supabase real

Projeto `apompopfrmgqnfhaenxl` (região us-west-2), executada em 26/10/2026:

| Etapa | Resultado |
| --- | --- |
| `npm run db:migrate` (pooler modo sessão, 5432) | migração aplicada; `drizzle.__drizzle_migrations` = 1 |
| `npm run db:seed` | restaurante `8ef53e05-712b-4d00-9005-6dc65b4e1810`, 7 horários, configurações criadas |
| `npm run create:admin` (modo somente vínculo, sem service role) | acesso de `ifodde440@gmail.com` vinculado como `owner` |
| `GET /` no build de produção | 200 com dados reais do banco (nome, endereço, status por fuso) |
| `GET /painel` sem sessão | 307 → `/login?next=%2Fpainel` |
| `npm run test:e2e` | **2/2 passando**: guarda de rota, login real, painel, alteração da taxa, mensagem de sucesso, recarga com valor persistido, restauração e logout |
| Estado final no banco | taxa de volta a 500 centavos, `updated_at` = 14:26:53Z (prova da escrita real) |

Latência medida desta máquina até o projeto: conexão ao pooler de 1,2 s a
5,8 s e consultas seguintes em ~250 ms. É a distância até Oregon. Para produção,
recomendo criar o projeto em **sa-east-1 (São Paulo)** — o fluxo de pedidos faz
várias consultas por requisição.

## Não verificado

- **RLS**: o app acessa o banco pelo servidor; RLS não é usado como barreira.
  Confirmar que o banco não está exposto ao browser.
- **Deploy real** (domínio, TLS, variáveis no provedor).
- **Turnstile e rate limit** (Fases 3 e 6).
- **Cadastro público no Supabase Auth**: ainda está habilitado no projeto (foi
  usado para criar o usuário). Desligar em Authentication → Sign In / Up, já que
  o app não tem cadastro.

## Pendências e bloqueios

1. Desligar o cadastro público no Supabase Auth (o app não tem essa tela).
2. Definir dados reais do restaurante (nome, endereço, telefone, taxa,
   horários) e substituir os valores de demonstração do seed.
3. Confirmar identidade visual definitiva (o protótipo usa "Amigos do Norte";
   o repositório se chama Norte). Afeta nome, logo e metadados.
4. Decidir a região do projeto de produção: **sa-east-1** reduz muito a latência
   em relação ao projeto atual (us-west-2).
5. WhatsApp: decidir número e caminho de onboarding (BSP/coexistência) — maior
   risco do projeto.
6. Impressora: modelo, conexão e largura de papel (Fase 4).
7. LGPD: prazo de retenção e política de privacidade (Fase 6).

## Próxima tarefa

Fase 2 — cardápio:

1. Schema de categorias, produtos, grupos de adicionais e adicionais.
2. Migração e seed com os dados reais do protótipo (`src/data/menu.ts`).
3. Painel de cardápio: CRUD com validação, disponibilidade e ordenação.
4. Cardápio público por slug com estados de carregamento, vazio e erro.
5. Testes de integração para preço, disponibilidade e ordenação.

Antes disso, executar a verificação real no Supabase para fechar a Fase 1.
