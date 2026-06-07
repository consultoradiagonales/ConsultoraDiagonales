const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");
const { queryBcraWrapper } = require("../mini-bcra-osint/bcra-wrapper-client");

const PORT = Number(process.env.PORT || 4317);
const ROOT = path.resolve(__dirname);
const HTML_FILE = path.join(ROOT, "osint-consulta-diagonales.html");
const DATA_DIR = path.join(ROOT, "osint-data");
const RUNS_FILE = path.join(DATA_DIR, "runs.jsonl");
const SUBJECTS_FILE = path.join(DATA_DIR, "subjects.jsonl");
const QUERY_LOG_FILE = path.join(DATA_DIR, "query-log.jsonl");
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const SOURCE_CATALOG = [
  {
    id: "bora",
    name: "BORA - Boletin Oficial",
    category: "Boletin oficial",
    type: "search",
    url: "https://www.boletinoficial.gob.ar/busquedaAvanzada/all"
  },
  {
    id: "bcra",
    name: "BCRA - Situacion crediticia",
    category: "Financiero",
    type: "manual_guarded",
    url: "https://www.bcra.gob.ar/BCRAyVos/Situacion_Crediticia.asp",
    reason: "El portal requiere carga interactiva y puede aplicar verificacion humana."
  },
  {
    id: "arca",
    name: "ARCA - Constancia de inscripcion",
    category: "Fiscal",
    type: "manual_guarded",
    url: "https://seti.arca.gob.ar/padron-puc-constancia-internet/ConsultaConstanciaAction.do",
    reason: "El portal puede requerir validacion interactiva y no expone API publica abierta."
  },
  {
    id: "anses",
    name: "ANSES - Constancia de CUIL",
    category: "Identidad / laboral",
    type: "manual_guarded",
    url: "https://www.anses.gob.ar/consultas/constancia-de-cuil",
    reason: "La constancia puede requerir datos adicionales o validacion del portal."
  },
  {
    id: "dateas",
    name: "Dateas",
    category: "Identidad / padrones publicos",
    type: "search",
    url: "https://www.dateas.com/"
  },
  {
    id: "compras",
    name: "Compras.gob.ar",
    category: "Contrataciones",
    type: "search",
    url: "https://compras.gob.ar/"
  },
  {
    id: "datos",
    name: "Datos.gob.ar",
    category: "Datos abiertos",
    type: "search",
    url: "https://www.datos.gob.ar/"
  },
  {
    id: "infoleg",
    name: "Infoleg",
    category: "Normativa",
    type: "search",
    url: "https://www.infoleg.gob.ar/"
  },
  {
    id: "csjn",
    name: "CSJN",
    category: "Judicial",
    type: "search",
    url: "https://www.csjn.gov.ar/"
  },
  {
    id: "pjn",
    name: "PJN",
    category: "Judicial",
    type: "search",
    url: "https://www.pjn.gov.ar/"
  },
  {
    id: "diputados",
    name: "Camara de Diputados",
    category: "Institucional",
    type: "search",
    url: "https://www.hcdn.gob.ar/"
  },
  {
    id: "senado",
    name: "Senado de la Nacion",
    category: "Institucional",
    type: "search",
    url: "https://www.senado.gob.ar/"
  },
  {
    id: "wayback",
    name: "Wayback Machine",
    category: "Archivo web",
    type: "archive",
    url: "https://web.archive.org/"
  }
];

const NEWS_DOMAINS = [
  "lanacion.com.ar",
  "clarin.com",
  "pagina12.com.ar",
  "infobae.com",
  "ambito.com",
  "cronista.com",
  "perfil.com",
  "eldia.com",
  "diariohoy.net",
  "lavoz.com.ar",
  "rionegro.com.ar",
  "losandes.com.ar",
  "eltribuno.com"
];

const AUTOMATION_MODULES = [
  { id: "identity", name: "Identidad fiscal", category: "Identidad" },
  { id: "bcra", name: "BCRA Central de Deudores", category: "Financiero" },
  { id: "arca", name: "ARCA Constancia", category: "Fiscal" },
  { id: "anses", name: "ANSES Constancia de CUIL", category: "Identidad / laboral" },
  { id: "dateas", name: "Dateas / padrones abiertos", category: "Identidad" },
  { id: "societario", name: "Societario y boletines", category: "Societario" },
  { id: "judicial", name: "Judicial", category: "Judicial" },
  { id: "contrataciones", name: "Contrataciones", category: "Contrataciones" },
  { id: "medios", name: "Medios y reputacion", category: "Medios" },
  { id: "redes", name: "Redes y presencia digital", category: "Redes" },
  { id: "archivo", name: "Archivo web", category: "Archivo" },
  { id: "scoring", name: "Scoring", category: "Analitica" }
];

function normalizeIdentifier(value) {
  return String(value || "").trim();
}

function digits(value) {
  return normalizeIdentifier(value).replace(/\D/g, "");
}

function cuitCheckDigit(prefix, dni) {
  const base = `${prefix}${dni.padStart(8, "0")}`;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  const mod = 11 - (sum % 11);
  if (mod === 11) return "0";
  if (mod === 10) return null;
  return String(mod);
}

