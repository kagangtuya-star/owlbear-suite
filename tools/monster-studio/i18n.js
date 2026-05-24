// Standalone i18n for Monster Studio. Same mechanism as dice-studio's
// i18n.js: language from localStorage "obr-suite/lang" (shared with the
// plugin) → navigator.language fallback; data-i18n* apply; ZH/EN toggle.
// The ability / size / skill maps + the demo monster live LANG-aware in
// statblock.js / app.js (they're structured data, not flat strings).

export const LANG = (() => {
  try {
    const v = localStorage.getItem("obr-suite/lang");
    if (v === "en" || v === "zh") return v;
  } catch {}
  try {
    return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {}
  return "zh";
})();

const TR = {
  // shared studio chrome
  navMonster: { zh: "怪物编辑", en: "Monster" },
  navBuff: { zh: "Buff 合成", en: "Buff FX" },
  navDice: { zh: "骰子工坊", en: "Dice" },
  navMusic: { zh: "音乐板", en: "Music" },
  langToggle: { zh: "EN", en: "中文" },
  langToggleTitle: { zh: "Switch to English", en: "切换到中文" },

  // editor chrome
  msRawSummary: { zh: "① 粘贴 / 原始 JSON（直接编辑会覆盖下方表单）", en: "① Paste / raw JSON (editing here overwrites the form below)" },
  msJsonPh: { zh: '粘贴怪物 JSON：{"monster":[ … ]} 或 [ … ] 或单个 { … }', en: 'Paste monster JSON: {"monster":[ … ]}, [ … ], or a single { … }' },
  msDataTitle: { zh: "② 数据 / Data", en: "② Data" },
  msImport: { zh: "📂 导入 JSON", en: "📂 Import JSON" },
  msExport: { zh: "💾 导出 JSON", en: "💾 Export JSON" },
  msNew: { zh: "✦ 新建空白怪物", en: "✦ New blank monster" },
  msSample: { zh: "范例", en: "Sample" },
  msPicker: { zh: "怪物", en: "Monster" },
  msStatusInit: { zh: "粘贴或导入怪物 JSON（自定义怪物格式 / 5etools shape）开始编辑。", en: "Paste or import monster JSON (custom format / 5etools shape) to start editing." },
  msQuickTitle: { zh: "③ 快速编辑 / Quick Edit", en: "③ Quick Edit" },
  msSubBasic: { zh: "基本", en: "Basics" },
  msLblName: { zh: "名称 name", en: "Name (name)" },
  msLblEngName: { zh: "英文名 ENG_name", en: "English name (ENG_name)" },
  msLblSource: { zh: "来源 source", en: "Source (source)" },
  msLblSize: { zh: "体型 size", en: "Size (size)" },
  msSizeEmpty: { zh: "—", en: "—" },
  msSizeT: { zh: "微型", en: "Tiny" },
  msSizeS: { zh: "小型", en: "Small" },
  msSizeM: { zh: "中型", en: "Medium" },
  msSizeL: { zh: "大型", en: "Large" },
  msSizeH: { zh: "巨型", en: "Huge" },
  msSizeG: { zh: "超巨型", en: "Gargantuan" },
  msLblType: { zh: "类型 type", en: "Type (type)" },
  msTypePh: { zh: "例：humanoid / 不死生物", en: "e.g. humanoid / undead" },
  msLblAlignment: { zh: "阵营 alignment", en: "Alignment (alignment)" },
  msLblCR: { zh: "挑战等级 CR", en: "Challenge Rating (CR)" },
  msCRPh: { zh: "例：5 / 1/2", en: "e.g. 5 / 1/2" },
  msSubDefense: { zh: "防御", en: "Defenses" },
  msLblAC: { zh: "护甲等级 AC", en: "Armor Class (AC)" },
  msLblHP: { zh: "生命值 HP（数值或 公式）", en: "Hit Points (number or formula)" },
  msHPPh: { zh: "例：45 或 45,6d10+12", en: "e.g. 45 or 45,6d10+12" },
  msLblWalk: { zh: "步行速度 walk", en: "Walk speed (walk)" },
  msLblFly: { zh: "飞行 fly", en: "Fly (fly)" },
  msLblSwim: { zh: "游泳 swim", en: "Swim (swim)" },
  msLblClimb: { zh: "攀爬 climb", en: "Climb (climb)" },
  msLblBurrow: { zh: "挖掘 burrow", en: "Burrow (burrow)" },
  msSubAbilities: { zh: "属性 · 豁免", en: "Abilities · Saves" },
  msSubSkills: { zh: "技能 · 感知 · 抗性", en: "Skills · Senses · Resistances" },
  msLblSkill: { zh: "技能 skill", en: "Skills (skill)" },
  msSkillPh: { zh: "perception:+7, stealth:+5（英文键，逗号分隔）", en: "perception:+7, stealth:+5 (English keys, comma-separated)" },
  msLblPassive: { zh: "被动察觉 passive", en: "Passive Perception (passive)" },
  msLblSenses: { zh: "感官 senses", en: "Senses (senses)" },
  msPhComma: { zh: "逗号分隔", en: "comma-separated" },
  msLblLanguages: { zh: "语言 languages", en: "Languages (languages)" },
  msLblResist: { zh: "抗性 resist", en: "Resistances (resist)" },
  msLblImmune: { zh: "免疫 immune", en: "Immunities (immune)" },
  msLblVulnerable: { zh: "易伤 vulnerable", en: "Vulnerabilities (vulnerable)" },
  msLblCondImmune: { zh: "状态免疫 conditionImmune", en: "Condition immunities (conditionImmune)" },
  msSectionsTitle: { zh: "④ 特性 · 动作 / Sections", en: "④ Traits · Actions / Sections" },
  msPreviewTitle: { zh: "⑤ 实时预览 / Preview（复刻 OBR 弹窗 — 粘贴上方 JSON 即可在此实时渲染）", en: "⑤ Live Preview (mirrors the OBR popup — paste JSON above to render live here)" },
  msPreviewEmpty: { zh: "导入或粘贴怪物 JSON 后<br>这里会实时渲染怪物面板。", en: "Import or paste monster JSON<br>and the panel renders live here." },

  // section editor (app.js) — label includes an icon + the JSON key
  secTrait: { zh: "✦ 特性 trait", en: "✦ Traits (trait)" },
  secAction: { zh: "⚔ 动作 action", en: "⚔ Actions (action)" },
  secBonus: { zh: "⚡ 附赠动作 bonus", en: "⚡ Bonus actions (bonus)" },
  secReaction: { zh: "🛡 反应 reaction", en: "🛡 Reactions (reaction)" },
  secLegendary: { zh: "★ 传说动作 legendary", en: "★ Legendary actions (legendary)" },
  msEntryNamePh: { zh: "名称", en: "Name" },
  msEntryDel: { zh: "删除", en: "Delete" },
  msEntryDescPh: { zh: "描述（每段一行；保留 {@tag ...} 写法）", en: "Description (one line per paragraph; keep {@tag ...} syntax)" },
  msCountSuffix: { zh: "{n} 条", en: "{n}" },
  msAddEntry: { zh: "+ 添加条目", en: "+ Add entry" },

  // toasts / status (app.js)
  msErrMonsterEmpty: { zh: "monster 数组为空", en: "the monster array is empty" },
  msErrArrayEmpty: { zh: "数组为空", en: "the array is empty" },
  msErrBadShape: { zh: "无法识别的 JSON 结构", en: "unrecognised JSON shape" },
  msUnnamed: { zh: "未命名", en: "Unnamed" },
  msStatusParseFail: { zh: "JSON 解析失败：{err}", en: "JSON parse failed: {err}" },
  msKindArray: { zh: "[…]", en: "[…]" },
  msKindObject: { zh: "单个对象", en: "single object" },
  msStatusLoaded: { zh: "已加载 {n} 个怪物（{kind}）。", en: "Loaded {n} monster(s) ({kind})." },
  msStatusNoExport: { zh: "还没有可导出的数据。", en: "Nothing to export yet." },
  msStatusExported: { zh: "已导出 JSON 文件。", en: "Exported JSON file." },
  msNewMonster: { zh: "新怪物", en: "New monster" },
  msNewEntry: { zh: "新条目", en: "New entry" },

  // statblock preview (statblock.js)
  sbEmpty: { zh: "没有可预览的怪物数据", en: "No monster data to preview" },
  sbUnnamed: { zh: "未命名怪物", en: "Unnamed monster" },
  sbSave: { zh: "豁免", en: "Save" },
  sbPassive: { zh: "被动察觉 {n}", en: "Passive Perception {n}" },
  sbSpeed: { zh: "速度", en: "Speed" },
  sbSkill: { zh: "技能", en: "Skills" },
  sbSenses: { zh: "感知", en: "Senses" },
  sbLanguages: { zh: "语言", en: "Languages" },
  sbResist: { zh: "抗性", en: "Resistances" },
  sbImmune: { zh: "免疫", en: "Immunities" },
  sbVuln: { zh: "易伤", en: "Vulnerabilities" },
  sbCondImmune: { zh: "状态免疫", en: "Condition Immunities" },
  sbFt: { zh: "尺", en: "ft." },
  sbFly: { zh: "飞行", en: "fly" },
  sbSwim: { zh: "游泳", en: "swim" },
  sbClimb: { zh: "攀爬", en: "climb" },
  sbBurrow: { zh: "挖掘", en: "burrow" },
  sbSpellcasting: { zh: "施法", en: "Spellcasting" },
  sbAtWill: { zh: "随意", en: "At will" },
  sbPerDay: { zh: "{k}/日", en: "{k}/day" },
  sbCantrip: { zh: "戏法", en: "Cantrips" },
  sbRing: { zh: "{lvl} 环", en: "Level {lvl}" },
  sbSlots: { zh: "（{n} 个法术位）", en: " ({n} slots)" },
  sbLegendary: { zh: "传说动作", en: "Legendary Actions" },
  sbLegendaryPre: { zh: "该生物每轮可使用 {count} 个传说动作。", en: "The creature can take {count} legendary actions per round." },
  sbSecTrait: { zh: "特性", en: "Traits" },
  sbSecAction: { zh: "动作", en: "Actions" },
  sbSecBonus: { zh: "附赠动作", en: "Bonus Actions" },
  sbSecReaction: { zh: "反应", en: "Reactions" },
};

export function t(key, vars) {
  let s = TR[key]?.[LANG] ?? key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.dataset.i18n; if (TR[k]) el.textContent = TR[k][LANG];
  });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const k = el.dataset.i18nHtml; if (TR[k]) el.innerHTML = TR[k][LANG];
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const k = el.dataset.i18nTitle; if (TR[k]) el.title = TR[k][LANG];
  });
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const k = el.dataset.i18nPh; if (TR[k]) el.placeholder = TR[k][LANG];
  });
  document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";
}

export function mountLangToggle() {
  const host = document.querySelector(".topbar-actions");
  if (!host) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pill-link lang-toggle";
  btn.textContent = TR.langToggle[LANG];
  btn.title = TR.langToggleTitle[LANG];
  btn.addEventListener("click", () => {
    try { localStorage.setItem("obr-suite/lang", LANG === "zh" ? "en" : "zh"); } catch {}
    location.reload();
  });
  host.insertBefore(btn, host.firstChild);
}
