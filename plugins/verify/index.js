/**
 * Plugin verify — verifica o estado visual da tab ativa.
 * Reporta URL, frames detectados, botões visíveis e modais presentes.
 */

export async function register(_app, ctx) {
  const { log, registerAction, sessions } = ctx;

  function findActiveTab(tabId) {
    let best = null;
    let bestTime = -1;
    for (const [userId, session] of sessions) {
      for (const [listItemId, group] of session.tabGroups) {
        for (const [tid, tabState] of group) {
          if (tabId && tid !== tabId) continue;
          const t = session.lastAccess || 0;
          if (t > bestTime) { bestTime = t; best = { tabId: tid, tabState, userId, listItemId }; }
        }
      }
    }
    return best;
  }

  registerAction('verify-screen', {
    label: 'Verificar tela',
    description: 'Inspeciona o estado da tab ativa: URL, frames, botões visíveis e modais.',
    fields: [
      { name: 'tabId', label: 'Tab ID', type: 'text', required: false, placeholder: '(deixe vazio para a tab mais recente)' },
    ],
    async run({ tabId } = {}) {
      const found = findActiveTab(tabId);
      if (!found) throw new Error('Nenhuma tab aberta encontrada');

      const { tabState, tabId: tid, userId } = found;
      const page = tabState.page;
      const url = page.url();
      const frames = page.frames();
      const steps = [];

      steps.push(`✅ Tab ativa — ${url}`);
      steps.push(`👤 userId: ${userId}  |  tabId: ${tid}`);
      steps.push(`🖼 Frames: ${frames.length}`);

      for (const frame of frames) {
        const fUrl = frame.url();
        const label = fUrl === url ? '(principal)' : fUrl.split('?')[1]?.slice(0, 60) || fUrl;
        steps.push(`   ── ${label}`);

        const hasModal = await frame.isVisible('.swal2-confirm').catch(() => false);
        if (hasModal) steps.push(`   ✅ Modal SweetAlert2 detectado — seletor: .swal2-confirm`);

        try {
          const btns = await frame.evaluate(() =>
            Array.from(document.querySelectorAll('button'))
              .filter(b => b.offsetParent !== null)
              .map(b => b.innerText.trim())
              .filter(t => t)
          );
          if (btns.length) steps.push(`   🔘 Botões visíveis: ${btns.map(t => `"${t}"`).join(', ')}`);
        } catch { /* frame protegido */ }
      }

      log('info', 'verify-screen', { tabId: tid, userId, url });
      return { tabId: tid, url, steps };
    },
  });

  log('info', 'verify plugin: action registrada');
}
