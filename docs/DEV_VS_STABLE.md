# dev 版 ↔ 稳定版 全部区别（2026-08-25）

对照对象：

| | 稳定版 | 测试版 |
| --- | --- | --- |
| manifest | `https://obr.dnd.center/suite/manifest.json` | `https://obr.dnd.center/suite-dev/manifest-dev.json` |
| 名称 | Full Suite | Full Suite (Dev) |
| 版本 | 1.1.11 | 1.0.145-dev |
| 分支 | `main` @ `b44759d` | `feat/dynamic-fog-parity` @ `19c4fc9`（基于 `dev` @ `883fe0b`） |
| 构建 | `deploy-suite.sh` → `STABLE_HIDES=true`, `SUITE_BASE=/suite/` | `deploy-suite-dev.sh` → `STABLE_HIDES=false`, `SUITE_BASE=suite-dev`, `SUITE_CHANNEL=dev` |

区别分两类：**A. 构建通道机制**（同一份源码、两种构建产物的差别）和
**B. 源码版本**（dev 分支比 stable 分支多出来的东西）。

---

## A. 构建通道机制造成的差别

### A1. `STABLE_HIDES` —— 现在只剩两个生效点

部署脚本在 build 前改写 `src/feature-flags.ts`。改造后，这个开关**只**控制两件事：

| 生效点 | 稳定版 | 测试版 |
| --- | --- | --- |
| `src/modules/fullFog/index.ts` → `authoring: !STABLE_HIDES` | 不注册动态迷雾的**编辑面**：门 / 密门 / 窗 / 直线四个迷雾工具模式、光源右键菜单与光源设置面板、门窗指示器（GM 与玩家两侧）、玩家「开关门窗」工具、玩家→GM 的开关广播监听、**光源遮挡**、**黑暗视觉** | 全部注册 |
| `src/settings.ts` → `HIDDEN_TAB_IDS` | 设置里**看不到**「动态迷雾」页签（所以也摸不到玩家开关门窗 / 常显指示器 / 光源遮挡 / DM 黑暗视觉 / 铺满迷雾这五个开关）。「迷雾编辑器」页签**两边都有** | 两个页签都可见 |

> 2026-08-25 起，`fullFog` 模块拆成 `fogEditor` + `dynamicFog` 两个可独立开关的
> 模块。通道门禁跟着挪到了 `dynamicFog` 页签上 —— 编辑器在稳定版一直是可见的。

两个通道**都**有的部分：

- 右键 MAP 图层图片 →「编辑地图迷雾」全屏编辑器（模块 `fogEditor`）；
- **墙引擎**：所有 FOG 图层图形（含编辑器描出的轮廓、OBR 原生迷雾工具画的形状）
  在每个客户端生成原生 `Wall`，并按已存在的门 / 密门 / 窗状态挖洞；
- **光源渲染**：带光源 metadata 的 item 生成原生 `Light`（含锥形光的自照明）。

> 2026-08-25 修正的一个既有隐患：光源渲染原先也在 `authoring` 门禁里，
> 于是稳定版客户端**一盏灯都不建**。场景一旦铺满迷雾、又有墙，稳定版玩家会
> 全黑。墙和光是场景**内容**，不是编辑面，现在两者都无条件注册；只有
> **改变**光行为的两项（光源遮挡、黑暗视觉）留在编辑面这一侧 —— 没有设置页
> 可配的通道不该悄悄拿到它们。

⚠ 因此稳定版会**正确遵守** dev 里画的门窗状态（如果两版共用同一 key，见 A3 —— 实际上不共用），
但稳定版用户**看不到指示器、也没有任何工具去开关它们**。

> 改造前稳定版只有编辑器 + 一个「只认编辑器轮廓 Path」的墙 watcher；
> 手画的迷雾形状不产生任何墙，编辑器里画的门（`kind === "door"` 的 Path）
> 被 watcher 显式跳过、完全不生成墙。

`follow`（已退役）在两个通道里都隐藏，不算通道差异。

### A2. 资源路径隔离

`assetUrl()` = `location.origin + import.meta.env.BASE_URL`，vite 在 build 时把
`BASE_URL` 定死为 `/suite/` 或 `/suite-dev/`。因此 dev 的 background.js 打开的
popover / modal / 图标 / 音效 **只**从 `/suite-dev/` 加载，不会串到 `/suite/`。

### A3. 元数据命名空间隔离（**只覆盖一部分**）

`vite.config.ts` 的 `devNamespaceIsolation` 插件在 dev 构建里把源码中所有
字面量 `com.obr-suite/` 替换成 `com.obr-suite-dev/`。受影响的包括：

- 场景状态 key（`com.obr-suite/state`）
- 套件自有的 item metadata（含本次的 `…/fullFog/openings`、`…/fullFog/light`）
- 广播频道、popover / tool / context-menu 的 id

