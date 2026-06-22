(function () {
  const LOADING_TEXT = "Cargando radiograf";
  const SLOGAN = "Data Analytics aplicado al territorio, opinion publica y escenarios de poder.";

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
      const graphsUrl = getReportGraphsUrl(report);
      const graphsLink = graphsUrl
        ? `<a class="latest-report-row__graphs" href="${escapeAttribute(graphsUrl)}" data-html-viewer-open data-track="open_graph">Gr&aacute;ficos</a>`
        : "";
      const shareHref = escapeAttribute(buildWhatsappHref(report.titulo || "Radiografia de Consultora Diagonales"));
      return `
        <div class="latest-report-row">
          <time datetime="${escapeAttribute(report.fecha || "")}">${formatDate(report.fecha)}</time>
          <span>${title}</span>
          ${graphsLink}
          <a class="latest-report-row__pdf" href="${pdfHref}" data-pdf-download data-report-index="${index}" data-track="request_pdf">Abrir PDF</a>
          <a class="radiografia-share-link radiografia-share-link--list" href="${shareHref}" target="_blank" rel="noopener" aria-label="Compartir por WhatsApp: ${title}">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M16 8.5 8.8 12l7.2 3.5" />
              <circle cx="18" cy="7.5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="18" cy="16.5" r="2.5" />
            </svg>
          </a>
        </div>
      `;
    }).join("");
  }

  function buildWhatsappHref(title) {
    const message = [
      "Consultora Diagonales",
      SLOGAN,
      "",
      title,
      new URL("/repositorio/index.html", window.location.origin).href,
    ].join("\n");
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  function getReportGraphsUrl(report) {
    if (report.html_url) return report.html_url;
    const normalizedTitle = String(report.titulo || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (normalizedTitle.includes("dia de la bandera")) {
      return new URL("/informes/radiografia-adorni-2026.html", window.location.origin).href;
    }
    return "";
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
