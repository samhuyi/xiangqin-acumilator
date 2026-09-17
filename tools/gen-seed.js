/* =========================================================
 * 种子数据生成器
 * ---------------------------------------------------------
 * 从参考项目 xi______ngqin-simulator 的源码中抽取「全部游戏数据」，
 * 生成两份产物：
 *   db/seed/*.js     数据模板（CommonJS，供 db/import.js 转成云导入文件）
 *   db/export/*.json 导入云开发数据库的载荷
 *
 * 设计原则：逻辑层（js/core/engine.js）不得硬编码任何游戏数据，
 * 所有数值、事件、配置一律来自云开发数据库（唯一数据源）。
 * db/seed 仅作为生成导入文件的数据模板，不再作为运行时兜底。
 *
 * 用法： node tools/gen-seed.js [参考项目路径]
 * ========================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, '..', '..', 'WorkBuddy', '2026-09-07-10-05-43', 'xiangqin-simulator');
const SEED_DIR = path.join(ROOT, 'db', 'seed');
const EXPORT_DIR = path.join(ROOT, 'db', 'export');

/* 头像映射表的唯一真源：assets/images/role-map.js（美术配置，手工维护）。
 * 这里把它「复制进数据库」——backgrounds.avatar / materials.jobs[].avatar，
 * 运行时由 art.js 直接读数据库，渲染层不再依赖这份 JS 表。 */
const ROLE_MAP = require(path.join(ROOT, 'assets', 'images', 'role-map.js'));

/* ---------------------------------------------------------
 * 1. 加载参考源码（vm 沙箱，等价于浏览器的全局 <script> 拼接）
 * ------------------------------------------------------- */
function loadSource() {
  const files = [
    'js/data/avatar.js',
    'js/data/content.js',
    'js/data/events.js',
    'js/core/engine.js'
  ];
  // 顶层 const 不会挂到 context 对象上（只存在于全局词法环境），
  // 因此必须像参考项目的 tools/build.js 那样把源码拼成一份再整体执行，
  // 末尾显式导出到 globalThis。
  const parts = files.map(function (f) {
    const p = path.join(SRC, f);
    if (!fs.existsSync(p)) throw new Error('找不到参考源码: ' + p);
    return '/* ===== ' + f + ' ===== */\n' + fs.readFileSync(p, 'utf8');
  });
  const exports = [
    'EVENTS', 'GOALS', 'BACKGROUNDS', 'PERSONALITIES',
    'PARTNER_JOBS', 'PARTNER_TRAITS', 'PARTNER_CONDITIONS',
    'PARTNER_LOOKS', 'MEET_PLACES', 'HOBBIES', 'NAME_POOL', 'MEET_PLACE_LIST',
    'DIFFICULTIES', 'COURT_STYLES', 'STYLE_EVENTS', 'CHANNELS', 'DATE_TYPES', 'ENDINGS'
  ];
  const tail = '\n;globalThis.__SRC__ = {\n' +
    exports.map(function (n) { return '  ' + n + ': ' + n; }).join(',\n') +
    '\n};\n';

  const sandbox = { console: console };
  vm.createContext(sandbox);
  vm.runInContext(parts.join('\n;\n') + tail, sandbox, { filename: 'xiangqin-bundle.js' });
  if (!sandbox.__SRC__) throw new Error('源码加载失败');
  return sandbox.__SRC__;
}

/* ---------------------------------------------------------
 * 2. 数值常量：把 engine.js 里散落的魔数全部收敛为数据
 *    每个键都能在参考源码里找到对应出处
 * ------------------------------------------------------- */
function buildConstants(s) {
  return {
    // —— 每日自然变化 ——
    DAILY_HEALTH_DECAY: 0.22,
    DAILY_LOOKS_DECAY: 0.05,
    DAILY_MOOD_RECOVER: 0.4,
    DAILY_AFFECTION_DECAY: 0.28,

    // —— 收支 ——
    CAREER_INCOME_FACTOR: 150,
    PAYDAY_INTERVAL: 30,

    // —— 好感放大 ——
    /* 事件数值不再随机浮动：原来的 FX_ROLL_MIN / FX_ROLL_RANGE（±25%）
     * 已按需求移除，结算值 = 事件写死的数值 × 各项固定系数。 */
    RELATION_AFF_AMP: 1.6,

    // —— 行动时间成本 ——
    ACTION_DAYS: { confess: 5, propose: 10, child: 30, breakup: 1, rest: 1, chat: 1 },
    MEET_DAYS: 3,
    OVERTIME_DAYS: 3,
    SEEK_OK_DAYS: 7,
    SEEK_FAIL_DAYS: 10,
    EVENT_DAYS_LIFE: 4,
    EVENT_DAYS_IMPROVE: 9,

    // —— 找机会失败 ——
    SEEK_FAIL_MOOD: -5,

    // —— 第一印象 ——
    /* 不再有第一印象随机项；对象的「眼缘」由 partners[].first 提供 */
    FIRST_BASE: 33,
    FIRST_LOOKS_K: 0.2,
    FIRST_FAMILY_K: 0.12,
    FIRST_MOOD_K: 0.1,
    FIRST_CLAMP_MIN: 8,
    FIRST_CLAMP_MAX: 75,

    // —— 初遇告别 ——
    MEET_AFFECTION_MIN: 32,
    MEET_END_MOOD: -20,
    MEET_END_GRACE: 30,

    // —— 告白 ——
    CONFESS_AFF_BASE: 45,
    CONFESS_AFF_DIV: 55,
    CONFESS_LOOKS_DIV: 500,
    CONFESS_MOOD_DIV: 400,
    CHANCE_CLAMP_MIN: 0.05,
    CHANCE_CLAMP_MAX: 0.95,
    CONFESS_OK_AFF: 8,
    CONFESS_OK_GRACE: 180,
    CONFESS_FAIL_BREAKUP_RATE: 0.8,
    /* 好感度是「动态值」——上限随关系阶段变化：
     *   单身 / 初遇 / 接触中 → AFFECTION_CAP_BASE（100）
     *   告白成功（恋爱）/ 已婚 → AFFECTION_CAP_DATING（500）
     * 告白成功那一刻，旧刻度的好感度乘 CONFESS_AFF_RESCALE 换算到新刻度：
     * 之前聊得多、处得好，恋爱起点就更高，但距离求婚仍有一段路要走。
     * 想调节奏只改这三个数即可，不用动逻辑。 */
    AFFECTION_CAP_BASE: 100,
    AFFECTION_CAP_DATING: 500,
    CONFESS_AFF_RESCALE: 2.6,
    /* 恋爱之后的好感自然衰减更快（时间会磨感情），单位：点 / 天 */
    DAILY_AFFECTION_DECAY_DATING: 0.5,
    /* 恋爱之后，事件 / 约会给的好感同步放大，否则爬到 500 要耗掉整局 */
    DATING_AFF_GAIN_AMP: 2.0,

    // —— 求婚 ——
    /* 按「恋爱后的新刻度（上限 500）」计算：
     * 刚告白成功时约 200~250 点，成功率几乎为 0 —— 必须继续相处、
     * 把感情养到 PROPOSE_AFF_BASE 以上才有戏，
     * 没摸到 PROPOSE_AFF_MIN 界面会明确提示「还不够、还差多少」。
     * 三档难度实测（进入恋爱后能养到的峰值）：简单 ~490 · 普通 ~400 · 困难 ~350，
     * 所以这套基准值让「多相处」真的能换来成功率，而不是必须刷满。 */
    PROPOSE_AFF_BASE: 260,
    PROPOSE_AFF_DIV: 240,
    PROPOSE_AFF_MIN: 300,
    PROPOSE_MONEY_LOW: 60000,
    PROPOSE_MONEY_LOW_PENALTY: -0.25,
    PROPOSE_MONEY_HIGH: 300000,
    PROPOSE_MONEY_HIGH_BONUS: 0.1,
    PROPOSE_CAREER_HIGH: 70,
    PROPOSE_CAREER_BONUS: 0.05,
    PROPOSE_FAMILY_DIV: 400,
    PROPOSE_MOOD_DIV: 400,
    PROPOSE_COST: 60000,
    PROPOSE_OK_AFF: 40,
    /* 求婚被拒的好感损失同样按新刻度放大（原来 -25 在 500 刻度上几乎没感觉） */
    PROPOSE_FAIL_AFF: -50,
    PROPOSE_FAIL_BREAKUP_RATE: 0.6,

    // —— 生子 ——
    CHILD_AFFECTION_MIN: 70,
    CHILD_COST: 30000,
    CHILD_HEALTH: -5,
    CHILD_AFF: 30,

    // —— 分手 ——
    BREAKUP_HEALTH: -5,
    BREAKUP_MOOD: -30,
    /* 分手情绪扣减分档：与「相处天数」或「关系内花费」成正比。
     * 顺序从最重排到最轻；第一个被超过的档位生效，一档都没超则落到最后一档。
     *   days/money：满足其一时即命中该档（OR 关系）
     *   mode='zero'  情绪归 0（投入极深）
     *   mode='set'   情绪压到 value（投入不小）
     *   mode='ratio' 情绪折半（投入有限，最轻）
     * 第一档：超过 1 个月(30天) 或 花费超过 5000 → 情绪归 0
     * 第二档：超过 15 天 或 花费超过 2500 → 情绪压到 10
     * 第三档：兜底 → 情绪折半 */
    BREAK_MOOD_TIERS: [
      { days: 30, money: 5000, mode: 'zero' },
      { days: 15, money: 2500, mode: 'set', value: 10 },
      { days: 0, money: 0, mode: 'ratio', value: 0.5 }
    ],
    BREAKUP_ZERO_EXTRA_HEALTH: -1,
    BREAK_COOLDOWN_RATE: 0.5,
    BREAK_COOLDOWN_MIN: 5,
    BREAK_COOLDOWN_MAX: 40,

    // —— 加班 ——
    OVERTIME_BASE: 2000,
    OVERTIME_CAREER_K: 12,
    OVERTIME_CAREER: 5,
    OVERTIME_HEALTH: -6,
    OVERTIME_MOOD: -3,
    OVERTIME_AFF: -8,

    // —— 休息 ——
    REST_MOOD: 6,
    REST_HEALTH: 4,

    // —— 社畜摸鱼惩罚 ——
    WORKDAY_SKIP_MONEY: -1000,
    WORKDAY_SKIP_CAREER: -3,

    // —— 偶遇：其余安排认识对象的概率（按 action 覆盖，取不到用 BASE）——
    STAT_HISTORY_MAX: 12,
    ENCOUNTER_BASE: 0.12,
    ENCOUNTER_ACTIONS: 'life,improve,rest,overtime',
    ENCOUNTER_LIFE: 0.15,
    ENCOUNTER_IMPROVE: 0.10,
    ENCOUNTER_REST: 0.06,
    ENCOUNTER_OVERTIME: 0.05,

    // —— 事件抽取 ——
    EVENT_PHASE_WEIGHT: 2.6,
    RECENT_MAX: 6,
    /* 接触阶段顺序（唯一真源）：事件 stage / 聊天 phases 都按它比较。
     * 单身 → 初遇 → 暧昧（接触中） → 恋爱（告白成功） → 婚后 */
    RELATION_ORDER: 'single,meeting,talking,dating,married',

    // —— 微信闲聊 / 近期经历 ——
    CHAT_DAYS: 1,          // 闲聊耗天（ACTION_DAYS.chat）
    ACTLOG_MAX: 5,         // 「近期经历」保留条数
    CHAT_MIN_AFFECTION: 0, // 闲聊可用的最低好感度
    RANDOM_EVENT_CHANCE: 0.2,

    /* —— 见面前也能微信聊天 ——
     * 已经相到人、还没赴约（single + lead）算作 CHAT_LEAD_PHASE 阶段，
     * 题库里带这个 phases 标签的对话才会在这时出现（「还没见过面」的口吻）。
     * 这段时间聊出来的好感，在初遇时按 LEAD_CHAT_AFF_MAX 折算成印象分。 */
    CHAT_LEAD_PHASE: 'lead',
    LEAD_CHAT_AFF_MAX: 20,

    /* —— 对方的主动微信 + 「必须出门约会」——
     * PARTNER_CHAT_RATE 非单身时每天开头判定一次：命中就跳过当天行动选择。
     * CHAT_MUST_DATE_AFTER 微信上一共聊够这么多次（玩家点开的 + 对方主动发的
     *   都算，见面前不计）后，下一段聊天被强制替换成固定剧情（CHAT_MUST_DATE_ID），
     *   聊完进入「必须当面约会」状态 —— 在那之前微信入口会被锁住，只能先约一次会。
     * 调 PARTNER_CHAT_RATE = 0 可整体关闭主动聊天玩法。 */
    PARTNER_CHAT_RATE: 0.3,
    CHAT_MUST_DATE_AFTER: 2,
    CHAT_MUST_DATE_ID: 'c_mustdate',   // 固定剧情的 id（chats 集合里）
    CHAT_MUST_DATE_KIND: 'mustdate',   // 固定剧情的 kind 标记

    /* 结算页要展示「场景背景 + 双人头像」的行动（逗号分隔）。
     * 这些行动没有事件对象，靠 role-map 的 actionScene 兜底场景。 */
    RESULT_HEAD_ACTIONS: 'confess,propose',

    /* —— 结局页「看广告领奖励 · 再开一局」（微信激励视频）——
     * AD_ENABLED：总开关。设 0 时结局页只留「直接再开一局」一个按钮，
     *   不用改代码就能整体关掉广告（过审 / 调试用）。
     * AD_UNIT_ID：微信公众平台 → 流量主 → 广告位里的「广告位 ID」。
     *   这里是占位值 —— 后台建好广告位后把真实 ID 填到这里（Upsert 导入即可），
     *   代码不用动。留空或还是占位值时，广告拉不起来，会自动降级为「直接再开」。
     * AD_REWARD_*：看完一次给多少。奖励在「下一局开局时」一次性发放，
     *   不直接改上一局的结算数字（结局页展示的成绩必须是这一局真实打出来的）。 */
    AD_ENABLED: 1,
    AD_UNIT_ID: 'adunit-0000000000000000',
    AD_REWARD_MONEY: 5000,
    AD_REWARD_MOOD: 5,
    AD_REWARD_HEALTH: 5,

    // —— 对象抽取（对象数据本身在 partners 集合，这里只剩抽取权重系数）——
    PICK_MONEY_K: 2.2,
    PARTNER_AGE_MIN: 23,
    PARTNER_LOOKS_BASE: 38,
    PARTNER_LOOKS_MIN: 25,
    PARTNER_LOOKS_MAX: 95,
    PARTNER_FAMILY_BASE: 20,
    PARTNER_FAMILY_MIN: 10,
    PARTNER_FAMILY_MAX: 98,

    /* —— 相亲图鉴：解锁阶段的排序（唯一真源）——
     * met（已遇见） < meeting（初次见面） < talking（接触中） < dating（恋爱中） < married（已结婚）
     * 图鉴里「达成的进展」取该对象达到过的最高阶段。 */
    GALLERY_ORDER: 'met,meeting,talking,dating,married',

    // —— 界面 ——
    STAT_MONEY_MAX: 500000
  };
}

