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
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
let adminReports = [];

initNavigation();
initLogoFallbacks();
initActiveNavigation();
initFooterText();
initLoginModal();
initTracking();
initLeadForms();
initHtmlReportViewer();

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
  const event = buildVisitorEvent(eventType, metadata);

  const events = JSON.parse(localStorage.getItem("cd:events") || "[]");
  events.push({ ...event, at: new Date().toISOString() });
  localStorage.setItem("cd:events", JSON.stringify(events.slice(-100)));

  if (!supabaseClient) return;
  try {
    if (useBeacon) {
      await persistVisitorEventWithKeepalive(event);
    } else {
      await supabaseClient.from("visitor_events").insert(event);
    }
    await supabaseClient.rpc("register_visitor_touch", { p_visitor_id: event.visitor_id });
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

async function persistVisitorEventWithKeepalive(event) {
  await fetch(`${SUPABASE_URL}/rest/v1/visitor_events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "content-type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(event),
    keepalive: true,
  });
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
      const { data, error } = await supabaseClient
        .from("radiografias")
        .select("id, titulo, provincia, localidad, fecha, html_url, pdf_url, created_at")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      reports = data || [];
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
      const graphsUrl = getReportGraphsUrl(report);
      const graphsHref = escapeAttribute(graphsUrl || "#");
      const pdfHref = escapeAttribute(getPdfDownloadHref(report));
      const pdfLabel = hasPdfAccess() && report.pdf_url ? "Abrir PDF" : "Validar acceso";
      const reportIndexAttribute = ` data-report-index="${index}"`;
      const graphsAttribute = graphsUrl ? ` data-graphs-url="${graphsHref}"` : "";

      if (isCompactList) {
        return `
          <a href="${pdfHref}"${reportIndexAttribute}${graphsAttribute} data-pdf-download data-track="request_pdf">
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
            ${graphsUrl ? `<a class="download-link graph-link" href="${graphsHref}" data-html-viewer-open data-report-open data-report-index="${index}" data-track="open_graph">GrÃ¡ficos</a>` : ""}
            <a class="request-link" href="${pdfHref}" data-pdf-download data-report-index="${index}" data-track="request_pdf">${pdfLabel}</a>
          </div>
        </article>
      `;
    })
    .join("");

  bindPdfDownloadLinks(container, reports);
  bindReportOpenLinks(container, reports);
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

function hasPdfAccess() {
  const contact = JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}");
  const gmailValidated = localStorage.getItem(GMAIL_VERIFIED_KEY) === contact.visitor_id;
  const phoneValidated = localStorage.getItem(PHONE_VERIFIED_KEY) === contact.phone;
  const statusValidated = ["phone_verified", "gmail_verified"].includes(contact.phone_validation_status);
  return Boolean(contact.phone && (gmailValidated || phoneValidated || statusValidated));
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
      if (!report) return;

      event.preventDefault();
      if (!hasPdfAccess() || !report.pdf_url) {
        await logReportInterest(report, "report_access_requested", link.href);
        window.location.href = link.href;
        return;
      }

      await logPdfDownload(report);
      openPdfViewer(report);
    });
  });
}

function openPdfViewer(report) {
  if (!report?.pdf_url) return;

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
              <button type="button" data-pdf-viewer-close aria-label="Cerrar visor">Cerrar</button>
            </div>
          </div>
          <div class="pdf-viewer__mobile-note" data-pdf-viewer-note>
            Cargando paginas del PDF dentro de la web.
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
  viewer.querySelector("[data-pdf-viewer-title]").textContent = title;
  frame.src = isMobileViewport() ? "about:blank" : report.pdf_url;
  viewer.classList.add("is-open");
  viewer.setAttribute("aria-hidden", "false");
  document.body.classList.add("pdf-viewer-open");

  if (isMobileViewport()) renderMobilePdf(viewer, report.pdf_url);
}

function closePdfViewer() {
  const viewer = document.querySelector("[data-pdf-viewer]");
  if (!viewer) return;

  const frame = viewer.querySelector("[data-pdf-viewer-frame]");
  viewer.classList.remove("is-open");
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
  pages.classList.add("is-loading");
  pages.textContent = "Cargando PDF...";

  try {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument(pdfUrl).promise;
    pages.replaceChildren();
    pages.classList.remove("is-loading");

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
    pages.innerHTML = '<p>No se pudo previsualizar el PDF en este navegador. Tocá "Abrir PDF" para verlo.</p>';
    console.warn("No se pudo renderizar el PDF movil", error);
  }
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

      await logReportInterest(report, "report_open", report.html_url || link.href);
    });
  });
}

function initHtmlReportViewer() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-html-viewer-open]");
    if (!link) return;

    event.preventDefault();
    openHtmlReportViewer(new URL(link.href, window.location.href).href, getHtmlViewerTitle(link));
  });

  openSharedHtmlViewerFromUrl();
}

async function openHtmlReportViewer(url, title) {
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
            <button type="button" data-html-viewer-whatsapp>WhatsApp</button>
            <button type="button" data-html-viewer-close aria-label="Cerrar visor">Cerrar</button>
          </div>
        </div>
        <iframe data-html-viewer-frame title="Visor de graficos" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-forms"></iframe>
      </div>
    `;
    document.body.appendChild(viewer);

    viewer.addEventListener("click", (event) => {
      const whatsappButton = event.target.closest("[data-html-viewer-whatsapp]");
      if (whatsappButton) {
        shareHtmlViewerByWhatsapp(viewer.__cdHtmlViewer || { url, title });
        return;
      }
      if (event.target === viewer || event.target.closest("[data-html-viewer-close]")) closeHtmlReportViewer();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && viewer.classList.contains("is-open")) closeHtmlReportViewer();
    });
  }

  viewer.querySelector("[data-html-viewer-title]").textContent = title;
  viewer.__cdHtmlViewer = { url, title };
  const frame = viewer.querySelector("[data-html-viewer-frame]");
  frame.removeAttribute("src");
  frame.srcdoc = buildHtmlViewerLoading();
  viewer.classList.add("is-open");
  viewer.setAttribute("aria-hidden", "false");
  document.body.classList.add("html-viewer-open");

  try {
    const html = await fetchHtmlForViewer(url);
    frame.srcdoc = normalizeHtmlForViewer(html, url);
  } catch (error) {
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

function openSharedHtmlViewerFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const htmlUrl = params.get("html_viewer") || params.get("html") || params.get("grafico");
  if (!htmlUrl) return;

  try {
    const url = new URL(htmlUrl, window.location.href).href;
    const title = params.get("titulo") || params.get("title") || "Radiografía";
    window.setTimeout(() => openHtmlReportViewer(url, title), 250);
  } catch (error) {
    console.warn("No se pudo abrir el HTML compartido", error);
  }
}

function buildHtmlViewerShareUrl({ url, title }) {
  const shareUrl = new URL("/repositorio/index.html", window.location.origin);
  shareUrl.searchParams.set("html_viewer", url);
  shareUrl.searchParams.set("titulo", title || "Radiografía");
  return shareUrl.href;
}

function buildHtmlViewerWhatsappHref(data) {
  const title = data?.title || "Radiografía";
  const shareUrl = buildHtmlViewerShareUrl(data);
  const message = `Mirá esta radiografía de Consultora Diagonales: ${title}\n${shareUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function shareHtmlViewerByWhatsapp(data) {
  if (!data?.url) return;
  const href = buildHtmlViewerWhatsappHref(data);
  window.open(href, "_blank", "noopener");
  trackEvent?.("share_html_viewer_whatsapp", {
    title: data.title || null,
    html_url: data.url,
    share_url: buildHtmlViewerShareUrl(data),
  }, true);
}

async function fetchHtmlForViewer(url) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

function normalizeHtmlForViewer(html, sourceUrl) {
  const base = `<base href="${escapeAttribute(new URL(sourceUrl, window.location.href).href)}">`;
  const bridge = buildHtmlViewerExternalLinkBridge();
  let output = String(html || "");
  if (/<head[^>]*>/i.test(output)) {
    output = output.replace(/<head[^>]*>/i, (match) => `${match}\n${base}`);
  } else {
    output = `<!doctype html><html lang="es"><head><meta charset="UTF-8">${base}</head><body>${output}</body></html>`;
  }
  if (/<\/body>/i.test(output)) {
    output = output.replace(/<\/body>/i, `${bridge}\n</body>`);
  } else {
    output += bridge;
  }
  return output;
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

function buildHtmlViewerLoading() {
  return `<!doctype html><html><body style="margin:0;display:grid;min-height:100vh;place-items:center;background:#061522;color:#dff9ff;font-family:Arial,sans-serif">Cargando gr&aacute;ficos...</body></html>`;
}

function buildHtmlViewerError(url) {
  return `<!doctype html><html><body style="margin:0;display:grid;min-height:100vh;place-items:center;background:#061522;color:#dff9ff;font-family:Arial,sans-serif;text-align:center;padding:24px"><div><h1 style="font-size:20px">No se pudo cargar el HTML dentro del visor.</h1><p>Prob&aacute; abrir el archivo desde el panel admin y volver a cargarlo.</p><a style="color:#7ce3ff" href="${escapeAttribute(url)}" target="_blank" rel="noopener">Abrir archivo</a></div></body></html>`;
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
      const data = await saveRadiografiaReport({ id, pdfFile, htmlFile, titulo, provincia, localidad, fecha });
      const links = [
        data.pdf_url ? `<a href="${escapeAttribute(data.pdf_url)}" target="_blank" rel="noopener">Abrir PDF</a>` : "",
        data.html_url ? `<a href="${escapeAttribute(data.html_url)}" data-html-viewer-open>Abrir HTML</a>` : "",
      ].filter(Boolean).join(" | ");
      const publicUrl = data.pdf_url || data.html_url;
      const fileLabel = data.html_url && !data.pdf_url ? "HTML" : "archivo";

      resetAdminForm();
      status.innerHTML = id
        ? `Radiografía actualizada. ${links || (publicUrl ? `<a href="${escapeAttribute(publicUrl)}" target="_blank" rel="noopener">Abrir ${fileLabel}</a>` : "")}`
        : `Archivo publicado. ${links || `<a href="${escapeAttribute(publicUrl)}" target="_blank" rel="noopener">Abrir ${fileLabel}</a>`}`;
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
  form.elements.provincia.value = report.provincia || "";
  form.elements.localidad.value = report.localidad || "";
  form.elements.fecha.value = report.fecha || "";
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
    renderAdminHtmlPicker(adminReports);
    setAdminTotal("reports", data.totals?.reports ?? adminReports.length);
    setAdminTotal("downloads", data.totals?.downloads ?? data.downloads?.length ?? 0);
    setAdminTotal("contacts", data.totals?.audience ?? data.totals?.contacts ?? data.contacts?.length ?? 0);
    setAdminTotal("events", data.totals?.events ?? data.events?.length ?? 0);
    renderAdminList(containers.reports, data.reports || [], "Todavía no hay radiografías cargadas.", renderAdminReportItem);
    setAdminDashboardStatus(`${adminReports.length} radiografía${adminReports.length === 1 ? "" : "s"}/PDF cargado${adminReports.length === 1 ? "" : "s"}.`);
    renderAdminList(containers.downloads, data.downloads || [], "Todavía no hay descargas registradas.", renderAdminDownloadItem);
    renderAdminList(containers.contacts, data.audience || data.contacts || [], "Todavía no hay contactos o intereses registrados.", renderAdminAudienceItem);
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
        ${item.html_url ? `<a class="admin-action-button" href="${escapeAttribute(item.html_url)}" data-html-viewer-open>Abrir HTML</a>` : ""}
        ${item.pdf_url ? `<a class="admin-action-button" href="${escapeAttribute(item.pdf_url)}" target="_blank" rel="noopener">Abrir PDF</a>` : ""}
        ${item.pdf_url ? `<button class="admin-action-button" type="button" data-admin-add-html="${escapeAttribute(item.id || "")}">${item.html_url ? "Reemplazar HTML de grÃ¡ficos" : "Agregar HTML de grÃ¡ficos"}</button>` : ""}
        <button class="admin-action-button" type="button" data-admin-edit="${escapeAttribute(item.id || "")}">Modificar datos / reemplazar archivo</button>
        <button class="admin-action-button is-danger" type="button" data-admin-delete="${escapeAttribute(item.id || "")}">Borrar archivo</button>
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

function renderAdminAudienceItem(item) {
  const reports = (item.interested_reports || [])
    .map((report) => report.title || report.radiografia_id)
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");
  const contact = [item.full_name, item.organization, item.email, item.phone].filter(Boolean).join(" | ");
  const activity = [
    item.report_views ? `${item.report_views} vistas` : "",
    item.report_requests ? `${item.report_requests} pedidos` : "",
    item.downloads ? `${item.downloads} descargas` : "",
    item.visit_count ? `${item.visit_count} visitas` : "",
  ].filter(Boolean).join(" | ");

  return `
    <div class="admin-list-item">
      <strong>${escapeHtml(contact || item.visitor_id || "Visitante")}</strong>
      ${activity ? `<span>${escapeHtml(activity)}</span>` : ""}
      ${reports ? `<span>Interés: ${escapeHtml(reports)}</span>` : ""}
      <small>${escapeHtml(item.last_interest_at || item.last_seen_at || item.created_at || "")}</small>
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

async function saveRadiografiaReport({ id, pdfFile, htmlFile, titulo, provincia, localidad, fecha }) {
  const uploads = [
    hasUploadFile(pdfFile) ? pdfFile : null,
    hasUploadFile(htmlFile) ? htmlFile : null,
  ].filter(Boolean);

  if (!uploads.length && id) return updateRadiografiaReport({ id, titulo, provincia, localidad, fecha });

  let currentId = id;
  let result = null;
  for (const file of uploads.length ? uploads : [null]) {
    result = currentId
      ? await updateRadiografiaReport({ id: currentId, file, titulo, provincia, localidad, fecha })
      : await uploadRadiografiaFile({ file, titulo, provincia, localidad, fecha });
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

async function uploadRadiografiaFile({ file, titulo, provincia, localidad, fecha }) {
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
