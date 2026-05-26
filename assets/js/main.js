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
const ADMIN_SESSION_KEY = "cd:admin_unlocked";

initNavigation();
initLogoFallbacks();
initActiveNavigation();
initLoginModal();
initTracking();

if (page === "repo") loadReports();
if (page === "admin") initAdmin();
if (page === "registro") initRegistration();
if (page === "servicios") initServiceRequests();

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

function initServiceRequests() {
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

      window.open(`https://wa.me/5492214597940?text=${encodeURIComponent(message)}`, "_blank", "noopener");
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
  const sendCodeButton = document.querySelector("[data-send-whatsapp-code]");
  if (!form) return;

  if (!supabaseClient) {
    status.textContent = "Formulario listo en modo prueba. Conecta Supabase y las funciones de WhatsApp para enviar códigos reales.";
  }

  syncAuthContact(status);

  sendCodeButton?.addEventListener("click", async () => {
    const phone = getFormValue(form, "phone");
    const email = getFormValue(form, "email").toLowerCase();
    const fullName = getFormValue(form, "full_name");

    if (!phone) {
      status.textContent = "Ingresa un teléfono para enviar el código por WhatsApp.";
      return;
    }

    sendCodeButton.disabled = true;
    sendCodeButton.textContent = "Enviando...";
    status.textContent = "Solicitando código de WhatsApp.";

    try {
      await requestWhatsappCode({ phone, email, fullName });
      status.textContent = supabaseClient
        ? "Código solicitado. Revisá WhatsApp e ingresalo antes de descargar PDFs."
        : "Solicitud registrada en modo prueba. Conecta WhatsApp para enviar el código real.";
    } catch (error) {
      status.textContent = `No se pudo solicitar el código: ${error.message}`;
    } finally {
      sendCodeButton.disabled = false;
      sendCodeButton.textContent = "Enviar código";
    }
  });

  socialButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const provider = button.dataset.socialProvider;
      const phone = getFormValue(form, "phone");
      const email = getFormValue(form, "email").toLowerCase();
      const fullName = getFormValue(form, "full_name");
      const organization = getFormValue(form, "organization");

      if (!phone) {
        status.textContent = "Primero ingresa tu teléfono. Es obligatorio para validar por WhatsApp.";
        return;
      }

      if (!form.elements.terms.checked) {
        status.textContent = "Acepta el uso de datos para guardar el contacto y solicitar el código.";
        return;
      }

      try {
        const contact = buildContactProfile({ fullName, phone, email, organization, provider });
        persistLocalContact(contact);
        await upsertContact(contact);
        await requestWhatsappCode({ phone, email, fullName });

        if (provider === "tiktok") {
          status.textContent = "TikTok requiere configurarlo como OAuth/OIDC personalizado en Supabase. Dejamos el contacto guardado y el código solicitado.";
          return;
        }

        if (!supabaseClient) {
          status.textContent = "Contacto guardado. Configura Supabase Auth y WhatsApp para activar el ingreso social.";
          return;
        }

        const { error } = await supabaseClient.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${location.origin}${location.pathname}`,
          },
        });

        if (error) status.textContent = `No se pudo iniciar sesión con ${provider}: ${error.message}`;
      } catch (error) {
        status.textContent = `No se pudo iniciar el ingreso social: ${error.message}`;
      }
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = getFormValue(form, "full_name");
    const phone = getFormValue(form, "phone");
    const email = getFormValue(form, "email").toLowerCase();
    const organization = getFormValue(form, "organization");
    const whatsappCode = getFormValue(form, "whatsapp_code");

    if (!phone) {
      status.textContent = "El teléfono es obligatorio para validar por WhatsApp.";
      return;
    }

    if (!(await verifyWhatsappCode(phone, whatsappCode))) {
      status.textContent = "Solicita e ingresa el código de WhatsApp antes de continuar.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Validando...";
    status.textContent = "Validando teléfono y guardando contacto.";

    const profile = buildContactProfile({ fullName, phone, email, organization, provider: "email" });

    try {
      if (!supabaseClient) {
        const pending = JSON.parse(localStorage.getItem("cd:pending_registrations") || "[]");
        pending.push({ ...profile, created_at: new Date().toISOString() });
        localStorage.setItem("cd:pending_registrations", JSON.stringify(pending.slice(-50)));
        persistLocalContact(profile);
        trackEvent("registration_pending", { email, phone, organization });
        form.reset();
        status.textContent = "Contacto validado localmente. Conecta Supabase para habilitar descargas reales.";
        return;
      }

      const { data: sessionData } = await supabaseClient.auth.getSession();
      profile.auth_user_id = sessionData.session?.user?.id || null;
      await upsertContact(profile);
      await supabaseClient.from("visitor_profiles").upsert(
        {
          visitor_id: profile.visitor_id,
          email,
          phone,
          full_name: fullName,
          organization,
          social_provider: "email",
          auth_user_id: profile.auth_user_id,
          last_seen_at: new Date().toISOString(),
          tags: ["registro_pdf"],
        },
        { onConflict: "visitor_id" },
      );
      trackEvent("phone_access_validated", {
        email,
        phone,
        organization,
        user_id: profile.auth_user_id,
      });

      form.reset();
      status.textContent = "Teléfono validado. Ya podés descargar radiografías PDF.";
    } catch (error) {
      status.textContent = `No se pudo completar el acceso: ${error.message}`;
    } finally {
      submit.disabled = false;
      submit.textContent = "Validar acceso";
    }
  });
}

async function syncAuthContact(status) {
  if (!supabaseClient) return;

  const { data } = await supabaseClient.auth.getSession();
  const user = data.session?.user;
  if (!user) return;

  const contact = JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}");
  if (!contact.phone) {
    status.textContent = "Sesión iniciada. Ingresa tu teléfono para recibir el código de WhatsApp y descargar PDFs.";
    return;
  }

  const provider = user.app_metadata?.provider || contact.social_provider || "email";
  await upsertContact({
    ...contact,
    auth_user_id: user.id,
    email: user.email || contact.email,
    full_name: contact.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "",
    avatar_url: user.user_metadata?.avatar_url || contact.avatar_url || null,
    social_provider: provider,
    last_seen_at: new Date().toISOString(),
  });
  status.textContent = "Sesión iniciada. Validá el código de WhatsApp para descargar PDFs.";
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
    phone_validation_status: localStorage.getItem(PHONE_VERIFIED_KEY) === phone ? "verified" : "pending",
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

  if (!supabaseClient) return;

  const { data, error } = await supabaseClient.functions.invoke("send-whatsapp-code", { body: request });
  if (error) throw error;
  if (data?.verification_id) localStorage.setItem("cd:verification_id", data.verification_id);
}

function isPhoneVerified(phone, code) {
  if (localStorage.getItem(PHONE_VERIFIED_KEY) === phone) return true;
  if (!code) return false;

  const request = JSON.parse(localStorage.getItem("cd:last_whatsapp_request") || "{}");
  if (!supabaseClient && request.phone === phone) {
    localStorage.setItem(PHONE_VERIFIED_KEY, phone);
    return true;
  }

  return false;
}

async function verifyWhatsappCode(phone, code) {
  if (isPhoneVerified(phone, code)) return true;
  if (!supabaseClient || !code) return false;

  const { data, error } = await supabaseClient.functions.invoke("verify-whatsapp-code", {
    body: {
      visitor_id: getVisitorId(),
      verification_id: localStorage.getItem("cd:verification_id"),
      phone,
      code,
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
  return Boolean(contact.phone && localStorage.getItem(PHONE_VERIFIED_KEY) === contact.phone);
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
  if (!form) return;

  const unlockAdmin = () => {
    login?.classList.add("is-hidden");
    form.classList.remove("is-hidden");
  };

  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "true") {
    unlockAdmin();
  }

  login?.addEventListener("submit", (event) => {
    event.preventDefault();
    const expectedKey = window.CD_ADMIN?.uploadKey || "";
    const providedKey = getFormValue(login, "admin_key");

    if (!expectedKey || expectedKey === "CAMBIAR_CLAVE_ADMIN") {
      loginStatus.textContent = "Configura window.CD_ADMIN.uploadKey en assets/js/supabase-config.js.";
      return;
    }

    if (providedKey !== expectedKey) {
      loginStatus.textContent = "Clave incorrecta.";
      return;
    }

    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    login.reset();
    unlockAdmin();
  });

  if (!supabaseClient) {
    status.textContent = "Supabase todavía no está configurado. Edita assets/js/supabase-config.js para habilitar la carga.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      status.textContent = "Configura SUPABASE_URL y SUPABASE_ANON_KEY antes de guardar.";
      return;
    }

    if (sessionStorage.getItem(ADMIN_SESSION_KEY) !== "true") {
      status.textContent = "Ingresa la clave de administrador antes de publicar.";
      return;
    }

    const formData = new FormData(form);
    const file = formData.get("archivo");
    const titulo = String(formData.get("titulo") || "").trim();
    const provincia = String(formData.get("provincia") || "").trim();
    const localidad = String(formData.get("localidad") || "").trim();
    const fecha = String(formData.get("fecha") || "").trim();

    if (!file || !isPdfFile(file)) {
      status.textContent = "Selecciona un archivo PDF válido.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Guardando...";
    status.textContent = "Subiendo PDF y publicando metadata.";

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
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: "application/pdf" });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseClient.storage.from("radiografias").getPublicUrl(path);
      const pdf_url = publicData.publicUrl;

      const { error: insertError } = await supabaseClient.from("radiografias").insert({
        titulo,
        provincia,
        localidad,
        fecha,
        pdf_url,
      });

      if (insertError) throw insertError;

      await supabaseClient.from("admin_upload_events").insert({
        titulo,
        provincia,
        localidad,
        pdf_url,
        uploaded_by: "admin_key",
        user_agent: navigator.userAgent,
      });

      form.reset();
      status.innerHTML = `PDF publicado. <a href="${escapeAttribute(pdf_url)}" target="_blank" rel="noopener">Abrir PDF</a>`;
    } catch (error) {
      status.textContent = `No se pudo guardar: ${error.message}`;
    } finally {
      submit.disabled = false;
      submit.textContent = "Guardar PDF";
    }
  });
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