/* ---------------------------------------------------------
 * 3. 人生目标：把源码里的 check(s) / progress(s) 函数
 *    改写为可存库的声明式规则（由 js/core/rules.js 求值）
 * ------------------------------------------------------- */
const GOAL_RULES = {
  marry: {
    check: {
      all: [
        { field: 'relationship', op: 'eq', value: 'married' },
        { flag: 'child', op: 'eq', value: true }
      ]
    },
    progress: { type: 'relation', withChild: true }
  },
  true_love: {
    check: {
      all: [
        { field: 'relationship', op: 'eq', value: 'married' },
        { field: 'affection', op: 'gte', value: 100 }
      ]
    },
    progress: { type: 'relation', withChild: false }
  },
  rich_alone: {
    check: {
      all: [
        { field: 'money', op: 'gte', value: 10000000 },
        { field: 'relationship', op: 'eq', value: 'single' }
      ]
    },
    progress: {
      mul: [
        { ratio: 'money', target: 10000000 },
        { cond: { field: 'relationship', op: 'eq', value: 'single' }, then: 1, else: 0.5 }
      ]
    }
  },
  career_peak: {
    check: { all: [{ field: 'career', op: 'gte', value: 100 }] },
    progress: { ratio: 'career', target: 100 }
  },
  settle: {
    check: {
      all: [
        { field: 'money', op: 'gte', value: 1000000 },
        { field: 'career', op: 'gte', value: 70 }
      ]
    },
    progress: {
      min: [
        { ratio: 'money', target: 1000000 },
        { ratio: 'career', target: 70 }
      ]
    }
  },
  free: {
    check: {
      all: [
        { field: 'health', op: 'gte', value: 80 },
        { field: 'career', op: 'gte', value: 60 },
        { field: 'money', op: 'gte', value: 2000000 },
        { field: 'relationship', op: 'eq', value: 'single' }
      ]
    },
    progress: {
      mul: [
        {
          min: [
            { ratio: 'health', target: 80 },
            { ratio: 'career', target: 60 },
            { ratio: 'money', target: 2000000 }
          ]
        },
        { cond: { field: 'relationship', op: 'eq', value: 'single' }, then: 1, else: 0.5 }
      ]
    }
  }
};

const REL_PROGRESS_TABLE = {
  married: 0.9,
  dating: 0.6,
  talking: 0.4,
  meeting: 0.25,
  single: 0.05
};

function buildGoals(s) {
  return Object.keys(s.GOALS).map(function (id) {
    const g = s.GOALS[id];
    const rule = GOAL_RULES[id];
    if (!rule) throw new Error('缺少目标的声明式规则: ' + id);
    return {
      id: g.id,
      name: g.name,
      nameByGender: g.nameByGender || null,
      desc: g.desc,
      needRelation: !!g.needRelation,
      check: rule.check,
      progress: rule.progress,
      relProgressTable: REL_PROGRESS_TABLE,
      marriedWithChild: 1,
      marriedNoChild: 0.85
    };
  });
}

/* ---------------------------------------------------------
 * 4. 性格标签：checkPartnerLeave 的判定条件声明式化
 *    combine=sum 时 risk 累加，reason 取最后一条命中的规则
 * ------------------------------------------------------- */
const PERSONALITY_RULES = {
  money: [
    {
      cond: { field: 'money', op: 'lt', value: 20000 },
      risk: 0.06,
      reason: '你账户里的数字，让她越来越不安。'
    }
  ],
  emo: [
    {
      cond: { field: 'mood', op: 'lt', value: 25 },
      risk: 0.05,
      reason: '你最近总是闷闷的，她(O)觉得自己怎么暖都暖不热你。'
    },
    {
      cond: { field: 'affection', op: 'lt', value: 30 },
      risk: 0.04,
      reason: '你们的对话越来越少，她(O)觉得自己在唱独角戏。'
    }
  ],
  char: [
    {
      cond: {
        any: [
          { field: 'health', op: 'lt', value: 25 },
          { field: 'career', op: 'lt', value: 20 }
        ]
      },
      risk: 0.05,
      reason: '你状态肉眼可见地往下掉，她(O)开始怀疑这段关系靠不靠谱。'
    }
  ],
  casual: [
    {
      cond: null,
      risk: 0.05,
      reason: '她说：「我好像没想好要认真，算了吧。」语气轻松得像在说晚饭吃什么。'
    }
  ],
  family: [
    {
      cond: { field: 'health', op: 'lt', value: 20 },
      risk: 0.05,
      reason: '你身体亮了红灯，她(O)怕的是「以后」。'
    }
  ],
  career: [
    {
      cond: { field: 'career', op: 'lt', value: 25 },
      risk: 0.05,
      reason: '你越来越躺平，而她(O)最欣赏的那种劲头不见了。'
    }
  ]
};

function buildPersonalities(s) {
  return s.PERSONALITIES.map(function (p, i) {
    return {
      id: p.id,
      name: p.name,
      desc: p.desc,
      order: i + 1,
      combine: 'sum',
      rules: PERSONALITY_RULES[p.id] || []
    };
  });
}

/* ---------------------------------------------------------
 * 5. 约会档位：补上源码中散落在 goDate / dateSpendLabel 里的数据
 * ------------------------------------------------------- */
const DATE_TYPE_DAYS = { simple: 3, standard: 4, activity: 7 };
const DATE_SPEND_LABEL = {
  f: {
    simple: '买化妆品 / 护肤 · 约',
    standard: '买漂亮衣服 / 配饰 · 约',
    activity: '置办行头 / 做造型 · 约'
  },
  m: {
    simple: '请客喝咖啡 / 散步 · 约',
    standard: '请客吃饭 / 看电影 · 约',
    activity: '请客 + 送礼 / 短途 · 约'
  }
};

function buildDateTypes(s) {
  const order = ['simple', 'standard', 'activity'];
  return order.map(function (id) {
    const t = s.DATE_TYPES[id];
    return {
      id: t.id,
      name: t.name,
      sub: t.sub,
      cost: t.cost,
      mood: t.mood,
      affMult: t.affMult,
      days: DATE_TYPE_DAYS[id],
      spendLabel: DATE_SPEND_LABEL
    };
  });
}

/* 渠道定制（唯一真源）
 * ---------------------------------------------------------
 * 1. 新增「随缘偶遇」免费渠道（参考源码中没有，cost = 0）
 * 2. 按产品需求统一调整成功率：15% / 20% / 40% / 60% / 80%
 * 只覆盖 chance 与新增项，其余字段仍取自参考源码，
 * 因此重跑 gen-seed.js 也不会丢失这里的定制。 */
const CHANNEL_TUNING = {
  free: { name: '顺其自然', cost: 0, sub: '不主动不强求，该来的总会来', chance: 0.15 },
  self: { chance: 0.20 },
  relative: { chance: 0.40 },
  app: { chance: 0.60 },
  matchmaker: { chance: 0.80 }
};

function buildChannels(s) {
  const order = ['free', 'self', 'relative', 'app', 'matchmaker'];
  return order.map(function (id) {
    const tune = CHANNEL_TUNING[id] || {};
    const c = s.CHANNELS[id];
    return {
      id: id,
      name: tune.name !== undefined ? tune.name : (c ? c.name : id),
      cost: tune.cost !== undefined ? tune.cost : (c ? c.cost : 0),
      sub: tune.sub !== undefined ? tune.sub : (c ? c.sub : ''),
      chance: tune.chance !== undefined ? tune.chance : (c ? c.chance : 0)
    };
  });
}

function buildCourtStyles(s) {
  return Object.keys(s.COURT_STYLES).map(function (id) {
    const st = s.COURT_STYLES[id];
    return {
      id: st.id,
      name: st.name,
      desc: st.desc,
      affMod: st.affMod,
      risk: st.risk,
      failAff: st.failAff,
      failText: st.failText,
      mood: st.mood || 0,
      cost: typeof st.cost === 'number' ? st.cost : 0,
      seeMore: !!st.seeMore,
      suits: st.suits || ''
    };
  });
}

function buildStyleEvents(s) {
  return Object.keys(s.STYLE_EVENTS).map(function (styleId) {
    return { id: styleId, styleId: styleId, eventIds: s.STYLE_EVENTS[styleId].slice() };
  });
}

/* ---------------------------------------------------------
 * 3.5 微信闲聊（非单身时可用）
 * ---------------------------------------------------------
 * 参考项目没有这个玩法，是本工程按需求新增的：
 * 「对方发几条消息 → 你从几个回复里挑一个」，只影响好感度与情绪。
 * 全部数值都在这里（进数据库），逻辑层只做加减与夹取。
 *   kind      结构标记：normal 日常 / grill 灵魂拷问 / flirt 暧昧 /
 *             mustdate 固定「必须出门约会」剧情。逻辑层只拿它做分支。
 *   personalityId 可选。填了就只对「这个人格」的对象投放，
 *             刁钻事件与暧昧事件都靠它做到「按对象性格出题」。
 *   phases    可出现的阶段（talking / dating / married）
 *             按「接触阶段」分级：暧昧向内容可含 talking，
 *             见家长 / 要孩子这类婚嫁向内容只给 dating / married（告白成功后）。
 *   minAffection 好感度门槛
 *   opener    对方发来的消息（1~3 条，按顺序弹出）
 *   options   回复选项：label 你的回复 / reply 对方接下来的一句 /
 *             affection 好感度增减 / mood 情绪增减 /
 *             correct 是否答到点子上（只用于展示与校验，不参与结算）
 * ------------------------------------------------------- */
