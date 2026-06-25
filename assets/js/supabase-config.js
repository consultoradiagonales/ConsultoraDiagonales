window.CD_SUPABASE = {
  url: "https://fmtjbfufuprkfwneokuk.supabase.co",
  anonKey: "sb_publishable_uyzkF055kqQYzmTY1mJaRQ_53M35zXL",
};

window.CD_ADMIN = {
  useEdgeUpload: true,
};

window.setTimeout(() => {
  const config = window.CD_SUPABASE || {};
  if (!config.url || !config.anonKey || typeof window.trackEvent !== "function") return;
  if (String(window.trackEvent).includes("track-visitor-event")) return;

  window.trackEvent = async function (eventType, metadata = {}, keepalive = false) {
    const contact = JSON.parse(localStorage.getItem("cd:contact") || "{}");
    const visitorId = localStorage.getItem("cd:visitor_id");
    if (!visitorId) return;
    const event = {
      visitor_id: visitorId,
      event_type: eventType,
      page: document.body.dataset.page,
      path: location.pathname,
      metadata: {
        ...metadata,
        contact: {
          email: contact.email || null,
          phone: contact.phone || null,
          full_name: contact.full_name || null,
          organization: contact.organization || null,
        },
      },
      user_agent: navigator.userAgent,
    };
    await fetch(`${config.url}/functions/v1/track-visitor-event`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.anonKey}`,
        apikey: config.anonKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(event),
      keepalive,
    }).catch(() => null);
  };

  window.trackEvent("network_snapshot", { title: document.title });
}, 0);
