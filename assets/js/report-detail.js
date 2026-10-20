(function () {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function accessUrl(report, target) {
    const config = window.CD_SUPABASE || {};
    if (!config.url || !report) return "#";
    const url = new URL("/functions/v1/report-access", config.url);
    url.searchParams.set("report", report);
    url.searchParams.set("target", target);
    return url.href;
  }

  function viewerUrl(report, title) {
    const url = new URL("/radiografias/ver.html", window.location.origin);
    url.searchParams.set("report", report);
    if (title) url.searchParams.set("title", title);
    return url.href;
  }

  function boot() {
    const container = document.querySelector("[data-report-detail]");
    if (!container) return;
    const params = new URLSearchParams(window.location.search);
    const report = params.get("report");
    const title = params.get("title") || "Informe completo";
    if (!report) {
      container.innerHTML = '<section class="empty-state"><h1>Radiografía no encontrada</h1><p>El enlace puede estar incompleto o el informe ya no está disponible.</p><a class="secondary-link" href="../repositorio/index.html">Volver al repositorio</a></section>';
      return;
    }
    container.innerHTML = `
      <article class="report-detail-card">
        <p class="eyebrow">Radiografía Diagonales</p>
        <h1>${escapeHtml(title)}</h1>
        <p>El informe se abre en una página completa para facilitar su lectura.</p>
        <div class="report-detail-card__actions">
          <a class="primary-link" href="${escapeHtml(accessUrl(report, "pdf"))}" target="_blank" rel="noopener noreferrer">Abrir PDF completo</a>
          <a class="secondary-link" href="${escapeHtml(viewerUrl(report, title))}">Ver informe y gráficos</a>
        </div>
      </article>`;
    document.title = `${title} | Consultora Diagonales`;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