function cuitVariantsFromDni(dni) {
  if (!/^\d{7,8}$/.test(dni)) return [];
  const padded = dni.padStart(8, "0");
  return [...new Set(["20", "23", "24", "27", "30", "33", "34"]
    .map(prefix => {
      const check = cuitCheckDigit(prefix, padded);
      return check ? `${prefix}${padded}${check}` : null;
    })
    .filter(Boolean))];
}

function formatCuit(value) {
  return String(value).replace(/^(\d{2})(\d{8})(\d)$/, "$1-$2-$3");
}

function dniFromCuit(value) {
  const numeric = digits(value);
  return /^\d{11}$/.test(numeric) ? numeric.slice(2, 10).replace(/^0+/, "") : "";
}

function validateCuit(value) {
  const numeric = digits(value);
  if (!/^\d{11}$/.test(numeric)) return false;
  const base = numeric.slice(0, 10);
  const expected = cuitCheckDigit(base.slice(0, 2), base.slice(2));
  return expected === numeric.slice(10);
}

function stableSubjectKey(subject) {
  return subject.variants[0] || subject.numeric || subject.name.toLowerCase() || subject.identifier;
}

async function appendJsonLine(file, payload) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(payload)}\n`, "utf8");
}

async function readJsonLines(file) {
  const content = await fs.readFile(file, "utf8").catch(() => "");
  if (!content.trim()) return [];
  return content
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function loadSubjectHistory(subject) {
  const subjectKey = stableSubjectKey(subject);
  const runs = await readJsonLines(RUNS_FILE);
  const relatedRuns = runs.filter((run) => run.subject_key === subjectKey);
  const findings = [];
  const modules = [];

  for (const run of relatedRuns) {
    for (const finding of run.findings || []) {
      findings.push({
        ...finding,
        source: finding.source || "Base propia",
        module: finding.module || "Historico",
        status: "historico",
        confidence: finding.confidence || "Media",
        summary: finding.summary || "Hallazgo recuperado de la base propia."
      });
    }
    for (const module of run.modules || []) {
      modules.push(module);
    }
  }

  return {
    subjectKey,
    runs: relatedRuns,
    findings,
    modules,
    lastRunAt: relatedRuns.at(-1)?.finished_at || null
  };
}

async function loadSupabaseHistory(subject) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { runs: [], findings: [], modules: [], lastRunAt: null };
  }

  const identifiers = [
    subject.variants[0],
    subject.numeric,
    subject.derivedDni,
    subject.identifier
  ].filter(Boolean);

  for (const identifier of identifiers) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_osint_history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ p_identifier: identifier })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.found) continue;

      const observations = Array.isArray(payload.observations) ? payload.observations : [];
      const runs = Array.isArray(payload.runs) ? payload.runs : [];
      const findings = observations.map(item => {
        const metadata = item.metadata || {};
        return {
          source: metadata.source || "Base Supabase",
          module: metadata.module || item.observation_type || "Base propia",
          title: item.title || metadata.title || item.value || "Hallazgo historico",
          url: metadata.url || "",
          confidence: item.confidence || metadata.confidence || "Media",
          status: "historico",
          summary: item.value || metadata.summary || "Hallazgo recuperado de la base propia en Supabase."
        };
      });
      const modules = runs.map(item => item.metadata || {
        id: item.module_key,
        name: item.module_key,
        status: item.status,
        summary: item.summary
      });

      return {
        runs,
        findings,
        modules,
        lastRunAt: payload.lastRunAt || null
      };
    } catch {
      continue;
    }
  }

  return { runs: [], findings: [], modules: [], lastRunAt: null };
}

async function loadCombinedHistory(subject) {
  const local = await loadSubjectHistory(subject);
  const supabase = await loadSupabaseHistory(subject);
  const findings = [];
  const seen = new Set();

  for (const item of [...local.findings, ...supabase.findings]) {
    const key = `${item.title}|${item.url}|${item.summary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(item);
  }

  return {
    subjectKey: local.subjectKey,
    runs: [...local.runs, ...supabase.runs],
    findings,
    modules: [...local.modules, ...supabase.modules],
    lastRunAt: supabase.lastRunAt || local.lastRunAt,
    localRunsCount: local.runs.length,
    supabaseRunsCount: supabase.runs.length
  };
}

async function persistRun(result) {
  const subjectKey = stableSubjectKey(result.subject);
  const now = new Date().toISOString();
  const subjectRecord = {
    subject_key: subjectKey,
    display_name: result.subject.name || null,
    primary_identifier: result.subject.variants[0] || result.subject.numeric || result.subject.identifier || null,
    identifiers: result.subject.terms,
    derived_dni: result.subject.derivedDni || null,
    last_seen_at: now
  };
  const runRecord = {
    run_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    subject_key: subjectKey,
    started_at: result.startedAt,
    finished_at: result.finishedAt,
    score: result.score,
    modules: result.moduleResults,
    findings: result.findings,
    sources: result.sources,
    researchPlan: result.researchPlan,
    disclaimer: result.disclaimer
  };

  await appendJsonLine(SUBJECTS_FILE, subjectRecord);
  await appendJsonLine(RUNS_FILE, runRecord);
  for (const item of result.researchPlan?.queries || []) {
    await appendJsonLine(QUERY_LOG_FILE, {
      subject_key: subjectKey,
      run_id: runRecord.run_id,
      layer: item.layer,
      query: item.query,
      executed_at: now
    });
  }
}

