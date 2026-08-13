# Instalação da automação V8 no Google Apps Script

A automação foi separada em `automation-addon.gs` para evitar substituir o código V7 atual de uma vez.

## 1. Adicione um novo arquivo no Apps Script
Crie `automation-addon.gs` no mesmo projeto do código atual e cole o conteúdo deste repositório.

## 2. Faça um ajuste pequeno no `doPost(e)` atual
Logo depois de criar `data` e `ss`, rote as ações privadas antes de `validateSubmission_(data)`:

```javascript
const automation = handleAutomationAction_(ss, data);
if (automation) return json_(automation);
```

O início do `doPost` deve ficar conceitualmente assim:

```javascript
function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const ss = getSS_();
    ensureStructure_(ss);

    const automation = handleAutomationAction_(ss, data);
    if (automation) return json_(automation);

    validateSubmission_(data);
    // restante do fluxo V7 permanece igual
```

## 3. Execute `instalarAutomacaoV8()` uma vez
A função cria somente a aba nova `Leads` e configura validações e parâmetros. Ela não limpa Empresas, Materiais, Matches ou Negociações.

## 4. Implante uma nova versão do Web App
Mantenha o mesmo acesso usado atualmente e copie a nova URL `/exec` caso o Google gere outra URL.

## 5. Vercel
Configure:
- `CIRCULAR_APPS_SCRIPT_URL`: URL `/exec` da implantação atualizada.
- `CIRCULAR_INTERNAL_API_KEY`: segredo forte e exclusivo da automação.

## Comportamento
- `action: lead`: cria/enriquece lead sem duplicar por telefone, e-mail ou empresa.
- Leads `Qualificado`, `Demanda ativa` ou `Convertido` podem virar automaticamente Empresa + Materiais.
- Materiais da prospecção são deduplicados antes de criar nova linha.
- Ao converter demanda, o matching existente roda automaticamente.
- `action: matches`: devolve matches ordenados por score, com contatos das duas empresas, para uso interno.

## Segurança operacional
Não colocar `CIRCULAR_INTERNAL_API_KEY` no `index.html`. Ela deve existir apenas nas variáveis de ambiente da Vercel e em processos privados.

## Reversão
Se houver qualquer problema, basta remover o roteamento `handleAutomationAction_` do `doPost`; o formulário V7 volta a operar pelo fluxo anterior. A aba Leads pode permanecer sem interferir no site.
