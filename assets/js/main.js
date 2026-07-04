const SUPABASE_URL = window.CD_SUPABASE?.url || "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = window.CD_SUPABASE?.anonKey || "TU_SUPABASE_ANON_KEY";
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
const TRACKING_SESSION_KEY = "cd:tracking_session";
const PRIVATE_REPORT_REGISTRATION_KEY = "cd:private_report_after_registration";
const PRIVATE_REPORT_REGISTRATION_TARGET_KEY = "cd:private_report_after_registration_target";
const LEGACY_PRIVATE_MARKER = "[[CD_PRIVATE]]";
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
let adminReports = [];
const reportSpeechState = { chunks: [], index: 0, button: null, reading: false };

initNavigation();
initLogoFallbacks();
initActiveNavigation();
initFooterText();
initLoginModal();
initTracking();
initLeadForms();
initHtmlReportViewer();
initHtmlVoiceBridgeMessages();

if (page === "repo" || page === "analisis") initRepository();
if (page === "admin") initAdmin();
if (page === "registro") initRegistration();
if (page === "solicitudes") initRequestGenerator();

async function initRepository() {
  try {
    await withTimeout(syncStoredAuthContact(), 2500);
  } catch (error) {
    console.warn("No se pudo sincronizar la sesion antes de cargar radiografias", error);
  }
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
  const key = page === "repo" ? "radiografias" : page === "home" ? "inicio" : page === "solicitudes" ? "servicios" : page;
  document.querySelectorAll(`[data-nav="${key}"]`).forEach((link) => link.classList.add("is-active"));
}

function initFooterText() {
  document.querySelectorAll(".site-footer").forEach((footer) => {
    footer.textContent = "\u00a9 CONSULTORA DIAGONALES | Data Analytics.";
  });
}

function initRequestGenerator() {
  const form = document.querySelector("[data-request-form]");
  const output = document.querySelector("[data-request-output]");
  const briefTarget = document.querySelector("[data-request-brief]");
  const whatsapp = document.querySelector("[data-request-whatsapp]");
  const email = document.querySelector("[data-request-email]");
  const copy = document.querySelector("[data-request-copy]");
  const status = document.querySelector("[data-request-status]");
  const costModal = document.querySelector("[data-request-cost-modal]");
  const costClose = document.querySelector("[data-request-cost-close]");
  if (!form || !output || !briefTarget) return;

  const getValue = (name) => String(new FormData(form).get(name) || "").trim();
  const getValues = (name) => Array.from(new FormData(form).getAll(name)).map((value) => String(value).trim()).filter(Boolean);
  const labelSeparator = `${String.fromCharCode(58)}${String.fromCharCode(32)}`;
  const typeSeparator = `${String.fromCharCode(32)}${String.fromCharCode(43)}${String.fromCharCode(32)}`;
  const line = (label, value) => `${label}${labelSeparator}${value || "A definir"}`;
  const getRequestTypes = () => getValues("request_type");
  let previousTypeCount = getRequestTypes().length;

  const showCostModal = () => {
    if (!costModal) return;
    costModal.hidden = false;
    costModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    costClose?.focus();
  };

  const hideCostModal = () => {
    if (!costModal) return;
    costModal.hidden = true;
    costModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  const buildBrief = () => {
    const types = getRequestTypes();
    const type = types.join(typeSeparator) || "Solicitud estrategica";
    const fullName = getValue("full_name");
    const organization = getValue("organization");
    const phone = getValue("phone");
    const emailValue = getValue("email");
    const target = getValue("target");
    const territory = getValue("territory");
    const horizon = getValue("time_horizon");
    const urgency = getValue("urgency");
    const deliverable = getValue("deliverable");
    const decision = getValue("decision");
    const context = getValue("context");
    const sources = getValue("sources");
    const publishAuthorization = form.elements.publish_authorization?.checked ? "Si" : "No";

    return {
      type,
      target,
      territory,
      fullName,
      organization,
      phone,
      email: emailValue,
      horizon,
      urgency,
      deliverable,
      publishAuthorization,
      brief: [
        "Solicitud para Consultora Diagonales",
        "",
        line("Tipo de trabajo", type),
        line("Foco de analisis", target),
        line("Territorio o mercado", territory),
        line("Horizonte", horizon),
        line("Prioridad", urgency),
        line("Entrega esperada", deliverable),
        "",
        line("Decision a tomar", decision),
        line("Contexto sensible", context),
        line("Fuentes disponibles", sources),
        line("Autoriza publicacion en repositorio", publishAuthorization),
        "",
        line("Solicitante", fullName),
        line("Organizacion", organization),
        line("Celular", phone),
        line("Email", emailValue),
      ].join("\n"),
    };
  };

  const publishBrief = async () => {
    const request = buildBrief();
    const subject = `Solicitud - ${request.type} - ${request.target || "Consultora Diagonales"}`;
    const encodedBrief = encodeURIComponent(request.brief);

    briefTarget.textContent = request.brief;
    if (whatsapp) whatsapp.href = `https://wa.me/5492216765720?text=${encodedBrief}`;
    if (email) {
      email.href = `https://mail.google.com/mail/?view=cm&fs=1&to=info.consultoradiagonales@gmail.com&su=${encodeURIComponent(subject)}&body=${encodedBrief}`;
    }

    output.hidden = false;
    output.scrollIntoView({ behavior: "smooth", block: "start" });
    if (status) status.textContent = "Solicitud generada.";

    try {
      await saveLead({
        email: request.email.toLowerCase(),
        phone: request.phone,
        fullName: request.fullName,
        organization: request.organization,
        interest: `${request.type}: ${request.target || request.territory || "A definir"}`,
      });
      await trackEvent("request_brief_generated", {
        request_type: request.type,
        target: request.target,
        territory: request.territory,
        horizon: request.horizon,
        urgency: request.urgency,
        deliverable: request.deliverable,
      });
    } catch (error) {
      console.warn("No se pudo guardar la solicitud", error);
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!getRequestTypes().length) {
      if (status) status.textContent = "Selecciona al menos un tipo de trabajo.";
      return;
    }
    if (!form.reportValidity()) return;
    await publishBrief();
  });

  form.querySelectorAll('[name="request_type"]').forEach((input) => {
    input.addEventListener("change", () => {
      const typeCount = getRequestTypes().length;
      if (typeCount > 1 && previousTypeCount <= 1) showCostModal();
      previousTypeCount = typeCount;
    });
  });

  costClose?.addEventListener("click", hideCostModal);
  costModal?.addEventListener("click", (event) => {
    if (event.target === costModal) hideCostModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && costModal && !costModal.hidden) hideCostModal();
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      output.hidden = true;
      briefTarget.textContent = "";
      previousTypeCount = getRequestTypes().length;
      if (status) status.textContent = "";
    }, 0);
  });

  copy?.addEventListener("click", async () => {
    const brief = briefTarget.textContent.trim();
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief);
      if (status) status.textContent = "Brief copiado.";
    } catch (_) {
      if (status) status.textContent = "Selecciona el texto del brief para copiarlo.";
    }
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
    visitorId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, visitorId);
  }
  return visitorId;
}

function getTrackingSessionId() {
  let sessionId = sessionStorage.getItem(TRACKING_SESSION_KEY);
  if (!sessionId) {
    sessionId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(TRACKING_SESSION_KEY, sessionId);
  }
  return sessionId;
}

function getCurrentPageTitle() {
  const heading = document.querySelector("h1")?.textContent?.trim();
  return heading || document.title || document.body.dataset.page || location.pathname;
}

function buildPageTrackingContext() {
  return {
    session_id: getTrackingSessionId(),
    page_key: page || "sin_pagina",
    page_title: getCurrentPageTitle(),
    document_title: document.title,
    path: location.pathname,
    search: location.search || "",
    url: location.href,
    referrer: document.referrer || "",
  };
}

function withTimeout(promise, milliseconds) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("timeout")), milliseconds);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
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

  trackEvent("page_view", { title: getCurrentPageTitle() });

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
  const event = buildVisitorEvent(eventType, metadata);

  const events = JSON.parse(localStorage.getItem("cd:events") || "[]");
  events.push({ ...event, at: new Date().toISOString() });
  localStorage.setItem("cd:events", JSON.stringify(events.slice(-100)));

  if (!supabaseClient) return;
  try {
    await persistVisitorEvent(event, useBeacon);
  } catch (_) {
    if (useBeacon) return;
  }
}

function buildVisitorEvent(eventType, metadata = {}) {
  const contact = getStoredContactSummary();
  return {
    visitor_id: getVisitorId(),
    event_type: eventType,
    page,
    path: location.pathname,
    metadata: {
      ...buildPageTrackingContext(),
      ...metadata,
      contact,
    },
    user_agent: navigator.userAgent,
  };
}

function getStoredContactSummary() {
  const contact = JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}");
  return {
    visitor_id: getVisitorId(),
    email: contact.email || null,
    phone: contact.phone || null,
    full_name: contact.full_name || null,
    organization: contact.organization || null,
    phone_validation_status: contact.phone_validation_status || null,
  };
}

