const AUTOMATION_VERSION = 'v8-automation';
const LEADS_SHEET = 'Leads';
const INTERACTIONS_SHEET = 'Interacoes';
const EMAIL_EVENTS_SHEET = 'Eventos Email';

function instalarAutomacaoV8() {
  const ss = getSS_();
  prepararAbaSegura_(ss, LEADS_SHEET, [
    'Lead ID','Criado em','Atualizado em','Empresa','Responsável','WhatsApp','E-mail','Site',
    'Cidade/UF','Segmento','Origem','Fonte','Status lead','Score lead','Tipo principal',
    'Materiais JSON','Logística','Restrições','Observações','Última interação',
    'Próxima ação','Data próxima ação','Company ID','Convertido em'
  ]);

  aplicarLista_(ss.getSheetByName(LEADS_SHEET),'Status lead',[
    'Novo','Contatado','Respondeu','Qualificado','Demanda ativa','Follow-up','Sem interesse','Convertido'
  ]);

  aplicarLista_(ss.getSheetByName(LEADS_SHEET),'Tipo principal',[
    'compra','venda','cessao','destinacao'
  ]);

  prepararAbaSegura_(ss, INTERACTIONS_SHEET, [
    'Interaction ID','Company ID','Contact ID','Data','Canal','Direção','Resumo','Resultado',
    'Próxima ação','Data próxima ação','Responsável Circular','Fonte','Observações',
    'Evidence ID','Evento confirmado'
  ]);

  prepararAbaSegura_(ss, EMAIL_EVENTS_SHEET, [
    'Event ID','Email ID','Data','Tipo de evento','Destinatário','Assunto',
    'Campanha','Lead ID','Status','Registrado em'
  ]);

  seedAutomationConfig_(ss);
  formatarAbas_(ss);
  refreshDashboard_(ss);
}

function prepararAbaSegura_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const current = getHeaders_(sheet);
  if (!current.length) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  headers.forEach(header => {
    if (!current.includes(header)) {
      const col = sheet.getLastColumn() + 1;
      sheet.getRange(1,col).setValue(header);
      current.push(header);
    }
  });
  return sheet;
}

function seedAutomationConfig_(ss) {
  const sheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!sheet) return;
  const rows = sheetObjects_(sheet);
  const existing = {};
  rows.forEach(r => existing[String(r['Chave'])] = r['Valor']);

  [
    ['AUTOMATION_VERSION',AUTOMATION_VERSION,'Versão da automação comercial'],
    ['LEAD_AUTO_CONVERT','true','Converter lead qualificado em empresa/material automaticamente'],
    ['HOT_MATCH_SCORE','70','Score mínimo para considerar match quente']
  ].forEach(x => {
    if (!(x[0] in existing)) appendObjectRow_(sheet, {'Chave':x[0],'Valor':x[1],'Descrição':x[2]});
  });
}

function handleAutomationAction_(ss, data) {
  const action = normalizeText_(data.action || '');

  if (action === 'lead') {
    if (!ss.getSheetByName(LEADS_SHEET)) instalarAutomacaoV8();
    return handleLeadAction_(ss, data);
  }

  if (action === 'matches') {
    if (String(data.runGlobal || 'false').toLowerCase() === 'true') rodarMatchingGlobal();
    return {
      success:true,
      version:AUTOMATION_VERSION,
      matches:getMatchesPayload_(ss, Number(data.limit || 100))
    };
  }

  if (action === 'email event' || action === 'email_event') {
    if (!ss.getSheetByName(EMAIL_EVENTS_SHEET)) instalarAutomacaoV8();
    return handleEmailEvent_(ss, data);
  }

  return null;
}

