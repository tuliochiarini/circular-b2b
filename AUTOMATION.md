# Circular B2B — Automation Foundation

## Objetivo
Transformar a operação comercial em um funil estruturado:

`descoberta -> lead -> contato -> qualificação -> demanda ativa -> matching -> negociação`

## Endpoints privados

### POST /api/leads
Registra/enriquece um lead de prospecção. Requer header `x-circular-key`.

Campos aceitos: `empresa`, `responsavel`, `whatsapp`, `email`, `site`, `cidadeUF`, `segmento`, `tipo`, `materiais`, `logistica`, `restricoes`, `observacoes`, `fonte`, `statusLead`, `ultimaInteracao`, `proximaAcao`, `dataProximaAcao`.

### GET/POST /api/matches
Solicita matches ao backend. Requer header `x-circular-key`.

## Apps Script V8
A pasta `apps-script/` contém um addon reversível para a V7 atual. Ele cria um CRM de leads sem apagar as abas existentes.

Fluxo implementado:
- lead novo entra em `Leads`;
- deduplicação por WhatsApp, e-mail ou empresa;
- scoring comercial do lead;
- enriquecimento progressivo sem perder dados já coletados;
- quando `Qualificado` / `Demanda ativa`, conversão automática em `Empresas` + `Materiais`;
- deduplicação de materiais;
- matching existente roda logo após a conversão;
- endpoint interno de matches retorna score, prioridade e contatos das duas pontas.

## Variáveis Vercel
- `CIRCULAR_INTERNAL_API_KEY`: segredo forte usado somente por automações privadas.
- `CIRCULAR_APPS_SCRIPT_URL`: URL do Web App do Google Apps Script atualizado.

Nunca exponha `CIRCULAR_INTERNAL_API_KEY` no `index.html`.

## Estados recomendados
`novo | contatado | respondeu | qualificado | demanda_ativa | followup | sem_interesse | convertido`

## Critério operacional inicial
- 40 novos leads/dia;
- priorizar evidência real de compra/venda e WhatsApp comercial;
- abordagem personalizada por material;
- escala somente com qualidade saudável do canal;
- Túlio entra prioritariamente em matches quentes e negociação.

## Próximas fases
1. Instalar o addon V8 no Apps Script e redeployar.
2. Configurar os dois secrets na Vercel.
3. Testar lead de ponta a ponta.
4. Criar ingestão diária de leads e fila de abordagem.
5. Criar alerta/resumo de matches quentes.
6. Só então integrar a WhatsApp Business Platform oficial para automação de mensagens e follow-up.
