# Modelo de dados

PostgreSQL via Supabase, esquema `public`, migrações em `apps/web/drizzle/`.

## Convenções

- Ids em `uuid` (`gen_random_uuid()`).
- Dinheiro em `integer` de centavos, com `CHECK >= 0`.
- Datas em `timestamptz`; horários de funcionamento em `time` local do
  restaurante.
- `created_at` / `updated_at` presentes em tudo que é editável.
- Fuso do restaurante explícito (`restaurants.timezone`), nunca o fuso do
  servidor.

## Fase 1 (implementado)

### `restaurants`

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid pk | |
| `slug` | text unique | usado na URL pública |
| `name` | text | |
| `timezone` | text | padrão `America/Sao_Paulo` |
| `last_order_number` | integer | contador sequencial da Fase 3 |
| `created_at`, `updated_at` | timestamptz | |

### `restaurant_users`

Vínculo entre usuário do Supabase Auth (`auth.users`) e restaurante.

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid pk | |
| `user_id` | uuid unique | sem FK: `auth.users` é do Supabase |
| `restaurant_id` | uuid fk cascade | |
| `role` | enum `owner`/`staff` | |
| `created_at`, `updated_at` | timestamptz | |

Um usuário pertence a um restaurante nesta fase. A unicidade em `user_id`
impede vínculo duplicado.

### `restaurant_settings`

1:1 com restaurante (pk é o `restaurant_id`).

Campos: `phone`, `address_line`, `delivery_fee_cents`, `min_order_cents`,
`delivery_enabled`, `is_manually_closed`, `closed_message`, `payment_methods`
(`text[]`, padrão `cash, card, pix`), `updated_at`.

`is_manually_closed` tem prioridade sobre o horário de funcionamento.

### `business_hours`

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid pk | |
| `restaurant_id` | uuid fk cascade | |
| `weekday` | smallint 0–6 | 0 = domingo |
| `opens_at`, `closes_at` | time | `closes_at <= opens_at` significa virada de meia-noite |
| `accepts_delivery_until` | time nullable | limite para entrega no período |
| `is_closed` | boolean | linha de dia fechado (ex.: domingo) |

Vários períodos por dia são permitidos (almoço e jantar). A unicidade é
`(restaurant_id, weekday, opens_at)`.

### `rate_limits`

Contador por `(bucket, window_start)` para rate limit distribuído. Ainda sem uso
— entra no checkout (Fase 3) e nas rotas sensíveis (Fase 6).

## Fase 2 (planejado)

- `menu_categories` (nome, ordem, ativo)
- `products` (categoria, nome, descrição, preço em centavos, disponível,
  destaque, ordem, imagem)
- `modifier_groups` (produto, nome, mínimo, máximo, obrigatório)
- `modifiers` / `product_modifiers` (nome, preço adicional em centavos,
  disponível)

## Fase 3 (planejado)

- `orders` (número sequencial, status, tipo entrega/retirada, cliente,
  endereço, forma de pagamento, troco, subtotal, taxa, total, `link_code`,
  timestamps)
- `order_items` (snapshot de nome e preço, quantidade, observação)
- `order_item_modifiers` (snapshot de adicionais)
- `order_events` (histórico de status, autor, timestamp)
- `print_jobs` (pedido, payload renderizado, status, tentativas, lease)
- `whatsapp_tasks` / `whatsapp_messages` (tarefa, template, status, id externo)

## Fase 4/5 (planejado)

- `api_keys` (nome, hash, último uso, revogação) para o agente.
- `whatsapp_accounts` (phone number id, WABA id, status, tokens cifrados).

## Regras que não podem quebrar

1. Total do pedido é recalculado no servidor a partir do banco.
2. Itens do pedido guardam snapshot; mudar o cardápio não altera pedido antigo.
3. Número do pedido é sequencial e nunca reaproveitado.
4. Pedido, trabalho de impressão e tarefa de WhatsApp nascem na mesma transação.
5. `restaurant_id` sempre vem da sessão autorizada, nunca do corpo da requisição.