function handleEmailEvent_(ss, data) {
  const eventId = String(data.eventId || data.svixId || '').trim();
  const emailId = String(data.emailId || '').trim();
  const eventType = String(data.eventType || data.type || '').trim().toLowerCase();
  if (!eventId) throw new Error('EMAIL_EVENT_INVALID: Event ID não informado.');
  if (!emailId) throw new Error('EMAIL_EVENT_INVALID: Email ID não informado.');
  if (!eventType.startsWith('email.')) throw new Error('EMAIL_EVENT_INVALID: tipo de evento inválido.');

  const sheet = prepararAbaSegura_(ss, EMAIL_EVENTS_SHEET, [
    'Event ID','Email ID','Data','Tipo de evento','Destinatário','Assunto',
    'Campanha','Lead ID','Status','Registrado em'
  ]);
  const rows = sheetObjects_(sheet);
  if (rows.some(r => String(r['Event ID'] || '').trim() === eventId)) {
    return {success:true,version:AUTOMATION_VERSION,duplicate:true,event_id:eventId};
  }

  const tags = data.tags && typeof data.tags === 'object' ? data.tags : {};
  const leadId = String(data.leadId || tags.lead || '').trim();
  const recipients = Array.isArray(data.recipients) ? data.recipients : [];
  const status = emailEventStatus_(eventType);

  appendObjectRow_(sheet, {
    'Event ID':eventId,
    'Email ID':emailId,
    'Data':data.createdAt || new Date(),
    'Tipo de evento':eventType,
    'Destinatário':recipients.join(', '),
    'Assunto':data.subject || '',
    'Campanha':data.campaignId || tags.campaign || '',
    'Lead ID':leadId,
    'Status':status,
    'Registrado em':new Date()
  });

  let leadUpdated = false;
  if (leadId) {
    const leadsSheet = ss.getSheetByName(LEADS_SHEET);
    const lead = leadsSheet && sheetObjects_(leadsSheet)
      .find(r => String(r['Lead ID'] || '').trim() === leadId);
    if (lead) {
      const next = emailEventNextAction_(eventType);
      const newStatus = emailEventLeadStatus_(eventType, lead['Status lead']);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (eventType === 'email.delivered' ? 3 : 1));

      updateObjectRow_(leadsSheet, 'Lead ID', leadId, {
        'Status lead':newStatus,
        'Última interação':data.createdAt || new Date(),
        'Próxima ação':next,
        'Data próxima ação':next ? dueDate : (lead['Data próxima ação'] || ''),
        'Atualizado em':new Date()
      });

      recordConfirmedLeadEvent_(ss, leadId, lead, {
        companyId:lead['Company ID'] || '',
        dataEvento:data.createdAt || new Date(),
        canal:'E-mail',
        direcao:'saída',
        resumoEvento:'Evento Resend: ' + eventType + (data.subject ? ' — ' + data.subject : ''),
        resultado:status,
        proximaAcao:next,
        dataProximaAcao:next ? dueDate : '',
        fonte:'Webhook Resend',
        observacoes:'Email ID: ' + emailId
      }, {confirmed:true,evidenceId:eventId,status:newStatus});
      leadUpdated = true;
    }
  }

  refreshDashboard_(ss);
  return {
    success:true,version:AUTOMATION_VERSION,duplicate:false,
    event_id:eventId,email_id:emailId,status:status,lead_updated:leadUpdated
  };
}

function emailEventStatus_(eventType) {
  const map = {
    'email.sent':'Enviado',
    'email.delivered':'Entregue',
    'email.delivery_delayed':'Entrega atrasada',
    'email.failed':'Falha',
    'email.bounced':'Rejeitado',
    'email.complained':'Denúncia de spam',
    'email.suppressed':'Suprimido',
    'email.opened':'Aberto',
    'email.clicked':'Clicado'
  };
  return map[eventType] || eventType;
}

function emailEventNextAction_(eventType) {
  if (eventType === 'email.delivered') return 'Realizar follow-up se não houver resposta';
  if (eventType === 'email.opened' || eventType === 'email.clicked') return 'Priorizar follow-up comercial';
  if (['email.failed','email.bounced','email.suppressed','email.delivery_delayed'].includes(eventType)) {
    return 'Validar e-mail e localizar contato alternativo';
  }
  if (eventType === 'email.complained') return 'Bloquear novos envios para este contato';
  return '';
}