**没有**被替换的命名空间：`com.bestiary/`、`com.character-cards/`、
`com.initiative-tracker/`、`com.time-stop/`、`com.battle-tracker/`、
`com.owlbear-rodeo-bubbles-extension/`。

⚠ 实际后果：

1. 同一个 OBR 房间同时装两版，**图鉴 / 角色卡 / 先攻 / 时停** 的数据仍会互相覆盖。
   测 dev 建议换房间，或先卸载稳定版。
2. 反过来说，**迷雾的门窗与光源数据在两版之间不互通** —— 在 dev 里画的门，
   稳定版读不到（key 前缀不同），反之亦然。

### A4. manifest / 入口

| | 稳定版 | 测试版 |
| --- | --- | --- |
| `name` | Full Suite | Full Suite (Dev) |
| `action.title` | 骰子 / Dice | 骰子 / Dice (Dev) |
| `icon` / `background_url` | `/suite/…` | `/suite-dev/…` |
| `homepage_url` | 有（GitHub） | 无 |

---

## B. 源码版本差别（dev 分支领先 stable 的全部内容）

`git log main..HEAD` = 12 个提交。按用户可见行为归类如下。

### B1. 动态迷雾重写（本次，6 个提交）

`645e22c` `05c2710` `5e5ab75` `69d2248` `ac4236d` `19c4fc9`

把原来三套自研子系统（只认编辑器轮廓的墙 watcher、只能挂在该轮廓上的门工具、
参数缩水的光源系统）整体替换为 owlbear-rodeo/dynamic-fog 的功能级移植
`src/modules/fullFog/dynfog/`。详见 [`DYNAMIC_FOG_PARITY.md`](DYNAMIC_FOG_PARITY.md)。

**修好的三个问题**

1. **墙只从编辑器轮廓来** → 现在所有 FOG 图层图形（矩形 / 圆 / 三角 / 六边 /
   手绘曲线 / 直线 / Path）都生成墙。
2. **墙上画不了门窗** → 门工具改成「贴着任意墙吸附」，不再要求指针必须命中
   `event.target`。编辑器输出的轮廓 Path 是 `disableHit` 的，永远不可能成为
   指针目标 —— 这正是原来在它上面画不了门的原因。
3. **光源是另一套设计、跟墙不搭** → 光源参数与上游逐字段对齐，原生 `Light` +
   原生 `Wall`，由 OBR 自己的渲染器做遮挡。

**新增能力**

| 能力 | 说明 |
| --- | --- |
| 直线墙工具 | 迷雾工具栏，拖出一段直墙，便于在上面挂门窗 |
| 门（快捷键 `O`） | 沿墙拖出；红=关（挡视线）/ 绿=开；点击切换，Alt+点击或双击删除 |
| 窗（快捷键 `I`） | 同样手势；**开关都通视**（关=青色玻璃，开=蓝绿敞开），开关表达的是「能不能钻过去」 |
| 密门（快捷键 `U`） | 视线上同门；玩家端**不生成任何指示器**，也无法开关（GM 侧二次校验）；GM 看到紫色虚线 |
| 光源遮挡 | 玩家看不见别人的灯，除非自己某盏灯到它之间**没有墙**。只看墙不看距离、不传递；`ambient` 光源豁免；GM 不受影响 |
| 黑暗视觉 | 每盏灯可设「彩色半径」，半径外到照明边缘转黑白（SKSL `EFFECT` + SATURATION 混合）。只对自己拥有的 token 生效，GM 可选预览 |
| 模块拆分 | `fullFog` → `fogEditor`（描边编辑器）+ `dynamicFog`（引擎），可独立开关；设置页删掉几百字的编辑器手册 |
| 玩家开关门窗 | 玩家看得到指示器（画在迷雾**下方**，未探索区域不泄露地图结构），工具栏「开关门窗」（快捷键 `K`）点一下即可；FOG 图层玩家写不了，所以走广播由 GM 落盘，权限由 `fogPlayerDoors` 控制 |
| 光源完整参数 | 范围（按场景单位）/ 全向或锥形 / 硬边或柔边 / 主光源或次光源 / 锥形旋转 / 锥形光的自照明 |
| 共享墙上的门 | 画在两个重叠迷雾形状交界处的门，会同时打穿两个形状的墙（上游靠 Skia 布尔差集，这里用世界空间胶囊距离复现） |
| 上游数据兼容 | 能读官方 Dynamic Fog 扩展写的 `rodeo.owlbear.dynamic-fog/doors`，首次写入时迁移到套件自己的格式 |

**顺带修掉的**

