(function () {
  let reportsPromise;
  const PHONE_VERIFIED_KEY = "cd:phone_verified";
  const GMAIL_VERIFIED_KEY = "cd:gmail_verified";
  const PRIVATE_REPORT_REGISTRATION_KEY = "cd:private_report_after_registration";
  const PRIVATE_REPORT_TARGET_KEY = "cd:private_report_after_registration_target";

  document.querySelector(".access-panel")?.remove();
  document.querySelector("[data-reports]")?.classList.remove("gated");

  document.addEventListener("click", handlePublicReportClick, true);
  document.addEventListener("DOMContentLoaded", enablePublicLinks);
  document.addEventListener("DOMContentLoaded", openPendingPrivateReport);
  window.setTimeout(enablePublicLinks, 1200);
  window.setTimeout(openPendingPrivateReport, 1400);

  async function handlePublicReportClick(event) {
    const htmlLink = event.target.closest("[data-html-viewer-open]");
    const pdfLink = event.target.closest("[data-pdf-download]");
    const link = htmlLink || pdfLink;
    if (!link || event.target.closest(".radiografia-share-link")) return;

    const targetType = htmlLink ? "html" : "pdf";
    event.preventDefault();
    event.stopImmediatePropagation();

    const reports = await getReports();
    const report = findReportForLink(reports, link);
    if (!report) {
      openUnknownPublicTarget(link, targetType);
      return;
    }

    const isMissingTarget = targetType === "pdf" ? !report.pdf_url : !report.html_url && !link.href;
    const shouldAskForRegistration = isMissingTarget || isPrivateReport(report);
    if (shouldAskForRegistration) {
      const registrationLink = buildRegistrationLink(report, targetType);
      rememberPrivateReport(report, targetType);
      try {
        if (typeof logReportInterest === "function") await logReportInterest(report, "report_access_requested", registrationLink);
      } catch (_) {
        // El registro de interes no debe bloquear el aviso privado.
      }

      if (typeof window.openPrivateReportModal === "function") {
        window.openPrivateReportModal(report, targetType);
      } else {
        openPrivateReportFallback(report, registrationLink);
      }
      return;
    }

    if (htmlLink) {
      if (typeof openHtmlReportViewer === "function") {
        const title = typeof getHtmlViewerTitle === "function" ? getHtmlViewerTitle(htmlLink) : report.titulo || "Radiografia";
        openHtmlReportViewer(new URL(htmlLink.href, window.location.href).href, title);
      } else {
        window.location.href = htmlLink.href;
      }
      return;
    }

    if (!report.pdf_url) {
      try {
        if (typeof logReportInterest === "function") await logReportInterest(report, "report_access_requested", link.href);
      } catch (_) {
        // La lectura publica no debe fallar por analitica.
      }
      return;
    }

    try {
      if (typeof logPdfDownload === "function") await logPdfDownload(report);
    } catch (_) {
      // La lectura publica no debe fallar si el registro analitico no responde.
    }

    if (typeof openPdfViewer === "function") {
      openPdfViewer(report);
    } else {
      window.location.href = report.pdf_url;
    }
  }

  async function enablePublicLinks() {
    const container = document.querySelector("[data-reports]");
    if (!container) return;

    try {
      const reports = await getReports();
      container.querySelectorAll("[data-pdf-download]").forEach((link) => {
        const report = findReportForLink(reports, link);
        if (!report) return;
        const needsRegistration = isPrivateReport(report);
        if (report.pdf_url && !needsRegistration) {
          link.href = report.pdf_url;
          delete link.dataset.pdfUnavailable;
        } else {
          link.href = buildRegistrationLink(report, "pdf");
          if (!report.pdf_url) link.dataset.pdfUnavailable = "true";
        }
        const text = !report.pdf_url ? "Solicitar radiografia" : isPrivateReport(report) ? "Solicitar acceso" : needsRegistration ? "Validar acceso" : "Abrir PDF";
        const label = link.querySelector("strong");
        if (label) label.textContent = text;
        if (link.classList.contains("request-link")) link.textContent = text;
        if (isPrivateReport(report)) {
          link.dataset.privateReport = "true";
          link.dataset.reportId = report.id || "";
          link.dataset.privateTitle = report.titulo || "";
        }
      });

      container.querySelectorAll("[data-html-viewer-open]").forEach((link) => {
        const report = findReportForLink(reports, link);
        if (!report) return;
        const needsRegistration = isPrivateReport(report);
        link.textContent = needsRegistration ? "Solicitar acceso" : "Graficos";
        if (isPrivateReport(report)) {
          link.dataset.privateReport = "true";
          link.dataset.reportId = report.id || "";
          link.dataset.privateTitle = report.titulo || "";
        }
      });
    } catch (_) {
      // El cargador principal conserva su mensaje de error.
    }
  }

  async function openPendingPrivateReport() {
    if (!hasPrivateReportAccess()) return;

    const params = new URLSearchParams(window.location.search);
    const reportId = params.get("report") || sessionStorage.getItem(PRIVATE_REPORT_REGISTRATION_KEY);
    if (!reportId) return;

    try {
      const reports = await getReports();
      const report = reports.find((item) => item.id === reportId);
      if (!report) return;
      const targetType = params.get("target") || params.get("private_target") || sessionStorage.getItem(PRIVATE_REPORT_TARGET_KEY) || "pdf";
      sessionStorage.removeItem(PRIVATE_REPORT_REGISTRATION_KEY);
      sessionStorage.removeItem(PRIVATE_REPORT_TARGET_KEY);

      if (isPrivateReport(report)) {
        openPrivateReportModal(report, targetType);
        return;
      }

      if (targetType === "html" && report.html_url) {
        if (typeof openHtmlReportViewer === "function") {
          openHtmlReportViewer(report.html_url, report.titulo || "Radiografia");
        } else {
          window.location.href = report.html_url;
        }
        return;
      }

      if (!report.pdf_url) return;
      try {
        if (typeof logPdfDownload === "function") await logPdfDownload(report);
      } catch (_) {
        // El registro analitico no debe bloquear la apertura luego del alta.
      }

      if (typeof openPdfViewer === "function") {
        openPdfViewer(report);
      } else {
        window.location.href = report.pdf_url;
      }
    } catch (_) {
      // Si el listado aun no esta disponible, el usuario conserva el enlace visible.
    }
  }

  function findReportForLink(reports, link) {
    const byIndex = reports[Number(link.dataset.reportIndex)];
    if (byIndex) return byIndex;
    const reportId = link.dataset.reportId;
    if (reportId) return reports.find((item) => item.id === reportId);
    return null;
  }

  function getReports() {
    const cached = getCachedReports();
    if (cached) return Promise.resolve(cached);
    if (!reportsPromise) reportsPromise = fetchReports();
    return reportsPromise;
  }

  function getCachedReports() {
    return Array.isArray(window.CD_REPORTS_CACHE) ? window.CD_REPORTS_CACHE : null;
  }

  async function fetchReports() {
    const config = window.CD_SUPABASE || {};
    const url = new URL("/rest/v1/radiografias", config.url);
    url.searchParams.set("select", "id,titulo,provincia,localidad,fecha,html_url,pdf_url,is_private,created_at");
    url.searchParams.append("order", "fecha.desc");
    url.searchParams.append("order", "created_at.desc");
    let response = await fetch(url.href, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
    });
    if (!response.ok) {
      url.searchParams.set("select", "id,titulo,provincia,localidad,fecha,html_url,pdf_url,created_at");
      response = await fetch(url.href, {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
      });
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reports = await response.json();
    window.CD_REPORTS_CACHE = Array.isArray(reports) ? reports : [];
    return window.CD_REPORTS_CACHE;
  }

  function isPrivateReport(report) {
    return report?.is_private === true
      || String(report?.is_private || "").toLowerCase() === "true";
  }

  function hasPrivateReportAccess() {
    if (typeof window.hasPrivateReportAccess === "function") {
      return window.hasPrivateReportAccess();
    }
    const contact = JSON.parse(localStorage.getItem("cd:contact") || "{}");
    const gmailValidated = localStorage.getItem(GMAIL_VERIFIED_KEY) === contact.visitor_id;
    const phoneValidated = localStorage.getItem(PHONE_VERIFIED_KEY) === contact.phone;
    const statusValidated = ["phone_verified", "gmail_verified"].includes(contact.phone_validation_status);
    if (contact.phone && (gmailValidated || phoneValidated || statusValidated)) return true;
    return false;
  }

  function openUnknownPublicTarget(link, targetType) {
    const href = link.href || "";
    if (targetType === "html" && href) {
      if (looksLikeRadiografiaStorageUrl(href)) {
        const report = {
          id: link.dataset.reportId || null,
          titulo: link.dataset.privateTitle || getLinkTitle(link),
          html_url: href,
        };
        rememberPrivateReport(report, "html");
        const registrationLink = buildRegistrationLink(report, "html");
        if (typeof window.openPrivateReportModal === "function") {
          window.openPrivateReportModal(report, "html");
        } else {
          openPrivateReportFallback(report, registrationLink);
        }
        return;
      }

      if (typeof openHtmlReportViewer === "function") {
        const title = typeof getHtmlViewerTitle === "function" ? getHtmlViewerTitle(link) : "Radiografia";
        openHtmlReportViewer(new URL(href, window.location.href).href, title);
      } else {
        window.location.href = href;
      }
      return;
    }

    if (targetType === "pdf" && href && !href.includes("/registro/")) {
      if (typeof openPdfViewer === "function") {
        openPdfViewer({ titulo: getLinkTitle(link), pdf_url: href });
      } else {
        window.location.href = href;
      }
    }
  }

  function getLinkTitle(link) {
    return link.closest(".latest-report-row")?.querySelector("span")?.textContent?.trim()
      || link.closest(".report-card")?.querySelector("h2")?.textContent?.trim()
      || link.dataset.privateTitle
      || "Radiografia";
  }

  function looksLikeRadiografiaStorageUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return parsed.hostname.includes("supabase.co")
        && parsed.pathname.includes("/storage/v1/object/public/radiografias/")
        && /\.(html?|pdf)$/i.test(parsed.pathname);
    } catch (_) {
      return false;
    }
  }

  function buildRegistrationLink(report, targetType = "pdf") {
    if (typeof window.buildPrivateReportRegistrationLink === "function") {
      return window.buildPrivateReportRegistrationLink(report, targetType);
    }
    const target = new URL(window.location.href);
    if (report?.id) target.searchParams.set("report", report.id);
    if (targetType) target.searchParams.set("private_target", targetType);
    const registration = new URL("/registro/", window.location.origin);
    registration.searchParams.set("next", target.href);
    registration.searchParams.set("pdf", report?.titulo || "Radiografia");
    if (report?.id) registration.searchParams.set("report", report.id);
    if (targetType) registration.searchParams.set("target", targetType);
    return registration.href;
  }

  function rememberPrivateReport(report, targetType = "pdf") {
    if (typeof window.rememberPrivateReport === "function") {
      window.rememberPrivateReport(report, targetType);
      return;
    }
    if (report?.id) sessionStorage.setItem(PRIVATE_REPORT_REGISTRATION_KEY, report.id);
    sessionStorage.setItem(PRIVATE_REPORT_TARGET_KEY, targetType || "pdf");
  }

  function openPrivateReportFallback(report, registrationLink) {
    let modal = document.querySelector("[data-private-report-fallback]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "private-report-modal is-open";
      modal.setAttribute("data-private-report-fallback", "");
      modal.innerHTML = `
        <div class="private-report-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="private-report-fallback-title">
          <button class="private-report-modal__close" type="button" data-private-report-fallback-close aria-label="Cerrar">Cerrar</button>
          <h2 id="private-report-fallback-title">Radiografia privada</h2>
          <p class="private-report-modal__mode">Modo: Solo con registro</p>
          <p>Esta radiografia tiene cerrado el acceso al HTML y al PDF. Para abrirla, registra tus datos.</p>
          <div class="private-report-modal__actions">
            <a class="primary-link" data-private-report-fallback-request href="#">Solicitar esta radiografia</a>
            <button class="secondary-link" type="button" data-private-report-fallback-close>Cancelar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.addEventListener("click", (event) => {
        if (event.target.closest("[data-private-report-fallback-close]")) {
          modal.classList.remove("is-open");
          document.body.style.overflow = "";
          return;
        }
        if (event.target.closest("[data-private-report-fallback-request]")) {
          event.preventDefault();
          window.location.href = modal.__registrationLink || registrationLink;
        }
      });
    }

    modal.__registrationLink = registrationLink;
    const title = modal.querySelector("#private-report-fallback-title");
    if (title) title.textContent = report?.titulo ? `Radiografia privada: ${report.titulo}` : "Radiografia privada";
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
})();