async function persistVisitorEvent(event, keepalive = false) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/track-visitor-event`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(event),
    keepalive,
  });
  if (!response.ok) throw new Error(`tracking ${response.status}`);
}

function initLeadForms() {
  document.querySelectorAll("[data-lead-form]").forEach((form) => {
    const status = form.querySelector("[data-lead-status]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const fullName = getFormValue(form, "full_name");
      const phone = getFormValue(form, "phone");
      const email = getFormValue(form, "email").toLowerCase();
      const organization = getFormValue(form, "organization");
      const interest = getFormValue(form, "interest");

      if (!fullName || !phone) {
        if (status) status.textContent = "Dejanos nombre y celular para poder contactarte.";
        return;
      }

      submit.disabled = true;
      if (status) status.textContent = "Guardando consulta.";
      try {
        await saveLead({ email, phone, fullName, organization, interest });
        trackEvent("lead_form_submitted", { email, phone, fullName, organization, interest });
        form.reset();
        if (status) status.textContent = "Consulta guardada. Te vamos a contactar.";
      } catch (error) {
        if (status) status.textContent = `No se pudo guardar: ${error.message}`;
      } finally {
        submit.disabled = false;
      }
    });
  });
}

async function saveLead({ email, phone, fullName = "", organization = "", interest = "" }) {
  const visitor_id = getVisitorId();
  const contact = {
    visitor_id,
    email,
    phone,
    full_name: fullName,
    organization,
    access_reason: "lead_validation",
    phone_validation_status: "pending",
    consent_terms: true,
    last_seen_at: new Date().toISOString(),
    tags: Array.from(new Set(["lead_web", interest].filter(Boolean))),
  };
  persistLocalContact(contact);
  if (!supabaseClient) return;
  await supabaseClient.from("contactos").upsert(contact, { onConflict: "visitor_id" });
  await supabaseClient.from("visitor_profiles").upsert(
    {
      visitor_id,
      email,
      phone,
      full_name: fullName,
      organization,
      last_seen_at: new Date().toISOString(),
      tags: contact.tags,
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
    let reports = [];

    if (supabaseClient) {
      let { data, error } = await supabaseClient
        .from("radiografias")
        .select("id, titulo, provincia, localidad, fecha, html_url, pdf_url, is_private, created_at")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });

      if (isMissingColumnError(error, "is_private")) {
        ({ data, error } = await supabaseClient
          .from("radiografias")
          .select("id, titulo, provincia, localidad, fecha, html_url, pdf_url, created_at")
          .order("fecha", { ascending: false })
          .order("created_at", { ascending: false }));
      }

      if (error) throw error;
      reports = (data || []).map(normalizeReportRecord);
    }

    renderReports(reports, container, count);
  } catch (error) {
    container.innerHTML = `<div class="empty-state">No pudimos cargar las radiografías. ${escapeHtml(error.message)}</div>`;
  }
}

function renderReports(reports, container, count) {
  if (count) count.textContent = `Total cargadas: ${reports.length}`;
  window.CD_REPORTS = reports;

  if (!reports.length) {
    container.innerHTML = '<div class="empty-state">Todavía no hay radiografías publicadas.</div>';
    return;
  }

  const isCompactList = container.classList.contains("latest-list");

  container.innerHTML = reports
    .map((report, index) => {
      const date = formatDate(report.fecha);
      const title = escapeHtml(report.titulo || "Radiografía sin título");
      const place = escapeHtml(cleanLegacyPrivateMarker(report.localidad || report.provincia || "Territorio"));
      const graphsUrl = getReportGraphsUrl(report);
      const isPrivate = isPrivateReport(report);
      const graphsHref = escapeAttribute(getReportResourceHref(report, "html", graphsUrl));
      const pdfHref = escapeAttribute(getReportResourceHref(report, "pdf", report.pdf_url));
      const privacyBadge = isPrivate ? '<em class="report-privacy-badge">Privado</em>' : "";
      const pdfLabel = isPrivate ? "Solicitar acceso" : (report.pdf_url ? "Abrir PDF" : "PDF no disponible");
      const reportIndexAttribute = ` data-report-index="${index}"`;
      const privateAttribute = isPrivate
        ? ` data-private-report="true" data-report-id="${escapeAttribute(report.id || "")}" data-private-title="${escapeAttribute(report.titulo || "")}"${report.pdf_url ? "" : ' data-pdf-unavailable="true"'}`
        : "";
      const graphsAttribute = graphsUrl ? ` data-graphs-url="${graphsHref}"` : "";

      if (isCompactList) {
        return `
          <a href="${pdfHref}"${reportIndexAttribute}${graphsAttribute}${privateAttribute} data-pdf-download data-track="request_pdf">
            <time datetime="${escapeAttribute(report.fecha || "")}">${date}</time>
            <span>${title}${privacyBadge}</span>
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
            ${privacyBadge}
          </div>
          <div class="report-actions">
            ${graphsUrl ? `<a class="download-link graph-link" href="${graphsHref}"${privateAttribute} data-html-viewer-open data-report-open data-report-index="${index}" data-track="open_graph">GrÃ¡ficos</a>` : ""}
            <a class="request-link" href="${pdfHref}"${privateAttribute} data-pdf-download data-report-index="${index}" data-track="request_pdf">${pdfLabel}</a>
          </div>
        </article>
      `;
    })
    .join("");

  bindPdfDownloadLinks(container, reports);
  bindReportOpenLinks(container, reports);
  openPendingPrivateReport(reports);
}

function openUrlViewer(url, title, label = "Contenido") {
  let viewer = document.querySelector("[data-url-viewer]");
  if (!viewer) {
    viewer = document.createElement("div");
    viewer.className = "html-viewer";
    viewer.setAttribute("data-url-viewer", "");
    viewer.setAttribute("aria-hidden", "true");
    viewer.innerHTML = `
      <div class="html-viewer__dialog" role="dialog" aria-modal="true" aria-labelledby="url-viewer-title">
        <div class="html-viewer__bar">
          <div>
            <span data-url-viewer-label>Contenido</span>
            <h2 id="url-viewer-title" data-url-viewer-title>Vista previa</h2>
          </div>
          <div class="html-viewer__actions">
            <button type="button" data-url-viewer-close aria-label="Cerrar visor">Cerrar</button>
          </div>
        </div>
        <iframe data-url-viewer-frame title="Vista previa" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-forms"></iframe>
      </div>
    `;
    document.body.appendChild(viewer);
    viewer.addEventListener("click", (event) => {
      if (event.target === viewer || event.target.closest("[data-url-viewer-close]")) closeUrlViewer();
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && viewer.classList.contains("is-open")) closeUrlViewer();
    });
  }

  viewer.querySelector("[data-url-viewer-label]").textContent = label;
  viewer.querySelector("[data-url-viewer-title]").textContent = title;
  viewer.querySelector("[data-url-viewer-frame]").src = url;
  viewer.classList.add("is-open");
  viewer.setAttribute("aria-hidden", "false");
  document.body.classList.add("html-viewer-open");
}

function closeUrlViewer() {
  const viewer = document.querySelector("[data-url-viewer]");
  if (!viewer) return;
  viewer.classList.remove("is-open");
  viewer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("html-viewer-open");
  viewer.querySelector("[data-url-viewer-frame]").src = "about:blank";
}

function getReportGraphsUrl(report) {
  if (report.html_url) return report.html_url;
  const normalizedTitle = normalizeText(report.titulo || "");
  if (normalizedTitle.includes("dia de la bandera")) {
    return new URL("/informes/radiografia-adorni-2026.html", window.location.origin).href;
  }
  return "";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeReportRecord(report) {
  return {
    ...report,
    provincia: cleanLegacyPrivateMarker(report?.provincia),
    localidad: cleanLegacyPrivateMarker(report?.localidad),
  };
}

function cleanLegacyPrivateMarker(value) {
  return String(value || "")
    .replaceAll(LEGACY_PRIVATE_MARKER, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isMissingColumnError(error, column) {
  if (!error) return false;
  const message = String(error.message || "");
  const code = String(error.code || "");
  return code === "42703" || (message.includes(column) && message.includes("does not exist"));
}

function isPrivateReport(report) {
  return report?.is_private === true || String(report?.is_private || "").toLowerCase() === "true";
}

function hasPdfAccess() {
  const contact = JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}");
  const gmailValidated = Boolean(contact.visitor_id) && localStorage.getItem(GMAIL_VERIFIED_KEY) === contact.visitor_id;
  const phoneValidated = Boolean(contact.phone) && localStorage.getItem(PHONE_VERIFIED_KEY) === contact.phone;
  const statusValidated = ["phone_verified", "gmail_verified"].includes(String(contact.phone_validation_status || ""));
  return Boolean(contact.phone && (gmailValidated || phoneValidated || statusValidated));
}

function getReportResourceHref(report, target = "pdf", url = "") {
  if (!url) return "#";
  if (isPrivateReport(report) && !hasPdfAccess()) return buildRegistrationLink(report, target);
  return buildReportAccessLink(report, target);
}

function getPdfDownloadHref(report) {
  return getReportResourceHref(report, "pdf", report.pdf_url);
}

function buildRegistrationLink(report, accessTarget = "pdf") {
  const nextUrl = new URL(window.location.href);
  if (report?.id) nextUrl.searchParams.set("report", report.id);
  nextUrl.searchParams.set("private_target", accessTarget);
  const registration = new URL("/registro/", window.location.origin);
  registration.searchParams.set("next", nextUrl.href);
  if (report?.titulo) registration.searchParams.set("pdf", report.titulo);
  if (report?.id) registration.searchParams.set("report", report.id);
  registration.searchParams.set("target", accessTarget);
  return registration.href;
}

function buildReportAccessLink(report, target = "pdf") {
  if (!report?.id) return "#";
  const access = new URL("/functions/v1/report-access", SUPABASE_URL);
  access.searchParams.set("report", report.id);
  access.searchParams.set("target", target);
  if (hasPdfAccess()) access.searchParams.set("visitor_id", getAccessVisitorId());
  return access.href;
}

function getAccessVisitorId() {
  const contact = JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}");
  return contact.visitor_id || getVisitorId();
}

function rememberPrivateReport(report, target = "pdf") {
  if (!report?.id) return;
  sessionStorage.setItem(PRIVATE_REPORT_REGISTRATION_KEY, report.id);
  sessionStorage.setItem(PRIVATE_REPORT_REGISTRATION_TARGET_KEY, target);
}

async function requestPrivateReportAccess(report, target = "pdf") {
  // Flujo unico para radiografias privadas: registrar la solicitud (base de datos)
  // sin abrir jamas el contenido. El acceso lo habilita el administrador.
  rememberPrivateReport(report, target);
  try {
    await logReportInterest(report, "report_access_requested", buildRegistrationLink(report, target));
  } catch (_) {
    // La solicitud no depende del registro analitico.
  }
  if (typeof window.openPrivateReportModal === "function") {
    window.openPrivateReportModal(report, target);
    return;
  }
  window.location.href = buildRegistrationLink(report, target);
}

function openPendingPrivateReport(reports) {
  if (!hasPdfAccess()) return;
  const params = new URLSearchParams(window.location.search);
  const pendingId = sessionStorage.getItem(PRIVATE_REPORT_REGISTRATION_KEY) || params.get("report");
  if (!pendingId) return;
  const report = reports.find((item) => item.id === pendingId);
  if (!report) return;
  const pendingTarget = params.get("private_target") || params.get("target") || sessionStorage.getItem(PRIVATE_REPORT_REGISTRATION_TARGET_KEY) || "pdf";
  sessionStorage.removeItem(PRIVATE_REPORT_REGISTRATION_KEY);
  sessionStorage.removeItem(PRIVATE_REPORT_REGISTRATION_TARGET_KEY);

  if (pendingTarget === "html") {
    const graphsUrl = getReportGraphsUrl(report);
    if (graphsUrl) {
      const accessUrl = buildReportAccessLink(report, "html");
      logReportInterest(report, "report_open", accessUrl).catch(() => {}).finally(() => {
        openHtmlReportViewer(accessUrl, report.titulo || "Graficos");
      });
      return;
    }
  }

  if (!report.pdf_url) return;
  logPdfDownload(report).catch(() => {}).finally(() => openPdfViewer(report));
}

function bindPdfDownloadLinks(container, reports) {
  container.querySelectorAll("[data-pdf-download]").forEach((link) => {
    link.addEventListener("click", async (event) => {
      const report = reports[Number(link.dataset.reportIndex)];
      if (!report) return;

      event.preventDefault();
      if (!report.pdf_url) {
        await logReportInterest(report, "report_access_requested", link.href);
        return;
      }

      if (isPrivateReport(report) && !hasPdfAccess()) {
        await requestPrivateReportAccess(report, "pdf");
        return;
      }

      await logPdfDownload(report);
      openPdfViewer(report);
    });
  });
}

function openPdfViewer(report) {
  if (!report?.pdf_url) return;
  if (isPrivateReport(report) && !hasPdfAccess()) {
    requestPrivateReportAccess(report, "pdf");
    return;
  }

  let viewer = document.querySelector("[data-pdf-viewer]");
  if (!viewer) {
    viewer = document.createElement("div");
    viewer.className = "pdf-viewer";
    viewer.setAttribute("data-pdf-viewer", "");
    viewer.setAttribute("aria-hidden", "true");
    viewer.innerHTML = `
      <div class="pdf-viewer__dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-viewer-title">
          <div class="pdf-viewer__bar">
            <div>
              <span>Radiografia</span>
              <h2 id="pdf-viewer-title" data-pdf-viewer-title>Documento</h2>
            </div>
            <div class="pdf-viewer__actions">
              <button type="button" data-pdf-voice-toggle>Escuchar informe</button>
              <a data-pdf-viewer-source target="_blank" rel="noopener noreferrer">Abrir PDF</a>
              <button type="button" data-pdf-viewer-close aria-label="Cerrar visor">Cerrar</button>
            </div>
          </div>
          <div class="pdf-viewer__mobile-note" data-pdf-viewer-note>
            Vista previa del PDF. Si tu navegador no la muestra usa Abrir PDF.
          </div>
          <div class="pdf-viewer__pages" data-pdf-viewer-pages aria-label="Paginas del PDF"></div>
          <iframe data-pdf-viewer-frame title="Visor de PDF" loading="lazy"></iframe>
        </div>
      `;
    document.body.appendChild(viewer);

    viewer.addEventListener("click", (event) => {
      if (event.target === viewer || event.target.closest("[data-pdf-viewer-close]")) closePdfViewer();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && viewer.classList.contains("is-open")) closePdfViewer();
    });
  }

  const title = report.titulo || "Radiografia";
  const frame = viewer.querySelector("[data-pdf-viewer-frame]");
  const pdfUrl = buildReportAccessLink(report, "pdf");
  viewer.querySelector("[data-pdf-viewer-title]").textContent = title;
  const source = viewer.querySelector("[data-pdf-viewer-source]");
  if (source) source.href = pdfUrl;
  const voice = viewer.querySelector("[data-pdf-voice-toggle]");
  if (voice) {
    resetSpeechButton(voice);
    voice.onclick = () => togglePdfSpeech(pdfUrl, title, voice);
  }
  viewer.classList.remove("has-rendered-pages", "is-mobile-rendering");
  frame.src = pdfUrl;
  viewer.classList.add("is-open");
  viewer.setAttribute("aria-hidden", "false");
  document.body.classList.add("pdf-viewer-open");

  if (isMobileViewport()) renderMobilePdf(viewer, pdfUrl);
}

function closePdfViewer() {
  const viewer = document.querySelector("[data-pdf-viewer]");
  if (!viewer) return;

  const frame = viewer.querySelector("[data-pdf-viewer-frame]");
  viewer.classList.remove("is-open");
  viewer.classList.remove("has-rendered-pages", "is-mobile-rendering");
  stopReportSpeech();
  viewer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("pdf-viewer-open");
  if (frame) frame.src = "about:blank";
  viewer.querySelector("[data-pdf-viewer-pages]")?.replaceChildren();
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
}

async function renderMobilePdf(viewer, pdfUrl) {
  const pages = viewer.querySelector("[data-pdf-viewer-pages]");
  if (!pages) return;

  pages.replaceChildren();
  viewer.classList.add("is-mobile-rendering");
  pages.classList.add("is-loading");
  pages.textContent = "Preparando vista optimizada...";

  try {
    const pdfjs = await loadPdfJs();
    const pdfData = await fetchPdfArrayBuffer(pdfUrl);
    const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
    pages.replaceChildren();
    pages.classList.remove("is-loading");
    viewer.classList.add("has-rendered-pages");

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const width = Math.max(280, pages.clientWidth - 24);
      const scale = width / viewport.width;
      const scaledViewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = Math.floor(scaledViewport.width);
      canvas.height = Math.floor(scaledViewport.height);
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      pages.appendChild(canvas);
      await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
    }
  } catch (error) {
    pages.classList.remove("is-loading");
    viewer.classList.remove("has-rendered-pages", "is-mobile-rendering");
    pages.replaceChildren();
    console.warn("No se pudo renderizar el PDF movil", error);
  }
}

async function togglePdfSpeech(pdfUrl, title, button) {
  if (reportSpeechState.reading && reportSpeechState.button === button) {
    stopReportSpeech();
    return;
  }
  if (!supportsSpeech()) {
    alert("Este navegador no permite lectura en voz desde la web.");
    return;
  }

  beginPrimedReportSpeech(button);
  try {
    const text = await extractPdfText(pdfUrl);
    replaceReportSpeechQueue(text || title || "Informe de Consultora Diagonales", button);
  } catch (error) {
    console.warn("No se pudo preparar la lectura del PDF", error);
    replaceReportSpeechQueue(title || "Informe de Consultora Diagonales", button);
  }
}

async function toggleHtmlSpeech(url, title, button, viewer) {
  if (reportSpeechState.reading && reportSpeechState.button === button) {
    stopReportSpeech();
    return;
  }
  if (!supportsSpeech()) {
    alert("Este navegador no permite lectura en voz desde la web.");
    return;
  }

  beginPrimedReportSpeech(button);
  try {
    let text = viewer?.cdHtmlVoiceText || "";
    if (!text) {
      const result = await fetchHtmlForViewer(url);
      text = extractReadableTextFromHtml(result.html);
      if (viewer) viewer.cdHtmlVoiceText = text;
    }
    replaceReportSpeechQueue(text || title || "Informe de Consultora Diagonales", button);
  } catch (error) {
    console.warn("No se pudo preparar la lectura del HTML", error);
    replaceReportSpeechQueue(title || "Informe de Consultora Diagonales", button);
  }
}

async function extractPdfText(pdfUrl) {
  const pdfjs = await loadPdfJs();
  const pdfData = await fetchPdfArrayBuffer(pdfUrl);
  const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
  const chunks = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => item.str || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) chunks.push(pageText);
  }
  return chunks.join("\n\n").trim();
}

async function fetchPdfArrayBuffer(pdfUrl) {
  const response = await fetch(pdfUrl, { credentials: "omit", cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.arrayBuffer();
}

function extractReadableTextFromHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  doc.querySelectorAll("script,style,noscript,svg,canvas,iframe,audio,video,nav,header,footer,[data-cd-voice-widget]").forEach((node) => node.remove());
  return (doc.body?.innerText || doc.body?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function supportsSpeech() {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function resetSpeechButton(button) {
  if (!button) return;
  button.disabled = false;
  button.classList.remove("is-reading");
  button.textContent = "Escuchar informe";
}

function setSpeechButton(button, text) {
  if (!button) return;
  button.disabled = false;
  button.textContent = text;
}

function beginPrimedReportSpeech(button) {
  startReportSpeech("Preparando la lectura del informe.", button);
  setSpeechButton(button, "Preparando...");
}

function replaceReportSpeechQueue(text, button) {
  const chunks = chunkSpeechText(text);
  if (!chunks.length) {
    stopReportSpeech();
    alert("No encontramos texto legible para escuchar en este informe.");
    resetSpeechButton(button);
    return;
  }

  if (!reportSpeechState.reading || reportSpeechState.button !== button) {
    startReportSpeech(text, button);
    return;
  }

  reportSpeechState.chunks = chunks;
  reportSpeechState.index = 0;
  setSpeechButton(button, "Detener audio");
}

function startReportSpeech(text, button) {
  stopReportSpeech();
  const chunks = chunkSpeechText(text);
  if (!chunks.length) {
    alert("No encontramos texto legible para escuchar en este informe.");
    resetSpeechButton(button);
    return;
  }

  reportSpeechState.chunks = chunks;
  reportSpeechState.index = 0;
  reportSpeechState.button = button;
  reportSpeechState.reading = true;
  button?.classList.add("is-reading");
  setSpeechButton(button, "Detener audio");
  speakNextReportChunk();
}

function speakNextReportChunk() {
  if (!reportSpeechState.reading || reportSpeechState.index >= reportSpeechState.chunks.length) {
    stopReportSpeech();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(reportSpeechState.chunks[reportSpeechState.index]);
  utterance.lang = "es-AR";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.onend = () => {
    reportSpeechState.index += 1;
    speakNextReportChunk();
  };
  utterance.onerror = () => stopReportSpeech();
  window.speechSynthesis.speak(utterance);
}

function stopReportSpeech() {
  if (supportsSpeech()) window.speechSynthesis.cancel();
  const button = reportSpeechState.button;
  reportSpeechState.chunks = [];
  reportSpeechState.index = 0;
  reportSpeechState.button = null;
  reportSpeechState.reading = false;
  resetSpeechButton(button);
}

function chunkSpeechText(text) {
  const sentences = String(text || "").match(/[^.!?]+[.!?]*/g) || [];
  const chunks = [];
  let current = "";
  sentences.forEach((sentence) => {
    const next = `${current} ${sentence}`.trim();
    if (next.length > 900 && current) {
      chunks.push(current);
      current = sentence.trim();
    } else {
      current = next;
    }
  });
  if (current) chunks.push(current);
  return chunks.slice(0, 80);
}

async function loadPdfJs() {
  if (!window.CD_PDFJS_PROMISE) {
    window.CD_PDFJS_PROMISE = import(PDFJS_URL).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjs;
    });
  }
  return window.CD_PDFJS_PROMISE;
}

function bindReportOpenLinks(container, reports) {
  container.querySelectorAll("[data-report-open]").forEach((link) => {
    link.addEventListener("click", async (event) => {
      const report = reports[Number(link.dataset.reportIndex)];
      if (!report) return;
      if (isPrivateReport(report)) return;

      await logReportInterest(report, "report_open", report.html_url || link.href);
    });
  });
}

function initHtmlReportViewer() {
  document.addEventListener("click", async (event) => {
    const link = event.target.closest("[data-html-viewer-open]");
    if (!link) return;

    const report = getReportFromLink(link);
    const linkLooksPrivate = link.dataset.privateReport === "true";
    if ((report && isPrivateReport(report) && !hasPdfAccess()) || (!report && linkLooksPrivate)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await requestPrivateReportAccess(
        report || { id: link.dataset.reportId || null, titulo: link.dataset.privateTitle || getHtmlViewerTitle(link) },
        "html"
      );
      return;
    }

    if (!report && link.href.includes("/registro/")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.href = link.href;
      return;
    }

    event.preventDefault();
    const accessUrl = report ? buildReportAccessLink(report, "html") : link.href;
    openHtmlReportViewer(accessUrl, getHtmlViewerTitle(link));
  });
}

function initHtmlVoiceBridgeMessages() {
  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type !== "cd:html-voice") return;
    const frame = document.querySelector("[data-html-viewer-frame]");
    if (!frame || event.source !== frame.contentWindow) return;

    if (data.action === "stop") {
      stopReportSpeech();
      return;
    }

    if (data.action === "start") {
      const viewer = document.querySelector("[data-html-viewer]");
      const title = viewer?.querySelector("[data-html-viewer-title]")?.textContent || "Informe de Consultora Diagonales";
      startReportSpeech(data.text || viewer?.cdHtmlVoiceText || title, null);
    }
  });
}

function getReportFromLink(link) {
  const rawIndex = link?.dataset?.reportIndex;
  if (rawIndex === undefined || rawIndex === "") return null;
  const index = Number(rawIndex);
  if (!Number.isInteger(index)) return null;
  return Array.isArray(window.CD_REPORTS) ? window.CD_REPORTS[index] : null;
}

async function openHtmlReportViewer(url, title) {
  if (String(url || "").includes("/registro/")) {
    window.location.href = url;
    return;
  }

  let viewer = document.querySelector("[data-html-viewer]");
  if (!viewer) {
    viewer = document.createElement("div");
    viewer.className = "html-viewer";
    viewer.setAttribute("data-html-viewer", "");
    viewer.setAttribute("aria-hidden", "true");
    viewer.innerHTML = `
      <div class="html-viewer__dialog" role="dialog" aria-modal="true" aria-labelledby="html-viewer-title">
        <div class="html-viewer__bar">
          <div>
            <span>Radiografia</span>
            <h2 id="html-viewer-title" data-html-viewer-title>Graficos</h2>
          </div>
          <div class="html-viewer__actions">
            <button type="button" data-html-voice-toggle>Escuchar informe</button>
            <button type="button" data-html-viewer-close aria-label="Cerrar visor">Cerrar</button>
          </div>
        </div>
        <iframe data-html-viewer-frame title="Visor de graficos" loading="lazy" allow="autoplay; encrypted-media" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-forms"></iframe>
      </div>
    `;
    document.body.appendChild(viewer);

    viewer.addEventListener("click", (event) => {
      if (event.target === viewer || event.target.closest("[data-html-viewer-close]")) closeHtmlReportViewer();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && viewer.classList.contains("is-open")) closeHtmlReportViewer();
    });
  }

  viewer.querySelector("[data-html-viewer-title]").textContent = title;
  viewer.cdHtmlVoiceText = "";
  const voice = viewer.querySelector("[data-html-voice-toggle]");
  if (voice) {
    resetSpeechButton(voice);
    voice.onclick = () => toggleHtmlSpeech(url, title, voice, viewer);
  }
  const frame = viewer.querySelector("[data-html-viewer-frame]");
  frame.removeAttribute("src");
  frame.srcdoc = buildHtmlViewerLoading();
  viewer.classList.add("is-open");
  viewer.setAttribute("aria-hidden", "false");
  document.body.classList.add("html-viewer-open");

  try {
    const result = await fetchHtmlForViewer(url);
    viewer.cdHtmlVoiceText = extractReadableTextFromHtml(result.html);
    frame.srcdoc = normalizeHtmlForViewer(result.html, result.sourceUrl);
  } catch (error) {
    if (isRegistrationRequiredError(error)) {
      redirectToRegistrationForAccessUrl(url);
      return;
    }
    frame.srcdoc = buildHtmlViewerError(url);
    console.warn("No se pudo cargar el HTML en el visor interno", error);
  }
}

function closeHtmlReportViewer() {
  const viewer = document.querySelector("[data-html-viewer]");
  if (!viewer) return;

  const frame = viewer.querySelector("[data-html-viewer-frame]");
  viewer.classList.remove("is-open");
  viewer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("html-viewer-open");
  stopReportSpeech();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  if (frame) {
    frame.removeAttribute("src");
    frame.srcdoc = "";
  }
}

function getHtmlViewerTitle(link) {
  const rowTitle = link.closest(".latest-report-row")?.querySelector("span")?.textContent?.trim();
  const cardTitle = link.closest(".report-card")?.querySelector("h2")?.textContent?.trim();
  return rowTitle || cardTitle || "Graficos";
}

async function fetchHtmlForViewer(url) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = new Error(body?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return {
    html: await response.text(),
    sourceUrl: response.url || url,
  };
}

function isRegistrationRequiredError(error) {
  return error?.status === 403 && error?.body?.error === "registration_required";
}

function redirectToRegistrationForAccessUrl(accessUrl) {
  localStorage.removeItem(PHONE_VERIFIED_KEY);
  localStorage.removeItem(GMAIL_VERIFIED_KEY);

  const nextUrl = new URL("/repositorio/index.html", window.location.origin);
  try {
    const access = new URL(accessUrl, window.location.href);
    const reportId = access.searchParams.get("report");
    const target = access.searchParams.get("target") || "html";
    if (reportId) nextUrl.searchParams.set("report", reportId);
    nextUrl.searchParams.set("private_target", target);
  } catch (_) {
    nextUrl.searchParams.set("private_target", "html");
  }

  const registration = new URL("/registro/", window.location.origin);
  registration.searchParams.set("next", nextUrl.href);
  registration.searchParams.set("target", nextUrl.searchParams.get("private_target") || "html");
  const reportId = nextUrl.searchParams.get("report");
  if (reportId) registration.searchParams.set("report", reportId);
  window.location.href = registration.href;
}

function normalizeHtmlForViewer(html, sourceUrl) {
  const base = `<base href="${escapeAttribute(new URL(sourceUrl, window.location.href).href)}">`;
  const bridge = buildHtmlViewerExternalLinkBridge();
  const responsivePatch = buildHtmlViewerResponsivePatch();
  let output = sanitizeHtmlReportForViewer(String(html || ""), sourceUrl);
  if (/<head[^>]*>/i.test(output)) {
    output = output.replace(/<head[^>]*>/i, (match) => `${match}\n${base}\n${responsivePatch.style}`);
  } else {
    output = `<!doctype html><html lang="es"><head><meta charset="UTF-8">${base}${responsivePatch.style}</head><body>${output}</body></html>`;
  }
  if (/<\/body>/i.test(output)) {
    output = output.replace(/<\/body>/i, `${responsivePatch.script}\n${bridge}\n</body>`);
  } else {
    output += responsivePatch.script + bridge;
  }
  return output;
}

function sanitizeHtmlReportForViewer(html, sourceUrl) {
  const source = new URL(sourceUrl, window.location.href);
  const siteAssets = new URL("/assets/img/", window.location.origin).href;
  let output = html;

  output = output.replace(
    /src=(["'])(?:\.\/)?(?:LOGO%20consultora|LOGO consultora)\.png\1/gi,
    `src="${siteAssets}logo-completo.png"`
  );
  output = output.replace(
    /src=(["'])(?:\.\/)?(?:XK3Y2GCMVL7G45EJEBLR462TBE|javier-milei-y-la-ministra-de-seguridad-patricia-bullrich-durante-un-acto-de-campana-foto-afp-CAWLGEFH2JFQDK2AOUMY37ZIJA)\.avif\1/gi,
    `src="${siteAssets}drCdm1JPm_720x0__1.jpg"`
  );
  output = output.replace(
    /src=(["'])(?:\.\/)?drCdm1JPm_720x0__1\.jpg\1/gi,
    `src="${siteAssets}drCdm1JPm_720x0__1.jpg"`
  );

  if (source.protocol === "file:") {
    output = output.replace(/src=(["'])\.?\/?([^"']+\.(?:png|jpe?g|webp|gif|svg))\1/gi, (match, quote, asset) => {
      if (/^(https?:|data:|blob:)/i.test(asset)) return match;
      return `src="${new URL(asset, source).href}"`;
    });
  }

  return output;
}

function buildHtmlViewerResponsivePatch() {
  const style = `<style id="cd-html-viewer-responsive-patch">
    html{width:100%;-webkit-text-size-adjust:100%}
    body{width:100%;max-width:100%;overflow-x:hidden}
    img,video,canvas{max-width:100%;height:auto}
    #tts-btn,
    [data-cd-voice-widget],
    .cd-voice-widget,
    [data-cd-voice-toggle]{display:none!important;visibility:hidden!important;pointer-events:none!important}
    svg{height:auto;max-width:100%}
    .chart-box,.chart-wrapper,.chart-container,.graph-box,.viz-card,.figure,.figura{
      max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;
      scrollbar-color:rgba(0,158,166,.55) transparent;
    }
    .chart-container{position:relative;min-height:clamp(280px,58vw,460px)}
    .chart-container canvas,.chart-wrapper canvas{width:100%!important;height:100%!important;min-height:280px}
    .cd-responsive-svg{width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}
    .cd-responsive-svg svg{display:block;min-width:min(720px,calc(100vw - 28px));height:auto}
    @media (max-width:680px){
      body{font-size:14px;line-height:1.5}
      .chart-box,.chart-wrapper,.graph-box,.viz-card{padding-inline:max(12px,3vw)}
      .chart-title,[class*="chart-title"],h2,h3{overflow-wrap:anywhere}
      .chart-container{min-height:340px}
      .chart-container canvas,.chart-wrapper canvas{min-height:340px}
      svg text{font-size:12px}
    }
  </style>`;
  const script = `<script>
    (function(){
      function wrapSvg(svg){
        if(!svg || svg.closest(".cd-responsive-svg")) return;
        var parent = svg.parentElement;
        if(!parent) return;
        var wrap = document.createElement("div");
        wrap.className = "cd-responsive-svg";
        parent.insertBefore(wrap, svg);
        wrap.appendChild(svg);
      }
      function tuneCharts(){
        document.querySelectorAll("svg").forEach(wrapSvg);
        document.querySelectorAll("canvas").forEach(function(canvas){
          canvas.style.maxWidth = "100%";
          canvas.style.width = "100%";
        });
        if(window.Chart && window.Chart.defaults){
          var mobile = window.matchMedia("(max-width: 680px)").matches;
          window.Chart.defaults.responsive = true;
          window.Chart.defaults.maintainAspectRatio = false;
          window.Chart.defaults.font.size = mobile ? 11 : 12;
          if(window.Chart.defaults.plugins && window.Chart.defaults.plugins.legend){
            window.Chart.defaults.plugins.legend.position = "bottom";
            window.Chart.defaults.plugins.legend.labels.boxWidth = mobile ? 10 : 14;
            window.Chart.defaults.plugins.legend.labels.padding = mobile ? 8 : 12;
          }
          Object.keys(window.Chart.instances || {}).forEach(function(key){
            var chart = window.Chart.instances[key];
            if(chart && chart.options){
              chart.options.maintainAspectRatio = false;
              chart.options.responsive = true;
              chart.resize();
              chart.update("none");
            }
          });
        }
      }
      if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", tuneCharts);
      }else{
        tuneCharts();
      }
      window.addEventListener("resize", function(){ setTimeout(tuneCharts, 80); });
    })();
  <\\/script>`;
  return { style, script };
}

function buildHtmlViewerAnchorBridge() {
  return `<script>
    (function () {
      function findTarget(id) {
        if (!id) return null;
        try { id = decodeURIComponent(id); } catch (_) {}
        return document.getElementById(id) || document.querySelector('a[name="' + id.replace(/"/g, '\\\\"') + '"]');
      }
      document.addEventListener("click", function (event) {
        var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
        if (!link) return;
        if (link.matches(".tab, [data-t], [data-tab]") || link.closest(".tabs, nav.tabs, [role='tablist']")) return;
        if ((link.getAttribute("onclick") || "").indexOf("show(") !== -1) return;
        var href = link.getAttribute("href") || "";
        var hashIndex = href.indexOf("#");
        if (hashIndex === -1) return;
        var beforeHash = href.slice(0, hashIndex);
        if (beforeHash && beforeHash !== window.location.pathname) {
          if (/^https?:/i.test(beforeHash) || beforeHash.indexOf("/") !== -1) return;
        }
        event.preventDefault();
        var id = href.slice(hashIndex + 1);
        var target = findTarget(id);
        if (target && target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "start" });
        else if (!id) window.scrollTo({ top: 0, behavior: "smooth" });
      }, true);
    })();
  <\\/script>`;
}

function buildHtmlViewerInteractionPatch() {
  return `<script>
    (function () {
      var panelSelector = ".panel, section.panel, [role='tabpanel'], .tab-panel";
      function activatePanel(id, trigger) {
        if (!id) return false;
        try { id = decodeURIComponent(id); } catch (_) {}
        var panel = document.getElementById(id);
        if (!panel) return false;
        var group = [];
        if (panel.parentElement) {
          group = Array.prototype.filter.call(panel.parentElement.children, function (item) {
            return item.matches && item.matches(panelSelector) && item.id;
          });
        }
        if (group.length < 2) group = [panel];
        group.forEach(function (item) {
          item.classList.remove("active", "is-active", "open");
          if (item !== panel) item.style.display = "none";
        });
        panel.classList.add("active", "is-active");
        panel.style.display = "";
        if (getComputedStyle(panel).display === "none") panel.style.display = "block";
        var tabScope = trigger && trigger.closest ? trigger.closest(".tabs, nav, [role='tablist']") : null;
        (tabScope || document).querySelectorAll(".tab, nav a, [data-t], [data-tab]").forEach(function (item) {
          item.classList.remove("active", "is-active");
          item.removeAttribute("aria-current");
          var itemHref = item.getAttribute("href") || "";
          if (item.getAttribute("data-t") === id || item.getAttribute("data-tab") === id || itemHref === "#" + id || item === trigger) {
            item.classList.add("active", "is-active");
            item.setAttribute("aria-current", "page");
          }
        });
        try { panel.scrollIntoView({ block: "start" }); } catch (_) {}
        return true;
      }
      function idFromShowCall(value) {
        var match = String(value || "").match(/show\\((['"])(.*?)\\1/);
        return match ? match[2] : "";
      }
      document.addEventListener("click", function (event) {
        var trigger = event.target && event.target.closest ? event.target.closest("a[href], .tab[data-t], [data-tab]") : null;
        if (!trigger) return;
        var href = trigger.getAttribute("href") || "";
        var id = trigger.getAttribute("data-t") || trigger.getAttribute("data-tab") || idFromShowCall(trigger.getAttribute("onclick"));
        if (!id && href.charAt(0) === "#") id = href.slice(1);
        if (id && activatePanel(id, trigger)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
      window.show = function (id, el) { return !activatePanel(id, el || null); };
      document.querySelectorAll(".tab[data-t], [data-tab]").forEach(function (tab) {
        tab.addEventListener("click", function (event) {
          if (activatePanel(tab.getAttribute("data-t") || tab.getAttribute("data-tab"), tab)) event.preventDefault();
        });
      });
    })();
  <\\/script>`;
}

function buildHtmlViewerExternalLinkBridge() {
  return `<script>
    (function () {
      document.addEventListener("click", function (event) {
        var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
        if (!link) return;
        var href = link.getAttribute("href") || "";
        var isExternalAction = /^(https?:\\/\\/(api\\.whatsapp\\.com|wa\\.me)\\/|tel:)/i.test(href);
        if (!isExternalAction) return;
        event.preventDefault();
        window.open(link.href, "_blank", "noopener");
      });
    })();
  <\\/script>`;
}

function buildHtmlViewerVoiceBridge() {
  return `<style>
    .cd-voice-widget{position:fixed;top:14px;right:14px;z-index:2147483647;display:flex;align-items:center;gap:8px;font-family:Inter,Arial,sans-serif}
    .cd-voice-widget button{min-height:42px;border:0;border-radius:10px;padding:0 14px;color:#172033;background:#fff;font-size:13px;font-weight:900;box-shadow:0 10px 26px rgba(0,0,0,.22);cursor:pointer}
    .cd-voice-widget button.is-reading{background:#f7fbff}
    .cd-voice-widget span{color:#f8d68a;font-size:13px;font-weight:900;text-shadow:0 1px 8px rgba(0,0,0,.45)}
    @media(max-width:640px){.cd-voice-widget{top:auto;right:12px;bottom:calc(14px + env(safe-area-inset-bottom,0px));max-width:calc(100vw - 24px)}.cd-voice-widget button{min-height:38px;padding:0 12px;font-size:12px;border-radius:12px}.cd-voice-widget span{display:none}}
  </style>
  <div class="cd-voice-widget" data-cd-voice-widget>
    <button type="button" data-cd-voice-toggle>Escuchar</button>
    <span data-cd-voice-status></span>
  </div>
  <script>
    (function () {
      var state = { chunks: [], index: 0, reading: false };
      var button = document.querySelector("[data-cd-voice-toggle]");
      var status = document.querySelector("[data-cd-voice-status]");
      function speechHost(){
        try {
          if (window.parent && "speechSynthesis" in window.parent && "SpeechSynthesisUtterance" in window.parent) return window.parent;
        } catch (_) {}
        if ("speechSynthesis" in window && "SpeechSynthesisUtterance" in window) return window;
        return null;
      }
      function supported(){ return !!speechHost(); }
      function canUseParentBridge(){
        try { return !!(window.parent && window.parent !== window && window.parent.postMessage); }
        catch (_) { return false; }
      }
      function sendToParent(action, text){
        try {
          window.parent.postMessage({ type: "cd:html-voice", action: action, text: text || "" }, "*");
          return true;
        } catch (_) {
          return false;
        }
      }
      function cleanText(){
        var clone = document.body.cloneNode(true);
        clone.querySelectorAll("script,style,noscript,svg,canvas,iframe,audio,video,nav,header,footer,[data-cd-voice-widget]").forEach(function(node){ node.remove(); });
        return (clone.innerText || clone.textContent || "").replace(/\\s+/g," ").trim();
      }
      function chunks(text){
        var parts = text.match(/[^.!?]+[.!?]*/g) || [text];
        var out = [], current = "";
        parts.forEach(function(sentence){
          var next = (current + " " + sentence).trim();
          if (next.length > 900 && current) { out.push(current); current = sentence.trim(); }
          else current = next;
        });
        if (current) out.push(current);
        return out;
      }
      function setReading(reading){
        state.reading = reading;
        if (button) { button.classList.toggle("is-reading", reading); button.textContent = reading ? "Detener" : "Escuchar"; }
        if (status) status.textContent = reading ? "Leyendo..." : "";
      }
      function stop(){
        if (canUseParentBridge()) sendToParent("stop");
        var host = speechHost();
        if (host) host.speechSynthesis.cancel();
        state.chunks = []; state.index = 0; setReading(false);
      }
      function next(){
        if (!state.chunks.length || state.index >= state.chunks.length) { stop(); return; }
        var host = speechHost();
        if (!host) { stop(); return; }
        var utterance = new host.SpeechSynthesisUtterance(state.chunks[state.index]);
        utterance.lang = "es-AR"; utterance.rate = 0.95; utterance.pitch = 1;
        utterance.onend = function(){ state.index += 1; next(); };
        utterance.onerror = function(){ stop(); };
        host.speechSynthesis.speak(utterance);
      }
      function toggle(){
        if (state.reading) { stop(); return; }
        var text = cleanText();
        if (!text) { alert("No encontramos texto legible para escuchar en este HTML."); return; }
        if (canUseParentBridge() && sendToParent("start", text)) {
          setReading(true);
          return;
        }
        if (!supported()) { alert("Este navegador no permite lectura en voz desde la web."); return; }
        stop(); state.chunks = chunks(text); state.index = 0; setReading(true); next();
      }
      button && button.addEventListener("click", toggle);
      window.addEventListener("beforeunload", stop);
    })();
  <\\/script>`;
}

function buildHtmlViewerLoading() {
  return `<!doctype html><html><body style="margin:0;display:grid;min-height:100vh;place-items:center;background:#061522;color:#dff9ff;font-family:Arial,sans-serif">Cargando gr&aacute;ficos...</body></html>`;
}

function buildHtmlViewerError(url) {
  return `<!doctype html><html><body style="margin:0;display:grid;min-height:100vh;place-items:center;background:#061522;color:#dff9ff;font-family:Arial,sans-serif;text-align:center;padding:24px"><div><h1 style="font-size:20px">No se pudo cargar el HTML dentro del visor.</h1><p>Prob&aacute; volver a cargar la radiograf&iacute;a desde el repositorio.</p></div></body></html>`;
}

async function logReportInterest(report, eventType, targetUrl) {
  await trackEvent(eventType, {
    radiografia_id: report.id || null,
    title: report.titulo || null,
    html_url: report.html_url || null,
    pdf_url: report.pdf_url || null,
    target_url: targetUrl || report.html_url || report.pdf_url || null,
    lugar: report.localidad || report.provincia || null,
    provincia: report.provincia || null,
    localidad: report.localidad || null,
  }, true);
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

  await trackEvent("download_report", {
    radiografia_id: report.id || null,
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
  const htmlPicker = document.querySelector("[data-admin-html-picker]");
  const htmlSelect = document.querySelector("[data-admin-html-select]");
  const htmlSelectAction = document.querySelector("[data-admin-html-select-action]");
  if (!form) return;

  const unlockAdmin = () => {
    login?.classList.add("is-hidden");
    form.classList.remove("is-hidden");
    htmlPicker?.classList.remove("is-hidden");
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
    const pdfFile = formData.get("pdf_archivo");
    const htmlFile = formData.get("html_archivo");
    const titulo = String(formData.get("titulo") || "").trim();
    const provincia = String(formData.get("provincia") || "").trim();
    const localidad = String(formData.get("localidad") || "").trim();
    const fecha = String(formData.get("fecha") || "").trim();
    const isPrivate = form.elements.is_private?.checked === true;

    if (!id && !hasUploadFile(pdfFile) && !hasUploadFile(htmlFile)) {
      status.textContent = "Selecciona un archivo PDF o HTML válido.";
      return;
    }

    if (hasUploadFile(pdfFile) && !isPdfFile(pdfFile)) {
      status.textContent = "Selecciona un archivo PDF o HTML válido o deja el archivo vacío para conservar el actual.";
      return;
    }

    submit.disabled = true;
    if (hasUploadFile(htmlFile) && !isHtmlFile(htmlFile)) {
      status.textContent = "El archivo HTML de grÃ¡ficos debe ser .html o .htm.";
      return;
    }

    submit.textContent = id ? "Actualizando..." : "Guardando...";
    status.textContent = id ? "Actualizando radiografía." : "Subiendo archivo y publicando metadata.";

    try {
      const data = await saveRadiografiaReport({ id, pdfFile, htmlFile, titulo, provincia, localidad, fecha, isPrivate });
      const links = [
        data.pdf_url ? `<a href="${escapeAttribute(data.pdf_url)}" target="_blank" rel="noopener">Abrir PDF</a>` : "",
        data.html_url ? `<a href="${escapeAttribute(data.html_url)}" target="_blank" rel="noopener">Abrir HTML</a>` : "",
      ].filter(Boolean).join(" | ");
      const publicUrl = data.pdf_url || data.html_url;
      const fileLabel = data.html_url && !data.pdf_url ? "HTML" : "archivo";

      resetAdminForm();
      status.innerHTML = id
        ? `Radiografía actualizada. ${publicUrl ? `<a href="${escapeAttribute(publicUrl)}" target="_blank" rel="noopener">Abrir ${fileLabel}</a>` : ""}`
        : `Archivo publicado. <a href="${escapeAttribute(publicUrl)}" target="_blank" rel="noopener">Abrir ${fileLabel}</a>`;
      loadAdminDashboard();
    } catch (error) {
      status.textContent = `No se pudo guardar: ${error.message}`;
    } finally {
      submit.disabled = false;
      submit.textContent = form.elements.id.value ? "Actualizar archivo" : "Guardar archivo";
    }
  });

  refresh?.addEventListener("click", loadAdminDashboard);
  cancelEdit?.addEventListener("click", resetAdminForm);
  htmlSelectAction?.addEventListener("click", () => {
    const report = adminReports.find((item) => item.id === htmlSelect?.value);
    if (report) fillAdminEditForm(report, "html");
  });

  document.querySelector("[data-admin-reports]")?.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-admin-edit]");
    const htmlButton = event.target.closest("[data-admin-add-html]");
    const deleteButton = event.target.closest("[data-admin-delete]");
    const privacyButton = event.target.closest("[data-admin-privacy]");
    if (htmlButton) {
      const report = adminReports.find((item) => item.id === htmlButton.dataset.adminAddHtml);
      if (report) fillAdminEditForm(report, "html");
      return;
    }

    if (editButton) {
      const report = adminReports.find((item) => item.id === editButton.dataset.adminEdit);
      if (report) fillAdminEditForm(report);
      return;
    }

    if (privacyButton) {
      const report = adminReports.find((item) => item.id === privacyButton.dataset.adminPrivacy);
      if (!report) return;
      const nextIsPrivate = privacyButton.dataset.privateNext === "true";
      privacyButton.disabled = true;
      status.textContent = nextIsPrivate ? "Marcando radiografia como privada." : "Marcando radiografia como publica.";
      try {
        await setRadiografiaPrivacy(report, nextIsPrivate);
        status.textContent = nextIsPrivate
          ? "Radiografia privada: ahora pedira registro antes del PDF o HTML."
          : "Radiografia publica: ahora abre PDF y HTML directo.";
        loadAdminDashboard();
      } catch (error) {
        status.textContent = `No se pudo cambiar privacidad: ${error.message}`;
      } finally {
        privacyButton.disabled = false;
      }
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
  form.querySelector('[name="pdf_archivo"]')?.removeAttribute("required");
  form.querySelector('[name="html_archivo"]')?.removeAttribute("required");
  if (submit) submit.textContent = "Guardar PDF";
  const status = document.querySelector("[data-form-status]");
  if (status) status.textContent = "";
  cancelEdit?.classList.add("is-hidden");
}

function fillAdminEditForm(report, mode = "full") {
  const form = document.querySelector("[data-admin-form]");
  const submit = document.querySelector("[data-submit]");
  const cancelEdit = document.querySelector("[data-admin-cancel-edit]");
  const status = document.querySelector("[data-form-status]");
  if (!form) return;
  form.elements.id.value = report.id || "";
  form.elements.titulo.value = report.titulo || "";
  form.elements.provincia.value = cleanLegacyPrivateMarker(report.provincia);
  form.elements.localidad.value = cleanLegacyPrivateMarker(report.localidad);
  form.elements.fecha.value = report.fecha || "";
  if (form.elements.is_private) form.elements.is_private.checked = isPrivateReport(report);
  form.querySelector('[name="pdf_archivo"]')?.removeAttribute("required");
  form.querySelector('[name="html_archivo"]')?.removeAttribute("required");
  if (submit) submit.textContent = "Actualizar radiografía";
  if (status) status.textContent = "Editando radiografía: podés cambiar el título/datos o seleccionar otro PDF para reemplazar el archivo actual.";
  if (mode === "html") {
    if (submit) submit.textContent = "Guardar HTML de grÃ¡ficos";
    if (status) status.textContent = "CargÃ¡ el HTML de grÃ¡ficos para esta radiografÃ­a. El PDF existente se conserva.";
  } else if (status) {
    status.textContent = "Editando radiografÃ­a: podÃ©s cambiar datos, reemplazar el PDF o agregar/reemplazar el HTML de grÃ¡ficos.";
  }
  cancelEdit?.classList.remove("is-hidden");
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    form.querySelector(mode === "html" ? '[name="html_archivo"]' : '[name="pdf_archivo"]')?.focus();
  }, 350);
}

async function loadAdminDashboard() {
  const dashboard = document.querySelector("[data-admin-dashboard]");
  if (!dashboard || dashboard.classList.contains("is-hidden")) return;

  const containers = {
    reports: document.querySelector("[data-admin-reports]"),
    pages: document.querySelector("[data-admin-pages]"),
    content: document.querySelector("[data-admin-content]"),
    locations: document.querySelector("[data-admin-locations]"),
    downloads: document.querySelector("[data-admin-downloads]"),
    contacts: document.querySelector("[data-admin-contacts]"),
    events: document.querySelector("[data-admin-events]"),
    alerts: document.querySelector("[data-admin-alerts]"),
  };

  setAdminDashboardStatus("Cargando radiografías/PDF.");
  renderAdminList(containers.reports, [], "Cargando radiografías/PDF.");

  if (!supabaseClient) {
    setAdminDashboardStatus("Supabase no está configurado para cargar radiografías.");
    renderAdminList(containers.reports, [], "Configura Supabase para ver radiografías cargadas.");
    renderAdminList(containers.pages, [], "Sin recorridos locales.");
    renderAdminList(containers.content, [], "Sin consumos locales.");
    renderAdminList(containers.locations, [], "Sin ubicaciones locales.");
    renderAdminList(containers.downloads, JSON.parse(localStorage.getItem("cd:pdf_downloads") || "[]").slice(-8).reverse(), "Sin consumos locales.");
    renderAdminList(containers.contacts, [JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}")].filter((item) => item.phone || item.email), "Sin contactos locales.");
    renderAdminList(containers.events, JSON.parse(localStorage.getItem("cd:events") || "[]").slice(-12).reverse(), "Sin eventos locales.");
    renderAdminList(containers.alerts, [], "Sin alertas locales.");
    return;
  }

  try {
    const data = await fetchAdminDashboard();
    adminReports = data.reports || [];
    renderAdminHtmlPicker(adminReports);
    setAdminTotal("reports", data.totals?.reports ?? adminReports.length);
    setAdminTotal("downloads", data.totals?.downloads ?? data.downloads?.length ?? 0);
    setAdminTotal("contacts", data.totals?.identified ?? data.totals?.audience ?? data.totals?.contacts ?? data.contacts?.length ?? 0);
    setAdminTotal("events", data.totals?.visits ?? data.totals?.events ?? data.events?.length ?? 0);
    setAdminTotal("pages", data.totals?.pages ?? data.page_consumption?.length ?? 0);
    setAdminTotal("locations", data.totals?.locations ?? data.location_consumption?.length ?? 0);
    renderAdminList(containers.reports, data.reports || [], "Todavía no hay radiografías cargadas.", renderAdminReportItem);
    renderAdminList(containers.pages, data.page_consumption || [], "Todavia no hay recorridos de paginas.", renderAdminPageConsumptionItem);
    renderAdminList(containers.content, data.content_consumption || [], "Todavia no hay consumos de contenidos.", renderAdminContentConsumptionItem);
    renderAdminList(containers.locations, data.location_consumption || [], "Todavia no hay origen geografico.", renderAdminLocationConsumptionItem);
    setAdminDashboardStatus(`${adminReports.length} radiografía${adminReports.length === 1 ? "" : "s"}/PDF cargado${adminReports.length === 1 ? "" : "s"}. ${data.page_consumption?.length || 0} recorridos y ${data.location_consumption?.length || 0} zonas detectadas.`);
    renderAdminList(containers.downloads, data.downloads || [], "Todavía no hay descargas registradas.", renderAdminDownloadItem);
    renderAdminList(containers.contacts, data.audience || data.contacts || [], "Todavía no hay contactos o intereses registrados.", renderAdminAudienceItem);
    renderAdminList(containers.events, data.events || [], "Todavía no hay eventos.", renderAdminEventItem);
    renderAdminList(containers.alerts, getAdminRequestAlerts(data.events || []), "No hay solicitudes privadas pendientes.", renderAdminRequestAlertItem);
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
  return `<div class="admin-list-item"><strong>${escapeHtml(item.titulo || item.full_name || formatAdminEventType(item.event_type) || "Registro")}</strong><small>${escapeHtml(formatAdminDateTime(item.created_at || item.last_seen_at))}</small></div>`;
}

function renderAdminReportItem(item) {
  const isPrivate = isPrivateReport(item);
  const privacyLabel = isPrivate ? "Privado" : "Publico";
  const privacyButtonLabel = isPrivate ? "Hacer publico" : "Hacer privado";
  const place = [cleanLegacyPrivateMarker(item.localidad), cleanLegacyPrivateMarker(item.provincia)].filter(Boolean).join(", ") || "Territorio";
  return `
    <div class="admin-list-item">
      <strong>${escapeHtml(item.titulo || "Radiografía sin título")}</strong>
      <span>${escapeHtml(place)}</span>
      <span class="admin-privacy-badge${isPrivate ? " is-private" : ""}">${privacyLabel}</span>
      ${item.file_name ? `<span>Archivo: ${escapeHtml(item.file_name)}</span>` : ""}
      <small>${escapeHtml(item.fecha ? formatDate(item.fecha) : formatAdminDateTime(item.created_at))}</small>
      <div class="admin-list-actions">
        ${item.html_url ? `<a class="admin-action-button" href="${escapeAttribute(item.html_url)}" target="_blank" rel="noopener">Abrir HTML</a>` : ""}
        ${item.pdf_url ? `<a class="admin-action-button" href="${escapeAttribute(item.pdf_url)}" target="_blank" rel="noopener">Abrir PDF</a>` : ""}
        ${item.pdf_url ? `<button class="admin-action-button" type="button" data-admin-add-html="${escapeAttribute(item.id || "")}">${item.html_url ? "Reemplazar HTML de grÃ¡ficos" : "Agregar HTML de grÃ¡ficos"}</button>` : ""}
        <button class="admin-action-button" type="button" data-admin-privacy="${escapeAttribute(item.id || "")}" data-private-next="${isPrivate ? "false" : "true"}">${privacyButtonLabel}</button>
        <button class="admin-action-button" type="button" data-admin-edit="${escapeAttribute(item.id || "")}">Modificar datos / reemplazar archivo</button>
        <button class="admin-action-button is-danger" type="button" data-admin-delete="${escapeAttribute(item.id || "")}">Borrar archivo</button>
      </div>
    </div>
  `;
}

function renderAdminDownloadItem(item) {
  const person = item.full_name || item.email || item.phone || "Visitante sin nombre registrado";
  const report = item.radiografia_title || "Radiografía no identificada";
  const phone = formatAdminPhone(item.phone);
  return `
    <div class="admin-list-item">
      <strong>${escapeHtml(person)}</strong>
      <span>Radiografía: ${escapeHtml(report)}</span>
      ${phone ? `<span>Teléfono: ${escapeHtml(phone)}</span>` : ""}
      <small>${escapeHtml(formatAdminDateTime(item.downloaded_at || item.created_at))}</small>
    </div>
  `;
}

function renderAdminPageConsumptionItem(item) {
  const title = item.title || item.path || "Pagina no identificada";
  const views = Number(item.page_views || 0);
  const visitors = Number(item.unique_visitors || 0);
  const seconds = Number(item.avg_read_seconds || 0);
  const scroll = Number(item.max_scroll_depth || 0);
  return `
    <div class="admin-list-item">
      <strong>${escapeHtml(title)}</strong>
      ${item.path ? `<span>Ruta: ${escapeHtml(item.path)}</span>` : ""}
      <span>${views} vistas | ${visitors} visitantes | ${seconds}s promedio | scroll ${scroll}%</span>
      <small>${escapeHtml(formatAdminDateTime(item.last_seen_at))}</small>
    </div>
  `;
}

function renderAdminContentConsumptionItem(item) {
  const total = Number(item.total_consumption || 0);
  const visitors = Number(item.unique_visitors || 0);
  return `
    <div class="admin-list-item">
      <strong>${escapeHtml(item.title || "Contenido no identificado")}</strong>
      <span>${total} consumos | ${visitors} visitantes</span>
      <span>Informe ${Number(item.report_open || 0)} | Graficos ${Number(item.open_graph || 0)} | PDF ${Number(item.download_report || 0)} | Pedidos ${Number(item.request_pdf || 0)}</span>
      <small>${escapeHtml(formatAdminDateTime(item.last_at))}</small>
    </div>
  `;
}

function renderAdminLocationConsumptionItem(item) {
  const label = item.label || [item.city, item.region, item.country].filter(Boolean).join(", ") || "IP sin ciudad detectada";
  return `
    <div class="admin-list-item">
      <strong>${escapeHtml(label)}</strong>
      <span>${Number(item.unique_visitors || 0)} visitantes | ${Number(item.page_views || 0)} vistas | ${Number(item.unique_ips || 0)} IPs</span>
      <span>${Number(item.events || 0)} eventos registrados</span>
      <small>${escapeHtml(formatAdminDateTime(item.last_seen_at))}</small>
    </div>
  `;
}

function renderAdminContactItem(item) {
  return `
    <div class="admin-list-item">
      <strong>${escapeHtml(item.full_name || item.email || item.phone || "Contacto")}</strong>
      <span>${escapeHtml([item.organization, item.phone_validation_status].filter(Boolean).join(" | "))}</span>
      <small>${escapeHtml(formatAdminDateTime(item.last_seen_at || item.created_at))}</small>
    </div>
  `;
}

function renderAdminPageJourney(items = []) {
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

function renderAdminContentJourney(items = []) {
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

function renderAdminAudienceItem(item) {
  const reports = (item.interested_reports || [])
    .map((report) => report.title)
    .filter(Boolean);
  const name = item.full_name || "Visitante sin nombre registrado";
  const phone = formatAdminPhone(item.phone) || "No informado";
  const email = item.email || "No informado";
  const visits = Number(item.visit_count || 0);
  const location = formatAdminGeo(item);
  const ip = item.ip_address || "No disponible (registro anterior a la captura)";
  const lastActivity = formatAdminDateTime(item.last_interest_at || item.last_seen_at || item.created_at);
  const reportTags = reports.length
    ? reports.map((title) => `<span class="admin-report-tag">${escapeHtml(title)}</span>`).join("")
    : '<span class="admin-report-tag">Sin radiografías identificadas</span>';

  return `
    <div class="admin-list-item admin-person-card" data-has-ip="${item.ip_address ? "true" : "false"}">
      <strong>${escapeHtml(name)}</strong>
      <div class="admin-person-grid">
        <div class="admin-person-field">
          <small>Nombre y apellido</small>
          <span>${escapeHtml(name)}</span>
        </div>
        <div class="admin-person-field">
          <small>Teléfono</small>
          ${item.phone ? `<a href="tel:${escapeAttribute(String(item.phone).replace(/\s+/g, ""))}">${escapeHtml(phone)}</a>` : `<span>${escapeHtml(phone)}</span>`}
        </div>
        <div class="admin-person-field">
          <small>Cantidad de visitas</small>
          <span>${visits}</span>
        </div>
        <div class="admin-person-field">
          <small>Última actividad</small>
          <span>${escapeHtml(lastActivity)}</span>
        </div>
        <div class="admin-person-field">
          <small>Correo electrónico</small>
          <span>${escapeHtml(email)}</span>
        </div>
        <div class="admin-person-field">
          <small>IP de ingreso</small>
          <span>${escapeHtml(ip)}</span>
        </div>
        <div class="admin-person-field is-wide">
          <small>Zona geográfica aproximada</small>
          <span>${escapeHtml(location)}</span>
        </div>
        <div class="admin-person-field is-wide">
          <small>Radiografías que visitó</small>
          <div class="admin-report-tags">${reportTags}</div>
        </div>
        <div class="admin-person-field is-wide">
          <small>Paginas por las que circulo</small>
          <div class="admin-report-tags">${renderAdminPageJourney(item.page_journey || [])}</div>
        </div>
        <div class="admin-person-field is-wide">
          <small>Consumo de contenidos</small>
          <div class="admin-report-tags">${renderAdminContentJourney(item.content_journey || [])}</div>
        </div>
      </div>
    </div>
  `;
}

function renderAdminEventItem(item) {
  const metadata = item.metadata || {};
  const contact = metadata.contact || {};
  const person = contact.full_name || contact.phone || contact.email || "Visitante sin nombre registrado";
  const report = item.radiografia_title ? ` · ${item.radiografia_title}` : "";
  const geo = formatAdminGeo(item);
  const network = [item.ip_address, geo === "Ubicación no disponible" ? "" : geo].filter(Boolean).join(" · ");
  const inferred = item.network_inferred ? " | IP vinculada por visitante" : "";
  return `
    <div class="admin-list-item" data-event-has-ip="${item.ip_address ? "true" : "false"}">
      <strong>${escapeHtml(formatAdminEventType(item.event_type))}${escapeHtml(report)}</strong>
      <span>${escapeHtml(person)} · ${escapeHtml(formatAdminPage(item.page, item.path))}</span>
      ${network ? `<span>Origen: ${escapeHtml(network + inferred)}</span>` : '<span>Origen: IP no disponible para este registro</span>'}
      <small>${escapeHtml(formatAdminDateTime(item.created_at))}</small>
    </div>
  `;
}

function getAdminRequestAlerts(events = []) {
  return events
    .filter((item) => ["private_report_access_requested", "private_report_registration_submitted", "report_access_requested"].includes(String(item.event_type || "")))
    .slice(0, 12);
}

function renderAdminRequestAlertItem(item) {
  const metadata = item.metadata || {};
  const contact = metadata.contact || {};
  const title = item.radiografia_title || metadata.title || metadata.radiografia_title || metadata.report_title || "Radiografía privada";
  const channels = metadata.delivery_channels || [];
  const person = contact.full_name || contact.phone || contact.email || "Visitante sin nombre";
  const phone = contact.phone || "";
  const email = contact.email || "";
  const message = buildAdminReplyMessage({ title, person, phone, email, event: item });
  const whatsappHref = phone ? `https://wa.me/${normalizeWhatsappPhone(phone)}?text=${encodeURIComponent(message)}` : "";
  const emailHref = email ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Radiografía solicitada: ${title}`)}&body=${encodeURIComponent(message)}` : "";
  return `
    <div class="admin-list-item" data-event-has-ip="${item.ip_address ? "true" : "false"}">
      <strong>Alerta: solicitud privada</strong>
      <span>${escapeHtml(title)}</span>
      <span>${escapeHtml(person)}${channels.length ? ` · Canal pedido: ${escapeHtml(channels.map((c) => c === "email" ? "Email" : "WhatsApp").join(" y "))}` : ""}</span>
      <small>${escapeHtml(formatAdminDateTime(item.created_at))}</small>
      <div class="admin-list-actions">
        ${whatsappHref ? `<a class="admin-action-button" href="${escapeAttribute(whatsappHref)}" target="_blank" rel="noopener">Responder WhatsApp</a>` : ""}
        ${emailHref ? `<a class="admin-action-button" href="${escapeAttribute(emailHref)}">Responder Email</a>` : ""}
      </div>
    </div>
  `;
}

function buildAdminReplyMessage({ title, person }) {
  return [
    `Hola ${person || ""}`.trim() + ".",
    `Gracias por solicitar la radiografía "${title}".`,
    "Te respondemos desde Consultora Diagonales para coordinar el envío.",
  ].join("\n");
}

function normalizeWhatsappPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) return `549${digits.slice(2)}`;
  return digits;
}

function formatAdminDateTime(value) {
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

function formatAdminPhone(value) {
  const phone = String(value || "").trim();
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("549") && digits.length >= 12) {
    return `+54 9 ${digits.slice(3, 6)} ${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return phone;
}

function formatAdminGeo(item) {
  const country = item.geo_country || item.geo_country_code;
  const parts = [item.geo_city, item.geo_region, country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Ubicación no disponible";
}

function formatAdminEventType(value) {
  const labels = {
    page_view: "Visita a una página",
    read_session: "Sesión de lectura",
    report_open: "Abrió una radiografía",
    report_access_requested: "Solicitó acceso a una radiografía",
    download_report: "Abrió o descargó un PDF",
    request_pdf: "Seleccionó un PDF",
    open_graph: "Abrió los gráficos",
    lead_form_submitted: "Envió sus datos de contacto",
    share_lead_submitted: "Compartió una radiografía",
    request_brief_generated: "Generó una solicitud",
  };
  return labels[value] || String(value || "Actividad").replaceAll("_", " ");
}

function formatAdminPage(pageValue, pathValue) {
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

async function saveRadiografiaReport({ id, pdfFile, htmlFile, titulo, provincia, localidad, fecha, isPrivate }) {
  const uploads = [
    hasUploadFile(pdfFile) ? pdfFile : null,
    hasUploadFile(htmlFile) ? htmlFile : null,
  ].filter(Boolean);

  if (!uploads.length && id) return updateRadiografiaReport({ id, titulo, provincia, localidad, fecha, isPrivate });

  let currentId = id;
  let result = null;
  for (const file of uploads.length ? uploads : [null]) {
    result = currentId
      ? await updateRadiografiaReport({ id: currentId, file, titulo, provincia, localidad, fecha, isPrivate })
      : await uploadRadiografiaFile({ file, titulo, provincia, localidad, fecha, isPrivate });
    currentId = result.report?.id || currentId;
  }

  return result?.report || result || {};
}

function renderAdminHtmlPicker(reports) {
  const select = document.querySelector("[data-admin-html-select]");
  const action = document.querySelector("[data-admin-html-select-action]");
  if (!select) return;

  const candidates = (reports || []).filter((item) => item.pdf_url || item.html_url);
  if (!candidates.length) {
    select.innerHTML = '<option value="">TodavÃ­a no hay radiografÃ­as cargadas</option>';
    if (action) action.disabled = true;
    return;
  }

  select.innerHTML = [
    '<option value="">Seleccionar radiografÃ­a</option>',
    ...candidates.map((item) => {
      const status = item.html_url ? "HTML cargado" : "sin HTML";
      const label = `${item.titulo || "RadiografÃ­a sin tÃ­tulo"} - ${item.fecha || "sin fecha"} - ${status}`;
      return `<option value="${escapeAttribute(item.id || "")}">${escapeHtml(label)}</option>`;
    }),
  ].join("");
  if (action) action.disabled = false;
}

async function updateRadiografiaReport({ id, file, titulo, provincia, localidad, fecha, isPrivate }) {
  const adminKey = sessionStorage.getItem(ADMIN_UPLOAD_KEY) || "";
  const formData = new FormData();
  formData.append("id", id);
  formData.append("titulo", titulo);
  formData.append("provincia", cleanLegacyPrivateMarker(provincia));
  formData.append("localidad", cleanLegacyPrivateMarker(localidad));
  formData.append("fecha", fecha);
  formData.append("is_private", isPrivate ? "true" : "false");
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

async function setRadiografiaPrivacy(report, isPrivate) {
  const adminKey = sessionStorage.getItem(ADMIN_UPLOAD_KEY) || "";
  const formData = new FormData();
  formData.append("id", report.id || "");
  formData.append("is_private", isPrivate ? "true" : "false");

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
  if (!response.ok) throw new Error(data.error || "No se pudo cambiar la privacidad.");
  return data.report || data;
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

async function uploadRadiografiaFile({ file, titulo, provincia, localidad, fecha, isPrivate }) {
  if (window.CD_ADMIN?.useEdgeUpload === false) {
    throw new Error("La carga directa desde el navegador está deshabilitada. Usá la Edge Function admin-upload-report.");
  }

    const adminKey = sessionStorage.getItem(ADMIN_UPLOAD_KEY) || "";
    const formData = new FormData();
    formData.append("archivo", file);
    formData.append("titulo", titulo);
    formData.append("provincia", cleanLegacyPrivateMarker(provincia));
    formData.append("localidad", cleanLegacyPrivateMarker(localidad));
    formData.append("fecha", fecha);
    formData.append("is_private", isPrivate ? "true" : "false");

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
    if (!response.ok) throw new Error(data.error || "No se pudo publicar el archivo.");
    return data;
}

function isReportFile(file) {
  const name = file.name.toLowerCase();
  return file.type === "application/pdf" || file.type === "text/html" || name.endsWith(".pdf") || name.endsWith(".html") || name.endsWith(".htm");
}

function hasUploadFile(file) {
  return file instanceof File && file.size > 0;
}

function isPdfFile(file) {
  const name = file.name.toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
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
