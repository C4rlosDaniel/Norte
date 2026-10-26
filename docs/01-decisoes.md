# Decisões

Decisões fechadas com o cliente. Mudar uma delas exige registrar aqui o motivo.

## D1 — Repositório novo, independente do Lovable

O protótipo ficou em `norte-grill-experience` (Lovable) e serve apenas como
referência visual e de dados. O produto vive em `C4rlosDaniel/Norte`. Nunca
reescrever histórico já publicado.

## D2 — Stack

Next.js 16 (App Router), TypeScript estrito, Tailwind 4, PostgreSQL (Supabase),
Drizzle ORM, Zod e Vitest. Playwright apenas para fluxos críticos, quando
existirem. Sem ORM "mágico": SQL versionado por migração.

## D3 — Dinheiro

Valores persistidos e calculados em centavos inteiros. O servidor recalcula
tudo; o cliente nunca define preço, taxa ou total.

## D4 — Pedido

Um pedido gera, na mesma transação: registro do pedido com snapshot de itens e
preços, trabalho de impressão e tarefa de WhatsApp. Número sequencial por
restaurante, formatado como `#0123`, nunca reutilizado.

## D5 — WhatsApp

Somente Cloud API oficial da Meta. Provider simulado em desenvolvimento.
Webhook com verificação de assinatura, deduplicação por id de mensagem,
respeito à janela de 24h e uso de templates aprovados fora dela.

Fora da janela de 24h, a confirmação usa template utilitário com resumo curto e
link da página do pedido (decisão aprovada).

## D6 — Fluxo do cliente

O cliente abre o cardápio por um link no celular. O link/`link_code` é a origem
do pedido; o WhatsApp serve para confirmação e avisos, não como interface
principal de montagem do pedido.

## D7 — Impressão

O servidor nunca acessa o computador do restaurante. Um agente local no Windows
puxa trabalhos por endpoint autenticado, reserva com lease e imprime. A API key
é armazenada apenas como hash.

## D8 — Autorização do painel

Supabase Auth identifica o usuário. O acesso ao painel exige vínculo em
`restaurant_users`. Nenhuma decisão de autorização depende de UI. Não existe
cadastro público; o acesso é criado por script administrativo.

## D9 — Multi-tenant

Fora de escopo. O modelo já tem `restaurant_id` para não travar uma futura
expansão, mas o produto é de um restaurante só.

## D10 — Pagamento online

Fora de escopo. Pagamento é na entrega/retirada, com registro da forma
escolhida e troco quando em dinheiro.

## D11 — Antiabuso

Rate limit em banco no checkout (10 pedidos por IP a cada 10 minutos e 10 por
telefone a cada hora, com hash do telefone), validação Zod em toda entrada e
limites de quantidade/observação. Turnstile/CAPTCHA não foi implementado na
Fase 3: o fluxo é link-first, já tem limite no servidor e o CAPTCHA adicionaria
atrito e dependência externa. Reavaliar na Fase 6 com evidência de abuso.

## D12 — Hospedagem

Adiada. A aplicação é agnóstica: precisa de Node com suporte a streaming e de
um Postgres gerenciado (Supabase).

## D13 — Modelo do cardápio

Categoria → produto → grupo de adicionais → opção. Grupos e opções pertencem ao
produto (não são compartilhados entre produtos). "Mais pedidos" é
`products.is_featured`, não uma categoria com produtos duplicados. Produto
indisponível continua visível e marcado no site; a disponibilidade é validada
de novo no checkout.

## D14 — Imagens de produto

A coluna `products.image_url` existe, mas upload e exibição ficam adiados até
haver fotos reais e uma decisão de storage. Não implementar uma tela de upload
sem conteúdo nem renderizar imagem quebrada.

## D15 — Link público do pedido

O cliente acompanha o pedido em `/pedido/[code]` sem login. O código é aleatório
(8 bytes, 16 hex, 64 bits) e não expõe o id interno. O número do pedido é global
por restaurante, formatado como `#0123`, e nunca é reaproveitado.

## D16 — Máquina de estados do pedido

Fluxo de entrega: `pending → confirmed → preparing → ready →
out_for_delivery → delivered`. Retirada vai de `ready` direto para `delivered`.
`canceled` é terminal e permitido enquanto o pedido está ativo. Toda mudança
grava `order_events`; cancelar também encerra impressão pendente e marca a
tarefa de WhatsApp não enviada como `skipped`.
