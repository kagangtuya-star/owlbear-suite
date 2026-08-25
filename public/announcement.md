# DM 公告

> 编辑此文件直接修改弹窗内容。每个 `## 标题 [kind] [lang]` 是一个分区，
> kind 决定渲染样式：
>   - `[warn]` 红色警告条 / `[info]` 蓝色提示条 / `[notice]` 长文段落
>   - **A 板块** `[issues]` bug / 需求表格 — 每行 `类型 | 严重度 | 描述`，
>     类型 ∈ `bug` / `feature` / `wip` / `done`；严重度 ∈ `critical` /
>     `high` / `medium` / `low`（可省略）。
>   - **B 板块** `[highlights]` 新亮点图文 — 每行 `图片URL | 标题 | 描述`，
>     图片可省（仅写 `标题 | 描述` 也行）。图片相对路径会自动按 base 解析。
>   - **C 板块** `[changelog]` 简单更新日志 — 每行 `版本号 · 描述`。
>     **注意：侧栏喇叭的「未读」判定就是从这里抓第一个 `- x.y.z ·` 版本号，
>     每次发布务必更新它，否则玩家端不会提示有新公告。**
>   - `[todo]` 普通待办列表（每行 `desc | tag | size`）/ `[footer]` 落款。
> lang 控制独立的 CN|EN 切换：`[zh]` 仅中文模式显示，`[en]` 仅英文，
> 不带语言标签则两边都显示（如 footer / 共享通知）。
>
> 行内：`**粗体**`、`` `代码` ``、邮箱自动转 mailto 链接，
> `<span style="color:#hex">文本</span>` 给一段文字上色。
> 部署：`bash deploy-suite-dev.sh`（dev）或 `bash deploy-suite.sh`（正式版）。

## ✨ 本次更新 · 动态迷雾 [highlights] [zh]

新增了动态迷雾系统 | 现在你可以在这个插件里直接造**门和窗**了。用迷雾工具画出墙，再沿着墙拖一下就是一道门 —— 红色是关着，绿色是开着，点一下切换。具体用法看 **设置 → 动态迷雾**。
所有迷雾图形都会挡视线了 | 以前只有「迷雾编辑器」自动描出来的轮廓才生成墙，手画的矩形、圆、曲线通通不挡视线。现在**任何**用迷雾工具画的形状都会挡住视线。
窗户：能看见，但过不去 | 窗户开着关着**都能看穿**，开关表达的是「人能不能钻过去」。关着的窗是青色玻璃，开着的是蓝绿敞开。
密门：玩家完全看不见 | 用密门工具挖的洞，玩家端**不会生成任何指示器**，也开不了。DM 自己看到的是紫色虚线。
玩家可以自己开关门 | 玩家工具栏多了一个「开关门窗」，点一下门就开了，不用每次喊 DM。指示器画在迷雾**下面**，没探索到的区域不会提前泄露地图结构。不想要的话在设置里关掉。
光源不再穿墙泄底 | 别人家的火把默认看不见，除非你自己的光源到它之间**没有墙挡着**。墙上火把、天光这类固定照明，在光源设置的「类型」里选**环境光**就会一直可见。

## 🔧 这次修好的 [issues] [zh]

bug | high | **开关门时会闪一下，把门后面还没探索的房间露出来。** 关门时旧代码先删掉一段墙、再把另一段补回去，中间那一帧墙是缺的，视线直接灌进去。
bug | high | **迷雾编辑器「独立保存」的地图会被永久封死。** 编辑器自己额外生成了一套没人管的墙，门开了它还在挡。
bug | medium | **墙体外扩滑块的负半区（把墙推进墙体里）一直没生效**，而且和编辑器里的紫色预览对不上。
bug | medium | **世界包（.fobr）导入旧存档时图片全裂。** 旧包里存的是已经下线的图片地址，导入时会自动改写成新地址了。
bug | low | **设置面板不认中途给的 DM 权限。** 玩家被提成 DM 后要重开面板才能看到 DM 专属选项，现在会自动刷新。
done | | **描边地图的墙体计算快了约 12 倍**，开关门不再卡顿，插件启动也变轻了。

## ⚠️ 请关掉官方 Dynamic Fog 扩展 [warn] [zh]

本套件**已经完整包含**官方 Dynamic Fog 的全部功能（墙、门、光源），并且多了窗户、玩家可开关的门、以及密门。两个同时开着不会报错，但每面墙、每盏灯都会被建两遍，白白翻倍开销。官方扩展里画好的**门会自动继承**过来，关掉它不会丢；**光源需要重新添加一次**。

## ✨ What's New · Dynamic Fog [highlights] [en]

Dynamic fog is here | You can now build **doors and windows** right inside this plugin. Draw a wall with the fog tool, drag along it, and that stretch becomes a door — red is shut, green is open, click to flip. Full details in **Settings → Dynamic Fog**.
Every fog shape blocks vision now | Previously only the fog editor's traced outline produced walls, so hand-drawn rectangles, circles and curves blocked nothing. Now **any** shape the fog tool draws does.
Windows: see through, can't walk through | A window is see-through **whether it is open or shut** — the toggle says whether a creature can *pass*, not whether you can see. Cyan when glazed, aqua when swung open.
Secret doors are invisible to players | A secret door builds **no indicator at all** on a player's client and cannot be worked from one. The GM sees a dashed purple marker.
Players can work the doors themselves | Players get an "open/close" toolbar tool — one click and the door opens, no need to ask the GM every time. Indicators render **below** the fog, so undiscovered doors don't leak the floor plan. Switch it off in settings if you'd rather not.
Lights stop leaking through walls | You no longer see someone else's torch unless a straight line from one of your own lights reaches it **without crossing a wall**. Fixed lighting — wall sconces, daylight — stays visible for everyone if you set its Type to **Ambient**.

## 🔧 Fixed This Round [issues] [en]

bug | high | **Toggling a door flashed the unexplored room behind it.** Closing a door deleted one wall piece a full frame before the other was widened back, and vision poured through the gap.
bug | high | **Maps saved from the fog editor in "independent" mode were sealed permanently.** The editor built a second, untracked set of walls that kept blocking after a door opened.
bug | medium | **The negative half of the wall-expand slider never did anything**, and disagreed with the editor's own preview.
bug | medium | **Old world packs (.fobr) imported with broken images.** They stored a retired image host; the importer now rewrites those addresses on the way in.
bug | low | **The settings panel ignored a mid-session GM promotion.** It now refreshes on role change instead of needing a reopen.
done | | **Wall derivation on traced maps is about 12x faster**, door toggles no longer stutter, and startup got lighter.

## ⚠️ Please turn off the official Dynamic Fog extension [warn] [en]

This suite **already contains everything** the official Dynamic Fog does — walls, doors, lights — and adds windows, player-operable doors and secret doors. Running both is not an error, but every wall and every light gets built twice for nothing. Doors you already drew with the official extension are **imported automatically**, so turning it off won't lose them; **lights need adding again**.

## 版本 [changelog]

- 1.2.1 · 公告改为每日首次开启自动弹出；设置文案更新
- 1.2.0 · 动态迷雾（门 / 窗 / 密门 / 光源遮挡）上线，玩家可自行开关门窗
- 1.1.11 · 图鉴旧图片地址一键修复；世界包导入迁移旧地址

## 落款 [footer]

— 弗人 / FullPeople
