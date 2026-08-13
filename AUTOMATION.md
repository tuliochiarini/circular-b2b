# Circular B2B — Automation Foundation

## Objetivo
Transformar a operação comercial em um funil estruturado:

`descoberta -> lead -> contato -> qualificação -> demanda ativa -> matching -> negociação`

## Endpoints privados

### POST /api/leads
Registra/enriquece um lead de prospecção. Requer header `x-circular-key`.

Campos principais: `empresa`, `responsavel`, `whatsapp`, `email`, `site`, `cidadeUF`, `materiais`, `observacoes`, `fonte`, `statusLead`, `proximaAcao`.

### GET/POST /api/matches
Solicita matches ao backend. Requer header `x-circular-key`.

## Variáveis Vercel
- `CIRCULAR_INTERNAL_API_KEY`: segredo forte usado somente por automações privadas.
- `CIRCULAR_APPS_SCRIPT_URL`: URL do Web App do Google Apps Script. Se ausente, o helper usa o endpoint legado atual.

Nunca exponha `CIRCULAR_INTERNAL_API_KEY` no `index.html`.

## Contrato esperado do Apps Script
O Apps Script atual precisa ser evoluído para reconhecer:
- `{ action: "lead", ... }`: gravar/upsert de lead em uma aba `Leads`.
- `{ action: "matches", ... }`: devolver matches calculados entre ofertas e demandas.

## Estrutura recomendada da aba Leads
`id | criadoEm | atualizadoEm | empresa | responsavel | whatsapp | email | site | cidadeUF | origem | fonte | statusLead | materiaisJson | observacoes | proximaAcao`

Status sugeridos:
`novo | contatado | respondeu | qualificado | demanda_ativa | sem_interesse | followup | convertido`

## Próxima fase
1. Adaptar o Apps Script/Google Sheet ao contrato acima.
2. Configurar os dois secrets na Vercel.
3. Testar lead de ponta a ponta.
4. Implementar score de matching (material, formato, volume, região/logística e frequência).
5. Só depois conectar a API oficial do WhatsApp para abordagem e follow-up.