const CHAT_SCENARIOS = [
  {
    id: 'c_home',
    phases: ['talking', 'dating', 'married'],
    minAffection: 0,
    weight: 12,
    opener: ['到家了吗？', '今天风好大，路上小心点'],
    options: [
      { label: '刚到，你也早点回去', affection: 6, mood: 3, reply: '嗯，我到家给你发消息' },
      { label: '还在加班……', affection: 2, mood: -1, reply: '那你也太拼了，记得吃饭' },
      { label: '嗯。（没再看手机）', affection: -5, mood: 0, reply: '……那你先忙' }
    ]
  },
  {
    id: 'c_meal',
    phases: ['talking', 'dating', 'married'],
    minAffection: 5,
    weight: 12,
    opener: ['我刚吃完', '今天食堂的菜好难吃，你吃什么了？'],
    options: [
      { label: '我煮了面，下次给你带一份', affection: 7, mood: 3, reply: '真的假的，我要尝尝' },
      { label: '随便对付了一口', affection: 2, mood: 0, reply: '那你可别老这样' },
      { label: '还没吃，不饿', affection: -3, mood: -2, reply: '不吃饭会胃疼的……' }
    ]
  },
  {
    id: 'c_weekend',
    phases: ['talking', 'dating', 'married'],
    minAffection: 10,
    weight: 10,
    opener: ['周末你有空吗？', '想去附近逛逛'],
    options: [
      { label: '有空，你想去哪儿我陪你', affection: 8, mood: 4, reply: '那说好了，你别临时加班' },
      { label: '看情况，可能要加班', affection: -4, mood: -1, reply: '行吧，你忙' },
      { label: '我这周末想在家躺平', affection: -2, mood: 2, reply: '好吧，那你好好休息' }
    ]
  },
  {
    id: 'c_complain',
    phases: ['talking', 'dating', 'married'],
    minAffection: 15,
    weight: 10,
    opener: ['今天好累', '感觉什么都做不好'],
    options: [
      { label: '别这么说，你已经很厉害了', affection: 9, mood: 4, reply: '……谢谢你' },
      { label: '那就早点睡，别想了', affection: 3, mood: 1, reply: '嗯，睡了' },
      { label: '谁不累啊', affection: -7, mood: -3, reply: '你说得对，是我矫情了' }
    ]
  },
  {
    id: 'c_mom',
    /* 见家长是明确的婚嫁信号 → 接触中（talking）不出现，告白成功后才有 */
    phases: ['dating', 'married'],
    minAffection: 20,
    weight: 8,
    opener: ['我妈问我们到哪一步了'],
    options: [
      { label: '那就找个时间见见阿姨', affection: 10, mood: 2, reply: '……你认真的？我先跟她说一声' },
      { label: '再等等，我还没准备好', affection: -3, mood: -1, reply: '知道了，我不催你' },
      { label: '你怎么什么都跟你妈说', affection: -9, mood: -3, reply: '那以后我不说了' }
    ]
  },
  {
    id: 'c_late',
    phases: ['talking', 'dating', 'married'],
    minAffection: 8,
    weight: 10,
    opener: ['你还没睡呀'],
    options: [
      { label: '在想你，睡不着', affection: 8, mood: 5, reply: '肉麻……不过我也还没睡' },
      { label: '刚忙完，这就睡', affection: 3, mood: 1, reply: '那快去吧，晚安' },
      { label: '你管我几点睡', affection: -8, mood: -2, reply: '哦' }
    ]
  },
  {
    id: 'c_gift',
    phases: ['dating', 'married'],
    minAffection: 30,
    weight: 8,
    opener: ['我给你买了点东西', '不多，就是路过看到了'],
    options: [
      { label: '你怎么这么好，我请你吃饭', affection: 9, mood: 5, reply: '那我可记住了，别赖账' },
      { label: '又乱花钱', affection: -5, mood: -2, reply: '……那我退了' },
      { label: '谢谢，多少钱我转你', affection: -6, mood: -1, reply: '不用，你这话就见外了' }
    ]
  },
  {
    id: 'c_kids',
    phases: ['married'],
    minAffection: 40,
    weight: 10,
    opener: ['今天在小区看到有人推婴儿车', '忽然觉得还挺可爱的'],
    options: [
      { label: '那我们也准备一个？', affection: 8, mood: 4, reply: '……你认真想想再说这句话' },
      { label: '先过两年二人世界吧', affection: 3, mood: 2, reply: '嗯，我也不急' },
      { label: '养孩子多贵啊', affection: -4, mood: -2, reply: '你算得倒是清楚' }
    ]
  },

  /* -------------------------------------------------------
   * 灵魂拷问（kind: 'grill'）——「刁钻事件」
   * 由对象人格（personalityId）定向投放：只有这个性格的人才会问
   * 这个要命的问题。回答踩雷会「大幅」掉好感，一次就能把关系打回原形。
   * 三个选项里恰好一条 correct: true（不痛不痒但也不是最优）。
   * ----------------------------------------------------- */
  {
    id: 'g_money',
    kind: 'grill',
    personalityId: 'money',
    phases: ['talking', 'dating', 'married'],
    minAffection: 10,
    weight: 6,
    opener: ['问你个正事', '要是结婚了，首付你家能出多少？'],
    options: [
      { label: '首付我来想办法，不用你操心', affection: 11, mood: 3, correct: true, reply: '……这话我爱听。' },
      { label: '这个能不能以后再说', affection: -24, mood: -6, reply: '那什么时候说？等你没钱的时候吗。' },
      { label: '你家不也有吗', affection: -27, mood: -8, reply: '哦。我知道了。' }
    ]
  },
  {
    id: 'g_emo',
    kind: 'grill',
    personalityId: 'emo',
    phases: ['talking', 'dating', 'married'],
    minAffection: 10,
    weight: 6,
    opener: ['今天心情特别差', '你猜我现在最想听你说什么'],
    options: [
      { label: '我在，你说，我听着', affection: 12, mood: 4, correct: true, reply: '……就这一句。' },
      { label: '别想太多，睡一觉就好了', affection: -22, mood: -5, reply: '你每次都这么说。' },
      { label: '我又不知道你怎么了', affection: -25, mood: -6, reply: '对，你不知道。' }
    ]
  },
  {
    id: 'g_char',
    kind: 'grill',
    personalityId: 'char',
    phases: ['talking', 'dating', 'married'],
    minAffection: 10,
    weight: 6,
    opener: ['我认真问你一个', '你上一次为别人做点什么，是什么时候？'],
    options: [
      { label: '上个月帮同事顶了个夜班', affection: 11, mood: 3, correct: true, reply: '嗯，你这个人我大概看明白了。' },
      { label: '记不清了，一直挺忙', affection: -22, mood: -5, reply: '忙。都对。' },
      { label: '这问题有意义吗', affection: -26, mood: -7, reply: '没有。当我没问。' }
    ]
  },
  {
    id: 'g_casual',
    kind: 'grill',
    personalityId: 'casual',
    phases: ['talking', 'dating', 'married'],
    minAffection: 10,
    weight: 6,
    opener: ['说真的', '你觉得我们现在算什么关系？'],
    options: [
      { label: '我在认真喜欢你，但不催你', affection: 10, mood: 3, correct: true, reply: '……你还挺有意思。' },
      { label: '你说算什么就算什么', affection: -23, mood: -5, reply: '那你可真省事。' },
      { label: '都聊这么久了还问这个', affection: -25, mood: -6, reply: '哦，那算了。' }
    ]
  },
  {
    id: 'g_family',
    kind: 'grill',
    personalityId: 'family',
    phases: ['talking', 'dating', 'married'],
    minAffection: 10,
    weight: 6,
    opener: ['我妈身体一直不太好', '以后要是需要人长期照顾，你怎么想'],
    options: [
      { label: '那就一起照顾，这是应该的', affection: 12, mood: 4, correct: true, reply: '……你这句我记住了。' },
      { label: '请个护工不行吗', affection: -25, mood: -6, reply: '钱能解决的话，我也不会问你。' },
      { label: '那是你家的事吧', affection: -30, mood: -9, reply: '嗯。是。' }
    ]
  },
  {
    id: 'g_career',
    kind: 'grill',
    personalityId: 'career',
    phases: ['talking', 'dating', 'married'],
    minAffection: 10,
    weight: 6,
    opener: ['我问个可能不太好听的', '你打算就这样一直干到退休吗'],
    options: [
      { label: '不会，我在准备下一步', affection: 11, mood: 3, correct: true, reply: '说说看。' },
      { label: '稳定点不好吗', affection: -22, mood: -5, reply: '好，挺好的。' },
      { label: '你管得有点宽', affection: -25, mood: -6, reply: '行。' }
    ]
  },

  /* -------------------------------------------------------
   * 暧昧事件（kind: 'flirt'）
   * 同样由对象人格定向投放。话接住了会「大幅」涨好感，
   * 这是关系里升温最快的一条路；接不住也不至于翻脸，只是白瞎了机会。
   * ----------------------------------------------------- */
  {
    id: 'f_money',
    kind: 'flirt',
    personalityId: 'money',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 8,
    opener: ['我发现你一个优点', '你花钱的样子，不像是缺钱的人'],
    options: [
      { label: '因为想给你花的，都不算贵', affection: 20, mood: 6, correct: true, reply: '……你这张嘴。' },
      { label: '其实我卡里就剩两千了', affection: 3, mood: 0, reply: '那你还挺诚实。' },
      { label: '那你看上的是我的钱？', affection: -5, mood: -3, reply: '你想多了。' }
    ]
  },
  {
    id: 'f_emo',
    kind: 'flirt',
    personalityId: 'emo',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 8,
    opener: ['你刚才那句话', '我偷偷听了三遍'],
    options: [
      { label: '那我以后天天说给你听', affection: 22, mood: 7, correct: true, reply: '……你别骗我。' },
      { label: '随口说的，别当真', affection: 2, mood: -1, reply: '哦。' },
      { label: '你听这么多遍干嘛', affection: -4, mood: -3, reply: '没事。' }
    ]
  },
  {
    id: 'f_char',
    kind: 'flirt',
    personalityId: 'char',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 8,
    opener: ['今天有人夸你', '说你一看就是特别靠得住的那种人'],
    options: [
      { label: '对别人一般，对你会再靠得住一点', affection: 20, mood: 6, correct: true, reply: '……嗯。' },
      { label: '我本来就这样', affection: 3, mood: 0, reply: '是。' },
      { label: '谁啊，这么闲', affection: -4, mood: -2, reply: '我。' }
    ]
  },
  {
    id: 'f_casual',
    kind: 'flirt',
    personalityId: 'casual',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 8,
    opener: ['好无聊啊', '你陪我聊会儿呗'],
    options: [
      { label: '陪你到你说困为止', affection: 21, mood: 7, correct: true, reply: '那你今晚别想睡了。' },
      { label: '行，那聊十分钟', affection: 2, mood: 0, reply: '……哦。' },
      { label: '我打游戏呢', affection: -6, mood: -3, reply: '那你打。' }
    ]
  },
  {
    id: 'f_family',
    kind: 'flirt',
    personalityId: 'family',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 8,
    opener: ['刚才在超市', '看到一对老头老太太一起挑菜'],
    options: [
      { label: '那以后咱们也这样，袋子归我拎', affection: 21, mood: 7, correct: true, reply: '……说好了。' },
      { label: '挺正常的啊', affection: 2, mood: 0, reply: '是啊。' },
      { label: '那多累啊', affection: -5, mood: -2, reply: '不累的。' }
    ]
  },
  {
    id: 'f_career',
    kind: 'flirt',
    personalityId: 'career',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 8,
    opener: ['今天开会', '有个人跟你还挺像的'],
    options: [
      { label: '那下次开会带上我，让他看看更像的', affection: 19, mood: 6, correct: true, reply: '你倒是敢说。' },
      { label: '哪儿像', affection: 3, mood: 0, reply: '说不上来。' },
      { label: '开会有什么好说的', affection: -4, mood: -2, reply: '也是。' }
    ]
  },

  /* -------------------------------------------------------
   * 见面前（lead）—— 已经相到人、加上微信、还没赴约
   * 这时候对方还没见过你，聊的都是「还没见面」的话题：
   * 确认见面安排、说自己慢热、试探现实条件。
   * 这段时间攒下的好感，初遇时会按 LEAD_CHAT_AFF_MAX 折算成印象分。
   * ----------------------------------------------------- */
  {
    id: 'l_hi',
    phases: ['lead'],
    minAffection: 0,
    weight: 14,
    opener: ['你好', '介绍人把你微信给我了', '……先说一句，我不太会聊天'],
    options: [
      { label: '没事，我也一样。先认识一下？', affection: 7, mood: 3, reply: '那就好，我还怕你觉得我奇怪。' },
      { label: '发了个自我介绍的长文过去', affection: 4, mood: 0, reply: '哇，好正式。我这边简单说一下我的情况吧。' },
      { label: '嗯。', affection: -4, mood: -1, reply: '……那我先不打扰你了。' }
    ]
  },
  {
    id: 'l_plan',
    phases: ['lead'],
    minAffection: 4,
    weight: 12,
    opener: ['我们约哪天见？', '我周末基本都有空，除了周六上午要去趟医院看我妈'],
    options: [
      { label: '那就周六下午，我找个离你近的地方', affection: 9, mood: 3, reply: '好，你定吧，我都可以。' },
      { label: '你方便就行，我随便', affection: 3, mood: 1, reply: '……那我想想。' },
      { label: '周六上午你有什么事啊', affection: -3, mood: -1, reply: '我妈身体一直不太好，我每周都去。' }
    ]
  },
  {
    id: 'l_slow',
    phases: ['lead'],
    minAffection: 2,
    weight: 12,
    personalityId: 'emo',
    opener: ['先跟你说个事', '我这个人比较慢热', '可能聊起来会有点冷，不是针对你'],
    options: [
      { label: '没关系，慢慢来，我不着急', affection: 10, mood: 4, reply: '……你这样说我就放心了。' },
      { label: '那你怎么之前相亲的？', affection: -6, mood: -2, reply: '所以都没成。' },
      { label: '多聊聊就熟了，很正常', affection: 6, mood: 2, reply: '嗯，可能吧。' }
    ]
  },
  {
    id: 'l_reality',
    phases: ['lead'],
    minAffection: 6,
    weight: 11,
    opener: ['问个现实的', '我上班在城东，住城西', '以后要真处起来，见面挺费劲的'],
    options: [
      { label: '那我把见面地点都定在中间，我来跑', affection: 10, mood: 3, reply: '你倒是想得挺明白。' },
      { label: '确实挺远的，这得考虑考虑', affection: -6, mood: -1, reply: '嗯，是得考虑。' },
      { label: '地铁也就四十分钟，还行吧', affection: 4, mood: 1, reply: '你倒是挺乐观。' }
    ]
  },

  /* -------------------------------------------------------
   * 父母催婚 —— 从「我妈又问」到「我妈想见你」，
   * 越往后越像婚嫁信号，所以按阶段+好感度层层放开。
   * ----------------------------------------------------- */
  {
    id: 'c_parents_urge',
    phases: ['talking', 'dating', 'married'],
    minAffection: 8,
    weight: 11,
    opener: ['我妈今天又问我了', '问我们怎么样了', '我说还在接触，她不信'],
    options: [
      { label: '那……你就跟她说还行？', affection: 8, mood: 3, reply: '我真这么说了。你别笑。' },
      { label: '我妈也一样，天天问', affection: 7, mood: 4, reply: '哈哈哈原来天下父母都一样。' },
      { label: '你别把我供出去啊', affection: -7, mood: -2, reply: '……行，那我以后不说你了。' }
    ]
  },
  {
    id: 'c_parents_arrange',
    phases: ['talking', 'dating', 'married'],
    minAffection: 12,
    weight: 11,
    opener: ['跟你说件事，你别不高兴', '我妈又给我安排了一个', '我没答应，但也拒得不硬'],
    options: [
      { label: '那你去看看吧，多一个选择', affection: -9, mood: -1, reply: '……你真是这么想的？' },
      { label: '别去了。我们在处的。', affection: 12, mood: 5, reply: '我就等你这句话。' },
      { label: '你怎么跟你妈说的？', affection: 5, mood: 1, reply: '我说我这边有在接触的人了。' }
    ]
  },
  {
    id: 'c_parents_meet',
    phases: ['dating', 'married'],
    minAffection: 25,
    weight: 10,
    opener: ['我妈说想见见你', '就吃个饭，不会为难你的'],
    options: [
      { label: '好啊，什么时候？我准备点东西带过去', affection: 12, mood: 4, reply: '你真答应了？那我现在就去跟她说。' },
      { label: '再等等吧，我有点怕', affection: -5, mood: -1, reply: '……行，我不勉强你。' },
      { label: '见家长是不是太快了', affection: -8, mood: -2, reply: '我们在一起也有一阵了吧。' }
    ]
  },
  {
    id: 'c_real_house',
    phases: ['dating', 'married'],
    minAffection: 20,
    weight: 10,
    personalityId: 'money',
    opener: ['说一下房子的事', '我爸妈的意思是首付两家一起凑', '你怎么看'],
    options: [
      { label: '我家能出一部分，剩下的我们一起扛', affection: 11, mood: 3, reply: '那我把这话跟我爸妈说。' },
      { label: '房子的事以后再说，现在先处着', affection: -6, mood: -1, reply: '……也行。' },
      { label: '首付不是该男方准备吗', affection: -10, mood: -3, reply: '原来你是这么想的。' }
    ]
  },

  /* -------------------------------------------------------
   * 个人慢热 —— 对方不是不喜欢你，只是需要时间。
   * 逼得太紧反而掉好感，给空间才涨。
   * ----------------------------------------------------- */
  {
    id: 'c_slow_warm',
    phases: ['talking', 'dating', 'married'],
    minAffection: 6,
    weight: 11,
    opener: ['我最近一直在想一件事', '我对你是有好感的', '但我没办法很快说出「喜欢」'],
    options: [
      { label: '那我就等你，什么时候都行', affection: 12, mood: 4, reply: '……你这样我更不好意思催自己了。' },
      { label: '那你到底喜不喜欢我？', affection: -8, mood: -3, reply: '我现在说不上来。' },
      { label: '没关系，我也不急', affection: 8, mood: 2, reply: '那就好。' }
    ]
  },
  {
    id: 'c_slow_trust',
    phases: ['talking', 'dating', 'married'],
    minAffection: 10,
    weight: 10,
    personalityId: 'emo',
    opener: ['我以前被人骗过', '所以一开始都会留一手', '不是针对你，是我自己的问题'],
    options: [
      { label: '明白。你不用勉强，什么时候想说了再说', affection: 12, mood: 4, reply: '……谢谢。' },
      { label: '那你现在还在留一手吗', affection: -6, mood: -2, reply: '……在。' },
      { label: '过去的事就过去了，看我表现', affection: 9, mood: 3, reply: '你倒是挺自信。' }
    ]
  },
  {
    id: 'c_slow_space',
    phases: ['talking', 'dating', 'married'],
    minAffection: 14,
    weight: 10,
    opener: ['这几天我想自己待一会儿', '不是闹脾气', '就是有点累'],
    options: [
      { label: '好，我不打扰你。等你想聊了找我', affection: 10, mood: 3, reply: '嗯。谢谢你没有追问。' },
      { label: '是不是我哪里做错了？', affection: -2, mood: -2, reply: '没有，真的。' },
      { label: '你是不是想分手', affection: -9, mood: -4, reply: '……我就是想安静两天。' }
    ]
  },

  /* -------------------------------------------------------
   * 现实因素 —— 通勤、加班、钱、家里老人。
   * 这些是「相处里绕不过去的坎」，答得好是加分项，答得硬就掉。
   * ----------------------------------------------------- */
  {
    id: 'c_real_overtime',
    phases: ['talking', 'dating', 'married'],
    minAffection: 6,
    weight: 11,
    opener: ['最近项目上线', '天天到十一点', '你发我的消息我都看到了，就是没力气回'],
    options: [
      { label: '不用回，忙完记得吃饭就行', affection: 11, mood: 4, reply: '你怎么这么好说话。' },
      { label: '再忙也要回个消息吧', affection: -7, mood: -2, reply: '……对不起。' },
      { label: '那你这周约的会还去吗', affection: 2, mood: -1, reply: '去吧，挤一挤总有时间。' }
    ]
  },
  {
    id: 'c_real_money',
    phases: ['talking', 'dating', 'married'],
    minAffection: 10,
    weight: 10,
    personalityId: 'money',
    opener: ['这个月有点紧', '上次看电影还是你买的单', '下次我来'],
    options: [
      { label: '别放心上，下次你请就行', affection: 9, mood: 3, reply: '嗯，记我账上。' },
      { label: '没事，我这边还挺宽裕的', affection: 6, mood: 1, reply: '那也不太好意思。' },
      { label: '你工资不是挺高的吗', affection: -8, mood: -3, reply: '……我也有要用钱的地方。' }
    ]
  },
  {
    id: 'c_real_family',
    phases: ['talking', 'dating', 'married'],
    minAffection: 15,
    weight: 10,
    personalityId: 'family',
    opener: ['我爸最近身体不太好', '我可能得常回老家', '以后会耽误很多事'],
    options: [
      { label: '家里的事最要紧，需要我一起去吗', affection: 12, mood: 4, reply: '……有你这句话我就踏实了。' },
      { label: '那你工作怎么办？', affection: 2, mood: -1, reply: '先请假吧，没办法。' },
      { label: '长期这样可不行啊', affection: -10, mood: -4, reply: '我知道。所以我才提前跟你说。' }
    ]
  },
  {
    id: 'c_real_commute',
    phases: ['talking', 'dating', 'married'],
    minAffection: 8,
    weight: 10,
    opener: ['今天通勤两个小时', '到家只想躺着', '感觉整年都在路上'],
    options: [
      { label: '那周末别跑了，我去找你', affection: 10, mood: 4, reply: '好啊，那我做饭。' },
      { label: '要不你考虑换个工作？', affection: 1, mood: -1, reply: '说得容易。' },
      { label: '都这样，忍忍吧', affection: -6, mood: -2, reply: '嗯，忍忍。' }
    ]
  },

  /* -------------------------------------------------------
   * 必须出门约会（kind: 'mustdate'）
   * 固定的剧情：主动微信聊够次数后由逻辑层直接指定，不进随机池
   * （phases 里没有 talking 之外的入口 —— 它由 CHAT_MUST_DATE_ID 点名调用）。
   * 讲完后玩家进入「必须当面接触」状态，微信入口会被锁住。
   * ----------------------------------------------------- */
  {
    id: 'c_mustdate',
    kind: 'mustdate',
    phases: ['lead', 'meeting', 'talking', 'dating', 'married'],
    minAffection: 0,
    weight: 0,
    opener: ['有件事我得说一下', '我们天天在微信上聊', '我都快忘了你长什么样了', '这周末出来见一面吧'],
    options: [
      { label: '好，我带你去个地方', affection: 8, mood: 4, correct: true, reply: '那就这么说定了，别再推。' },
      { label: '最近有点忙……', affection: -6, mood: -2, reply: '你每次都这么说。' },
      { label: '见面干嘛，微信不是挺好', affection: -10, mood: -4, reply: '……行，那当我没说。' }
    ]
  }
];

