(function () {
  const LOADING_TEXT = "Cargando radiograf";

  document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(loadReportsIfStuck, 3200);
  });

  async function loadReportsIfStuck() {
    const container = document.querySelector("[data-reports]");
    if (!container || !container.textContent.includes(LOADING_TEXT)) return;

    try {
      const reports = await fetchReports();
      renderReports(container, reports);
      const count = document.querySelector("[data-count]");
      if (count) count.textContent = `Total cargadas: ${reports.length}`;
    } catch (error) {
      container.innerHTML = `<div class="empty-state">No pudimos cargar las radiograf&iacute;as. ${escapeHtml(error.message)}</div>`;
    }
  }

  async function fetchReports() {
    const config = window.CD_SUPABASE || {};
    if (!config.url || !config.anonKey) throw new Error("Falta configuraci&oacute;n de Supabase.");

    const url = new URL("/rest/v1/radiografias", config.url);
    url.searchParams.set("select", "id,titulo,provincia,localidad,fecha,html_url,pdf_url,created_at");
    url.searchParams.append("order", "fecha.desc");
    url.searchParams.append("order", "created_at.desc");

    const response = await fetch(url.href, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
    });
    const data = await response.json().catch(() => []);
    if (!response.ok) throw new Error(data.message || data.error || "Error de conexi&oacute;n.");
    return Array.isArray(data) ? data : [];
  }

  function renderReports(container, reports) {
    if (!reports.length) {
      container.innerHTML = '<div class="empty-state">Todav&iacute;a no hay radiograf&iacute;as publicadas.</div>';
      return;
    }

    container.innerHTML = reports.map((report, index) => {
      const title = escapeHtml(report.titulo || "Radiograf&iacute;a sin t&iacute;tulo");
      const pdfHref = escapeAttribute(report.pdf_url || "#");
      return `
        <a href="${pdfHref}" data-pdf-download data-report-index="${index}" data-track="request_pdf">
          <time datetime="${escapeAttribute(report.fecha || "")}">${formatDate(report.fecha)}</time>
          <span>${title}</span>
          <strong>Abrir PDF</strong>
        </a>
      `;
    }).join("");
  }

  function formatDate(value) {
    if (!value) return "Sin fecha";
    const date = new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }
})();
