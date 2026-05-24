// Monster Studio — editor logic.
//
// Page 1 of the studio: import / edit / export the suite's custom
// monster format (5etools-shape objects). The raw JSON textarea is
// the source of truth; the quick-edit form and section rows are
// convenience views that mutate the same objects. The right pane
// re-renders the stat-block on every change (replicates the OBR
// bestiary monster-info popover).

import { renderStatBlock, flattenEntries } from "./statblock.js";
import { LANG, t, applyI18n, mountLangToggle } from "./i18n.js";

applyI18n();
mountLangToggle();

// ---- constants -------------------------------------------------------------
const ABIL_ORDER = ["str", "dex", "con", "int", "wis", "cha"];
const ABIL_LABELS = {
  zh: { str: "力量", dex: "敏捷", con: "体质", int: "智力", wis: "感知", cha: "魅力" },
  en: { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" },
};
const ABIL_CN = ABIL_LABELS[LANG];
const ARRAY_FIELDS = ["senses", "languages", "resist", "immune", "vulnerable", "conditionImmune"];
const SECTIONS = [
  { key: "trait",     labelKey: "secTrait",     cls: "trait" },
  { key: "action",    labelKey: "secAction",    cls: "action" },
  { key: "bonus",     labelKey: "secBonus",     cls: "bonus" },
  { key: "reaction",  labelKey: "secReaction",  cls: "reaction" },
  { key: "legendary", labelKey: "secLegendary", cls: "legendary" },
];

// ---- DOM refs --------------------------------------------------------------
const fileInput     = document.getElementById("fileInput");
const importBtn     = document.getElementById("importBtn");
const exportBtn     = document.getElementById("exportBtn");
const newBtn        = document.getElementById("newBtn");
const sampleBtn     = document.getElementById("sampleBtn");
const monsterPicker = document.getElementById("monsterPicker");
const monsterSelect = document.getElementById("monsterSelect");
const statusEl      = document.getElementById("status");
const formCard      = document.getElementById("formCard");
const abilGrid      = document.getElementById("abilGrid");
const sectionsCard  = document.getElementById("sectionsCard");
const sectionsHost  = document.getElementById("sectionsHost");
const rawCard       = document.getElementById("rawCard");
const rawDetails    = document.getElementById("rawDetails");
const jsonArea      = document.getElementById("jsonArea");
const previewMount  = document.getElementById("previewMount");

// ---- state -----------------------------------------------------------------
// doc      — the parsed top-level value (wrapped {monster:[]} / bare [] / single {})
// kind     — "wrapped" | "array" | "single"; decides export shape
// monsters — array of monster objects, references INTO doc
const state = { doc: null, kind: "single", monsters: [], activeIndex: 0 };

const activeMonster = () => state.monsters[state.activeIndex];

// ---- small helpers ---------------------------------------------------------
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function abilMod(score) { return Math.floor((Number(score) - 10) / 2); }
function fmtMod(n) { return n >= 0 ? `+${n}` : `${n}`; }
function setStatus(msg, cls) {
  statusEl.textContent = msg;
  statusEl.className = "toolbar-status" + (cls ? " " + cls : "");
}

// ---- doc parse / serialize -------------------------------------------------
function parseDoc(text) {
  const data = JSON.parse(text);
  if (data && typeof data === "object" && !Array.isArray(data) && Array.isArray(data.monster)) {
    if (data.monster.length === 0) throw new Error(t("msErrMonsterEmpty"));
    return { kind: "wrapped", doc: data, monsters: data.monster };
  }
  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error(t("msErrArrayEmpty"));
    return { kind: "array", doc: data, monsters: data };
  }
  if (data && typeof data === "object") {
    return { kind: "single", doc: data, monsters: [data] };
  }
  throw new Error(t("msErrBadShape"));
}
function serializeDoc() {
  return JSON.stringify(state.doc, null, 2);
}

