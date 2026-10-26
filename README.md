# Norte

Cardápio web de um restaurante único com pedido automático: o cliente monta o
pedido no celular, o pedido cai no painel da equipe, é impresso na cozinha e a
confirmação chega pelo WhatsApp oficial — sem ninguém digitar nada.

Este repositório é a reescrita séria do protótipo que ficou no projeto
`norte-grill-experience` (Lovable). Nada aqui depende do Lovable.

## Estado atual

| Fase | Escopo | Situação |
| --- | --- | --- |
| 0 | Auditoria e arquitetura | concluída |
| 1 | Fundação: Next.js, banco, migrações, autenticação, painel, horários e configurações | concluída e verificada no Supabase real |
| 2 | Cardápio: categorias, produtos, adicionais, painel e cardápio público | concluída e verificada no Supabase real |
| 3 | Carrinho, checkout, pedidos e impressão | próxima |
| 4 | Agente de impressão Windows | não iniciada |
| 5 | WhatsApp Cloud API | não iniciada |
| 6 | Endurecimento, LGPD e operação | não iniciada |
| 7 | Publicação | não iniciada |

## Estrutura

```
apps/
  web/          Next.js 16 (App Router), TypeScript, Tailwind 4, Drizzle, Supabase
  print-agent/  agente de impressão Windows (Fase 4 — ainda não existe)
docs/           decisões, modelo de dados, segurança, runbooks
```

## Rodar localmente

Pré-requisitos: Node.js 24+, npm 11+ e um projeto Supabase.

```bash
cd apps/web
cp .env.example .env.local     # preencha DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_ANON_KEY
npm install
npm run db:migrate
npm run db:seed
npm run create:admin           # requer SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL e ADMIN_PASSWORD
npm run dev
```

- Cardápio público: http://localhost:3000 (ou `/cardapio/amigos-do-norte`)
- Painel: http://localhost:3000/painel (sem cadastro público; o acesso é criado pelo script)
- Verificações: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- E2E (com Supabase real): `E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e`

Detalhes de ambiente, comandos e configuração do Supabase em
[`docs/06-ambiente-comandos.md`](docs/06-ambiente-comandos.md).

## Documentação

- [`docs/00-roadmap.md`](docs/00-roadmap.md) — fases e critérios de aceite
- [`docs/01-decisoes.md`](docs/01-decisoes.md) — decisões fechadas (ADRs curtos)
- [`docs/02-modelo-de-dados.md`](docs/02-modelo-de-dados.md) — tabelas e regras
- [`docs/03-seguranca-lgpd.md`](docs/03-seguranca-lgpd.md) — autorização, segredos, dados pessoais
- [`docs/04-whatsapp-meta.md`](docs/04-whatsapp-meta.md) — Cloud API, janela de 24h, templates, riscos
- [`docs/05-impressao-agente.md`](docs/05-impressao-agente.md) — agente local, lease, ESC/POS
- [`docs/06-ambiente-comandos.md`](docs/06-ambiente-comandos.md) — variáveis, comandos, migrações
- [`docs/fases/fase-1.md`](docs/fases/fase-1.md) — relatório da fundação
- [`docs/fases/fase-2.md`](docs/fases/fase-2.md) — relatório do cardápio

## Regras do projeto

- Dinheiro sempre em centavos inteiros; cálculo de preço só no servidor.
- Toda entrada externa passa por Zod; toda rota do painel autoriza no servidor.
- Nenhum segredo em repositório, frontend ou log.
- Nada é considerado pronto sem verificação executada (`lint`, `typecheck`, `test`, `build`).
- O servidor nunca acessa o computador do restaurante: o agente de impressão
  puxa o trabalho.
