/* =========================================================
 * 职业 / 背景 / 事件 → 图片 key 的映射表（手工维护）
 * ---------------------------------------------------------
 * 这里只做「展示用图片」的匹配，不含任何玩法数值，属于美术配置。
 * 想换脸就改这张表；想加新职业，把图放进 role/ 目录后在这里加一行即可。
 *
 * ⚠️ 图片文件名必须使用 ASCII（英文 / 数字 / - _），不要用中文。
 *    中文文件名在打包与真机取图时可能因编码不一致而加载失败，
 *    表现为「头像/背景全都不显示」。这一条是硬性约定。
 *
 * key 规则：
 *   · role    ：role/ 目录下的文件名去掉扩展名，形如「职业-性别」，
 *               性别用 m / f（如 programmer-m.png → programmer-m）。
 *   · scene   ：scene/ 目录下的文件名去掉「bg-」前缀与扩展名
 *               （如 bg-cafe.jpg → cafe）。
 *
 * 三张表：
 *   · background    ：主角出身背景 id → role 职业 key
 *   · job           ：相亲对象职业名 → role 职业 key
 *   · eventScene / dateTypeScene / sceneKeys / meetScene ：事件 → 场景 key（四级匹配）
 *   · actionScene   ：无事件对象的行动（告白 / 求婚）→ 场景 key
 * ========================================================= */

'use strict';

module.exports = {
  /* 主角：出身背景 id → 职业头像 */
  background: {
    xiaozhen: 'programmer',     // 小镇做题家 · 互联网社畜
    tizhi:    'civil-servant',  // 体制内青年 · 体制内职员
    chuangye: 'startup-fail',   // 创业失败者
    daling:   'older-single',   // 大龄青年 · 资深打工人
    youwo:    'wealthy',        // 家境优渥 · 家里安排的工作
    wenyi:    'artsy'           // 文艺青年 · 自由职业者
  },

  /* 相亲对象：职业 → 职业头像（相近职业可共用一张，之后补图再拆开） */
  job: {
    '小学老师':       'teacher',
    '中学教师':       'teacher',
    '三甲医院护士':   'nurse',
    '银行柜员':       'accountant',
    '外贸业务员':     'accountant',
    '互联网产品经理': 'programmer',
    '程序员':         'programmer',
    '公务员':         'civil-servant',
    '广告公司文案':   'artsy',
    '设计师':         'artsy',
    '开咖啡馆的':     'artsy',
    '健身教练':       'coach',
    '自由摄影师':     'photographer',
    '销售经理':       'wealthy',
    '在读博士':       'anime'
  },

  /* 事件 → 场景背景，四级匹配（都命中不了就不展示背景）：
   *   1) eventScene：按事件 id 显式指定（想覆盖某个事件就在这里加）
   *   2) dateType  ：按约会档位给默认场景
   *   3) sceneKeys ：按事件正文 / 选项 / 初遇旁白里的关键词匹配（按顺序取第一个命中）
   *   4) meetScene ：「赴约初遇」没有档位概念，用默认场景兜底（见下）
   * 任何一级显式写 null，都表示「该事件不展示背景」。
   */
  eventScene: {
    // 's_overtime': 'living-room'    ← 需要时按事件 id 覆盖
  },

  dateTypeScene: {
    simple:   'cafe',      // 简单见面：咖啡 / 散步
    standard: 'cinema',    // 正式约会：吃饭 / 看电影
    activity: 'concert'    // 一起参加活动：展览 / 演出 / 短途
  },

  /* 「赴约初遇」没有约会档位可选（玩家只挑交往风格），
   * 所以给一个默认场景；正文/旁白里出现关键词时以关键词为准。
   * 写 null 表示初遇不展示背景。 */
  meetScene: 'cafe',

  /* 没有事件对象的「行动型」结算页（告白 / 求婚）→ 默认场景。
   * 这些页面不进事件抽取流程，拿不到 ev，所以单独给一张表；
   * 正文里出现关键词时会优先按 sceneKeys 匹配，匹配不到才用这里的默认值。 */
  actionScene: {
    confess: 'cafe',
    propose: 'western-restaurant'
  },

  sceneKeys: [
    { keys: ['电影院', '电影', '影院', '大片', '首映'], scene: 'cinema' },
    { keys: ['演唱会', 'livehouse', 'live', '音乐节'], scene: 'concert' },
    { keys: ['剧场', '话剧', '演出', '音乐剧'], scene: 'theatre' },
    { keys: ['西餐', '牛排', '法餐', '意大利', '烛光'], scene: 'western-restaurant' },
    { keys: ['火锅', '烧烤', '饭店', '餐厅', '聚餐', '吃饭', '夜宵'], scene: 'chinese-restaurant' },
    { keys: ['奶茶', '甜品', '饮品'], scene: 'milk-tea' },
    { keys: ['商场', '逛街', '购物', '专柜'], scene: 'mall' },
    { keys: ['家里', '客厅', '沙发', '回家', '窝在'], scene: 'living-room' },
    { keys: ['咖啡'], scene: 'cafe' }
  ]
};
