const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function main() {
  const [file, needle] = process.argv.slice(2);
  if (!file || !needle) {
    console.error('Usage: node tools/extract-pdf-context.js <pdf> <needle>');
    process.exit(1);
  }
  const parser = new PDFParse({ data: fs.readFileSync(file) });
  const data = await parser.getText();
  await parser.destroy();
  const text = data.text.replace(/\s+/g, ' ').trim();
  const idx = text.indexOf(needle);
  console.log(JSON.stringify({
    pages: data.total,
    found: idx >= 0,
    index: idx,
    context: idx >= 0 ? text.slice(Math.max(0, idx - 1200), idx + 1600) : '',
    sample: idx < 0 ? text.slice(0, 1000) : undefined
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
