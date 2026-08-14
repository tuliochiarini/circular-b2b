# Envio estratégico com Resend

Esta integração cria um endpoint privado para campanhas personalizadas da Circular B2B. Ela não expõe a chave do Resend no navegador e não permite alterar o remetente pela requisição.

## Antes de publicar

1. Validar `circularb2b.eco.br` no Resend (SPF e DKIM).
2. Criar uma API key no Resend com permissão apenas de envio.
3. Adicionar na Vercel, somente no servidor, `RESEND_API_KEY`.
4. Reutilizar `CIRCULAR_INTERNAL_API_KEY`, já adotada pelos endpoints privados da Circular.
5. Opcionalmente configurar `RESEND_FROM` e `RESEND_REPLY_TO`.
6. Fazer primeiro um `dryRun` e depois um envio real para uma conta interna.

## Proteções incluídas

- autenticação pela chave interna já usada pela API da Circular (`x-circular-key`);
- remetente definido no servidor;
- limite de 30 mensagens por requisição;
- uma mensagem individual por destinatário;
- prevenção de repetição por chave de idempotência;
- identificação da campanha e do lead no Resend;
- instrução simples de descadastro no rodapé;
- nenhuma chave secreta no repositório.

## Formato da requisição

```json
{
  "campaignId": "reativacao_agosto_01",
  "dryRun": true,
  "messages": [
    {
      "externalId": "lead-123",
      "to": "compras@empresa.com.br",
      "subject": "Possível conexão para reaproveitamento de materiais",
      "text": "Olá, equipe..."
    }
  ]
}
```

O histórico da planilha deve ser atualizado somente após a API devolver `status: sent` e o identificador `resendId`.