/* 扩充聊天题库：按「结算规则 1」新写的聊天（回复出人意料、全属性有增有减、奖惩加大）。
 * 单独成文件，与事件扩充保持一致的做法。 */
const MORE_CHATS = require('./seed-more-chats.js');

function buildChats() {
  return CHAT_SCENARIOS.concat(MORE_CHATS).map(function (c) {
    var out = {
      id: c.id,
      /* kind 是结构标记，逻辑层只拿它做分支，不写死任何文案/数值：
       *   normal   日常闲聊
       *   grill    灵魂拷问（刁钻事件）：踩雷句会大幅掉好感
       *   flirt    暧昧事件：命中对方心思会大幅涨好感
       *   mustdate 固定的「必须出门约会」剧情（主动聊天超过阈值后必出） */
      kind: c.kind || 'normal',
      /* personalityId 不为空时，只有「对象人格」匹配才可能抽到这条 */
      personalityId: c.personalityId || null,
      /* 闲聊题库覆盖到「见面前（lead）/ 刚见完面（meeting）」：
       * 见面前本来就该能在微信上聊，聊够次数才触发「必须当面约会」。
       * mustdate 固定剧情自己已在 phases 里点名 lead/meeting，这里去重即可。 */
      phases: c.phases.concat(['lead', 'meeting']).filter(function (p, i, a) {
        return a.indexOf(p) === i;
      }),
      minAffection: c.minAffection,
      weight: c.weight,
      opener: c.opener.slice(),
      options: c.options.map(function (o, oi) {
        /* 聊天与事件同一套规则：作者写 fx（新数据）或 affection/mood（旧写法）都收，
         * 统一过 enrichFx 后对全部属性生效。 */
        var fx = enrichFx(o.fx || { affection: o.affection || 0, mood: o.mood || 0 },
          c.id + '#' + oi);
        return {
          label: o.label,
          reply: o.reply,
          fx: fx,
          /* 兼容旧云端数据 / 旧逻辑：扁平字段与 fx 保持同一份数值，不会出现两套口径 */
          affection: fx.affection || 0,
          mood: fx.mood || 0,
          /* 是否「答到点子上」：只用于展示「答对 / 答错」提示与数据校验，
           * 好感度增减仍然由上面的 fx 决定，不走两套逻辑。 */
          correct: !!o.correct
        };
      })
    };
    return out;
  });
}

function buildDifficulties(s) {
  const order = ['easy', 'normal', 'hard'];
  return order.map(function (id) {
    const d = s.DIFFICULTIES[id];
    return {
      id: d.id,
      name: d.name,
      desc: d.desc,
      initMod: d.initMod,
      chanceMod: d.chanceMod,
      costMod: d.costMod,
      decayMod: d.decayMod,
      maxDays: d.maxDays,
      timeMod: d.timeMod,
      gainMod: d.gainMod,
      affMod: d.affMod,
      riskMod: d.riskMod,
      salaryMod: d.salaryMod,
      partnerDeadline: d.partnerDeadline
    };
  });
}

function buildBackgrounds(s) {
  return s.BACKGROUNDS.map(function (b) {
    return {
      id: b.id,
      name: b.name,
      tag: b.tag,
      /* 头像：职业 key（对应 assets/images/role/<avatar>-<性别>.png）。 */
      avatar: (ROLE_MAP.background && ROLE_MAP.background[b.id]) || null,
      intro: b.intro.slice(),
      init: {
        money: b.init.money,
        health: b.init.health,
        career: b.init.career,
        looks: b.init.looks,
        family: b.init.family,
        mood: b.init.mood,
        jobType: b.init.jobType,
        jobName: b.init.jobName,
        income: b.init.income,
        expense: b.init.expense
      },
      goals: b.goals.slice()
    };
  });
}

/* 结局 → 头部背景图的美术类型（唯一真源）
 * ---------------------------------------------------------
 * 结局页头部的背景图路径是
 *     assets/images/end/end_<art>_<性别>.jpg
 * 13 个结局只对应 3 种画面（结婚 / 被逼婚 / 一个人），所以这里做一张
 * 「结局 id → 美术类型」的表，art 存进 endings 集合，渲染层只拼 key，
 * 不认识任何一个结局 id（是不是结婚、该用哪张图，都由数据说了算）。
 * 没登记的 id 一律落到 alone —— 至少不会白屏。 */
const ENDING_ART = {
  marry: 'happymarry',        // 尘埃落定：修成正果
  true_love: 'happymarry',    // 满分答案：好感满格的两个人
  forced: 'badmarry'          // 在父母催促下匆忙相亲结婚
  /* 其余（独自富有 / 山顶的风 / 落地生根 / 自由人生 / 破产 / 身体亮红灯 /
   * 事业崩塌 / 撑不住了 / 停在原地 / 时间到了）都是「一个人」的画面 */
};

function buildEndings(s) {
  return Object.keys(s.ENDINGS).map(function (id) {
    const e = s.ENDINGS[id];
    return {
      id: id,
      type: e.type,
      art: ENDING_ART[id] || 'alone',
      title: e.title,
      lines: e.lines.slice()
    };
  });
}

/* 事件的最低接触阶段（可选，唯一真源）
 * ---------------------------------------------------------
 * 事件的 phase 决定它属于哪一段关系（single/meeting/talking/dating/married/any/date），
 * 但对于「date」阶段的约会事件，光靠 phase 分不出轻重：见面聊到「要不要孩子」
 * 显然不该在刚接触（talking）时出现。这里给这类内容标一个最低阶段：
 *   stage = 'dating' → 告白成功（恋爱中）之后才可能出现
 * 没写进这张表的事件不受限制（接触中即可）。
 * 运行时由 engine.stageOk(s, ev) 按 constants.RELATION_ORDER 比较。 */
const EVENT_STAGE = {
  dt_question_kid: 'dating',    // 晚餐吃到一半，忽然问「要不要孩子」
  dt_question_live: 'dating'    // 「婚后和父母同住」怎么想
};

/* 补充事件（唯一真源）
 * ---------------------------------------------------------
 * 参考项目的事件池偏小：相亲现场翻来覆去就是「咖啡厅 / 饭馆」两三种，
 * 单身期也只有泛泛的日常。这里按同一套结构补一批 ——
 *   · phase 'meeting' → 相亲桌上真实会发生的尴尬与意外（含父母掺和、条件盘问等）
 *   · phase 'single'  → 还没相到人时「继续找对象」的日常
 *   · phase 'talking' → 只在微信上聊、还没见过面的阶段
 * 字段与参考项目完全一致：text 是正文数组（{p} = 对方名字），
 * options[].fx 支持 money/health/career/looks/family/mood/affection，
 * 写多少就结算多少（不会再有随机浮动）。 */
