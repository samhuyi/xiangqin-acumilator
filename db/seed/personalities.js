/* 自动生成，请勿手改。来源：tools/gen-seed.js */
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
          "value": 20000
        },
        "risk": 0.06,
        "reason": "你账户里的数字，让她越来越不安。"
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
          "value": 25
        },
        "risk": 0.05,
        "reason": "你最近总是闷闷的，她(O)觉得自己怎么暖都暖不热你。"
      },
      {
        "cond": {
          "field": "affection",
          "op": "lt",
          "value": 30
        },
        "risk": 0.04,
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
          "any": [
            {
              "field": "health",
              "op": "lt",
              "value": 25
            },
            {
              "field": "career",
              "op": "lt",
              "value": 20
            }
          ]
        },
        "risk": 0.05,
        "reason": "你状态肉眼可见地往下掉，她(O)开始怀疑这段关系靠不靠谱。"
      }
    ]
  },
  {
    "id": "casual",
    "name": "随便玩玩",
    "desc": "没想认真，随时可能说撤就撤",
    "order": 4,
    "combine": "sum",
    "rules": [
      {
        "cond": null,
        "risk": 0.05,
        "reason": "她说：「我好像没想好要认真，算了吧。」语气轻松得像在说晚饭吃什么。"
      }
    ]
  },
  {
    "id": "family",
    "name": "顾家型",
    "desc": "想安稳过日子，最怕你身体出状况",
    "order": 5,
    "combine": "sum",
    "rules": [
      {
        "cond": {
          "field": "health",
          "op": "lt",
          "value": 20
        },
        "risk": 0.05,
        "reason": "你身体亮了红灯，她(O)怕的是「以后」。"
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
          "value": 25
        },
        "risk": 0.05,
        "reason": "你越来越躺平，而她(O)最欣赏的那种劲头不见了。"
      }
    ]
  }
];
