# Fase 3 — Pedido

Data: 26/10/2026

## Entregue

- Migração `0002_wet_thaddeus_ross.sql` com:
  - `orders`, `order_items`, `order_item_modifiers`, `order_events`;
  - `print_jobs` e `whatsapp_tasks` como filas criadas junto do pedido;
  - enums de status, tipo, pagamento, impressão e WhatsApp;
  - índices de listagem, unicidade de número/idempotência/link e `CHECK`s de
    dinheiro, total e troco.
- Carrinho no navegador:
  - `localStorage` por restaurante, hidratação tolerante a cardápio alterado;
  - produto com grupos de adicionais em diálogo, respeitando mínimo, máximo,
    opção indisponível e adicional repetido;
  - linhas iguais são agrupadas; observação diferente separa a linha;
  - limite de 20 por linha, 50 linhas e 30 opções por item;
  - aviso visível quando produto saiu do cardápio ou ficou indisponível.
- Checkout `/checkout/[slug]`:
  - entrega ou retirada, endereço condicional, pagamento e troco;
  - resumo, taxa, pedido mínimo e total recalculados no servidor;
  - bloqueio quando a loja está fechada ou a entrega está fora da janela;
  - chave de idempotência no navegador para retry/duplo clique;
  - mensagens por campo e erro geral sem perder o carrinho.
- Criação transacional do pedido:
  - relê produto, categoria, grupos, opções e preços do banco;
  - grava snapshot de item e adicional; apagar produto não altera pedido;
  - número global por restaurante (`#0001`), incrementado na mesma transação;
  - código público aleatório de 16 hex;
  - pedido + itens + histórico + `print_jobs` + `whatsapp_tasks` na mesma
    transação;
  - idempotência verificada antes e depois da transação;
  - rate limit por IP (10/10 min) e telefone com hash (10/hora).
- Página pública `/pedido/[code]`:
  - status, itens, totais, endereço, pagamento e histórico;
  - atualização automática por polling;
  - sem login e sem expor id interno.
- Painel:
  - `/painel/pedidos` com filtros Todos/Novos/Em andamento/Finalizados,
    contadores, auto-refresh e estados vazios;
  - `/painel/pedidos/[id]` com cliente, endereço, pagamento, troco, itens,
    histórico, impressão e WhatsApp;
  - ações de próximo status e cancelamento com motivo;
  - toda ação revalida a página e devolve sucesso/erro na URL.
- Cancelamento encerra impressão ainda pendente e marca tarefa de WhatsApp não
  enviada como `skipped`.
- Ajustes de dados/configuração anteriores ao checkout:
  - cardápio com 16 categorias, 108 produtos, 36 grupos e 175 opções;
  - "Adicionais" virou grupos de adicionais dos produtos;
  - horário 09:00–18:00 todos os dias, taxa mínima de R$ 5,00 e cadastro
    público desligado no Supabase.

## Decisões

1. **Número global por restaurante, não por dia.** O contador fica em
   `restaurants.last_order_number` e é incrementado dentro da transação. Pedido
   apagado não devolve número.
2. **Link público com código aleatório.** `/pedido/[code]` usa 64 bits em hex,
   não o número sequencial nem o uuid.
3. **Snapshot completo.** O pedido não depende do cardápio atual. `product_id`
   em `order_items` é referência fraca (`SET NULL`).
4. **Idempotência antes do rate limit.** Repetir a mesma chave devolve o pedido
   já criado, mesmo que o limite tenha sido atingido no retry. Se duas
   requisições passarem juntas, o índice único resolve a corrida.
5. **Rate limit em banco.** Serverless não compartilha memória; o contador
   atômico em `rate_limits` funciona entre instâncias. Telefone é guardado como
   hash no bucket, não em texto.
6. **Status explícito e sem volta.** Entrega:
   `pending → confirmed → preparing → ready → out_for_delivery → delivered`.
   Retirada vai de `ready` para `delivered`. `canceled` é terminal.
7. **Impressão e WhatsApp só entram na fila.** A Fase 3 não imprime nem envia;
   ela garante que o trabalho nasce junto do pedido e sobrevive à falha dos
   consumidores das Fases 4 e 5.
8. **CAPTCHA fica para a Fase 6.** O checkout é link-first e já tem rate limit
   no servidor. Turnstile não foi implementado; reavaliar com evidência de
   abuso (registrado em D11).
9. **Auto-refresh por polling.** Painel e página pública consultam o servidor a
   cada 10 s; não há WebSocket nem serviço extra nesta fase.

## Arquivos principais

