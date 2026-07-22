(function () {
  function dateTime(value) {
    if (!value) return "Fecha no disponible";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(date).replace(",", " ·") + " hs";
  }

  function phone(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("549") && digits.length >= 12) {
      return `+54 9 ${digits.slice(3, 6)} ${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return raw;
  }

  function geo(item) {
    const country = item.geo_country || item.geo_country_code;
    const parts = [item.geo_city, item.geo_region, country].filter(Boolean);
    return parts.length ? parts.join(", ") : "Ubicación no disponible";
  }

  function eventName(value) {
    const labels = {
      page_view: "Visita a una página",
      session_start: "Inicio de sesión",
      engagement_ping: "Lectura activa",
      ui_click: "Clic en la interfaz",
      read_session: "Sesión de lectura",
      report_open: "Abrió una radiografía",
      report_access_requested: "Solicitó acceso a una radiografía",
      download_report: "Abrió o descargó un PDF",
      request_pdf: "Seleccionó un PDF",
      open_graph: "Abrió los gráficos",
      lead_form_submitted: "Envió sus datos de contacto",
      share_lead_submitted: "Compartió una radiografía",
      request_brief_generated: "Generó una solicitud",
      network_snapshot: "Origen de conexión registrado",
    };
    return labels[value] || String(value || "Actividad").replaceAll("_", " ");
  }

  function pageName(pageValue, pathValue) {
    const labels = {
      home: "Inicio",
      repo: "Repositorio de radiografías",
      analisis: "Análisis",
      registro: "Registro de acceso",
      contacto: "Contacto",
      servicios: "Servicios",
    };
    return labels[pageValue] || pathValue || "Página no identificada";
  }

  function pageJourney(items = []) {
    const pages = items.slice(0, 8);
    if (!pages.length) return '<span class="admin-report-tag">Sin recorrido registrado</span>';
    return pages
      .map((item) => {
        const label = item.title || item.path || item.page || "Pagina";
        const count = Number(item.count || 0);
        return `<span class="admin-report-tag">${escapeHtml(`${label}${count ? ` (${count})` : ""}`)}</span>`;
      })
      .join("");
  }

  function contentJourney(items = []) {
    const contents = items.slice(0, 6);
    if (!contents.length) return '<span class="admin-report-tag">Sin consumo identificado</span>';
    return contents
      .map((item) => {
        const pdf = Number(item.download_report || 0);
        const graphs = Number(item.open_graph || 0);
        const opens = Number(item.report_open || 0);
        const label = `${item.title || "Contenido"} | PDF ${pdf} | Graficos ${graphs} | Lecturas ${opens}`;
        return `<span class="admin-report-tag">${escapeHtml(label)}</span>`;
      })
      .join("");
  }

  window.renderAdminPageConsumptionItemEnhanced = function (item) {
    const title = item.title || item.path || "Pagina no identificada";
    const views = Number(item.page_views || 0);
    const visitors = Number(item.unique_visitors || 0);
    const seconds = Number(item.avg_read_seconds || 0);
    const scroll = Number(item.max_scroll_depth || 0);
    return `
      <div class="admin-list-item" data-dashboard-filterable data-filter-report="${escapeAttribute(title)}">
        <strong>${escapeHtml(title)}</strong>
        ${item.path ? `<span>Ruta: ${escapeHtml(item.path)}</span>` : ""}
        <span>${views} vistas | ${visitors} visitantes | ${seconds}s promedio | scroll ${scroll}%</span>
        <small>${escapeHtml(dateTime(item.last_seen_at))}</small>
      </div>
    `;
  };

  window.renderAdminContentConsumptionItemEnhanced = function (item) {
    const total = Number(item.total_consumption || 0);
    const visitors = Number(item.unique_visitors || 0);
    return `
      <div class="admin-list-item" data-dashboard-filterable data-filter-report="${escapeAttribute(item.title || "")}">
        <strong>${escapeHtml(item.title || "Contenido no identificado")}</strong>
        <span>${total} consumos | ${visitors} visitantes</span>
        <span>Informe ${Number(item.report_open || 0)} | Graficos ${Number(item.open_graph || 0)} | PDF ${Number(item.download_report || 0)} | Pedidos ${Number(item.request_pdf || 0)}</span>
        <small>${escapeHtml(dateTime(item.last_at))}</small>
      </div>
    `;
  };

  window.renderAdminLocationConsumptionItemEnhanced = function (item) {
    const label = item.label || [item.city, item.region, item.country].filter(Boolean).join(", ") || "IP sin ciudad detectada";
    return `
      <div class="admin-list-item" data-dashboard-filterable data-filter-location="${escapeAttribute(label)}">
        <strong>${escapeHtml(label)}</strong>
        <span>${Number(item.unique_visitors || 0)} visitantes | ${Number(item.page_views || 0)} vistas | ${Number(item.unique_ips || 0)} IPs</span>
        <span>${Number(item.events || 0)} eventos registrados</span>
        <small>${escapeHtml(dateTime(item.last_seen_at))}</small>
      </div>
    `;
  };

  window.renderAdminAcquisitionItem = function (item) {
    return `
      <div class="admin-list-item admin-data-row" data-dashboard-filterable data-filter-source="${escapeAttribute(item.source || "direct")}">
        <strong>${escapeHtml(`${item.source || "direct"} / ${item.medium || "none"}`)}</strong>
        <span>${Number(item.sessions || 0)} sesiones | ${Number(item.unique_visitors || 0)} visitantes | ${Number(item.page_views || 0)} vistas</span>
        <span>${Number(item.content_actions || 0)} interacciones | ${Number(item.conversions || 0)} conversiones | ${Number(item.conversion_rate || 0)}%</span>
        ${item.campaign ? `<small>Campaña: ${escapeHtml(item.campaign)}</small>` : ""}
      </div>
    `;
  };

  window.renderAdminDeviceItem = function (item) {
    return `
      <div class="admin-list-item admin-data-row" data-dashboard-filterable data-filter-device="${escapeAttribute(item.device || "unknown")}">
        <strong>${escapeHtml(`${item.device || "unknown"} | ${item.browser || "Unknown"}`)}</strong>
        <span>Sistema: ${escapeHtml(item.os || "Unknown")}</span>
        <span>${Number(item.sessions || 0)} sesiones | ${Number(item.unique_visitors || 0)} visitantes | ${Number(item.page_views || 0)} vistas</span>
        <small>${Number(item.avg_engaged_seconds || 0)}s activos promedio | ${Number(item.conversions || 0)} sesiones convertidas</small>
      </div>
    `;
  };

  window.renderAdminTerritoryContentItem = function (item) {
    return `
      <div class="admin-list-item admin-data-row admin-territory-row" data-dashboard-filterable data-filter-location="${escapeAttribute(item.location || "")}" data-filter-report="${escapeAttribute(item.title || "")}">
        <strong>${escapeHtml(item.title || "Contenido no identificado")}</strong>
        <span>Zona: ${escapeHtml(item.location || "Zona no detectada")}</span>
        <span>${Number(item.unique_visitors || 0)} visitantes | ${Number(item.sessions || 0)} sesiones | ${Number(item.interactions || 0)} interacciones</span>
        <span>Aperturas ${Number(item.report_open || 0)} | Gráficos ${Number(item.open_graph || 0)} | Pedidos ${Number(item.request_pdf || 0)} | PDF ${Number(item.download_report || 0)}</span>
        <small>Puntaje de interés ${Number(item.interest_score || 0)} | ${escapeHtml(dateTime(item.last_at))}</small>
      </div>
    `;
  };

  window.renderAdminCampaignItem = function (item) {
    const details = [
      item.campaign ? `Campaña: ${item.campaign}` : "",
      item.term ? `Término: ${item.term}` : "",
      item.content ? `Pieza: ${item.content}` : "",
      item.click_id_type ? `Clic: ${item.click_id_type}` : "",
    ].filter(Boolean).join(" | ");
    return `
      <div class="admin-list-item admin-data-row" data-dashboard-filterable data-filter-source="${escapeAttribute(item.source || "direct")}">
        <strong>${escapeHtml(`${item.source || "direct"} / ${item.medium || "none"}`)}</strong>
        <span>${escapeHtml(details || "Atribución detectada")}</span>
        <span>${Number(item.sessions || 0)} sesiones | ${Number(item.page_views || 0)} vistas | ${Number(item.content_actions || 0)} interacciones | ${Number(item.conversions || 0)} conversiones</span>
      </div>
    `;
  };

  window.renderAdminSessionItem = function (item) {
    const person = item.full_name || item.email || item.phone || "Visitante anónimo";
    const source = `${item.traffic_source || "direct"} / ${item.traffic_medium || "none"}`;
    return `
      <div class="admin-list-item admin-data-row" data-dashboard-filterable data-filter-source="${escapeAttribute(item.traffic_source || "direct")}" data-filter-device="${escapeAttribute(item.device_type || "unknown")}" data-filter-location="${escapeAttribute(item.location || "")}">
        <strong>${escapeHtml(person)}</strong>
        <span>${escapeHtml(source)} | ${escapeHtml(item.location || "Sin zona")}</span>
        <span>${escapeHtml(`${item.device_type || "unknown"} | ${item.browser_name || "Unknown"} | ${item.os_name || "Unknown"}`)}</span>
        <span>${Number(item.page_views || 0)} vistas | ${Number(item.pages || 0)} páginas | ${Number(item.engaged_seconds || 0)}s activos | ${Number(item.content_actions || 0)} interacciones</span>
        <small>${item.is_returning ? "Recurrente" : "Primera sesión"} | Entrada ${escapeHtml(item.landing_page || "-")} | ${escapeHtml(dateTime(item.last_at))}</small>
      </div>
    `;
  };

  window.renderAdminDownloadItemEnhanced = function (item) {
    const person = item.full_name || item.email || item.phone || "Visitante sin nombre registrado";
    const report = item.radiografia_title || "Radiografía no identificada";
    const formattedPhone = phone(item.phone);
    return `
      <div class="admin-list-item">
        <strong>${escapeHtml(person)}</strong>
        <span>Radiografía: ${escapeHtml(report)}</span>
        ${formattedPhone ? `<span>Teléfono: ${escapeHtml(formattedPhone)}</span>` : ""}
        <small>${escapeHtml(dateTime(item.downloaded_at || item.created_at))}</small>
      </div>
    `;
  };

  window.renderAdminAudienceItemEnhanced = function (item) {
    const reports = (item.interested_reports || []).map((report) => report.title).filter(Boolean);
    const name = item.full_name || "Visitante sin nombre registrado";
    const formattedPhone = phone(item.phone) || "No informado";
    const location = geo(item);
    const ip = item.ip_address || "No disponible (registro anterior a la captura)";
    const identity = item.identity_method === "google"
      ? "Cuenta Google autorizada"
      : item.identity_method === "phone_or_form"
        ? "Celular o formulario"
        : "Visitante anónimo";
    const source = `${item.traffic_source || "direct"} / ${item.traffic_medium || "none"}`;
    const device = [item.device_type, item.browser_name, item.os_name].filter(Boolean).join(" | ") || "No disponible";
    const network = [item.isp, item.network_org, item.asn].filter(Boolean).join(" | ") || "No disponible";
    const tags = reports.length
      ? reports.map((title) => `<span class="admin-report-tag">${escapeHtml(title)}</span>`).join("")
      : '<span class="admin-report-tag">Sin radiografías identificadas</span>';

    return `
      <div class="admin-list-item admin-person-card" data-has-ip="${item.ip_address ? "true" : "false"}" data-dashboard-filterable data-filter-source="${escapeAttribute(item.traffic_source || "direct")}" data-filter-device="${escapeAttribute(item.device_type || "unknown")}" data-filter-location="${escapeAttribute(location)}" data-filter-report="${escapeAttribute(reports.join(" | "))}">
        <strong>${escapeHtml(name)}</strong>
        <div class="admin-person-grid">
          <div class="admin-person-field"><small>Nombre y apellido</small><span>${escapeHtml(name)}</span></div>
          <div class="admin-person-field"><small>Teléfono</small>${item.phone ? `<a href="tel:${escapeAttribute(String(item.phone).replace(/\s+/g, ""))}">${escapeHtml(formattedPhone)}</a>` : `<span>${escapeHtml(formattedPhone)}</span>`}</div>
          <div class="admin-person-field"><small>Cantidad de visitas</small><span>${Number(item.visit_count || 0)}</span></div>
          <div class="admin-person-field"><small>Sesiones y dispositivos</small><span>${Number(item.session_count || 0)} sesiones | ${Number(item.device_count || 0)} identificadores</span></div>
          <div class="admin-person-field"><small>Última actividad</small><span>${escapeHtml(dateTime(item.last_interest_at || item.last_seen_at || item.created_at))}</span></div>
          <div class="admin-person-field"><small>Correo electrónico</small><span>${escapeHtml(item.email || "No informado")}</span></div>
          <div class="admin-person-field"><small>Identificación</small><span>${escapeHtml(identity)}</span></div>
          <div class="admin-person-field"><small>IP de ingreso</small><span>${escapeHtml(ip)}</span></div>
          <div class="admin-person-field"><small>Fuente de primera llegada</small><span>${escapeHtml(source)}</span></div>
          <div class="admin-person-field"><small>Campaña / entrada</small><span>${escapeHtml(item.traffic_campaign || item.landing_page || "No disponible")}</span></div>
          <div class="admin-person-field"><small>Dispositivo</small><span>${escapeHtml(device)}</span></div>
          <div class="admin-person-field"><small>Idioma y zona horaria</small><span>${escapeHtml([item.language, item.client_timezone].filter(Boolean).join(" | ") || "No disponible")}</span></div>
          <div class="admin-person-field is-wide"><small>Proveedor y red</small><span>${escapeHtml(network)}${item.connection_type ? ` | ${escapeHtml(item.connection_type)}` : ""}</span></div>
          <div class="admin-person-field is-wide"><small>Zona geográfica aproximada</small><span>${escapeHtml(location)}</span></div>
          <div class="admin-person-field is-wide"><small>Radiografías que visitó</small><div class="admin-report-tags">${tags}</div></div>
          <div class="admin-person-field is-wide"><small>Paginas por las que circulo</small><div class="admin-report-tags">${pageJourney(item.page_journey || [])}</div></div>
          <div class="admin-person-field is-wide"><small>Consumo de contenidos</small><div class="admin-report-tags">${contentJourney(item.content_journey || [])}</div></div>
        </div>
      </div>
    `;
  };

  window.renderAdminEventItemEnhanced = function (item) {
    const contact = item.metadata?.contact || {};
    const person = contact.full_name || contact.phone || contact.email || "Visitante sin nombre registrado";
    const report = item.radiografia_title ? ` · ${item.radiografia_title}` : "";
    const location = geo(item);
    const network = [item.ip_address, location === "Ubicación no disponible" ? "" : location].filter(Boolean).join(" · ");
    const inferred = item.network_inferred ? " · IP vinculada por visitante" : "";
    const source = `${item.traffic_source || item.metadata?.traffic_source || "direct"} / ${item.traffic_medium || item.metadata?.traffic_medium || "none"}`;
    const device = [item.device_type, item.browser_name, item.os_name].filter(Boolean).join(" | ");
    const provider = [item.isp, item.asn].filter(Boolean).join(" | ");
    return `
      <div class="admin-list-item" data-event-has-ip="${item.ip_address ? "true" : "false"}" data-dashboard-filterable data-filter-source="${escapeAttribute(item.traffic_source || item.metadata?.traffic_source || "direct")}" data-filter-device="${escapeAttribute(item.device_type || "unknown")}" data-filter-location="${escapeAttribute(location)}" data-filter-report="${escapeAttribute(item.radiografia_title || "")}">
        <strong>${escapeHtml(eventName(item.event_type))}${escapeHtml(report)}</strong>
        <span>${escapeHtml(person)} · ${escapeHtml(pageName(item.page, item.path))}</span>
        ${network ? `<span>Origen: ${escapeHtml(network + inferred)}</span>` : "<span>Origen: IP todavía no disponible para este visitante</span>"}
        <span>Adquisición: ${escapeHtml(source)}${item.traffic_campaign ? ` | ${escapeHtml(item.traffic_campaign)}` : ""}</span>
        ${device || provider ? `<span>Tecnología: ${escapeHtml([device, provider].filter(Boolean).join(" | "))}</span>` : ""}
        <small>${escapeHtml(dateTime(item.created_at))}</small>
      </div>
    `;
  };

  const filter = document.querySelector("[data-admin-ip-filter]");
  const audience = document.querySelector("[data-admin-contacts]");
  const eventsFilter = document.querySelector("[data-admin-events-ip-filter]");
  const events = document.querySelector("[data-admin-events]");
  const exportButton = document.querySelector("[data-admin-export-excel]");
  const dashboardStatus = document.querySelector("[data-admin-dashboard-status]");
  const sourceFilter = document.querySelector("[data-admin-filter-source]");
  const deviceFilter = document.querySelector("[data-admin-filter-device]");
  const locationFilter = document.querySelector("[data-admin-filter-location]");
  const reportFilter = document.querySelector("[data-admin-filter-report]");
  const filterReset = document.querySelector("[data-admin-filter-reset]");

  function normalized(value) {
    return String(value || "").trim().toLocaleLowerCase("es-AR");
  }

  function replaceOptions(select, values, allLabel) {
    if (!select) return;
    const current = select.value;
    const unique = Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "es-AR"));
    select.innerHTML = [
      `<option value="">${escapeHtml(allLabel)}</option>`,
      ...unique.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`),
    ].join("");
    if (unique.includes(current)) select.value = current;
  }

  function applyDashboardFilters() {
    const selected = {
      source: normalized(sourceFilter?.value),
      device: normalized(deviceFilter?.value),
      location: normalized(locationFilter?.value),
      report: normalized(reportFilter?.value),
    };
    document.querySelectorAll("[data-dashboard-filterable]").forEach((item) => {
      const mismatch = Object.entries(selected).some(([key, value]) => {
        if (!value) return false;
        const attribute = item.getAttribute(`data-filter-${key}`);
        if (attribute === null) return false;
        return !normalized(attribute).includes(value);
      });
      item.classList.toggle("is-segment-hidden", mismatch);
    });
  }

  window.configureAdminDashboardFilters = function (data) {
    replaceOptions(sourceFilter, (data.acquisition_consumption || []).map((item) => item.source), "Todas");
    replaceOptions(deviceFilter, (data.device_consumption || []).map((item) => item.device), "Todos");
    replaceOptions(locationFilter, [
      ...(data.location_consumption || []).map((item) => item.label),
      ...(data.territory_content_consumption || []).map((item) => item.location),
    ], "Todas");
    replaceOptions(reportFilter, (data.content_consumption || []).map((item) => item.title), "Todas");
    applyDashboardFilters();
  };

  [sourceFilter, deviceFilter, locationFilter, reportFilter].forEach((control) => control?.addEventListener("change", applyDashboardFilters));
  filterReset?.addEventListener("click", () => {
    [sourceFilter, deviceFilter, locationFilter, reportFilter].forEach((control) => {
      if (control) control.value = "";
    });
    applyDashboardFilters();
  });

  function applyIpFilter() {
    if (!filter || !audience) return;
    const value = filter.value;
    audience.querySelectorAll("[data-has-ip]").forEach((card) => {
      const hasIp = card.dataset.hasIp === "true";
      card.hidden = value === "with-ip" ? !hasIp : value === "without-ip" ? hasIp : false;
    });
  }

  filter?.addEventListener("change", applyIpFilter);
  if (audience) {
    new MutationObserver(applyIpFilter).observe(audience, { childList: true });
  }

  function applyEventsIpFilter() {
    if (!eventsFilter || !events) return;
    const value = eventsFilter.value;
    events.querySelectorAll("[data-event-has-ip]").forEach((event) => {
      const hasIp = event.dataset.eventHasIp === "true";
      event.hidden = value === "with-ip" ? !hasIp : value === "without-ip" ? hasIp : false;
    });
  }

  eventsFilter?.addEventListener("change", applyEventsIpFilter);
  if (events) {
    new MutationObserver(applyEventsIpFilter).observe(events, { childList: true });
  }

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
      const range = document.querySelector("[data-admin-range]")?.value || "30d";
      const response = await fetch(`${config.url}/functions/v1/admin-dashboard?export=audience&range=${encodeURIComponent(range)}`, {
        headers: {
          Authorization: `Bearer ${config.anonKey}`,
          apikey: config.anonKey,
          "x-admin-key": adminKey,
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const link = document.createElement("a");
      const disposition = response.headers.get("content-disposition") || "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || "audiencia-consultora-diagonales.xls";
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      if (dashboardStatus) dashboardStatus.textContent = "Archivo Excel generado.";
    } catch (_) {
      if (dashboardStatus) dashboardStatus.textContent = "No se pudo generar el archivo Excel.";
    } finally {
      exportButton.disabled = false;
    }
  });
})();
