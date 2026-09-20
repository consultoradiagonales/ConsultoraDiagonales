(function () {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function estatico(report) {
    return typeof window.informeEstatico === "function" ? window.informeEstatico(report) : null;
  }

  function accessUrl(report, target) {
    const fijo = estatico(report);
    if (fijo?.[target]) return new URL(fijo[target], window.location.origin).href;
    const config = window.CD_SUPABASE || {};
    if (!config.url || !report) return "#";
    const url = new URL("/functions/v1/report-access", config.url);
    url.searchParams.set("report", report);
    url.searchParams.set("target", target);
    return url.href;
  }

  function viewerUrl(report, title) {
    const url = new URL("ver.html", window.location.href);
    url.searchParams.set("report", report);
    if (title) url.searchParams.set("title", title);
    return url.href;
  }

  function boot() {
    const container = document.querySelector("[data-report-detail]");
    if (!container) return;
    const params = new URLSearchParams(window.location.search);
    const report = params.get("report");
    const title = estatico(report)?.titulo || params.get("title") || "Informe completo";
    if (!report) {
      container.innerHTML = '<div class="empty-state">No encontramos el informe solicitado.</div>';
      return;
    }
    container.innerHTML = `
      <article class="report-detail-card">
        <p class="eyebrow">Radiografía Diagonales</p>
        <h1>${escapeHtml(title)}</h1>
        <p>El informe se abre en una página completa para facilitar su lectura.</p>
        <div class="report-detail-card__actions">
          <a class="primary-link" href="${escapeHtml(accessUrl(report, "pdf"))}" target="_blank" rel="noopener noreferrer">Abrir PDF completo</a>
          <a class="secondary-link" href="${escapeHtml(estatico(report)?.html ? accessUrl(report, "html") : viewerUrl(report, title))}" target="_blank" rel="noopener noreferrer">Ver análisis y gráficos</a>
        </div>
      </article>`;
    document.title = `${title} | Consultora Diagonales`;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
