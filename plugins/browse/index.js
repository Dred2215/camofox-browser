/**
 * Browse plugin.
 *
 * Registra uma action na UI que abre uma URL numa nova tab,
 * aguarda carregar e salva o screenshot automaticamente.
 */

export async function register(_app, ctx) {
  const { log, validateUrl, registerAction, config } = ctx;
  const port = config.port || 9377;
  const base = `http://localhost:${port}`;

  registerAction('browse', {
    label: 'Abrir URL e capturar',
    description: 'Abre uma URL numa nova tab (visível na lista) e salva screenshot automaticamente.',
    fields: [
      { name: 'url',        label: 'URL',        type: 'url',  required: true,  placeholder: 'https://...' },
      { name: 'userId',     label: 'User ID',    type: 'text', required: false, default: 'browse' },
      { name: 'sessionKey', label: 'Session Key',type: 'text', required: false, default: 'browse' },
    ],
    async run({ url, userId = 'browse', sessionKey = 'browse' }) {
      if (!url) throw new Error('url é obrigatório');
      const urlErr = validateUrl(url);
      if (urlErr) throw new Error(urlErr);

      log('info', 'browse action: criando tab e capturando', { url, userId, sessionKey });

      // Cria a tab e captura o screenshot atomicamente (capture:true)
      const tabRes = await fetch(`${base}/tabs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionKey, url, capture: true }),
      });
      const tabData = await tabRes.json();
      if (!tabRes.ok) throw new Error(tabData.error || `HTTP ${tabRes.status}`);

      const { tabId, screenshotPath } = tabData;
      log('info', 'browse action: tab criada e captura salva', { tabId, path: tabData.path });

      return { tabId, url: tabData.url, screenshotPath: screenshotPath || `/screenshots/${tabId}/screenshot.png` };
    },
  });

  log('info', 'browse plugin: action registrada');
}
