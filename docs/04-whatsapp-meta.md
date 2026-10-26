# WhatsApp (Cloud API oficial)

A fila `whatsapp_tasks` já nasce junto do pedido (Fase 3), mas **nada é
enviado** ainda. Este documento fecha a estratégia e os riscos da Fase 5.

## Por que Cloud API e não automação de WhatsApp Web

Automação de WhatsApp Web viola os termos, não tem garantia, cai com
frequência e não tem suporte. A Cloud API é a via oficial, com webhook,
templates e status de entrega.

## Bloqueio de produto: número do restaurante

O número que já está no aplicativo WhatsApp Business **não pode ser
auto-onboardado** na Cloud API por conta própria. É preciso:

- ser Solution Partner / Tech Provider, ou
- contratar um BSP (provedor oficial) para onboardar o número, ou
- usar um número novo, dedicado, e migrar o atendimento.

O caminho de "coexistência" (mesmo número no app e na API) depende de
onboarding por parceiro. Isso precisa ser resolvido antes da Fase 5 — é o maior
risco do projeto. Nada no código depende do app; o sistema fala com a API.

## Janela de 24 horas

A Meta permite mensagens de serviço livres por 24h após a última mensagem do
cliente. Depois disso, só templates aprovados.

- Resposta imediata à confirmação do pedido: dentro da janela (mensagem do
  cliente abriu a janela).
- "Saiu para entrega" muito depois: pode cair fora da janela → template
  utilitário `pedido_saiu_para_entrega`.
- Confirmação fora da janela (decisão aprovada): template utilitário com resumo
  curto e link da página do pedido.

## Templates previstos

| Nome | Categoria | Uso |
| --- | --- | --- |
| `pedido_confirmado` | utility | pedido número, resumo, total e link |
| `pedido_saiu_para_entrega` | utility | pedido número + link |
| `pedido_cancelado` | utility | motivo e link |

Variáveis posicionais curtas, em pt_BR. A aprovação é feita no Meta Business
Manager; o nome exato fica em variável de ambiente.

## Webhook

- `GET /api/whatsapp/webhook` para verificação (`hub.challenge` + verify
  token).
- `POST` valida `X-Hub-Signature-256` com o app secret (HMAC-SHA256 do corpo
  bruto) antes de qualquer processamento.
- Deduplicação por `message.id` em tabela com constraint única; reentrega da
  Meta não duplica pedido nem resposta.
- Processamento idempotente; resposta 200 rápida e trabalho pesado fora do
  request quando possível.
- Nenhum token ou telefone em log.

## Provider simulado

Em desenvolvimento, `WHATSAPP_PROVIDER=simulated` grava as mensagens em banco e
mostra na tela de diagnóstico. Nenhuma chamada externa. Testes de integração
usam o simulado; o provider real é testado em ambiente controlado com número de
teste da Meta.

## Custos

Desde 1º de outubro de 2026, mensagens de serviço são cobradas após 1.000
mensagens gratuitas por mês por número; templates utilitários também são
cobrados. Confirmar a tabela vigente antes do go-live e monitorar volume.

## Pendências

- Definir número (novo ou coexistência) e caminho de onboarding.
- Criar app no Meta Business, verificar negócio, obter phone number id, WABA id,
  token permanente e app secret.
- Aprovar templates.
- Definir domínio público com TLS (webhook exige HTTPS).
