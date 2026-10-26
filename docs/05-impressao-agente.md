# Agente de impressão (Windows)

Fase 4. A fila `print_jobs` já é criada na transação do pedido com o payload
fechado (Fase 3); o agente e as rotas de poll/resultado ainda não existem.

## Princípios

1. O servidor nunca abre conexão com o computador do restaurante.
2. O agente não acessa o banco. Só fala com a API do app.
3. A credencial é por instalação e pode ser revogada sem afetar as demais.
4. Impressão é idempotente: reimprimir não duplica pedido.
5. Sem impressora, o pedido não se perde: fica pendente e o painel avisa.

## Fluxo

```
[Pedido criado] --transação--> [print_jobs: pending]
                                      |
                        GET /api/print/jobs (poll autenticado)
                                      |
                                [agente local]
                          lease atômico por job (expira)
                                      |
                         ESC/POS -> impressora térmica
                                      |
                    POST /api/print/jobs/:id/result
```

- Poll a cada 2–3 segundos, com backoff em erro de rede.
- `POST /api/print/jobs/claim` devolve até N jobs e marca `leased_by` +
  `lease_expires_at` em uma transação (`FOR UPDATE SKIP LOCKED`).
- Se o agente morrer, o lease expira e o job volta a ficar disponível.
- Falha de impressão registra tentativa e motivo; após N tentativas vira
  `failed` e o painel mostra alerta com botão de reimpressão.

## Autenticação

- API key gerada por script (`npm run keys:create`), exibida uma única vez.
- Banco guarda apenas `sha256(key)` + prefixo para identificação.
- Header `Authorization: Bearer <key>`; comparação em tempo constante.
- Rate limit por chave; rotação e revogação sem downtime.

## Driver

```ts
interface PrinterDriver {
  print(job: RenderableTicket): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}
```

- `EscPosPrinterDriver`: USB (via porta serial/USB) ou rede (porta 9100).
- `SimulatedPrinterDriver`: salva o texto em arquivo para desenvolvimento.
- Largura de papel (58/80 mm) e modelo configuráveis; layout em texto puro com
  corte, negrito e alinhamento.

## Empacotamento

- Node + TypeScript compilado; executável único com `pkg`/`node --experimental-sea`
  ou instalador Inno Setup (decidir na fase).
- Roda como serviço do Windows (NSSM ou serviço nativo), reinicia sozinho.
- Configuração em `%ProgramData%\Norte\agent.json` (chave com ACL restrita).
- Log local rotativo, sem dados pessoais além do necessário ao cupom.
- Atualização: o agente consulta versão mínima e avisa; nunca se auto-atualiza
  sem assinatura.

## Pendências

- Modelo da impressora, conexão (USB/rede) e largura do papel.
- Sistema do computador da cozinha (Windows 10/11).
- Se a impressão precisa sobreviver a queda de internet (fila local em disco).
