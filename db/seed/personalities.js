/* 自动生成，请勿手改。来源：tools/gen-seed.js
 * 阈值经「对象主动提分手」重做时手动重调（见 tools/analyze-leave-risk.js 的体检报告），
 * 与 tools/gen-seed.js 的 PERSONALITY_RULES 保持一致。
 *
 * 设计口径（每条规则的 risk 都是「单次判定」的风险，一天只判定一次）：
 *   · 分两档而不是一个悬崖：轻微的越线先给低风险，越过更深的线再叠加 ——
 *     玩家能感觉到「越来越危险」，而不是「跌过某个数就突然开始掷骰子」。
 *   · 单条 0.005~0.03，一个人格叠起来最高约 0.05~0.065。
 *   · 判定先出「预警」再真正分手（见 engine.checkPartnerLeave），
 *     所以这里的数值是「预警挂着不处理时」的每日风险，不是最终死刑概率。
 *   · 还会乘难度 difficulties.riskMod（简单 0.8 / 普通 1.0 / 困难 1.6），
 *     并叠上每天最多 PARTNER_LEAVE_RAGE_STEP 的积怨，上限 PARTNER_LEAVE_MAX_RISK。
 */
module.exports = [
  {
    "id": "money",
    "name": "金钱至上",
    "desc": "很在意你的经济条件，存款一少她(O)就坐不住",
    "order": 1,
    "combine": "sum",
    "rules": [
      {
        "cond": {
          "field": "money",
          "op": "lt",
          "value": 40000
        },
        "risk": 0.025,
        "reason": "你账户里的数字，让她(O)越来越不安。"
      },
      {
        "cond": {
          "field": "money",
          "op": "lt",
          "value": 15000
        },
        "risk": 0.03,
        "reason": "她(O)开始算你们两个人的未来，越算越沉默。"
      }
    ]
  },
  {
    "id": "emo",
    "name": "情绪价值",
    "desc": "需要你持续提供情绪价值，冷漠与忽视是雷区",
    "order": 2,
    "combine": "sum",
    "rules": [
      {
        "cond": {
          "field": "mood",
          "op": "lt",
          "value": 35
        },
        "risk": 0.02,
        "reason": "你最近总是闷闷的，她(O)觉得自己怎么暖都暖不热你。"
      },
      {
        "cond": {
          "field": "mood",
          "op": "lt",
          "value": 20
        },
        "risk": 0.025,
        "reason": "你连话都懒得说了，她(O)一个人把话讲完，然后不讲了。"
      },
      {
        "cond": {
          "field": "affection",
          "op": "lt",
          "value": 35
        },
        "risk": 0.02,
        "reason": "你们的对话越来越少，她(O)觉得自己在唱独角戏。"
      }
    ]
  },
  {
    "id": "char",
    "name": "看中人品",
    "desc": "看重稳定靠谱，身体垮了或事业崩了会让她(O)动摇",
    "order": 3,
    "combine": "sum",
    "rules": [
      {
        "cond": {
          "field": "health",
          "op": "lt",
          "value": 35
        },
        "risk": 0.025,
        "reason": "你状态肉眼可见地往下掉，她(O)开始怀疑这段关系靠不靠谱。"
      },
      {
        "cond": {
          "field": "career",
          "op": "lt",
          "value": 30
        },
        "risk": 0.02,
        "reason": "你最近好像没什么奔头，她(O)嘴上不说，心里在记账。"
      }
    ]
  },
  {
    "id": "casual",
    "name": "随便玩玩",
    "desc": "没想认真，你让她觉得没意思，她说撤就撤",
    "order": 4,
    "combine": "sum",
    "rules": [
      {
        "cond": {
          "field": "affection",
          "op": "lt",
          "value": 60
        },
        "risk": 0.02,
        "reason": "她(O)的笑容还是那么好看，只是好像随时准备抽身。"
      },
      {
        "cond": {
          "field": "affection",
          "op": "lt",
          "value": 30
        },
        "risk": 0.025,
        "reason": "她(O)已经很久没有主动找过你了。"
      },
      {
        "cond": {
          "field": "relationship",
          "op": "neq",
          "value": "married"
        },
        "risk": 0.005,
        "warn": false,
        "reason": "她(O)说：「我好像没想好要认真。」语气轻松得像在说晚饭吃什么。"
      }
    ]
  },
  {
    "id": "family",
    "name": "顾家型",
    "desc": "想安稳过日子，最怕你身体出状况，也怕日子过不下去",
    "order": 5,
    "combine": "sum",
    "rules": [
      {
        "cond": {
          "field": "health",
          "op": "lt",
          "value": 30
        },
        "risk": 0.03,
        "reason": "你身体亮了红灯，她(O)怕的是「以后」。"
      },
      {
        "cond": {
          "field": "money",
          "op": "lt",
          "value": 20000
        },
        "risk": 0.015,
        "reason": "她(O)在算下个月的房租和你的工资，算完叹了口气。"
      }
    ]
  },
  {
    "id": "career",
    "name": "事业同频",
    "desc": "欣赏上进的人，你躺平她就失去兴趣",
    "order": 6,
    "combine": "sum",
    "rules": [
      {
        "cond": {
          "field": "career",
          "op": "lt",
          "value": 35
        },
        "risk": 0.03,
        "reason": "你越来越躺平，而她(O)最欣赏的那种劲头不见了。"
      },
      {
        "cond": {
          "field": "mood",
          "op": "lt",
          "value": 25
        },
        "risk": 0.02,
        "reason": "她(O)说「你最近好像不怎么高兴」，你说「没有啊」。"
      }
    ]
  }
];
