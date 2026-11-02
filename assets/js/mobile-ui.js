(function () {
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const dialog = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].find(node => node.getClientRects().length && !node.closest('[aria-hidden="true"], [hidden]'));
    const menu = document.querySelector('[data-mobile-menu].is-open');
    const surface = dialog || menu;
    if (!surface) return;
    const controls = [...surface.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,iframe,[tabindex="0"]')].filter(node => node.getClientRects().length && !node.closest('[hidden], [inert]'));
    if (menu && !dialog) controls.unshift(document.querySelector('[data-menu-toggle]'));
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || !surface.contains(document.activeElement) && !controls.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
})();