async function persistSupabaseRun(result) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { ok: false, reason: "Supabase no configurado" };

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/store_osint_run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ p_payload: result })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, status: response.status, error: payload };
    }

    return { ok: true, payload };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function buildSubject(input) {
  const identifier = normalizeIdentifier(input.identifier);
  const numeric = digits(identifier);
  const name = normalizeIdentifier(input.name);
  const province = normalizeIdentifier(input.province);
  const variants = /^\d{11}$/.test(numeric)
    ? [numeric]
    : cuitVariantsFromDni(numeric);
  const derivedDni = /^\d{11}$/.test(numeric)
    ? dniFromCuit(numeric)
    : (/^\d{7,8}$/.test(numeric) ? numeric : "");
  const terms = [...new Set([identifier, numeric, derivedDni, ...variants, ...variants.map(formatCuit), name].filter(Boolean))];
  return { identifier, numeric, derivedDni, name, province, variants, terms, discoveredNames: [] };
}

function normalizePersonName(value) {
  const cleaned = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(CUIT|CUIL|CDI|DNI|DOCUMENTO|ARGENTINA|BUENOS AIRES|CAPITAL FEDERAL|CABA|LA PLATA|MAR DEL PLATA|CORDOBA|ROSARIO|MENDOZA|DATEAS|CUITONLINE|ONLINE|DETALLE|INFORME|PERSONA|PADRON|CONSTANCIA|MONOTRIBUTO|AUTONOMO|DOMICILIO|TELEFONO|WWW|HTTP|HTTPS)\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/[^A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  const words = cleaned.split(" ").filter(word => word.length > 1);
  if (words.length < 2 || words.length > 5) return "";
  return words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function extractNameCandidates(findings, subject) {
  const identifiers = [
    subject.identifier,
    subject.numeric,
    subject.derivedDni,
    ...subject.variants,
    ...subject.variants.map(formatCuit)
  ].filter(Boolean);
  const candidates = [];
  const seen = new Set();

  for (const finding of findings) {
    if (finding.status && !["automatico", "historico"].includes(finding.status)) continue;
    const title = String(finding.title || "");
    const summary = String(finding.summary || "");
    const url = String(finding.url || "");
    if (/busqueda no disponible|fetch failed|error|no disponible/i.test(`${title} ${summary}`)) continue;
    const evidenceText = `${title} ${summary} ${url}`;
    const matchesIdentifier = identifiers.some(id => id && evidenceText.includes(id));
    const identityHost = /dateas|cuitonline|cuit\.online|anses|arca|afip/i.test(url);
    if (!matchesIdentifier && !identityHost) continue;

    const fragments = [
      title.split("(")[0],
      title.split("-")[0],
      title.replace(/\([^)]*\)/g, " "),
      summary.split(".")[0]
    ];

    for (const fragment of fragments) {
      const candidate = normalizePersonName(fragment);
      if (!candidate) continue;
      const key = candidate.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
    }
  }

  return candidates.slice(0, 5);
}

function enrichSubjectWithNames(subject, candidates) {
  const names = [...new Set([...(subject.discoveredNames || []), ...candidates].filter(Boolean))];
  subject.discoveredNames = names;
  subject.terms = [...new Set([...subject.terms, ...names].filter(Boolean))];
  return names;
}

function buildQueries(subject) {
  const quoted = subject.terms.map(term => `"${term}"`);
  const base = quoted.length ? quoted.join(" OR ") : `"${subject.name || subject.identifier}"`;
  return [
    { module: "General", q: `${base}` },
    { module: "Societario", q: `${base} ("Boletin Oficial" OR sociedad OR edicto OR gerente OR "cesion de cuotas")` },
    { module: "Judicial", q: `${base} (causa OR sentencia OR expediente OR fuero OR juzgado)` },
    { module: "Contrataciones", q: `${base} (licitacion OR contratacion OR proveedor OR compras)` },
    { module: "Medios", q: `${base} (denuncia OR entrevista OR investigacion OR conflicto OR deuda)` },
    { module: "Redes", q: `${base} (site:x.com OR site:instagram.com OR site:linkedin.com OR site:facebook.com)` }
  ];
}

function inferTargetType(subject) {
  if (/s\.?a\.?|s\.?r\.?l\.?|sas|sociedad|fundacion|asociacion/i.test(subject.name)) return "company";
  if (subject.name || subject.variants.length || /^\d{7,11}$/.test(subject.numeric)) return "person";
  return "digital";
}

function buildResearchPlan(subject, jurisdiction = "Argentina", objective = "commercial_osint") {
  const target = subject.name || subject.variants.map(formatCuit)[0] || subject.derivedDni || subject.identifier;
  const targetType = inferTargetType(subject);
  const exact = exactAny(subject);
  const person = personAny(subject);
  const sourceLayers = {
    person: [
      "identidad fiscal y constancias publicas",
      "boletines oficiales y registros societarios",
      "contrataciones, proveedores y licitaciones",
      "judicial, auditoria, sanciones y medios",
      "redes publicas y archivo web"
    ],
    company: [
      "registro societario y CUIT",
      "autoridades, domicilios, marcas y dominios",
      "contrataciones publicas y sanciones",
      "boletines, litigios, concursos y quiebras",
      "medios, redes corporativas y archivo web"
    ],
    digital: [
      "busqueda exacta del identificador",
      "archivo web y documentos indexados",
      "redes, perfiles y repositorios publicos",
      "menciones en medios y fuentes oficiales"
    ]
  };

  return {
    target,
    targetType,
    jurisdiction,
    objective,
    sourceLayers: sourceLayers[targetType] || sourceLayers.digital,
    queries: [
      { layer: "identidad", query: `${exact} (CUIT OR CUIL OR DNI OR domicilio OR "nombre y apellido" OR Dateas OR ANSES OR ARCA)` },
      { layer: "oficial", query: `${person} site:gov.ar OR site:gob.ar OR site:argentina.gob.ar` },
      { layer: "boletines", query: `${person} ("Boletin Oficial" OR edicto OR sociedad OR gerente OR socio OR "cesion de cuotas")` },
      { layer: "documentos", query: `${person} filetype:pdf OR filetype:xls OR filetype:csv` },
      { layer: "judicial", query: `${person} (causa OR sentencia OR expediente OR juzgado OR concurso OR quiebra OR embargo)` },
      { layer: "contrataciones", query: `${person} (licitacion OR contratacion OR proveedor OR adjudicacion OR compras)` },
      { layer: "medios", query: `${person} (denuncia OR entrevista OR investigacion OR sociedad OR empresa OR conflicto)` },
      { layer: "redes", query: `${subject.name ? `"${subject.name}"` : person} (site:x.com OR site:instagram.com OR site:linkedin.com OR site:facebook.com OR site:tiktok.com OR site:youtube.com)` },
      { layer: "archivo", query: `${person} ("Wayback" OR site:web.archive.org OR cache OR archivo)` }
    ],
    evidenceFields: ["claim", "source_url", "publisher", "date_published", "date_accessed", "identifiers_matched", "confidence", "caveats"]
  };
}

function exactAny(subject) {
  return subject.terms.map(term => `"${term}"`).join(" OR ") || `"${subject.name || subject.identifier}"`;
}

function personAny(subject) {
  return [subject.name, ...(subject.discoveredNames || []), subject.derivedDni, ...subject.variants.map(formatCuit), ...subject.variants]
    .filter(Boolean)
    .map(term => `"${term}"`)
    .join(" OR ") || exactAny(subject);
}

function scopedQuery(query, subject) {
  return subject.province ? `${query} "${subject.province}"` : query;
}

async function fetchText(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ConsultoraDiagonalesOSINT/1.0 (+local research tool)",
        "Accept": "text/html,application/xhtml+xml,application/xml,text/plain;q=0.8"
      }
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, url: response.url, text };
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBingUrl(rawUrl, baseUrl) {
  const parsed = new URL(rawUrl, baseUrl);
  if (!/(^|\.)bing\.com$/i.test(parsed.hostname)) return parsed.toString();

  const encoded = parsed.searchParams.get("u");
  if (encoded && encoded.startsWith("a1")) {
    try {
      const base64 = encoded.slice(2).replace(/-/g, "+").replace(/_/g, "/");
      return Buffer.from(base64, "base64").toString("utf8");
    } catch {
      return parsed.toString();
    }
  }

  return parsed.toString();
}

