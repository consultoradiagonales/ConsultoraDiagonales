(function () {
  function boot() {
    document.body.setAttribute('data-cd-report', '');
    const header = document.querySelector('header.top');
    if (header && 'ResizeObserver' in window) new ResizeObserver(() => {
      document.documentElement.style.setProperty('--cd-report-header-height', header.getBoundingClientRect().height + 'px');
    }).observe(header);
    document.querySelectorAll('table').forEach(table => {
      if (table.closest('.cd-table-scroll, .table-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'cd-table-scroll';
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', table.caption?.textContent || 'Tabla de datos; desplazá para ver todas las columnas');
      table.before(wrap);
      wrap.append(table);
    });
    const tabs = [...document.querySelectorAll('.tab[data-t], [data-tab], nav a[onclick*="show("], .tab[onclick*="showTab("]')];
    function panelId(tab) {
      return tab.dataset.t || tab.dataset.tab || (tab.getAttribute('onclick') || '').match(/show(?:Tab)?\(['"]([^'"]+)/)?.[1];
    }
    function findPanel(tab) { const id = panelId(tab); return document.getElementById(id) || document.getElementById('panel-' + id) || document.getElementById('tab-' + id) || document.getElementById('p-' + id); }
    const tabInterface = tabs.some(tab => { const panel = findPanel(tab); return panel && getComputedStyle(panel).display === 'none'; });
    function sync() {
      tabs.forEach(tab => {
        const panel = findPanel(tab);
        if (!panel) return;
        tab.setAttribute('aria-controls', panel.id);
        if (!tabInterface) return;
        const active = getComputedStyle(panel).display !== 'none';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panel.id);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        if (!tab.id) tab.id = 'cd-tab-' + panel.id;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
      });
    }
    tabs.forEach((tab, index) => {
      if (tabInterface) tab.parentElement.setAttribute('role', 'tablist');
      tab.addEventListener('click', () => requestAnimationFrame(sync));
      tab.addEventListener('keydown', event => {
        if (['Enter', ' '].includes(event.key)) { event.preventDefault(); tab.click(); }
        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
        if (next >= 0) { event.preventDefault(); tabs[next].click(); tabs[next].focus(); }
      });
    });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
