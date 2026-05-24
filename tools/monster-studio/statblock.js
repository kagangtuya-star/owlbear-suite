// Monster Studio — stat-block renderer.
//
// A standalone port of the pure-rendering half of the OBR Suite's
// bestiary monster-info popover (src/modules/bestiary/monster-info-page.ts).
// Dropped: live-token HP/AC editing, the resource tab, dice-roll
// broadcasts, pin/drag chrome. Kept: the full 5etools stat-block
// layout (header / CR+speed chips / ability grid / meta block /
// traits / spellcasting / actions / bonus / reactions / legendary).
//
// Input: a single 5etools-shape monster object (the suite's custom
// monster format). Output: an HTML string for the preview pane.

import { LANG, t } from "./i18n.js";

const ORDER = ["str", "dex", "con", "int", "wis", "cha"];
const ABBR = ({
  zh: { str: "力量", dex: "敏捷", con: "体质", int: "智力", wis: "感知", cha: "魅力" },
  en: { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" },
})[LANG];
const SIZE_CN = ({
  zh: { T: "微型", S: "小型", M: "中型", L: "大型", H: "巨型", G: "超巨型" },
  en: { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan" },
})[LANG];
const SKILL_CN = ({
  zh: {
    acrobatics: "特技", "animal handling": "驯兽", arcana: "奥秘",
    athletics: "运动", deception: "欺瞒", history: "历史",
    insight: "洞悉", intimidation: "威吓", investigation: "调查",
    medicine: "医药", nature: "自然", perception: "察觉",
    performance: "表演", persuasion: "游说", religion: "宗教",
    "sleight of hand": "巧手", stealth: "隐匿", survival: "求生",
  },
  en: {
    acrobatics: "Acrobatics", "animal handling": "Animal Handling", arcana: "Arcana",
    athletics: "Athletics", deception: "Deception", history: "History",
    insight: "Insight", intimidation: "Intimidation", investigation: "Investigation",
    medicine: "Medicine", nature: "Nature", perception: "Perception",
    performance: "Performance", persuasion: "Persuasion", religion: "Religion",
    "sleight of hand": "Sleight of Hand", stealth: "Stealth", survival: "Survival",
  },
})[LANG];

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function mod(score) {
  return Math.floor((Number(score) - 10) / 2);
}
function fmtMod(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

// Flatten 5etools `entries` (nested arrays / {entries} / {items} /
// {text} objects) to a single string. Keeps {@tag ...} tokens.
// Exported so the editor (app.js) can show entries as editable text.
export function flattenEntries(entries) {
  if (entries == null) return "";
  if (typeof entries === "string") return entries;
  if (typeof entries === "number" || typeof entries === "boolean") return String(entries);
  if (Array.isArray(entries)) return entries.map(flattenEntries).filter(Boolean).join(" ");
  if (typeof entries === "object") {
    if (entries.entries) return flattenEntries(entries.entries);
    if (entries.items) return flattenEntries(entries.items);
    if (entries.text) return flattenEntries(entries.text);
    return "";
  }
  return "";
}

// Render {@tag payload} tokens to a small inline chip. No dice
// integration here (standalone tool) — chips are display-only. The
// first pipe-segment of the payload is the human-readable part.
function renderTags(s) {
  const escaped = esc(s);
  return escaped.replace(/\{@(\w+)\s+([^{}]+?)\}/g, (_full, tag, payload) => {
    const first = String(payload).split("|")[0];
    const rollish = /^(hit|damage|dice|d20|recharge|dc|scaledamage|scaledice)$/i.test(tag);
    return `<span class="sb-tag ${rollish ? "roll" : ""}">${esc(first)}</span>`;
  });
}

function parseAc(ac) {
  if (!Array.isArray(ac) || ac.length === 0) {
    if (typeof ac === "number") return String(ac);
    return "?";
  }
  const first = ac[0];
  if (typeof first === "number") return String(first);
  if (first && typeof first === "object" && "ac" in first) {
    const from = Array.isArray(first.from) ? `（${first.from.join("、")}）` : "";
    return `${first.ac}${from}`;
  }
  return "?";
}

function parseHp(hp) {
  if (hp == null) return "?";
  if (typeof hp === "number") return String(hp);
  if (typeof hp === "object") {
    if (typeof hp.average === "number") {
      return hp.formula ? `${hp.average}（${hp.formula}）` : String(hp.average);
    }
    if (hp.special != null) return String(hp.special);
  }
  return "?";
}

function parseSpeed(speed) {
  if (speed == null) return "?";
  const ft = t("sbFt");
  if (typeof speed === "number") return `${speed} ${ft}`;
  if (typeof speed !== "object") return "?";
  const v = (x) => (typeof x === "number" ? x : x && typeof x === "object" ? x.number ?? "?" : "?");
  const parts = [];
  if (speed.walk != null) parts.push(`${v(speed.walk)} ${ft}`);
  if (speed.fly != null) parts.push(`${t("sbFly")} ${v(speed.fly)}`);
  if (speed.swim != null) parts.push(`${t("sbSwim")} ${v(speed.swim)}`);
  if (speed.climb != null) parts.push(`${t("sbClimb")} ${v(speed.climb)}`);
  if (speed.burrow != null) parts.push(`${t("sbBurrow")} ${v(speed.burrow)}`);
  return parts.length ? parts.join(LANG === "en" ? ", " : "、") : "?";
}

function parseSizeStr(size) {
  if (Array.isArray(size)) return size.map((s) => SIZE_CN[s] ?? s).join("/");
  if (typeof size === "string") return SIZE_CN[size] ?? size;
  return "";
}

function parseType(type) {
  if (typeof type === "string") return type;
  if (type && typeof type === "object") {
    const tags = Array.isArray(type.tags) ? `（${type.tags.join("、")}）` : "";
    return `${type.type ?? ""}${tags}`;
  }
  return "";
}

function formatList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return arr.map((x) => esc(typeof x === "string" ? x : flattenEntries(x))).join("、");
}

// Damage resist/immune/vulnerable arrays may carry nested
// {resist:[...], note} objects — flatten to a readable string.
function formatDmgList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  const out = [];
  for (const x of arr) {
    if (typeof x === "string") out.push(x);
    else if (x && typeof x === "object") {
      const inner = x.resist || x.immune || x.vulnerable;
      const note = x.note ? ` ${x.note}` : "";
      if (Array.isArray(inner)) out.push(`${inner.join("、")}${note}`.trim());
    }
  }
  return esc(out.join("；"));
}

function formatSkills(skill) {
  if (!skill || typeof skill !== "object") return "";
  const parts = [];
  for (const [k, v] of Object.entries(skill)) {
    const label = SKILL_CN[k.toLowerCase()] ?? k;
    parts.push(`${esc(label)} ${esc(String(v))}`);
  }
  return parts.join("、");
}

function sectionHtml(items, cls, title) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const rows = items
    .map((a) => {
      const n = a && a.name ? a.name : "?";
      const t = flattenEntries(a && a.entries);
      return `<div class="sb-act ${cls}"><span class="sb-act-n">${renderTags(n)}</span>` +
        (t ? `<span class="sb-act-t">${renderTags(t)}</span>` : "") + `</div>`;
    })
    .join("");
  return `<div class="sb-sect">${esc(title)}</div>${rows}`;
}

