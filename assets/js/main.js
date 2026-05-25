const SUPABASE_URL = window.CD_SUPABASE?.url || "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = window.CD_SUPABASE?.anonKey || "TU_SUPABASE_ANON_KEY";
const RENDER_SAMPLE_DATA_WHEN_UNCONFIGURED = true;

const sampleReports = [
  {
    titulo: "Radiografía Intendencia La Plata 2027",
    provincia: "Buenos Aires",
    localidad: "La Plata",
    fecha: "2026-05-17",
    html_url: "../radiografias/radiografia-intendencia-la-plata-2027.html",
  },
  {
    titulo: "Radiografía PBA y La Plata",
    provincia: "Buenos Aires",
    localidad: "La Plata",
    fecha: "2026-05-17",
    html_url: "../radiografias/radiografia-pba-la-plata.html",
  },
  {
    titulo: "Escenarios electorales provinciales",
    provincia: "Córdoba",
    localidad: "Córdoba",
    fecha: "2026-03-28",
    html_url: "#",
  },
];

const page = document.body.dataset.page;
const isConfigured = !SUPABASE_URL.includes("TU-PROYECTO") && !SUPABASE_ANON_KEY.includes("TU_SUPABASE");
const supabaseClient = isConfigured && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

initNavigation();
initLogoFallbacks();
initActiveNavigation();
initLoginModal();
initTracking();

if (page === "repo") loadReports();
if (page === "admin") initAdmin();

function initNavigation() {
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-mobile-menu]");

  const onScroll = () => {
    if (!header || header.classList.contains("is-solid")) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("is-open");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    });
  });
}

function initLogoFallbacks() {
  document.querySelectorAll("[data-logo]").forEach((image) => {
    image.addEventListener("error", () => image.classList.add("is-missing"), { once: true });
  });
}

function initActiveNavigation() {
  const key = page === "repo" ? "radiografias" : page === "home" ? "inicio" : page;
  document.querySelectorAll(`[data-nav="${key}"]`).forEach((link) => link.classList.add("is-active"));
}

function initLoginModal() {
  const modal = document.querySelector("[data-login-modal]");
  if (!modal) return;

  document.querySelectorAll("[data-login-open]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      trackEvent("access_validation_open", getEventContext(button));
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
    });
  });

  document.querySelectorAll("[data-login-close]").forEach((button) => {
    button.addEventListener("click", () => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    });
  });

  modal.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = form.querySelector('input[type="email"]')?.value?.trim();
      const phone = form.querySelector('input[type="tel"]')?.value?.trim();
      await saveLead({ email, phone });
      trackEvent("lead_validation_requested", { email, phone });
      form.innerHTML = '<p class="form-status">Solicitud recibida. Te contactaremos para completar la validación.</p>';
    });
  });
}

function getVisitorId() {
  const key = "cd:visitor_id";
  let visitorId = localStorage.getItem(key);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(key, visitorId);
  }
  return visitorId;
}

function getEventContext(element) {
  const row = element.closest("a");
  return {
    label: row?.innerText?.trim() || element.textContent?.trim() || "",
    href: row?.getAttribute("href") || "",
  };
}

function initTracking() {
  const startedAt = Date.now();
  const visitorId = getVisitorId();
  let maxScroll = 0;

  trackEvent("page_view", { referrer: document.referrer, title: document.title });

  window.addEventListener(
    "scroll",
    () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      maxScroll = Math.max(maxScroll, total > 0 ? Math.round((window.scrollY / total) * 100) : 0);
    },
    { passive: true },
  );

  document.querySelectorAll("[data-track]").forEach((item) => {
    item.addEventListener("click", () => trackEvent(item.dataset.track, getEventContext(item)));
  });

  window.addEventListener("beforeunload", () => {
    const payload = {
      visitor_id: visitorId,
      page,
      path: location.pathname,
      seconds: Math.round((Date.now() - startedAt) / 1000),
      scroll_depth: maxScroll,
    };
    localStorage.setItem("cd:last_tracking", JSON.stringify(payload));
    trackEvent("read_session", payload, true);
  });
}

async function trackEvent(eventType, metadata = {}, useBeacon = false) {
  const event = {
    visitor_id: getVisitorId(),
    event_type: eventType,
    page,
    path: location.pathname,
    metadata,
    user_agent: navigator.userAgent,
  };

  const events = JSON.parse(localStorage.getItem("cd:events") || "[]");
  events.push({ ...event, at: new Date().toISOString() });
  localStorage.setItem("cd:events", JSON.stringify(events.slice(-100)));

  if (!supabaseClient) return;
  try {
    await supabaseClient.from("visitor_events").insert(event);
    await supabaseClient.rpc("register_visitor_touch", { p_visitor_id: event.visitor_id });
  } catch (_) {
    if (useBeacon) return;
  }
}

