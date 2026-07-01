(function () {
  const CONTACT_STORAGE_KEY = "cd:contact";
  const PHONE_VERIFIED_KEY = "cd:phone_verified";

  document.addEventListener("submit", handleRegistrationSubmit, true);

  async function handleRegistrationSubmit(event) {
    const form = event.target.closest("[data-registration-form]");
    if (!form) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const status = document.querySelector("[data-registration-status]");
    const submit = document.querySelector("[data-registration-submit]");
    const phone = String(new FormData(form).get("phone") || "").trim();
    const fullName = String(new FormData(form).get("full_name") || "").trim();
    const email = String(new FormData(form).get("email") || "").trim().toLowerCase();
    const organization = String(new FormData(form).get("organization") || "").trim();
    const requestContext = getPrivateRequestContext();

    if (!phone) {
      if (status) status.textContent = "Dejanos un celular para habilitar la lectura.";
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = "Guardando celular...";
    }
    if (status) status.textContent = "Guardando contacto.";

    const contact = {
      visitor_id: getVisitorId(),
      phone,
      email,
      full_name: fullName,
      organization,
      access_reason: "pdf_download",
      phone_validation_status: "phone_verified",
      consent_terms: true,
      last_seen_at: new Date().toISOString(),
      tags: Array.from(new Set(["descarga_pdf", "celular_validado", requestContext ? "solicitud_radiografia" : ""].filter(Boolean))),
    };

    localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify({ ...getStoredContact(), ...contact }));
    localStorage.setItem(PHONE_VERIFIED_KEY, phone);

    try {
      await saveContact(contact);
      if (requestContext) await saveVisitorEvent(contact, requestContext);
    } catch (error) {
      console.warn("No se pudo guardar el contacto remoto", error);
    }

    if (status) status.textContent = requestContext ? "Listo. Solicitud registrada." : "Listo. Te llevamos a las radiografias.";
    window.location.href = getRedirectTarget();
  }

  async function saveContact(contact) {
    const config = window.CD_SUPABASE || {};
    if (!config.url || !config.anonKey) return;

    const response = await fetch(`${config.url}/rest/v1/contactos`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "content-type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(contact),
    });

    if (!response.ok) throw new Error(`contactos ${response.status}`);
  }

  async function saveVisitorEvent(contact, requestContext) {
    const config = window.CD_SUPABASE || {};
    if (!config.url || !config.anonKey) return;

    const event = {
      visitor_id: contact.visitor_id,
      event_type: "private_report_registration_submitted",
      page: "registro",
      path: window.location.pathname,
      metadata: {
        radiografia_id: requestContext.reportId || null,
        title: requestContext.reportTitle || null,
        target_type: requestContext.targetType || "pdf",
        contact: {
          email: contact.email || null,
          phone: contact.phone || null,
          full_name: contact.full_name || null,
          organization: contact.organization || null,
          phone_validation_status: contact.phone_validation_status || null,
        },
      },
      user_agent: navigator.userAgent,
    };

    const response = await fetch(`${config.url}/rest/v1/visitor_events`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) throw new Error(`visitor_events ${response.status}`);
  }

  function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (!next) return "../repositorio/index.html?v=phone-access";

    try {
      const target = new URL(next, window.location.href);
      if (target.origin !== window.location.origin) return "../repositorio/index.html?v=phone-access";
      target.searchParams.set("access", "phone");
      return target.href;
    } catch (_) {
      return "../repositorio/index.html?v=phone-access";
    }
  }

  function getPrivateRequestContext() {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get("report") || sessionStorage.getItem("cd:private_report_after_registration") || "";
    const targetType = params.get("target") || params.get("private_target") || sessionStorage.getItem("cd:private_report_after_registration_target") || "pdf";
    const reportTitle = params.get("pdf") || params.get("titulo") || params.get("title") || "";

    if (!reportId && !reportTitle && !params.get("next")) return null;
    return { reportId, targetType, reportTitle };
  }

  function getStoredContact() {
    try {
      return JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}");
    } catch (_) {
      return {};
    }
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
})();
