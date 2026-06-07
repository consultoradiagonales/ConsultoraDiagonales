const fs = require("node:fs/promises");
const path = require("node:path");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://fmtjbfufuprkfwneokuk.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_uyzkF055kqQYzmTY1mJaRQ_53M35zXL";

const IMPORTERS = {
  igj: {
    label: "IGJ entidades/autoridades",
    source: "IGJ / Datos Justicia Argentina",
    module: "Societario y boletines",
    sourceUrl: "https://github.com/datos-justicia-argentina/Entidades-constituidas-en-la-Inspeccion-General-de-Justicia",
    sourceKey: "igj"
  },
  afip_padron: {
    label: "Padron AFIP/ARCA local",
    source: "Padron AFIP/ARCA",
    module: "Identidad fiscal",
    sourceUrl: "http://www.afip.gob.ar/genericos/cInscripcion/archivos/apellidoNombreDenominacion.zip",
    sourceKey: "arca_padron"
  },
  generic: {
    label: "Dataset generico",
    source: "Dataset importado",
    module: "Base propia",
    sourceUrl: "",
    sourceKey: "dataset"
  }
};

function usage() {
  return [
    "Uso:",
    "  npm.cmd run osint:import -- --type igj --file ruta\\archivo.csv",
    "  npm.cmd run osint:import -- --type afip_padron --file ruta\\archivo.csv",
    "",
    "Opciones:",
    "  --dry-run       Procesa sin subir a Supabase",
    "  --limit N       Importa solo N filas",
    "  --encoding utf8 Codificacion de lectura; por defecto utf8"
  ].join("\n");
}

function parseArgs(argv) {
  const args = { type: "generic", file: "", dryRun: false, limit: 0, encoding: "utf8" };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--dry-run") args.dryRun = true;
    else if (item === "--type") args.type = argv[++i] || args.type;
    else if (item === "--file") args.file = argv[++i] || "";
    else if (item === "--limit") args.limit = Number(argv[++i] || 0);
    else if (item === "--encoding") args.encoding = argv[++i] || "utf8";
  }
  return args;
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCuit(value) {
  const numeric = digits(value);
  return numeric.replace(/^(\d{2})(\d{8})(\d)$/, "$1-$2-$3");
}

function parseDelimited(content) {
  const firstLine = content.split(/\r?\n/, 1)[0] || "";
  const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];
    if (quoted && char === '"' && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(field);
      field = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some(cell => cell.trim())) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

async function readRows(file, encoding) {
  const content = await fs.readFile(file, encoding);
  if (/\.json$/i.test(file)) {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : parsed.rows || parsed.data || [];
  }
  return parseDelimited(content);
}

function pick(row, names) {
  for (const name of names) {
    const key = normalizeHeader(name);
    if (row[key] !== undefined && String(row[key]).trim()) return String(row[key]).trim();
  }
  return "";
}

function buildSubjectFromRow(row, importer) {
  const cuit = pick(row, ["cuit", "nro_doc", "nro_documento", "numero_cuit", "cuil", "cuit_cuil"]);
  const dni = pick(row, ["numero_documento", "dni", "documento", "nro_dni"]);
  const name = normalizeName(pick(row, ["razon_social", "denominacion", "apellido_nombre", "nombre", "apellido_y_nombre"]));
  const province = normalizeName(pick(row, ["provincia", "jurisdiccion"]));
  const address = normalizeName([
    pick(row, ["calle", "direccion", "domicilio"]),
    pick(row, ["numero"]),
    pick(row, ["localidad"])
  ].filter(Boolean).join(" "));
  const normalizedCuit = digits(cuit).length === 11 ? digits(cuit) : "";
  const normalizedDni = digits(dni);
  const primary = normalizedCuit || normalizedDni || name;

  if (!primary) return null;

  const terms = [
    primary,
    normalizedCuit,
    normalizedCuit && formatCuit(normalizedCuit),
    normalizedDni,
    name
  ].filter(Boolean);

  const subjectType = importer.sourceKey === "igj" && pick(row, ["razon_social"]) ? "company" : "person";
  const findings = [];
  const title = name || primary;

  findings.push({
    source: importer.source,
    module: importer.module,
    title,
    url: importer.sourceUrl,
    confidence: "Alta",
    status: "automatico",
    summary: [
      name && `Nombre/razon social: ${name}`,
      normalizedCuit && `CUIT: ${formatCuit(normalizedCuit)}`,
      normalizedDni && `DNI/documento: ${normalizedDni}`,
      province && `Provincia: ${province}`,
      address && `Domicilio/localidad: ${address}`
    ].filter(Boolean).join(". "),
    importedRow: row
  });

  return {
    subject: {
      identifier: primary,
      numeric: normalizedCuit || normalizedDni,
      derivedDni: normalizedCuit ? normalizedCuit.slice(2, 10).replace(/^0+/, "") : normalizedDni,
      name,
      province,
      variants: normalizedCuit ? [normalizedCuit] : [],
      terms: [...new Set(terms)],
      discoveredNames: name ? [name] : []
    },
    researchPlan: {
      target: name || primary,
      targetType: subjectType,
      jurisdiction: province || "Argentina",
      objective: "dataset_import"
    },
    moduleResults: [{
      id: importer.sourceKey,
      name: importer.label,
      category: importer.module,
      status: "ok",
      summary: `Registro importado desde ${importer.source}.`,
      evidence: [{ title, url: importer.sourceUrl, source: importer.source, confidence: "Alta" }]
    }],
    findings
  };
}

function buildPayload(record) {
  const now = new Date().toISOString();
  return {
    ...record,
    history: { source: "dataset_import" },
    startedAt: now,
    finishedAt: now,
    sources: [],
    queries: [],
    score: { risk: 0, label: "Sin evidencia negativa", confidence: "Alta" },
    disclaimer: "Registro importado desde dataset reutilizable con trazabilidad de fuente."
  };
}

async function store(payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/store_osint_run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ p_payload: payload })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.file) {
    console.log(usage());
    process.exitCode = 1;
    return;
  }

  const importer = IMPORTERS[args.type] || IMPORTERS.generic;
  const file = path.resolve(args.file);
  const rows = await readRows(file, args.encoding);
  const selectedRows = args.limit ? rows.slice(0, args.limit) : rows;
  let processed = 0;
  let skipped = 0;
  let uploaded = 0;

  for (const row of selectedRows) {
    const record = buildSubjectFromRow(row, importer);
    if (!record) {
      skipped += 1;
      continue;
    }
    processed += 1;
    const payload = buildPayload(record);
    if (!args.dryRun) {
      await store(payload);
      uploaded += 1;
    }
  }

  console.log(JSON.stringify({
    ok: true,
    importer: args.type,
    file,
    rows: rows.length,
    processed,
    skipped,
    uploaded,
    dryRun: args.dryRun
  }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
