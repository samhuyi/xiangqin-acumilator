# 《相亲模拟器》微信小游戏

一款以中国相亲现实为背景的**文字 Roguelike**。玩家设定出身与人生目标，以「天」为单位推进，在存款、好感度、健康、事业、颜值、家境、情绪七项指标之间取舍，走完一条完整的相亲之路。


## 核心特性
<img width="660" height="1434" alt="487ad75ef574944e101262b82d0de1da" src="https://github.com/user-attachments/assets/dd712982-afc6-4721-abc8-0d3c4c30e605" />
<img width="660" height="1434" alt="66dd30449127041e9229a39a26c038bf" src="https://github.com/user-attachments/assets/f41d0784-1e93-4cd4-9dce-8530472c076d" />
<img width="660" height="1434" alt="a6b5c1f0c91602a55209023a481b2129" src="https://github.com/user-attachments/assets/55944a49-8fab-4c12-8903-41ebfff4db80" />
<img width="660" height="1434" alt="2a44d02638b03bf343237c245ad65025" src="https://github.com/user-attachments/assets/2b5299ea-27bf-4125-ba3c-15d24e6d0ff2" />
<img width="660" height="1434" alt="0d19e835d4954b5432fd7fc543c398c3" src="https://github.com/user-attachments/assets/c9590678-6bcd-4ebd-86e0-79e4c55090e9" />
<img width="660" height="1434" alt="ea300eb20fc3dddc5bae2c8f0e7bdcb2" src="https://github.com/user-attachments/assets/82e51fdf-0643-4d29-ba04-d32105f5a657" />



## 目录结构

```
├── game.js                     # 小游戏入口（创建画布 + 启动）
├── game.json                   # 运行时配置（竖屏等）
├── project.config.json         # 项目配置（AppID / 打包忽略项）
├── assets/
│   └── images/
│       ├── manifest.js         # 美术资源注册表（自动生成，勿手改：main / lazy / packs）
│       ├── role-map.js         # 数据 → 图片 映射（职业头像 / 场景对应）
│       ├── intro_bg.jpg        # 标题页 / 进入游戏背景
│       ├── seek_bg_m.jpg       # 【按需 lazy】「寻找相亲机会」页头（按主角性别）
│       ├── seek_bg_f.jpg
│       ├── upgrade_bg_m.jpg    # 【按需 lazy】「其余安排」页头（按主角性别）
│       ├── upgrade_bg_f.jpg
│       ├── end/                # 【按需 lazy】结局页页头，end_<结局类型>_<性别>.jpg
│       ├── role/               # 【分包 art_role】职业头像（ASCII，如 programmer-m.png）
│       │   └── game.js         #   分包空入口（必须存在）
│       └── scene/              # 【分包 art_scene】场景背景（ASCII，如 bg-cafe.jpg）
│           └── game.js         #   分包空入口（必须存在）
├── js/
│   ├── main.js                 # 启动编排：先载数据，再进开场
│   ├── db/                     # ★ 数据访问层（唯一数据出口）
│   │   ├── schema.js           #   集合定义 + 归一化规则
│   │   ├── repository.js       #   仓储：云数据库加载 + 完整性校验
│   │   └── provider-cloud.js   #   微信云开发数据库（唯一数据源）
│   ├── core/
│   │   ├── rules.js            #   规则求值器（目标/性格条件数据驱动）
│   │   └── engine.js           # ★ 纯逻辑引擎（零游戏数据）
│   └── ui/
│       ├── canvas-kit.js       #   绘制工具（配色/圆角/换行）
│       ├── art.js              #   美术资源加载（分包按需下载 + 图片索引）
│       ├── gallery.js          #   相亲图鉴收集进度（本地存档 xq_gallery_v1，跨局累计）
│       └── render.js           #   场景渲染 + 触摸交互 + 存档
├── db/
│   ├── seed/*.js               # 数据模板（由 gen-seed.js 生成，供 import.js 转成云导入文件）
│   ├── export/*.json           # 各集合 JSON（供导入数据库）
│   ├── export/import/*.json    # 云开发导入文件（JSON Lines + 含 _id）
│   └── import.js               # 生成导入文件 + 导入指引
├── tools/
│   ├── gen-seed.js             # 从参考源码抽取数据 → 种子
│   ├── compress-assets.py      # 美术资源压缩（Pillow）
│   ├── gen-art-manifest.js     # 扫描图片 → 生成 manifest.js
│   ├── helpers/                # 测试共用 mock（wx / Canvas）
│   └── *-smoke.js              # 引擎 / UI / 云数据 / 点击 / 偶遇 / 美术资源 测试
└── _template_demo/             # 原「飞机大战」模板备份（已排除打包）
```