function emailEventLeadStatus_(eventType, currentStatus) {
  const current = humanLeadStatus_(currentStatus || 'Novo');
  if (eventType === 'email.complained') return 'Sem interesse';
  if (['email.failed','email.bounced','email.suppressed'].includes(eventType)) return 'Follow-up';
  if (eventType === 'email.delivered' && current === 'Novo') return 'Contatado';
  return current;
}

function handleLeadAction_(ss, data) {
  if (!data.empresa) throw new Error('Empresa não informada para o lead.');

  const event = validateLeadEvent_(data);
  const leadId = upsertLead_(ss, data);
  const lead = sheetObjects_(ss.getSheetByName(LEADS_SHEET))
    .find(r => String(r['Lead ID']) === String(leadId));

  let conversion = null;
  const autoConvert = String(getConfig_(ss,'LEAD_AUTO_CONVERT','true')).toLowerCase() === 'true';
  const status = normalizeText_(data.statusLead || data.status || '').replace(/_/g,' ');
  const eligible = ['qualificado','demanda ativa','convertido'].includes(status);

  if (autoConvert && eligible) conversion = convertLeadToDemand_(ss, lead || data);
  if (event.confirmed) recordConfirmedLeadEvent_(ss, leadId, lead || data, data, event);
  refreshDashboard_(ss);

  return {
    success:true,version:AUTOMATION_VERSION,lead_id:leadId,
    status:data.statusLead || data.status || 'Novo',
    evidence_id:event.evidenceId || '',event_confirmed:event.confirmed,conversion
  };
}

function upsertLead_(ss, data) {
  const sheet = ss.getSheetByName(LEADS_SHEET);
  const rows = sheetObjects_(sheet);
  const phone = normalizePhone_(data.whatsapp || '');
  const email = normalizeText_(data.email || '');
  const companyName = normalizeText_(data.empresa || '');

  const matches = rows.filter(r =>
    (phone && normalizePhone_(r['WhatsApp']) === phone) ||
    (email && normalizeText_(r['E-mail']) === email) ||
    (companyName && normalizeText_(r['Empresa']) === companyName)
  );
  const matchedIds = [...new Set(matches.map(r => String(r['Lead ID'] || '')).filter(Boolean))];
  if (matchedIds.length > 1) {
    throw new Error('DUPLICATE_CONFLICT: os identificadores informados apontam para cadastros diferentes (' + matchedIds.join(', ') + ').');
  }
  const existing = matches[0] || null;
  if (data.leadId && existing && String(data.leadId) !== String(existing['Lead ID'])) {
    throw new Error('DUPLICATE_CONFLICT: o cadastro informado conflita com o lead ' + existing['Lead ID'] + '.');
  }

  const now = new Date();
  const materials = Array.isArray(data.materiais) ? data.materiais : [];
  const confirmedEvent = isConfirmedEvent_(data);
  const updates = {
    'Empresa':data.empresa || '',
    'Responsável':data.responsavel || '',
    'WhatsApp':data.whatsapp || '',
    'E-mail':data.email || '',
    'Site':data.site || '',
    'Cidade/UF':data.cidadeUF || '',
    'Segmento':data.segmento || '',
    'Origem':data.origem || 'prospeccao',
    'Fonte':data.fonte || '',
    'Status lead':humanLeadStatus_(data.statusLead || data.status || 'novo'),
    'Score lead':calculateLeadScore_(data),
    'Tipo principal':normalizeType_(data.tipo || data.tipoPrincipal || inferLeadType_(materials) || ''),
    'Materiais JSON':JSON.stringify(materials),
    'Logística':data.logistica || '',
    'Restrições':data.restricoes || '',
    'Observações':data.observacoes || '',
    'Última interação':confirmedEvent ? (data.ultimaInteracao || now) : '',
    'Próxima ação':data.proximaAcao || '',
    'Data próxima ação':data.dataProximaAcao || '',
    'Atualizado em':now
  };

  if (existing) {
    Object.keys(updates).forEach(k => {
      if (updates[k] === '' || updates[k] === '[]') updates[k] = existing[k] || updates[k];
    });
    updateObjectRow_(sheet,'Lead ID',existing['Lead ID'],updates);
    return existing['Lead ID'];
  }

  const id = createId_('LED');
  appendObjectRow_(sheet,Object.assign({
    'Lead ID':id,'Criado em':now,'Company ID':'','Convertido em':''
  },updates));
  return id;
}


