# Segurança e LGPD

## Autorização

- `requireMember()` é chamado em toda página e Server Action do painel.
- A sessão é validada com `supabase.auth.getUser()` (não confia no cookie).
- O vínculo em `restaurant_users` define o restaurante; `restaurant_id` nunca
  vem do formulário.
- Rotas do painel também têm desvio otimista no `proxy.ts`, mas a decisão real é
  sempre no servidor.
- Não existe cadastro público. Acesso é criado por `npm run create:admin` com a
  service role key, executado localmente.

## Validação

- Toda entrada externa (formulário, query, webhook) passa por Zod antes de
  chegar ao banco.
- Dinheiro é convertido para centavos no servidor; a taxa tem limite máximo.
- Nenhuma string é interpolada em SQL (Drizzle parametriza).

## Segredos

- `.env.local` não versionado; `.env.example` só com nomes e valores falsos.
- Service role key só é lida por scripts locais, nunca pelo app.
- Nenhuma chave `NEXT_PUBLIC_*` sensível. A `SUPABASE_ANON_KEY` é pública por
  natureza, mas não é embutida manualmente no frontend.
- Logs passam por `sanitize()`, que remove chaves com telefone, e-mail,
  endereço, nome, token, senha e chave.
- Em caso de vazamento de credencial: revogar no provedor imediatamente e
  rotacionar. Nenhum segredo deve ser colado em issue, chat ou commit.

## Dados pessoais (LGPD)

Coletar o mínimo: nome, telefone, endereço de entrega e observação do pedido.
Sem CPF, sem e-mail do cliente, sem geolocalização, sem perfil comportamental.

- Finalidade: executar o pedido e falar com o cliente sobre ele.
- Base legal: execução de contrato.
- Acesso: apenas a equipe do restaurante (painel autenticado).
- Retenção: definir prazo com o cliente (pendente) e implementar rotina de
  expurgo antes do go-live.
- Direitos do titular: canal de contato no cardápio e procedimento para
  exclusão/anonimização.
- Imagens de cardápio não devem conter pessoas identificáveis.

Pendências para a Fase 6: política de privacidade, prazo de retenção, rotina de
expurgo, registro das operações de tratamento.

## Superfície de ataque atual

| Risco | Mitigação | Estado |
| --- | --- | --- |
| Força bruta no login | rate limit próprio + limites do Supabase | Supabase tem limite; rate limit próprio na Fase 6 |
| Sessão roubada | cookies HTTP-only via `@supabase/ssr`; TLS em produção | ok |
| Usuário autenticado sem vínculo | `requireMember` bloqueia | ok |
| SQL injection | Drizzle parametrizado + Zod | ok |
| XSS | React escapa por padrão; sem `dangerouslySetInnerHTML` | ok |
| CSRF em Server Actions | origem verificada pelo Next | ok |
| Enumeração de dados | mensagens de login genéricas | ok |
| Logs com PII | sanitização por chave | ok |

## Checklist antes do go-live

- [ ] CSP com nonce (hoje só `nosniff` e `Referrer-Policy`)
- [ ] Rate limit no login e no checkout
- [ ] Turnstile no checkout
- [ ] Backups automáticos + restauração testada
- [ ] Retenção e expurgo de dados pessoais
- [ ] Revisão de permissões do projeto Supabase (RLS desligado é aceitável
      apenas porque o banco não é exposto ao browser; confirmar)
- [ ] Rotação de todas as chaves usadas em desenvolvimento
