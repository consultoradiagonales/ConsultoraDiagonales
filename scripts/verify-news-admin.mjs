import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";

const clientPath = new URL("../assets/js/news-admin.js", import.meta.url);
new vm.Script(fs.readFileSync(clientPath, "utf8"));
const source = stripTypeScriptTypes(fs.readFileSync(new URL("../supabase/functions/admin-manage-news/index.ts", import.meta.url), "utf8"))
  .replace('await import("https://esm.sh/@supabase/supabase-js@2")', "({ createClient: () => database })");

let handler;
let rows = [];
let ignoreDelete = false;
const database = {
  from() {
    let operation = "select";
    let filters = [];
    let payload;
    const query = {
      select() { return query; },
      delete() { operation = "delete"; return query; },
      insert(value) { operation = "insert"; payload = value; return query; },
      update(value) { operation = "update"; payload = value; return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      neq(key, value) { filters.push(row => row[key] !== value); return query; },
      limit() { return query; },
      then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
      maybeSingle() { return Promise.resolve(execute(true)); },
      single() { return Promise.resolve(execute(true)); },
    };
    function execute(single = false) {
      let matches = rows.filter(row => filters.every(test => test(row)));
      if (operation === "delete" && !ignoreDelete) rows = rows.filter(row => !matches.includes(row));
      if (operation === "insert") {
        const row = { ...payload, id: "new-draft" };
        rows.push(row);
        matches = [row];
      }
      if (operation === "update") matches.forEach(row => Object.assign(row, payload));
      return { data: single ? matches[0] || null : matches, error: null };
    }
    return query;
  },
};
vm.runInNewContext(source, {
  database, URL, Response, Error, Date, Set,
  Deno: { env: { get: () => "test-key" }, serve: value => { handler = value; } },
});
async function request(body, key = "test-key") {
  const response = await handler(new Request("https://test.invalid/admin-manage-news", {
    method: "POST", headers: { "x-admin-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}
for (const estado of ["draft", "archived", "featured"]) {
  rows = [{ id: "target", estado }, { id: "other", estado: "archived" }];
  const result = await request({ action: "delete", id: "target" });
  assert.equal(result.status, 200);
  assert.equal(result.body.deletedId, "target");
  assert.deepEqual(rows.map(row => row.id), ["other"]);
}
let result = await request({ action: "delete", id: "target" });
assert.equal(result.body.alreadyDeleted, true);
rows = [{ id: "target", estado: "archived" }];
ignoreDelete = true;
result = await request({ action: "delete", id: "target" });
assert.equal(result.status, 500, "A silent database failure must not report success");
ignoreDelete = false;
result = await request({ action: "delete", id: "target" }, "incorrect");
assert.equal(result.status, 401);
assert.equal(rows.length, 1);
rows = [];
result = await request({
  action: "save", titulo: "Una nota editorial completa", subtitulo: "Bajada de prueba para el editor",
  contenido: [{ type: "paragraph", text: "El contenido editorial se conserva." }],
  autor: "Consultora Diagonales",
});
assert.equal(result.status, 200);
assert.equal(result.body.news.estado, "draft");
assert.equal(result.body.news.radiografia_id, null);
assert.equal(result.body.news.contenido[0].text, "El contenido editorial se conserva.");
console.log("OK: editor válido; eliminar borradores, archivo y portada; verificar borrado; conservar otras notas; guardar contenido sin PDF.");