function normalizeBoolean_(value) {
  return value === true || ['true','1','sim','yes'].includes(normalizeText_(value));
}

function isConfirmedEvent_(data) {
  return normalizeBoolean_(data && data.eventoConfirmado) && Boolean(String((data && data.evidenciaId) || '').trim());
}

function validateLeadEvent_(data) {
  const status = normalizeText_(data.statusLead || data.status || 'novo').replace(/_/g,' ');
  const operational = ['contatado','respondeu','qualificado','demanda ativa','followup','follow up','sem interesse','convertido'];
  const evidenceId = String(data.evidenciaId || '').trim();
  const confirmed = isConfirmedEvent_(data);

  if (operational.includes(status) && !confirmed) {
    throw new Error('EVIDENCE_REQUIRED: o status ' + status + ' exige evento confirmado e evidenciaId.');
  }
  if (normalizeBoolean_(data.eventoConfirmado) && !evidenceId) {
    throw new Error('EVIDENCE_REQUIRED: evento confirmado sem evidenciaId.');
  }
  return {confirmed:confirmed,evidenceId:evidenceId,status:status};
}

function recordConfirmedLeadEvent_(ss, leadId, lead, data, event) {
  const sheet = prepararAbaSegura_(ss, INTERACTIONS_SHEET, [
    'Interaction ID','Company ID','Contact ID','Data','Canal','Direção','Resumo','Resultado',
    'Próxima ação','Data próxima ação','Responsável Circular','Fonte','Observações',
    'Evidence ID','Evento confirmado'
  ]);
  const duplicateEvidence = sheetObjects_(sheet).some(r =>
    String(r['Evidence ID'] || '').trim() === event.evidenceId
  );
  if (duplicateEvidence) return;

  appendObjectRow_(sheet, {
    'Interaction ID':createId_('INT'),
    'Company ID':lead['Company ID'] || data.companyId || '',
    'Contact ID':data.contactId || '',
    'Data':data.dataEvento || new Date(),
    'Canal':data.canal || data.fonte || 'API',
    'Direção':data.direcao || 'entrada',
    'Resumo':data.resumoEvento || ('Atualização do lead ' + leadId),
    'Resultado':data.resultado || humanLeadStatus_(data.statusLead || data.status || 'novo'),
    'Próxima ação':data.proximaAcao || '',
    'Data próxima ação':data.dataProximaAcao || '',
    'Responsável Circular':data.responsavelCircular || '',
    'Fonte':data.fonte || 'API Circular B2B',
    'Observações':mergeNotes_(data.observacoes || '', 'Lead ID: ' + leadId),
    'Evidence ID':event.evidenceId,
    'Evento confirmado':'SIM'
  });
}

function calculateLeadScore_(data) {
  let score = 0;
  const materials = Array.isArray(data.materiais) ? data.materiais : [];
  const status = normalizeText_(data.statusLead || data.status || 'novo').replace(/_/g,' ');
  if (data.whatsapp) score += 20;
  if (data.email) score += 5;
  if (data.site) score += 5;
  if (data.cidadeUF) score += 10;
  if (data.responsavel) score += 10;
  if (materials.length) score += 25;
  if (materials.some(m => m && m.material && (m.quantidade || m.quantidadeMinima || m.formato || m.condicao))) score += 10;
  if (data.logistica) score += 5;
  if (['respondeu','qualificado','demanda ativa','convertido'].includes(status)) score += 10;
  return Math.min(100,score);
}