// ---- value <-> input string converters ------------------------------------
function acToInput(ac) {
  if (ac == null) return "";
  if (typeof ac === "number") return String(ac);
  if (Array.isArray(ac) && ac.length) {
    const f = ac[0];
    if (typeof f === "number") return String(f);
    if (f && typeof f === "object" && "ac" in f) {
      const from = Array.isArray(f.from) && f.from.length ? `（${f.from.join("、")}）` : "";
      return `${f.ac}${from}`;
    }
  }
  return "";
}
function parseAcInput(str) {
  str = String(str).trim();
  if (/^\d+$/.test(str)) return Number(str);
  const m = /^(\d+)\s*[（(]\s*(.+?)\s*[）)]\s*$/.exec(str);
  if (m) return [{ ac: Number(m[1]), from: m[2].split(/[、,，]/).map((s) => s.trim()).filter(Boolean) }];
  const n = /(\d+)/.exec(str);
  if (n) return [{ ac: Number(n[1]) }];
  return str;
}
function hpToInput(hp) {
  if (hp == null) return "";
  if (typeof hp === "number") return String(hp);
  if (typeof hp === "object") {
    if (typeof hp.average === "number") return hp.formula ? `${hp.average}, ${hp.formula}` : String(hp.average);
    if (hp.special != null) return String(hp.special);
  }
  return "";
}
function parseHpInput(str) {
  str = String(str).trim();
  if (/^\d+$/.test(str)) return { average: Number(str) };
  const m = /^(\d+)\s*[,，（(]\s*(.+?)\s*[）)]?\s*$/.exec(str);
  if (m) return { average: Number(m[1]), formula: m[2].trim() };
  const n = /(\d+)/.exec(str);
  if (n) return { average: Number(n[1]) };
  return { special: str };
}
function skillToInput(skill) {
  if (!skill || typeof skill !== "object") return "";
  return Object.entries(skill).map(([k, v]) => `${k}:${v}`).join(", ");
}
function parseSkillInput(raw) {
  const obj = {};
  for (const part of String(raw).split(/[,，]/)) {
    const t = part.trim();
    if (!t) continue;
    const m = /^(.+?)\s*[:：]\s*(.+)$/.exec(t);
    if (m) obj[m[1].trim()] = m[2].trim();
  }
  return obj;
}
function dmgFlat(x) {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    const inner = x.resist || x.immune || x.vulnerable;
    if (Array.isArray(inner)) {
      const note = x.note ? ` ${x.note}` : "";
      return inner.map(dmgFlat).join("、") + note;
    }
  }
  return "";
}
function listToInput(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.map(dmgFlat).filter(Boolean).join("、");
}
function splitList(raw) {
  return String(raw).split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
}
// Array-of-strings round-trips via newlines; nested entries flatten (lossy —
// raw JSON is the escape hatch for complex {entries:[{type:...}]} shapes).
function entriesToText(entries) {
  if (Array.isArray(entries) && entries.every((e) => typeof e === "string")) {
    return entries.join("\n");
  }
  return flattenEntries(entries);
}
function textToEntries(value) {
  return String(value).split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

// ---- field read (state -> form input) -------------------------------------
function fieldToInput(f, m) {
  if (f.startsWith("speed.")) {
    const key = f.slice(6);
    const sp = m.speed;
    if (sp == null) return "";
    if (typeof sp === "number") return key === "walk" ? String(sp) : "";
    if (typeof sp !== "object") return "";
    const v = sp[key];
    if (v == null) return "";
    return typeof v === "object" ? String(v.number ?? "") : String(v);
  }
  if (f === "ac") return acToInput(m.ac);
  if (f === "hp") return hpToInput(m.hp);
  if (f === "cr") {
    const cr = m.cr;
    if (cr == null) return "";
    return typeof cr === "object" ? String(cr.cr ?? "") : String(cr);
  }
  if (f === "size") {
    if (Array.isArray(m.size)) return m.size[0] || "";
    return m.size || "";
  }
  if (f === "type") {
    const t = m.type;
    if (t == null) return "";
    return typeof t === "object" ? String(t.type ?? "") : String(t);
  }
  if (f === "passive") return m.passive == null ? "" : String(m.passive);
  if (f === "skill") return skillToInput(m.skill);
  if (ARRAY_FIELDS.includes(f)) return listToInput(m[f]);
  return m[f] == null ? "" : String(m[f]);
}

// ---- field write (form input -> state) ------------------------------------
function applyField(f, raw) {
  const m = activeMonster();
  if (!m) return;
  const trimmed = String(raw).trim();
  if (f.startsWith("speed.")) {
    const key = f.slice(6);
    if (!m.speed || typeof m.speed !== "object") m.speed = {};
    if (trimmed === "") delete m.speed[key];
    else m.speed[key] = Number(trimmed);
    if (Object.keys(m.speed).length === 0) delete m.speed;
  } else if (f === "ac") {
    if (trimmed === "") delete m.ac; else m.ac = parseAcInput(raw);
  } else if (f === "hp") {
    if (trimmed === "") delete m.hp; else m.hp = parseHpInput(raw);
  } else if (f === "cr") {
    if (trimmed === "") delete m.cr; else m.cr = trimmed;
  } else if (f === "size") {
    if (trimmed === "") delete m.size; else m.size = trimmed;
  } else if (f === "type") {
    if (trimmed === "") delete m.type; else m.type = trimmed;
  } else if (f === "passive") {
    if (trimmed === "") delete m.passive; else m.passive = Number(trimmed);
  } else if (f === "skill") {
    const obj = parseSkillInput(raw);
    if (Object.keys(obj).length) m.skill = obj; else delete m.skill;
  } else if (ARRAY_FIELDS.includes(f)) {
    const arr = splitList(raw);
    if (arr.length) m[f] = arr; else delete m[f];
  } else {
    if (trimmed === "") delete m[f]; else m[f] = raw;
  }
  renderJson();
  renderPreview();
}
function applyScore(abil, raw) {
  const m = activeMonster();
  if (!m) return;
  m[abil] = raw === "" ? 10 : Number(raw);
  const modEl = abilGrid.querySelector(`[data-mod="${abil}"]`);
  if (modEl) modEl.textContent = fmtMod(abilMod(m[abil]));
  renderJson();
  renderPreview();
}
function applySave(abil, raw) {
  const m = activeMonster();
  if (!m) return;
  if (!m.save || typeof m.save !== "object") m.save = {};
  if (String(raw).trim() === "") delete m.save[abil];
  else m.save[abil] = String(raw).trim();
  if (Object.keys(m.save).length === 0) delete m.save;
  renderJson();
  renderPreview();
}

// ---- renderers -------------------------------------------------------------
function showEditor() {
  formCard.hidden = false;
  sectionsCard.hidden = false;
  rawCard.hidden = false;
}
function renderPicker() {
  if (state.monsters.length > 1) {
    monsterPicker.hidden = false;
    monsterSelect.innerHTML = state.monsters
      .map((m, i) => `<option value="${i}">${i + 1}. ${esc(m.name || m.ENG_name || t("msUnnamed"))}</option>`)
      .join("");
    monsterSelect.value = String(state.activeIndex);
  } else {
    monsterPicker.hidden = true;
  }
}
function renderForm() {
  const m = activeMonster() || {};
  for (const el of formCard.querySelectorAll("[data-field]")) {
    el.value = fieldToInput(el.dataset.field, m);
  }
  syncSizeChips();
  renderAbilGrid();
}
// 体型 is a chip selector (single-select), not a <select>.
function syncSizeChips() {
  const cur = fieldToInput("size", activeMonster() || {});
  for (const chip of formCard.querySelectorAll("[data-size-chip]")) {
    chip.classList.toggle("on", chip.dataset.sizeChip === cur);
  }
}
function renderAbilGrid() {
  const m = activeMonster() || {};
  abilGrid.innerHTML = ABIL_ORDER.map((k) => {
    const score = typeof m[k] === "number" ? m[k] : 10;
    const saveRaw = m.save && m.save[k] != null ? m.save[k] : "";
    return `<div class="abil-cell">
      <span class="ac-k">${ABIL_CN[k]}</span>
      <div class="ac-row score-row">
        <input type="number" data-abil="${k}" value="${esc(score)}">
        <span class="ac-mod" data-mod="${k}">${fmtMod(abilMod(score))}</span>
      </div>
      <div class="ac-row save-row">
        <span class="ac-tag">${t("sbSave")}</span>
        <input type="text" data-save="${k}" value="${esc(saveRaw)}" placeholder="—">
      </div>
    </div>`;
  }).join("");
}
function renderSections() {
  const m = activeMonster() || {};
  sectionsHost.innerHTML = SECTIONS.map((s) => {
    const list = Array.isArray(m[s.key]) ? m[s.key] : [];
    const rows = list.map((entry, i) => {
      const name = entry && entry.name ? entry.name : "";
      const text = entriesToText(entry && entry.entries);
      return `<div class="sect-row" data-sect="${s.key}" data-idx="${i}">
        <div class="sect-row-top">
          <input class="sr-name" type="text" value="${esc(name)}" placeholder="${esc(t("msEntryNamePh"))}">
          <button class="sr-del" title="${esc(t("msEntryDel"))}" aria-label="${esc(t("msEntryDel"))}">✕</button>
        </div>
        <textarea class="sr-text" placeholder="${esc(t("msEntryDescPh"))}">${esc(text)}</textarea>
      </div>`;
    }).join("");
    return `<div class="sect-block">
      <div class="sect-block-head">
        <span class="sect-block-title ${s.cls}">${t(s.labelKey)}</span>
        <span class="sect-block-count">${t("msCountSuffix", { n: list.length })}</span>
      </div>
      <div class="sect-rows">${rows}</div>
      <button class="sect-add" data-add="${s.key}">${t("msAddEntry")}</button>
    </div>`;
  }).join("");
}
function renderJson() {
  jsonArea.value = serializeDoc();
  jsonArea.classList.remove("err");
}
function renderPreview() {
  const m = activeMonster();
  previewMount.innerHTML = m
    ? renderStatBlock(m)
    : `<div class="sb"><div class="sb-empty">${t("msPreviewEmpty")}</div></div>`;
}

// ---- load / export ---------------------------------------------------------
function loadDoc(text, { skipJsonArea = false } = {}) {
  let parsed;
  try {
    parsed = parseDoc(text);
  } catch (e) {
    setStatus(t("msStatusParseFail", { err: e.message }), "err");
    jsonArea.classList.add("err");
    return false;
  }
  state.kind = parsed.kind;
  state.doc = parsed.doc;
  state.monsters = parsed.monsters;
  if (state.activeIndex >= state.monsters.length) state.activeIndex = 0;
  if (state.activeIndex < 0) state.activeIndex = 0;
  showEditor();
  renderPicker();
  renderForm();
  renderSections();
  if (!skipJsonArea) renderJson();
  renderPreview();
  const kindLabel = parsed.kind === "wrapped" ? "{monster:[…]}"
    : parsed.kind === "array" ? t("msKindArray") : t("msKindObject");
  setStatus(t("msStatusLoaded", { n: state.monsters.length, kind: kindLabel }), "ok");
  return true;
}
function doExport() {
  if (!state.doc) {
    setStatus(t("msStatusNoExport"), "err");
    return;
  }
  const text = serializeDoc();
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const m = activeMonster();
  const nm = (m && (m.ENG_name || m.name)) || "monster";
  a.href = url;
  a.download = `${String(nm).replace(/[\\/:*?"<>|]/g, "_")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus(t("msStatusExported"), "ok");
}

// ---- blank / sample data ---------------------------------------------------
function blankMonster() {
  return {
    name: t("msNewMonster"),
    ENG_name: "",
    source: "",
    size: "M",
    type: "humanoid",
    alignment: "",
    ac: 10,
    hp: { average: 10 },
    speed: { walk: 30 },
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    cr: "0",
    trait: [], action: [], bonus: [], reaction: [], legendary: [],
  };
}
function sampleDoc() {
  const zh = LANG === "zh";
  return {
    monster: [
      // Lightweight example: every section that low-CR monsters
      // typically have (trait / action / reaction), nothing fancy.
      {
        name: zh ? "哥布林头目" : "Goblin Boss",
        ENG_name: "Goblin Boss",
        source: "MM",
        size: ["S"],
        type: { type: "humanoid", tags: ["goblinoid"] },
        alignment: zh ? "中立邪恶" : "Neutral Evil",
        ac: [{ ac: 17, from: zh ? ["链甲", "盾牌"] : ["chain shirt", "shield"] }],
        hp: { average: 21, formula: "6d6" },
        speed: { walk: 30 },
        str: 10, dex: 14, con: 10, int: 10, wis: 8, cha: 10,
        save: { dex: "+4" },
        skill: { stealth: "+6" },
        senses: zh ? ["黑暗视觉 60 尺"] : ["darkvision 60 ft."],
        passive: 9,
        languages: zh ? ["通用语", "地精语"] : ["Common", "Goblin"],
        cr: "1",
        trait: [
          zh
            ? { name: "鬼祟逃窜", entries: ["哥布林头目可以在每个回合用附赠动作脱离或躲藏。"] }
            : { name: "Nimble Escape", entries: ["The goblin can take the Disengage or Hide action as a bonus action on each of its turns."] },
        ],
        action: [
          zh
            ? { name: "多重攻击", entries: ["哥布林头目发动两次弯刀攻击，第二次攻击带有劣势。"] }
            : { name: "Multiattack", entries: ["The goblin makes two attacks with its scimitar. The second attack has disadvantage."] },
          zh
            ? { name: "弯刀", entries: ["近战武器攻击：{@hit 4} 命中，触及 5 尺，单一目标。命中：{@damage 1d6+2} 点挥砍伤害。"] }
            : { name: "Scimitar", entries: ["Melee Weapon Attack: {@hit 4} to hit, reach 5 ft., one target. Hit: {@damage 1d6+2} slashing damage."] },
          zh
            ? { name: "标枪", entries: ["武器攻击：{@hit 4} 命中，触及 5 尺或射程 30/120 尺，单一目标。命中：{@damage 1d6+2} 点穿刺伤害。"] }
            : { name: "Javelin", entries: ["Melee or Ranged Weapon Attack: {@hit 4} to hit, reach 5 ft. or range 30/120 ft., one target. Hit: {@damage 1d6+2} piercing damage."] },
        ],
        bonus: [],
        reaction: [
          zh
            ? { name: "顶替", entries: ["当一个 5 尺内的非头目盟友被攻击时，哥布林头目可让该盟友与自己交换位置并代其受击。"] }
            : { name: "Redirect Attack", entries: ["When a non-boss ally within 5 ft. is attacked, the Goblin Boss can swap places with that ally and take the hit instead."] },
        ],
        legendary: [],
      },
      // Full-featured example: every section type populated (trait
      // with spellcasting block, action multiattack, bonus action,
      // reaction, legendary actions). Pick the Lich because it's the
      // canonical "has-it-all" stat block.
      {
        name: zh ? "巫妖" : "Lich",
        ENG_name: "Lich",
        source: "MM",
        size: ["M"],
        type: { type: "undead" },
        alignment: zh ? "任意邪恶阵营" : "Any Evil Alignment",
        ac: [{ ac: 17, from: [zh ? "天生护甲" : "natural armor"] }],
        hp: { average: 135, formula: "18d8 + 54" },
        speed: { walk: 30 },
        str: 11, dex: 16, con: 16, int: 20, wis: 14, cha: 16,
        save: { con: "+10", int: "+12", wis: "+9" },
        skill: { arcana: "+19", history: "+12", insight: "+9", perception: "+9" },
        resist: zh ? ["寒冷", "闪电", "黯蚀"] : ["cold", "lightning", "necrotic"],
        immune: zh ? ["毒素", "钝击/穿刺/挥砍（非魔法武器造成）"] : ["poison", "bludgeoning, piercing and slashing from nonmagical attacks"],
        conditionImmune: zh ? ["魅惑", "力竭", "恐惧", "麻痹", "中毒"] : ["charmed", "exhaustion", "frightened", "paralyzed", "poisoned"],
        senses: zh ? ["真实视觉 120 尺"] : ["truesight 120 ft."],
        passive: 19,
        languages: zh ? ["通用语 + 至多五种其它语言"] : ["Common plus up to five other languages"],
        cr: "21",
        trait: [
          zh
            ? { name: "传奇反抗（每日3次）", entries: ["若巫妖一次豁免检定失败，可改判其成功。"] }
            : { name: "Legendary Resistance (3/Day)", entries: ["If the lich fails a saving throw, it can choose to succeed instead."] },
          zh
            ? { name: "法术施放", entries: ["巫妖是 18 级法师。其法术施放属性为智力（豁免 DC 20，法术攻击 {@hit 12} 命中）。它已准备以下法师法术：", "戏法（随意）：{@spell 法师之手}, {@spell 摩苓加之手}, {@spell 法术防护}, {@spell 心灵震击}", "1环（每日4次）：{@spell 法师护甲}, {@spell 侦测魔法}, {@spell 魔法飞弹}, {@spell 护盾}", "2环（每日3次）：{@spell 黑暗术}, {@spell 模糊术}, {@spell 失能术}, {@spell 镜影术}", "3环（每日3次）：{@spell 反制法术}, {@spell 闪电术}, {@spell 加速术}", "4环（每日3次）：{@spell 喷涌冰雹}, {@spell 次元门}", "5环（每日3次）：{@spell 操控气候}, {@spell 凡人圈套}", "6环（每日1次）：{@spell 全域防护}, {@spell 解离射线}", "7环（每日1次）：{@spell 手指死亡}, {@spell 传送术}", "8环（每日1次）：{@spell 心智控制}, {@spell 力场领域}", "9环（每日1次）：{@spell 灵魂禁锢}"] }
            : { name: "Spellcasting", entries: ["The lich is an 18th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 20, {@hit 12} to hit with spell attacks). It has the following wizard spells prepared:", "Cantrips (at will): {@spell mage hand}, {@spell prestidigitation}, {@spell ray of frost}", "1st level (4 slots): {@spell detect magic}, {@spell magic missile}, {@spell shield}, {@spell thunderwave}", "2nd level (3 slots): {@spell detect thoughts}, {@spell invisibility}, {@spell acid arrow}, {@spell mirror image}", "3rd level (3 slots): {@spell animate dead}, {@spell counterspell}, {@spell dispel magic}, {@spell fireball}", "4th level (3 slots): {@spell blight}, {@spell dimension door}", "5th level (3 slots): {@spell cloudkill}, {@spell scrying}", "6th level (1 slot): {@spell disintegrate}, {@spell globe of invulnerability}", "7th level (1 slot): {@spell finger of death}, {@spell plane shift}", "8th level (1 slot): {@spell dominate monster}, {@spell power word stun}", "9th level (1 slot): {@spell power word kill}"] }
,
          zh
            ? { name: "回光返照", entries: ["持有它命匣的巫妖在身死后 1d10 天内于命匣 5 尺内重新成形，获得满血。"] }
            : { name: "Rejuvenation", entries: ["If it has a phylactery, a destroyed lich gains a new body in 1d10 days, regaining all its hit points within 5 ft. of the phylactery."] },
        ],
        action: [
          zh
            ? { name: "瘫痪之触", entries: ["近战法术攻击：{@hit 12} 命中，触及 5 尺，单一生物。命中：{@damage 3d6} 点黯蚀伤害；目标须通过 DC 18 体质豁免，否则陷入麻痹状态 1 分钟。该生物可于每回合结束时重作豁免，成功即结束效果。"] }
            : { name: "Paralyzing Touch", entries: ["Melee Spell Attack: {@hit 12} to hit, reach 5 ft., one creature. Hit: {@damage 3d6} necrotic damage. The target must succeed on a DC 18 Constitution saving throw or be paralyzed for 1 minute. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success."] },
        ],
        bonus: [
          zh
            ? { name: "戏法施放", entries: ["巫妖以附赠动作施放一个戏法。"] }
            : { name: "Cantrip Cast", entries: ["The lich casts a cantrip as a bonus action."] },
        ],
        reaction: [
          zh
            ? { name: "反制法术", entries: ["当 60 尺内某生物正在施放一个法术时，巫妖作出反应试图反制之；具体效果同 {@spell 反制法术} 法术。"] }
            : { name: "Counterspell", entries: ["When a creature within 60 ft. casts a spell, the lich attempts to interrupt it as per the {@spell counterspell} spell."] },
        ],
        legendary: [
          zh
            ? { name: "传奇动作", entries: ["巫妖可施展以下 3 个传奇动作选项之一。每回合只能用一个传奇动作，且只能在其他生物的回合结束后。巫妖在其回合开始时恢复所用的传奇动作。"] }
            : { name: "Legendary Actions", entries: ["The lich can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The lich regains spent legendary actions at the start of its turn."] },
          zh
            ? { name: "戏法", entries: ["巫妖施放一个戏法。"] }
            : { name: "Cantrip", entries: ["The lich casts a cantrip."] },
          zh
            ? { name: "瘫痪之触（消耗 2 个动作）", entries: ["巫妖使用其瘫痪之触。"] }
            : { name: "Paralyzing Touch (Costs 2 Actions)", entries: ["The lich uses its Paralyzing Touch."] },
          zh
            ? { name: "破灭凝视（消耗 2 个动作）", entries: ["巫妖凝视 10 尺内某生物。该生物须通过 DC 18 感知豁免，否则该生物受 {@damage 4d10} 点黯蚀伤害，并陷入恐惧状态至该生物的下回合结束。"] }
            : { name: "Frightening Gaze (Costs 2 Actions)", entries: ["The lich fixes its gaze on one creature within 10 ft. for 1 round. The target must succeed on a DC 18 Wisdom saving throw or take {@damage 4d10} necrotic damage and be frightened until the end of the lich's next turn."] },
          zh
            ? { name: "扰乱生机（消耗 3 个动作）", entries: ["20 尺内每个非不死生物须通过 DC 18 体质豁免，承受 {@damage 6d6} 点黯蚀伤害（豁免成功减半）。"] }
            : { name: "Disrupt Life (Costs 3 Actions)", entries: ["Each non-undead creature within 20 ft. must make a DC 18 Constitution saving throw, taking {@damage 6d6} necrotic damage on a failed save, or half as much on a successful one."] },
        ],
      },
    ],
  };
}

// ---- wiring ----------------------------------------------------------------
importBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  const text = await file.text();
  jsonArea.value = text;
  state.activeIndex = 0;
  loadDoc(text);
  fileInput.value = "";
});
exportBtn.addEventListener("click", doExport);
newBtn.addEventListener("click", () => {
  const text = JSON.stringify({ monster: [blankMonster()] }, null, 2);
  jsonArea.value = text;
  state.activeIndex = 0;
  if (loadDoc(text)) rawDetails.open = false;
});
sampleBtn.addEventListener("click", () => {
  const text = JSON.stringify(sampleDoc(), null, 2);
  jsonArea.value = text;
  state.activeIndex = 0;
  if (loadDoc(text)) rawDetails.open = false;
});
monsterSelect.addEventListener("change", () => {
  state.activeIndex = Number(monsterSelect.value) || 0;
  renderForm();
  renderSections();
  renderPreview();
});

// Quick-edit form — event delegation (covers data-field inputs AND the
// dynamically-rebuilt ability grid's data-abil / data-save inputs).
formCard.addEventListener("input", (e) => {
  const el = e.target;
  if (!el || !el.dataset) return;
  if (el.dataset.field) applyField(el.dataset.field, el.value);
  else if (el.dataset.abil) applyScore(el.dataset.abil, el.value);
  else if (el.dataset.save) applySave(el.dataset.save, el.value);
});
// 体型 chip selector — single-select.
formCard.addEventListener("click", (e) => {
  const chip = e.target.closest && e.target.closest("[data-size-chip]");
  if (!chip) return;
  applyField("size", chip.dataset.sizeChip);
  for (const c of formCard.querySelectorAll("[data-size-chip]")) {
    c.classList.toggle("on", c === chip);
  }
});

// Section rows — text edits mutate in place (no re-render, keeps focus);
// add / delete rebuild the section list.
sectionsHost.addEventListener("input", (e) => {
  const row = e.target.closest && e.target.closest(".sect-row");
  if (!row) return;
  const m = activeMonster();
  if (!m) return;
  const sect = row.dataset.sect;
  const idx = Number(row.dataset.idx);
  if (!Array.isArray(m[sect]) || !m[sect][idx]) return;
  if (e.target.classList.contains("sr-name")) {
    m[sect][idx].name = e.target.value;
  } else if (e.target.classList.contains("sr-text")) {
    m[sect][idx].entries = textToEntries(e.target.value);
  }
  renderJson();
  renderPreview();
});
sectionsHost.addEventListener("click", (e) => {
  const m = activeMonster();
  if (!m) return;
  const addKey = e.target.dataset && e.target.dataset.add;
  if (addKey) {
    if (!Array.isArray(m[addKey])) m[addKey] = [];
    m[addKey].push({ name: t("msNewEntry"), entries: [] });
    renderSections();
    renderJson();
    renderPreview();
    return;
  }
  if (e.target.classList.contains("sr-del")) {
    const row = e.target.closest(".sect-row");
    if (!row) return;
    const sect = row.dataset.sect;
    const idx = Number(row.dataset.idx);
    if (Array.isArray(m[sect])) {
      m[sect].splice(idx, 1);
      renderSections();
      renderJson();
      renderPreview();
    }
  }
});

// Raw JSON textarea — debounced re-parse; on success rebuild everything
// EXCEPT the textarea itself (so the caret isn't clobbered mid-edit).
let jsonTimer = 0;
jsonArea.addEventListener("input", () => {
  clearTimeout(jsonTimer);
  jsonTimer = window.setTimeout(() => {
    loadDoc(jsonArea.value, { skipJsonArea: true });
  }, 350);
});

// Drag a .json file anywhere onto the window to load it.
window.addEventListener("dragover", (e) => { e.preventDefault(); });
window.addEventListener("drop", async (e) => {
  e.preventDefault();
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  const text = await file.text();
  jsonArea.value = text;
  state.activeIndex = 0;
  loadDoc(text);
});

// Initial empty preview.
renderPreview();
