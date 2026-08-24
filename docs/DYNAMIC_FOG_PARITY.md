# Dynamic Fog 对等改造 (dynfog) — 设计与实施记录

> 分支 `feat/dynamic-fog-parity`，基线快照 `snapshot/pre-dynfog-port-20260825`
> (commit `8811a60`)，文件级备份 `../_backup_20260825_pre_dynfog/`。
> 上游参考实现：`../dfref`（= `github.com/owlbear-rodeo/dynamic-fog` @ `55e22b7`）。

---

## 1. 为什么要重做

原来的 `src/modules/fullFog/` 里有三套互不相干的东西：

| 子系统 | 原实现 | 问题 |
| --- | --- | --- |
| 墙 | `index.ts::syncLocalWalls()` — 只认 fullFog 编辑器保存的那一个 outline `Path`（靠 `FOG_PATH_KEY` 元数据识别） | OBR **原生迷雾工具**画出来的 FOG 图层形状（Shape / Curve / Line / Path）完全不产生墙 |
| 门 / 窗 | `door/` — 开口用 `{polyIndex, t1, t2}` 存在 outline Path 上 | 同上：只能画在 outline Path 上，普通墙上画不了门窗；没有直线（Line）工具 |
| 光源 | `light/` — 自己一套 `LightConfig`，只有 `attenuationRadius / sourceRadius / falloff` | 缺 `innerAngle / outerAngle / lightType / rotation`，没有 SelfLight、没有 PRIMARY/SECONDARY，设置面板也是另一套 |

用户诉求：

1. 完整复刻 dynamic-fog 的功能；
2. 在此之上增加**窗户**；
3. **玩家可见门窗开关并能自行开关**。

## 2. 总体架构

新增 `src/modules/fullFog/dynfog/`，把上游的 **Reconciler / Reactor / Actor / Patcher**
单向数据绑定框架完整搬过来，但**几何内核用纯 TypeScript 重写**（见 §3）。

```
dynfog/
  ids.ts                       元数据 / 工具 id / 配色常量
  meta.ts                      getMetadata 泛型读取器
  runtime.ts                   同步缓存的场景事实（dpi / 角色 / 两个开关）
  geom/
    xform.ts                   item ↔ world 变换（基于 MathM）
    cardinal.ts                Cardinal 样条 → PathCommand[]
    drawing.ts                 Drawing 类型 + drawingToPolylines()
    polyline.ts                弧长寻址 / 取子段 / 按 t 区间切分
    cut.ts                     跨图形开口的世界空间胶囊裁剪
    wallGeometry.ts            纯函数版墙推导（可脱离 OBR 测试）
  reconcile/
    Patcher.ts  Reactor.ts  Actor.ts  Reconciler.ts
    actors/    OpeningActor  WallActor  LightActor  SelfLightActor
               OpeningOverlayActor  LightOverlayActor
    reactors/  对应六个
  opening/
    types.ts                   Opening（door | window）
    read.ts                    读取 + 上游 Door[] 兼容转换
    mutate.ts                  增 / 删 / 开关（顺带迁移上游元数据）
  tools/
    createLineMode.ts          直线墙工具（上游 Line mode）
    createOpeningMode.ts       门 / 窗工具（上游 Door mode 的超集）
    createToggleTool.ts        玩家用「开关门窗」工具
    toggleChannel.ts           玩家 → GM 的开关广播
    snap.ts                    「离指针最近的墙」查找
  light/
    config.ts                  LightConfig（与上游字段一一对应）
    createLightMenu.ts         添加光源 / 光源设置
    edit-page.ts               光源设置面板（fullfog-light-edit.html）
  overlay.ts                   指示层的显隐生命周期
  selftest.ts / visual.ts      27 项几何自测 + SVG 证明图
  index.ts                     setup / teardown
```

原 `fullFog/door/`、`fullFog/light/`、`fullFog/index.ts::syncLocalWalls()`
全部删除，由 dynfog 接管。**fullFog 编辑器（图像自动描边）保留不动**——它产出的
outline Path 本身就是一个 FOG 图层的 Drawing，会被新的 `WallReactor` 直接接管。