function humanLeadStatus_(value) {
  const v = normalizeText_(value).replace(/_/g,' ');
  const map = {
    'novo':'Novo','contatado':'Contatado','respondeu':'Respondeu','qualificado':'Qualificado',
    'demanda ativa':'Demanda ativa','followup':'Follow-up','follow up':'Follow-up',
    'sem interesse':'Sem interesse','convertido':'Convertido'
  };
  return map[v] || value || 'Novo';
}

function inferLeadType_(materials) {
  for (const item of (materials || [])) {
    const t = normalizeType_(item && item.tipo);
    if (TYPES.includes(t)) return t;
  }
  return '';
}

function convertLeadToDemand_(ss, lead) {
  const materials = parseLeadMaterials_(lead['Materiais JSON'] || lead.materiais);
  if (!materials.length) return {converted:false,reason:'Sem materiais estruturados'};

  const tipo = normalizeType_(lead['Tipo principal'] || lead.tipo || inferLeadType_(materials) || 'compra');
  if (!TYPES.includes(tipo)) return {converted:false,reason:'Tipo principal inválido'};

  const payload = {
    empresa:lead['Empresa'] || lead.empresa || '',
    responsavel:lead['Responsável'] || lead.responsavel || 'Contato comercial',
    whatsapp:lead['WhatsApp'] || lead.whatsapp || '',
    email:lead['E-mail'] || lead.email || '',
    cidadeUF:lead['Cidade/UF'] || lead.cidadeUF || '',
    segmento:lead['Segmento'] || lead.segmento || '',
    origem:lead['Origem'] || lead.origem || 'prospeccao',
    observacoesEmpresa:lead['Observações'] || lead.observacoes || '',
    logistica:lead['Logística'] || lead.logistica || '',
    restricoes:lead['Restrições'] || lead.restricoes || '',
    tipo:tipo
  };

  if (!payload.empresa || (!payload.whatsapp && !payload.email)) {
    return {converted:false,reason:'Empresa sem contato suficiente'};
  }

  const companyId = upsertCompany_(ss,payload);
  const materialIds = [];
  let matchesCreated = 0;

  materials.forEach(item => {
    const normalized = Object.assign({},item,{tipo:normalizeType_(item.tipo || tipo)});
    const materialId = upsertMaterialForLead_(ss,companyId,payload,normalized);
    if (materialId) {
      materialIds.push(materialId);
      matchesCreated += generateMatchesForMaterial_(ss,materialId);
    }
  });

  const leadId = lead['Lead ID'];
  if (leadId) {
    updateObjectRow_(ss.getSheetByName(LEADS_SHEET),'Lead ID',leadId,{
      'Status lead':'Convertido','Company ID':companyId,'Convertido em':new Date(),
      'Atualizado em':new Date(),
      'Próxima ação':matchesCreated ? 'Validar matches gerados' : 'Aguardar oportunidade compatível'
    });
  }

  return {converted:true,company_id:companyId,material_ids:materialIds,matches_created:matchesCreated};
}