## 快速开始

1. 用微信开发者工具「小游戏」项目打开本目录（需正式 AppID）。
2. 接入数据库：见下方「数据库接入」（⚠️ 云开发需正式 AppID，测试号/游客号不支持）。
3. 编译运行后，若控制台显示 `数据源：network` 即表示已读到云数据；若显示错误页，按页面列出的问题清单到云控制台排查。

## 数据库接入

游戏数据由 15 个集合组成：`events / backgrounds / goals / difficulties / channels / date_types / court_styles / style_events / chats / partners / personalities / endings / constants / materials / texts`（共 564 条文档）。

**方式一：微信云开发（唯一数据源）** —— 完整分步见 [`docs/云开发接入.md`](docs/云开发接入.md)

```bash
node db/import.js          # 生成 db/export/import/*.json
```

要点：云控制台建 15 个同名集合 → 逐个导入 `.json`（JSON Lines，首次导入选 Insert）→ **集合权限设为「所有用户可读」** → 在 `game.js` 填入环境 ID：

```js
var CLOUD_ENV_ID = '你的云环境ID';   // 留空 '' 则用默认环境
```

**数据更新**：修改数据后重跑 `node db/import.js` 生成新文件，云控制台重新导入时冲突处理改选 **Upsert / 覆盖**——用 Insert 会跳过已存在的 `_id`，改了也不生效。

## 验证

```bash
node tools/smoke.js            # 三档难度各 300 局模拟，验证数据完整与引擎正确
node tools/ui-smoke.js         # 渲染与交互回归（mock wx + Canvas）
node tools/cloud-smoke.js      # 云数据源链路（含空数据/残缺数据报错）
node tools/click-smoke.js      # 全程真实按钮点击：选中 → 点确认，验证不卡死
node tools/encounter-smoke.js  # 「其余安排」偶遇链路（含卡片渲染）
node tools/art-smoke.js        # 美术资源：文件存在性 / ASCII 命名 / 加载 / 数据映射 / 真实绘制
node tools/edge-smoke.js       # 边界与全链路：分手三档 / 结局优先级 / 长跑收敛 / 分手机制
```

## 美术资源与分包

职业头像放 `assets/images/role/`，命名 `职业-性别.png`（性别用 `m` / `f`），如 `programmer-m.png`；场景背景放 `assets/images/scene/`，命名 `bg-场景名.jpg`，如 `bg-cafe.jpg`。

二级页头部背景图分两处，命名里都带性别后缀：

| 用途 | 路径 | 说明 |
| --- | --- | --- |
| 「寻找相亲机会」页头 | `assets/images/seek_bg_<性别>.jpg` | 按**主角**性别取图 |
| 「其余安排」页头 | `assets/images/upgrade_bg_<性别>.jpg` | 按**主角**性别取图 |
| 结局页页头 | `assets/images/end/end_<结局类型>_<性别>.jpg` | `结局类型` 取 `happymarry` / `badmarry` / `alone` |

> 结局用哪张图**不是代码里写死的**：每个结局记录带一个 `art` 字段（见 `endings` 集合），渲染层只负责拼 `end_<art>_<性别>`。想给某个结局换画面，改数据即可。

> ⚠️ **图片文件名必须是 ASCII**（英文 / 数字 / `-` `_`），不要用中文。
> 中文文件名在打包与真机取图时可能因编码不一致而加载失败，表现为「图片全都不显示」。
> `tools/gen-art-manifest.js` 会直接拦下中文文件名并报错退出。

两张映射表把游戏数据接到图上：

- `assets/images/role-map.js`：`background`（出身背景 → 职业 key）、`job`（对象职业 → 职业 key）、`eventScene` / `dateTypeScene` / `sceneKeys` / `meetScene`（事件 → 场景 key）。
- `assets/images/manifest.js`：由脚本自动生成，记录 `main`（启动即下）/ `lazy`（按需下）/ `packs`（分包）三组资源，**不要手改**。

图片改动后的完整流程（两步都是幂等的，可以反复跑）：

```bash
python tools/compress-assets.py    # 压缩：头像 360px PNG、场景/主包/结局图 750px JPEG
node tools/gen-art-manifest.js     # 重新生成 manifest.js（含中文文件名检查）
```