function renderSpellcasting(scArr) {
  if (!Array.isArray(scArr) || scArr.length === 0) return "";
  const sep = LANG === "en" ? ", " : "、";
  const colon = LANG === "en" ? ": " : "：";
  let out = `<div class="sb-sect">✦ ${t("sbSpellcasting")}</div>`;
  for (const sc of scArr) {
    const header = flattenEntries(sc.headerEntries);
    out += `<div class="sb-act"><span class="sb-act-n">${renderTags(sc.name || t("sbSpellcasting"))}</span>` +
      (header ? `<span class="sb-act-t">${renderTags(header)}</span>` : "") + `</div>`;
    if (sc.will && sc.will.length) {
      out += `<div class="sb-spell-line"><b>${t("sbAtWill")}${colon}</b>${renderTags(sc.will.join(sep))}</div>`;
    }
    if (sc.daily && typeof sc.daily === "object") {
      for (const [k, v] of Object.entries(sc.daily)) {
        if (Array.isArray(v)) out += `<div class="sb-spell-line"><b>${esc(t("sbPerDay", { k }))}${colon}</b>${renderTags(v.join(sep))}</div>`;
      }
    }
    if (sc.spells && typeof sc.spells === "object") {
      for (const [lvl, slot] of Object.entries(sc.spells)) {
        const list = slot && Array.isArray(slot.spells) ? slot.spells : [];
        if (!list.length) continue;
        const lvlLabel = lvl === "0" ? t("sbCantrip") : t("sbRing", { lvl });
        const slots = slot && slot.slots ? t("sbSlots", { n: slot.slots }) : "";
        out += `<div class="sb-spell-line"><b>${esc(lvlLabel)}${slots}${colon}</b>${renderTags(list.join(sep))}</div>`;
      }
    }
  }
  return out;
}

