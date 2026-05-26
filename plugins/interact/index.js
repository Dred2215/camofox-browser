/**
 * Plugin Interact — ações globais de interação.
 *
 * Funciona em qualquer tab aberta. Se tabId não for informado,
 * usa a tab acessada mais recentemente em qualquer sessão.
 *
 * Actions:
 *  - interact-click  : clica num elemento por seletor CSS (varre todos os frames)
 *  - interact-fill   : preenche um campo por seletor CSS (varre todos os frames)
 */

export async function register(_app, ctx) {
  const { log, registerAction, sessions } = ctx;

  // Retorna a tab mais recentemente acessada, ou a tab com tabId específico
  function resolveTab(tabId) {
    let best = null;
    let bestTime = -1;

    for (const [userId, session] of sessions) {
      for (const [listItemId, group] of session.tabGroups) {
        for (const [tid, tabState] of group) {
          if (tabId && tid !== tabId) continue;
          const t = session.lastAccess || 0;
          if (t > bestTime) {
            bestTime = t;
            best = { tabId: tid, tabState, userId, listItemId };
          }
        }
      }
    }
    return best;
  }

  // Tenta o seletor em todos os frames do page; retorna o frame onde achou
  async function findFrameWithSelector(page, selector) {
    for (const frame of page.frames()) {
      try {
        const visible = await frame.isVisible(selector, { timeout: 500 }).catch(() => false);
        if (visible) return frame;
      } catch { /* continua */ }
    }
    return null;
  }

  // ── Clicar em elemento ────────────────────────────────────────────────────
  registerAction('interact-click', {
    label: 'Interação — Clicar em elemento',
    description: 'Clica num elemento por seletor CSS na tab ativa (varre todos os frames).',
    fields: [
      { name: 'selector', label: 'Seletor CSS',  type: 'text', required: true,  placeholder: '.swal2-confirm' },
      { name: 'tabId',    label: 'Tab ID',        type: 'text', required: false, placeholder: '(deixe vazio para a tab mais recente)' },
    ],
    async run({ selector, tabId }) {
      if (!selector) throw new Error('Seletor é obrigatório');

      const found = resolveTab(tabId);
      if (!found) throw new Error('Nenhuma tab aberta encontrada');

      const { tabState, tabId: tid, userId } = found;
      const page = tabState.page;
      const steps = [];

      steps.push(`🔍 Tab: ${tid}`);
      steps.push(`🌐 URL: ${page.url()}`);

      const frame = await findFrameWithSelector(page, selector);
      if (!frame) throw new Error(`Elemento não encontrado: ${selector}`);

      const frameLabel = frame.url() === page.url() ? 'frame principal' : frame.url().split('?')[0].split('/').pop();
      steps.push(`✅ Elemento encontrado no frame: ${frameLabel}`);

      await frame.click(selector);
      steps.push(`✅ Clique realizado: ${selector}`);

      log('info', 'interact-click', { tabId: tid, userId, selector });
      return { tabId: tid, steps };
    },
  });

  // ── Preencher campo ───────────────────────────────────────────────────────
  registerAction('interact-fill', {
    label: 'Interação — Preencher campo',
    description: 'Digita um valor num campo de texto por seletor CSS na tab ativa.',
    fields: [
      { name: 'selector', label: 'Seletor CSS',  type: 'text', required: true,  placeholder: 'input[placeholder*="Nome"]' },
      { name: 'value',    label: 'Valor',         type: 'text', required: true,  placeholder: 'João Silva' },
      { name: 'tabId',    label: 'Tab ID',        type: 'text', required: false, placeholder: '(deixe vazio para a tab mais recente)' },
    ],
    async run({ selector, value, tabId }) {
      if (!selector) throw new Error('Seletor é obrigatório');
      if (value === undefined || value === null) throw new Error('Valor é obrigatório');

      const found = resolveTab(tabId);
      if (!found) throw new Error('Nenhuma tab aberta encontrada');

      const { tabState, tabId: tid, userId } = found;
      const page = tabState.page;
      const steps = [];

      steps.push(`🔍 Tab: ${tid}`);
      steps.push(`🌐 URL: ${page.url()}`);

      const frame = await findFrameWithSelector(page, selector);
      if (!frame) throw new Error(`Campo não encontrado: ${selector}`);

      const frameLabel = frame.url() === page.url() ? 'frame principal' : frame.url().split('?')[0].split('/').pop();
      steps.push(`✅ Campo encontrado no frame: ${frameLabel}`);

      await frame.fill(selector, value);
      steps.push(`✅ Preenchido: "${value}"`);

      log('info', 'interact-fill', { tabId: tid, userId, selector, value });
      return { tabId: tid, steps };
    },
  });

  log('info', 'interact plugin: actions registradas');
}