## 3. 关键取舍：不引入 CanvasKit

上游用 `canvaskit-wasm`（Skia）做四件事：

1. `Path.stroke()` — 把绘制图形描边后取轮廓，作为墙；
2. `ContourMeasureIter` — 按弧长寻址（门的起止点）；
3. `PathOp.Difference` — 从墙里挖掉开着的门；
4. 曲线采样。

`canvaskit.wasm` 有 **6.8 MB**（full 版 7.6 MB）。obr-suite 的 background iframe
是**每个客户端**都要加载的，当前全部 JS 加起来才 ~400 KB。为一个子模块给所有玩家
加 6.8 MB 的 WASM，代价过高。**本次改造 `package.json` 没有新增任何依赖。**

| Skia 能力 | 本实现 |
| --- | --- |
| 曲线采样 | `geom/drawing.ts` 逐 command 采样（QUAD / CONIC / CUBIC 解析式）；Curve 走 `geom/cardinal.ts` 转成同样的 command 再采样 |
| 弧长寻址 | `geom/polyline.ts` 的归一化弧长参数 `t ∈ [0,1]`（`polyIndex` + `t`） |
| 布尔差集挖门（同一图形） | `geom/polyline.ts::splitPolylineByRanges()` — 在 t 域上精确切分 |
| 布尔差集挖门（跨图形） | `geom/cut.ts` — 开口在世界空间贡献一条「胶囊链」，别的图形按距离裁掉重叠段 |
| `stroke()` 取轮廓 | **不做**：墙直接取图形的中心线轮廓 |

### 3.1 刻意的行为差异：中心线 vs 描边轮廓

上游把 FOG 图形 `stroke(strokeWidth)` 后取**轮廓线**当墙，所以一条 20px 粗的
线会变成两条相距 20px 的平行墙。本实现直接用图形自身的**中心线**当墙，一条线
就是一条墙。

- 对遮挡视线的效果**没有可观察差异**（两条紧贴的墙 ≡ 一条墙）；
- 墙数量减半，自动描边的复杂地图上是显著的性能收益；
- 门的挖除逻辑同样简化（不需要一次挖穿两条平行墙）。

### 3.2 为什么还需要「跨图形裁剪」

OBR 的迷雾工具鼓励**画重叠的形状**（两个矩形拼出 L 形走廊）。上游把每一扇门从
**每一面墙**里减掉（Skia 在世界空间做差集），所以画在其中一个矩形上的门也会打穿
它背后那个矩形。少了这一步，共享墙上的门看起来开了、视线却仍然被第二个形状挡住
—— 正是「门窗没用」的典型症状。`geom/cut.ts` 用胶囊距离测试复现了这个行为，
精度是 `radius / 2`（若干像素，玩家不可能察觉）。

其余所有行为（哪些 item 变墙、门的开合语义、光源参数与表现、指示器颜色 / 图标、
工具的拖拽手感、快捷键）都与上游一致。

## 4. 数据模型

### 4.1 开口（门 / 窗）

存在**被画的那个 FOG Drawing** 的 metadata 上，key = `${PLUGIN_ID}/openings`：

```ts
interface Opening {
  id: string;                 // 稳定 id（玩家点击时用它定位，而不是数组下标）
  kind: "door" | "window";
  open: boolean;              // true = 通视（墙被挖开）
  polyIndex: number;          // drawingToPolylines() 结果里的第几条折线
  t1: number;                 // 归一化弧长 [0,1]
  t2: number;
}
```

- **门**：默认 `open: false`（关着 = 挡视线），红色；开启后绿色。
- **窗**：默认 `open: true`（透光 = 不挡视线），青色；关闭（拉上百叶）后灰蓝并挡视线。

墙的推导规则对两者统一：`open === true` ⇒ 该段从墙里挖掉。

> OBR 的 `Wall` 只影响**视线**，不影响**移动**，所以「能看不能走」在 OBR 里
> 无法表达。这里把窗定义为「默认常开、可关闭、视觉上与门区分」的开口。