function isNoiseLink(title, url) {
  const normalizedTitle = title.toLowerCase();
  const host = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  })();

  if (/^(siguiente|anterior|todo|imagenes|videos|maps|noticias|english|busqueda|\d+)$/.test(normalizedTitle)) return true;
  if (host === "bing.com" || host.endsWith(".bing.com")) return true;
  if (url.includes("/search?") || url.includes("copilotsearch")) return true;
  return false;
}

function extractLinks(html, baseUrl, queryTerms) {
  const links = [];
  const seen = new Set();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html)) && links.length < 12) {
    try {
      const url = normalizeBingUrl(match[1], baseUrl);
      const title = stripTags(match[2]).slice(0, 180);
      if (!title || seen.has(url) || isNoiseLink(title, url)) continue;
      const haystack = `${title} ${url}`.toLowerCase();
      const relevant = queryTerms.some(term => term && haystack.includes(term.toLowerCase()));
      if (relevant || /boletin|licit|sentencia|causa|sociedad|deuda|cuit|dni|perfil|diput/.test(haystack)) {
        seen.add(url);
        links.push({ title, url });
      }
    } catch {
      continue;
    }
  }
  return links;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractDuckDuckGoLinks(html) {
  const links = [];
  const seen = new Set();
  const re = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = re.exec(html)) && links.length < 10) {
    try {
      let url = decodeHtml(match[1]);
      const title = stripTags(decodeHtml(match[2])).slice(0, 180);
      const parsed = new URL(url, "https://duckduckgo.com");
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) url = decodeURIComponent(uddg);
      if (!title || seen.has(url) || isNoiseLink(title, url)) continue;
      seen.add(url);
      links.push({ title, url });
    } catch {
      continue;
    }
  }

  return links;
}

