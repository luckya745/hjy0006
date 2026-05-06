const fs = require("fs");

const dataPath = "data/gskh-data.js";
const csvPath = "data/hanja_char.csv";
const outPath = "data/hanja-readings.js";

const dataSource = fs.readFileSync(dataPath, "utf8");
const data = JSON.parse(dataSource.slice("window.GSKH_DATA = ".length, -1));
const used = new Set([...JSON.stringify(data.records)].filter((char) => /[\u3400-\u9FFF\uF900-\uFAFF]/u.test(char)));

const readings = new Map();
const csv = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
for (const line of csv.split(/\r?\n/)) {
  if (!line.trim()) continue;
  const [char, reading] = line.split(",");
  if (!used.has(char) || !reading) continue;
  if (!readings.has(char)) readings.set(char, []);
  const list = readings.get(char);
  if (!list.includes(reading)) list.push(reading);
}

const dict = Object.fromEntries([...readings.entries()].sort(([a], [b]) => a.localeCompare(b)));
const output = `window.HANJA_READINGS = ${JSON.stringify(dict)};`;
fs.writeFileSync(outPath, output, "utf8");

const missing = [...used].filter((char) => !readings.has(char));
console.log(JSON.stringify({
  used: used.size,
  mapped: readings.size,
  missing: missing.length,
  missingSample: missing.slice(0, 80).join(""),
}, null, 2));
