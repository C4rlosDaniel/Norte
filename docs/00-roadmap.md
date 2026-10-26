# Roadmap

Cada fase termina com um relatório em `docs/fases/`. Nada avança de fase com
verificação pendente.

## Fase 0 — Auditoria e arquitetura

Concluída. Levantamento do protótipo (Lovable), definição de stack, modelo de
dados, fluxo de pedido, estratégia de WhatsApp, agente de impressão, riscos.

## Fase 1 — Fundação (atual)

Entregas:

- Next.js 16 (App Router) + TypeScript estrito + Tailwind 4.
- Banco PostgreSQL (Supabase) com Drizzle ORM e migrações versionadas.
- Autenticação de equipe via Supabase Auth, sem cadastro público.
- Autorização real por vínculo `restaurant_users` (não por esconder botão).
- Painel com Pedidos, Cardápio e Configurações.
- Cálculo de aberto/fechado por fuso, múltiplos períodos e virada de meia-noite.
- Um caminho de escrita real: configurações do restaurante.
- Seed de desenvolvimento, script de criação de acesso, testes unitários e de
  integração com Postgres (PGlite), CI.

Fora de escopo: cardápio, pedidos, impressão, WhatsApp, pagamento online.

Critério de aceite: `lint`, `typecheck`, `test` e `build` verdes; login e
gravação de configurações verificados contra o Supabase real.

## Fase 2 — Cardápio

Categorias, produtos, grupos de adicionais, disponibilidade, destaque,
ordenação; painel de edição; cardápio público por slug; dados reais migrados do
protótipo; imagens com storage quando necessário.

## Fase 3 — Pedido

Carrinho, checkout (entrega/retirada, pagamento, troco), recálculo integral no
servidor, snapshot do pedido, número sequencial legível, criação transacional
de pedido + trabalho de impressão + tarefa de WhatsApp, painel de pedidos com
mudança de status, proteção contra pedido duplicado e rate limit.

## Fase 4 — Impressão

Agente Windows em Node/TS, autenticação por API key com hash, endpoint de poll
autenticado, lease com expiração, `PrinterDriver` (ESC/POS e simulado),
empacotamento como executável, instalação e runbook.

## Fase 5 — WhatsApp

Cloud API oficial, webhook com verificação de assinatura, deduplicação por
message id, janela de 24h, templates, provider simulado para desenvolvimento,
confirmação e aviso de saída para entrega.

## Fase 6 — Endurecimento

Rate limits completos, logs sem dados pessoais, retenção LGPD, backups e
restauração testada, observabilidade, tratamento de falhas de impressão e
WhatsApp, runbook de incidentes.

## Fase 7 — Publicação

Domínio, TLS, deploy, monitoramento, teste ponta a ponta com número real e
impressora real, treinamento da equipe, go-live.
