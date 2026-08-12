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