- 编辑器在「独立保存」模式下会自己再生成一套 `Wall`。新引擎两种模式都覆盖，
  那套没人管的墙会在引擎把门打开后继续挡视线 —— 独立保存的地图等于永久封死。
- `wallExpandPx` 保存时被 `Math.max(0, …)` 掐掉负半区，滑块一半的行程静默失效，
  且和编辑器里的洋红色墙体预览对不上。
- `wallExpandPx` 的单位是图片像素，换算需要地图图片的 `grid.dpi`；独立保存的
  Path 没有 `attachedTo`，根本找不到那张地图。现在保存时额外写一份换算好的值。

**成本**：`package.json` **没有新增任何依赖**。上游依赖 6.8 MB 的 CanvasKit
WASM，而 background iframe 是每个客户端都要加载的，所以几何内核用纯 TS 重写。
唯一刻意的行为差异：墙取图形的**中心线**而不是**描边轮廓**（遮挡效果等价，墙数量减半）。

**明确放弃的一项**：**历史迷雾**（已探索区域保持可见）。OBR 的公开 API 无法
把「地形记忆」和「活体 token」分开渲染 —— 迷雾一旦揭开，房间里的哥布林也一起
可见。唯一忠实的做法是客户端重新解码地图图片、按已探索区域裁剪去色、再作为本地
IMAGE 压在迷雾之上，属于大工程且有明显性能风险。同理，「关着的窗不能通过」的
**移动阻挡**也没有做：OBR 没有移动碰撞 API，只能靠「拖动结束后检测穿墙并弹回」，
误判代价太高，经确认不做。

**验证**：`node tools/dynfog-selftest.mjs`（40 项自测：几何 + 视线索引）、
`node tools/dynfog-visual.mjs docs/dynfog-walls.svg`（把引擎真实输出画成 SVG）。

### B2. §9 DM 固定骰点 + 减骰显示一致性（`883fe0b`）

- 新增 `src/modules/dice/fixed-roll.ts`：一次性「上膛」（存 localStorage）+
  骰面分配器（随机扰动、命中目标值、只用合法骰面；5000 组随机压力测试通过）。
- 面板 `buildFixedRollDice` 镜像引擎结构：普通求和、减骰、最大/最小钳制、
  reset\*（任意骰面可达）、repeat（修正值 × 行数）、最外层单个优势/劣势
  （附带真实的落败骰组，摆放位置能挺过 `rollExpr` 的首个最大值扫描）。
  连爆 / 嵌套优劣势会拒绝并给 WARNING（保持上膛）。
- 单目标限定；消费前用新鲜的 `getRole` 复核 GM 身份；上膛 UI 行仅 DM 可见，
  降权即自动卸膛并隐藏。
- 快速投骰 `buildFixedSimple` 镜像简单求和管线（含负项落败记账、优势搭档、
  暴击双骰）；分组豁免（`collectiveId`）按约定排除。
- 先攻：单角色先攻的 劣 / 普 / 优 固定 d20 骰面（含真实落败搭档）；分组先攻不动。
- 一致性：动画累计总数、repeat 行总数（面板 / 历史 / 回放）以及旧版 payload
  兜底路径全部对减骰取负 —— `1d20-1d4` 现在会动画到广播出来的那个总数。

### B3. §8 先攻回合通知 + 推进失败回滚（`e6f90da`）

- `BROADCAST_TURN_CHANGE`（此前只声明未使用）现在承载 `TurnChangePayload`，
  由推进方在指针写入提交后发出；background 收到后弹 `OBR.notification`。
- 当前玩家收到「你的回合」（隐形单位的拥有者收到不含名字的通用提示）；
  下一个 **PUBLIC 且玩家拥有**的条目的拥有者收到「做好准备」；
  隐形单位在向后查找时被跳过，内容和时序都不泄露它们的存在。
- 战斗开始时为第 1 轮首个回合发同样的通知。
- `advanceTurn`：指针写入改到轮次写入之前（不再出现指针失败却轮次 +1 的幽灵回合）；
  失败时回滚乐观指针、打全量上下文日志、GM 收到 ERROR 通知；
  焦点 / 结束回合的广播失败也记日志。

### B4. §7 搜索栏仅 DM 可见（`44debaf`）

- 新设置 `searchGmOnly`（默认关）+ merge / equality 接线。
- `searchAllowed()` 单一权限闸；可见性链串行化（最后一个决定生效）；
  角色在首次打开前就播种、并通过 `player.onChange` 保持实时；
  状态变化与场景 ready 变化都会重新过闸。
- 玩家侧打开时对着**新鲜的**场景状态复核，消除水合期的闪现泄露。
- `closeBar` 去掉 `isOpen` 提前返回，让打开途中被拒也能真正关掉。
- 布局编辑器里的搜索栏代理框在被拒时一并隐藏。
- 设置里新增 GM 专用开关行；`search/page` 的角色保持实时（角色变化重新过滤怪物），
  原先被吞掉的 `getRole` 异常现在记日志。