> `compress-assets.py` 会把 PNG 转成 JPG（体积约为原来的 1/5），所以**渲染层不要手拼 `.png` 后缀**，一律通过 `art.js` 取图（`art.pageBg` / `art.endBg` / `art.roleImg` / `art.sceneImg` 等），路径由 manifest 决定。

### 加载机制

图片分三档优先级。`art_role` / `art_scene` 是 `game.json` 声明的两个分包，分包根目录必须各有一个 `game.js` 空入口。启动时 `js/ui/art.js` 会：

1. **显式加载主包图**（`intro_bg`）——它不在任何分包里，必须单独加载；
2. 对每个分包**先调 `wx.loadSubpackage`，等回调到了才排这个分包的图**；
3. 分包就绪（或下载失败）后整体「解冻」一次：清掉失败标记与重试计数再重新排队；
4. 单张图失败最多重试 2 次；每张图就绪都会触发重绘，所以图片是「陆续出现」的，不会一直空着；
5. 上面全部排完之后，再后台补下 `lazy` 那批（行动页 / 结局页的头部背景，共 10 张约 660KB）——**它们不跟关键图抢带宽**，图没到位时页头先画纯色，图到了自动补上。

**事件与场景一一对应**（四级匹配，前面的优先）：事件若在 `role-map.js` 的 `eventScene` 里显式指定场景（值写 `null` 可强制不展示背景）以它为准；否则按约会档位（`dateTypeScene`）取默认场景；再否则按事件文案 + 选项 + 初遇旁白关键词兜底匹配（`sceneKeys`）；最后，若本次是「赴约初遇」（`action=meet`，它没有档位概念），落到默认的 `meetScene`。四级都匹配不到才不展示背景（兜底为纯色头部）。

## 行动流程（两级菜单）

主界面的「操作页」只有**两个方向入口**，单击即进（导航按钮不做二次确认）：

```
操作页（phase='choose'）
├─ 寻找相亲机会 → 二级页 phase='seek'，页头背景 seek_bg_<性别>
│    · 还没相到人      → 选渠道（托人介绍 / 婚恋 App / 红娘 …）
│    · 相到了没见面    → 赴约初遇 · 见 TA ／ 微信闲聊
│    · 接触中 / 恋爱中 → 约会 ／ 告白（恋爱后是求婚）／ 微信闲聊 ／ 分手
│    · 婚后            → 约会 ／ 微信闲聊 ／ 准备要个孩子
└─ 其余安排     → 二级页 phase='upgrade'，页头背景 upgrade_bg_<性别>
     · 过日子 ／ 提升自己 ／ 加班挣钱 ／ 休息一天
```

两个二级页都是「聚焦页」：**只画页头背景图 + 这一类的操作 + 底部「返回 / 确认」**，不再重复铺状态条、长期目标与近期经历（这些留在操作页）。页面标题与副标题分别取 `texts.play` 的 `seekPageTitle` / `seekPageSub` 与 `upgradePageTitle` / `upgradePageSub`；已经有对象时「寻找相亲机会」的标题换成 `seekPageTitlePartner`（`和{name}的事`）配 `seekPageSubPartner`。

二级页里的具体安排仍然是**列表项：点一次选中、再点一次取消、点底部「确认」才提交**。返回键（`backToChoose`）回到操作页。

## 二级页一览

各个二级页都从**主界面 / 标题页**进入，返回键回到主界面（`PREV_SCENE` 记来源场景）。所有文案都在 `texts` 集合里，渲染层不硬编码。

**对方资料（`scene='partner'`，点右上角头像）** —— 有对象 / 有待见面对象时展示 TA 的完整设定：年龄、职业（含职业说明）、性格、人格、家庭、外形、爱好、认识方式、颜值、家境；已经确定关系时额外显示当前好感度，还是「待见面」状态时给出「可以去赴约初遇」的提示。还没有对象时点头像（画面上是「?」）也能进，页面给一句引导文案，而不是无处可点。文案在 `texts.profile`。

**近期变化（`scene='stats'`，点左上角主角头像）** —— 依次展示：

1. **当前状态**：七项属性一次摆齐（好感度在这里仍然保留，方便总览）；
2. **本次结算**：刚结束那一天的全部涨跌（还没结算过则不显示）；
3. **按天回看**：最近若干天的每日涨跌，最新在前。每天先给**关键事件**标题，再逐项列「{属性}：从 {旧值} 变为 {新值}」，附带动标签；
4. **近期合计**：这段时间的净变化。

