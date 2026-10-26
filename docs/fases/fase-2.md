# Fase 2 — Cardápio

Data: 26/10/2026

> Nota de atualização: após a reestruturação que transformou a categoria
> "Adicionais" em grupos de adicionais, o cardápio passou a **16 categorias,
> 108 produtos, 36 grupos e 175 opções**. As contagens abaixo refletem o estado
> atual; o restante do relatório preserva as decisões da fase.

## Entregue

- Schema de cardápio: `menu_categories`, `products`, `modifier_groups`,
  `modifier_options` (migração `0001_married_blink.sql`).
- Dados do protótipo migrados: 16 categorias, 108 produtos, 36 grupos de
  adicionais e 175 opções. A antiga categoria virtual "Mais pedidos" virou
  `products.is_featured` (6 destaques); a categoria "Adicionais" foi convertida
  em grupos de adicionais dos produtos.
- Painel `/painel/cardapio`:
  - criar, editar e remover categorias (nome, descrição, ordem, ativa/inativa);
  - criar, editar, pausar/ativar e remover produtos (categoria, nome, descrição,
    preço, "serve", selo, ordem, disponível, destaque);
  - editor de adicionais por produto: grupos com mínimo/máximo e opções com
    preço e disponibilidade;
  - mensagens de sucesso/erro, validação por campo e confirmação antes de
    excluir;
  - categoria com produtos não pode ser excluída (evita perda silenciosa).
- Cardápio público:
  - `/` usa `RESTAURANT_SLUG`; `/cardapio/[slug]` atende qualquer slug;
  - cabeçalho com status de aberto/fechado pelo fuso, endereço, telefone, taxa e
    pedido mínimo;
  - navegação por categoria, seção "Os mais pedidos" e adicionais em detalhes
    expansíveis;
  - categorias inativas ou vazias não aparecem; produto indisponível aparece
    marcado; opção indisponível é omitida;
  - estados vazio (cardápio em preparação) e restaurante não configurado.
- Seed idempotente do cardápio: só importa quando o restaurante ainda não tem
  categorias. `SEED_RESET_MENU=1 npm run db:seed` apaga e reimporta (destrutivo,
  apenas desenvolvimento).
- Validação Zod em todas as entradas e autorização por `requireMember()` em
  todas as ações do painel. `restaurant_id` vem sempre da sessão.

## Decisões desta fase

1. **Adicionais pertencem ao produto**, não são compartilhados entre produtos.
   É o que o protótipo faz e evita grupos "globais" com regras conflitantes.
2. **Destaque é um campo do produto**, não uma categoria. "Os mais pedidos" é
   renderizado a partir de `is_featured`, sem duplicar produtos no banco.
3. **Nome de categoria é único por restaurante** (checagem sem diferenciar
   maiúsculas no app + índice único no banco). A mensagem de erro é amigável.
4. **Produto indisponível continua visível** no cardápio público, marcado como
   "Indisponível". Esconder o produto faz o cliente achar que o cardápio está
   errado; a disponibilidade real será validada de novo no checkout (Fase 3).
5. **Exclusão em cascata**: apagar produto remove grupos e opções; apagar
   categoria só é permitido quando está vazia.
6. **Imagens ficam para depois**: `products.image_url` existe no schema, mas o
   painel ainda não faz upload nem o site renderiza imagem. Não há fotos reais
   no protótipo; implementar storage sem conteúdo seria funcionalidade falsa.
7. **`tags` existe para os filtros do protótipo** (`serve1`, `dividir`, ...),
   mas ainda não é editável nem usado na interface. Os filtros entram junto com
   o refinamento de UI, depois do fluxo de pedido.

## Arquivos principais

```
apps/web/drizzle/0001_married_blink.sql          migração do cardápio
apps/web/src/server/menu/schema.ts               Zod de categorias/produtos/adicionais
apps/web/src/server/menu/mutations.ts            casos de uso com escopo de restaurante
apps/web/src/server/menu/queries.ts              painel (tudo) e público (filtrado)
apps/web/src/app/painel/cardapio/                página, ações e formulários do painel
apps/web/src/app/painel/cardapio/produtos/       novo produto e edição
apps/web/src/components/public-menu-view.tsx     cardápio público compartilhado
apps/web/src/app/page.tsx                        home por RESTAURANT_SLUG
apps/web/src/app/cardapio/[slug]/page.tsx        cardápio por slug
apps/web/scripts/seed-menu.ts                    importa scripts/data/menu.json
apps/web/scripts/data/menu.json                  dados exportados do protótipo
apps/web/tests/unit/menu-schema.test.ts          validação dos schemas
apps/web/tests/unit/menu-seed-data.test.ts       integridade dos dados importados
apps/web/tests/integration/menu.test.ts          CRUD, isolamento e consultas
apps/web/e2e/fase-2.spec.ts                      fluxo real de ponta a ponta
```

