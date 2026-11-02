(function () {
  const cache = new Map();
  const assetsOrigin = window.location.origin;

  function prepareMarkup(markup, sourceUrl) {
    const doc = new DOMParser().parseFromString(String(markup || ''), 'text/html');
    const imageReplacements = { 'LOGO consultora.png': 'logo-completo.png', 'drCdm1JPm_720x0__1.jpg': 'drCdm1JPm_720x0__1.jpg' };
    doc.querySelectorAll('img[src]').forEach(img => {
      const value = img.getAttribute('src');
      if (/^(data:|blob:|https?:)/i.test(value)) return;
      const replacement = imageReplacements[decodeURIComponent(value).replace(/^\.\//, '')];
      if (replacement) img.src = `${assetsOrigin}/assets/img/${replacement}`;
    });
    if (!doc.querySelector('meta[name="viewport"]')) {
      const viewport = doc.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
      doc.head.append(viewport);
    }
    doc.querySelectorAll('base').forEach(node => node.remove());
    if (!('speechSynthesis' in window)) doc.querySelectorAll('script:not([src])').forEach(script => {
      script.textContent = script.textContent.replace(/window\.speechSynthesis\.onvoiceschanged\s*=/g, 'if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged =');
    });
    const base = doc.createElement('base');
    base.href = new URL(sourceUrl, assetsOrigin).href;
    doc.head.prepend(base);
    if (!doc.querySelector('[data-cd-responsive]')) {
      const style = doc.createElement('link');
      style.rel = 'stylesheet';
      style.href = `${assetsOrigin}/assets/css/responsive.css?v=20261102`;
      style.setAttribute('data-cd-responsive', '');
      doc.head.append(style);
      const script = doc.createElement('script');
      script.src = `${assetsOrigin}/assets/js/report-responsive.js?v=20261102`;
      script.defer = true;
      doc.body.append(script);
    }
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }

  function accessUrl(reportId, target) {
    const config = window.CD_SUPABASE || {};
    if (!config.url || !reportId) return "";
    const url = new URL("/functions/v1/report-access", config.url);
    url.searchParams.set("report", reportId);
    url.searchParams.set("target", target);
    return url.href;
  }

  async function htmlBlobUrl(source, sourceHint = '') {
    const url = String(source || "");
    if (!url) throw new Error("sin origen");
    if (cache.has(url)) return cache.get(url);
    const response = await fetch(url, { credentials: "omit", redirect: "follow" });
    if (!response.ok) {
      const error = new Error(`No se pudo abrir el informe (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    const markup = await response.text();
    const blobUrl = URL.createObjectURL(new Blob([prepareMarkup(markup, sourceHint || response.url || url)], { type: "text/html; charset=utf-8" }));
    cache.set(url, blobUrl);
    return blobUrl;
  }

  window.CDReportHtml = {
    accessUrl,
    prepareMarkup,
    htmlBlobUrl,
    reportHtmlBlobUrl: (reportId, sourceHint) => htmlBlobUrl(accessUrl(reportId, "html"), sourceHint),
  };
})();