function parseLeadMaterials_(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function upsertMaterialForLead_(ss, companyId, data, item) {
  if (!item || !item.material) return '';

  const sheet = ss.getSheetByName(SHEETS.MATERIALS);
  const rows = sheetObjects_(sheet);
  const tipo = normalizeType_(item.tipo || data.tipo || 'compra');
  const materialKey = normalizeMaterial_(item.material);
  const specKey = normalizeText_(item.especificacao || '');
  const condKey = normalizeText_(item.condicao || item.formato || '');

  const existing = rows.find(r =>
    String(r['Company ID']) === String(companyId) &&
    normalizeType_(r['Tipo']) === tipo &&
    normalizeMaterial_(r['Material']) === materialKey &&
    normalizeText_(r['Especificação'] || '') === specKey &&
    normalizeText_(r['Formato/Condição'] || '') === condKey &&
    normalizeText_(r['Status']) !== 'encerrado'
  );

  const materialData = {
    categoria:item.categoria || '',material:item.material || '',especificacao:item.especificacao || '',
    condicao:item.condicao || item.formato || '',quantidade:item.quantidade || item.quantidadeMinima || '',
    unidade:item.unidade || 'kg',frequencia:item.frequencia || '',precoReferencia:item.precoReferencia || item.preco || ''
  };

  if (existing) {
    updateObjectRow_(sheet,'Material ID',existing['Material ID'],{
      'Quantidade':materialData.quantidade || existing['Quantidade'] || '',
      'Unidade':materialData.unidade || existing['Unidade'] || '',
      'Frequência':materialData.frequencia || existing['Frequência'] || '',
      'Preço':materialData.precoReferencia || existing['Preço'] || '',
      'Cidade/UF':data.cidadeUF || existing['Cidade/UF'] || '',
      'Logística':data.logistica || existing['Logística'] || '',
      'Restrições':data.restricoes || existing['Restrições'] || '',
      'Status':'Ativo','Última confirmação':new Date(),
      'Observações':mergeNotes_(existing['Observações'],item.observacoes || data.observacoes || ''),
      'Atualizado em':new Date()
    });
    return existing['Material ID'];
  }

  return createMaterialRow_(ss,companyId,Object.assign({},data,{tipo:tipo}),materialData);
}

function getMatchesPayload_(ss, limit) {
  limit = Math.max(1,Math.min(Number(limit || 100),500));
  const matches = sheetObjects_(ss.getSheetByName(SHEETS.MATCHES));
  const companies = sheetObjects_(ss.getSheetByName(SHEETS.COMPANIES));
  const hotMin = Number(getConfig_(ss,'HOT_MATCH_SCORE','70')) || 70;
  const companyByName = {};
  companies.forEach(c => companyByName[normalizeText_(c['Empresa'])] = c);

  return matches
    .filter(m => normalizeText_(m['Status']) !== 'descartado')
    .sort((a,b) => Number(b['Score'] || 0) - Number(a['Score'] || 0))
    .slice(0,limit)
    .map(m => {
      const a = companyByName[normalizeText_(m['Empresa A'])] || {};
      const b = companyByName[normalizeText_(m['Empresa B'])] || {};
      const score = Number(m['Score'] || 0);
      return {
        matchId:m['Match ID'],status:m['Status'],score:score,hot:score >= hotMin,
        prioridade:m['Prioridade'],material:m['Material'],motivo:m['Motivo'],
        margemPotencial:m['Margem potencial'],proximaAcao:m['Próxima ação'],
        ladoA:{empresa:m['Empresa A'],tipo:m['Tipo A'],cidade:m['Cidade A'],whatsapp:a['WhatsApp'] || '',email:a['E-mail'] || '',responsavel:a['Responsável'] || ''},
        ladoB:{empresa:m['Empresa B'],tipo:m['Tipo B'],cidade:m['Cidade B'],whatsapp:b['WhatsApp'] || '',email:b['E-mail'] || '',responsavel:b['Responsável'] || ''}
      };
    });
}

function testarAutomacaoV8() {
  const ss = getSS_();
  const result = handleAutomationAction_(ss, {
    action:'lead',
    empresa:'TESTE AUTOMACAO CIRCULAR',
    responsavel:'Teste interno',
    whatsapp:'5511999999999',
    cidadeUF:'São Paulo/SP',
    origem:'teste',
    fonte:'teste interno Apps Script',
    statusLead:'novo',
    tipo:'compra',
    materiais:[
      {tipo:'compra',categoria:'plastico',material:'PP',condicao:'aparas'}
    ],
    proximaAcao:'Remover lead de teste após validação'
  });
  Logger.log(JSON.stringify(result));
  return result;
}