const EXTRA_EVENTS = [
  /* ---------------- 相亲现场（meeting） ---------------- */
  {
    id: 'x_meet_late',
    phase: 'meeting',
    weight: 10,
    text: [
      '约的是下午三点。三点二十，{p}才推门进来。',
      '「对不起对不起，路上堵车。」{p}把包放下，头发有点乱。'
    ],
    options: [
      { label: '「没事，我也刚到。」（把等了二十分钟的事咽下去）', fx: { affection: 8, mood: -2 }, result: '她松了口气，坐下来第一句话就是「你人真好」。这顿饭的气氛从一开始就是松的。' },
      { label: '「堵车？这个点不至于吧。」', fx: { affection: -7, mood: 1 }, result: '她脸上的歉意收了一半，剩下的一半变成了防备。后面的对话都客客气气。' },
      { label: '递上一杯已经买好的热饮：「先喝口水。」', fx: { affection: 10, money: -25 }, result: '她捧着杯子愣了一下，说「你怎么知道我爱喝这个」。你不知道，但这一下赌对了。' }
    ]
  },
  {
    id: 'x_meet_parents_call',
    phase: 'meeting',
    weight: 9,
    text: [
      '聊到一半，{p}的手机震了。',
      '屏幕上写着「妈」。她看了你一眼，还是接了。',
      '「……嗯，在见着呢……挺好的……回去再说。」'
    ],
    options: [
      { label: '等她挂了，笑着说「阿姨挺关心你」', fx: { affection: 8 }, result: '她把手机扣在桌上，说「我妈比我还急」。话题就这么自然地转到了各自的家里。' },
      { label: '「要不你先聊完，我去趟洗手间。」（留她空间）', fx: { affection: 9 }, result: '你回来时她已经挂了电话，看着你说「很少有人这么识趣」。' },
      { label: '凑过去想听清电话里说什么', fx: { affection: -10, mood: -2 }, result: '她把手机往旁边挪了挪。那一眼里的东西，你读懂了。' }
    ]
  },
  {
    id: 'x_meet_checklist',
    phase: 'meeting',
    weight: 9,
    text: [
      '{p}从包里拿出一张纸，推到你面前。',
      '上面是几行字：房、车、年薪、户口。',
      '「我说话直，咱们合适就处，不合适也别浪费时间。」'
    ],
    options: [
      { label: '如实回答，也把自己在意的事问回去', fx: { affection: 6, mood: -1 }, result: '她听完点了点头，也在纸上记了两笔。这场相亲像一场谈判，但至少双方都在认真。' },
      { label: '「这些我现在给不了，但我在往前赚。」', fx: { affection: 9, money: 0 }, result: '她盯着你看了两秒，把纸折起来放回包里：「行，这句我信。」' },
      { label: '「你这是在挑货？」', fx: { affection: -12, mood: -3 }, result: '她笑了笑把纸收起来：「那我们没什么好聊的了。」' }
    ]
  },
  {
    id: 'x_meet_ex',
    phase: 'meeting',
    weight: 9,
    text: [
      '话题不知怎么就拐到了前任。',
      '{p}搅着杯子里的冰块：「上一段谈了四年，最后没成。」',
      '「你呢？」'
    ],
    options: [
      { label: '说点真的，但不说细节和坏话', fx: { affection: 9 }, result: '她听完说「能这么说的人不多」。这句话之后，她开始讲自己的事。' },
      { label: '「别提了，都是过去的事。」', fx: { affection: -4, mood: 1 }, result: '她「哦」了一声，低头喝了口饮料。话题就此断掉。' },
      { label: '顺便把前任骂了一顿', fx: { affection: -11, mood: -2 }, result: '她安静地听你骂完，然后说「我去下洗手间」。' }
    ]
  },
  {
    id: 'x_meet_bill',
    phase: 'meeting',
    weight: 9,
    text: [
      '服务员把账单夹放在桌子中间。',
      '{p}伸手就去拿：「我来吧，是我点的菜。」'
    ],
    options: [
      { label: '「下次我请，今天这顿我来。」（先一步把钱付了）', fx: { affection: 8, money: -300 }, result: '她拗不过你，笑着说「那下次你挑地方」。这句话里有个「下次」。' },
      { label: '「那 AA 吧，谁也不欠谁。」', fx: { affection: -5, money: -150 }, result: '她痛快地转了钱，也痛快地把关系定在了「认识一下」。' },
      { label: '「行，那你来。」（坐着没动）', fx: { affection: -9, money: 0 }, result: '她付款的时候背对着你。回来坐下时说「时间不早了」。' }
    ]
  },
  {
    id: 'x_meet_friend',
    phase: 'meeting',
    weight: 8,
    text: [
      '{p}不是一个人来的。',
      '坐在旁边的那位自我介绍：「我是来帮着把把关的。」',
      '两个人的目光同时落在你身上。'
    ],
    options: [
      { label: '正常聊天，也主动把话递给旁边那位', fx: { affection: 9, mood: 1 }, result: '陪同的那位后半程基本没说话，临走前对{p}耳语了一句。{p}笑了。' },
      { label: '全程只跟{p}说话，当旁边没人', fx: { affection: -3, mood: 0 }, result: '陪同的那位中途就低头刷手机了。走的时候，两个人一路没怎么说话。' },
      { label: '明显紧张，话变得特别多', fx: { affection: 2, mood: -3 }, result: '你说完第三个笑话才意识到，没有人笑。' }
    ]
  },
  {
    id: 'x_meet_walk',
    phase: 'meeting',
    weight: 9,
    text: [
      '吃完饭，谁都没提散场。',
      '{p}指了指街对面：「要不去那边走走？」',
      '路灯刚亮，风有点凉。'
    ],
    options: [
      { label: '把外套脱下来递过去', fx: { affection: 11, health: -2 }, result: '她犹豫了一下还是披上了，袖子太长，盖住了手。「那你冷不冷？」' },
      { label: '「好，走走。」（并肩，慢慢走）', fx: { affection: 7, mood: 3 }, result: '两个人沿着街走了很久，没说几句话，但都不觉得尴尬。' },
      { label: '「不早了，我明天还上班。」', fx: { affection: -6, mood: 1 }, result: '她「嗯」了一声，很干脆地打了车。' }
    ]
  },

  /* ---------------- 还在找对象（single） ---------------- */
  {
    id: 'x_single_aunt',
    phase: 'single',
    weight: 10,
    text: [
      '姑姑又打来电话：「我给你物色了一个，条件不错。」',
      '「你什么时候有空？我让人家加你微信。」'
    ],
    options: [
      { label: '「行，您把人推给我。」', fx: { mood: 3, money: 0 }, result: '微信通过的那一刻，你盯着对方的头像看了很久。' },
      { label: '「姑，我自己会找。」', fx: { mood: -2, family: -2 }, result: '电话那头沉默了两秒，然后是那句熟悉的「你都快三十了」。' },
      { label: '嘴上敷衍，挂了电话就把这事忘了', fx: { mood: 1 }, result: '一周后姑姑问起，你才想起来自己既没加也没回。' }
    ]
  },
  {
    id: 'x_single_app',
    phase: 'single',
    weight: 10,
    text: [
      '婚恋 App 弹了个窗：「完善资料，匹配成功率提升 3 倍！」',
      '你翻了翻自己的资料——上次改还是去年。'
    ],
    options: [
      { label: '认真填一遍，顺手买了会员', fx: { money: -299, mood: 2 }, result: '当天晚上收到十几条打招呼。你一条条看完，回了两条。' },
      { label: '只把照片换成最近拍的', fx: { money: 0, looks: 1, mood: 1 }, result: '换完照片第二天，浏览量确实涨了一些。' },
      { label: '把 App 卸载了', fx: { mood: 2 }, result: '手机清爽了，晚上也清净了。就是周末有点长。' }
    ]
  },
  {
    id: 'x_single_corner',
    phase: 'single',
    weight: 9,
    text: [
      '周末路过公园，相亲角那边围了一圈人。',
      '长椅上摆着一排 A4 纸，每一张都是一个被浓缩成条件的人。'
    ],
    options: [
      { label: '停下来认真看了看', fx: { mood: -3, career: 0 }, result: '「男，32，有房无贷，寻性格温和女。」你看完自己的同龄人，又看完了别人对你的定价。' },
      { label: '替父母抄了两条回去', fx: { family: 2, mood: -1 }, result: '回家念给爸妈听，两位老人记了一整个本子。' },
      { label: '快步走开，去跑了个十公里', fx: { health: 3, mood: 3 }, result: '跑完出汗的那一刻，你觉得这些纸上的数字都不重要了。' }
    ]
  },

  /* ---------------- 只在微信上（talking） ---------------- */
  {
    id: 'x_talk_wechat_only',
    phase: 'talking',
    weight: 11,
    text: [
      '和{p}加上微信之后，聊了快两周，还没见过面。',
      '她发来一句：「我们不会就这么一直聊下去吧？」'
    ],
    options: [
      { label: '「这周末，我请你吃饭。」', fx: { affection: 12, money: -200 }, result: '消息发出去三秒就回了：「好。」只有一个字，但是秒回。' },
      { label: '「最近确实忙，再等两周？」', fx: { affection: -8, mood: -2 }, result: '她回了个「嗯」。之后的几天，回复都变得很短。' },
      { label: '「见面干嘛，聊得不挺好吗。」', fx: { affection: -11, mood: -1 }, result: '她发了个笑脸表情，然后把话题岔开了。' }
    ]
  }
];

/* ================= 结算数值规则（FX） =================
 * 需求：
 *   1. 每个选项都会「扣取」——不再只动情绪和金钱，尽量覆盖到每个属性；
 *   2. 每个选项都有增有减——任何选择都是一次取舍，没有白嫖的选项；
 *   3. 奖励与惩罚的幅度都加大（FX_AMP），让选择真的有分量。
 * 做法：作者写的 fx 是「意图」，这里统一放大并补齐到规则要求。
 *       补齐的数值用「id + 选项序号」做种子确定性生成 ——
 *       同一个 id 每次生成的结果完全一致，不是运行时随机（结算仍然确定性）。 */
const FX_KEYS = ['money', 'health', 'career', 'looks', 'family', 'mood', 'affection'];
const FX_AMP = 2.0;        // 奖惩加倍：作者写的数值整体放大
const FX_MIN_COVER = 5;    // 每个选项至少影响几种属性
const FX_SIDE_MAX = 4;     // 「附带影响」的最大幅度（刻意比作者写的主影响小）

function fxHash(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}
function fxRnd(seedStr) {
  var x = fxHash(String(seedStr)) || 1;
  return function () {
    x ^= (x << 13); x >>>= 0;
    x ^= (x >>> 17);
    x ^= (x << 5); x >>>= 0;
    return x / 4294967296;
  };
}

/* 把作者写的 fx 加工成符合规则 1/2/3 的最终数值 */
function enrichFx(fx, seedKey) {
  var rnd = fxRnd(seedKey);
  var out = {};

  /* 1) 作者写的主影响：整体放大 */
  FX_KEYS.forEach(function (k) {
    var v = (fx && typeof fx[k] === 'number') ? fx[k] : 0;
    if (v !== 0) out[k] = Math.round(v * FX_AMP);
  });

  /* 2) 补覆盖：没写到的属性补一个小的附带影响 */
  var need = FX_MIN_COVER - Object.keys(out).length;
  var missing = FX_KEYS.filter(function (k) { return !out[k]; });
  for (var i = 0; i < missing.length && need > 0; i++, need--) {
    var mag = 1 + Math.floor(rnd() * FX_SIDE_MAX);   // 1..4
    out[missing[i]] = (rnd() < 0.5 ? mag : -mag);
  }

  /* 3) 保证「有增有减」：至少 2 项为正、2 项为负（取舍感） */
  var guard = 0;
  while (guard++ < 12) {
    var pos = [], neg = [];
    Object.keys(out).forEach(function (k) { (out[k] > 0 ? pos : neg).push(k); });
    if (pos.length >= 2 && neg.length >= 2) break;
    var free = FX_KEYS.filter(function (k) { return !out[k]; });
    if (neg.length < 2) {
      if (pos.length > 1) {
        /* 把幅度最小的正项翻负，尽量不破坏作者的主意图 */
        var p = pos.slice().sort(function (a, b) { return out[a] - out[b]; })[0];
        out[p] = -out[p];
      } else if (free.length) {
        out[free[0]] = -(1 + Math.floor(rnd() * FX_SIDE_MAX));
      } else break;
    } else if (pos.length < 2) {
      if (neg.length > 1) {
        /* 翻正最接近 0 的那个负值 */
        var n = neg.slice().sort(function (a, b) { return out[b] - out[a]; })[0];
        out[n] = -out[n];
      } else if (free.length) {
        out[free[0]] = 1 + Math.floor(rnd() * FX_SIDE_MAX);
      } else break;
    }
  }
  return out;
}

/* 扩充事件：按「结算规则 1」新写的事件（选项出人意料、全属性有增有减、奖惩加大）。
 * 单独成文件，避免把 gen-seed 撑得没法维护。 */
const MORE_EVENTS = require('./seed-more-events.js');

function buildEvents(s) {
  return s.EVENTS.concat(EXTRA_EVENTS).concat(MORE_EVENTS).map(function (e) {
    return {
      id: e.id,
      phase: e.phase,
      stage: EVENT_STAGE[e.id] || null,
      dateType: e.dateType || null,
      weight: typeof e.weight === 'number' ? e.weight : 10,
      days: typeof e.days === 'number' ? e.days : null,
      text: e.text.slice(),
      options: e.options.map(function (o, oi) {
        return {
          label: o.label,
          /* 结算数值统一过一遍规则：全属性覆盖 + 有增有减 + 奖惩加倍 */
          fx: enrichFx(o.fx || {}, e.id + '#' + oi),
          result: o.result || '',
          breakup: !!o.breakup
        };
      })
    };
  });
}

/* 补充职业（唯一真源）
 * ---------------------------------------------------------
 * 参考项目的职业池里，能用上「男 / 女头像」的职业偏少。
 * 这里补 4 个职业，让 partners 花名册里的男女都有对应的头像，
 * 职业备注（note）与头像 key（avatar）随之一并进数据库。 */
const EXTRA_JOBS = [
  { job: '急诊科医生',   money: 1.35, note: '永远在抢救，永远在熬夜',     avatar: 'doctor' },
  { job: '餐厅主厨',     money: 1.15, note: '手臂上有烫疤，说话很直',     avatar: 'chef' },
  { job: '创业公司 CEO', money: 1.80, note: '张口就是估值和赛道',         avatar: 'startup-fail' },
  { job: '国企老员工',   money: 1.00, note: '波澜不惊，等着退休',         avatar: 'older-single' }
];

/* 相亲对象花名册（唯一真源）
 * ---------------------------------------------------------
 * 参考项目里对象是「从素材池随机拼装」出来的（姓名/职业/颜值全靠 Math.random），
 * 本工程按需求改成固定花名册：一人一条记录进 partners 集合，
 * 基本信息（姓名 / 性别 / 年龄 / 职业）与头像（avatar）都由数据库提供，
 * 运行时只做「按性别筛选 + 加权抽取 + 补水」，不再随机造人。
 * 同时这张花名册是「相亲图鉴」的数据基础：遇见谁就解锁谁。
 *
 * 字段说明：
 *   id/name/gender/age/job   基本信息（job 必须能在 materials.jobs 里查到备注）
 *   avatar                   头像 key → assets/images/role/<avatar>-<性别>.png
 *   look/hobby/place         外形 / 爱好 / 认识方式（自我介绍用）
 *   trait/condition          性格与家庭条件（名字必须能在 materials 里查到）
 *   personalityId            人格（对应 personalities 集合的 id）
 *   looks/family             颜值 / 家境数值
 *   first                    眼缘：见面时的初始好感偏移（替代原来的随机项）
 *   weight                   抽取权重（越大越常见）
 *   tagline                  图鉴里的一句话简介
 */
