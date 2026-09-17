/* 自动生成，请勿手改。来源：tools/gen-seed.js */
module.exports = [
  {
    "id": "app",
    "value": {
      "title": "相亲模拟器",
      "sub": "一场关于婚姻、存款与自我的文字肉鸽",
      "tag": "每个选择，都是一天",
      "start": "开始游戏",
      "gallery": "相亲图鉴",
      "rules": "玩法说明"
    }
  },
  {
    "id": "intro",
    "value": [
      [
        "「喂，妈。」",
        false
      ],
      [
        "「吃了吗？」",
        false
      ],
      [
        "「吃了。」",
        false
      ],
      [
        "「穿暖点，明天降温。」",
        false
      ],
      [
        "「嗯，知道了。」",
        false
      ],
      [
        "「……那个，有对象没？」",
        true
      ],
      [
        "「……」",
        true
      ],
      [
        "「你张阿姨家闺女，比你小两岁，在银行上班——」",
        false
      ],
      [
        "「妈，我在忙，先挂了。」",
        true
      ],
      [
        "这是你今年第 47 次挂掉这个电话。",
        true
      ],
      [
        "而明天，又是新的一天。",
        true
      ]
    ]
  },
  {
    "id": "intro_ui",
    "value": {
      "skip": "跳过 ▸",
      "next": "继续"
    }
  },
  {
    "id": "rules",
    "value": {
      "head": "玩法说明",
      "sub": "文字肉鸽 · 每天一个行动",
      "back": "返回",
      "lines": [
        "· 开局设定性别、出身背景、人生目标与难度。",
        "· 七项指标：存款、好感度、健康、事业、颜值、家境、情绪。",
        "· 每天只能做一件事：过日子、提升自己、寻找相亲机会、加班挣钱，或经营关系。",
        "· 每回合 20% 概率触发随机事件：生活时不时会替你做出安排。",
        "· 每 30 天发薪日：按职业的月收入/支出结算，事业越高收入越多。",
        "· 时间真的会流逝：健身 +30 天、寻找机会失败 +10 天、相亲接触 +7 天……",
        "· 社畜只能周末约会：选了「社畜」背景，工作日约会要等到周末。",
        "· 相亲见面可选交往风格（涨好感/翻车风险各不相同），约会开销按性别区分。",
        "· 相亲是交往事件：对方会抛出难题，你的反应会大幅升降好感，选错甚至直接分手。",
        "· 相亲对象来自固定的花名册（数据库），遇见过的会收进「相亲图鉴」，这一局不再重复。",
        "· 数值结算不随机浮动：事件写涨多少就涨多少，看到的数字就是实际数字。",
        "· 好感度归零会关系破裂（情绪 −30）；存款/健康/事业/情绪归零则游戏结束。",
        "· 找对象期限：需要结婚/恋爱的人生目标，若在期限内仍单身，会被父母安排匆忙相亲结婚。",
        "· 达成目标即为胜利；超过年限，时间会替你收场。"
      ]
    }
  },
  {
    "id": "setup",
    "value": {
      "genderHead": "请选择你的性别",
      "genderSub": "决定相亲对象的性别与部分剧情措辞。",
      "genderOptions": [
        {
          "id": "m",
          "label": "男"
        },
        {
          "id": "f",
          "label": "女"
        }
      ],
      "genderMale": "男 · 你的形象",
      "genderFemale": "女 · 你的形象",
      "reroll": "换个形象",
      "bgHead": "选择出身背景",
      "bgSub": "背景决定全部初始属性与职业（社畜 / 弹性 / 自由职业）。",
      "goalHead": "设定人生目标",
      "goalSub": "达成它即为胜利。",
      "diffHead": "选择难度",
      "diffSub": "普通难度通关率约 20%。",
      "diffMeta": "找对象期限：{days} 天内（到期仍单身会被安排结婚）",
      "begin": "开始这段人生",
      "confirm": "确认",
      "backGender": "← 重选性别",
      "backBg": "← 重选背景",
      "backGoal": "← 重选目标",
      "statsLine": "存款 {money} · 健康 {health} · 事业 {career} · 颜值 {looks} · 家境 {family} · 情绪 {mood} · {job}",
      "incomeLine": "月收入 {income} · 月支出 {expense}"
    }
  },
  {
    "id": "rel_names",
    "value": {
      "single": "单身",
      "meeting": "初次见面",
      "talking": "接触中",
      "dating": "恋爱中",
      "married": "已婚"
    }
  },
  {
    "id": "stat_defs",
    "value": [
      {
        "key": "money",
        "label": "存款",
        "color": "#d99b2b",
        "max": 500000,
        "format": "money"
      },
      {
        "key": "affection",
        "label": "好感度",
        "color": "#d9536f",
        "max": 100,
        "format": "int",
        "slot": "partnerHeader"
      },
      {
        "key": "health",
        "label": "健康",
        "color": "#3fa66a",
        "max": 100,
        "format": "int"
      },
      {
        "key": "career",
        "label": "事业",
        "color": "#4a7fd4",
        "max": 100,
        "format": "int"
      },
      {
        "key": "looks",
        "label": "颜值",
        "color": "#a86fd0",
        "max": 100,
        "format": "int"
      },
      {
        "key": "family",
        "label": "家境",
        "color": "#c98a3c",
        "max": 100,
        "format": "int"
      },
      {
        "key": "mood",
        "label": "情绪",
        "color": "#4bb3ac",
        "max": 100,
        "format": "int"
      }
    ]
  },
  {
    "id": "play",
    "value": {
      "dayLeft": "剩余 {n} 天",
      "restart": "重开",
      "goalLine": "{diff}难度 · 目标：{goal}　{job}",
      "financeLine": "本月收支 · 收入 +{income}（基本 {base} + 事业加成 {bonus}）· 支出 −{expense} · 净 {net}",
      "deadline": "⏳ 找对象倒计时：{streak} / {limit} 天{hint} · 剩 {remain} 天",
      "deadlinePaused": " · 已确定关系（倒计时暂停）",
      "deadlineTalking": " · 接触中（倒计时暂停）",
      "deadlineMeeting": " · 初遇中（倒计时暂停）",
      "deadlineLead": " · 已相到人，待赴约（倒计时暂停）",
      "deadlineSingle": " · 仍单身（正在走表）",
      "resolvedPickTitle": "你的选择",
      "resolvedResultTitle": "结果",
      "you": "你",
      "noPartner": "暂无对象",
      "noPartnerSub": "先去找机会",
      "leadTag": "待见面",
      "actionTitle": "今天想做什么？",
      "actionNote": "先选一个方向，进去再挑具体安排",
      "confirm": "确认",
      "seekTitle": "寻找相亲机会",
      "seekSub": "托人介绍 / 婚恋 App / 红娘 · 花钱碰运气",
      "seekPageTitle": "寻找相亲机会",
      "seekPageSub": "把范围收窄到「找对象」这一件事上",
      "seekPageTitlePartner": "和{name}的事",
      "seekPageSubPartner": "约会 / 表白 / 求婚 / 分手，都在这儿",
      "upgradePageTitle": "其余安排",
      "upgradePageSub": "把自己经营好，也是一条路",
      "otherSub": "过日子 / 提升自己 / 加班挣钱 / 休息一天",
      "meetTitle": "赴约初遇 · 见 {name}",
      "meetSub": "初次见面 · 约 {days} 天 · 见面可选交往风格",
      "dateTitle": "约会 · 约{name}出来",
      "dateSub": "简单 / 正式 / 活动三档 · 花钱",
      "dateTitleMarried": "约会 · 和{name}约会",
      "confessTitle": "向{name}告白",
      "confessSub": "成功率约 {pct}% · {days} 天",
      "breakupTitle": "算了，不再联系",
      "breakupTitle2": "提出分手",
      "breakupSub": "结束关系 · 情绪会大幅下降",
      "proposeTitle": "向{name}求婚",
      "proposeSub": "成功率约 {pct}% · 婚礼 {cost} · {days} 天",
      "proposeSubWait": "感情还不够 ⚠ 当前 {cur} / {cap}，再相处攒够 {need} 点才谈得下去",
      "childTitle": "准备要个孩子",
      "childSubOk": "花销 {cost} · {days} 天 · 达成「{goal}」",
      "childSubNo": "需要好感度 ≥ {min}",
      "childDone": "你们已经有了孩子。日子还在继续。",
      "otherTitle": "其余安排",
      "lifeTitle": "过日子",
      "lifeSub": "随机生活 / 工作 / 人情世故事件 · 约 2 天",
      "improveTitle": "提升自己",
      "improveSub": "健身 / 美容 / 学习 / 情绪疗愈 · 约 6 天，部分更久",
      "overtimeTitle": "加班挣钱",
      "overtimeSub": "工资 +、事业 +、健康 −；谈着恋爱时对象好感会掉",
      "restTitle": "休息一天",
      "restSub": "恢复情绪与健康 · 1 天",
      "restWorker": " · 工作日会扣工资",
      "seekMenuTitle": "选择渠道",
      "seekMeta": "{cost} · 成功率 {pct}%　{sub}",
      "dateMenuTitle": "约{name}出来（见面可选交往风格）",
      "datePageTitle": "和{name}约会",
      "datePageSub": "先挑一个档位，下一步再定这次见面的交往风格",
      "dateMeta": "{cost} · {label} · 好感收益 ×{mult}",
      "dateWarn": "　⚠ 社畜需等到 {day}",
      "styleTitle": "选择这次见面的交往风格",
      "styleOverlayHint": "点一次选中，再点一次取消；列表可上下滑动，确认后才出发",
      "styleMeta": "好感增益 ×{aff} · 翻车概率 {risk}%{more}",
      "styleSeeMore": " · 能看穿对方",
      "back": "← 返回",
      "continueDay": "继续 · 时间过去 {n} 天",
      "costLine": "花销 −{v}",
      "logTitle": "— 近期经历 —",
      "restResultTitle": "你休息了一天",
      "restLines": [
        "关掉手机，睡到自然醒，给自己做了顿饭。",
        "紧绷了太久，偶尔停下来，也是一种前进。"
      ],
      "restPenalty": "你是{job}，工作日躺平休息，被扣了工资和绩效。",
      "improvePenalty": "你是{job}，工作日摸鱼/休息被记了一笔——工资和绩效都掉了。",
      "randomIntro": "（随机事件）这一天，生活忽然给你出了道题。",
      "affDropHint": "这次相处不太愉快，好感度大幅下滑。",
      "confirmRestart": "确定放弃当前人生，重新开始？",
      "confirmYes": "确定，重开一局",
      "confirmNo": "取消",
      "logRest": "休息了一天",
      "logSeekOk": "通过{ch}认识了人",
      "logSeekFail": "{ch}：没有合适的",
      "logStyle": "以「{style}」的姿态行动",
      "logConfessOk": "告白成功",
      "logConfessBreak": "告白被拒·分手",
      "logConfessZero": "告白被拒·好感清零",
      "logMarry": "结婚了",
      "logProposeFail": "求婚被拒",
      "logProposeBreak": "求婚被拒·分手",
      "logBreakup": "结束了上一段关系",
      "logChildOk": "孩子出生了",
      "logChildWait": "提了生子，对方还想再等等",
      "logOvertime": "加班挣钱 +{v}",
      "logPayday": "发薪日 净{v}",
      "logGrace": "找对象宽限 +{n} 天",
      "logCooldown": "分手冷却期 {n} 天（倒计时 +{n}）",
      "paydayFlash": "📅 第 {day} 天 · 发薪日：收入 +{income}（基本 {base} + 事业加成 {bonus}）· 支出 −{expense} · 净 {net}",
      "graceFlash": "⏳ {reason}，找对象宽限 +{n} 天",
      "cooldownFlash": "💔 分手冷却期：你们相处了 {together} 天，需要缓 {days} 天 —— 找对象倒计时直接 +{days} 天",
      "childWaitTitle": "还需要一点时间",
      "childWaitLines": [
        "你试探着提了一句，{p}没有接话。",
        "过了一会儿她说：「再等等吧，我觉得我们还没到那个时候。」",
        "好感度达到 {min} 时，她才会认真考虑这件事。"
      ],
      "overtimeTitleResult": "加班挣钱",
      "overtimeLines": [
        "你又接了一摊活，连加了三天班。",
        "银行卡余额实实在在多了一截，黑眼圈也多了一截。"
      ],
      "overtimeAffLine": "{p}发来消息：「你最近好像特别忙。」你盯着屏幕，不知道怎么回。",
      "encounter_title": "意外认识了一个人",
      "encounter_intro": "本以为只是普通的一天，却在角落里多了一次搭话。",
      "encounter_tail": "你们交换了联系方式。之后可以在「赴约初遇」里约她出来。",
      "encounter_life": "生活琐事的间隙，你顺手帮了旁边的人一个小忙。",
      "encounter_improve": "提升自己的路上，你遇到了一个同样在努力的人。",
      "encounter_rest": "难得放松的一天，你在街角遇见了一个陌生人。",
      "encounter_overtime": "加班到深夜，写字楼里还有另一个没走的人。",
      "profileTap": "点头像看资料",
      "statTap": "点头像看属性变化",
      "recentTap": "↓ 点开看事件 / 选择 / 结果",
      "chatTitle": "微信闲聊",
      "chatSub": "和{name}聊几句，只影响好感度与情绪",
      "chatSubLead": "还没见面 · 先在微信上和{name}聊几句",
      "galleryEntry": "相亲图鉴",
      "recentEmpty": "还没有什么经历，先去做一件事吧。"
    }
  },
  {
    "id": "end",
    "value": {
      "days": "坚持天数",
      "money": "最终存款",
      "health": "健康",
      "career": "事业",
      "looks": "颜值",
      "family": "家境",
      "mood": "情绪",
      "goal": "人生目标",
      "again": "直接再开一局",
      "againAd": "看广告 · +{money}",
      "adHint": "看完广告，下一局开局多 {money}；不看也能直接开",
      "adLoading": "广告加载中…",
      "adNotReady": "广告还没准备好，可以先直接开新一局",
      "adAbort": "广告没看完，奖励没拿到",
      "adRewardFlash": "广告奖励到账：存款 +{money}",
      "home": "回到标题",
      "winPrefix": "达成目标：",
      "reasonTitle": "为什么",
      "headTag": "人生结局",
      "reasons": {
        "win": "目标「{goal}」达成，最终进度 {progress}%，用了 {day} 天。",
        "broke": "第 {day} 天存款见底，生活先于感情撑不住了。",
        "sick": "第 {day} 天健康见底，身体先替你按下了停止键。",
        "jobless": "第 {day} 天事业归零，工作没了，相亲的底气也没了。",
        "depressed": "第 {day} 天情绪见底，你不想再勉强自己了。",
        "deadline": "第 {day} 天，相亲期限到了：单身 {streak} 天没谈成，父母安排的相亲期限只有 {limit} 天，「{goal}」的进度停在 {progress}%。",
        "timeout": "时间用完了，「{goal}」的进度停在 {progress}%，这一生就这样走到了头。",
        "unknown": "这一局就这样结束了。"
      }
    }
  },
  {
    "id": "loading",
    "value": {
      "loading": "正在载入人生……",
      "failTitle": "数据载入失败",
      "failMsg": "无法连接游戏数据库，请检查网络后重试。",
      "retry": "重试"
    }
  },
  {
    "id": "profile",
    "value": {
      "title": "对方资料",
      "back": "返回",
      "empty": "现在还没有对象。先去「寻找相亲机会」认识一个人吧。",
      "age": "年龄",
      "job": "职业",
      "trait": "性格",
      "personality": "人格",
      "condition": "家庭",
      "look": "外形",
      "hobby": "爱好",
      "place": "认识方式",
      "looks": "颜值",
      "family": "家境",
      "affection": "好感度",
      "leadHint": "还没见面 —— 可以先在「微信闲聊」里聊几句攒印象，准备好就去「赴约初遇」。"
    }
  },
  {
    "id": "statlog",
    "value": {
      "title": "近期变化",
      "back": "返回",
      "currentTitle": "当前状态",
      "sessionTitle": "本次结算（第 {day} 天）",
      "dayTitle": "第 {day} 天",
      "totalTitle": "近期合计（近 {n} 天）",
      "empty": "还没有可展示的变化。做完一件事再回来看吧。",
      "hint": "每天先看关键事件，再看七项属性各自「从多少变成多少」。",
      "eventTitle": "关键事件",
      "fromTo": "{label}：从 {from} 变为 {to}",
      "noEvent": "（这一天没有记录到关键事件）"
    }
  },
  {
    "id": "envelope",
    "value": {
      "title": "对象信息",
      "badge": "相亲机会",
      "costTitle": "花销",
      "name": "姓名",
      "job": "职业",
      "trait": "性格",
      "family": "家庭",
      "condition": "条件",
      "age": "{n}岁",
      "extra": "颜值 {looks} · 家境 {family} · 平时喜欢{hobby}",
      "place": "认识方式：{place}",
      "hint": "往下看介绍，之后可以去「赴约初遇」把 TA 约出来。"
    }
  },
  {
    "id": "recent",
    "value": {
      "title": "近期经历",
      "back": "返回",
      "empty": "还没有什么经历，先去做一件事吧。",
      "hint": "只保留最近几次，按时间倒序：先看事件，再看你的选择与结果。",
      "dayTitle": "第 {day} 天",
      "eventTitle": "事件",
      "optionTitle": "你的选择",
      "resultTitle": "结果"
    }
  },
  {
    "id": "chat",
    "value": {
      "title": "微信闲聊",
      "back": "返回",
      "send": "发送",
      "finish": "结束闲聊 · 进入下一天",
      "me": "我",
      "hint": "选一句回过去（只影响好感度与情绪）",
      "waitReply": "对方正在输入…",
      "empty": "现在还没有可以闲聊的人。",
      "deltaTitle": "这次闲聊",
      "replyTitle": "对方的回应",
      "proactiveTag": "对方主动发来了消息",
      "kindGrill": "灵魂拷问 · 答不好会很难收场",
      "kindFlirt": "暧昧时刻 · 接住了关系会升温",
      "verdictGood": "答到点子上了",
      "verdictBad": "这话说得不太妙",
      "lockedTitle": "微信闲聊",
      "lockedSub": "对方想当面聊，先约一次会",
      "lockedLine": "我们还是多当面接触吧",
      "lockedHint": "先约 TA 出来见一面，之后想聊再聊。",
      "emptyLine": "（翻了一遍聊天记录，好像没有什么可接的话）",
      "emptyHint": "先回去安排点别的，回头再聊。",
      "mustDateNotice": "对方把话说开了 —— 接下来得当面见一面，微信先放一放。",
      "mustDateSoon": "微信聊得够多了（{n}/{thr}）· 下一次就该约见面了"
    }
  },
  {
    "id": "gallery",
    "value": {
      "title": "相亲图鉴",
      "sub": "至今为止遇见过的人，都记在这里",
      "entry": "相亲图鉴",
      "tabFemale": "女生",
      "tabMale": "男生",
      "unlockedCount": "已解锁 {n} / {total}",
      "locked": "未解锁",
      "lockedName": "？？？",
      "back": "返回",
      "empty": "这个性别还没有登记相亲对象。",
      "noneMet": "还没有遇见过谁，先去「寻找相亲机会」吧。",
      "tapHint": "点已解锁的卡片，看 TA 的详细资料",
      "detailTitle": "图鉴资料",
      "progressTitle": "达成的进展",
      "peakAff": "好感度峰值 {n}",
      "firstDay": "首次遇见 · 第 {day} 天",
      "lastDay": "最近见面 · 第 {day} 天",
      "notMet": "还没解锁",
      "child": "已有孩子",
      "stages": {
        "met": "已遇见",
        "meeting": "初次见面",
        "talking": "接触中",
        "dating": "恋爱中",
        "married": "已结婚"
      },
      "age": "{n}岁",
      "job": "职业",
      "trait": "性格",
      "condition": "家庭",
      "look": "外形",
      "hobby": "爱好",
      "place": "认识方式",
      "personality": "人格",
      "looks": "颜值",
      "family": "家境",
      "tagline": "一句话"
    }
  },
  {
    "id": "narratives",
    "value": {
      "find_fail": {
        "title": "暂时没有合适的",
        "lines": [
          "钱花出去了，回应却寥寥。",
          "介绍人说：「再等等，有合适的我第一时间想到你。」",
          "你知道这句话通常是什么意思。"
        ]
      },
      "find_ok": {
        "title": "有了新的相亲机会",
        "tail": [
          "介绍人说对方愿意见一面，时间就定在这两天。",
          "你存下了联系方式，开始琢磨见面该穿什么。"
        ]
      },
      "partner_desc": [
        "【{name}】{age}岁 · {job}",
        "{look}。{jobNote}。",
        "性格：{trait}——{traitDesc}",
        "家庭：{condition}——{conditionDesc}",
        "条件：颜值 {looks} · 家境 {family} · 平时喜欢{hobby}",
        "认识方式：{place}"
      ],
      "meet_ok": {
        "title": "她说，下次可以再约",
        "lines": [
          "告别的时候，她主动说了句「今天挺开心的」。",
          "你走出很远才敢回头看了一眼。",
          "这段关系，算是正式开始了。"
        ]
      },
      "meet_fail": {
        "title": "没有下文了",
        "lines": [
          "告别时说的那句「回头联系」，你们都知道是客套。",
          "消息从当天晚上开始变少，第三天彻底安静下来。",
          "你删掉了对话框，假装这件事没发生过。",
          "满怀期待又落空——情绪大幅下滑。"
        ]
      },
      "confess_ok": {
        "title": "她答应了",
        "lines": [
          "你说出口的时候，声音比想象中稳。",
          "{p}低着头笑了一下，然后点了点头。",
          "回去的路上你走得很慢，觉得这座城市忽然亮了一点。"
        ]
      },
      "confess_fail_break": {
        "title": "被婉拒了 · 关系结束",
        "lines": [
          "{p}沉默了几秒，说：「你很好，但我现在还没想好。」",
          "你们都知道这句话的意思。",
          "那天晚上，你们之间的消息从每天几十条，变成了零。",
          "这次告白，成了这段关系的句号。"
        ]
      },
      "confess_fail_zero": {
        "title": "被婉拒了 · 好感清零",
        "lines": [
          "{p}沉默了几秒，说：「我还没准备好，再给我一点时间。」",
          "话虽如此，你们之间好不容易攒下的好感，一夜之间回到了原点。",
          "你们没有分开，但一切都要重新开始了。"
        ]
      },
      "propose_ok": {
        "title": "你们结婚了",
        "lines": [
          "戒指是从商场买的，不大，但你挑了很久。",
          "{p}说：「你求婚词也太普通了。」然后哭了。",
          "宴席办了二十桌，你敬酒敬到腿软，但一直笑着。"
        ]
      },
      "propose_fail": {
        "title": "她没有答应",
        "lines": [
          "{p}把戒指推了回来，说：「我觉得我们还没准备好。」",
          "你想问那要等到什么时候，但最终没有开口。",
          "有些东西一旦被拒绝过一次，就很难再有第二次。"
        ]
      },
      "propose_fail_break": {
        "title": "被拒之后 · 关系结束",
        "lines": [
          "{p}把戒指推了回来，说：「我觉得我们还没准备好。」",
          "你想问那要等到什么时候，但最终没有开口。",
          "有些东西一旦被拒绝过一次，就很难再有第二次。",
          "那枚戒指后来一直放在抽屉里。你们谁也没再提这件事，然后就没有然后了。"
        ]
      },
      "propose_break_reason": "求婚被拒之后，两个人都不知道该怎么继续。",
      "breakup": {
        "title": "这段关系结束了",
        "lines": [
          "和{name}的最后一次见面，你们说了很多客气话。",
          "{reason}",
          "回家路上你买了瓶水，忽然不知道今晚该跟谁说话。",
          "情绪值大幅下降——接下来的一段时间，你什么都不想做。"
        ]
      },
      "breakup_basis": "这段感情你们走了 {days} 天——时间越久，抽身越疼。",
      "breakup_spent": "你为它前后花掉了 {spent}，不是小数目。",
      "breakup_tier_zero": "投入这么深，一朝散场，情绪直接被掏空（{from} → {to}）。",
      "breakup_tier_set": "投入不算小，心气也跟着掉了，情绪被压到了 {to}（{from} → {to}）。",
      "breakup_tier_ratio": "虽然时间不长、花得也不多，但分手终究是伤人的，情绪折掉一半（{from} → {to}）。",
      "breakup_mood_change": "情绪值 {from} → {to}。",
      "breakup_default_reason": "你们都知道，这次是真的结束了。",
      "confess_break_reason": "告白被拒之后，那点暧昧也散了。",
      "breakup_cooldown": "分手总要缓一缓：你们相处了 {together} 天，冷却期 {cool} 天——这段时间你根本没心思见人。",
      "child_fail": {
        "title": "还需要一点时间",
        "lines": [
          "你试探着提了一句，{p}没有接话。",
          "过了一会儿她说：「再等等吧，我觉得我们还没到那个时候。」",
          "好感度达到 {min} 时，她才会认真考虑这件事。"
        ]
      },
      "child_ok": {
        "title": "新的生命",
        "lines": [
          "你在产房外站了六个小时，把走廊的地砖数了三遍。",
          "护士出来说「母子平安」的时候，你愣了两秒才反应过来。",
          "{p}躺在病床上，很虚弱，但笑得很亮。",
          "你握着那个很小很小的手，忽然觉得之前的一切都值了。"
        ]
      },
      "overtime": [
        "你又接了一摊活，连加了三天班。",
        "银行卡余额实实在在多了一截，黑眼圈也多了一截。"
      ],
      "overtime_aff": "{p}发来消息：「你最近好像特别忙。」你盯着屏幕，不知道怎么回。",
      "breakup_zero": {
        "title": "关系破裂 · 好感度归零",
        "lines": [
          "有些东西是慢慢碎的，不是一下子。",
          "和{name}的这段关系，终于在某个平常的晚上走到了尽头。",
          "她没有大吵大闹，只是说了句「算了吧」。",
          "你回到单身。日子继续，但你心里空了一块。"
        ]
      },
      "breakup_zero_reason": "她没有大吵大闹，只是说了句「算了吧」。",
      "meet_intro": [
        "你和{name}约在{place}见面。",
        "介绍人把话都铺垫好了，剩下的四十分钟，全靠你自己。"
      ],
      "meet_see_more": "你暗中观察：对方颜值约 {looks}，家境约 {family}，跟你「门当户对」的程度一般。",
      "meet_chat_bonus": "见面前你们在微信上聊了几天，{p}见到你时没有半点生分，像是早就认识。",
      "flow": {
        "grace_meet_reason": "进入接触期",
        "grace_confess_reason": "确定恋爱关系",
        "worker_date_note": "你是{job}，工作日要上班，只能等到 {day}",
        "partner_leave_title": "对方提出了分手",
        "win_prefix": "达成目标：{goal} · {title}",
        "ending_strip": "结局 · ",
        "default_partner": "对方"
      }
    }
  }
];