### B5. transform（变身）策略调整（`969d58f` `d4cd36d`）

- 已变身的 token 上也隐藏 GM 的「变身」菜单：要改策略先还原。
- 头部注释与实现对齐；dev manifest 版本号推进。

### B6. 跨模块重构 batch 1（`9034607`）

对照 `docs/CROSS_MODULE_REWORK_CHECKLIST.md` 的 §1–6：

- **statusTracker**：`items.onChange` 当作完整快照处理（不再回查）、
  按 token 串行写入、先确认删除再新增、sweep 与 sync 两个通道互斥、
  写失败保持可重试（绝不记为已同步）、粘性全量重同步标志、
  capture / manage 页面复用快照、渲染模式切换 = 一次合并的重同步（GM 限定按钮）、
  全流程带 stage + id 日志。
- **资源 id**：客户端镜像新的 `auto-{slug}-{sha256[:8]}` 方案（同步 sha-256）、
  绑定时修复退化 / 重复 id（带审计备份 + `legacyId`）、
  仅 id 的可逆回滚（带确认）、按出现次数合并、幂等的预设合并。
- **portals**：场景启动与 `onReadyChange` 时建立全场景拖拽基线、
  代际守卫的重建、选择监听不再播种 / 剪枝、
  `entryId` 贯穿整条传送链以便失败时定位。
- **transform**：菜单 / 前置检查 / 草稿三层都拒绝嵌套变身（带日志 + 通知）；
  GM 保留选择器入口以便编辑策略；旧的多层堆栈仍能正常回退。
- **displayAs**：共享分类器把施法条目路由到 动作 / 附赠 / 反应，
  monster-info、搜索预览、Monster Studio 三处统一（后者是镜像实现）；
  未知值只警告一次并带上身份信息。
- **武器 / 物品编辑网格**：`minmax` 轨道 + `min-width:0`，窄面板不再裁掉第 3 个之后的输入框。

### B7. bubbles / 先攻血条修正（`8811a60` 快照）

- **bubbles**：token 的**可见性**纳入重建哈希。所有 builder 在构造时就把
  `.visible(ctx.visible)` 烤进去，之前哈希里没有它 —— 隐藏一个 token，它的血条
  还留在屏幕上；显示一个当初在隐藏状态下建好血条的 token，血条再也回不来，
  直到某次无关编辑碰巧让哈希失效。
- **先攻条**：血量改为优先读套件自己的 `com.obr-suite/bubbles/data`，
  上游 Bubbles 扩展的 key 作为兜底。此前只读上游 key，导致所有由套件自己写入
  血量的 token（图鉴生成、角色卡绑定、小血条组件）在先攻条里完全找不到血量。
- **先攻条**：尊重 bubbles 的 `hide` 标记 —— DM 标记为隐藏的数值，
  除 DM 外任何人都看不到百分比条（拥有者、战斗中、任何阈值都不例外）。

### B8. `manifest.json` 去掉 UTF-8 BOM（`edddfbd`）

---

## C. 只存在于源码、两个通道都不生效的东西

- `src/modules/dev-test/`（popover 重锚点探针）：自身用 `BASE_URL` 含
  `/suite-dev/` 做门禁，但 `background.ts` 里**没有**引用它，两个通道都不注册。
- `src/modules/follow/`：2026-05-14 退役，未接线，设置里两个通道都隐藏。
- `src/modules/musicBoard/`：随项目封盘退役，`background.ts` 未注册，
  设置页仅保留指向独立网页版的链接。

---

## D. 发布这一版之前需要知道的

1. **测试版部署命令**（未执行，等你确认）：
   ```bash
   bash "C:/Users/Administrator/Desktop/枭熊插件/deploy-suite-dev.sh"
   ```
2. 门窗 / 光源数据在两个通道之间**不互通**（A3），dev 里画的门稳定版读不到。
3. **不要和官方 Dynamic Fog 扩展同时启用**：两边都会从同一批迷雾图形推导墙，
   每面墙会被建两遍。功能仍然正常，只是白白翻倍开销。
4. 如果打开后觉得「墙和光完全没反应」，先检查
   设置 → **动态迷雾** →「整张地图铺满迷雾」。OBR 的场景迷雾没有铺满时，
   玩家本来就能看到整张图，墙和光源不会有任何可见效果。
5. 如果玩家反馈「什么灯都看不见」，检查两件事：他自己的 token 上有没有光源，
   以及场景里的固定照明（墙上火把、天光）有没有在光源设置里勾上**环境光**。
   这是「光源遮挡」默认开启的直接后果，见设置里该项的说明。