```
apps/web/drizzle/0002_wet_thaddeus_ross.sql          migração do pedido
apps/web/src/server/db/schema.ts                     tabelas e enums
apps/web/src/server/orders/schema.ts                 Zod do checkout e endereço
apps/web/src/server/orders/create-order.ts           recálculo, transação, idempotência
apps/web/src/server/orders/status.ts                 máquina de estados e rótulos
apps/web/src/server/orders/mutations.ts              status/cancelamento
apps/web/src/server/orders/queries.ts                painel e link público
apps/web/src/server/orders/rate-limit.ts             contador atômico
apps/web/src/server/orders/types.ts                  payloads de impressão/WhatsApp
apps/web/src/components/menu/cart.ts                 carrinho e validação local
apps/web/src/components/menu/cart-drawer.tsx         gaveta do carrinho
apps/web/src/components/menu/product-dialog.tsx      escolha de adicionais
apps/web/src/components/public-menu-view.tsx         cardápio + carrinho
apps/web/src/components/checkout/checkout-client.tsx checkout no navegador
apps/web/src/app/checkout/actions.ts                 Server Action do checkout
apps/web/src/app/checkout/[slug]/page.tsx            página de checkout
apps/web/src/app/pedido/[code]/page.tsx              acompanhamento público
apps/web/src/app/painel/pedidos/page.tsx             lista de pedidos
apps/web/src/app/painel/pedidos/[id]/page.tsx        detalhe do pedido
apps/web/src/app/painel/pedidos/actions.ts           ação de status
apps/web/tests/unit/order-schema.test.ts             validação do checkout
apps/web/tests/unit/order-status.test.ts             transições
apps/web/tests/unit/cart.test.ts                     carrinho
apps/web/tests/integration/orders.test.ts            pedido, status e consultas
apps/web/e2e/fase-3.spec.ts                          fluxo real de ponta a ponta
```

## Verificação executada

Tudo em `apps/web`, Node 24.19.0, npm 11.17.0, Windows.

| Comando | Resultado |
| --- | --- |
| `npm run lint` | sem erros e sem avisos (nenhuma regra desligada) |
| `npm run typecheck` | sem erros |
| `npm test` | 12 arquivos, 107 testes, todos passando |
| `npm run build` | build de produção concluído; rotas `/checkout/[slug]`, `/pedido/[code]`, `/painel/pedidos` e `/painel/pedidos/[id]` presentes |
| `npm run db:migrate` (Supabase real) | migração `0002` aplicada |
| `npm run test:e2e` | **4/4 passando**: Fase 1, Fase 2 e Fase 3 contra o Supabase real |

Testes unitários cobrem:

- normalização e formatação de telefone, endereço, troco e campos do checkout;
- recusa de troco fora de dinheiro, carrinho vazio, quantidade acima do limite e
  chave de idempotência inválida;
- fluxo de status de entrega e retirada, proibição de pular/voltar e rótulos;
- carrinho com adicionais, grupo obrigatório, máximo, adicional repetido,
  produto indisponível, item removido, agrupamento de linhas e limites.

Testes de integração (9/9) cobrem:

- recálculo de preço, snapshot e criação de impressão + WhatsApp na mesma
  transação;
- numeração sequencial e snapshot preservado após apagar o produto;
- repetição da chave de idempotência devolvendo o mesmo pedido;
- recusa de item, categoria, adicional e opção inválidos;
- horário, entrega, forma de pagamento, pedido mínimo e troco;
- bloqueio após 10 pedidos na mesma janela;
- fluxo de status e recusa de transição inválida;
- cancelamento encerrando impressão e WhatsApp pendentes;
- isolamento por restaurante, filtros da lista e consulta pública por código.

## E2E do pedido (Supabase real)

O teste `e2e/fase-3.spec.ts`:

1. força o restaurante aberto e com entrega liberada, guardando configurações e
   horários originais;
2. escolhe um produto sem adicionais, adiciona ao carrinho e abre o checkout;
3. preenche cliente, entrega, Pix e observação;
4. envia o pedido e confere `Pedido #...`, status `Novo`, itens e forma de
   pagamento no link público;
5. entra no painel, encontra o pedido e clica em "Aceitar pedido";
6. confere `Confirmado` no painel e no link público;
7. cancela com motivo e confere `Cancelado` nos dois lugares e o WhatsApp
   `Não enviado`;
8. apaga o pedido e restaura configurações/horários no `afterAll`, mesmo em caso
   de falha.

O teste cria um pedido real no banco e o apaga no `afterAll`. Em operação
normal, o contador não volta atrás quando um pedido é apagado. Como este banco
ainda não tinha pedidos reais, o contador foi zerado manualmente depois da
verificação para que o primeiro pedido real seja `#0001`.

## Não verificado

- Consumo real de `print_jobs` pelo agente Windows (Fase 4).
- Envio real de WhatsApp, janela de 24h, templates e webhook (Fase 5).
- Concorrência de dois operadores mudando o mesmo pedido ao mesmo tempo.
- Impressão em impressora térmica real, corte, acentuação e largura de papel.
- CAPTCHA/Turnstile e rate limit no login.
- Retenção/expurgo LGPD e anonimização de pedidos antigos.
- Deploy real, domínio, TLS e região sa-east-1.
- Imagens de produto.

## Pendências e bloqueios

1. Fase 4: agente de impressão, API key com hash, lease e driver ESC/POS.
2. Fase 5: Cloud API, credenciais, número, templates aprovados e provider
   simulado.
3. Definir retenção de pedidos e dados pessoais antes do go-live.
4. Migrar o projeto Supabase para **sa-east-1** antes da publicação.
5. Trocar dados de demonstração pelos dados definitivos do restaurante.
6. Revisar antiabuso na Fase 6 (login, CAPTCHA e limites mais finos).

## Próxima tarefa

Fase 4 — agente de impressão Windows:

1. Endpoint autenticado de poll e confirmação, com API key hasheada.
2. Lease com expiração para não imprimir duas vezes.
3. `PrinterDriver` com implementação ESC/POS e simulada.
4. Empacotamento em executável, instalação e runbook.
5. Teste de ponta a ponta com o pedido criado pela Fase 3.
