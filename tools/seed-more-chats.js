/* =========================================================
 * 扩充聊天题库（按「结算规则 1」新写）
 * ---------------------------------------------------------
 * 规则：
 *   · 每个回复都对多个属性生效（不再只有好感度 + 情绪），
 *     且每个选项同时有增有减 —— 没有白嫖的选项；
 *     这里只写「意图」，最终数值由 gen-seed 的 enrichFx 统一放大并补齐。
 *   · 选项要出人意料：不做「温柔 / 冷漠」的二选一，
 *     而是具体、有点怪、后果也说不清的回复。
 *   · 奖惩幅度加大，一句话也能把关系往前推或打回原形。
 *
 * 字段：
 *   kind            normal(默认) / grill 灵魂拷问 / flirt 暧昧 / mustdate 必须出门
 *   personalityId   填了就只对「这个人格」的对象投放（6 种：
 *                   money 现实 / emo 敏感 / char 开朗 / casual 随性 / family 顾家 / career 事业）
 *   phases          可出现的阶段（talking / dating / married 等）
 *                   婚嫁向（见家长、要孩子）只给 dating / married
 *   minAffection    好感度门槛
 *   weight          抽取权重
 *   opener          对方发来的消息（1~3 条）
 *   options[].fx    结算意图（gen-seed 会放大补齐）
 *   options[].correct  grill / flirt 里标「答到点子上」，只用于展示，不参与结算
 * --------------------------------------------------------- */

'use strict';

