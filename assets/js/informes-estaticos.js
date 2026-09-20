// Generado por scripts/publicar-notas.mjs. No editar a mano.
// Radiografias publicadas como archivo del sitio: Storage entrega los HTML como
// text/plain y sus enlaces firmados vencen, asi que la tarjeta "Informe completo"
// apunta directo a estos archivos. Clave: id de la radiografia en Supabase.
window.CD_INFORMES_ESTATICOS = {
  "1bc86a78-08da-43e9-9ce3-e12f618dee56": {
    titulo: "Patricia Bullrich y la señal «No me importa»",
    html: "/radiografias/patricia-bullrich-y-la-senal-no-me-importa.html",
    pdf: "/radiografias/patricia-bullrich-y-la-senal-no-me-importa.pdf",
  },
};

window.informeEstatico = function informeEstatico(reportId) {
  return (window.CD_INFORMES_ESTATICOS || {})[String(reportId || "")] || null;
};
