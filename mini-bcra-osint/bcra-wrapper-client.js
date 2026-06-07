const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const API_BASE = "https://api.bcra.gob.ar/centraldedeudores/v1.0";
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "exportados", "bcra");
const OSINT_DATA_DIR = path.join(ROOT, "tools", "osint-data");
const BCRA_LOG_FILE = path.join(OSINT_DATA_DIR, "bcra-consultas.jsonl");
const execFileAsync = promisify(execFile);

function normalizeIdentifier(value) {
  return String(value || "").replace(/\D/g, "");
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function appendJsonLine(file, payload) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(payload)}\n`, "utf8");
}

async function readJsonLines(file) {
  const content = await fs.readFile(file, "utf8").catch(() => "");
  if (!content.trim()) return [];
  return content.trim().split(/\r?\n/).map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function latestSuccessfulRecord(identifier) {
  const normalized = normalizeIdentifier(identifier);
  const records = await readJsonLines(BCRA_LOG_FILE);
  return records.reverse().find(record =>
    record.consultedIdentifier === normalized &&
    record.module === "bcra_wrapper_api" &&
    record.result?.riskSignal !== "consulta_fallida" &&
    !record.result?.deudas?.error
  ) || null;
}

async function getJsonWithFetch(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "ConsultoraDiagonalesOSINT/1.0"
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status >= 400) {
    const message = body.errorMessages?.join("; ") || body.message || `BCRA API HTTP ${response.status}`;
    const error = new Error(message);
    error.url = url;
    error.status = response.status;
    error.payload = body;
    throw error;
  }
  return body;
}

async function getJsonWithCurl(url) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { stdout } = await execFileAsync("curl.exe", ["-L", url], {
        timeout: 45000,
        maxBuffer: 1024 * 1024 * 20
      });
      const body = JSON.parse(stdout);
      if (body.status >= 400) {
        const error = new Error(body.errorMessages?.join("; ") || body.message || `BCRA API status ${body.status}`);
        error.url = url;
        error.status = body.status;
        error.payload = body;
        throw error;
      }
      return body;
    } catch (error) {
      lastError = error;
      await wait(5000 * attempt);
    }
  }
  throw lastError;
}

async function getJson(pathname) {
  const url = `${API_BASE}${pathname}`;
  let lastError;

  try {
    return { url, body: await getJsonWithCurl(url), transport: "curl" };
  } catch (error) {
    lastError = error;
  }

  try {
    return { url, body: await getJsonWithFetch(url), transport: "fetch" };
  } catch (error) {
    error.causeMessage = lastError?.message;
    throw error;
  }
}

function summarize(results) {
  const currentPeriods = results.deudas?.results?.periodos || [];
  const currentEntities = currentPeriods.flatMap(period => period.entidades || []);
  const historicPeriods = results.historicas?.results?.periodos || [];
  const rejectedChecks = results.cheques?.results?.causales || results.cheques?.results?.cheques || [];
  const maxSituation = currentEntities.reduce((max, item) => Math.max(max, Number(item.situacion || 0)), 0);
  const totalDebt = currentEntities.reduce((sum, item) => sum + Number(item.monto || 0), 0);
  const hasJudicial = currentEntities.some(item => item.procesoJud || item.situacionJuridica);
  const hasRejectedChecks = Array.isArray(rejectedChecks) && rejectedChecks.length > 0;

  let riskSignal = "sin_senal_negativa_visible";
  if (maxSituation >= 3 || hasJudicial || hasRejectedChecks) riskSignal = "posible_riesgo_crediticio";
  else if (maxSituation === 2) riskSignal = "riesgo_moderado";
  else if (currentEntities.length) riskSignal = "situacion_1_o_normal_visible";

  return {
    denominacion: results.deudas?.results?.denominacion || results.historicas?.results?.denominacion || "",
    currentPeriods: currentPeriods.length,
    currentEntities: currentEntities.length,
    historicPeriods: historicPeriods.length,
    rejectedChecks: Array.isArray(rejectedChecks) ? rejectedChecks.length : 0,
    maxSituation,
    totalDebt,
    hasJudicial,
    riskSignal,
    confidence: currentPeriods.length || historicPeriods.length || hasRejectedChecks ? "Alta" : "Media",
    caveats: "Datos obtenidos desde API publica del BCRA Central de Deudores. Interpretacion preliminar; validar contra respuesta oficial y fecha de periodo."
  };
}

async function queryBcraWrapper(identifier) {
  const normalized = normalizeIdentifier(identifier);
  if (!/^\d{11}$/.test(normalized)) {
    throw new Error("Ingresar CUIT/CUIL/CDI de 11 digitos.");
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const accessedAt = new Date().toISOString();
  const runId = `${timestamp()}-${normalized}-api`;

  const deudas = await getJson(`/Deudas/${normalized}`)
    .then(value => ({ status: "fulfilled", value }))
    .catch(reason => ({ status: "rejected", reason }));

  let historicas = { status: "rejected", reason: new Error("No consultado porque fallo Deudas.") };
  let cheques = { status: "rejected", reason: new Error("No consultado porque fallo Deudas.") };

  if (deudas.status === "fulfilled") {
    await wait(7000);
    historicas = await getJson(`/Deudas/Historicas/${normalized}`)
      .then(value => ({ status: "fulfilled", value }))
      .catch(reason => ({ status: "rejected", reason }));

    await wait(7000);
    cheques = await getJson(`/Deudas/ChequesRechazados/${normalized}`)
      .then(value => ({ status: "fulfilled", value }))
      .catch(reason => ({ status: "rejected", reason }));
  }

  const results = {
    deudas: deudas.status === "fulfilled" ? deudas.value.body : { error: deudas.reason.message, url: deudas.reason.url, cause: deudas.reason.causeMessage },
    historicas: historicas.status === "fulfilled" ? historicas.value.body : { error: historicas.reason.message, url: historicas.reason.url, cause: historicas.reason.causeMessage },
    cheques: cheques.status === "fulfilled" ? cheques.value.body : { error: cheques.reason.message, url: cheques.reason.url, cause: cheques.reason.causeMessage }
  };
  const transports = {
    deudas: deudas.status === "fulfilled" ? deudas.value.transport : "error",
    historicas: historicas.status === "fulfilled" ? historicas.value.transport : "error",
    cheques: cheques.status === "fulfilled" ? cheques.value.transport : "error"
  };

  const analysis = summarize(results);
  const allCoreFailed = Boolean(results.deudas.error);
  if (allCoreFailed) {
    const cached = await latestSuccessfulRecord(normalized);
    if (cached) {
      return {
        ...cached,
        servedFromCache: true,
        cacheReason: "BCRA no respondio en vivo; se devuelve el ultimo registro exitoso para este identificador.",
        liveFailure: {
          consultedAt: accessedAt,
          deudas: results.deudas,
          historicas: results.historicas,
          cheques: results.cheques
        }
      };
    }
    analysis.riskSignal = "consulta_fallida";
    analysis.confidence = "Baja";
    analysis.caveats = "No se pudo obtener respuesta de Deudas ni Deudas Historicas. Reintentar; no interpretar como ausencia de deuda.";
  }
  const rawJsonPath = path.join(OUT_DIR, `${runId}.wrapper.raw.json`);
  const reportPath = path.join(OUT_DIR, `${runId}.wrapper.osint.json`);

  const record = {
    module: "bcra_wrapper_api",
    source: "BCRA Central de Deudores API v1.0",
    sourceUrl: API_BASE,
    consultedAt: accessedAt,
    identifierType: "CUIT_CUIL_CDI",
    consultedIdentifier: normalized,
    query: {
      input: identifier,
      normalized
    },
    endpoints: {
      deudas: `${API_BASE}/Deudas/${normalized}`,
      historicas: `${API_BASE}/Deudas/Historicas/${normalized}`,
      chequesRechazados: `${API_BASE}/Deudas/ChequesRechazados/${normalized}`
    },
    transports,
    evidence: {
      rawJsonPath,
      reportPath
    },
    result: {
      ...analysis,
      deudas: results.deudas,
      historicas: results.historicas,
      cheques: results.cheques
    },
    confidence: analysis.confidence,
    caveats: analysis.caveats,
    compliance: "Consulta a API publica documentada por BCRA. No usa CAPTCHA, no evade controles de acceso."
  };

  await fs.writeFile(rawJsonPath, JSON.stringify(results, null, 2), "utf8");
  await fs.writeFile(reportPath, JSON.stringify(record, null, 2), "utf8");
  await appendJsonLine(BCRA_LOG_FILE, record);

  return record;
}

async function bcraHealthCheck() {
  const testId = "30500010912";
  try {
    const response = await getJson(`/Deudas/${testId}`);
    return {
      ok: true,
      transport: response.transport,
      checkedAt: new Date().toISOString(),
      message: "API BCRA responde."
    };
  } catch (error) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      message: error.message,
      cause: error.causeMessage || ""
    };
  }
}

module.exports = { queryBcraWrapper, bcraHealthCheck };