const PARTNER_ROSTER = [
  /* ---------------- 女生 ---------------- */
  {
    id: 'p_f01', name: '林晚晴', gender: 'f', age: 27, job: '小学老师', avatar: 'teacher',
    look: '笑起来眼睛弯弯的', trait: '温柔', condition: '本地有房', hobby: '看书', place: '亲戚介绍的',
    personalityId: 'emo', looks: 74, family: 62, first: 6, weight: 12,
    tagline: '带完一届学生，终于有空谈恋爱了'
  },
  {
    id: 'p_f02', name: '苏念', gender: 'f', age: 25, job: '三甲医院护士', avatar: 'nurse',
    look: '皮肤很白，不太爱说话', trait: '顾家', condition: '外地打拼', hobby: '瑜伽', place: '同事牵线搭桥的',
    personalityId: 'family', looks: 71, family: 38, first: 2, weight: 11,
    tagline: '刚下夜班，眼圈有点青'
  },
  {
    id: 'p_f03', name: '陈嘉宜', gender: 'f', age: 29, job: '银行柜员', avatar: 'accountant',
    look: '戴一副细框眼镜，很斯文', trait: '务实', condition: '有房贷', hobby: '打游戏', place: '婚恋 App 上划到的',
    personalityId: 'money', looks: 68, family: 55, first: 0, weight: 11,
    tagline: '白天数别人的钱，晚上数自己的'
  },
  {
    id: 'p_f04', name: '江雨欣', gender: 'f', age: 26, job: '互联网产品经理', avatar: 'programmer',
    look: '短发利落，说话时手势很多', trait: '事业心强', condition: '外地打拼', hobby: '跑步', place: '同学会上重逢的',
    personalityId: 'career', looks: 76, family: 47, first: 4, weight: 12,
    tagline: '需求评审比相亲还难'
  },
  {
    id: 'p_f05', name: '沈书瑶', gender: 'f', age: 24, job: '在读博士', avatar: 'anime',
    look: '长相普通，但越看越耐看', trait: '敏感', condition: '家境普通', hobby: '逛展', place: '兴趣小组里聊起来的',
    personalityId: 'emo', looks: 63, family: 41, first: -2, weight: 10,
    tagline: '实验室的灯，比家里的亮'
  },
  {
    id: 'p_f06', name: '顾清越', gender: 'f', age: 30, job: '设计师', avatar: 'artsy',
    look: '穿着很讲究，看得出花了心思', trait: '强势', condition: '家境优渥', hobby: '摄影', place: '朋友聚会上认识的',
    personalityId: 'char', looks: 79, family: 78, first: 1, weight: 11,
    tagline: '审美是一道过不去的坎'
  },
  {
    id: 'p_f07', name: '何知意', gender: 'f', age: 28, job: '公务员', avatar: 'civil-servant',
    look: '话不多，眼神很稳', trait: '顾家', condition: '本地有房', hobby: '爬山', place: '父母在公园相亲角「淘」来的',
    personalityId: 'family', looks: 70, family: 66, first: 3, weight: 11,
    tagline: '稳定是最大的优点，也是全部'
  },
  {
    id: 'p_f08', name: '温言', gender: 'f', age: 27, job: '中学教师', avatar: 'teacher',
    look: '有点像你高中时喜欢过的那个人', trait: '直球', condition: '本地有房', hobby: '看电影', place: '亲戚介绍的',
    personalityId: 'char', looks: 75, family: 60, first: 5, weight: 12,
    tagline: '会习惯性纠正你的用词'
  },
  {
    id: 'p_f09', name: '白露', gender: 'f', age: 26, job: '广告公司文案', avatar: 'artsy',
    look: '个子很高，站在人群里很好找', trait: '浪漫', condition: '家境普通', hobby: '看livehouse演出', place: '朋友聚会上认识的',
    personalityId: 'casual', looks: 77, family: 44, first: 0, weight: 11,
    tagline: '文案写得漂亮，日子过得潦草'
  },
  {
    id: 'p_f10', name: '夏知许', gender: 'f', age: 31, job: '销售经理', avatar: 'wealthy',
    look: '妆容精致，气场很足', trait: '强势', condition: '家境优渥', hobby: '自驾游', place: '婚恋 App 上划到的',
    personalityId: 'money', looks: 82, family: 84, first: -3, weight: 12,
    tagline: '太会说话了，你有时分不清真假'
  },
  {
    id: 'p_f11', name: '叶轻舟', gender: 'f', age: 28, job: '开咖啡馆的', avatar: 'artsy',
    look: '身上有咖啡味，和一点疲惫', trait: '温柔', condition: '单亲家庭', hobby: '咖啡', place: '兴趣小组里聊起来的',
    personalityId: 'family', looks: 73, family: 39, first: 2, weight: 10,
    tagline: '把店开成了家，把家过成了店'
  },
  {
    id: 'p_f12', name: '罗一帆', gender: 'f', age: 32, job: '急诊科医生', avatar: 'doctor',
    look: '眼神很稳，像见惯了大事', trait: '顾家', condition: '本地有房', hobby: '做饭', place: '同事牵线搭桥的',
    personalityId: 'char', looks: 69, family: 64, first: 1, weight: 10,
    tagline: '永远在抢救，永远在熬夜'
  },

  /* ---------------- 男生 ---------------- */
  {
    id: 'p_m01', name: '陈亦舟', gender: 'm', age: 29, job: '互联网产品经理', avatar: 'programmer',
    look: '个子很高，站在人群里很好找', trait: '事业心强', condition: '外地打拼', hobby: '跑步', place: '同学会上重逢的',
    personalityId: 'career', looks: 73, family: 45, first: 3, weight: 12,
    tagline: '会画原型图，也画人生规划'
  },
  {
    id: 'p_m02', name: '顾停云', gender: 'm', age: 31, job: '公务员', avatar: 'civil-servant',
    look: '说话滴水不漏，像一份标准答案', trait: '务实', condition: '本地有房', hobby: '打羽毛球', place: '父母在公园相亲角「淘」来的',
    personalityId: 'family', looks: 68, family: 63, first: 2, weight: 11,
    tagline: '稳定，是相亲市场里的硬通货'
  },
  {
    id: 'p_m03', name: '周牧野', gender: 'm', age: 27, job: '健身教练', avatar: 'coach',
    look: '肩膀很宽，走路带风', trait: '直球', condition: '外地打拼', hobby: '爬山', place: '朋友聚会上认识的',
    personalityId: 'char', looks: 81, family: 40, first: 6, weight: 11,
    tagline: '朋友圈全是自律语录'
  },
  {
    id: 'p_m04', name: '沈屿', gender: 'm', age: 30, job: '自由摄影师', avatar: 'photographer',
    look: '话不多，但眼睛很亮', trait: '浪漫', condition: '家境普通', hobby: '摄影', place: '兴趣小组里聊起来的',
    personalityId: 'casual', looks: 72, family: 42, first: 1, weight: 11,
    tagline: '收入不稳定，但眼里有光'
  },
  {
    id: 'p_m05', name: '江淮', gender: 'm', age: 33, job: '销售经理', avatar: 'wealthy',
    look: '西装笔挺，笑起来很熟练', trait: '强势', condition: '家境优渥', hobby: '自驾游', place: '婚恋 App 上划到的',
    personalityId: 'money', looks: 74, family: 86, first: -3, weight: 12,
    tagline: '太会说话了，你分不清哪句是真的'
  },
  {
    id: 'p_m06', name: '陆则', gender: 'm', age: 28, job: '急诊科医生', avatar: 'doctor',
    look: '眼下有淡青，站姿却很稳', trait: '顾家', condition: '本地有房', hobby: '做饭', place: '同事牵线搭桥的',
    personalityId: 'family', looks: 70, family: 61, first: 2, weight: 10,
    tagline: '值班表比恋爱日历还满'
  },
  {
    id: 'p_m07', name: '温既白', gender: 'm', age: 26, job: '广告公司文案', avatar: 'artsy',
    look: '笑起来眼睛弯弯的', trait: '敏感', condition: '家境普通', hobby: '看电影', place: '同学会上重逢的',
    personalityId: 'emo', looks: 71, family: 43, first: 0, weight: 10,
    tagline: '嘴很毒，观察力惊人'
  },
  {
    id: 'p_m08', name: '秦朗', gender: 'm', age: 32, job: '餐厅主厨', avatar: 'chef',
    look: '手臂上有烫疤，说话很直', trait: '爱玩', condition: '单亲家庭', hobby: '做饭', place: '亲戚介绍的',
    personalityId: 'char', looks: 66, family: 44, first: -1, weight: 9,
    tagline: '火候拿捏得很好，人生搞得很糟'
  },
  {
    id: 'p_m09', name: '韩序', gender: 'm', age: 27, job: '程序员', avatar: 'programmer',
    look: '戴一副细框眼镜，很斯文', trait: '话少', condition: '有房贷', hobby: '打游戏', place: '婚恋 App 上划到的',
    personalityId: 'money', looks: 69, family: 52, first: 0, weight: 12,
    tagline: '话不多，说到技术会突然兴奋'
  },
  {
    id: 'p_m10', name: '白砚', gender: 'm', age: 35, job: '创业公司 CEO', avatar: 'startup-fail',
    look: '衬衫皱了，领带却系得很正', trait: '事业心强', condition: '外地打拼', hobby: '咖啡', place: '朋友聚会上认识的',
    personalityId: 'career', looks: 72, family: 70, first: -2, weight: 10,
    tagline: '张口就是估值和赛道'
  },
  {
    id: 'p_m11', name: '邵一鸣', gender: 'm', age: 29, job: '设计师', avatar: 'artsy',
    look: '穿着很讲究，看得出花了心思', trait: '强势', condition: '家境优渥', hobby: '逛展', place: '兴趣小组里聊起来的',
    personalityId: 'char', looks: 76, family: 76, first: 0, weight: 11,
    tagline: '审美很好，也很挑剔'
  },
  {
    id: 'p_m12', name: '贺远', gender: 'm', age: 34, job: '国企老员工', avatar: 'older-single',
    look: '不太说话，保温杯不离手', trait: '顾家', condition: '本地有房', hobby: '养猫', place: '父母在公园相亲角「淘」来的',
    personalityId: 'family', looks: 61, family: 58, first: 1, weight: 9,
    tagline: '波澜不惊，等着退休'
  }
];

function buildPartners() {
  return PARTNER_ROSTER.map(function (p) {
    return {
      id: p.id,
      name: p.name,
      gender: p.gender,
      age: p.age,
      job: p.job,
      avatar: (ROLE_MAP.job && ROLE_MAP.job[p.job]) || p.avatar || null,
      look: p.look,
      trait: p.trait,
      condition: p.condition,
      hobby: p.hobby,
      place: p.place,
      personalityId: p.personalityId,
      looks: p.looks,
      family: p.family,
      first: p.first,
      weight: p.weight,
      tagline: p.tagline
    };
  });
}

function buildMaterials(s) {
  return {
    id: 'partner_materials',
    namePool: s.NAME_POOL,
    /* 每个职业带上头像 key（对应 assets/images/role/<avatar>-<性别>.png），
     * 由 role-map.js 的 job 表注入——运行时 art.partnerImg() 读这里。
     * 末尾追加 EXTRA_JOBS（让男女都有对应头像）。 */
    jobs: s.PARTNER_JOBS.map(function (j) {
      return {
        job: j.job,
        money: j.money,
        note: j.note,
        avatar: (ROLE_MAP.job && ROLE_MAP.job[j.job]) || null
      };
    }).concat(EXTRA_JOBS.map(function (j) {
      return { job: j.job, money: j.money, note: j.note, avatar: j.avatar };
    })),
    traits: s.PARTNER_TRAITS,
    conditions: s.PARTNER_CONDITIONS,
    looks: s.PARTNER_LOOKS,
    places: s.MEET_PLACES,
    hobbies: s.HOBBIES,
    meetPlaces: s.MEET_PLACE_LIST
  };
}

/* ---------------------------------------------------------
 * 6. 界面文案：全部从数据库读取，渲染层不写死任何中文
 * ------------------------------------------------------- */
