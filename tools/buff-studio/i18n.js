// Standalone i18n for Buff Studio. Same mechanism as the other studio
// tools. anims.js is left untouched (its Chinese labels double as the
// lookup keys); ta() maps an anim / param / blend label to English.

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

  // contributor banner
  bfContribText: { zh: "<b>老师们！如果做出了不错的 buff 特效，求求请打包发我一份（文件形式）！</b> 我会把它收进默认特效里送给所有人用 —— 目前的默认特效真的太丑了，但鄙人没时间一个一个搓，实在抱歉。<b>邮箱：1763086701@qq.com</b> · 微信 / QQ 加好友均可。", en: "<b>If you make a nice buff effect, please pack it up and send it to me (as a file)!</b> I'll add it to the built-in effects for everyone — the current defaults are honestly pretty ugly, but I don't have time to hand-craft each one. Sorry! <b>Email: 1763086701@qq.com</b> · WeChat / QQ friend requests welcome." },
  bfContribClose: { zh: "关闭（之后不再显示）", en: "Dismiss (won't show again)" },

  // layers + sources
  bfLayersTitle: { zh: "① 图层 / Layers", en: "① Layers" },
  bfLayerEmpty: { zh: "还没有图层。<br>用下方的素材添加第一层。", en: "No layers yet.<br>Add your first from the sources below." },
  bfAddSrcTitle: { zh: "② 添加素材 / Add Source", en: "② Add Source" },
  bfModeImage: { zh: "本地图片", en: "Local image" },
  bfModeAnim: { zh: "GIF / 视频", en: "GIF / Video" },
  bfEmojiSearchPh: { zh: "搜索 emoji（中英文 / codepoint）…", en: "Search emoji (CN / EN / codepoint)…" },
  bfEmojiHint: { zh: "点一个 emoji = 新建一个图层。", en: "Click an emoji = new layer." },
  bfDropImage: { zh: "拖拽图片到这里，或", en: "Drag images here, or" },
  bfChooseImage: { zh: "选择图片", en: "Choose images" },
  bfImageHint: { zh: "PNG / JPG / WebP / SVG · 可多选，每张一层", en: "PNG / JPG / WebP / SVG · multi-select, one layer each" },
  bfSavedGallery: { zh: "本地画作（保存于此浏览器）", en: "Local artwork (saved in this browser)" },
  bfDropAnim: { zh: "拖拽 GIF / MP4 / WebM 到这里，或", en: "Drag GIF / MP4 / WebM here, or" },
  bfChooseAnim: { zh: "选择动图 / 视频", en: "Choose animation / video" },
  bfAnimHint: { zh: "GIF · 动态 WebP · MP4 · WebM · MOV · 可多选", en: "GIF · animated WebP · MP4 · WebM · MOV · multi-select" },
  bfConvertBtn: { zh: "⇄ GIF / MP4 → WebM 直转", en: "⇄ GIF / MP4 → WebM direct convert" },
  bfConvertHint: { zh: "直转：导入一个动图并自动铺满画布，调好下方参数后点「生成」。", en: 'Direct convert: import one animation, auto-fit the canvas, tune the params below, then click "Generate".' },

  // stage
  bfStageTitle: { zh: "③ 合成台 / Stage", en: "③ Stage" },
  bfStageHint: { zh: "— 拖动图层移动 · 顶部把手旋转 · 右下把手缩放", en: "— drag to move · top handle rotates · bottom-right handle scales" },
  bfShowToken: { zh: "显示参考 token", en: "Show reference token" },
  bfLoopPreview: { zh: "循环播放预览", en: "Loop preview" },
  bfPreviewBg: { zh: "预览底色", en: "Preview backdrop" },
  bfBgTransparent: { zh: "透明", en: "Transparent" },
  bfBgTransparentTitle: { zh: "透明（导出实际样子）", en: "Transparent (true export look)" },
  bfBgChecker: { zh: "棋盘", en: "Checker" },
  bfBgCheckerTitle: { zh: "棋盘格（看清透明区）", en: "Checkerboard (see transparent areas)" },
  bfBgDark: { zh: "暗", en: "Dark" },
  bfBgDarkTitle: { zh: "深灰底（最常见的 token 底）", en: "Dark gray (most common token base)" },
  bfBgLight: { zh: "浅", en: "Light" },
  bfBgLightTitle: { zh: "浅灰底", en: "Light gray" },
  bfBgBlack: { zh: "黑", en: "Black" },
  bfBgBlackTitle: { zh: "纯黑", en: "Pure black" },
  bfBgWhite: { zh: "白", en: "White" },
  bfBgWhiteTitle: { zh: "纯白", en: "Pure white" },
  bfBgHint: { zh: "仅预览生效，导出仍是透明", en: "Preview only — export stays transparent" },
  bfPaintTitle: { zh: "④ 画板 / Paint", en: "④ Paint" },
  bfPaintHint: { zh: "— 画好后「保存到素材」，会出现在左侧「本地图片」里", en: '— after drawing, "Save to sources" → it appears under "Local image" on the left' },

  // props + canvas + generate
  bfLayerPropsTitle: { zh: "⑤ 图层属性 / Layer", en: "⑤ Layer" },
  bfPropsEmpty: { zh: "选择一个图层来编辑它的位置、大小和动画。", en: "Select a layer to edit its position, size and animation." },
  bfCanvasTitle: { zh: "⑥ 画布 / Canvas", en: "⑥ Canvas" },
  bfCanvasSize: { zh: "画布大小", en: "Canvas size" },
  bfDuration: { zh: "时长 (秒)", en: "Duration (s)" },
  bfGenTitle: { zh: "⑦ 生成 / Generate", en: "⑦ Generate" },
  bfGenBtn: { zh: "🎬 生成 WebM", en: "🎬 Generate WebM" },
  bfPreparing: { zh: "准备中…", en: "Preparing…" },
  bfDownloadWebm: { zh: "⬇ 下载 .webm", en: "⬇ Download .webm" },
  bfHelpSummary: { zh: "使用说明 / How to use", en: "How to use" },
  bfHelp1: { zh: "<b>① 加图层</b>：emoji / 本地图片 / 拖入 GIF·视频，每个素材一层，可叠多层做拼贴", en: "<b>① Add layers</b>: emoji / local image / drop a GIF·video — one layer per source, stack many for a collage" },
  bfHelp2: { zh: "<b>③ 摆位置</b>：合成台上拖动移动；顶部把手旋转、右下把手缩放；右侧还能调透明度 / 混合模式", en: "<b>③ Position</b>: drag on the stage; top handle rotates, bottom-right scales; opacity / blend on the right" },
  bfHelp3: { zh: "<b>④ 画板</b>：随手画一个图标，「保存到素材」后在左侧「本地图片」中作为图层使用", en: '<b>④ Paint</b>: sketch an icon, "Save to sources", then use it as a layer from "Local image" on the left' },
  bfHelp4: { zh: "<b>⑤ 加动画</b>：50 种循环无缝动画（脉冲 / 抖动 / 粒子迸发 / 悠扬乐符 / 落叶 / 萤火虫…），参数可调", en: "<b>⑤ Animate</b>: 50 seamless loop animations (pulse / jitter / particle burst / drifting notes / falling leaves / fireflies…), all tunable" },
  bfHelp5: { zh: "<b>⑦ 点生成</b>：烘焙所有帧 → ffmpeg.wasm 编码带 alpha 的 WebM（首次下载 ~30MB，之后缓存）", en: "<b>⑦ Generate</b>: bake all frames → ffmpeg.wasm encodes an alpha WebM (first download ~30 MB, then cached)" },
  bfHelpFoot: { zh: "生成的 .webm 可放进 OBR Suite 状态追踪的 <code>public/buff-fx/</code>，或作为 OBR Image item 的 url。", en: "The .webm goes into OBR Suite Status Tracker's <code>public/buff-fx/</code>, or as the url of an OBR Image item." },

  // app.js — layers / badges / titles
  bfLayer: { zh: "图层", en: "Layer" },
  bfAnimLayer: { zh: "动图", en: "Anim" },
  bfBadgeAnim: { zh: "动图 {n}帧", en: "anim · {n}f" },
  bfBadgeStatic: { zh: "静态图", en: "static" },
  bfUp: { zh: "上移", en: "Move up" },
  bfDown: { zh: "下移", en: "Move down" },
  bfToggleVis: { zh: "显示/隐藏", en: "Show / hide" },
  bfDelete: { zh: "删除", en: "Delete" },

  // app.js — layer props
  bfPlaySpeed: { zh: "播放速度", en: "Playback speed" },
  bfSecTransform: { zh: "变换", en: "Transform" },
  bfName: { zh: "名称", en: "Name" },
  bfPosX: { zh: "位置 X", en: "Position X" },
  bfPosY: { zh: "位置 Y", en: "Position Y" },
  bfScale: { zh: "缩放", en: "Scale" },
  bfRotation: { zh: "旋转", en: "Rotation" },
  bfOpacity: { zh: "透明度", en: "Opacity" },
  bfCenter: { zh: "居中", en: "Center" },
  bfFit: { zh: "适配", en: "Fit" },
  bfCover: { zh: "铺满", en: "Cover" },
  bfSecBlend: { zh: "混合模式", en: "Blend mode" },
  bfBlendHint: { zh: "滤色 / 相加发光 / 正片叠底 是把本图层与<b>下方像素</b>混合 — 在透明画布上单图层不会有视觉差异。需要看效果就在合成台下方切换<b>「预览底色」</b>或叠多个图层。导出的 WebM 始终是透明背景。", en: "Screen / Add / Multiply blend this layer with the <b>pixels below</b> — a single layer on a transparent canvas shows no visual difference. To see the effect, switch the <b>\"Preview backdrop\"</b> under the stage, or stack more layers. The exported WebM is always transparent." },
  bfSecAnim: { zh: "动画（循环无缝 · 50 种）", en: "Animation (seamless loop · 50)" },
  bfAnimSrc: { zh: "动图源：{n} 帧 · {dur}s · {w}×{h}", en: "Anim source: {n} frames · {dur}s · {w}×{h}" },
  bfStaticSrc: { zh: "静态图源：{w}×{h}", en: "Static source: {w}×{h}" },

  // app.js — toasts / status
  bfAddedLayer: { zh: "已添加图层「{name}」", en: 'Added layer "{name}"' },
  bfEmojiLoadFail: { zh: "emoji 加载失败：{err}", en: "Emoji failed to load: {err}" },
  bfImgLoadFail: { zh: "图片「{name}」加载失败", en: 'Image "{name}" failed to load' },
  bfDecoding: { zh: "正在解码「{name}」…", en: 'Decoding "{name}"…' },
  bfDecoded: { zh: "「{name}」已加入 · {n} 帧", en: '"{name}" added · {n} frames' },
  bfDecodeFail: { zh: "「{name}」解码失败：{err}", en: 'Failed to decode "{name}": {err}' },
  bfSaveFull: { zh: "保存失败：浏览器本地存储已满", en: "Save failed: browser local storage is full" },
  bfGalleryEmpty: { zh: "还没有保存的画作。<br>用画板画一个并「保存到素材」。", en: 'No saved artwork yet.<br>Draw one on the board and "Save to sources".' },
  bfAsLayer: { zh: "作为图层添加", en: "Add as layer" },
  bfEditInPaint: { zh: "载入画板编辑", en: "Load into the paint board" },
  bfLoadedToPaint: { zh: "「{name}」已载入画板", en: '"{name}" loaded into the paint board' },
  bfAddFail: { zh: "添加失败", en: "Add failed" },
  bfNeedLayer: { zh: "先添加至少一个图层", en: "Add at least one layer first" },
  bfBaking: { zh: "烘焙帧 {f}/{total}", en: "Baking frame {f}/{total}" },
  bfLoadFfmpeg: { zh: "加载 ffmpeg.wasm…", en: "Loading ffmpeg.wasm…" },
  bfDone: { zh: "完成 ✓", en: "Done ✓" },
  bfGenFailStatus: { zh: "失败：{msg}", en: "Failed: {msg}" },
  bfGenFailToast: { zh: "生成失败：{msg}", en: "Generation failed: {msg}" },
  bfSaveToSrc: { zh: "💾 保存到素材", en: "💾 Save to sources" },
  bfArtName: { zh: "画作 {n}", en: "Artwork {n}" },
  bfSavedToSrc: { zh: "已保存「{name}」到素材", en: 'Saved "{name}" to sources' },
  bfFramesSuffix: { zh: "帧", en: "f" },

  // decode.js errors
  bfDecNoFrames: { zh: "没有解出任何帧", en: "No frames could be decoded" },
  bfDecNoVideo: { zh: "浏览器无法解码该视频", en: "Your browser can't decode this video" },
  bfDecSeekFail: { zh: "视频跳帧失败", en: "Video frame-seek failed" },

  // encoder.js progress
  bfEncReady: { zh: "ffmpeg 就绪，开始写入帧", en: "ffmpeg ready — writing frames" },
  bfEncWriteFrame: { zh: "写入帧 {i}/{n}", en: "Writing frame {i}/{n}" },
  bfEncEncoding: { zh: "编码 · {pct}%", en: "Encoding · {pct}%" },
  bfEncVp8: { zh: "编码 VP8 + alpha", en: "Encoding VP8 + alpha" },
  bfEncReadOut: { zh: "读取输出", en: "Reading output" },
  bfEncDone: { zh: "完成", en: "Done" },
};

