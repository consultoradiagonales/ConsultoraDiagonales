const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const publicEntries = [
  "index.html",
  "CNAME",
  ".nojekyll",
  "assets",
  "admin",
  "analisis",
  "contacto",
  "metodologia",
  "radiografias",
  "registro",
  "repositorio",
  "servicios",
];

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function stripComments(value, ext) {
  if (ext === ".js" || ext === ".css") {
    return value
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\r\n]*/g, "$1");
  }
  if (ext === ".html") {
    return value.replace(/<!--[\s\S]*?-->/g, "");
  }
  return value;
}

function minifyText(value, ext) {
  const withoutComments = stripComments(value, ext);
  if (ext === ".html") {
    return withoutComments.replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();
  }
  if (ext === ".css") {
    return withoutComments
      .replace(/\s+/g, " ")
      .replace(/\s*([{}:;,>+~])\s*/g, "$1")
      .replace(/;}/g, "}")
      .trim();
  }
  if (ext === ".js") {
    return withoutComments
      .replace(/\s+/g, " ")
      .replace(/\s*([{}()[\]=:+,;<>?*/%-])\s*/g, "$1")
      .trim();
  }
  return value;
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const ext = path.extname(src).toLowerCase();
  if ([".html", ".css", ".js"].includes(ext)) {
    const content = fs.readFileSync(src, "utf8");
    fs.writeFileSync(dest, minifyText(content, ext), "utf8");
    return;
  }
  fs.copyFileSync(src, dest);
}

function copyEntry(entry) {
  const src = path.join(root, entry);
  const dest = path.join(dist, entry);
  if (!fs.existsSync(src)) return;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(src)) {
      if (child.startsWith(".")) continue;
      copyEntry(path.join(entry, child));
    }
    return;
  }

  if (src.endsWith(".map")) return;
  copyFile(src, dest);
}

cleanDir(dist);
for (const entry of publicEntries) copyEntry(entry);

console.log(`Built public site in ${dist}`);
