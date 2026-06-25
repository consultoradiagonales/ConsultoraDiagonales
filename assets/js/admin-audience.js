(function () {
  function dateTime(value) {
    if (!value) return "Fecha no disponible";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(date).replace(",", " ·") + " hs";
  }

  function phone(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("549") && digits.length >= 12) return `+54 9 ${digits.slice(3, 6)} ${digits.slice(6, 9)}-${digits.slice(9)}`;
    return raw;
  }

  function geo(item) {
    const country = item.geo_country || item.geo_country_code;
    const parts = [item.geo_city, item.geo_region, country].filter(Boolean);
    return parts.length ? parts.join(", ") : "Ubicación no disponible";
  }

  function eventName(value) {
    const labels = { page_view: "Visita a una página", read_session: "Sesión de lectura", report_open: "Abrió una radiografía", report_access_requested: "Solicitó acceso a una radiografía", download_report: "Abrió o descargó un PDF", request_pdf: "Seleccionó un PDF", open_graph: "Abrió los gráficos", lead_form_submitted: "Envió sus datos de contacto", share_lead_submitted: "Compartió una radiografía", request_brief_generated: "Generó una solicitud", network_snapshot: "Origen de conexión registrado" };
    return labels[value] || String(value || "Actividad").replaceAll("_", " ");
  }

  function pageName(pageValue, pathValue) {
    const labels = { home: "Inicio", repo: "Repositorio de radiografías", analisis: "Análisis", registro: "Registro de acceso", contacto: "Contacto", servicios: "Servicios" };
    return labels[pageValue] || pathValue || "Página no identificada";
  }

  window.renderAdminDownloadItem = function (item) {
    const person = item.full_name || item.email || item.phone || "Visitante sin nombre registrado";
    const report = item.radiografia_title || "Radiografía no identificada";
    const formattedPhone = phone(item.phone);
    return `<div class="admin-list-item"><strong>${escapeHtml(person)}</strong><span>Radiografía: ${escapeHtml(report)}</span>${formattedPhone ? `<span>Teléfono: ${escapeHtml(formattedPhone)}</span>` : ""}<small>${escapeHtml(dateTime(item.downloaded_at || item.created_at))}</small></div>`;
  };

  window.renderAdminAudienceItem = function (item) {
    const reports = (item.interested_reports || []).map((report) => report.title).filter(Boolean);
    const name = item.full_name || "Visitante sin nombre registrado";
    const formattedPhone = phone(item.phone) || "No informado";
    const location = geo(item);
    const ip = item.ip_address || "No disponible (registro anterior a la captura)";
    const tags = reports.length ? reports.map((title) => `<span class="admin-report-tag">${escapeHtml(title)}</span>`).join("") : '<span class="admin-report-tag">Sin radiografías identificadas</span>';
    return `<div class="admin-list-item admin-person-card" data-has-ip="${item.ip_address ? "true" : "false"}"><strong>${escapeHtml(name)}</strong><div class="admin-person-grid"><div class="admin-person-field"><small>Nombre y apellido</small><span>${escapeHtml(name)}</span></div><div class="admin-person-field"><small>Teléfono</small>${item.phone ? `<a href="tel:${escapeAttribute(String(item.phone).replace(/\s+/g, ""))}">${escapeHtml(formattedPhone)}</a>` : `<span>${escapeHtml(formattedPhone)}</span>`}</div><div class="admin-person-field"><small>Cantidad de visitas</small><span>${Number(item.visit_count || 0)}</span></div><div class="admin-person-field"><small>Última actividad</small><span>${escapeHtml(dateTime(item.last_interest_at || item.last_seen_at || item.created_at))}</span></div><div class="admin-person-field"><small>Correo electrónico</small><span>${escapeHtml(item.email || "No informado")}</span></div><div class="admin-person-field"><small>IP de ingreso</small><span>${escapeHtml(ip)}</span></div><div class="admin-person-field is-wide"><small>Zona geográfica aproximada</small><span>${escapeHtml(location)}</span></div><div class="admin-person-field is-wide"><small>Radiografías que visitó</small><div class="admin-report-tags">${tags}</div></div></div></div>`;
  };

  window.renderAdminEventItem = function (item) {
    const contact = item.metadata?.contact || {};
    const person = contact.full_name || contact.phone || contact.email || "Visitante sin nombre registrado";
    const report = item.radiografia_title ? ` · ${item.radiografia_title}` : "";
    const location = geo(item);
    const network = [item.ip_address, location === "Ubicación no disponible" ? "" : location].filter(Boolean).join(" · ");
    return `<div class="admin-list-item" data-event-has-ip="${item.ip_address ? "true" : "false"}"><strong>${escapeHtml(eventName(item.event_type))}${escapeHtml(report)}</strong><span>${escapeHtml(person)} · ${escapeHtml(pageName(item.page, item.path))}</span>${network ? `<span>Origen: ${escapeHtml(network)}</span>` : "<span>Origen: IP no disponible para este registro</span>"}<small>${escapeHtml(dateTime(item.created_at))}</small></div>`;
  };

  const filter = document.querySelector("[data-admin-ip-filter]");
  const audience = document.querySelector("[data-admin-contacts]");
  const eventsFilter = document.querySelector("[data-admin-events-ip-filter]");
  const events = document.querySelector("[data-admin-events]");
  const exportButton = document.querySelector("[data-admin-export-excel]");
  const dashboardStatus = document.querySelector("[data-admin-dashboard-status]");

  function applyIpFilter() {
    if (!filter || !audience) return;
    const value = filter.value;
    audience.querySelectorAll("[data-has-ip]").forEach((card) => { const hasIp = card.dataset.hasIp === "true"; card.hidden = value === "with-ip" ? !hasIp : value === "without-ip" ? hasIp : false; });
  }

  function applyEventsIpFilter() {
    if (!eventsFilter || !events) return;
    const value = eventsFilter.value;
    events.querySelectorAll("[data-event-has-ip]").forEach((event) => { const hasIp = event.dataset.eventHasIp === "true"; event.hidden = value === "with-ip" ? !hasIp : value === "without-ip" ? hasIp : false; });
  }

  filter?.addEventListener("change", applyIpFilter);
  if (audience) new MutationObserver(applyIpFilter).observe(audience, { childList: true });
  eventsFilter?.addEventListener("change", applyEventsIpFilter);
  if (events) new MutationObserver(applyEventsIpFilter).observe(events, { childList: true });

  exportButton?.addEventListener("click", async () => {
    const config = window.CD_SUPABASE || {};
    const adminKey = sessionStorage.getItem("cd:admin_upload_key") || "";
    if (!config.url || !config.anonKey || !adminKey) {
      if (dashboardStatus) dashboardStatus.textContent = "Volvé a ingresar al panel para exportar.";
      return;
    }
    exportButton.disabled = true;
    if (dashboardStatus) dashboardStatus.textContent = "Generando archivo Excel...";
    try {
      const response = await fetch(`${config.url}/functions/v1/admin-dashboard?export=audience`, { headers: { Authorization: `Bearer ${config.anonKey}`, apikey: config.anonKey, "x-admin-key": adminKey } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || "audiencia-consultora-diagonales.xls";
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      if (dashboardStatus) dashboardStatus.textContent = "Archivo Excel generado.";
    } catch (_) {
      if (dashboardStatus) dashboardStatus.textContent = "No se pudo generar el archivo Excel.";
    } finally {
      exportButton.disabled = false;
    }
  });
})();
