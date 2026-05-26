/**
 * Plugin Sanx — automação específica do fluxo pizzasanx.com.br.
 *
 * Marco 1: identificar e fechar o modal de aviso de troco.
 * Marco 2: clicar em "Faça seu pedido online".
 */

export async function register(_app, ctx) {
  const { log, registerAction, sessions } = ctx;

  function findSanxTab() {
    for (const [userId, session] of sessions) {
      for (const [listItemId, group] of session.tabGroups) {
        for (const [tabId, tabState] of group) {
          if (tabState.page.url().includes('pizzasanx.com.br')) {
            return { tabId, tabState, userId };
          }
        }
      }
    }
    return null;
  }

  function getMobileFrame(page) {
    return page.frames().find(f => f.url().includes('ed_mobile_iframe=1')) || null;
  }

  // ── Marco 1: modal de aviso de troco ─────────────────────────────────────
  registerAction('sanx-modal-troco', {
    label: 'Sanx — Modal de aviso',
    description: 'Verifica se o modal "Atenção a Trocos" está visível e clica em OK.',
    fields: [],
    async run() {
      const found = findSanxTab();
      if (!found) throw new Error('Nenhuma tab do Sanx encontrada. Use "Iniciar automação" primeiro.');

      const { tabState, tabId, userId } = found;
      const frame = getMobileFrame(tabState.page);
      const steps = [];

      steps.push('✅ Tela Sanx identificada');

      if (!frame) {
        steps.push('⚠️ Frame mobile não encontrado');
        return { tabId, steps };
      }

      const hasModal = await frame.isVisible('.swal2-confirm').catch(() => false);

      if (!hasModal) {
        steps.push('ℹ️ Modal não está visível — nada a fazer');
        return { tabId, steps };
      }

      steps.push('✅ Modal "Atenção a Trocos" identificado');

      await frame.click('.swal2-confirm');
      await frame.waitForSelector('.swal2-container', { state: 'hidden', timeout: 3000 }).catch(() => {});

      steps.push('✅ OK clicado — modal fechado');

      log('info', 'sanx-modal-troco: modal fechado', { tabId, userId });
      return { tabId, steps };
    },
  });

  // ── Marco 2: clicar em "Faça seu pedido online" ──────────────────────────
  registerAction('sanx-fazer-pedido', {
    label: 'Sanx — Fazer pedido',
    description: 'Clica no botão "Faça seu pedido online" na tela inicial.',
    fields: [],
    async run() {
      const found = findSanxTab();
      if (!found) throw new Error('Nenhuma tab do Sanx encontrada. Use "Iniciar automação" primeiro.');

      const { tabState, tabId, userId } = found;
      const page = tabState.page;
      const steps = [];

      steps.push('✅ Tela Sanx identificada');

      // frameLocator é mais estável que frame reference — não fica stale após reload
      const frameLocator = page.frameLocator('iframe[src*="ed_mobile_iframe"]');

      try {
        const btnPedido = frameLocator.locator('.mdl-button--rai')
          .or(frameLocator.locator('button:has-text("FAÇA SEU PEDIDO")'))
          .first();
        await btnPedido.waitFor({ state: 'visible', timeout: 5000 });
        steps.push('✅ Botão "Faça seu pedido online" identificado');

        await btnPedido.click();
        await page.waitForTimeout(1000);

        steps.push('✅ Botão clicado — aguardando próxima tela');

        // Verifica se apareceu o modal "Delivery Online Fechado!"
        const frame = getMobileFrame(page);
        if (frame) {
          const deliveryFechado = await frame.isVisible('.swal2-confirm').catch(() => false);
          if (deliveryFechado) {
            const titulo = await frame.textContent('#swal2-title').catch(() => '');
            if (titulo.includes('Delivery') || titulo.includes('Fechado')) {
              steps.push(`⚠️ Modal detectado: "${titulo.trim()}"`);
              steps.push('ℹ️ O delivery está fora do horário — clicando OK para continuar navegando');
              await frame.click('.swal2-confirm');
              await frame.waitForSelector('.swal2-container', { state: 'hidden', timeout: 3000 }).catch(() => {});
              steps.push('✅ Modal fechado — é possível navegar mas não finalizar pedido');
            }
          }
        }
      } catch (e) {
        steps.push(`⚠️ Botão não encontrado: ${e.message.split('\n')[0]}`);
      }

      log('info', 'sanx-fazer-pedido', { tabId, userId });
      return { tabId, steps };
    },
  });

  // ── Marco 3: selecionar categoria do cardápio ────────────────────────────
  registerAction('sanx-categoria', {
    label: 'Sanx — Selecionar categoria',
    description: 'Escolhe uma categoria do cardápio e navega para ela.',
    fields: [
      {
        name: 'categoria',
        label: 'Categoria',
        type: 'select',
        required: true,
        options: [
          { value: '/montar/pizzas-premium/',          label: 'Pizzas Premium' },
          { value: '/montar/todos-os-nossos-sabores/', label: 'Todos os Nossos Sabores' },
          { value: '/montar/pizzas-4-sabores/',        label: 'Pizzas 4 Sabores' },
          { value: '/cardapio/itens/pizzas-doces',     label: 'Pizzas Doces' },
          { value: '/cardapio/itens/bebidas',          label: 'Bebidas' },
        ],
      },
    ],
    async run({ categoria }) {
      if (!categoria) throw new Error('Selecione uma categoria');

      const found = findSanxTab();
      if (!found) throw new Error('Nenhuma tab do Sanx encontrada. Use "Iniciar automação" primeiro.');

      const { tabState, tabId, userId } = found;
      const page = tabState.page;
      const steps = [];

      steps.push('✅ Tela Sanx identificada');

      const frame = getMobileFrame(page);
      if (!frame) {
        steps.push('⚠️ Frame mobile não encontrado');
        return { tabId, steps };
      }

      try {
        const link = frame.locator(`a[href="${categoria}"]`).first();
        await link.waitFor({ state: 'visible', timeout: 5000 });
        steps.push(`✅ Categoria identificada: ${categoria}`);

        await link.click();
        await page.waitForTimeout(1500);

        steps.push('✅ Categoria selecionada — aguardando tela dos itens');
      } catch (e) {
        steps.push(`⚠️ Erro ao selecionar categoria: ${e.message.split('\n')[0]}`);
      }

      log('info', 'sanx-categoria', { tabId, userId, categoria });
      return { tabId, steps };
    },
  });

  // ── Marco 4: tela de montagem da pizza ───────────────────────────────────
  registerAction('sanx-montar-pizza', {
    label: 'Sanx — Montar pizza',
    description: 'Fecha o tutorial (se aberto) e abre o seletor de sabores.',
    fields: [],
    async run() {
      const found = findSanxTab();
      if (!found) throw new Error('Nenhuma tab do Sanx encontrada.');

      const { tabState, tabId, userId } = found;
      const page = tabState.page;
      const steps = [];

      // Valida que estamos na tela de montagem
      const url = page.url();
      if (!url.includes('/montar/')) {
        throw new Error(`Tela incorreta: ${url} — execute "Selecionar categoria" primeiro`);
      }
      steps.push(`✅ Tela de montagem identificada — ${url}`);

      const frame = getMobileFrame(page);
      if (!frame) {
        steps.push('⚠️ Frame mobile não encontrado');
        return { tabId, steps };
      }

      // Fecha o tutorial joyride se estiver visível
      const tutorialVisible = await frame.isVisible('.joyride-tip-guide').catch(() => false);

      if (tutorialVisible) {
        steps.push('✅ Tutorial "Monte a sua Pizza" identificado');
        await frame.click('a.joyride-close-tip');
        await page.waitForTimeout(500);
        steps.push('✅ Tutorial fechado');
      } else {
        steps.push('ℹ️ Tutorial já estava fechado');
      }

      // Clica no seletor para abrir o modal de sabores
      const seletor = frame.locator('.openModalFlavors').first();
      await seletor.waitFor({ state: 'visible', timeout: 5000 });
      steps.push('✅ Seletor de pizza identificado');

      await seletor.click();
      await page.waitForTimeout(1000);
      steps.push('✅ Modal de sabores aberto');

      log('info', 'sanx-montar-pizza', { tabId, userId, url });
      return { tabId, steps };
    },
  });

  log('info', 'sanx plugin: actions registradas');
}