function buildTexts(s) {
  return [
    {
      id: 'app',
      value: {
        title: '相亲模拟器',
        sub: '一场关于婚姻、存款与自我的文字肉鸽',
        tag: '每个选择，都是一天',
        start: '开始游戏',
        gallery: '相亲图鉴',
        rules: '玩法说明'
      }
    },
    {
      id: 'intro',
      value: [
        ['「喂，妈。」', false],
        ['「吃了吗？」', false],
        ['「吃了。」', false],
        ['「穿暖点，明天降温。」', false],
        ['「嗯，知道了。」', false],
        ['「……那个，有对象没？」', true],
        ['「……」', true],
        ['「你张阿姨家闺女，比你小两岁，在银行上班——」', false],
        ['「妈，我在忙，先挂了。」', true],
        ['这是你今年第 47 次挂掉这个电话。', true],
        ['而明天，又是新的一天。', true]
      ]
    },
    {
      id: 'intro_ui',
      value: { skip: '跳过 ▸', next: '继续' }
    },
    {
      id: 'rules',
      value: {
        head: '玩法说明',
        sub: '文字肉鸽 · 每天一个行动',
        back: '返回',
        lines: [
          '· 开局设定性别、出身背景、人生目标与难度。',
          '· 七项指标：存款、好感度、健康、事业、颜值、家境、情绪。',
          '· 每天只能做一件事：过日子、提升自己、寻找相亲机会、加班挣钱，或经营关系。',
          '· 每回合 20% 概率触发随机事件：生活时不时会替你做出安排。',
          '· 每 30 天发薪日：按职业的月收入/支出结算，事业越高收入越多。',
          '· 时间真的会流逝：健身 +30 天、寻找机会失败 +10 天、相亲接触 +7 天……',
          '· 社畜只能周末约会：选了「社畜」背景，工作日约会要等到周末。',
          '· 相亲见面可选交往风格（涨好感/翻车风险各不相同），约会开销按性别区分。',
          '· 相亲是交往事件：对方会抛出难题，你的反应会大幅升降好感，选错甚至直接分手。',
          '· 相亲对象来自固定的花名册（数据库），遇见过的会收进「相亲图鉴」，这一局不再重复。',
          '· 数值结算不随机浮动：事件写涨多少就涨多少，看到的数字就是实际数字。',
          '· 好感度归零会关系破裂（情绪 −30）；存款/健康/事业/情绪归零则游戏结束。',
          '· 找对象期限：需要结婚/恋爱的人生目标，若在期限内仍单身，会被父母安排匆忙相亲结婚。',
          '· 达成目标即为胜利；超过年限，时间会替你收场。'
        ]
      }
    },
    {
      id: 'setup',
      value: {
        genderHead: '请选择你的性别',
        genderSub: '决定相亲对象的性别与部分剧情措辞。',
        genderOptions: [
          { id: 'm', label: '男' },
          { id: 'f', label: '女' }
        ],
        genderMale: '男 · 你的形象',
        genderFemale: '女 · 你的形象',
        reroll: '换个形象',
        bgHead: '选择出身背景',
        bgSub: '背景决定全部初始属性与职业（社畜 / 弹性 / 自由职业）。',
        goalHead: '设定人生目标',
        goalSub: '达成它即为胜利。',
        diffHead: '选择难度',
        diffSub: '普通难度通关率约 20%。',
        diffMeta: '找对象期限：{days} 天内（到期仍单身会被安排结婚）',
        begin: '开始这段人生',
        confirm: '确认',
        backGender: '← 重选性别',
        backBg: '← 重选背景',
        backGoal: '← 重选目标',
        statsLine: '存款 {money} · 健康 {health} · 事业 {career} · 颜值 {looks} · 家境 {family} · 情绪 {mood} · {job}',
        incomeLine: '月收入 {income} · 月支出 {expense}'
      }
    },
    {
      id: 'rel_names',
      value: {
        single: '单身',
        meeting: '初次见面',
        talking: '接触中',
        dating: '恋爱中',
        married: '已婚'
      }
    },
    {
      id: 'stat_defs',
      /* 主界面属性区 = 三行 × 每行两条（money/health → career/looks → family/mood），
       * 排列顺序就是这里的数组顺序，改顺序等同于改排版。
       * affection 标了 slot，不占格子，改在对象（含待见面的人）头像正下方显示 ——
       * 它的 max 是「动态值」：恋爱前后上限不同（见 AFFECTION_CAP_* 常量），
       * 渲染层按 engine.affectionCap() 取当前上限画条，这里写的是单身期的刻度。 */
      value: [
        { key: 'money', label: '存款', color: '#d99b2b', max: 500000, format: 'money' },
        /* slot = 展示位。标了 slot 的属性不在主界面属性条里重复展示，
         * 而是挪到该位置：partnerHeader → 相亲对象头像正下方（聊天框里有人就显示，
         * 包括「已相到人、还没赴约」）。「近期变化」页仍然七项一起摆，方便总览。 */
        { key: 'affection', label: '好感度', color: '#d9536f', max: 100, format: 'int', slot: 'partnerHeader' },
        { key: 'health', label: '健康', color: '#3fa66a', max: 100, format: 'int' },
        { key: 'career', label: '事业', color: '#4a7fd4', max: 100, format: 'int' },
        { key: 'looks', label: '颜值', color: '#a86fd0', max: 100, format: 'int' },
        { key: 'family', label: '家境', color: '#c98a3c', max: 100, format: 'int' },
        { key: 'mood', label: '情绪', color: '#4bb3ac', max: 100, format: 'int' }
      ]
    },
    {
      id: 'play',
      value: {
        dayLeft: '剩余 {n} 天',
        restart: '重开',
        goalLine: '{diff}难度 · 目标：{goal}　{job}',
        financeLine: '本月收支 · 收入 +{income}（基本 {base} + 事业加成 {bonus}）· 支出 −{expense} · 净 {net}',
        deadline: '⏳ 找对象倒计时：{streak} / {limit} 天{hint} · 剩 {remain} 天',
        deadlinePaused: ' · 已确定关系（倒计时暂停）',
        deadlineTalking: ' · 接触中（倒计时暂停）',
        deadlineMeeting: ' · 初遇中（倒计时暂停）',
        deadlineLead: ' · 已相到人，待赴约（倒计时暂停）',
        deadlineSingle: ' · 仍单身（正在走表）',
        resolvedPickTitle: '你的选择',
        resolvedResultTitle: '结果',
        you: '你',
        noPartner: '暂无对象',
        noPartnerSub: '先去找机会',
        leadTag: '待见面',
        actionTitle: '今天想做什么？',
        actionNote: '先选一个方向，进去再挑具体安排',
        confirm: '确认',
        seekTitle: '寻找相亲机会',
        seekSub: '托人介绍 / 婚恋 App / 红娘 · 花钱碰运气',
        /* 二级页（点进来之后的整页）：头部背景图 + 该方向下的全部操作 */
        seekPageTitle: '寻找相亲机会',
        seekPageSub: '把范围收窄到「找对象」这一件事上',
        seekPageTitlePartner: '和{name}的事',
        seekPageSubPartner: '约会 / 表白 / 求婚 / 分手，都在这儿',
        upgradePageTitle: '其余安排',
        upgradePageSub: '把自己经营好，也是一条路',
        otherSub: '过日子 / 提升自己 / 加班挣钱 / 休息一天',
        meetTitle: '赴约初遇 · 见 {name}',
        meetSub: '初次见面 · 约 {days} 天 · 见面可选交往风格',
        dateTitle: '约会 · 约{name}出来',
        dateSub: '简单 / 正式 / 活动三档 · 花钱',
        dateTitleMarried: '约会 · 和{name}约会',
        confessTitle: '向{name}告白',
        confessSub: '成功率约 {pct}% · {days} 天',
        breakupTitle: '算了，不再联系',
        breakupTitle2: '提出分手',
        breakupSub: '结束关系 · 情绪会大幅下降',
        proposeTitle: '向{name}求婚',
        proposeSub: '成功率约 {pct}% · 婚礼 {cost} · {days} 天',
        /* 恋爱后的感情还没养到能开口的程度：直接告诉玩家还差多少 */
        proposeSubWait: '感情还不够 ⚠ 当前 {cur} / {cap}，再相处攒够 {need} 点才谈得下去',
        childTitle: '准备要个孩子',
        childSubOk: '花销 {cost} · {days} 天 · 达成「{goal}」',
        childSubNo: '需要好感度 ≥ {min}',
        childDone: '你们已经有了孩子。日子还在继续。',
        otherTitle: '其余安排',
        lifeTitle: '过日子',
        lifeSub: '随机生活 / 工作 / 人情世故事件 · 约 2 天',
        improveTitle: '提升自己',
        improveSub: '健身 / 美容 / 学习 / 情绪疗愈 · 约 6 天，部分更久',
        overtimeTitle: '加班挣钱',
        overtimeSub: '工资 +、事业 +、健康 −；谈着恋爱时对象好感会掉',
        restTitle: '休息一天',
        restSub: '恢复情绪与健康 · 1 天',
        restWorker: ' · 工作日会扣工资',
        seekMenuTitle: '选择渠道',
        seekMeta: '{cost} · 成功率 {pct}%　{sub}',
        dateMenuTitle: '约{name}出来（见面可选交往风格）',
        datePageTitle: '和{name}约会',
        datePageSub: '先挑一个档位，下一步再定这次见面的交往风格',
        dateMeta: '{cost} · {label} · 好感收益 ×{mult}',
        dateWarn: '　⚠ 社畜需等到 {day}',
        styleTitle: '选择这次见面的交往风格',
        styleOverlayHint: '点一次选中，再点一次取消；列表可上下滑动，确认后才出发',
        styleMeta: '好感增益 ×{aff} · 翻车概率 {risk}%{more}',
        styleSeeMore: ' · 能看穿对方',
        back: '← 返回',
        continueDay: '继续 · 时间过去 {n} 天',
        costLine: '花销 −{v}',
        logTitle: '— 近期经历 —',
        restResultTitle: '你休息了一天',
        restLines: ['关掉手机，睡到自然醒，给自己做了顿饭。', '紧绷了太久，偶尔停下来，也是一种前进。'],
        restPenalty: '你是{job}，工作日躺平休息，被扣了工资和绩效。',
        improvePenalty: '你是{job}，工作日摸鱼/休息被记了一笔——工资和绩效都掉了。',
        randomIntro: '（随机事件）这一天，生活忽然给你出了道题。',
        affDropHint: '这次相处不太愉快，好感度大幅下滑。',
        confirmRestart: '确定放弃当前人生，重新开始？',
        confirmYes: '确定，重开一局',
        confirmNo: '取消',
        logRest: '休息了一天',
        logSeekOk: '通过{ch}认识了人',
        logSeekFail: '{ch}：没有合适的',
        logStyle: '以「{style}」的姿态行动',
        logConfessOk: '告白成功',
        logConfessBreak: '告白被拒·分手',
        logConfessZero: '告白被拒·好感清零',
        logMarry: '结婚了',
        logProposeFail: '求婚被拒',
        logProposeBreak: '求婚被拒·分手',
        logBreakup: '结束了上一段关系',
        logChildOk: '孩子出生了',
        logChildWait: '提了生子，对方还想再等等',
        logOvertime: '加班挣钱 +{v}',
        logPayday: '发薪日 净{v}',
        logGrace: '找对象宽限 +{n} 天',
        logCooldown: '分手冷却期 {n} 天（倒计时 +{n}）',
        paydayFlash: '📅 第 {day} 天 · 发薪日：收入 +{income}（基本 {base} + 事业加成 {bonus}）· 支出 −{expense} · 净 {net}',
        graceFlash: '⏳ {reason}，找对象宽限 +{n} 天',
        cooldownFlash: '💔 分手冷却期：你们相处了 {together} 天，需要缓 {days} 天 —— 找对象倒计时直接 +{days} 天',
        childWaitTitle: '还需要一点时间',
        childWaitLines: [
          '你试探着提了一句，{p}没有接话。',
          '过了一会儿她说：「再等等吧，我觉得我们还没到那个时候。」',
          '好感度达到 {min} 时，她才会认真考虑这件事。'
        ],
        overtimeTitleResult: '加班挣钱',
        overtimeLines: ['你又接了一摊活，连加了三天班。', '银行卡余额实实在在多了一截，黑眼圈也多了一截。'],
        overtimeAffLine: '{p}发来消息：「你最近好像特别忙。」你盯着屏幕，不知道怎么回。',
        encounter_title: '意外认识了一个人',
        encounter_intro: '本以为只是普通的一天，却在角落里多了一次搭话。',
        encounter_tail: '你们交换了联系方式。之后可以在「赴约初遇」里约她出来。',
        encounter_life: '生活琐事的间隙，你顺手帮了旁边的人一个小忙。',
        encounter_improve: '提升自己的路上，你遇到了一个同样在努力的人。',
        encounter_rest: '难得放松的一天，你在街角遇见了一个陌生人。',
        encounter_overtime: '加班到深夜，写字楼里还有另一个没走的人。',
        profileTap: '点头像看资料',
        /* 入口在主角头像上，所以提示必须贴着头像说，不能再说「点属性条」 */
        statTap: '点头像看属性变化',
        recentTap: '↓ 点开看事件 / 选择 / 结果',
        chatTitle: '微信闲聊',
        chatSub: '和{name}聊几句，只影响好感度与情绪',
        /* 已经相到人、还没赴约时的入口：先隔着屏幕认识一下 */
        chatSubLead: '还没见面 · 先在微信上和{name}聊几句',
        galleryEntry: '相亲图鉴',
        recentEmpty: '还没有什么经历，先去做一件事吧。'
      }
    },
    {
      id: 'end',
      value: {
        days: '坚持天数',
        money: '最终存款',
        health: '健康',
        career: '事业',
        looks: '颜值',
        family: '家境',
        mood: '情绪',
        goal: '人生目标',
        /* —— 结局页「看广告领奖励 · 再开一局」——
         * 两个入口并行、玩家自己选（微信不允许把广告当强制门槛）：
         *   againAd 看完广告再开（副标题 adHint 说明给什么、不看也能开）
         *   again   不看广告直接开
         * 奖励数值在 constants 的 AD_REWARD_*，这里只管文案。 */
        again: '直接再开一局',
        againAd: '看广告 · +{money}',
        adHint: '看完广告，下一局开局多 {money}；不看也能直接开',
        adLoading: '广告加载中…',
        adNotReady: '广告还没准备好，可以先直接开新一局',
        adAbort: '广告没看完，奖励没拿到',
        adRewardFlash: '广告奖励到账：存款 +{money}',
        home: '回到标题',
        winPrefix: '达成目标：',
        reasonTitle: '为什么',
        /* 结局页头部背景图（assets/images/end/end_<art>_<性别>.jpg）上压的小标签 */
        headTag: '人生结局',
        reasons: {
          win: '目标「{goal}」达成，最终进度 {progress}%，用了 {day} 天。',
          broke: '第 {day} 天存款见底，生活先于感情撑不住了。',
          sick: '第 {day} 天健康见底，身体先替你按下了停止键。',
          jobless: '第 {day} 天事业归零，工作没了，相亲的底气也没了。',
          depressed: '第 {day} 天情绪见底，你不想再勉强自己了。',
          deadline: '第 {day} 天，相亲期限到了：单身 {streak} 天没谈成，父母安排的相亲期限只有 {limit} 天，「{goal}」的进度停在 {progress}%。',
          timeout: '时间用完了，「{goal}」的进度停在 {progress}%，这一生就这样走到了头。',
          unknown: '这一局就这样结束了。'
        }
      }
    },
    {
      id: 'loading',
      value: {
        loading: '正在载入人生……',
        failTitle: '数据载入失败',
        failMsg: '无法连接游戏数据库，请检查网络后重试。',
        retry: '重试'
      }
    },
    {
      id: 'profile',
      value: {
        title: '对方资料',
        back: '返回',
        empty: '现在还没有对象。先去「寻找相亲机会」认识一个人吧。',
        age: '年龄', job: '职业', trait: '性格', personality: '人格',
        condition: '家庭', look: '外形', hobby: '爱好', place: '认识方式',
        looks: '颜值', family: '家境', affection: '好感度',
        leadHint: '还没见面 —— 可以先在「微信闲聊」里聊几句攒印象，准备好就去「赴约初遇」。'
      }
    },
    {
      id: 'statlog',
      value: {
        title: '近期变化',
        back: '返回',
        currentTitle: '当前状态',
        sessionTitle: '本次结算（第 {day} 天）',
        dayTitle: '第 {day} 天',
        totalTitle: '近期合计（近 {n} 天）',
        empty: '还没有可展示的变化。做完一件事再回来看吧。',
        hint: '每天先看关键事件，再看七项属性各自「从多少变成多少」。',
        eventTitle: '关键事件',
        fromTo: '{label}：从 {from} 变为 {to}',
        noEvent: '（这一天没有记录到关键事件）'
      }
    },
    {
      id: 'envelope',
      value: {
        title: '对象信息',
        badge: '相亲机会',
        costTitle: '花销',
        name: '姓名',
        job: '职业',
        trait: '性格',
        family: '家庭',
        condition: '条件',
        age: '{n}岁',
        extra: '颜值 {looks} · 家境 {family} · 平时喜欢{hobby}',
        place: '认识方式：{place}',
        hint: '往下看介绍，之后可以去「赴约初遇」把 TA 约出来。'
      }
    },
    {
      id: 'recent',
      value: {
        title: '近期经历',
        back: '返回',
        empty: '还没有什么经历，先去做一件事吧。',
        hint: '只保留最近几次，按时间倒序：先看事件，再看你的选择与结果。',
        dayTitle: '第 {day} 天',
        eventTitle: '事件',
        optionTitle: '你的选择',
        resultTitle: '结果'
      }
    },
    {
      id: 'chat',
      value: {
        title: '微信闲聊',
        back: '返回',
        send: '发送',
        finish: '结束闲聊 · 进入下一天',
        me: '我',
        hint: '选一句回过去（只影响好感度与情绪）',
        waitReply: '对方正在输入…',
        empty: '现在还没有可以闲聊的人。',
        deltaTitle: '这次闲聊',
        replyTitle: '对方的回应',
        /* 对方主动发来的那一次（会占掉一整天，所以没有「返回」） */
        proactiveTag: '对方主动发来了消息',
        /* 灵魂拷问 / 暧昧事件：标一下这次的调性 */
        kindGrill: '灵魂拷问 · 答不好会很难收场',
        kindFlirt: '暧昧时刻 · 接住了关系会升温',
        verdictGood: '答到点子上了',
        verdictBad: '这话说得不太妙',
        /* 被「必须出门约会」锁住时 */
        lockedTitle: '微信闲聊',
        lockedSub: '对方想当面聊，先约一次会',
        lockedLine: '我们还是多当面接触吧',
        lockedHint: '先约 TA 出来见一面，之后想聊再聊。',
        /* 对方在，但当前阶段一条可聊的题都没有（chats 数据缺失）：
         * 不把玩家丢进空白页，给一句能看懂的话 + 回主界面的按钮 */
        emptyLine: '（翻了一遍聊天记录，好像没有什么可接的话）',
        emptyHint: '先回去安排点别的，回头再聊。',
        /* 固定剧情聊完后的提示 */
        mustDateNotice: '对方把话说开了 —— 接下来得当面见一面，微信先放一放。',
        /* 微信已经聊够次数：入口上先把话说明白，别让玩家一头雾水地被锁住 */
        mustDateSoon: '微信聊得够多了（{n}/{thr}）· 下一次就该约见面了'
      }
    },
    {
      id: 'gallery',
      value: {
        title: '相亲图鉴',
        sub: '至今为止遇见过的人，都记在这里',
        entry: '相亲图鉴',
        tabFemale: '女生',
        tabMale: '男生',
        unlockedCount: '已解锁 {n} / {total}',
        locked: '未解锁',
        lockedName: '？？？',
        back: '返回',
        empty: '这个性别还没有登记相亲对象。',
        noneMet: '还没有遇见过谁，先去「寻找相亲机会」吧。',
        tapHint: '点已解锁的卡片，看 TA 的详细资料',
        detailTitle: '图鉴资料',
        progressTitle: '达成的进展',
        peakAff: '好感度峰值 {n}',
        firstDay: '首次遇见 · 第 {day} 天',
        lastDay: '最近见面 · 第 {day} 天',
        notMet: '还没解锁',
        child: '已有孩子',
        stages: {
          met: '已遇见',
          meeting: '初次见面',
          talking: '接触中',
          dating: '恋爱中',
          married: '已结婚'
        },
        age: '{n}岁',
        job: '职业',
        trait: '性格',
        condition: '家庭',
        look: '外形',
        hobby: '爱好',
        place: '认识方式',
        personality: '人格',
        looks: '颜值',
        family: '家境',
        tagline: '一句话'
      }
    },
    {
      id: 'narratives',
      value: {
        find_fail: {
          title: '暂时没有合适的',
          lines: [
            '钱花出去了，回应却寥寥。',
            '介绍人说：「再等等，有合适的我第一时间想到你。」',
            '你知道这句话通常是什么意思。'
          ]
        },
        find_ok: {
          title: '有了新的相亲机会',
          tail: [
            '介绍人说对方愿意见一面，时间就定在这两天。',
            '你存下了联系方式，开始琢磨见面该穿什么。'
          ]
        },
        partner_desc: [
          '【{name}】{age}岁 · {job}',
          '{look}。{jobNote}。',
          '性格：{trait}——{traitDesc}',
          '家庭：{condition}——{conditionDesc}',
          '条件：颜值 {looks} · 家境 {family} · 平时喜欢{hobby}',
          '认识方式：{place}'
        ],
        meet_ok: {
          title: '她说，下次可以再约',
          lines: [
            '告别的时候，她主动说了句「今天挺开心的」。',
            '你走出很远才敢回头看了一眼。',
            '这段关系，算是正式开始了。'
          ]
        },
        meet_fail: {
          title: '没有下文了',
          lines: [
            '告别时说的那句「回头联系」，你们都知道是客套。',
            '消息从当天晚上开始变少，第三天彻底安静下来。',
            '你删掉了对话框，假装这件事没发生过。',
            '满怀期待又落空——情绪大幅下滑。'
          ]
        },
        confess_ok: {
          title: '她答应了',
          lines: [
            '你说出口的时候，声音比想象中稳。',
            '{p}低着头笑了一下，然后点了点头。',
            '回去的路上你走得很慢，觉得这座城市忽然亮了一点。'
          ]
        },
        confess_fail_break: {
          title: '被婉拒了 · 关系结束',
          lines: [
            '{p}沉默了几秒，说：「你很好，但我现在还没想好。」',
            '你们都知道这句话的意思。',
            '那天晚上，你们之间的消息从每天几十条，变成了零。',
            '这次告白，成了这段关系的句号。'
          ]
        },
        confess_fail_zero: {
          title: '被婉拒了 · 好感清零',
          lines: [
            '{p}沉默了几秒，说：「我还没准备好，再给我一点时间。」',
            '话虽如此，你们之间好不容易攒下的好感，一夜之间回到了原点。',
            '你们没有分开，但一切都要重新开始了。'
          ]
        },
        propose_ok: {
          title: '你们结婚了',
          lines: [
            '戒指是从商场买的，不大，但你挑了很久。',
            '{p}说：「你求婚词也太普通了。」然后哭了。',
            '宴席办了二十桌，你敬酒敬到腿软，但一直笑着。'
          ]
        },
        propose_fail: {
          title: '她没有答应',
          lines: [
            '{p}把戒指推了回来，说：「我觉得我们还没准备好。」',
            '你想问那要等到什么时候，但最终没有开口。',
            '有些东西一旦被拒绝过一次，就很难再有第二次。'
          ]
        },
        propose_fail_break: {
          title: '被拒之后 · 关系结束',
          lines: [
            '{p}把戒指推了回来，说：「我觉得我们还没准备好。」',
            '你想问那要等到什么时候，但最终没有开口。',
            '有些东西一旦被拒绝过一次，就很难再有第二次。',
            '那枚戒指后来一直放在抽屉里。你们谁也没再提这件事，然后就没有然后了。'
          ]
        },
        propose_break_reason: '求婚被拒之后，两个人都不知道该怎么继续。',
        breakup: {
          title: '这段关系结束了',
          lines: [
            '和{name}的最后一次见面，你们说了很多客气话。',
            '{reason}',
            '回家路上你买了瓶水，忽然不知道今晚该跟谁说话。',
            '情绪值大幅下降——接下来的一段时间，你什么都不想做。'
          ]
        },
        /* 分手情绪分档说明：明确展示「为什么扣这么多」 */
        breakup_basis: '这段感情你们走了 {days} 天——时间越久，抽身越疼。',
        breakup_spent: '你为它前后花掉了 {spent}，不是小数目。',
        breakup_tier_zero: '投入这么深，一朝散场，情绪直接被掏空（{from} → {to}）。',
        breakup_tier_set: '投入不算小，心气也跟着掉了，情绪被压到了 {to}（{from} → {to}）。',
        breakup_tier_ratio: '虽然时间不长、花得也不多，但分手终究是伤人的，情绪折掉一半（{from} → {to}）。',
        breakup_mood_change: '情绪值 {from} → {to}。',
        breakup_default_reason: '你们都知道，这次是真的结束了。',
        confess_break_reason: '告白被拒之后，那点暧昧也散了。',
        breakup_cooldown: '分手总要缓一缓：你们相处了 {together} 天，冷却期 {cool} 天——这段时间你根本没心思见人。',
        child_fail: {
          title: '还需要一点时间',
          lines: [
            '你试探着提了一句，{p}没有接话。',
            '过了一会儿她说：「再等等吧，我觉得我们还没到那个时候。」',
            '好感度达到 {min} 时，她才会认真考虑这件事。'
          ]
        },
        child_ok: {
          title: '新的生命',
          lines: [
            '你在产房外站了六个小时，把走廊的地砖数了三遍。',
            '护士出来说「母子平安」的时候，你愣了两秒才反应过来。',
            '{p}躺在病床上，很虚弱，但笑得很亮。',
            '你握着那个很小很小的手，忽然觉得之前的一切都值了。'
          ]
        },
        overtime: [
          '你又接了一摊活，连加了三天班。',
          '银行卡余额实实在在多了一截，黑眼圈也多了一截。'
        ],
        overtime_aff: '{p}发来消息：「你最近好像特别忙。」你盯着屏幕，不知道怎么回。',
        breakup_zero: {
          title: '关系破裂 · 好感度归零',
          lines: [
            '有些东西是慢慢碎的，不是一下子。',
            '和{name}的这段关系，终于在某个平常的晚上走到了尽头。',
            '她没有大吵大闹，只是说了句「算了吧」。',
            '你回到单身。日子继续，但你心里空了一块。'
          ]
        },
        breakup_zero_reason: '她没有大吵大闹，只是说了句「算了吧」。',
        meet_intro: [
          '你和{name}约在{place}见面。',
          '介绍人把话都铺垫好了，剩下的四十分钟，全靠你自己。'
        ],
        meet_see_more: '你暗中观察：对方颜值约 {looks}，家境约 {family}，跟你「门当户对」的程度一般。',
        /* 见面前在微信上聊过：见面时对方明显更松弛（chatBonus 由引擎给出） */
        meet_chat_bonus: '见面前你们在微信上聊了几天，{p}见到你时没有半点生分，像是早就认识。',
        flow: {
          grace_meet_reason: '进入接触期',
          grace_confess_reason: '确定恋爱关系',
          worker_date_note: '你是{job}，工作日要上班，只能等到 {day}',
          partner_leave_title: '对方提出了分手',
          win_prefix: '达成目标：{goal} · {title}',
          ending_strip: '结局 · ',
          default_partner: '对方'
        }
      }
    }
  ];
}

