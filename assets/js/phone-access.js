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
    const data = new FormData(form);
    const hasChannelInputs = form.querySelector("[data-channel]") != null;
    const phone = String(data.get("phone") || "").trim();
    const fullName = String(data.get("full_name") || "").trim();
    const email = String(data.get("email") || "").trim().toLowerCase();
    const organization = String(data.get("organization") || "").trim();
    const requestContext = getPrivateRequestContext();

    const channels = [];
    if (hasChannelInputs) {
      if (data.get("canal_email") != null) channels.push("email");
      if (data.get("canal_whatsapp") != null) channels.push("whatsapp");

      if (!channels.length) {
        if (status) status.textContent = "Elegí al menos un canal: Email o WhatsApp.";
        return;
      }
      if (channels.includes("email") && !email) {
        if (status) status.textContent = "Marcaste Email: ingresá tu correo.";
        return;
      }
      if (channels.includes("whatsapp") && !phone) {
        if (status) status.textContent = "Marcaste WhatsApp: ingresá tu celular.";
        return;
      }
    } else if (!phone && !email) {
      if (status) status.textContent = "Dejanos un email o un celular para enviarte la radiografía.";
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = "Enviando solicitud...";
    }
    if (status) status.textContent = "Guardando contacto.";

    const contact = {
      visitor_id: getVisitorId(),
      phone,
      email,
      full_name: fullName,
      organization,
      access_reason: requestContext ? "solicitud_radiografia_privada" : "pdf_download",
      phone_validation_status: phone ? "phone_verified" : "pending",
      consent_terms: true,
      last_seen_at: new Date().toISOString(),
      tags: Array.from(
        new Set([
          requestContext ? "solicitud_radiografia" : "descarga_pdf",
          channels.includes("email") || email ? "canal_email" : "",
          channels.includes("whatsapp") || (!channels.length && phone) ? "canal_whatsapp" : "",
          phone ? "celular_validado" : "",
        ].filter(Boolean)),
      ),
    };

    localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify({ ...getStoredContact(), ...contact }));
    if (phone) localStorage.setItem(PHONE_VERIFIED_KEY, phone);

    try {
      await saveContact(contact);
      await saveVisitorEvent(contact, requestContext, channels);
    } catch (error) {
      console.warn("No se pudo guardar el contacto remoto", error);
    }

    const channelNames = (channels.length ? channels : [phone ? "whatsapp" : "", email ? "email" : ""].filter(Boolean))
      .map((c) => (c === "email" ? "Email" : "WhatsApp"))
      .join(" y ");
    if (status) {
      status.textContent = requestContext
        ? `Listo. Solicitud registrada: te enviaremos la radiografía por ${channelNames || "el canal indicado"}.`
        : "Listo. Te llevamos a las radiografias.";
    }
    if (requestContext) {
      if (submit) submit.textContent = "Solicitud enviada ✓";
      window.setTimeout(() => {
        window.location.href = getRedirectTarget();
      }, 2200);
      return;
    }
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

  async function saveVisitorEvent(contact, requestContext, channels = []) {
    const config = window.CD_SUPABASE || {};
    if (!config.url || !config.anonKey) return;

    const event = {
      visitor_id: contact.visitor_id,
      event_type: requestContext ? "private_report_registration_submitted" : "reader_registration_submitted",
      page: "registro",
      path: window.location.pathname,
      metadata: {
        radiografia_id: requestContext?.reportId || null,
        title: requestContext?.reportTitle || null,
        target_type: requestContext?.targetType || "pdf",
        delivery_channels: channels,
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

    // Edge function: el backend captura y persiste IP + geolocalización del solicitante.
    const response = await fetch(`${config.url}/functions/v1/track-visitor-event`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) throw new Error(`track-visitor-event ${response.status}`);
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