function renderLegendary(m) {
  if (!Array.isArray(m.legendary) || m.legendary.length === 0) return "";
  const count = typeof m.legendaryActions === "number" ? m.legendaryActions : 3;
  const preamble = Array.isArray(m.legendaryHeader) && m.legendaryHeader.length
    ? flattenEntries(m.legendaryHeader)
    : t("sbLegendaryPre", { count });
  let out = `<div class="sb-sect">★ ${t("sbLegendary")}</div>`;
  out += `<div class="sb-legend-pre">${renderTags(preamble)}</div>`;
  out += m.legendary
    .map((a) => {
      const n = a && a.name ? a.name : "?";
      const t = flattenEntries(a && a.entries);
      return `<div class="sb-act legend"><span class="sb-act-n">${renderTags(n)}</span>` +
        (t ? `<span class="sb-act-t">${renderTags(t)}</span>` : "") + `</div>`;
    })
    .join("");
  return out;
}

/**
 * Render a single monster object → stat-block HTML string.
 * `m` is a 5etools-shape monster (the suite's custom monster format).
 */
export function renderStatBlock(m) {
  if (!m || typeof m !== "object") {
    return `<div class="sb-empty">${t("sbEmpty")}</div>`;
  }
  const name = m.name || m.ENG_name || t("sbUnnamed");
  const eng = m.ENG_name && m.ENG_name !== m.name ? m.ENG_name : "";
  const cr = (m.cr && typeof m.cr === "object" ? m.cr.cr : m.cr) ?? "?";
  const sub = [parseSizeStr(m.size), parseType(m.type), eng].filter(Boolean).join(" · ");

  const ac = parseAc(m.ac);
  const hp = parseHp(m.hp);
  const speed = parseSpeed(m.speed);

  const saves = m.save || {};
  const abilGrid = ORDER.map((k) => {
    const score = typeof m[k] === "number" ? m[k] : 10;
    const aMod = mod(score);
    const isProf = saves[k] !== undefined;
    let saveBn = aMod;
    const raw = saves[k];
    if (typeof raw === "number") saveBn = raw;
    else if (typeof raw === "string") {
      const mm = /([+-]?\s*\d+)/.exec(raw);
      if (mm) saveBn = parseInt(mm[1].replace(/\s+/g, ""), 10);
    }
    return `<div class="sb-abl${isProf ? " prof" : ""}">
      <span class="sb-abl-k">${ABBR[k]}</span>
      <span class="sb-abl-s">${esc(score)}</span>
      <span class="sb-abl-m">${fmtMod(aMod)}</span>
      <span class="sb-abl-save" title="${t("sbSave")}">${t("sbSave")} ${fmtMod(saveBn)}</span>
    </div>`;
  }).join("");

  const metaRow = (label, value) =>
    value ? `<div class="sb-meta-row"><span class="sb-meta-l">${esc(label)}</span><span class="sb-meta-v">${value}</span></div>` : "";
  const passive = typeof m.passive === "number" ? t("sbPassive", { n: m.passive }) : "";
  const sensesFull = [formatList(m.senses), passive].filter(Boolean).join(LANG === "en" ? ", " : "、");
  const meta = [
    metaRow(t("sbSkill"), formatSkills(m.skill)),
    metaRow(t("sbSenses"), sensesFull && renderTags(sensesFull)),
    metaRow(t("sbLanguages"), formatList(m.languages) && renderTags(formatList(m.languages))),
    metaRow(t("sbResist"), formatDmgList(m.resist)),
    metaRow(t("sbImmune"), formatDmgList(m.immune)),
    metaRow(t("sbVuln"), formatDmgList(m.vulnerable)),
    metaRow(t("sbCondImmune"), formatDmgList(m.conditionImmune)),
  ].filter(Boolean).join("");

  return `
    <div class="sb">
      <div class="sb-hdr">
        <div class="sb-name">${esc(name)}</div>
        ${sub ? `<div class="sb-sub">${esc(sub)}</div>` : ""}
      </div>
      <div class="sb-banner">
        <div class="sb-stat hp"><span class="sb-stat-k">HP</span><span class="sb-stat-v">${esc(hp)}</span></div>
        <div class="sb-stat ac"><span class="sb-stat-k">AC</span><span class="sb-stat-v">${esc(ac)}</span></div>
        <div class="sb-stat cr"><span class="sb-stat-k">CR</span><span class="sb-stat-v">${esc(cr)}</span></div>
        <div class="sb-stat spd"><span class="sb-stat-k">${t("sbSpeed")}</span><span class="sb-stat-v">${esc(speed)}</span></div>
      </div>
      <div class="sb-abil">${abilGrid}</div>
      ${meta ? `<div class="sb-meta">${meta}</div>` : ""}
      ${sectionHtml(m.trait, "trait", "✦ " + t("sbSecTrait"))}
      ${renderSpellcasting(m.spellcasting)}
      ${sectionHtml(m.action, "", "⚔ " + t("sbSecAction"))}
      ${sectionHtml(m.bonus, "bonus", "⚡ " + t("sbSecBonus"))}
      ${sectionHtml(m.reaction, "reaction", "🛡 " + t("sbSecReaction"))}
      ${renderLegendary(m)}
    </div>
  `;
}