## Verificação executada

Tudo em `apps/web`, Node 24.19.0, npm 11.17.0, Windows.

| Comando | Resultado |
| --- | --- |
| `npm run lint` | sem erros e sem avisos (nenhuma regra desligada) |
| `npm run typecheck` | sem erros |
| `npm test` | 8 arquivos, 66 testes, todos passando |
| `npm run build` | build de produção concluído; rotas `/`, `/cardapio/[slug]`, `/painel/cardapio`, `/painel/cardapio/produtos/novo` e `/painel/cardapio/produtos/[id]` presentes |
| `npm run db:migrate` (Supabase real) | migração 0001 aplicada |
| `npm run db:seed` (Supabase real) | 16 categorias, 108 produtos, 36 grupos, 175 opções |
| `npm run test:e2e` | **3/3 passando**: guarda de rota, configurações (Fase 1) e fluxo completo do cardápio (Fase 2) |

Testes de integração rodam em PGlite com as migrações reais e cobrem:

- criação/atualização de categoria e bloqueio de nome repetido sem diferenciar
  maiúsculas;
- bloqueio de exclusão de categoria com produtos e exclusão em cascata de
  produto → grupos → opções;
- atualização de preço e disponibilidade;
- isolamento entre restaurantes (um não cria/edita/apaga dados do outro);
- consulta pública filtrando categoria inativa/vazia e opção indisponível;
- constraints de preço negativo e de `máximo >= mínimo`;
- integridade do JSON importado (categorias, preços inteiros, ordens únicas,
  grupos coerentes, 6 destaques).

## E2E do cardápio (Supabase real)

O teste `e2e/fase-2.spec.ts` executa contra o build de produção:

1. login real no painel;
2. criação de categoria;
3. criação de produto com preço `12,34`;
4. criação de grupo de adicionais e opção de `R$ 2,00`;
5. conferência no cardápio público: categoria, produto, preço e adicional;
6. tentativa de excluir a categoria com produto (bloqueada com mensagem);
7. exclusão do produto e depois da categoria;
8. limpeza automática em caso de falha (novo contexto, login e remoção).

Depois da execução, o banco voltou ao estado do seed: 16 categorias, 108
produtos, 36 grupos, 175 opções e zero registros `E2E %`.

## Não verificado

- Upload/entrega de imagens de produto.
- Filtros por `tags` e busca no cardápio.
- Reordenação por arrastar/soltar (a ordem é um campo numérico).
- Concorrência de duas pessoas editando o mesmo produto ao mesmo tempo.
- RLS: o app acessa o banco pelo servidor; RLS não é barreira nesta fase.
- Deploy real (domínio, TLS, variáveis no provedor).

## Pendências e bloqueios

1. ~~Definir se "Adicionais" continua como categoria de produtos ou vira grupo
   de adicionais.~~ Resolvida: a categoria foi convertida em grupos de
   adicionais (ver Fase 3).
2. Fotos dos produtos e decisão de storage (Supabase Storage) antes de exibir
   imagem no site.
3. Valores reais do restaurante (nome, endereço, telefone, taxa, horários,
   pedido mínimo) para substituir o seed de demonstração.
4. Desligar o cadastro público no Supabase Auth (pendência herdada da Fase 1).
5. Região de produção **sa-east-1** (a atual é us-west-2).

## Próxima tarefa

Fase 3 — pedido:

1. Carrinho no cliente e checkout (entrega/retirada, pagamento, troco).
2. Recálculo integral no servidor a partir do banco (preço, adicionais,
   disponibilidade, taxa, pedido mínimo).
3. Número sequencial legível por restaurante, nunca reaproveitado.
4. Snapshot de itens/adicionais e criação transacional de pedido + trabalho de
   impressão + tarefa de WhatsApp.
5. Proteção contra pedido duplicado e rate limit.
6. Painel de pedidos com status e detalhes.
