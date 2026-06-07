const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");

const BCRA_URL = "https://www.bcra.gob.ar/situacion-crediticia/";
const OUT_DIR = path.join(process.cwd(), "exportados", "bcra");
const OSINT_DATA_DIR = path.join(process.cwd(), "tools", "osint-data");
const BCRA_LOG_FILE = path.join(OSINT_DATA_DIR, "bcra-consultas.jsonl");

function normalizeCuit(value) {
  return String(value || "").replace(/\D/g, "");
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function detectIdentifierType(value) {
  const numeric = normalizeCuit(value);
  if (/^\d{11}$/.test(numeric)) return "CUIT_CUIL_CDI";
  if (/^\d{7,8}$/.test(numeric)) return "DNI";
  return "IDENTIFICADOR";
}

function summarizeBcraText(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();
  const hasResult = /situaci[oó]n|deuda|entidad|periodo|irrecuperable|normal|bcra|central de deudores/.test(lower);
  const hasDebtSignal = /deuda|mora|irrecuperable|riesgo|situaci[oó]n [2-6]|cheque rechazado/.test(lower);
  const noDebtSignal = /no registra|sin deuda|no posee|no se registran|situaci[oó]n normal/.test(lower);

  return {
    summary: clean.slice(0, 1200),
    resultDetected: hasResult,
    riskSignal: hasDebtSignal ? "posible_riesgo_crediticio" : (noDebtSignal ? "sin_senal_negativa_visible" : "sin_clasificar"),
    confidence: hasResult ? "Media-Alta" : "Baja",
    caveats: hasResult
      ? "Extraccion desde pantalla posterior a validacion humana; revisar captura y HTML para confirmar interpretacion."
      : "No se detecto texto concluyente en la pantalla capturada."
  };
}

async function appendJsonLine(file, payload) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(payload)}\n`, "utf8");
}

async function waitForEnter(message) {
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question(message);
  } finally {
    rl.close();
  }
}

async function main() {
  const cuit = normalizeCuit(process.argv[2]);

  if (!/^\d{11}$/.test(cuit)) {
    console.error("Uso: npm run bcra:cuit -- 20123456789");
    console.error("La CUIT debe tener 11 digitos. Tambien puede ir con guiones: 20-12345678-9.");
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const runId = `${timestamp()}-${cuit}`;

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 }
  });

  console.log(`Abriendo ${BCRA_URL}`);
  await page.goto(BCRA_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  const cuitInput = page.locator([
    'input[name*="cuit" i]',
    'input[id*="cuit" i]',
    'input[placeholder*="cuit" i]',
    'input[type="text"]',
    'input[type="number"]'
  ].join(", ")).first();

  await cuitInput.waitFor({ state: "visible", timeout: 30000 });
  await cuitInput.fill(cuit);

  console.log(`CUIT cargada: ${cuit}`);
  console.log("Si aparece una verificacion humana, hace click manualmente en el CAPTCHA dentro del navegador BCRA.");
  await waitForEnter("Cuando el CAPTCHA quede aceptado y estes listo para enviar la consulta, presiona Enter aca...");

  const submit = page.locator([
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Consultar")',
    'button:has-text("Buscar")',
    'input[value*="Consultar" i]',
    'input[value*="Buscar" i]'
  ].join(", ")).first();

  if (await submit.count()) {
    await submit.click();
  } else {
    await page.keyboard.press("Enter");
  }

  await page.waitForLoadState("domcontentloaded").catch(() => {});
  console.log("Si el sitio muestra CAPTCHA o confirmacion adicional, resolvelo manualmente.");
  await waitForEnter("Cuando veas el resultado en pantalla, presiona Enter para extraer y guardar...");

  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1000);

  const result = await page.evaluate(() => {
    const text = (document.body.innerText || "").replace(/\s+/g, " ").trim();
    const tables = Array.from(document.querySelectorAll("table")).map((table) =>
      Array.from(table.querySelectorAll("tr")).map((row) =>
        Array.from(row.querySelectorAll("th,td")).map((cell) =>
          (cell.innerText || "").replace(/\s+/g, " ").trim()
        )
      )
    );
    return {
      title: document.title,
      url: location.href,
      text,
      tables
    };
  });

  const base = path.join(OUT_DIR, runId);
  const screenshotPath = `${base}.png`;
  const htmlPath = `${base}.html`;
  const jsonPath = `${base}.json`;
  const reportPath = `${base}.osint.json`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await fs.writeFile(htmlPath, await page.content(), "utf8");
  await fs.writeFile(jsonPath, JSON.stringify({
    source: "BCRA Situacion Crediticia",
    sourceUrl: BCRA_URL,
    queriedCuit: cuit,
    accessedAt: new Date().toISOString(),
    browserUrl: result.url,
    title: result.title,
    text: result.text,
    tables: result.tables
  }, null, 2), "utf8");

  const analysis = summarizeBcraText(result.text);
  const osintRecord = {
    module: "bcra_situacion_crediticia",
    source: "BCRA Situacion Crediticia",
    sourceUrl: BCRA_URL,
    consultedAt: new Date().toISOString(),
    identifierType: detectIdentifierType(cuit),
    consultedIdentifier: cuit,
    query: {
      input: process.argv[2],
      normalized: cuit
    },
    evidence: {
      browserUrl: result.url,
      screenshotPath,
      htmlPath,
      rawJsonPath: jsonPath,
      reportPath
    },
    result: {
      title: result.title,
      textSample: analysis.summary,
      tables: result.tables,
      resultDetected: analysis.resultDetected,
      riskSignal: analysis.riskSignal
    },
    confidence: analysis.confidence,
    caveats: analysis.caveats,
    compliance: "Consulta asistida con resolucion humana de CAPTCHA/verificacion. No evade controles de acceso."
  };

  await fs.writeFile(reportPath, JSON.stringify(osintRecord, null, 2), "utf8");
  await appendJsonLine(BCRA_LOG_FILE, osintRecord);

  console.log("Extraccion guardada:");
  console.log(`- ${jsonPath}`);
  console.log(`- ${htmlPath}`);
  console.log(`- ${screenshotPath}`);
  console.log(`- ${reportPath}`);
  console.log(`- ${BCRA_LOG_FILE}`);
  console.log(`Confianza OSINT: ${osintRecord.confidence}`);
  console.log(`Resultado: ${osintRecord.result.riskSignal}`);
  console.log("El navegador queda abierto para revision manual. Cerralo cuando termines.");
}

main().catch((error) => {
  console.error("No se pudo completar la consulta asistida.");
  console.error(error.message || error);
  process.exit(1);
});
