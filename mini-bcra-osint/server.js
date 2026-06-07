const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { queryBcraWrapper, bcraHealthCheck } = require("./bcra-wrapper-client");

const PORT = Number(process.env.PORT || 4321);
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "exportados", "bcra");
const LOG_FILE = path.join(ROOT, "tools", "osint-data", "bcra-consultas.jsonl");

let currentRun = null;

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(type.includes("json") ? JSON.stringify(body) : body);
}

function normalizeIdentifier(value) {
  return String(value || "").replace(/\D/g, "");
}

async function readJsonLines(file) {
  const content = await fs.readFile(file, "utf8").catch(() => "");
  if (!content.trim()) return [];
  return content.trim().split(/\r?\n/).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function listArtifacts() {
  const files = await fs.readdir(OUT_DIR).catch(() => []);
  const records = await readJsonLines(LOG_FILE);
  const usefulRecords = records.filter(record =>
    record.result?.riskSignal !== "consulta_fallida" &&
    !record.result?.deudas?.error
  );
  return {
    records: usefulRecords.slice(-20).reverse(),
    files: files
      .filter(name => name.includes(".wrapper.osint.json"))
      .sort()
      .reverse()
      .slice(0, 40)
      .map((name) => ({
      name,
      path: path.join(OUT_DIR, name)
    }))
  };
}

function runBcra(identifier) {
  const child = spawn(
    process.execPath,
    [path.join(ROOT, "tools", "consulta-bcra-cuit.js"), identifier],
    { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] }
  );

  currentRun = {
    id: `${Date.now()}`,
    identifier,
    status: "running",
    startedAt: new Date().toISOString(),
    output: []
  };

  child.stdout.on("data", (chunk) => {
    currentRun.output.push(chunk.toString());
  });
  child.stderr.on("data", (chunk) => {
    currentRun.output.push(chunk.toString());
  });
  child.on("exit", (code) => {
    currentRun.status = code === 0 ? "finished" : "failed";
    currentRun.exitCode = code;
    currentRun.finishedAt = new Date().toISOString();
  });

  currentRun.enter = () => {
    child.stdin.write("\n");
  };

  return currentRun;
}

async function handle(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "OPTIONS") return send(res, 200, {});

  if (url.pathname === "/" && req.method === "GET") {
    const html = await fs.readFile(path.join(__dirname, "index.html"), "utf8");
    return send(res, 200, html, "text/html; charset=utf-8");
  }

  if (url.pathname === "/resultados" && req.method === "GET") {
    const html = await fs.readFile(path.join(__dirname, "resultados.html"), "utf8");
    return send(res, 200, html, "text/html; charset=utf-8");
  }

  if (url.pathname === "/visor" && req.method === "GET") {
    const html = await fs.readFile(path.join(__dirname, "visor.html"), "utf8");
    return send(res, 200, html, "text/html; charset=utf-8");
  }

  if (url.pathname === "/api/run" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const payload = JSON.parse(body || "{}");
      const identifier = normalizeIdentifier(payload.identifier);
      if (!/^\d{11}$/.test(identifier)) {
        return send(res, 400, { error: "Ingresar CUIT/CUIL/CDI de 11 digitos." });
      }
      if (currentRun?.status === "running") {
        return send(res, 409, { error: "Ya hay una consulta en curso." });
      }
      const run = runBcra(identifier);
      send(res, 200, { id: run.id, status: run.status, identifier: run.identifier });
    });
    return;
  }

  if (url.pathname === "/api/bcra-wrapper" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const record = await queryBcraWrapper(payload.identifier);
        if (record.servedFromCache) {
          send(res, 200, record);
          return;
        }
        if (record.result?.riskSignal === "consulta_fallida") {
          send(res, 502, {
            error: "BCRA corto la conexion. Reintentar en unos segundos; no interpretar como ausencia de datos.",
            record
          });
          return;
        }
        send(res, 200, record);
      } catch (error) {
        send(res, 500, { error: error.message });
      }
    });
    return;
  }

  if (url.pathname === "/api/bcra-health" && req.method === "GET") {
    return send(res, 200, await bcraHealthCheck());
  }

  if (url.pathname === "/api/enter" && req.method === "POST") {
    if (!currentRun?.enter || currentRun.status !== "running") {
      return send(res, 409, { error: "No hay consulta esperando Enter." });
    }
    currentRun.enter();
    return send(res, 200, { ok: true });
  }

  if (url.pathname === "/api/status" && req.method === "GET") {
    return send(res, 200, {
      run: currentRun ? {
        id: currentRun.id,
        identifier: currentRun.identifier,
        status: currentRun.status,
        startedAt: currentRun.startedAt,
        finishedAt: currentRun.finishedAt,
        exitCode: currentRun.exitCode,
        output: currentRun.output.join("")
      } : null,
      artifacts: await listArtifacts()
    });
  }

  if (url.pathname === "/api/latest-success" && req.method === "GET") {
    const data = await listArtifacts();
    const record = data.records.find(item =>
      item.module === "bcra_wrapper_api" &&
      item.result?.riskSignal !== "consulta_fallida" &&
      !item.result?.deudas?.error
    ) || null;
    return send(res, 200, { record });
  }

  send(res, 404, { error: "No encontrado" });
}

http.createServer((req, res) => {
  handle(req, res).catch((error) => send(res, 500, { error: error.message }));
}).listen(PORT, () => {
  console.log(`Mini BCRA OSINT listo en http://localhost:${PORT}`);
});