每日涨跌在结算时写入 `S.history`（只记非零项，避免噪音；同时记录结算前后的快照与关键事件标题），长度由常量 `STAT_HISTORY_MAX` 限制。文案在 `texts.statlog`。

**近期经历（`scene='recent'`，点日志块）** —— 按天回看最近若干次行动，每条卡片分三段：**事件**（标题 + 摘要）、**你的选择**（所选选项名）、**结果**（结算文案），左侧一条按结果类型着色的竖条。记录来自 `S.acts`，长度由常量 `ACTLOG_MAX` 限制。文案在 `texts.recent`。

**微信闲聊（`scene='chat'`，「寻找相亲机会」二级页里的「微信闲聊」按钮）** —— **只要聊天框里有人就出现**：已相到人、还没赴约（`lead`，题目是「还没见过面」的口吻），或暧昧 / 恋爱 / 婚后。进页后对方先发几条消息（`texts.chat` 提供页头文案，开场白来自 `chats` 集合），底部一排候选回答；选中一条再点「发送」提交，随后对方回一条。**不同回答只影响好感度与情绪**，其余指标不动；结算后点「结束闲聊 · 进入下一天」推进时间（`ACTION_DAYS.chat`）。文案在 `texts.chat`。

> **入口不会因为数据缺失而消失**：以前题库为空时入口会被整块藏掉，玩家看起来就像「功能没了」。现在只要微信里有人就给入口；万一 `chats` 里真的没有这个阶段的题目（通常是云端数据没重导），点进去是一页 `emptyLine` / `emptyHint` 的说明 + 「返回」，同时控制台会打一条明确的告警，指名要重新导入 `db/export/import/chats.json`。

三种进入方式与两种特殊剧情：

- **手动进入**：点主界面「微信闲聊」，选一条答完即走，可以中途「返回」。
- **对方主动发来**：已经在一起（有对象）时每天开头判定一次（`PARTNER_CHAT_RATE`，默认 30%）；还没见面的 `lead` 阶段不触发。命中后聊天页顶部标出「对方主动发来了消息」，**没有「返回」**；聊完这一天就算过完，直接进下一天——即**跳过当天的行动选择**。
- **必须出门约会**：主动聊天**累计超过 `PARTNER_CHAT_MUST_DATE_AFTER`（默认 2）次**后，下一段聊天不再随机抽题，而是固定的 `CHAT_MUST_DATE_ID`（默认 `c_mustdate`）剧情。聊完进入 `S.mustDate` 状态：**微信入口还在，但点进去只显示一句「我们还是多当面接触吧」**，也不再有主动聊天——必须先安排一次约会（`goDate`）才能解锁，约会完成同时把主动计数清零。
- **灵魂拷问（`kind: 'grill'`）**：按对象人格（`personalityId`）投放，标题区标出「灵魂拷问」。选项里有一条 `correct`，踩雷的选项一次掉 20 点以上好感，答完会给出「这话说得不太妙 / 答到点子上了」的判定。
- **暧昧事件（`kind: 'flirt'`）**：同样按人格投放，标题区标出「暧昧时刻」。答对一次涨 15 点以上好感，是升温最快的一条路；答不对也不至于翻脸，但机会就浪费了。

**相亲图鉴（`scene='gallery'`，主界面底部「相亲图鉴」/ 标题页入口）** —— 分「女生 / 男生」两栏（默认展示异性），一行三张卡片：

- **已解锁**：圆形头像 + 姓名 + 达成进展（`已遇见 / 初次见面 / 接触中 / 恋爱中 / 已结婚`）+ 好感度峰值；点卡片进 `scene='galleryDetail'` 看完整资料（年龄 / 职业 / 性格 / 人格 / 家庭 / 外形 / 爱好 / 认识方式 / 颜值 / 家境 + 首次遇见天数 / 最近见面天数 / 是否已有孩子）。
- **未解锁**：黑框 + `？` + `？？？` + 「未解锁」。

卡片上的**资料来自云端 `partners`**，解锁与进展来自**本地存档 `xq_gallery_v1`**（跨局累计，每次存档自动同步）。文案在 `texts.gallery`，阶段顺序在 `constants.GALLERY_ORDER`。详见 [`docs/数据库设计.md`](docs/数据库设计.md) 第 5 节。

