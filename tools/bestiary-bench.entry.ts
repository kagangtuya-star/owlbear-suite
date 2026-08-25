import { searchMonsters } from "../src/modules/bestiary/data";
let seed = 31;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 0x100000000);
const names = ["Goblin","Ancient Red Dragon","Owlbear","Mind Flayer","Zombie","Bandit Captain"];
const crs = ["0","1/8","1/4","1/2","1","5","13","21","30"];
const monsters: any[] = [];
for (let i = 0; i < 6000; i++) {
  monsters.push({
    name: "怪物" + i, engName: names[i % names.length] + " " + i,
    type: i % 3 ? "humanoid" : "dragon", cr: crs[i % crs.length],
    edition: "other", source: i % 2 ? "MM" : "kiwee",
  });
}
function bench(label: string, fn: () => void, n = 300) {
  fn();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn();
  const t1 = process.hrtime.bigint();
  console.log(`  ${label}: ${(Number(t1 - t0) / 1e6 / n).toFixed(3)} ms`);
}
console.log(`  monsters: ${monsters.length}`);
bench("searchMonsters('owlb')", () => { searchMonsters(monsters, "owlb"); });
bench("searchMonsters('') sort only", () => { searchMonsters(monsters, ""); });
const r = searchMonsters(monsters, "owlb");
console.log(`  hits: ${r.length}, first cr=${r[0]?.cr}, last cr=${r[r.length-1]?.cr}`);

// --- equivalence against a from-scratch reference ------------------------
// parseCR is module-local; the reference re-implements it verbatim.
function parseCR(cr: string): number {
  if (cr === "1/8") return 0.125;
  if (cr === "1/4") return 0.25;
  if (cr === "1/2") return 0.5;
  return parseFloat(cr) || 0;
}
function reference(ms: any[], query: string, sortDesc: boolean, editions: Set<any>, sourceFilter: string) {
  let result = ms.filter((m) => m.edition === "other" || editions.has(m.edition));
  const srcQ = sourceFilter.trim().toLowerCase();
  if (srcQ) result = result.filter((m) => String(m.source ?? "").toLowerCase().includes(srcQ));
  if (query.trim()) {
    const q = query.toLowerCase().trim();
    result = result.filter((m) => {
      const t = String(m.type || "");
      return (m.name || "").toLowerCase().includes(q) || (m.engName || "").toLowerCase().includes(q)
        || m.cr === q || t.toLowerCase().includes(q);
    });
  }
  const sorted = [...result].sort((a, b) => { const d = parseCR(a.cr) - parseCR(b.cr); return sortDesc ? -d : d; });
  return sorted.slice(0, 200); // searchMonsters caps at 200
}
const ALL = new Set(["2014", "2024", "other"]);
let bad = 0, cases = 0;
for (const q of ["", "owlb", "怪物1", "dragon", "1/4", "0", "humanoid", "zzz", "Goblin"]) {
  for (const desc of [false, true]) {
    for (const src of ["", "mm", "kiwee"]) {
      const a = searchMonsters(monsters, q, desc, ALL, src).map((m: any) => m.engName).join("|");
      const b = reference(monsters, q, desc, ALL, src).map((m: any) => m.engName).join("|");
      cases++;
      if (a !== b) { bad++; if (bad < 3) console.log(`     MISMATCH q=${q} desc=${desc} src=${src}`); }
    }
  }
}
console.log(`  equivalence: ${cases} query/sort/filter combos, ${bad} mismatches ${bad === 0 ? "✓" : "✗"}`);
