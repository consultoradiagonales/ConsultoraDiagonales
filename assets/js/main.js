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
const CONTACT_STORAGE_KEY = "cd:contact";
const PHONE_VERIFIED_KEY = "cd:phone_verified";
const GMAIL_VERIFIED_KEY = "cd:gmail_verified";
const ADMIN_SESSION_KEY = "cd:admin_unlocked";
const ADMIN_UPLOAD_KEY = "cd:admin_upload_key";
let adminReports = [];

initNavigation();
initLogoFallbacks();
initActiveNavigation();
initFooterText();
initLoginModal();
initTracking();

if (page === "repo") initRepository();
if (page === "admin") initAdmin();
if (page === "registro") initRegistration();
if (page === "servicios") initServiceRequests();

async function initRepository() {
  await syncStoredAuthContact();
  await loadReports();
}

function initNavigation() {
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-mobile-menu]");

  const onScroll = () => {
    if (!header) return;
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

function initFooterText() {
  document.querySelectorAll(".site-footer").forEach((footer) => {
    footer.textContent = "© CONSULTORA DIAGONALES | Data Analytics.";
  });
}

function initServiceRequests() {
  const whatsappMessages = {
    territorial:
      "Hola Consultora Diagonales. Quiero solicitar un servicio de Inteligencia territorial. Necesito analizar un territorio, sus actores, dinámicas y escenarios para tomar mejores decisiones.",
    electoral:
      "Hola Consultora Diagonales. Quiero solicitar un servicio de Escenarios electorales. Necesito analizar tendencias, actores y proyecciones para un contexto electoral específico.",
    opinion:
      "Hola Consultora Diagonales. Quiero solicitar un servicio de Opinión pública. Necesito medir percepciones, comportamientos y clima social sobre un tema, actor o territorio.",
  };

  document.querySelectorAll("[data-service]").forEach((card) => {
    const message = whatsappMessages[card.dataset.service] || "Hola Consultora Diagonales. Quiero consultar por sus servicios.";
    const href = `https://wa.me/5492216765720?text=${encodeURIComponent(message)}`;
    card.setAttribute("href", href);
    card.addEventListener("click", (event) => {
      event.preventDefault();
      window.open(href, "_blank", "noopener");
    });
  });
  return;

  const serviceLabels = {
    territorial: "Inteligencia territorial",
    electoral: "Escenarios electorales",
    opinion: "Opinión pública",
  };
  const questionSets = {
    territorial: [
      "¿Sobre qué lugar querés hacer inteligencia territorial? Puede ser barrio, municipio, provincia, región o zona específica.",
      "¿Qué actores, dinámicas o conflictos territoriales querés que analicemos?",
      "¿Qué decisión necesitás tomar con ese análisis?",
    ],
    electoral: [
      "¿Qué zona querés analizar para ver el escenario electoral? Puede ser municipio, provincia, sección electoral o territorio específico.",
      "¿Qué elección, período o escenario querés proyectar?",
      "¿Qué actores, fuerzas políticas, candidatos o hipótesis querés comparar?",
    ],
    opinion: [
      "¿Querés analizar la opinión pública de un actor político, municipio, provincia, tema o humor social nacional?",
      "¿Cuál es el ámbito territorial del análisis: local, provincial o nacional?",
      "¿Qué percepción, comportamiento, imagen o clima social querés medir?",
    ],
  };

  document.querySelectorAll("[data-service]").forEach((card) => {
    card.addEventListener("click", (event) => {
      event.preventDefault();
      const service = card.dataset.service;
      const title = serviceLabels[service] || card.querySelector("h2")?.textContent?.trim() || "Servicio";
      const answers = [];

      for (const question of questionSets[service] || []) {
        const answer = window.prompt(question);
        if (answer === null) return;
        answers.push({ question, answer: answer.trim() || "A definir" });
      }

      const message = [
        `Necesito un análisis de: ${title}.`,
        "",
        "Datos para orientar el pedido:",
        ...answers.map((item) => `- ${item.question} ${item.answer}`),
      ].join("\n");

      window.open(`https://wa.me/5492216765720?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    });
  });
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
  const visitor_id = getVisitorId();
  const contact = {
    visitor_id,
    email,
    phone,
    access_reason: "lead_validation",
    phone_validation_status: "pending",
    last_seen_at: new Date().toISOString(),
  };
  persistLocalContact(contact);
  if (!supabaseClient) return;
  await supabaseClient.from("contactos").upsert(contact, { onConflict: "visitor_id" });
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

function getFormValue(form, name) {
  return String(new FormData(form).get(name) || "").trim();
}

async function initRegistration() {
  const form = document.querySelector("[data-registration-form]");
  const status = document.querySelector("[data-registration-status]");
  const submit = document.querySelector("[data-registration-submit]");
  const socialButtons = document.querySelectorAll("[data-social-provider]");
  if (!form) return;

  if (!supabaseClient) {
    status.textContent = "Falta conectar Supabase para validar el acceso con Gmail.";
  }

  await syncAuthContact(status);

  const startGmailValidation = async () => {
    const fullName = getFormValue(form, "full_name");
    const phone = getFormValue(form, "phone");
    const email = getFormValue(form, "email").toLowerCase();
    const organization = getFormValue(form, "organization");

    if (!fullName) {
      status.textContent = "Ingresa tu nombre y apellido para registrar el acceso.";
      return;
    }

    if (!phone) {
      status.textContent = "Ingresa tu celular. Es obligatorio antes de validar con Gmail.";
      return;
    }

    if (!form.elements.terms.checked) {
      status.textContent = "Acepta el uso de datos para guardar el contacto y habilitar descargas.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Abriendo Gmail...";
    status.textContent = "Guardando contacto y abriendo validación con Gmail.";

    try {
      const contact = buildContactProfile({ fullName, phone, email, organization, provider: "google" });
      contact.phone_validation_status = "gmail_pending";
      persistLocalContact(contact);
      await upsertContact(contact);
      await upsertVisitorProfile(contact);
      trackEvent("gmail_validation_requested", { email, phone, organization });

      if (!supabaseClient) {
        status.textContent = "Contacto guardado localmente. Falta conectar Supabase Auth para validar con Gmail.";
        submit.disabled = false;
        submit.textContent = "Continuar con Gmail";
        return;
      }

      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.href,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      status.textContent = `No se pudo iniciar Gmail: ${error.message}`;
      submit.disabled = false;
      submit.textContent = "Continuar con Gmail";
    }
  };

  socialButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.dataset.socialProvider === "google") await startGmailValidation();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await startGmailValidation();
  });
}

function getRegistrationRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  if (!next) return "../repositorio/index.html?v=gmail-validated";

  try {
    const target = new URL(next, window.location.href);
    if (target.origin !== window.location.origin) return "";
    return target.href;
  } catch (_) {
    return "";
  }
}

async function syncAuthContact(status) {
  if (!supabaseClient) return;

  const { data } = await supabaseClient.auth.getSession();
  const user = data.session?.user;
  if (!user) return;

  const contact = JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}");
  if (!contact.phone) {
    status.textContent = "Gmail validado. Ingresá tu celular para terminar de habilitar las descargas.";
    return;
  }

  const provider = user.app_metadata?.provider || contact.social_provider || "google";
  const verifiedContact = {
    ...contact,
    auth_user_id: user.id,
    email: user.email || contact.email,
    full_name: contact.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "",
    avatar_url: user.user_metadata?.avatar_url || contact.avatar_url || null,
    social_provider: provider,
    phone_validation_status: "gmail_verified",
    last_seen_at: new Date().toISOString(),
    tags: Array.from(new Set([...(contact.tags || []), "gmail_validado", "descarga_pdf"])),
  };

  localStorage.setItem(GMAIL_VERIFIED_KEY, verifiedContact.visitor_id);
  localStorage.setItem(PHONE_VERIFIED_KEY, verifiedContact.phone);
  await upsertContact(verifiedContact);
  await upsertVisitorProfile(verifiedContact);
  trackEvent("gmail_access_validated", {
    email: verifiedContact.email,
    phone: verifiedContact.phone,
    organization: verifiedContact.organization,
    user_id: verifiedContact.auth_user_id,
  });

  const redirectTarget = getRegistrationRedirectTarget();
  if (redirectTarget) {
    status.textContent = "Gmail validado. Te llevamos a las radiografías.";
    window.location.href = redirectTarget;
    return;
  }
  status.textContent = "Gmail validado. Ya podés descargar radiografías PDF.";
}

async function syncStoredAuthContact() {
  if (!supabaseClient) return null;

  const { data } = await supabaseClient.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;

  const contact = JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}");
  if (!contact.phone) return contact;

  const verifiedContact = {
    ...contact,
    auth_user_id: user.id,
    email: user.email || contact.email,
    full_name: contact.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "",
    avatar_url: user.user_metadata?.avatar_url || contact.avatar_url || null,
    social_provider: user.app_metadata?.provider || contact.social_provider || "google",
    phone_validation_status: "gmail_verified",
    last_seen_at: new Date().toISOString(),
    tags: Array.from(new Set([...(contact.tags || []), "gmail_validado", "descarga_pdf"])),
  };

  localStorage.setItem(GMAIL_VERIFIED_KEY, verifiedContact.visitor_id);
  localStorage.setItem(PHONE_VERIFIED_KEY, verifiedContact.phone);
  await upsertContact(verifiedContact);
  await upsertVisitorProfile(verifiedContact);
  return verifiedContact;
}

function buildContactProfile({ fullName, phone, email, organization, provider }) {
  return {
    visitor_id: getVisitorId(),
    auth_user_id: null,
    email,
    phone,
    full_name: fullName,
    organization,
    social_provider: provider,
    access_reason: "pdf_download",
    phone_validation_status: localStorage.getItem(GMAIL_VERIFIED_KEY) === getVisitorId() ? "gmail_verified" : "pending",
    consent_terms: true,
    last_seen_at: new Date().toISOString(),
    tags: ["descarga_pdf"],
  };
}

function persistLocalContact(contact) {
  const saved = {
    ...JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}"),
    ...contact,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(saved));
}

async function upsertContact(contact) {
  persistLocalContact(contact);
  if (!supabaseClient) return;
  await supabaseClient.from("contactos").upsert(contact, { onConflict: "visitor_id" });
}

async function upsertVisitorProfile(contact) {
  if (!supabaseClient) return;
  try {
    const payload = {
      email: contact.email || null,
      phone: contact.phone || null,
      full_name: contact.full_name || null,
      organization: contact.organization || null,
      social_provider: contact.social_provider || null,
      auth_user_id: contact.auth_user_id || null,
      avatar_url: contact.avatar_url || null,
      last_seen_at: new Date().toISOString(),
      tags: contact.tags || ["descarga_pdf"],
    };

    const { error } = await supabaseClient
      .from("visitor_profiles")
      .update(payload)
      .eq("visitor_id", contact.visitor_id);

    if (!error) return;
    await supabaseClient.from("visitor_profiles").insert({ visitor_id: contact.visitor_id, ...payload });
  } catch (_) {
    // El contacto y la descarga quedan registrados aunque el perfil agregado no pueda actualizarse por RLS.
  }
}

async function requestWhatsappCode({ phone, email, fullName }) {
  const request = {
    visitor_id: getVisitorId(),
    phone,
    email,
    full_name: fullName,
    channel: "whatsapp",
    purpose: "pdf_download",
  };

  localStorage.setItem("cd:last_whatsapp_request", JSON.stringify({ ...request, created_at: new Date().toISOString() }));

  if (!supabaseClient) throw new Error("Supabase no esta configurado.");

  localStorage.removeItem("cd:verification_id");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-code`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error === "WhatsApp secrets are not configured"
      ? "WhatsApp todavía no está configurado en el servidor. Falta cargar el token y el número de Meta en Supabase."
      : data.error || "No se pudo enviar el código de WhatsApp.";
    throw new Error(message);
  }
  if (!data?.verification_id) throw new Error("La funcion de WhatsApp no devolvio un identificador de verificacion.");
  localStorage.setItem("cd:verification_id", data.verification_id);
}

function isPhoneVerified(phone) {
  if (localStorage.getItem(PHONE_VERIFIED_KEY) === phone) return true;
  return false;
}

async function verifyWhatsappCode(phone, code) {
  if (isPhoneVerified(phone, code)) return true;
  const normalizedCode = String(code || "").replace(/\D/g, "");
  if (!supabaseClient || normalizedCode.length !== 6) return false;

  const { data, error } = await supabaseClient.functions.invoke("verify-whatsapp-code", {
    body: {
      visitor_id: getVisitorId(),
      verification_id: localStorage.getItem("cd:verification_id"),
      phone,
      code: normalizedCode,
      purpose: "pdf_download",
    },
  });

  if (error || !data?.verified) return false;
  localStorage.setItem(PHONE_VERIFIED_KEY, phone);
  return true;
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
        .select("id, titulo, provincia, localidad, fecha, html_url, pdf_url, created_at")
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
  if (count) count.textContent = `Total cargadas: ${reports.length}`;

  if (!reports.length) {
    container.innerHTML = '<div class="empty-state">Todavía no hay radiografías publicadas.</div>';
    return;
  }

  const isCompactList = container.classList.contains("latest-list");

  container.innerHTML = reports
    .map((report, index) => {
      const date = formatDate(report.fecha);
      const title = escapeHtml(report.titulo || "Radiografía sin título");
      const place = escapeHtml(report.localidad || report.provincia || "Territorio");
      const href = escapeAttribute(report.html_url || "#");
      const pdfHref = escapeAttribute(getPdfDownloadHref(report));
      const pdfLabel = hasPdfAccess() && report.pdf_url ? "Abrir PDF" : "Validar acceso";

      if (isCompactList) {
        return `
          <a href="${pdfHref}" data-pdf-download data-report-index="${index}" data-track="request_pdf">
            <time datetime="${escapeAttribute(report.fecha || "")}">${date}</time>
            <span>${title}</span>
            <strong>${pdfLabel}</strong>
          </a>
        `;
      }

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
            <a class="download-link" href="${href}" target="_blank" rel="noopener" data-track="open_report">Ver informe</a>
            <a class="request-link" href="${pdfHref}" data-pdf-download data-report-index="${index}" data-track="request_pdf">${pdfLabel}</a>
          </div>
        </article>
      `;
    })
    .join("");

  bindPdfDownloadLinks(container, reports);
}

function hasPdfAccess() {
  const contact = JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}");
  const gmailValidated = localStorage.getItem(GMAIL_VERIFIED_KEY) === contact.visitor_id;
  const phoneValidated = localStorage.getItem(PHONE_VERIFIED_KEY) === contact.phone;
  return Boolean(contact.phone && (gmailValidated || phoneValidated || contact.phone_validation_status === "gmail_verified"));
}

function getPdfDownloadHref(report) {
  if (hasPdfAccess() && report.pdf_url) return report.pdf_url;
  const title = encodeURIComponent(report.titulo || "Radiografia");
  const next = encodeURIComponent(location.href);
  return `../registro/index.html?pdf=${title}&next=${next}`;
}

function bindPdfDownloadLinks(container, reports) {
  container.querySelectorAll("[data-pdf-download]").forEach((link) => {
    link.addEventListener("click", async (event) => {
      const report = reports[Number(link.dataset.reportIndex)];
      if (!report || !hasPdfAccess() || !report.pdf_url) return;

      event.preventDefault();
      logPdfDownload(report);
      window.open(report.pdf_url, "_blank", "noopener");
    });
  });
}

async function logPdfDownload(report) {
  const contact = JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}");
  const payload = {
    visitor_id: getVisitorId(),
    radiografia_id: report.id || null,
    pdf_url: report.pdf_url,
    email: contact.email || null,
    phone: contact.phone || null,
    full_name: contact.full_name || null,
    lugar: report.localidad || report.provincia || null,
    provincia: report.provincia || null,
    localidad: report.localidad || null,
    user_agent: navigator.userAgent,
  };

  trackEvent("download_report", {
    title: report.titulo,
    pdf_url: report.pdf_url,
    lugar: payload.lugar,
    email: payload.email,
    phone: payload.phone,
  });

  if (!supabaseClient) {
    const downloads = JSON.parse(localStorage.getItem("cd:pdf_downloads") || "[]");
    downloads.push({ ...payload, created_at: new Date().toISOString() });
    localStorage.setItem("cd:pdf_downloads", JSON.stringify(downloads.slice(-100)));
    return;
  }

  try {
    await supabaseClient.from("pdf_downloads").insert(payload);
  } catch (error) {
    console.warn("No se pudo registrar la descarga PDF", error);
  }
}

function initAdmin() {
  const form = document.querySelector("[data-admin-form]");
  const login = document.querySelector("[data-admin-login]");
  const loginStatus = document.querySelector("[data-admin-login-status]");
  const status = document.querySelector("[data-form-status]");
  const submit = document.querySelector("[data-submit]");
  const dashboard = document.querySelector("[data-admin-dashboard]");
  const refresh = document.querySelector("[data-admin-refresh]");
  const cancelEdit = document.querySelector("[data-admin-cancel-edit]");
  if (!form) return;

  const unlockAdmin = () => {
    login?.classList.add("is-hidden");
    form.classList.remove("is-hidden");
    dashboard?.classList.remove("is-hidden");
    loadAdminDashboard();
  };

  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "true" && sessionStorage.getItem(ADMIN_UPLOAD_KEY)) {
    unlockAdmin();
  } else {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_UPLOAD_KEY);
  }

  login?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const providedKey = getFormValue(login, "admin_key");
    const normalizedKey = normalizeAdminKey(providedKey);

    if (!providedKey) {
      loginStatus.textContent = "Ingresa la clave de administrador.";
      return;
    }

    if (!supabaseClient) {
      loginStatus.textContent = "Supabase no está disponible en esta pestaña.";
      return;
    }

    const submitButton = login.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    loginStatus.textContent = "Validando clave.";

    try {
      await fetchAdminDashboard(normalizedKey);
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
      sessionStorage.setItem(ADMIN_UPLOAD_KEY, normalizedKey);
      login.reset();
      loginStatus.textContent = "";
      unlockAdmin();
    } catch (error) {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem(ADMIN_UPLOAD_KEY);
      loginStatus.textContent = error.message.includes("unauthorized") ? "Clave incorrecta." : `No se pudo validar: ${error.message}`;
    } finally {
      submitButton.disabled = false;
    }
  });

  if (!supabaseClient) {
    status.textContent = "Supabase todavía no está configurado. Edita assets/js/supabase-config.js para habilitar la carga.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      status.textContent = "Supabase no está disponible en esta pestaña. Recargá el admin conectado.";
      return;
    }

    if (sessionStorage.getItem(ADMIN_SESSION_KEY) !== "true") {
      status.textContent = "Ingresa la clave de administrador antes de publicar.";
      return;
    }

    const formData = new FormData(form);
    const id = String(formData.get("id") || "").trim();
    const file = formData.get("archivo");
    const titulo = String(formData.get("titulo") || "").trim();
    const provincia = String(formData.get("provincia") || "").trim();
    const localidad = String(formData.get("localidad") || "").trim();
    const fecha = String(formData.get("fecha") || "").trim();

    if (!id && (!file || !isPdfFile(file))) {
      status.textContent = "Selecciona un archivo PDF válido.";
      return;
    }

    if (id && file?.size && !isPdfFile(file)) {
      status.textContent = "Selecciona un archivo PDF válido o deja el archivo vacío para conservar el actual.";
      return;
    }

    submit.disabled = true;
    submit.textContent = id ? "Actualizando..." : "Guardando...";
    status.textContent = id ? "Actualizando radiografía." : "Subiendo PDF y publicando metadata.";

    try {
      const { pdf_url } = await saveRadiografiaReport({ id, file, titulo, provincia, localidad, fecha });

      resetAdminForm();
      status.innerHTML = id
        ? `Radiografía actualizada. ${pdf_url ? `<a href="${escapeAttribute(pdf_url)}" target="_blank" rel="noopener">Abrir PDF</a>` : ""}`
        : `PDF publicado. <a href="${escapeAttribute(pdf_url)}" target="_blank" rel="noopener">Abrir PDF</a>`;
      loadAdminDashboard();
    } catch (error) {
      status.textContent = `No se pudo guardar: ${error.message}`;
    } finally {
      submit.disabled = false;
      submit.textContent = form.elements.id.value ? "Actualizar PDF" : "Guardar PDF";
    }
  });

  refresh?.addEventListener("click", loadAdminDashboard);
  cancelEdit?.addEventListener("click", resetAdminForm);

  document.querySelector("[data-admin-reports]")?.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-admin-edit]");
    const deleteButton = event.target.closest("[data-admin-delete]");
    if (editButton) {
      const report = adminReports.find((item) => item.id === editButton.dataset.adminEdit);
      if (report) fillAdminEditForm(report);
      return;
    }

    if (!deleteButton) return;
    const report = adminReports.find((item) => item.id === deleteButton.dataset.adminDelete);
    if (!report) return;
    const confirmed = window.confirm(`¿Borrar "${report.titulo || "esta radiografía"}"? Esta acción elimina la metadata y el PDF del bucket.`);
    if (!confirmed) return;

    deleteButton.disabled = true;
    status.textContent = "Borrando radiografía.";
    try {
      await deleteRadiografiaReport(report.id);
      if (form.elements.id.value === report.id) resetAdminForm();
      status.textContent = "Radiografía borrada.";
      loadAdminDashboard();
    } catch (error) {
      status.textContent = `No se pudo borrar: ${error.message}`;
    } finally {
      deleteButton.disabled = false;
    }
  });
}

function normalizeAdminKey(value) {
  return String(value || "").trim();
}

function resetAdminForm() {
  const form = document.querySelector("[data-admin-form]");
  const submit = document.querySelector("[data-submit]");
  const cancelEdit = document.querySelector("[data-admin-cancel-edit]");
  if (!form) return;
  form.reset();
  form.elements.id.value = "";
  form.querySelector('[name="archivo"]')?.setAttribute("required", "required");
  if (submit) submit.textContent = "Guardar PDF";
  const status = document.querySelector("[data-form-status]");
  if (status) status.textContent = "";
  cancelEdit?.classList.add("is-hidden");
}

function fillAdminEditForm(report) {
  const form = document.querySelector("[data-admin-form]");
  const submit = document.querySelector("[data-submit]");
  const cancelEdit = document.querySelector("[data-admin-cancel-edit]");
  const status = document.querySelector("[data-form-status]");
  if (!form) return;
  form.elements.id.value = report.id || "";
  form.elements.titulo.value = report.titulo || "";
  form.elements.provincia.value = report.provincia || "";
  form.elements.localidad.value = report.localidad || "";
  form.elements.fecha.value = report.fecha || "";
  form.querySelector('[name="archivo"]')?.removeAttribute("required");
  if (submit) submit.textContent = "Actualizar radiografía";
  if (status) status.textContent = "Editando radiografía: podés cambiar el título/datos o seleccionar otro PDF para reemplazar el archivo actual.";
  cancelEdit?.classList.remove("is-hidden");
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function loadAdminDashboard() {
  const dashboard = document.querySelector("[data-admin-dashboard]");
  if (!dashboard || dashboard.classList.contains("is-hidden")) return;

  const containers = {
    reports: document.querySelector("[data-admin-reports]"),
    downloads: document.querySelector("[data-admin-downloads]"),
    contacts: document.querySelector("[data-admin-contacts]"),
    events: document.querySelector("[data-admin-events]"),
  };

  setAdminDashboardStatus("Cargando radiografías/PDF.");
  renderAdminList(containers.reports, [], "Cargando radiografías/PDF.");

  if (!supabaseClient) {
    setAdminDashboardStatus("Supabase no está configurado para cargar radiografías.");
    renderAdminList(containers.reports, [], "Configura Supabase para ver radiografías cargadas.");
    renderAdminList(containers.downloads, JSON.parse(localStorage.getItem("cd:pdf_downloads") || "[]").slice(-8).reverse(), "Sin consumos locales.");
    renderAdminList(containers.contacts, [JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}")].filter((item) => item.phone || item.email), "Sin contactos locales.");
    renderAdminList(containers.events, JSON.parse(localStorage.getItem("cd:events") || "[]").slice(-12).reverse(), "Sin eventos locales.");
    return;
  }

  try {
    const data = await fetchAdminDashboard();
    adminReports = data.reports || [];
    setAdminTotal("reports", data.totals?.reports ?? adminReports.length);
    setAdminTotal("downloads", data.totals?.downloads ?? data.downloads?.length ?? 0);
    setAdminTotal("contacts", data.totals?.contacts ?? data.contacts?.length ?? 0);
    setAdminTotal("events", data.totals?.events ?? data.events?.length ?? 0);
    renderAdminList(containers.reports, data.reports || [], "Todavía no hay radiografías cargadas.", renderAdminReportItem);
    setAdminDashboardStatus(`${adminReports.length} radiografía${adminReports.length === 1 ? "" : "s"}/PDF cargado${adminReports.length === 1 ? "" : "s"}.`);
    renderAdminList(containers.downloads, data.downloads || [], "Todavía no hay descargas registradas.", renderAdminDownloadItem);
    renderAdminList(containers.contacts, data.contacts || [], "Todavía no hay contactos.", renderAdminContactItem);
    renderAdminList(containers.events, data.events || [], "Todavía no hay eventos.", renderAdminEventItem);
  } catch (error) {
    setAdminDashboardStatus(`No se pudo cargar el listado: ${error.message}`);
    Object.values(containers).forEach((container) => renderAdminList(container, [], `No se pudo cargar: ${error.message}`));
  }
}

function setAdminDashboardStatus(message) {
  const target = document.querySelector("[data-admin-dashboard-status]");
  if (target) target.textContent = message;
}

async function fetchAdminDashboard(adminKey = sessionStorage.getItem(ADMIN_UPLOAD_KEY) || "") {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-dashboard`, {
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "x-admin-key": adminKey,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo cargar el tablero.");
  return data;
}

function setAdminTotal(key, value) {
  const target = document.querySelector(`[data-admin-total="${key}"]`);
  if (target) target.textContent = String(value);
}

function renderAdminList(container, items, emptyText, renderer = renderGenericAdminItem) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<p class="admin-list-empty">${escapeHtml(emptyText)}</p>`;
    return;
  }
  container.innerHTML = items.map(renderer).join("");
}

function renderGenericAdminItem(item) {
  return `<div class="admin-list-item"><strong>${escapeHtml(item.titulo || item.full_name || item.event_type || "Registro")}</strong><small>${escapeHtml(item.created_at || item.last_seen_at || "")}</small></div>`;
}

function renderAdminReportItem(item) {
  return `
    <div class="admin-list-item">
      <strong>${escapeHtml(item.titulo || "Radiografía sin título")}</strong>
      <span>${escapeHtml([item.localidad, item.provincia].filter(Boolean).join(", ") || "Territorio")}</span>
      ${item.file_name ? `<span>Archivo: ${escapeHtml(item.file_name)}</span>` : ""}
      <small>${escapeHtml(item.fecha || item.created_at || "")}</small>
      <div class="admin-list-actions">
        ${item.pdf_url ? `<a class="admin-action-button" href="${escapeAttribute(item.pdf_url)}" target="_blank" rel="noopener">Abrir PDF</a>` : ""}
        <button class="admin-action-button" type="button" data-admin-edit="${escapeAttribute(item.id || "")}">Modificar datos / reemplazar PDF</button>
        <button class="admin-action-button is-danger" type="button" data-admin-delete="${escapeAttribute(item.id || "")}">Borrar PDF</button>
      </div>
    </div>
  `;
}

function renderAdminDownloadItem(item) {
  return `
    <div class="admin-list-item">
      <strong>${escapeHtml(item.full_name || item.email || item.phone || "Usuario validado")}</strong>
      <span>${escapeHtml(item.lugar || item.provincia || "PDF")}</span>
      <small>${escapeHtml(item.downloaded_at || item.created_at || "")}</small>
    </div>
  `;
}

function renderAdminContactItem(item) {
  return `
    <div class="admin-list-item">
      <strong>${escapeHtml(item.full_name || item.email || item.phone || "Contacto")}</strong>
      <span>${escapeHtml([item.organization, item.phone_validation_status].filter(Boolean).join(" | "))}</span>
      <small>${escapeHtml(item.last_seen_at || item.created_at || "")}</small>
    </div>
  `;
}

function renderAdminEventItem(item) {
  return `
    <div class="admin-list-item">
      <strong>${escapeHtml(item.event_type || "Evento")}</strong>
      <span>${escapeHtml([item.page, item.path].filter(Boolean).join(" | "))}</span>
      <small>${escapeHtml(item.created_at || "")}</small>
    </div>
  `;
}

async function saveRadiografiaReport({ id, file, titulo, provincia, localidad, fecha }) {
  if (id) return updateRadiografiaReport({ id, file, titulo, provincia, localidad, fecha });
  return uploadRadiografiaPdf({ file, titulo, provincia, localidad, fecha });
}

async function updateRadiografiaReport({ id, file, titulo, provincia, localidad, fecha }) {
  const adminKey = sessionStorage.getItem(ADMIN_UPLOAD_KEY) || "";
  const formData = new FormData();
  formData.append("id", id);
  formData.append("titulo", titulo);
  formData.append("provincia", provincia);
  formData.append("localidad", localidad);
  formData.append("fecha", fecha);
  if (file?.size) formData.append("archivo", file);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-upload-report`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "x-admin-key": adminKey,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo actualizar la radiografía.");
  return data;
}

async function deleteRadiografiaReport(id) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-upload-report?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "x-admin-key": sessionStorage.getItem(ADMIN_UPLOAD_KEY) || "",
      "content-type": "application/json",
    },
    body: JSON.stringify({ id }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo borrar la radiografía.");
  return data;
}

async function uploadRadiografiaPdf({ file, titulo, provincia, localidad, fecha }) {
  if (window.CD_ADMIN?.useEdgeUpload === false) {
    throw new Error("La carga directa desde el navegador está deshabilitada. Usá la Edge Function admin-upload-report.");
  }

    const adminKey = sessionStorage.getItem(ADMIN_UPLOAD_KEY) || "";
    const formData = new FormData();
    formData.append("archivo", file);
    formData.append("titulo", titulo);
    formData.append("provincia", provincia);
    formData.append("localidad", localidad);
    formData.append("fecha", fecha);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-upload-report`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        "x-admin-key": adminKey,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No se pudo publicar el PDF.");
    return data;
}

function isPdfFile(file) {
  const name = file.name.toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
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
