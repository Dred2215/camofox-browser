/**
 * Plugin automate — abre uma URL numa nova tab para iniciar uma automação.
 * Não captura screenshot. A tab fica ativa e disponível para os demais plugins.
 */

export async function register(_app, ctx) {
  const { log, registerAction, validateUrl, config } = ctx;
  const port = config.port || 9377;
  const base = `http://localhost:${port}`;

  registerAction('automate-open', {
    label: 'Iniciar automação',
    description: 'Abre uma URL numa nova tab e deixa pronta para inspecionar e automatizar.',
    fields: [
      { name: 'url',        label: 'URL',         type: 'url',  required: true,  placeholder: 'https://...' },
      { name: 'userId',     label: 'User ID',     type: 'text', required: false, default: 'automacao' },
      { name: 'sessionKey', label: 'Session Key', type: 'text', required: false, default: 'main' },
    ],
    async run({ url, userId = 'automacao', sessionKey = 'main' }) {
      if (!url) throw new Error('URL é obrigatória');
      const urlErr = validateUrl(url);
      if (urlErr) throw new Error(urlErr);

      const res = await fetch(`${base}/tabs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionKey, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const steps = [
        `✅ Tab aberta — ${data.url}`,
        `👤 userId: ${userId}  |  tabId: ${data.tabId}`,
        '👉 Execute "Verificar tela" ou "Inspecionar HTML" para continuar',
      ];

      log('info', 'automate-open: tab aberta', { tabId: data.tabId, userId, url: data.url });
      return { tabId: data.tabId, url: data.url, steps };
    },
  });

  log('info', 'automate plugin: action registrada');
}
