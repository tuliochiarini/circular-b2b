export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const upstream =
    'https://script.google.com/macros/s/AKfycbyeoQwrWQD4TmxZNpIIZVU5X3jWZXj0cPW3E7J6sQQTtHr9wtCZ9cdtMx4xjAsbxyFy/exec?action=public';

  try {
    const response = await fetch(upstream, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'application/json,text/plain,*/*'
      }
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: 'Falha ao consultar a base da Circular',
        upstreamStatus: response.status
      });
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      return res.status(502).json({
        success: false,
        error: 'Resposta inválida da base da Circular'
      });
    }

    const peadDemand = {
      id: 'OPP-000012',
      tipo: 'compra',
      categoria: 'plastico',
      material: 'PEAD',
      especificacao:
        'Pós-industrial rígido; natural e branco separados; máximo 1% de PP; não aceita filme',
      condicao: 'Peças prensadas ou moído com granulometria máxima de 10 mm',
      quantidade: '500',
      unidade: 'kg',
      frequencia: 'Recorrente / a combinar',
      preco: 'Sob avaliação por fotos e qualidade',
      cidadeUF: 'Taboão da Serra/SP',
      logistica:
        'Entrega a partir de 500 kg por cor e tipo. Retirada em Piracicaba a partir de 3.000 kg.',
      observacoes:
        'Aceita material industrial limpo de processo, sem lavagem, ou lavado e seco. Pós-consumo somente segregado por tipo. Fotos obrigatórias para avaliação final.',
      materiaisNaoInteressam:
        'PEAD filme; natural misturado com branco; contaminação acima de 1% de PP',
      status: 'ativo'
    };

    if (Array.isArray(data)) {
      data = [peadDemand, ...data.filter(item => item?.id !== peadDemand.id)];
    } else if (data && Array.isArray(data.opportunities)) {
      data.opportunities = [
        peadDemand,
        ...data.opportunities.filter(item => item?.id !== peadDemand.id)
      ];
    }

    res.setHeader(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=120'
    );

    return res.status(200).json(data);
  } catch (error) {
    console.error('Circular opportunities proxy error:', error);

    return res.status(502).json({
      success: false,
      error: 'Não foi possível atualizar as oportunidades agora.'
    });
  }
}