| `art` | 画面 | 命中的结局 |
| --- | --- | --- |
| `happymarry` | 修成正果 | `marry`（尘埃落定）、`true_love`（满分答案） |
| `badmarry` | 被逼婚 / 婚姻不幸 | `forced`（在父母的催促下匆忙相亲结婚）、`married_stall`（婚姻里的将就） |
| `alone` | 一个人 | 其余 10 个（独自富有 / 山顶的风 / 落地生根 / 自由人生 / 破产 / 身体亮红灯 / 事业崩塌 / 撑不住了 / 停在原地 / 时间到了） |

## 相亲机会结果页（信封卡片）

相亲成功后，结果页在正文之下依次画：

1. **花销框**：本次相亲的花费（免费档不显示）；
2. **信封卡**：一张带信封翻盖的卡片，左上角是对象头像，右侧五行信息——**姓名 / 职业 / 性格 / 家庭 / 条件**，每行各自一个浅色背景框（`envelopeRow`）。

对象的姓名与各项信息**来自数据库的 `partners` 花名册**（姓名 / 年龄 / 职业 / 性格 / 家庭 / 条件 / 颜值 / 家境 / 眼缘），**头像来自 `partners[].avatar`**（`assets/images/role/<avatar>-<性别>.png`），回退到职业头像表 `materials.jobs[].avatar`。卡片各行标签文案在 `texts.envelope`。

## 微信闲聊数据（`chats` 集合）

闲聊场景完全数据驱动，默认 36 条，按 `kind` 分成四类：

| `kind` | 条数 | 说明 |
| --- | --- | --- |
| `normal` | 23 | 日常闲聊（`c_*` 八条基础 + 见面前的 `l_*` 四条 + 父母催婚 `c_parents_*` + 个人慢热 `c_slow_*` + 现实因素 `c_real_*`） |
| `grill` | 6 | **灵魂拷问**：按人格投放，踩雷大幅掉好感 |
| `flirt` | 6 | **暧昧事件**：按人格投放，答对大幅涨好感 |
| `mustdate` | 1 | 「必须出门约会」的固定剧情（`c_mustdate`），不进随机池，由常量点名调用 |

每条结构：

```json
{ "_id": "g_money", "kind": "grill", "personalityId": "money",
  "phases": ["talking","dating","married"], "minAffection": 10, "weight": 6,
  "opener": ["问你个正事", "要是结婚了，首付你家能出多少？"],
  "options": [
    { "label": "首付我来想办法，不用你操心", "reply": "……这话我爱听。", "affection": 11, "mood": 3, "correct": true },
    { "label": "你家不也有吗", "reply": "哦。我知道了。", "affection": -27, "mood": -8 } ] }
```

抽题规则在 `engine.pickChat(s)`，按顺序过滤：

1. 当前**聊天阶段**必须出现在 `phases` 里 —— 阶段由 `engine.chatStage(s)` 给出：有对象时就是关系阶段（`talking` / `dating` / `married`），**只有 `lead`（已相到人、还没赴约）时算作 `lead`**。所以「见面前」的题目靠 `phases: ["lead"]` 单独投放，不会串到别的阶段；
2. 好感度不低于 `max(minAffection, CHAT_MIN_AFFECTION)`；
3. **`personalityId` 不为空时必须与对象人格一致**（灵魂拷问 / 暧昧事件就靠这一条做到「按性格出题」）；
4. 固定剧情（`CHAT_MUST_DATE_ID`）**不进随机池** —— 只有主动聊天攒够次数时才由 `pickChat` 直接点名返回；
5. 剩下的按 `weight` 加权随机。