**上游兼容**：`opening/read.ts` 同时接受上游 `rodeo.owlbear.dynamic-fog/doors`
形状（`{open, start:{index,distance}, end:{...}}`），按折线长度换算成 `t`。
第一次写入时 `opening/mutate.ts` 会把上游 key 删掉，完成迁移；两种数据同时存在
时以我们自己的为准。

### 4.2 光源

与上游 `LightConfig` 字段完全一致：
`attenuationRadius / sourceRadius / falloff / innerAngle / outerAngle / lightType / rotation`。
`LightActor` 建原生 `Light`，`SelfLightActor` 给「有角度的 PRIMARY 光源」补一个
半径 75 的自照明（否则持灯人自己站在锥形光的暗区里）。

### 4.3 墙体外扩（套件自有功能，非上游）

迷雾编辑器把 `wallExpandPx` 写在 outline Path 上，让**可见轮廓**留在原地、
**挡视线的墙**向内或向外偏移。两个坑本次一并修掉：

- 保存时曾经写成 `Math.max(0, …)`，滑块的负半区（墙嵌进墙体材质里）静默失效，
  编辑器里的洋红色墙体预览和实际保存结果对不上。现在按有符号值保存。
- 该值的单位是**图片像素**，换算成 Path 命令所在的 map-local 单位需要地图图片的
  `grid.dpi`。「独立保存」模式下 Path 没有 `attachedTo`，根本找不到那张地图。
  现在保存时额外写一份换算好的 `${PLUGIN_ID}/wallExpandLocal`；老场景仍走旧路径。

## 5. 玩家开关门窗

OBR 里 FOG 图层的 item 玩家**读得到**（客户端要自己渲染迷雾，上游的墙推导也依赖
这一点），但**写不了**。所以：

```
玩家点击门指示器
  → OBR.broadcast.sendMessage(BC_TOGGLE_OPENING,
       { itemId, openingId, open: !当前状态 }, { destination: "REMOTE" })
  → GM 的 background 收到 → 校验 fogPlayerDoors → updateItems 写 open
  → 全客户端 items.onChange → Reconciler → 墙重算 + 指示器换色
```

广播里带的是**目标状态**而不是「翻转」：一个房间可能有多个 GM，每个 GM 都会收到
这条广播，翻转会被执行两次而互相抵消。

玩家侧的点击入口是工具栏上的独立工具 **「开关门窗」**（`OBR.tool.create`，快捷键
K）。之所以不用「点选指示器即切换」：本地 item 必须可选中才能触发选中事件，而可
选中的指示器就能被玩家拖走。工具事件可以命中 `locked` 的 item，所以指示器保持
锁定、不可拖动。

指示器图层：

- GM → `CONTROL`（在 FOG 之上，自己的迷雾也挡不住）
- 玩家 → `DRAWING`（在 FOG 之下，未探索区域的门不会透过迷雾泄露地图结构）

## 6. 设置项（新增）

| 位置 | key | 默认 | 说明 |
| --- | --- | --- | --- |
| 套件场景状态 | `fogPlayerDoors` | `true` | 玩家可见门窗指示器并可自行开关 |
| 套件场景状态 | `fogDoorOverlayAlways` | `false` | GM 不选迷雾工具时也常显门窗指示器 |
| **OBR 场景本身** | `scene.fog.filled` | — | 设置面板里新加的「整张地图铺满迷雾」直通开关。**没打开它，墙和光源不会有任何可见效果** |

## 7. 验证

```bash
node tools/dynfog-selftest.mjs      # 27 项几何自测
node tools/dynfog-visual.mjs docs/dynfog-walls.svg   # 生成证明图
npx tsc --noEmit                    # 全量类型检查
```

自测用 rolldown（vite 自带）把纯几何打包到 node 里跑，不需要联网、不需要浏览器，
也不需要额外依赖。证明图 `docs/dynfog-walls.svg` 里画的墙**就是** `WallActor`
会生成的那些线段 —— 图上门没开，游戏里就没开。

覆盖范围：轮廓推导（矩形 / 圆 / 三角 / 六边 / Path / Line / Curve）、弧长寻址、
开口切分与合并、跨图形裁剪、墙体外扩后的顶点对应与门位置重映射、上游元数据转换。