async function saveLead({ email, phone }) {
  if (!supabaseClient) return;
  const visitor_id = getVisitorId();
  await supabaseClient.from("visitor_profiles").upsert(
    {
      visitor_id,
      email,
      phone,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "visitor_id" },
  );
}

async function loadReports() {
  const container = document.querySelector("[data-reports]");
  const count = document.querySelector("[data-count]");
  if (!container) return;

  try {
    let reports = sampleReports;

    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from("radiografias")
        .select("titulo, provincia, localidad, fecha, html_url, pdf_url, created_at")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      reports = data || [];
    } else if (!RENDER_SAMPLE_DATA_WHEN_UNCONFIGURED) {
      reports = [];
    }

    renderReports(reports, container, count);
  } catch (error) {
    container.innerHTML = `<div class="empty-state">No pudimos cargar las radiografías. ${escapeHtml(error.message)}</div>`;
  }
}

function renderReports(reports, container, count) {
  if (count) count.textContent = `${reports.length} ${reports.length === 1 ? "radiografía" : "radiografías"}`;

  if (!reports.length) {
    container.innerHTML = '<div class="empty-state">Todavía no hay radiografías publicadas.</div>';
    return;
  }

  container.innerHTML = reports
    .map((report) => {
      const date = formatDate(report.fecha);
      const title = escapeHtml(report.titulo || "Radiografía sin título");
      const place = escapeHtml(report.localidad || report.provincia || "Territorio");
      const href = escapeAttribute(report.html_url || report.pdf_url || "#");
      const requestHref = buildPdfRequestLink(report);
      return `
        <article class="report-card">
          <div>
            <div class="report-meta">
              <span>${place}</span>
              <time datetime="${escapeAttribute(report.fecha || "")}">${date}</time>
            </div>
            <h2>${title}</h2>
          </div>
          <div class="report-actions">
            <a class="download-link" href="${href}" target="_blank" rel="noopener" download data-track="download_report">Descargar</a>
            <a class="request-link" href="${requestHref}" target="_blank" rel="noopener" data-track="request_pdf">Solicitar PDF</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function initAdmin() {
  const form = document.querySelector("[data-admin-form]");
  const status = document.querySelector("[data-form-status]");
  const submit = document.querySelector("[data-submit]");
  if (!form) return;

  if (!supabaseClient) {
    status.textContent = "Supabase todavía no está configurado. Edita assets/js/supabase-config.js para habilitar la carga.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      status.textContent = "Configura SUPABASE_URL y SUPABASE_ANON_KEY antes de guardar.";
      return;
    }

    const formData = new FormData(form);
    const file = formData.get("archivo");
    const titulo = String(formData.get("titulo") || "").trim();
    const provincia = String(formData.get("provincia") || "").trim();
    const localidad = String(formData.get("localidad") || "").trim();
    const fecha = String(formData.get("fecha") || "").trim();

    if (!file || !isHtmlFile(file)) {
      status.textContent = "Selecciona un archivo HTML válido.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Guardando...";
    status.textContent = "Subiendo HTML y publicando metadata.";

    try {
      const cleanName = file.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9.]+/g, "-")
        .replace(/-+/g, "-");
      const path = `${fecha}/${crypto.randomUUID()}-${cleanName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("radiografias")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: "text/html" });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseClient.storage.from("radiografias").getPublicUrl(path);
      const html_url = publicData.publicUrl;

      const { error: insertError } = await supabaseClient.from("radiografias").insert({
        titulo,
        provincia,
        localidad,
        fecha,
        html_url,
      });

      if (insertError) throw insertError;

      form.reset();
      status.innerHTML = `Radiografía publicada. <a href="${escapeAttribute(html_url)}" target="_blank" rel="noopener">Abrir HTML</a>`;
    } catch (error) {
      status.textContent = `No se pudo guardar: ${error.message}`;
    } finally {
      submit.disabled = false;
      submit.textContent = "Guardar radiografía";
    }
  });
}

function isHtmlFile(file) {
  const name = file.name.toLowerCase();
  return file.type === "text/html" || name.endsWith(".html") || name.endsWith(".htm");
}

function buildPdfRequestLink(report) {
  const title = report.titulo || "Radiografía";
  const place = report.localidad || report.provincia || "Territorio";
  const subject = encodeURIComponent(`Solicitud de PDF - ${title}`);
  const body = encodeURIComponent(`Solicito la versión PDF de la radiografía "${title}" (${place}). Formato solicitado: PDF.`);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=info.consultoradiagonales@gmail.com&su=${subject}&body=${body}`;
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