// Anim / param / blend label translations (anims.js + BLEND_OPTS stay
// Chinese; ta() maps the Chinese display string to English).
const ANIM = {
  // animation names
  "无": "None", "脉冲缩放": "Pulse Scale", "上下浮动": "Bob", "左右摇摆": "Sway",
  "自身环绕": "Self Orbit", "旋转": "Spin", "摇晃": "Wobble", "淡入淡出": "Fade",
  "闪烁": "Blink", "抖动": "Jitter", "心跳": "Heartbeat", "呼吸": "Breathe",
  "漂移": "Drift", "闪烁粒子": "Twinkle Particles", "粒子迸发": "Particle Burst",
  "从上往下": "Top-Down", "从下往上": "Bottom-Up", "环绕粒子": "Orbiting Particles",
  "漩涡": "Vortex", "喷泉": "Fountain", "倾斜摇摆": "Tilt Sway", "弹跳": "Bounce",
  "缩放脉冲": "Scale Pulse", "火光闪烁": "Flame Flicker", "钟摆": "Pendulum",
  "8 字环绕": "Figure-8", "后坐冲击": "Recoil", "扭动": "Wiggle", "悬浮": "Hover",
  "螺旋自转": "Spiral Spin", "故障跳动": "Glitch Jump", "漂浮升降": "Float Up/Down",
  "悠扬乐符": "Drifting Notes", "气泡上升": "Rising Bubbles", "火星升腾": "Rising Embers",
  "飘雪": "Snowfall", "落叶旋转": "Falling Leaves", "螺旋扩散": "Spiral Spread",
  "彩纸纷飞": "Confetti", "萤火虫": "Fireflies", "冲击波环": "Shockwave Rings",
  "花瓣飘落": "Falling Petals", "流星划过": "Shooting Stars", "漩涡吸入": "Vortex Suck",
  "灵气环绕": "Aura Orbit", "向上迸发": "Upward Burst", "散开聚合": "Scatter & Gather",
  "星光闪耀": "Starlight Sparkle", "瀑布倾泻": "Waterfall", "光环旋转": "Halo Rotation",
  // param labels
  "缩放幅度": "Scale amount", "周期数": "Cycles", "幅度": "Amount", "半径": "Radius",
  "圈数": "Turns", "角度": "Angle", "最低透明度": "Min opacity", "频率": "Frequency",
  "亮起占比": "On ratio", "数量": "Count", "范围": "Range", "粒子大小": "Particle size",
  "闪烁频率": "Blink rate", "扩散半径": "Spread radius", "迸发次数": "Bursts", "速度": "Speed",
  "横向范围": "Horizontal range", "转速": "Spin speed", "旋转次数": "Rotations", "散开": "Spread",
  "喷发次数": "Eruptions", "固定角度": "Fixed angle", "摆动幅度": "Swing amount",
  "弹跳高度": "Bounce height", "弹跳次数": "Bounces", "脉冲次数": "Pulses",
  "闪烁强度": "Flicker intensity", "摆动角度": "Swing angle", "横向幅度": "Horizontal amp",
  "纵向幅度": "Vertical amp", "冲击距离": "Recoil distance", "冲击方向": "Recoil direction",
  "冲击次数": "Recoils", "扭动角度": "Wiggle angle", "扭动频率": "Wiggle rate",
  "环绕半径": "Orbit radius", "环绕圈数": "Orbit turns", "自转圈数": "Spin turns",
  "跳动幅度": "Jump amount", "跳动次数": "Jumps", "升降幅度": "Rise/fall amount",
  "上升高度": "Rise height", "横向漂移": "Horizontal drift", "上升速度": "Rise speed",
  "翻转角度": "Flip angle", "晃动幅度": "Wobble amount", "下落速度": "Fall speed",
  "飘摆幅度": "Sway amount", "摇摆幅度": "Sway amount", "翻转圈数": "Flip turns",
  "螺旋圈数": "Spiral turns", "扩散次数": "Spreads", "游荡范围": "Wander range",
  "波纹数量": "Ring count", "划过速度": "Streak speed", "划过方向": "Streak direction",
  "划过距离": "Streak length", "起始半径": "Start radius", "吸入次数": "Suck cycles",
  "半径呼吸": "Radius breathe", "迸发高度": "Burst height", "散开幅度": "Scatter amount",
  "散开半径": "Scatter radius", "列数": "Columns", "宽度": "Width", "光环半径": "Halo radius",
  "倾斜压扁": "Tilt squash", "粒子自转圈数": "Particle spin turns",
  // blend modes
  "正常": "Normal", "滤色": "Screen", "相加发光": "Add (glow)", "正片叠底": "Multiply",
};

export function t(key, vars) {
  let s = TR[key]?.[LANG] ?? key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

// Translate an anim / param / blend label (Chinese is the key).
export function ta(zh) {
  return LANG === "en" ? (ANIM[zh] ?? zh) : zh;
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
  const host = document.querySelector(".topbar-actions") || document.querySelector(".topbar");
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