/* ---------------------------------------------------------
 * 7. 输出
 * ------------------------------------------------------- */
function toModule(name, data) {
  return '/* 自动生成，请勿手改。来源：tools/gen-seed.js */\n' +
    'module.exports = ' + JSON.stringify(data, null, 2) + ';\n';
}

function writeCollection(name, data) {
  fs.writeFileSync(path.join(SEED_DIR, name + '.js'), toModule(name, data), 'utf8');
  fs.writeFileSync(
    path.join(EXPORT_DIR, name + '.json'),
    JSON.stringify(data, null, 2),
    'utf8'
  );
  return data;
}

function main() {
  fs.mkdirSync(SEED_DIR, { recursive: true });
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  const s = loadSource();
  const out = {};

  out.events = writeCollection('events', buildEvents(s));
  out.backgrounds = writeCollection('backgrounds', buildBackgrounds(s));
  out.goals = writeCollection('goals', buildGoals(s));
  out.difficulties = writeCollection('difficulties', buildDifficulties(s));
  out.channels = writeCollection('channels', buildChannels(s));
  out.date_types = writeCollection('date_types', buildDateTypes(s));
  out.court_styles = writeCollection('court_styles', buildCourtStyles(s));
  out.style_events = writeCollection('style_events', buildStyleEvents(s));
  out.chats = writeCollection('chats', buildChats());
  out.partners = writeCollection('partners', buildPartners());
  out.personalities = writeCollection('personalities', buildPersonalities(s));
  out.endings = writeCollection('endings', buildEndings(s));
  out.constants = writeCollection('constants', buildConstants(s));
  out.materials = writeCollection('materials', buildMaterials(s));
  out.texts = writeCollection('texts', buildTexts(s));

  // 索引文件：本地 provider 与导入脚本共用
  const indexNames = Object.keys(out);
  fs.writeFileSync(
    path.join(SEED_DIR, 'index.js'),
    '/* 自动生成，请勿手改。 */\nmodule.exports = {\n' +
      indexNames.map(function (n) {
        return '  ' + n + ": require('./" + n + ".js')";
      }).join(',\n') +
      '\n};\n',
    'utf8'
  );

  console.log('种子数据生成完成：');
  indexNames.forEach(function (n) {
    const v = out[n];
    console.log('  ' + n.padEnd(14) + (Array.isArray(v) ? v.length + ' 条' : '1 条'));
  });
  console.log('  事件合计 ' + out.events.length + ' 条');
  console.log('  输出目录: db/seed/ (数据模板)  db/export/ (导入云数据库)');
}

main();
