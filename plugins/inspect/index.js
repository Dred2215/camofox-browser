/**
 * Plugin inspect — inspeciona o HTML da tab ativa.
 * Lista todos os frames, botões (visíveis e ocultos) e modais detectados.
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

  registerAction('inspect-html', {
    label: 'Inspecionar HTML',
    description: 'Lista todos os frames, botões e modais visíveis da tab ativa.',
    fields: [
      { name: 'tabId', label: 'Tab ID', type: 'text', required: false, placeholder: '(deixe vazio para a tab mais recente)' },
    ],
    async run({ tabId } = {}) {
      const found = findActiveTab(tabId);
      if (!found) throw new Error('Nenhuma tab aberta encontrada');

      const { tabState, tabId: tid } = found;
      const page = tabState.page;
      const steps = [];

      const frames = page.frames();
      steps.push(`🖼 Frames encontrados: ${frames.length}`);

      for (const frame of frames) {
        steps.push(`── Frame: ${frame.url() || '(sem url)'}`);
        try {
          const info = await frame.evaluate(() => {
            const isVisible = el => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
            const short = (s, n = 60) => s.trim().replace(/\s+/g, ' ').slice(0, n);

            // Botões
            const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
              text: short(b.innerText),
              visible: isVisible(b),
              classes: b.className,
              id: b.id,
            }));

            // Links clicáveis
            const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
              text: short(a.innerText || a.title || a.getAttribute('aria-label') || ''),
              href: a.getAttribute('href'),
              visible: isVisible(a),
              classes: a.className,
            })).filter(a => a.text || a.href);

            // Elementos clicáveis (div/li com onclick ou role=button)
            const clickables = Array.from(document.querySelectorAll(
              '[onclick],[role="button"],[role="menuitem"],[role="option"],[class*="item"],[class*="card"],[class*="category"],[class*="produto"],[class*="product"]'
            )).map(el => ({
              tag: el.tagName,
              text: short(el.innerText),
              visible: isVisible(el),
              classes: short(el.className, 50),
              id: el.id,
            })).filter(el => el.text);

            // Inputs
            const inputs = Array.from(document.querySelectorAll('input,select,textarea')).map(el => ({
              tag: el.tagName,
              type: el.type || '',
              name: el.name || el.id || el.placeholder || '',
              visible: isVisible(el),
              value: el.value?.slice(0, 40) || '',
            }));

            // Modais
            const dialogs = Array.from(document.querySelectorAll(
              '[role="dialog"],[class*="modal"],[class*="dialog"],[class*="alert"],[class*="popup"],[class*="swal"]'
            )).map(d => ({
              tag: d.tagName,
              classes: short(d.className, 50),
              text: short(d.innerText, 120),
              visible: isVisible(d),
            }));

            const allText = document.body?.innerText?.trim().slice(0, 400) || '';
            return { buttons, links, clickables, inputs, dialogs, allText };
          });

          if (info.allText) steps.push(`   📄 Texto: ${info.allText.replace(/\n/g, ' ').slice(0, 150)}`);

          if (info.buttons.length) {
            steps.push(`   🔘 Botões (${info.buttons.length}):`);
            info.buttons.forEach(b => steps.push(`      ${b.visible ? '👁' : '🙈'} "${b.text}" [${b.classes.slice(0, 50)}]${b.id ? ` #${b.id}` : ''}`));
          }

          const visibleLinks = info.links.filter(l => l.visible);
          if (visibleLinks.length) {
            steps.push(`   🔗 Links visíveis (${visibleLinks.length}):`);
            visibleLinks.forEach(l => steps.push(`      "${l.text}" → ${l.href}`));
          }

          const visibleClickables = info.clickables.filter(c => c.visible);
          if (visibleClickables.length) {
            steps.push(`   👆 Clicáveis visíveis (${visibleClickables.length}):`);
            visibleClickables.forEach(c => steps.push(`      [${c.tag}] "${c.text}" [${c.classes}]${c.id ? ` #${c.id}` : ''}`));
          }

          if (info.inputs.length) {
            steps.push(`   📝 Inputs (${info.inputs.length}):`);
            info.inputs.forEach(i => steps.push(`      ${i.visible ? '👁' : '🙈'} [${i.tag} type=${i.type}] name="${i.name}" value="${i.value}"`));
          }

          if (info.dialogs.length) {
            steps.push(`   📦 Modais (${info.dialogs.length}):`);
            info.dialogs.forEach(d => steps.push(`      ${d.visible ? '👁' : '🙈'} [${d.tag}] "${d.text}"`));
          }
        } catch (e) {
          steps.push(`   ⚠️ Não foi possível inspecionar: ${e.message}`);
        }
      }

      log('info', 'inspect-html', { tabId: tid, frames: frames.length });
      return { tabId: tid, steps };
    },
  });

  log('info', 'inspect plugin: action registrada');
}
