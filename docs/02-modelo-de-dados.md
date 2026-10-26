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

## Fase 2 (implementado)

### `menu_categories`

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid pk | |
| `restaurant_id` | uuid fk cascade | |
| `name` | text | único por restaurante no banco (maiúsculas contam) |
| `description` | text | padrão vazio |
| `sort_order` | integer | `CHECK >= 0`; menor aparece primeiro |
| `is_active` | boolean | categoria inativa não aparece no site |
| `created_at`, `updated_at` | timestamptz | |

O app recusa nome repetido sem diferenciar maiúsculas (`Porções` × `porções`),
além do índice único do banco. Categoria com produtos não pode ser excluída
pelo app.

### `products`

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid pk | |
| `restaurant_id` | uuid fk cascade | redundante com a categoria, mas usado na autorização |
| `category_id` | uuid fk cascade | |
| `name` | text | |
| `description` | text | padrão vazio |
| `price_cents` | integer | `CHECK >= 0`, nunca float |
| `image_url` | text nullable | reservado; upload ainda não existe |
| `serves_label` | text | "Serve 1", "Serve 2" |
| `badge` | text | selo curto ("Raiz", "Mais pedido") |
| `tags` | text[] | filtros futuros (`serve1`, `dividir`, ...) |
| `is_available` | boolean | pausa sem apagar o produto |
| `is_featured` | boolean | alimenta "Os mais pedidos" |
| `sort_order` | integer | `CHECK >= 0` |
| `created_at`, `updated_at` | timestamptz | |

Índice em `(restaurant_id, category_id, sort_order)`. Apagar produto remove
grupos e opções em cascata; pedidos antigos não são afetados porque guardam
snapshot (Fase 3).

### `modifier_groups`

Pertencem ao produto, não são compartilhados.

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid pk | |
| `product_id` | uuid fk cascade | |
| `name` | text | ex.: "Ponto da carne", "Adicionais" |
| `min_selections` | integer | `>= 0`; maior que zero = obrigatório |
| `max_selections` | integer | `>= 1` e `>= min_selections` |
| `sort_order` | integer | |
| `created_at`, `updated_at` | timestamptz | |

### `modifier_options`

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid pk | |
| `group_id` | uuid fk cascade | |
| `name` | text | |
| `price_cents` | integer | `CHECK >= 0`; zero = sem custo |
| `is_available` | boolean | opção indisponível não aparece no site |
| `sort_order` | integer | |
| `created_at`, `updated_at` | timestamptz | |

Consultas do cardápio público fazem três leituras por página (categorias,
produtos, adicionais) e montam a árvore em memória. Categoria inativa ou vazia
não é renderizada; produto indisponível é renderizado marcado.

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
