// Smoke test du service WLAB.config + parseBinCode
// Exécuté en Node avec stubs minimaux (localStorage, document, window).

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.join(__dirname, "..", "warehouse-lab.html"), "utf8");

function extractScripts(src){
  const re = /<script>([\s\S]*?)<\/script>/g;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

function makeSandbox(configJson){
  const store = new Map();
  if (configJson) store.set("wlab_config_v1", JSON.stringify(configJson));
  const listeners = new Map();
  const win = {};
  const doc = {
    readyState: "complete",
    addEventListener(type, fn){
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(evt){
      (listeners.get(evt.type) || []).forEach(fn => fn(evt));
      return true;
    }
  };
  const localStorage = {
    getItem: k => store.has(k) ? store.get(k) : null,
    setItem: (k,v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  const sandbox = {
    window: win, document: doc, localStorage,
    setTimeout, clearTimeout, console,
    CustomEvent: class CustomEvent {
      constructor(type, opts){ this.type = type; this.detail = opts && opts.detail; }
    }
  };
  win.WLAB = win.WLAB || {};
  sandbox.WLAB = win.WLAB;
  return { sandbox, store, listeners };
}

// --- Test 1 : config présente, classifyBin doit router correctement ---
const CFG = {
  company: { name: "TestCorp", code: "TC", email: "", primaryColor: "#F37021" },
  options: {},
  sap_columns: {},
  zones: [
    { type: "structured", code: "MP", label: "Matières Premières",
      racks: "A, B, C", levels: "0, 1, 2, 3", pos_min: 1, pos_max: 10 },
    { type: "structured", code: "PF", label: "Produits Finis",
      racks: "K, L", levels: "0, 1", pos_min: 1, pos_max: 5 },
    { type: "flat", code: "OBD", label: "TPA", values: "TPA1, TPA2, TPA3" }
  ]
};

const { sandbox } = makeSandbox(CFG);
const scripts = extractScripts(HTML);
const configScript = scripts[2]; // 4e (0..3) = main app ; le 3e (idx 2) = service WLAB.config
const ctx = vm.createContext(sandbox);
let readyFired = 0;
sandbox.document.addEventListener("wlab:config-ready", () => { readyFired++; });

vm.runInContext(configScript, ctx);
// setTimeout(0) est utilisé pour fireReady — laisser la microtask s'exécuter
await new Promise(r => setTimeout(r, 10));

const cfg = sandbox.window.WLAB.config;
const results = [];

function check(label, actual, expected){
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ ok, label, actual, expected });
}

check("isReady() après reload", cfg.isReady(), true);
check("wlab:config-ready a bien été émis", readyFired > 0, true);
check("getStructuredZones() renvoie 2 zones", cfg.getStructuredZones().length, 2);
check("getFlatZones() renvoie 1 zone", cfg.getFlatZones().length, 1);
check("getAllRacks() = [A,B,C,K,L]", cfg.getAllRacks().sort(), ["A","B","C","K","L"]);

// classifyBin — structured
const r1 = cfg.classifyBin("A-0-3");
check("A-0-3 → MP structured rack=A",
  { section: r1 && r1.section, type: r1 && r1.type, rack: r1 && r1.rack },
  { section: "MP", type: "structured", rack: "A" });

const r2 = cfg.classifyBin("K-1-5");
check("K-1-5 → PF structured rack=K",
  { section: r2 && r2.section, type: r2 && r2.type, rack: r2 && r2.rack },
  { section: "PF", type: "structured", rack: "K" });

// flat
const r3 = cfg.classifyBin("TPA2");
check("TPA2 → OBD flat",
  { section: r3 && r3.section, type: r3 && r3.type, tpa: r3 && r3.tpa },
  { section: "OBD", type: "flat", tpa: "TPA2" });

// out-of-config → null (l'appli reroute en OTHER en aval)
const r4 = cfg.classifyBin("Z-9-99");
check("Z-9-99 → null (hors config)", r4, null);

// buildBinUniverse : MP = 3 racks × 4 niveaux × 10 pos = 120 ; PF = 2 × 2 × 5 = 20 ; total 140
const universe = cfg.buildBinUniverse();
check("buildBinUniverse() total bins = 140", universe.keys.length, 140);

// --- Test 2 : pas de config au boot ---
{
  const { sandbox: sb2 } = makeSandbox(null);
  const ctx2 = vm.createContext(sb2);
  let readyFired2 = 0;
  sb2.document.addEventListener("wlab:config-ready", () => { readyFired2++; });
  vm.runInContext(configScript, ctx2);
  await new Promise(r => setTimeout(r, 10));
  check("sans config, isReady() = false", sb2.window.WLAB.config.isReady(), false);
  check("sans config, wlab:config-ready NON émis", readyFired2, 0);
  check("sans config, getAllRacks() = []", sb2.window.WLAB.config.getAllRacks(), []);
}

// --- Rapport ---
const pass = results.filter(r => r.ok).length;
const fail = results.filter(r => !r.ok);
console.log(`\n${pass}/${results.length} assertions OK`);
if (fail.length){
  console.log("\nÉchecs :");
  for (const f of fail){
    console.log(` - ${f.label}\n     attendu : ${JSON.stringify(f.expected)}\n     obtenu  : ${JSON.stringify(f.actual)}`);
  }
  process.exit(1);
}
