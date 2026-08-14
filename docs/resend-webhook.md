# Webhook do Resend

Endpoint de produção:

`POST https://www.circularb2b.eco.br/api/resend/webhook`

## Segurança

- A assinatura Svix é validada sobre o corpo bruto.
- Requisições com mais de cinco minutos são rejeitadas.
- O segredo fica apenas na variável `RESEND_WEBHOOK_SECRET` da Vercel.
- O conteúdo do e-mail não é registrado nos logs.

## Eventos acompanhados

- envio e entrega;
- atraso e falha;
- rejeição, denúncia e supressão;
- abertura e clique.

Cada evento registra o identificador Svix, o ID do e-mail, o horário, o destinatário e as tags operacionais.