module.exports = [
  /* ---------------- 日常闲聊（normal）第一批 ---------------- */
  {
    id: 'n_c_rain',
    phases: ['talking', 'dating', 'married'],
    minAffection: 0,
    weight: 12,
    opener: ['外面下雨了', '你带伞了吗'],
    options: [
      { label: '带了，你要不要我送你', fx: { affection: 8, mood: 4, health: -1, career: -2 }, reply: '你好烦……那我在地铁口等你' },
      { label: '没带，反正也淋不死', fx: { affection: -3, mood: 3, health: -3, looks: -1 }, reply: '你这个人真是' },
      { label: '我在车里，雨刷坏了', fx: { affection: 2, mood: -2, money: -2, career: 1 }, reply: '那你慢慢开，别急' }
    ]
  },
  {
    id: 'n_c_photo',
    phases: ['talking', 'dating', 'married'],
    minAffection: 5,
    weight: 12,
    opener: ['我刚翻到一张老照片', '那时候头发好土啊哈哈'],
    options: [
      { label: '发来看看', fx: { affection: 7, mood: 4, career: -1, family: 1 }, reply: '不行，太丑了……你想看我给你拍张新的' },
      { label: '我也有，比你的土', fx: { affection: 9, mood: 5, looks: -1, family: 2 }, reply: '那你发，不许反悔' },
      { label: '（已读不回）', fx: { affection: -8, mood: -2, career: 2, health: 0 }, reply: '……' }
    ]
  },
  {
    id: 'n_c_boss',
    phases: ['talking', 'dating', 'married'],
    minAffection: 10,
    weight: 11,
    opener: ['我们领导今天当着全组的面说我', '我真的想辞职了'],
    options: [
      { label: '「我陪你去楼下走一圈」', fx: { affection: 10, mood: 5, career: -2, health: 2 }, reply: '……你现在过来吗' },
      { label: '「辞吧，我养你」', fx: { affection: 6, mood: -3, money: -4, career: -2 }, reply: '你说得轻巧，你养得起吗' },
      { label: '「你是不是哪里没做好」', fx: { affection: -11, mood: -5, career: 4, family: 1 }, reply: '……我去洗澡了' }
    ]
  },
  {
    id: 'n_c_movie',
    phases: ['talking', 'dating', 'married'],
    minAffection: 8,
    weight: 11,
    opener: ['最近有部电影好想看', '但是没人陪我去'],
    options: [
      { label: '「几点，我订票」', fx: { money: -120, affection: 11, mood: 6, career: -2 }, reply: '真的吗！那说好了，不许放我鸽子' },
      { label: '「我看过了，不太好看」', fx: { affection: -7, mood: -2, career: 2, money: 2 }, reply: '哦，那我自己去' },
      { label: '「我陪你看别的行不行」', fx: { affection: 4, mood: 2, career: 1, family: -1 }, reply: '你总是这样打折扣' }
    ]
  },
  {
    id: 'n_c_sick',
    phases: ['talking', 'dating', 'married'],
    minAffection: 15,
    weight: 10,
    opener: ['我好像有点感冒', '头好疼'],
    options: [
      { label: '「我给你送药，地址发我」', fx: { money: -70, affection: 13, mood: 4, health: -2 }, reply: '不用啦……那你路上小心' },
      { label: '「多喝热水，早点睡」', fx: { affection: -4, mood: -1, career: 2, health: 1 }, reply: '……哦' },
      { label: '「我妈说姜汤管用，我教你煮」', fx: { affection: 7, mood: 3, family: 4, career: -1 }, reply: '你还会煮这个？' }
    ]
  },
  {
    id: 'n_c_ex',
    phases: ['talking', 'dating', 'married'],
    minAffection: 25,
    weight: 8,
    opener: ['我今天在路上碰到他了', '就打了个招呼'],
    options: [
      { label: '「然后呢」', fx: { affection: 6, mood: -3, career: 1, health: 1 }, reply: '然后就走了呀。你紧张啦？' },
      { label: '「你跟我说这个干嘛」', fx: { affection: -9, mood: -4, career: 2, family: 1 }, reply: '……我就是想跟你说' },
      { label: '「我有点吃醋，但我忍着」', fx: { affection: 12, mood: 5, health: -1, career: -1 }, reply: '傻子。我现在的电话是你接的。' }
    ]
  },
  {
    id: 'n_c_money_split',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 9,
    opener: ['上次那顿饭你付的', '这次我请吧'],
    options: [
      { label: '「那我不客气了」', fx: { money: 3, affection: 7, mood: 3, career: -1 }, reply: '就该这样' },
      { label: '「我请吧，你上次已经请过」', fx: { money: -3, affection: 4, mood: -2, career: 1 }, reply: '你这人怎么这么犟' },
      { label: '「AA 吧，我自己算得清」', fx: { money: 2, affection: -6, mood: -2, career: 3 }, reply: '……那以后都 AA？' }
    ]
  },
  {
    id: 'n_c_song',
    phases: ['talking', 'dating', 'married'],
    minAffection: 12,
    weight: 10,
    opener: ['这首歌你听过吗', '我循环了一下午'],
    options: [
      { label: '「听了，有点丧，你没事吧」', fx: { affection: 10, mood: 3, health: 1, career: -1 }, reply: '……你怎么听出来的' },
      { label: '「不难听，但我不循环」', fx: { affection: 2, mood: 1, career: 2, family: -1 }, reply: '要求还挺高' },
      { label: '「我给你唱两句？」', fx: { affection: 8, mood: 6, looks: -1, career: -2 }, reply: '别，你别唱' }
    ]
  },
  {
    id: 'n_c_late_reply',
    phases: ['talking', 'dating', 'married'],
    minAffection: 10,
    weight: 10,
    opener: ['你这两天回消息好慢'],
    options: [
      { label: '「项目上线，我熬了两天」', fx: { affection: 3, mood: -3, career: 6, health: -3 }, reply: '那你快去睡，我不打扰你' },
      { label: '「我故意的。」', fx: { affection: -12, mood: -6, career: 1, health: 2 }, reply: '……' },
      { label: '「对不起，我改」', fx: { affection: 5, mood: 2, career: -2, family: 1 }, reply: '你不用改，说一下就好了' }
    ]
  },
  {
    id: 'n_c_nickname',
    phases: ['dating', 'married'],
    minAffection: 35,
    weight: 9,
    opener: ['我给你起个外号吧', '叫你「小圆」怎么样'],
    options: [
      { label: '「随你，反正只有你这么叫」', fx: { affection: 13, mood: 6, family: 2, career: -1 }, reply: '那我以后就这么叫了，不许反对' },
      { label: '「太肉麻了，换一个」', fx: { affection: -3, mood: 1, career: 2, looks: 1 }, reply: '那你起' },
      { label: '「我叫我妈也这么叫我」', fx: { affection: -7, mood: -2, family: 3, health: 0 }, reply: '……当我没说' }
    ]
  },
  {
    id: 'n_c_future_city',
    phases: ['dating', 'married'],
    minAffection: 40,
    weight: 8,
    opener: ['如果可以选，你想在哪个城市生活'],
    options: [
      { label: '「你在哪儿，我就在哪儿」', fx: { affection: 10, mood: 4, career: -3, family: 2 }, reply: '……你说得这么好听，我记下了' },
      { label: '「我想回老家，压力小」', fx: { affection: -4, mood: 2, family: 5, career: -2 }, reply: '那我呢' },
      { label: '「没想过，先把这个月过完」', fx: { affection: -2, mood: -2, career: 4, health: 2 }, reply: '你真的好现实' }
    ]
  },
  {
    id: 'n_c_parents_visit',
    phases: ['dating', 'married'],
    minAffection: 45,
    weight: 8,
    opener: ['我爸妈下个月要来看我', '要不要一起吃个饭'],
    options: [
      { label: '「好啊，我准备一下」', fx: { affection: 9, mood: -3, family: 6, money: -2 }, reply: '别紧张，他们人很好的' },
      { label: '「下次吧，我这阵子太忙」', fx: { affection: -8, mood: 1, career: 3, family: -3 }, reply: '……行' },
      { label: '「先别说是男朋友，行吗」', fx: { affection: -5, mood: -3, career: 2, family: -1 }, reply: '……那算什么' }
    ]
  },
  {
    id: 'n_c_house_loan',
    phases: ['dating', 'married'],
    minAffection: 50,
    weight: 7,
    opener: ['我今天算了算房贷', '三十年，算完手都是抖的'],
    options: [
      { label: '「一起还，两个人快一倍」', fx: { affection: 12, mood: 3, money: -4, family: 4 }, reply: '……你算过了？' },
      { label: '「那就先别买」', fx: { affection: -3, mood: 1, money: 4, career: 1 }, reply: '不买住哪' },
      { label: '「我家里能帮一点」', fx: { affection: 6, mood: -2, family: 6, money: -3 }, reply: '我不想靠家里……但还是谢谢你' }
    ]
  },
  {
    id: 'n_c_marry_word',
    phases: ['dating', 'married'],
    minAffection: 55,
    weight: 7,
    opener: ['我们现在算什么呀', '你倒是给个说法'],
    options: [
      { label: '「我正想跟你说这件事」', fx: { affection: 15, mood: 7, career: -2, family: 3 }, reply: '……你别现在说，我想当面听' },
      { label: '「不是挺好的吗，为什么非要定义」', fx: { affection: -10, mood: -4, career: 2, health: 1 }, reply: '懂了' },
      { label: '「先同居试试？」', fx: { affection: 5, mood: 2, family: -3, money: -2 }, reply: '你想得倒挺美' }
    ]
  },
  {
    id: 'n_c_kid_talk',
    phases: ['married'],
    minAffection: 60,
    weight: 8,
    opener: ['我今天抱了同事的孩子', '好小一只'],
    options: [
      { label: '「那我们也准备准备」', fx: { affection: 11, mood: 5, family: 6, money: -3 }, reply: '你说真的？那要开始备孕了' },
      { label: '「先攒够钱再说」', fx: { affection: -2, mood: -1, money: 4, career: 2 }, reply: '……你总是这么说' },
      { label: '「我不太想要小孩，你呢」', fx: { affection: -6, mood: 2, career: 3, family: -4 }, reply: '我……我没想过你会这么说' }
    ]
  },
  {
    id: 'n_c_inlaw',
    phases: ['married'],
    minAffection: 55,
    weight: 8,
    opener: ['我妈说想过来住一段时间', '就一个月'],
    options: [
      { label: '「来吧，我去收拾客房」', fx: { affection: 6, mood: -3, family: 7, health: -2 }, reply: '你真的不介意？' },
      { label: '「一个月？我们家就两间房」', fx: { affection: -5, mood: -2, family: -3, career: 2 }, reply: '……她说打地铺也行' },
      { label: '「你决定就好」', fx: { affection: -1, mood: -1, career: 3, health: 1 }, reply: '你每次都这样' }
    ]
  },
  {
    id: 'n_c_anniversary',
    phases: ['dating', 'married'],
    minAffection: 45,
    weight: 9,
    opener: ['今天是什么日子，你还记得吗'],
    options: [
      { label: '（翻聊天记录）「认识第 200 天」', fx: { affection: 14, mood: 6, career: -2, money: -1 }, reply: '……你居然真的记得' },
      { label: '「是不是你生日？」', fx: { affection: -9, mood: -3, family: -2, career: 1 }, reply: '……不是' },
      { label: '「我记性不好，你提醒我一下」', fx: { affection: -4, mood: -1, career: 2, health: 1 }, reply: '算了' }
    ]
  },
  {
    id: 'n_c_cook',
    phases: ['talking', 'dating', 'married'],
    minAffection: 18,
    weight: 10,
    opener: ['我今晚自己做饭', '结果盐放多了'],
    options: [
      { label: '「下次我来做，你负责洗碗」', fx: { affection: 10, mood: 5, health: 2, money: -1 }, reply: '那我亏了，凭什么我洗碗' },
      { label: '「多喝水，明天就好了」', fx: { affection: 1, mood: 0, career: 2, health: 1 }, reply: '……你这人' },
      { label: '「发张图，我要嘲笑你」', fx: { affection: 6, mood: 4, looks: -1, career: 0 }, reply: '不给！' }
    ]
  },
  {
    id: 'n_c_gym',
    phases: ['talking', 'dating', 'married'],
    minAffection: 15,
    weight: 10,
    opener: ['我办了张健身卡', '两千四，肉疼'],
    options: [
      { label: '「我陪你去，有伴才坚持得住」', fx: { money: -2, affection: 9, health: 4, career: -2 }, reply: '那说好了，你别第三周就不来' },
      { label: '「办卡容易去着难」', fx: { affection: -4, mood: -1, career: 3, money: 2 }, reply: '你就不能说点好听的' },
      { label: '「在家跟着视频练也行，省钱」', fx: { money: 2, affection: 3, mood: 1, looks: 1 }, reply: '你倒是会过日子' }
    ]
  },
  {
    id: 'n_c_friend_wedding',
    phases: ['talking', 'dating', 'married'],
    minAffection: 22,
    weight: 9,
    opener: ['我大学室友要结婚了', '请帖都发我了'],
    options: [
      { label: '「一起去，我当家属」', fx: { money: -3, affection: 11, mood: 4, family: 3 }, reply: '……谁是你家属啊' },
      { label: '「随多少份子？我参考一下」', fx: { affection: -3, mood: -2, money: 3, career: 2 }, reply: '……你就关心这个' },
      { label: '「你羡慕吗」', fx: { affection: 5, mood: -2, family: 2, career: -1 }, reply: '……有一点' }
    ]
  },
  {
    id: 'n_c_midnight_food',
    phases: ['talking', 'dating', 'married'],
    minAffection: 12,
    weight: 11,
    opener: ['好想吃烧烤啊', '可是都十二点了'],
    options: [
      { label: '「下来，我在你楼下」', fx: { money: -2, affection: 13, mood: 7, health: -3 }, reply: '你疯了吧……等我五分钟' },
      { label: '「明天吃，今天忍忍」', fx: { affection: -5, mood: -2, health: 3, career: 2 }, reply: '你一点都不好玩' },
      { label: '「点外卖吧，我出配送费」', fx: { money: -1, affection: 6, mood: 3, health: -2 }, reply: '这个可以有' }
    ]
  },
  {
    id: 'n_c_jealous',
    phases: ['dating', 'married'],
    minAffection: 38,
    weight: 8,
    opener: ['你们公司那个谁', '是不是对你有意思'],
    options: [
      { label: '「有，但我只回你消息」', fx: { affection: 12, mood: 5, career: -2, health: -1 }, reply: '……油嘴滑舌' },
      { label: '「你想多了，人家有对象」', fx: { affection: -3, mood: -1, career: 3, family: 1 }, reply: '哦' },
      { label: '「你查我手机了？」', fx: { affection: -10, mood: -5, career: 2, health: 0 }, reply: '……我没有，我就是看见屏幕亮了' }
    ]
  },
  {
    id: 'n_c_pet_name',
    phases: ['talking', 'dating', 'married'],
    minAffection: 16,
    weight: 10,
    opener: ['我楼下那只猫又来了', '这次带了一只小的'],
    options: [
      { label: '「那你就是有两只猫的人了」', fx: { affection: 9, mood: 5, family: 2, money: -1 }, reply: '什么嘛，那是野猫' },
      { label: '「别喂，喂了就不走了」', fx: { affection: -4, mood: 0, career: 3, money: 2 }, reply: '……我已经喂了' },
      { label: '「明天我带猫粮过去」', fx: { money: -1, affection: 11, mood: 4, health: -1 }, reply: '你真的会来吗？' }
    ]
  },
  {
    id: 'n_c_album',
    phases: ['dating', 'married'],
    minAffection: 42,
    weight: 8,
    opener: ['我把我们的聊天记录备份了', '从第一天开始的'],
    options: [
      { label: '「你从第一天就在备份？」', fx: { affection: 13, mood: 6, career: -1, family: 2 }, reply: '……你是不是觉得我很可怕' },
      { label: '「这个习惯挺好，我也存了」', fx: { affection: 9, mood: 4, career: 1, health: 0 }, reply: '真的？' },
      { label: '「删了吧，占空间」', fx: { affection: -13, mood: -6, career: 3, health: 1 }, reply: '……好' }
    ]
  },

  /* -------------------------------------------------------
   * 灵魂拷问（grill）：按人格定向，每个性格 2 条
   * 三个选项里恰好一条 correct: true（只用于展示，不参与结算）
   * ----------------------------------------------------- */
  {
    id: 'n_g_money_2',
    kind: 'grill',
    personalityId: 'money',
    phases: ['talking', 'dating', 'married'],
    minAffection: 15,
    weight: 6,
    opener: ['我看了下你的消费记录', '你上个月光奶茶就四百多'],
    options: [
      { label: '「你怎么看我手机？」', fx: { affection: -13, mood: -5, career: 2, health: 0 }, reply: '……我是为了你好' },
      { label: '「那我从这个月开始记账」', fx: { affection: 9, mood: 2, money: 3, career: 1 }, correct: true, reply: '这还差不多，我教你用表格' },
      { label: '「四百块而已，至于吗」', fx: { affection: -11, mood: 3, money: -2, career: -1 }, reply: '……至于' }
    ]
  },
  {
    id: 'n_g_money_3',
    kind: 'grill',
    personalityId: 'money',
    phases: ['dating', 'married'],
    minAffection: 30,
    weight: 6,
    opener: ['如果结婚后要签婚前协议', '你会签吗'],
    options: [
      { label: '「不签，谈钱伤感情」', fx: { affection: -11, mood: -3, family: 3, career: -1 }, reply: '……我以为你会理解' },
      { label: '「签，各自财产各自清楚」', fx: { affection: 11, mood: 3, money: 2, career: 2 }, correct: true, reply: '你比我想的通透' },
      { label: '「你要签那就算了」', fx: { affection: -14, mood: -6, health: 1, career: 1 }, reply: '……行，我知道了' }
    ]
  },
  {
    id: 'n_g_emo_2',
    kind: 'grill',
    personalityId: 'emo',
    phases: ['talking', 'dating', 'married'],
    minAffection: 15,
    weight: 6,
    opener: ['你是不是没有那么喜欢我', '我感觉得到'],
    options: [
      { label: '「你想多了」', fx: { affection: -12, mood: -4, career: 2, health: 1 }, reply: '……每次你都这么说' },
      { label: '「我今天确实状态不好，不是你的问题」', fx: { affection: 10, mood: 3, health: 2, career: -2 }, correct: true, reply: '……那你早点说啊' },
      { label: '「那你想要我怎样」', fx: { affection: -15, mood: -7, career: 1, family: -2 }, reply: '算了，没事' }
    ]
  },
  {
    id: 'n_g_emo_3',
    kind: 'grill',
    personalityId: 'emo',
    phases: ['dating', 'married'],
    minAffection: 30,
    weight: 6,
    opener: ['我删了你三条消息', '我就是想看看你会不会再发'],
    options: [
      { label: '「幼稚。」', fx: { affection: -13, mood: -5, career: 3, health: 1 }, reply: '……嗯，我幼稚' },
      { label: '「我知道，所以我又发了第四条」', fx: { affection: 12, mood: 5, health: -1, career: -1 }, correct: true, reply: '……你什么时候发现的' },
      { label: '「那我以后不发了」', fx: { affection: -16, mood: -6, career: 2, family: 0 }, reply: '……' }
    ]
  },
  {
    id: 'n_g_char_2',
    kind: 'grill',
    personalityId: 'char',
    phases: ['talking', 'dating', 'married'],
    minAffection: 15,
    weight: 6,
    opener: ['我朋友说你太闷了', '你觉得呢'],
    options: [
      { label: '「你朋友说得对，我改」', fx: { affection: -11, mood: -3, career: 2, looks: 1 }, reply: '……我也没要你改' },
      { label: '「闷是闷了点，但我记性好」', fx: { affection: 9, mood: 4, family: 2, career: -1 }, correct: true, reply: '记性好体现在哪？举个例子' },
      { label: '「你朋友管得真宽」', fx: { affection: -11, mood: -4, career: 1, health: 0 }, reply: '……她是我最好的朋友' }
    ]
  },
  {
    id: 'n_g_char_3',
    kind: 'grill',
    personalityId: 'char',
    phases: ['dating', 'married'],
    minAffection: 30,
    weight: 6,
    opener: ['我周六想带十个朋友来家里玩', '可以吗'],
    options: [
      { label: '「十个？！」', fx: { affection: -11, mood: -4, health: 2, money: 2 }, reply: '……我就知道' },
      { label: '「行，我来做饭，你负责洗碗」', fx: { money: -3, affection: 12, mood: 5, health: -2 }, correct: true, reply: '真的？！我就知道你最好了' },
      { label: '「我那天不在家，你们玩」', fx: { affection: -12, mood: -2, career: 3, family: -2 }, reply: '……你是不是不太想见他们' }
    ]
  },
  {
    id: 'n_g_casual_2',
    kind: 'grill',
    personalityId: 'casual',
    phases: ['talking', 'dating', 'married'],
    minAffection: 15,
    weight: 6,
    opener: ['我们要不要先别定义关系', '顺其自然不好吗'],
    options: [
      { label: '「行，随便你」', fx: { affection: -11, mood: -2, career: 2, health: 1 }, reply: '……你答应得也太快了' },
      { label: '「顺其自然可以，但我得知道自己在哪」', fx: { affection: 10, mood: 3, family: 1, career: -1 }, correct: true, reply: '……想那么多干嘛' },
      { label: '「那我也去见别人？」', fx: { affection: -14, mood: -5, career: 1, health: 0 }, reply: '……随你' }
    ]
  },
  {
    id: 'n_g_casual_3',
    kind: 'grill',
    personalityId: 'casual',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 6,
    opener: ['我下周要去外地玩', '可能半个月不看手机'],
    options: [
      { label: '「玩得开心，回来找我」', fx: { affection: 9, mood: 3, career: 2, family: -1 }, correct: true, reply: '你真的不生气？' },
      { label: '「半个月？那我们还算什么」', fx: { affection: -11, mood: -5, career: 1, health: -1 }, reply: '……你又来了' },
      { label: '「我也去，我请假」', fx: { money: -4, affection: -10, mood: 4, career: -4 }, reply: '……你别，我自己走走' }
    ]
  },
  {
    id: 'n_g_family_2',
    kind: 'grill',
    personalityId: 'family',
    phases: ['dating', 'married'],
    minAffection: 30,
    weight: 6,
    opener: ['我爸身体不太好', '以后可能要跟我们一起住'],
    options: [
      { label: '「那得先看看房子够不够住」', fx: { affection: -11, mood: -2, money: 3, career: 2 }, reply: '……你先想的是房子' },
      { label: '「什么时候接，我去帮忙」', fx: { affection: 13, mood: 4, family: 8, money: -3 }, correct: true, reply: '……你真的愿意' },
      { label: '「那能不能先请个护工」', fx: { affection: -10, mood: -1, family: -3, career: 2 }, reply: '……请护工一个月六千，你算过吗' }
    ]
  },
  {
    id: 'n_g_family_3',
    kind: 'grill',
    personalityId: 'family',
    phases: ['dating', 'married'],
    minAffection: 35,
    weight: 6,
    opener: ['过年去谁家', '这个问题总得定下来'],
    options: [
      { label: '「轮流，今年你家明年我家」', fx: { affection: 11, mood: 3, family: 5, career: -1 }, correct: true, reply: '……我还以为你要争' },
      { label: '「当然是我家」', fx: { affection: -11, mood: -3, family: -4, career: 2 }, reply: '……凭什么' },
      { label: '「各回各家，谁也别为难」', fx: { affection: -10, mood: 2, career: 3, health: 1 }, reply: '……结婚了还各回各家' }
    ]
  },
  {
    id: 'n_g_career_2',
    kind: 'grill',
    personalityId: 'career',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 6,
    opener: ['有个外派的机会，两年', '升职基本稳了'],
    options: [
      { label: '「去啊，这种机会不是常有」', fx: { affection: 8, mood: 2, career: 6, family: -3 }, correct: true, reply: '……你不拦我' },
      { label: '「两年太久了，你能不能不去」', fx: { affection: -11, mood: -4, career: -3, family: 3 }, reply: '……我以为你会支持我' },
      { label: '「那我们怎么办，你想过吗」', fx: { affection: -10, mood: -4, career: 1, health: 1 }, reply: '……你只问这个？' }
    ]
  },
  {
    id: 'n_g_career_3',
    kind: 'grill',
    personalityId: 'career',
    phases: ['dating', 'married'],
    minAffection: 35,
    weight: 6,
    opener: ['如果我们俩只能有一个人拼事业', '你觉得该是谁'],
    options: [
      { label: '「谁机会好谁上」', fx: { affection: 10, mood: 3, career: 4, family: -2 }, correct: true, reply: '……我还以为你会说你' },
      { label: '「当然是我」', fx: { affection: -12, mood: -4, career: 5, family: -3 }, reply: '……好，我知道了' },
      { label: '「这问题你自己定，问我干嘛」', fx: { affection: -10, mood: 2, family: 2, career: 1 }, reply: '……我在问你的意见' }
    ]
  },

  /* -------------------------------------------------------
   * 暧昧事件（flirt）：按人格定向，每个性格 2 条
   * ----------------------------------------------------- */
  {
    id: 'n_f_money_2',
    kind: 'flirt',
    personalityId: 'money',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 6,
    opener: ['我今天中了三十块彩票', '请你喝奶茶'],
    options: [
      { label: '「三十块就想打发我？」', fx: { affection: 10, mood: 5, money: 1, career: -1 }, correct: true, reply: '那你想怎样，我最多加五块' },
      { label: '「别买，存起来复利」', fx: { affection: -5, mood: -2, money: 3, career: 2 }, reply: '……你真的很扫兴' },
      { label: '「我请你，你那三十自己留着」', fx: { money: -2, affection: 8, mood: 3, career: -1 }, reply: '……你今天吃错药了？' }
    ]
  },
  {
    id: 'n_f_money_3',
    kind: 'flirt',
    personalityId: 'money',
    phases: ['dating', 'married'],
    minAffection: 40,
    weight: 6,
    opener: ['我算了一下', '跟你在一起之后我反而存下钱了'],
    options: [
      { label: '「因为我抠，谢谢夸奖」', fx: { affection: 7, mood: 4, money: 2, career: 1 }, reply: '……不是，是因为不用乱花钱讨好谁' },
      { label: '「那以后工资卡交给我」', fx: { affection: 11, mood: 5, money: 3, family: 2 }, correct: true, reply: '……你还真敢想' },
      { label: '「这说明我值得投资」', fx: { affection: 6, mood: 3, career: 3, looks: -1 }, reply: '……你脸皮是越来越厚了' }
    ]
  },
  {
    id: 'n_f_emo_2',
    kind: 'flirt',
    personalityId: 'emo',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 6,
    opener: ['我给你写了一首诗', '很烂，但是想给你看'],
    options: [
      { label: '「念给我听」', fx: { affection: 12, mood: 6, career: -2, health: -1 }, correct: true, reply: '……不行，太丢人了' },
      { label: '「你什么时候学会写诗了」', fx: { affection: 5, mood: 2, career: 2, family: 0 }, reply: '……就今天' },
      { label: '（转发给了共同好友）', fx: { affection: -15, mood: -5, career: 1, health: 0 }, reply: '……你发给谁了' }
    ]
  },
  {
    id: 'n_f_emo_3',
    kind: 'flirt',
    personalityId: 'emo',
    phases: ['dating', 'married'],
    minAffection: 40,
    weight: 6,
    opener: ['我今天哭了一场', '不知道为什么，就是想哭'],
    options: [
      { label: '「哭了多久，喝水了吗」', fx: { affection: 13, mood: 4, health: 2, career: -2 }, correct: true, reply: '……你怎么不问为什么' },
      { label: '「别哭了，有什么好哭的」', fx: { affection: -13, mood: -6, career: 3, health: 1 }, reply: '……' },
      { label: '「我现在过来」', fx: { affection: 15, mood: 5, health: -2, career: -3 }, reply: '……不用，我在笑' }
    ]
  },
  {
    id: 'n_f_char_2',
    kind: 'flirt',
    personalityId: 'char',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 6,
    opener: ['我发现一家店超级好玩', '你肯定没去过'],
    options: [
      { label: '「你带路，我跟着」', fx: { money: -2, affection: 11, mood: 6, career: -2 }, correct: true, reply: '好！周六不见不散' },
      { label: '「我周末要补觉」', fx: { affection: -7, mood: 1, health: 3, career: 1 }, reply: '……你就不能偶尔陪我疯一次' },
      { label: '「发定位，我自己去一次给你看」', fx: { money: -2, affection: 6, mood: 3, career: 1 }, reply: '……那我不告诉你哪家' }
    ]
  },
  {
    id: 'n_f_char_3',
    kind: 'flirt',
    personalityId: 'char',
    phases: ['dating', 'married'],
    minAffection: 40,
    weight: 6,
    opener: ['我朋友都说我最近变了', '说我眼睛里有光'],
    options: [
      { label: '「那肯定是灯的关系」', fx: { affection: 8, mood: 5, looks: 2, career: -1 }, reply: '……你就不能好好说话' },
      { label: '「因为我？」', fx: { affection: 12, mood: 6, career: -1, health: 0 }, correct: true, reply: '……你说呢' },
      { label: '「那我得见见你朋友」', fx: { affection: 6, mood: 2, family: 3, money: -1 }, reply: '……你想干嘛，查岗吗' }
    ]
  },
  {
    id: 'n_f_casual_2',
    kind: 'flirt',
    personalityId: 'casual',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 6,
    opener: ['今晚月色很好', '要不要出来走走'],
    options: [
      { label: '「这句听起来不像你」', fx: { affection: -4, mood: 1, career: 2, health: 0 }, reply: '……网上学的' },
      { label: '「我穿拖鞋下去，你别笑」', fx: { affection: 12, mood: 6, health: 2, looks: -1 }, correct: true, reply: '快点，风大' },
      { label: '「太晚了，明天吧」', fx: { affection: -9, mood: -3, health: 3, career: 2 }, reply: '……行' }
    ]
  },
  {
    id: 'n_f_casual_3',
    kind: 'flirt',
    personalityId: 'casual',
    phases: ['dating', 'married'],
    minAffection: 40,
    weight: 6,
    opener: ['我这个人不太会说好听的话', '但我想一直这样待着'],
    options: [
      { label: '「那就待着，别动」', fx: { affection: 13, mood: 6, family: 3, career: -2 }, correct: true, reply: '……嗯' },
      { label: '「这就算表白了？」', fx: { affection: -6, mood: -2, career: 2, health: 1 }, reply: '……当我没说' },
      { label: '「我也是，虽然我不知道为什么」', fx: { affection: 11, mood: 5, health: 1, career: -1 }, reply: '……不许反悔' }
    ]
  },
  {
    id: 'n_f_family_2',
    kind: 'flirt',
    personalityId: 'family',
    phases: ['dating', 'married'],
    minAffection: 40,
    weight: 6,
    opener: ['我今天学做了你爱吃的那个菜', '卖相不太好'],
    options: [
      { label: '「给我留一份，我马上到」', fx: { affection: 13, mood: 6, family: 6, health: -1 }, correct: true, reply: '……那你快点，凉了就不好吃了' },
      { label: '「拍张照我看看」', fx: { affection: 6, mood: 3, career: 1, looks: 0 }, reply: '不给，太丑了' },
      { label: '「下次我做吧，你别烫着」', fx: { affection: 9, mood: 3, family: 4, career: -1 }, reply: '……那我下次看你做' }
    ]
  },
  {
    id: 'n_f_family_3',
    kind: 'flirt',
    personalityId: 'family',
    phases: ['dating', 'married'],
    minAffection: 45,
    weight: 6,
    opener: ['我妈让我问你', '什么时候有空来家里吃饭'],
    options: [
      { label: '「这个周末可以，我买点东西」', fx: { money: -3, affection: 12, mood: 4, family: 8 }, correct: true, reply: '……我妈肯定高兴坏了' },
      { label: '「改天吧，我最近忙」', fx: { affection: -8, mood: -2, career: 3, family: -4 }, reply: '……你每次都改天' },
      { label: '「能不能先别跟阿姨说我们」', fx: { affection: -11, mood: -4, career: 2, family: -3 }, reply: '……她早知道了' }
    ]
  },
  {
    id: 'n_f_career_2',
    kind: 'flirt',
    personalityId: 'career',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 6,
    opener: ['刚开完会，脑子还在转', '你陪我说两分钟'],
    options: [
      { label: '「说吧，我听着」', fx: { affection: 10, mood: 3, career: 3, health: -2 }, correct: true, reply: '……你不嫌我烦' },
      { label: '「工作的事别带回家」', fx: { affection: -9, mood: -3, career: 1, health: 2 }, reply: '……好' },
      { label: '「先喝口水，再说」', fx: { affection: 9, mood: 4, health: 3, career: -1 }, reply: '……你怎么这么会' }
    ]
  },
  {
    id: 'n_f_career_3',
    kind: 'flirt',
    personalityId: 'career',
    phases: ['dating', 'married'],
    minAffection: 45,
    weight: 6,
    opener: ['我今天推掉了一个应酬', '想早点回来'],
    options: [
      { label: '「下次别为我推，我不值得」', fx: { affection: -5, mood: -3, career: 4, health: 1 }, reply: '……值不值得我说了算' },
      { label: '「那我给你下碗面」', fx: { money: -1, affection: 13, mood: 6, family: 4 }, correct: true, reply: '……就这么定了' },
      { label: '「是不是那边没意思」', fx: { affection: 2, mood: 1, career: 2, family: -1 }, reply: '……你非要这么理解也行' }
    ]
  },

  /* -------------------------------------------------------
   * 见面前（lead）：还没见过面，只在微信上聊
   * ----------------------------------------------------- */
  {
    id: 'n_l_first',
    phases: ['lead'],
    minAffection: 0,
    weight: 14,
    opener: ['你好，我是王阿姨介绍的那个'],
    options: [
      { label: '「你好，我看过你的资料」', fx: { affection: 4, mood: 2, career: 1, family: 1 }, reply: '资料是王阿姨写的，可能不太准' },
      { label: '「你好，我先说：我照片是三年前的」', fx: { affection: 8, mood: 4, looks: -2, health: 0 }, reply: '哈哈，那我也坦白，我的是修过的' },
      { label: '「嗯。」', fx: { affection: -6, mood: -1, career: 1, health: 0 }, reply: '……' }
    ]
  },
  {
    id: 'n_l_job',
    phases: ['lead'],
    minAffection: 0,
    weight: 12,
    opener: ['你是做什么工作的呀', '王阿姨说得含含糊糊的'],
    options: [
      { label: '（如实说，并补一句「很普通」）', fx: { affection: 5, mood: 2, career: 2, family: 0 }, reply: '普通才好，我怕那种太厉害的' },
      { label: '（含糊带过，反问对方）', fx: { affection: -2, mood: 0, career: 1, health: 1 }, reply: '……你这人，问你还保密' },
      { label: '（说了，并顺手发张工位照）', fx: { affection: 7, mood: 3, career: 3, looks: -1 }, reply: '你们公司看着好乱啊哈哈' }
    ]
  },
  {
    id: 'n_l_why',
    phases: ['lead'],
    minAffection: 0,
    weight: 11,
    opener: ['说实话', '你怎么还单着'],
    options: [
      { label: '「因为我挑，现在在挑你」', fx: { affection: 9, mood: 4, career: -1, looks: 1 }, reply: '……你这话挺会的' },
      { label: '「工作太忙，圈子小」', fx: { affection: 3, mood: 0, career: 3, health: -1 }, reply: '大家都这么说' },
      { label: '「因为之前有一段，不太想提」', fx: { affection: -3, mood: -3, family: 2, health: 0 }, reply: '……对不起，我不该问' }
    ]
  },
  {
    id: 'n_l_photo_ask',
    phases: ['lead'],
    minAffection: 5,
    weight: 11,
    opener: ['能发张现在的照片吗', '我怕见面认不出来'],
    options: [
      { label: '（原相机，直接发）', fx: { affection: 8, mood: -1, looks: -1, health: 0 }, reply: '……还不错，比王阿姨给的那张真实' },
      { label: '（发一张风景照岔开）', fx: { affection: -5, mood: 1, career: 1, looks: 1 }, reply: '……我要看的是你' },
      { label: '「见面看吧，照片不准」', fx: { affection: 6, mood: 3, looks: 2, career: -1 }, reply: '……那你要是骗我呢' }
    ]
  },
  {
    id: 'n_l_meet_ask',
    phases: ['lead'],
    minAffection: 8,
    weight: 12,
    opener: ['要不我们见一面？', '光聊天也聊不出什么'],
    options: [
      { label: '「好，你选地方，我订」', fx: { money: -2, affection: 10, mood: 4, career: -1 }, reply: '那我选了，别嫌贵' },
      { label: '「再聊几天吧，我有点紧张」', fx: { affection: 3, mood: -2, health: 2, family: 1 }, reply: '……紧张什么，我又不会吃了你' },
      { label: '「行，中午还是晚上」', fx: { affection: 7, mood: 3, career: 2, health: -1 }, reply: '晚上吧，中午太赶了' }
    ]
  },
  {
    id: 'n_l_hobby',
    phases: ['lead'],
    minAffection: 5,
    weight: 11,
    opener: ['你平时下班都干嘛'],
    options: [
      { label: '「躺平，什么都不干」', fx: { affection: 5, mood: 3, health: 2, career: -2 }, reply: '……真坦诚，我也是' },
      { label: '（说一个很小众的爱好）', fx: { affection: 8, mood: 4, career: 1, family: -1 }, reply: '这个我还真没听过，你给我讲讲' },
      { label: '「加班，一般加到九点」', fx: { affection: -2, mood: -3, career: 5, health: -3 }, reply: '……那你要注意身体' }
    ]
  },
  {
    id: 'n_l_family_ask',
    phases: ['lead'],
    minAffection: 10,
    weight: 9,
    opener: ['你家几口人呀', '我是独生女'],
    options: [
      { label: '（如实说，并提一句家里催得紧）', fx: { affection: 6, mood: -2, family: 4, career: 0 }, reply: '……我妈也催' },
      { label: '「这个见面再说吧」', fx: { affection: -4, mood: -1, career: 2, health: 1 }, reply: '……好正式的问题吗' },
      { label: '（说了，顺便问对方父母身体）', fx: { affection: 9, mood: 3, family: 6, career: -1 }, reply: '你还挺细心的' }
    ]
  },
  {
    id: 'n_l_late_night',
    phases: ['lead'],
    minAffection: 10,
    weight: 10,
    opener: ['这么晚还不睡', '在干嘛呢'],
    options: [
      { label: '「在看你朋友圈，翻到 2019 年」', fx: { affection: 11, mood: 5, career: -2, health: -2 }, reply: '……你别翻了，太丢人' },
      { label: '「在想明天见面穿什么」', fx: { affection: 9, mood: 4, looks: 3, career: -1 }, reply: '……你别太隆重，我压力大' },
      { label: '「准备睡了，晚安」', fx: { affection: -3, mood: 0, health: 3, career: 2 }, reply: '……好吧，晚安' }
    ]
  },

  /* -------------------------------------------------------
   * 必须出门约会（mustdate）：主动聊天累计到阈值后必出
   * ----------------------------------------------------- */
  {
    id: 'n_mustdate_2',
    kind: 'mustdate',
    phases: ['lead', 'meeting', 'talking', 'dating', 'married'],
    minAffection: 0,
    weight: 20,
    opener: ['我们聊了这么久', '总在手机上也说不清楚', '这周见一面吧'],
    options: [
      { label: '「好，我订地方，你定时间」', fx: { money: -3, affection: 10, mood: 5, career: -2 }, reply: '那就这周六，我等你地址' },
      { label: '「我最近实在抽不开身」', fx: { affection: -7, mood: -3, career: 4, health: -1 }, reply: '……那再等等吧' },
      { label: '「要不见面先别吃饭，喝杯咖啡就行」', fx: { money: -1, affection: 6, mood: 3, career: 0 }, reply: '这个可以，压力小点' }
    ]
  },
  {
    id: 'n_mustdate_3',
    kind: 'mustdate',
    phases: ['lead', 'meeting', 'talking', 'dating', 'married'],
    minAffection: 5,
    weight: 20,
    opener: ['我发现我们每次都只聊到一半', '打字太慢了', '出来吧，就在你公司附近'],
    options: [
      { label: '「那我下班在那儿等你」', fx: { affection: 12, mood: 6, health: -1, career: -2 }, reply: '好，我带伞' },
      { label: '「明天吧，今天我状态不好」', fx: { affection: -5, mood: 1, health: 3, career: 1 }, reply: '……那你早点睡' },
      { label: '「你就在楼下？我现在下来」', fx: { affection: 14, mood: 7, career: -3, health: -2 }, reply: '……你真下来了？我还没收拾' }
    ]
  },

  /* ---------------- 现实向 / 人格定向日常（normal）第二批 ---------------- */
  {
    id: 'n_c_real_rent',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 9,
    personalityId: 'money',
    opener: ['房东说下个月涨租', '一个月多六百'],
    options: [
      { label: '「我帮你看看别的房子」', fx: { affection: 9, mood: 3, money: 2, career: -2 }, reply: '……你还真会帮我算' },
      { label: '「要不搬到我这边来？」（说完自己愣了）', fx: { affection: 13, mood: 5, family: 5, career: -2 }, reply: '……你再说一遍' },
      { label: '「六百还好吧」', fx: { affection: -8, mood: -2, career: 2, money: 1 }, reply: '……对你来说是还好' }
    ]
  },
  {
    id: 'n_c_real_overtime_2',
    phases: ['talking', 'dating', 'married'],
    minAffection: 18,
    weight: 9,
    personalityId: 'career',
    opener: ['刚下班，地铁末班车赶不上了'],
    options: [
      { label: '「打车，我给你报销一半」', fx: { money: -2, affection: 10, mood: 3, career: -1 }, reply: '……那我截图给你' },
      { label: '「下次早点走」', fx: { affection: -5, mood: -2, career: 3, health: 2 }, reply: '……你以为我不想' },
      { label: '「我去接你」', fx: { affection: 14, mood: 6, health: -3, career: -3 }, reply: '……这么晚，你别来了' }
    ]
  },
  {
    id: 'n_c_real_silence',
    phases: ['talking', 'dating', 'married'],
    minAffection: 22,
    weight: 9,
    personalityId: 'emo',
    opener: ['你今天一句话都没说', '我不问，但我在意'],
    options: [
      { label: '「我今天被骂了，不想说话」', fx: { affection: 11, mood: 3, health: 1, career: -2 }, reply: '……那你现在想说了吗' },
      { label: '「没事」', fx: { affection: -8, mood: -3, career: 2, health: 1 }, reply: '……' },
      { label: '「那你先说你的」', fx: { affection: 5, mood: 2, family: 2, career: -1 }, reply: '我今天也一般' }
    ]
  },
  {
    id: 'n_c_real_party',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 9,
    personalityId: 'char',
    opener: ['我在朋友聚会，好吵', '但是想跟你说句话'],
    options: [
      { label: '「玩你的，别管我」', fx: { affection: 6, mood: 2, career: 2, family: 1 }, reply: '……那我挂了' },
      { label: '「你喝了多少」', fx: { affection: 10, mood: 3, health: 2, career: -1 }, reply: '两杯，不多' },
      { label: '（发一句「我想你了」，然后撤回）', fx: { affection: 13, mood: 6, health: -1, career: -1 }, reply: '……我看见了' }
    ]
  },
  {
    id: 'n_c_real_plan',
    phases: ['talking', 'dating', 'married'],
    minAffection: 20,
    weight: 9,
    personalityId: 'casual',
    opener: ['我订了机票', '下个月去一个没人认识我的地方'],
    options: [
      { label: '「一个人？」', fx: { affection: 5, mood: -2, career: 2, health: 0 }, reply: '……嗯，一个人' },
      { label: '「我请假陪你去」', fx: { money: -5, affection: 12, mood: 5, career: -4 }, reply: '……你疯了' },
      { label: '「记得发照片」', fx: { affection: 4, mood: 2, career: 1, family: 0 }, reply: '……就这句？' }
    ]
  },
  {
    id: 'n_c_real_parent_2',
    phases: ['dating', 'married'],
    minAffection: 40,
    weight: 8,
    personalityId: 'family',
    opener: ['我妈给你织了双拖鞋', '我说不合适，她非要织'],
    options: [
      { label: '「替我谢谢阿姨，我会穿的」', fx: { affection: 12, mood: 5, family: 8, looks: -1 }, reply: '……她肯定高兴坏了' },
      { label: '「这个……不太好吧」', fx: { affection: -7, mood: -2, family: -4, career: 2 }, reply: '……我就说不合适' },
      { label: '「我也给她买了护膝」', fx: { money: -3, affection: 13, mood: 5, family: 9 }, reply: '……你什么时候买的' }
    ]
  },
  {
    id: 'n_c_save_plan',
    phases: ['dating', 'married'],
    minAffection: 35,
    weight: 8,
    opener: ['我开了个共同账户', '每个月各存一千，年底去看海'],
    options: [
      { label: '「好，我明天就转」', fx: { money: -3, affection: 11, mood: 5, family: 3 }, reply: '……你居然不问我打算存多少' },
      { label: '「共同账户？这也太认真了」', fx: { affection: -6, mood: -2, career: 2, money: 2 }, reply: '……我不该提的' },
      { label: '「一千太少，两千吧」', fx: { money: -5, affection: 9, mood: 3, career: 2 }, reply: '……你想清楚了' }
    ]
  },
  {
    id: 'n_c_old_friend',
    phases: ['talking', 'dating', 'married'],
    minAffection: 18,
    weight: 9,
    opener: ['我一个十年没联系的朋友突然找我', '开口就借钱'],
    options: [
      { label: '「你打算借吗」', fx: { affection: 7, mood: 1, career: 2, family: 1 }, reply: '……我不知道，你说呢' },
      { label: '「别借，十年不联系的人不靠谱」', fx: { affection: -4, mood: -1, money: 3, career: 2 }, reply: '……你倒是干脆' },
      { label: '「要多少，我先给你」', fx: { money: -5, affection: 12, mood: 4, career: -2 }, reply: '……你干嘛对我这么好' }
    ]
  },
  {
    id: 'n_c_body',
    phases: ['talking', 'dating', 'married'],
    minAffection: 25,
    weight: 8,
    opener: ['我最近胖了五斤', '你不准说没看出来'],
    options: [
      { label: '「看出来了。」', fx: { affection: -9, mood: -4, career: 1, health: 0 }, reply: '……' },
      { label: '「胖哪儿了，我摸摸」（然后挨了一下）', fx: { affection: 11, mood: 6, looks: 1, career: -1 }, reply: '……你找打' },
      { label: '「那我们一起少吃点」', fx: { affection: 8, mood: 2, health: 3, career: -1 }, reply: '……你陪我？' }
    ]
  },
  {
    id: 'n_c_bad_day',
    phases: ['talking', 'dating', 'married'],
    minAffection: 15,
    weight: 10,
    opener: ['今天一整天都不顺', '早上迟到，中午丢了东西，晚上还淋雨'],
    options: [
      { label: '「一天倒霉三次，明天该转运了」', fx: { affection: 9, mood: 5, health: 1, career: -1 }, reply: '……借你吉言' },
      { label: '「我给你讲个我今天出的糗」', fx: { affection: 11, mood: 6, looks: -1, career: -1 }, reply: '哈哈哈哈你也有今天' },
      { label: '「早点睡，明天就好了」', fx: { affection: 1, mood: 0, health: 3, career: 2 }, reply: '……哦' }
    ]
  },
  {
    id: 'n_c_shopping',
    phases: ['dating', 'married'],
    minAffection: 30,
    weight: 8,
    opener: ['我看了件大衣，一千二', '好看是好看，就是太贵'],
    options: [
      { label: '「我买给你，就当提前送生日礼物」', fx: { money: -6, affection: 13, mood: 6, career: -2 }, reply: '……你是不是疯了' },
      { label: '「喜欢就买，别算那么清楚」', fx: { money: -3, affection: 8, mood: 4, career: 1 }, reply: '……你说的啊' },
      { label: '「看看有没有同款便宜的」', fx: { money: 3, affection: -6, mood: -2, career: 2 }, reply: '……算了，不买了' }
    ]
  },
  {
    id: 'n_c_sleep_habit',
    phases: ['married'],
    minAffection: 50,
    weight: 8,
    opener: ['你睡觉打呼', '我昨晚没睡好'],
    options: [
      { label: '「那你掐我，我翻个身」', fx: { affection: 9, mood: 4, health: 1, career: -1 }, reply: '……我掐了，你没反应' },
      { label: '「要不我去看下医生」', fx: { money: -3, affection: 11, mood: 4, health: 3 }, reply: '……你真愿意去' },
      { label: '「那你戴耳塞」', fx: { affection: -7, mood: -3, career: 2, health: 2 }, reply: '……' }
    ]
  },
  {
    id: 'n_c_hometown',
    phases: ['talking', 'dating', 'married'],
    minAffection: 22,
    weight: 9,
    opener: ['我刚跟我妈通完电话', '她说家里下雪了'],
    options: [
      { label: '「你想家了？」', fx: { affection: 10, mood: 3, family: 4, career: -1 }, reply: '……有一点' },
      { label: '「这边也冷，多穿点」', fx: { affection: 6, mood: 2, health: 2, career: 0 }, reply: '……嗯' },
      { label: '「过年我陪你回去」', fx: { money: -4, affection: 14, mood: 5, family: 8 }, reply: '……你说真的' }
    ]
  },
  {
    id: 'n_c_last_word',
    phases: ['dating', 'married'],
    minAffection: 48,
    weight: 8,
    opener: ['如果有一天我们分开了', '你会记得我什么'],
    options: [
      { label: '「别问这种问题」', fx: { affection: -4, mood: -4, career: 2, health: 1 }, reply: '……我就问问' },
      { label: '「记得你第一次给我发消息，手抖打错三个字」', fx: { affection: 15, mood: 7, career: -2, health: -1 }, reply: '……你怎么记得那么清楚' },
      { label: '「不会有那一天」', fx: { affection: 11, mood: 5, family: 3, career: -1 }, reply: '……不许骗我' }
    ]
  }
];