`applyChat(s, opt)` 与事件选项走**同一套结算口径**：都过 `applyFx`（规则见 [事件与聊天的结算规则](#事件与聊天的结算规则)），返回 `{delta, reply}`；好感度夹在 `0 ~ engine.affectionCap(s)`（单身 / 接触中 100，恋爱后 500）。选项上的 `correct` 只用于展示「答对 / 答错」与数据校验，**不参与结算**（增减仍由 `fx` 决定，不走两套逻辑）。

| 想改什么 | 改哪个集合 | 备注 |
| --- | --- | --- |
| 闲聊场景 / 开场白 / 候选回答 / 效果 | `chats` | `fx` 为各属性增量；`kind` 决定归类，`personalityId` 决定投放对象 |
| 新增一条灵魂拷问 / 暧昧事件 | `chats` | 记得给 6 种人格各配一条（`smoke.js` 会校验人格覆盖率，缺了直接报错） |
| 闲聊是否出现 / 耗时 / 主动概率 | `constants` | `CHAT_MIN_AFFECTION`、`CHAT_DAYS`、`ACTION_DAYS.chat`、`PARTNER_CHAT_RATE` |
| 见面前也能聊 / 印象分折算 | `chats` + `constants` | 对话标 `phases: ["lead"]`；上限与阶段标签用 `CHAT_LEAD_PHASE` / `LEAD_CHAT_AFF_MAX` |
| 「必须出门约会」的阈值与剧情 | `constants` + `chats` | `CHAT_MUST_DATE_AFTER` 调阈值（`S.chatCount` 统一计数）；**所有 `kind: "mustdate"` 的条目都进固定剧情池**，按 `weight` 抽一条 |
| 闲聊页文案 | `texts` | `chat` 文档（标题 / 返回 / 发送 / 我 / 空态 / 涨跌 / 回复） |

## 接触阶段分级（暧昧 vs 婚嫁）

同一份内容在不同关系阶段该不该出现，靠**接触阶段**判断。顺序由 `constants.RELATION_ORDER` 给出（`single < meeting < talking < dating < married`），逻辑层只做比较、不写死阶段名。

**事件（`events.stage`，可选）** —— 声明「最低接触阶段」。不写 = 不限阶段，按 `phase` 走原来的关系匹配；写了就必须走到该阶段才可能抽到：

- 约会事件里 `dt_question_kid`（要不要孩子）、`dt_question_live`（婚后和父母同住）标 `stage = "dating"`，**接触中不会抽到，告白成功后才出现**。
- 抽取在 `engine.stageOk(s, ev)` 里统一判断，`pickEvent` / `goDate` / `pickMeetingEvent` 都会过滤。

**聊天（`chats.phases`）** —— 显式列出允许出现的阶段。见家长这种明确的婚嫁信号只给 `["dating","married"]`，接触中不出现；日常问候 / 吃饭 / 周末这类暧昧向内容才含 `"talking"`。**`"lead"` 是「已相到人、还没赴约」专用的一档**（`CHAT_LEAD_PHASE`），只有 `phases` 里写了 `"lead"` 的对话才会在见面前被抽到。

新增婚嫁向内容时：事件加 `stage`（写进 `tools/gen-seed.js` 的 `EVENT_STAGE` 表），聊天把 `phases` 里的 `"talking"` 去掉。两边都不用改逻辑层。

## 其余安排的偶遇

生活 / 提升 / 休息 / 加班这四项「其余安排」也有小概率顺带认识一个可接触对象。命中条件是**单身且当前没有待接触对象**，命中后会把人写进 `lead`，可在「赴约初遇」约出来；结算页会画出偶遇卡片（头像 + 姓名职业 + 后续提示）。概率与可触发行动全部在数据库配置：

| 常量 | 默认值 | 含义 |
| --- | --- | --- |
| `ENCOUNTER_BASE` | 0.12 | 未单独配置时的兜底概率 |
| `ENCOUNTER_LIFE` | 0.15 | 过日子 |
| `ENCOUNTER_IMPROVE` | 0.10 | 提升自己 |
| `ENCOUNTER_REST` | 0.06 | 休息一天 |
| `ENCOUNTER_OVERTIME` | 0.05 | 加班挣钱 |
| `ENCOUNTER_ACTIONS` | `life,improve,rest,overtime` | 允许偶遇的行动白名单（逗号分隔） |

把某个行动移出 `ENCOUNTER_ACTIONS` 即关闭它的偶遇；把概率设为 0 也会关闭。文案在 `texts` 集合的 `play` 文档里：`encounter_title` / `encounter_intro` / `encounter_tail` 为通用部分，`encounter_life`、`encounter_improve`、`encounter_rest`、`encounter_overtime` 为各行动专属开场白。

## 事件与聊天的结算规则

每个选项（事件选项与聊天回复共用一套）都按**作者写的影响**结算，并且只在「看得见」的幅度上生效。作者只写「意图值」：

```js
{ label: '直接买药过去', fx: { money: -80, affection: 13, mood: 4 }, result: '……' }
```

数值统一由 `tools/rebalance-fx.js` 加工（**它是当前唯一的数值权威**；作者源见 `tools/seed-more-events.js` / `tools/seed-more-chats.js`）：

| 步骤 | 规则 |
| --- | --- |
| ① 放大 | 作者写的主影响 × `FX_AMP`（2.0） |
| ② 过滤 | 存款 `\|v\| < 100 元` 删键（参照：约会 400/1200/3600、求婚 6 万）；其余属性 `\|v\| < 5 点` 删键（参照：一次加班 = 健康 −6 / 事业 +5 / 情绪 −3，健康每天自然才掉 0.22） |
| ③ 限项 | 每个选项**最多保留 3 项**影响，幅度大的优先 |
| ④ 不补 | **不再**随机补齐到固定项数、**不再**强制「有增有减」——与情境无关的数值（「妈打电话 → 颜值 +3」）比数值少更伤代入感 |

### 极端后果用 `fx.zero`，不要写超大负数

```js
{ label: '把存款都交给她打理', fx: { mood: -24, zero: ['money'] }, result: '……' }
```

`zero` 声明「这一项直接归零」。之所以不写成 `money: -470000`：属性有下限截断，写多大结果都一样，还会在结算面板上显示成一个误导性的数字。归零有两条硬约束（`edge-smoke` / `ui-smoke` 都在守）：

- **停在 `FX_ZERO_FLOOR`（保底 1 点）**，不真归 0 —— 存款 / 情绪 / 健康 / 事业任意一项归 0 会**立刻判负**，一条随机事件秒杀玩家等于没有玩法；
- 数值为负时先扣、再把该属性「抬回底线」，避免同一条选项里的加法把保底绕过去。

| 想改什么 | 改哪里 |
| --- | --- |
| 奖惩整体加倍 / 减半 | `rebalance-fx.js` 的 `FX_AMP` |
| 纳入结算的最小幅度 | `MONEY_MIN`（存款）/ `STAT_MIN`（属性） |
| 每个选项最多几项影响 | `MAX_FX` |
| 扩充内容 | `tools/seed-more-events.js` / `tools/seed-more-chats.js`，改完重跑 `node tools/rebalance-fx.js` + `node db/import.js`（作者源改了已有条目时先加 `--refresh` 覆盖种子） |

⚠️ `correct: true` 必须写在**选项层级**，写进 `fx` 对象里会被生成器忽略。灵魂拷问（`grill`）必须「恰有一条 `correct` + 至少两条 `affection ≤ -20` 的踩雷项」，`tools/smoke.js` 会校验。

## 对象主动提分手（阈值与对抗手段）

对方会按自己的**人格**（`personalities`）判断这段关系还值不值得继续。整套机制在 `engine.checkPartnerLeave(s)`，阈值全部落在 `constants`：

| 机制 | 作用 |
| --- | --- |
| **一天只判定一次**（`leaveRollDay`） | 渲染层一天会调三次，不设闸的话单次 5% 会变成每天 ~10%，阈值全部失真 |
| **冷静期**（`PARTNER_LEAVE_GRACE_DAYS=3`） | 刚确认关系的头几天不判定，否则玩家觉得这游戏纯随机 |
| **两段式：先预警，后分手** | 第一次踩线只给预警（浮窗 + 日志 + **主界面关系卡上的常驻红条**），把「哪一项出问题」原文告诉玩家；补回来预警立刻解除。宽容次数 `PARTNER_LEAVE_MAX_WARNINGS=2`，用完之后再踩线直接判定 |
| **踩线深度加权**（`rules.SEVERITY_AMP=0.8`） | 同一条规则，刚好踩线 ×1.00、踩到阈值一半 ×1.4、见底 ×1.8 —— 抹平「34 分永远安全、30 分必死」的断崖 |
| **积怨**（`PARTNER_LEAVE_RAGE_STEP=0.006`） | 预警挂着不处理，风险逐日上升；有上限 |
| **风险上限 + 抖动**（`PARTNER_LEAVE_MAX_RISK=0.1`、`JITTER=0.4`） | 上限先作用在人格风险上、**再乘难度** `riskMod`（简单 0.8 / 普通 1.0 / 困难 1.6），否则三档难度会被上限一起压平 |
| **无预兆的离开**（规则写 `warn: false`） | 「随便玩玩」的说撤就撤：不给预警、不吃积怨，恒定低位（例：状态全满时 0.5%/天，60 天约 25%）。这类规则必须写得非常低，否则玩家没有反制手段。这条规则的 `cond` 还带 `relationship ≠ married` —— 都领证了再说「我没想好要认真」是自相矛盾的 |
| **婚后折扣**（`PARTNER_LEAVE_MARRIED_MOD=0.6`） | 已领证时风险打折：沉没成本与「再找一个」的难度都上来了，同样的处境下不该跟恋爱期一个概率。不然刚办完婚礼、状态刚好掉进危险区，几天内就被离婚 |

体感数据（危险区：好感 20 / 情绪 20 / 存款 1 万 / 健康 20 / 事业 20，全程不补救；20000 次模拟，含 ±1 天浮动）：

| 难度 | 每日风险 | 分手中位 | 分手 10~90 分位 | 活过 30 天 |
| --- | --- | --- | --- | --- |
| 简单 | 6.2% → 8.0% | 14~15 天 | 6~34 天 | 15% |
| 普通 | 7.8% → 10.0% | 12~13 天 | 6~29 天 | 9% |
| 困难 | 12.5% → 16.0% | 9~10 天 | 5~20 天 | 2% |
| 普通 · **已婚** | 4.7% → 6.0% | 16 天 | — | 24% |

安全区（好感 80 / 情绪 70 / 存款 6 万 / 健康 70 / 事业 60）**只有**「随便玩玩」会触发（约 25% / 60 天；**已婚则 0%**），其余五个人格 0% —— 人格是「你踩到他在意的那条线才生效」的，不是无差别 DPS。

改动前是「一天判定 2 次、没有预警、没有冷静期」，危险区**中位 4~7 天直接分手**，玩家完全没有反制窗口。

```bash
node tools/analyze-leave-risk.js   # 风险体检：逐条件风险 / 三档玩家状态模拟 / 每日风险随积怨的涨法 / 三档难度对照 / 改动前后对比 / 婚后对照
```
## 关于平衡

`tools/smoke.js` 的模拟结果与参考项目**源码**行为一致。结束条件已按需求简化为三类：达成目标（胜）、任一核心属性归零（破产 / 病倒 / 失业 / 情绪崩溃）、以及相亲期限到期（仅限需要建立关系的目标；非相亲目标仍以 `maxDays` 为兜底）。已移除原「人生节点考核」（`GOAL_CHECK`，即「进度没到 x% 就停在原地」）与独立的「超期」判定。因此「独身千万 / 自由人生」等大额攒钱目标没有相亲期限压力，可一路攒到属性归零或达成目标。

相亲期限的计数规则（本轮调整）：

| 当前关系 | `singleStreak` | 说明 |
| --- | --- | --- |
| 单身且**手上没有对象**（`single` 且无 `lead`） | `+1` | 唯一真正走表的时段；到点仍未脱单 → 结局「在父母的催促下匆忙相亲结婚」 |
| 单身但**已相到人、还没赴约初遇**（`single` 且有 `lead`） | **不变（暂停）** | 当天刚相到人，给玩家从容安排见面的时间，不被倒计时逼死 |
| 初遇 / 接触中（meeting / talking） | **不变（暂停）** | 期限不会在接触中判负，保住剩余天数 |
| 恋爱 / 婚后（dating / married） | 归零 | 已确定关系，不再受期限压力 |

判定失败时还要求 **当前仍是单身**（`relationship === 'single'`），所以「期限到点但正在接触中」不会失败，可以继续把关系走完；分手或初遇失败清空对象后回到单身，会从暂停处继续走表。

倒计时卡片会按当前状态分别提示 `仍单身（正在走表）` / `已相到人，待赴约（倒计时暂停）` / `初遇中` / `接触中` / `已确定关系`——判断逻辑统一在 `engine.deadlineState(s)` 里，渲染层只负责展示，避免「卡片说暂停、实际却在扣天数」。

数值结算的随机浮动已按需求移除（原来是参考项目的 ±25%「肉鸽感」）。`tools/smoke.js` 300 局 × 多轮实测胜率：简单约 40–49%，普通约 20–25%，困难约 9–10%（设置页文案已同步为「普通难度通关率约 20%」）。困难档比上一版略高，是因为「手上有人时倒计时暂停」这条边界放宽了期限压力。注意每日自然衰减（`DAILY_HEALTH_DECAY` / `DAILY_LOOKS_DECAY` / `DAILY_AFFECTION_DECAY` / `DAILY_MOOD_RECOVER`）仍然保留 —— 那是「时间流逝」机制，所以隔天属性仍会有小幅变化，但**每次行动的结算数值本身是确定的**。
