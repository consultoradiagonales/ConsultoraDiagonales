(function () {
  const SHARE_CLASS = "radiografia-share-link";
  const SHARE_LABEL = "Compartir por WhatsApp";
  const SLOGAN = "Data Analytics aplicado al territorio, opinion publica y escenarios de poder.";

  const observer = new MutationObserver(addShareLinks);
  document.addEventListener("DOMContentLoaded", () => {
    addShareLinks();
    document.querySelectorAll("[data-reports]").forEach((container) => {
      observer.observe(container, { childList: true, subtree: true });
    });
  });

  function addShareLinks() {
    document.querySelectorAll(".report-card").forEach(addCardShareLink);
    document.querySelectorAll(".latest-list > a").forEach(addListShareLink);
  }

  function addCardShareLink(card) {
    if (card.querySelector(`.${SHARE_CLASS}`)) return;

    const title = card.querySelector("h2")?.textContent?.trim() || "Radiografia de Consultora Diagonales";
    const primaryLink = card.querySelector("[data-report-open], [data-pdf-download]");
    const shareUrl = buildShareUrl(primaryLink?.href);
    const actions = card.querySelector(".report-actions");
    if (!actions) return;

    actions.insertAdjacentHTML("beforeend", buildShareAnchor(title, shareUrl));
  }

  function addListShareLink(row) {
    if (row.dataset.shareEnhanced === "true") return;

    const title = row.querySelector("span")?.textContent?.trim() || "Radiografia de Consultora Diagonales";
    const shareUrl = buildShareUrl(row.href);
    const share = document.createElement("a");
    share.className = `${SHARE_CLASS} ${SHARE_CLASS}--list`;
    share.href = buildWhatsappHref(title, shareUrl);
    share.target = "_blank";
    share.rel = "noopener";
    share.textContent = "WhatsApp";
    share.setAttribute("aria-label", `${SHARE_LABEL}: ${title}`);
    share.addEventListener("click", (event) => event.stopPropagation());

    row.dataset.shareEnhanced = "true";
    row.insertAdjacentElement("afterend", share);
  }

  function buildShareAnchor(title, shareUrl) {
    return `<a class="${SHARE_CLASS}" href="${escapeAttribute(buildWhatsappHref(title, shareUrl))}" target="_blank" rel="noopener" aria-label="${escapeAttribute(`${SHARE_LABEL}: ${title}`)}">${SHARE_LABEL}</a>`;
  }

  function buildShareUrl(candidate) {
    try {
      const url = new URL(candidate || window.location.href, window.location.href);
      if (url.pathname.includes("/registro/")) return repositoryUrl();
      return url.href;
    } catch (_) {
      return repositoryUrl();
    }
  }

  function repositoryUrl() {
    return new URL("/repositorio/index.html", window.location.origin).href;
  }

  function buildWhatsappHref(title, shareUrl) {
    const message = [
      "Consultora Diagonales",
      SLOGAN,
      "",
      title,
      shareUrl,
    ].join("\n");
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  function escapeAttribute(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