async function bingSearch(query, module) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`;
  try {
    const result = await fetchText(url);
    const links = extractLinks(result.text, result.url, query.match(/"([^"]+)"/g)?.map(x => x.replaceAll('"', "")) || []);
    return links.map(link => ({
      source: "Bing",
      module,
      title: link.title,
      url: link.url,
      confidence: "Media",
      status: "automatico",
      summary: "Resultado indexado por buscador para revision OSINT."
    }));
  } catch (error) {
    return [{
      source: "Bing",
      module,
      title: "Busqueda no disponible",
      url,
      confidence: "Baja",
      status: "error",
      summary: error.message
    }];
  }
}

async function duckDuckGoSearch(query, module) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const result = await fetchText(url);
    const links = extractDuckDuckGoLinks(result.text);
    return links.map(link => ({
      source: "DuckDuckGo",
      module,
      title: link.title,
      url: link.url,
      confidence: "Media",
      status: "automatico",
      summary: "Resultado indexado por buscador para revision OSINT."
    }));
  } catch (error) {
    return [{
      source: "DuckDuckGo",
      module,
      title: "Busqueda no disponible",
      url,
      confidence: "Baja",
      status: "error",
      summary: error.message
    }];
  }
}

async function federatedSearch(query, module) {
  const results = [
    ...await bingSearch(query, module),
    ...await duckDuckGoSearch(query, module)
  ];
  const deduped = [];
  const seen = new Set();

  for (const item of results) {
    const key = `${item.title}|${item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

async function directIdentityLookups(subject) {
  const findings = [];
  const cuits = subject.variants.length
    ? subject.variants
    : (/^\d{11}$/.test(subject.numeric) ? [subject.numeric] : []);

  for (const cuit of cuits.slice(0, 3)) {
    const url = `https://www.cuitonline.com/detalle/${cuit}/`;
    try {
      const response = await fetchText(url, 5000);
      if (!response.ok && response.status !== 301 && response.status !== 302) continue;
      const text = stripTags(response.text);
      const title = stripTags((response.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [null, ""])[1] || "")
        || text.slice(0, 120);
      const cuitMatches = [cuit, formatCuit(cuit), dniFromCuit(cuit)].some(identifier => identifier && text.includes(identifier));
      if (!text || !cuitMatches) continue;
      findings.push({
        source: "CUIT Online",
        module: "Identidad fiscal",
        title: title.slice(0, 180),
        url: response.url || url,
        confidence: "Media",
        status: "automatico",
        summary: text.slice(0, 420)
      });
    } catch {
      continue;
    }
  }

  return findings;
}

async function siteSearch(domain, subject, module = "Fuente dirigida") {
  const q = `${subject.terms.map(term => `"${term}"`).join(" OR ")} site:${domain}`;
  return federatedSearch(q, module);
}

function moduleResult(id, status, summary, evidence = [], extra = {}) {
  const meta = AUTOMATION_MODULES.find(module => module.id === id) || { id, name: id, category: "General" };
  return {
    id,
    name: meta.name,
    category: meta.category,
    status,
    summary,
    evidence,
    ...extra
  };
}

function guardedPortalResult(id, url) {
  return moduleResult(
    id,
    "requiere_validacion",
    "Fuente oficial con validacion interactiva. Se registra como modulo protegido y no frena la busqueda automatica.",
    [{ title: "Portal oficial con validacion interactiva", url, source: id, confidence: "Alta" }],
    { protected: true }
  );
}

function bcraFindingFromRecord(record) {
  const result = record.result || {};
  const label = result.denominacion || record.consultedIdentifier || "Consulta BCRA";
  const parts = [
    `Denominacion: ${label}`,
    `Situacion maxima: ${result.maxSituation ?? "-"}`,
    `Entidades actuales: ${result.currentEntities ?? 0}`,
    `Periodo(s) historicos: ${result.historicPeriods ?? 0}`,
    `Monto actual informado: ${result.totalDebt ?? 0}`,
    `Senal: ${result.riskSignal || "-"}`
  ];

  if (record.servedFromCache) {
    parts.push("Resultado servido desde cache por falla de conexion BCRA en vivo.");
  }

  return {
    source: "BCRA Central de Deudores",
    module: "BCRA Central de Deudores",
    title: `BCRA: ${label}`,
    url: record.endpoints?.deudas || record.sourceUrl || "",
    confidence: record.confidence || "Media",
    status: record.servedFromCache ? "historico" : "automatico",
    summary: parts.join(". "),
    metadata: {
      consultedAt: record.consultedAt,
      consultedIdentifier: record.consultedIdentifier,
      evidence: record.evidence,
      riskSignal: result.riskSignal,
      servedFromCache: Boolean(record.servedFromCache)
    }
  };
}

async function runBcraModule(subject) {
  const cuit = subject.variants.find(validateCuit) || (/^\d{11}$/.test(subject.numeric) && validateCuit(subject.numeric) ? subject.numeric : "");

  if (!cuit) {
    return {
      result: guardedPortalResult("bcra", "https://www.bcra.gob.ar/BCRAyVos/Situacion_Crediticia.asp"),
      findings: []
    };
  }

  try {
    const record = await queryBcraWrapper(cuit);
    if (record.result?.riskSignal === "consulta_fallida") {
      return {
        result: moduleResult(
          "bcra",
          "requiere_validacion",
          "BCRA corto la conexion del endpoint publico. No se interpreta como ausencia de datos; reintentar o revisar cache.",
          [{ title: "BCRA API no disponible", url: record.endpoints?.deudas || "", source: "BCRA", confidence: "Baja" }],
          { protected: true, bcraRecord: record }
        ),
        findings: []
      };
    }

    const finding = bcraFindingFromRecord(record);
    return {
      result: moduleResult(
        "bcra",
        record.servedFromCache ? "ok" : "ok",
        record.servedFromCache
          ? `BCRA integrado desde cache valido: ${finding.summary}`
          : `BCRA integrado por API publica: ${finding.summary}`,
        [{ title: finding.title, url: finding.url, source: finding.source, confidence: finding.confidence }],
        { protected: false, servedFromCache: Boolean(record.servedFromCache), bcraRecord: record }
      ),
      findings: [finding]
    };
  } catch (error) {
    return {
      result: moduleResult(
        "bcra",
        "error",
        `No se pudo consultar BCRA API: ${error.message}`,
        [{ title: "BCRA API", url: "https://api.bcra.gob.ar/centraldedeudores/v1.0", source: "BCRA", confidence: "Baja" }]
      ),
      findings: []
    };
  }
}

function evidenceFromFindings(findings, limit = 8) {
  return findings.slice(0, limit).map(item => ({
    title: item.title,
    url: item.url,
    source: item.source,
    confidence: item.confidence
  }));
}

async function probeBrowserForm({ id, url, inputPatterns, submitText }, subject) {
  const identifier = subject.variants[0] ? formatCuit(subject.variants[0]) : subject.identifier;
  if (!identifier) {
    return moduleResult(id, "sin_datos", "No hay identificador suficiente para consultar esta fuente.");
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const pageText = (await page.locator("body").textContent({ timeout: 8000 }).catch(() => "")) || "";
    const protectedAccess = /cloudflare|incapsula|incident id|request unsuccessful|verifique que es un ser humano|captcha|turnstile|recaptcha|checking your browser/i.test(pageText);

    let filled = false;
    for (const pattern of inputPatterns) {
      const locator = page.locator(pattern).first();
      if (await locator.count().catch(() => 0)) {
        await locator.fill(identifier, { timeout: 5000 }).catch(() => {});
        filled = true;
        break;
      }
    }

    const afterFillText = (await page.locator("body").textContent({ timeout: 8000 }).catch(() => "")) || pageText;
    const requiresHuman = protectedAccess || /cloudflare|incapsula|incident id|request unsuccessful|verifique que es un ser humano|captcha|turnstile|recaptcha/i.test(afterFillText);

    if (requiresHuman) {
      return moduleResult(
        id,
        "requiere_validacion",
        "La fuente fue abierta y preparada, pero exige verificacion humana o control anti-abuso. No se intento evadirlo.",
        [{ title: "Portal oficial con verificacion humana", url, source: id, confidence: "Alta" }],
        { filled }
      );
    }

    const button = page.getByText(submitText, { exact: false });
    if (await button.count().catch(() => 0)) {
      await button.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
    }

    const resultText = stripTags((await page.locator("body").textContent({ timeout: 8000 }).catch(() => "")) || "");
    return moduleResult(
      id,
      resultText ? "ok" : "sin_resultados",
      resultText ? resultText.slice(0, 500) : "La fuente no devolvio resultados visibles automatizables.",
      [{ title: "Consulta en portal oficial", url: page.url(), source: id, confidence: "Media" }],
      { filled }
    );
  } catch (error) {
    const protectedByAccess = /ERR_HTTP2_PROTOCOL_ERROR|ERR_ABORTED|ERR_CONNECTION|ERR_CERT|net::/i.test(error.message || "");
    return moduleResult(
      id,
      protectedByAccess ? "requiere_validacion" : "error",
      protectedByAccess
        ? "La fuente no pudo ser automatizada desde el navegador local por restricciones tecnicas del portal. Se conserva como modulo con validacion externa."
        : `No se pudo automatizar esta fuente: ${error.message}`,
      [{ title: "Portal oficial", url, source: id, confidence: "Baja" }]
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function runModuleSearch(id, query, subject, sourceName) {
  const findings = await federatedSearch(query, AUTOMATION_MODULES.find(module => module.id === id)?.name || id);
  const automatic = findings.filter(item => item.status === "automatico");
  return {
    result: moduleResult(
      id,
      automatic.length ? "ok" : "sin_resultados",
      automatic.length ? `Se detectaron ${automatic.length} menciones indexadas para revision.` : "No se detectaron menciones indexadas relevantes.",
      evidenceFromFindings(automatic),
      { sourceName }
    ),
    findings
  };
}

async function runIdentityEnrichment(subject) {
  const base = exactAny(subject);
  const queries = [
    scopedQuery(`${base} (Dateas OR "CUIT" OR "CUIL" OR "DNI" OR domicilio OR "nombre y apellido")`, subject),
    `${base} site:dateas.com`,
    scopedQuery(`${base} ("Constancia de CUIL" OR ANSES OR "constancia de CUIT" OR ARCA)`, subject)
  ];

  const findings = [];
  const directFindings = await directIdentityLookups(subject);
  findings.push(...directFindings);
  if (!directFindings.length) {
    const searchBatches = await Promise.all(queries.map(query => federatedSearch(query, "Identidad fiscal")));
    findings.push(...searchBatches.flat());
  }

  const automatic = findings.filter(item => item.status === "automatico");
  return {
    result: moduleResult(
      "dateas",
      automatic.length ? "ok" : "sin_resultados",
      automatic.length
        ? `Se detectaron ${automatic.length} posibles referencias publicas de identidad para validar nombre, CUIT/CUIL o domicilio.`
        : "No se detectaron referencias publicas de identidad en buscadores para este documento/CUIT.",
      evidenceFromFindings(automatic),
      { sourceName: "Dateas / buscadores / constancias publicas" }
    ),
    findings
  };
}

async function runAutomationModules(subject, options = {}) {
  const moduleResults = [];
  const allFindings = [];

  moduleResults.push(moduleResult(
    "identity",
    subject.terms.length ? "ok" : "sin_datos",
    subject.variants.length && validateCuit(subject.variants[0])
      ? `CUIT/CUIL validado localmente: ${subject.variants.map(formatCuit).join(", ")}. DNI derivado: ${subject.derivedDni || "no disponible"}. Nombre, domicilio y condicion fiscal requieren respuesta de fuente primaria.`
      : subject.variants.length
        ? `Documento normalizado: ${subject.derivedDni || subject.numeric}. CUIT/CUIL posibles: ${subject.variants.map(formatCuit).join(", ")}.`
      : "Identificador o nombre recibido para busqueda textual.",
    subject.variants.map(variant => ({ title: formatCuit(variant), url: "", source: "Calculo local", confidence: "Alta" }))
  ));

  const identityEnrichment = await runIdentityEnrichment(subject);
  const discoveredNames = enrichSubjectWithNames(subject, extractNameCandidates(identityEnrichment.findings, subject));
  if (discoveredNames.length) {
    identityEnrichment.result.status = "ok";
    identityEnrichment.result.summary = `${identityEnrichment.result.summary} Nombre(s) candidato(s) detectado(s): ${discoveredNames.join("; ")}.`;
    identityEnrichment.result.evidence = [
      ...identityEnrichment.result.evidence,
      ...discoveredNames.map(name => ({ title: name, url: "", source: "Extraccion de identidad", confidence: "Media" }))
    ];
  }
  moduleResults.push(identityEnrichment.result);
  allFindings.push(...identityEnrichment.findings);

  const base = exactAny(subject);
  const personBase = personAny(subject);

  const bcra = await runBcraModule(subject);
  moduleResults.push(bcra.result);
  allFindings.push(...bcra.findings);

  const guardedResults = [
    guardedPortalResult("arca", "https://seti.arca.gob.ar/padron-puc-constancia-internet/ConsultaConstanciaAction.do"),
    guardedPortalResult("anses", "https://www.anses.gob.ar/consultas/constancia-de-cuil")
  ];
  moduleResults.push(...guardedResults);

  if (!options.deep) {
    for (const id of ["societario", "judicial", "contrataciones", "medios", "archivo", "redes"]) {
      moduleResults.push(moduleResult(
        id,
        "pendiente",
        "Modulo preparado para busqueda profunda. No bloquea la identificacion inicial.",
        [],
        { deferred: true }
      ));
    }
    return { moduleResults, moduleFindings: allFindings };
  }

  const searches = [
    ["societario", scopedQuery(`${personBase} ("Boletin Oficial" OR sociedad OR edicto OR gerente OR socio OR cuotas OR "S.R.L." OR "S.A." OR "SAS")`, subject)],
    ["judicial", scopedQuery(`${personBase} (causa OR sentencia OR expediente OR juzgado OR fuero OR demanda OR concurso OR quiebra)`, subject)],
    ["contrataciones", scopedQuery(`${personBase} (licitacion OR contratacion OR proveedor OR adjudicacion OR compras OR "compras.gob.ar")`, subject)],
    ["medios", scopedQuery(`${personBase} (denuncia OR entrevista OR investigacion OR conflicto OR deuda OR sociedad OR empresa)`, subject)],
    ["archivo", scopedQuery(`${personBase} ("Boletin Oficial" OR boletin OR edicto OR filetype:pdf OR "Wayback" OR site:web.archive.org)`, subject)]
  ];

  const searchResults = await Promise.all(searches.map(([id, query]) => runModuleSearch(id, query, subject)));
  for (const { result, findings } of searchResults) {
    moduleResults.push(result);
    allFindings.push(...findings);
  }

  const redesQuery = subject.name
    ? scopedQuery(`"${subject.name}" (${base}) (site:x.com OR site:instagram.com OR site:linkedin.com OR site:facebook.com OR site:tiktok.com OR site:youtube.com)`, subject)
    : scopedQuery(`${personBase} (site:x.com OR site:instagram.com OR site:linkedin.com OR site:facebook.com OR site:tiktok.com OR site:youtube.com)`, subject);
  const redes = await runModuleSearch("redes", redesQuery, subject);
  moduleResults.push({
    ...redes.result,
    summary: redes.result.status === "sin_resultados" && !subject.name
      ? (subject.discoveredNames?.length
        ? redes.result.summary
        : "No se detectaron perfiles indexados por documento/CUIT ni nombre candidato.")
      : redes.result.summary
  });
  allFindings.push(...redes.findings);

  return { moduleResults, moduleFindings: allFindings };
}

function scoreFindings(findings) {
  const text = findings.map(item => `${item.title} ${item.summary} ${item.url}`.toLowerCase()).join(" ");
  let risk = 0;
  if (/cheque rechazado|situacion crediticia|deuda|mora|embargo|inhibicion|quiebra/.test(text)) risk += 35;
  if (/causa|sentencia|juzgado|denuncia|expediente/.test(text)) risk += 25;
  if (/sociedad|gerente|cesion|edicto|boletin oficial/.test(text)) risk += 15;
  if (/licitacion|contratacion|proveedor|adjudicacion/.test(text)) risk += 15;
  if (findings.length > 20) risk += 10;
  risk = Math.min(100, risk);
  return {
    risk,
    label: risk >= 70 ? "Alto" : risk >= 40 ? "Medio" : findings.length ? "Bajo" : "Sin evidencia",
    confidence: findings.length >= 10 ? "Media" : findings.length >= 3 ? "Baja-Media" : "Baja"
  };
}

async function runOsint(input) {
  const subject = buildSubject(input);
  const history = await loadCombinedHistory(subject);
  enrichSubjectWithNames(subject, extractNameCandidates(history.findings, subject));
  const automation = await runAutomationModules(subject, { deep: Boolean(input.deep) });
  const researchPlan = buildResearchPlan(subject, input.province || "Argentina", "commercial_osint");
  const queries = buildQueries(subject);
  const startedAt = new Date().toISOString();

  const searchResults = [...history.findings, ...automation.moduleFindings];
  if (input.deep) {
    const queryBatches = await Promise.all(queries.map(query => federatedSearch(query.q, query.module)));
    searchResults.push(...queryBatches.flat());
  }

  const shouldRunDirectedNews = Boolean(input.deep) && Boolean(subject.name || subject.discoveredNames?.length) && subject.terms.length > 2;
  if (shouldRunDirectedNews) {
    const newsBatches = await Promise.all(NEWS_DOMAINS.slice(0, 3).map(domain => siteSearch(domain, subject, "Medios dirigidos")));
    for (const results of newsBatches) {
      searchResults.push(...results.slice(0, 2));
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const item of searchResults) {
    if (item.status === "error" || /busqueda no disponible|fetch failed/i.test(`${item.title || ""} ${item.summary || ""}`)) continue;
    const key = `${item.title}|${item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const score = scoreFindings(deduped.filter(item => item.status === "automatico"));
  const scoringResult = moduleResult(
    "scoring",
    deduped.length ? "ok" : "sin_resultados",
    `Riesgo preliminar: ${score.label}. Confianza analitica: ${score.confidence}.`,
    [],
    { score }
  );

  const result = {
    subject,
    history: {
      subjectKey: history.subjectKey,
      runsCount: history.runs.length,
      findingsCount: history.findings.length,
      lastRunAt: history.lastRunAt
    },
    startedAt,
    finishedAt: new Date().toISOString(),
    sources: SOURCE_CATALOG,
    researchPlan,
    queries,
    moduleResults: [...automation.moduleResults, scoringResult],
    findings: deduped,
    score,
    disclaimer: "Rastreo realizado sobre fuentes abiertas accesibles sin evadir captchas, bloqueos, logins ni restricciones anti-abuso."
  };

  await persistRun(result);
  result.persistence = {
    local: true,
    supabase: await persistSupabaseRun(result)
  };
  return result;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 200, {});
    return;
  }

  if (url.pathname === "/api/osint" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const input = JSON.parse(body || "{}");
        const result = await runOsint(input);
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
    });
    return;
  }

  if (url.pathname === "/" || url.pathname === "/osint") {
    const html = await fs.readFile(HTML_FILE, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (url.pathname === "/api/osint/history" && req.method === "GET") {
    try {
      const content = await fs.readFile(RUNS_FILE, "utf8").catch(() => "");
      const runs = content.trim()
        ? content.trim().split(/\r?\n/).map(line => JSON.parse(line)).slice(-50).reverse()
        : [];
      sendJson(res, 200, { runs });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  sendJson(res, 404, { error: "No encontrado" });
}

http.createServer((req, res) => {
  handleRequest(req, res).catch(error => sendJson(res, 500, { error: error.message }));
}).listen(PORT, () => {
  console.log(`CONSULTORA DIAGONALES OSINT listo en http://localhost:${PORT}/osint`);
});
