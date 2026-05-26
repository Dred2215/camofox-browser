/**
 * Automation plugin.
 *
 * Opens one or more URLs automatically after the server starts.
 * Configure via camofox.config.json:
 *
 *   "automation": {
 *     "enabled": true,
 *     "tasks": [
 *       { "url": "https://example.com", "userId": "startup", "sessionKey": "main" }
 *     ]
 *   }
 */

export async function register(app, ctx, pluginConfig = {}) {
  const { events, log, config, validateUrl } = ctx;
  const { enabled = true, tasks = [] } = pluginConfig;

  if (!enabled || tasks.length === 0) return;

  events.on('server:started', async ({ port }) => {
    const base = `http://localhost:${port}`;

    for (const task of tasks) {
      const { url, userId = 'automation', sessionKey = 'default' } = task;

      if (!url) {
        log('warn', 'automation: task sem url, ignorando', { task });
        continue;
      }

      const urlErr = validateUrl(url);
      if (urlErr) {
        log('warn', 'automation: url inválida, ignorando', { url, error: urlErr });
        continue;
      }

      try {
        log('info', 'automation: abrindo url no startup', { url, userId, sessionKey });
        const res = await fetch(`${base}/tabs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, sessionKey, url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        log('info', 'automation: url aberta com sucesso', { url, userId, tabId: data.tabId });
      } catch (err) {
        log('error', 'automation: falha ao abrir url', { url, userId, error: err.message });
      }
    }
  });
}
