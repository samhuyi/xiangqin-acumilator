/* =========================================================
 * 扩充事件（按「结算规则 1」新写）
 * ---------------------------------------------------------
 * 规则：
 *   · 每个选项都对多个属性生效（不再只有情绪 + 金钱），且同时有增有减；
 *     这里只写「意图」，最终数值由 gen-seed 的 enrichFx 统一放大并补齐到 5 个属性。
 *   · 选项要出人意料：不做「对人好 / 对人坏」的二选一，
 *     而是具体、有点怪、后果也说不清的举动。
 *   · 奖惩幅度加大，选择要有分量。
 *
 * phase 取值：single / talking / dating / married / meeting / date / any
 * date 阶段另需 dateType：simple / standard / activity
 * ========================================================= */

'use strict';

module.exports = [
  /* ---------------- any：日常生活 ---------------- */
  {
    id: 'n_any_takeout_late',
    phase: 'any',
    weight: 10,
    text: [
      '外卖超时四十分钟。骑手打电话来，声音是喘的：「电梯坏了，我爬上来的。」',
      '门一开，他额头上全是汗，手里那袋汤洒了一半。'
    ],
    options: [
      { label: '先递张纸巾，说「不着急」', fx: { mood: 5, money: -20, health: 1, career: -1 }, result: '他愣了一下，把找零硬塞回你手里。那天晚上的饭有点凉，但你吃得很慢。' },
      { label: '当面给个差评', fx: { mood: -4, money: 30, health: -1, career: 0, looks: -1 }, result: '平台退了三十块。你盯着那三十块，忽然觉得自己挺没劲的。' },
      { label: '把洒了的汤倒进碗里，请他一起坐会儿', fx: { mood: 8, money: -60, health: 2, career: -2, family: 1 }, result: '他摆手说还有单，走前说了句「哥你人真好」。你一个人把两碗汤喝完了。' }
    ]
  },
  {
    id: 'n_any_elevator_neighbor',
    phase: 'any',
    weight: 9,
    text: [
      '电梯里碰到隔壁那户，已经在这层住了三年，你第一次看清他的脸。',
      '他提着两袋菜，冲你点了点头。'
    ],
    options: [
      { label: '主动问一句「您也刚下班？」', fx: { mood: 4, health: 1, career: 0, family: 2 }, result: '他一下打开了话匣子，从菜价讲到物业费。十二楼到了，你们都还没说完。' },
      { label: '盯着楼层数字，一句话不说', fx: { mood: -1, health: 0, career: 1, family: -2 }, result: '电梯门开了，两人一前一后走出去，各自进各自的门。走廊很安静。' },
      { label: '突然说「我下周搬家，要不下周来我家吃饭」', fx: { mood: 6, money: -200, health: 2, career: -1, family: 3 }, result: '他被你吓了一跳，随即笑了：「行啊，我带瓶酒。」你其实还没找到房子。' }
    ]
  },
  {
    id: 'n_any_gym_sales',
    phase: 'any',
    weight: 9,
    text: [
      '健身房的小伙子在地铁口堵住你：「哥，了解一下，今天办卡送三个月。」',
      '他手里的传单印着八块腹肌，和你隔着两个世界。'
    ],
    options: [
      { label: '办一张，然后一次没去', fx: { money: -2400, mood: -3, health: -1, career: 0, looks: 0 }, result: '卡躺在抽屉里。每次看到它，你都想起来那是半个月的房租。' },
      { label: '说「不用了」，然后回家做二十个俯卧撑', fx: { health: 6, mood: 3, money: 0, career: -1, looks: 2 }, result: '做到第十五个你趴在地上不动了。但那天晚上你睡得特别沉。' },
      { label: '反问他「你一个月挣多少」', fx: { mood: 2, career: 3, money: 0, health: 0, family: -1 }, result: '他愣住了，然后认真跟你算了一遍提成。你听完只说了一句「都不容易」。' }
    ]
  },
  {
    id: 'n_any_classmate_borrow',
    phase: 'any',
    weight: 10,
    text: [
      '八百年没联系的老同学发来消息：「最近手头紧，能借两千吗？下个月还。」',
      '上一条消息还是三年前的群发祝福。'
    ],
    options: [
      { label: '转两千过去，不问他干什么用', fx: { money: -2000, mood: 3, family: 2, career: -1 }, result: '他回了个抱拳的表情。你没指望他还，但心里踏实了一些。' },
      { label: '回「我也挺紧的」', fx: { money: 0, mood: -3, family: -2, career: 1 }, result: '对面沉默了很久，回了个「没事」。你们又回到了八年不联系的状态。' },
      { label: '问清楚用途，只借五百', fx: { money: -500, mood: 1, family: 1, career: 2 }, result: '他支支吾吾说了半天。你没戳破。这五百块你们都心知肚明，是买断一段关系。' }
    ]
  },
  {
    id: 'n_any_landlord_raise',
    phase: 'any',
    weight: 10,
    text: [
      '房东发来语音：「下个月起每月加四百，你也知道现在行情。」',
      '你算了算，加完之后工资就只剩个零头。'
    ],
    options: [
      { label: '答应下来，转头把外卖戒了', fx: { money: -400, mood: -4, health: 3, career: -1 }, result: '你学会了煮挂面。第三周的时候，你发现自己居然瘦了四斤。' },
      { label: '据理力争，把周边房价都查了一遍发给他', fx: { money: 0, mood: -2, career: 4, health: -2, family: 0 }, result: '他被你那份表格镇住了，改口说「那就加两百吧」。你赢了，但赢得很累。' },
      { label: '说「我搬走」，然后真的开始看房', fx: { money: -800, mood: -6, health: -3, career: -2, family: 1 }, result: '搬家那天下雨。你抱着箱子站在路口，忽然觉得这座城市没有一盏灯是为你亮的。' }
    ]
  },
  {
    id: 'n_any_phone_crack',
    phase: 'any',
    weight: 9,
    text: [
      '手机从桌上滑下去，屏幕朝下。',
      '你捡起来的时候，裂纹已经从右上角爬到了中间，像一张蜘蛛网。'
    ],
    options: [
      { label: '立刻去修，花掉半天和一个下午的工资', fx: { money: -700, mood: -2, career: -2, health: 0 }, result: '修完天已经黑了。你拿着完好如初的手机，却不知道该给谁发消息。' },
      { label: '不修了，就这么用', fx: { money: 0, mood: -3, looks: -2, career: -1, health: 1 }, result: '裂纹挡住了半个字，你反而看得更慢了。有天下班你发现，你开始少看手机。' },
      { label: '把裂纹拍下来发朋友圈，配文「花的」', fx: { mood: 6, money: 0, looks: 1, career: 1, family: 0 }, result: '底下有人评论「求推荐手机壳」。你忽然笑了，第一次觉得这事没那么糟。' }
    ]
  },
  {
    id: 'n_any_team_building',
    phase: 'any',
    weight: 9,
    text: [
      '团建定在周六，去郊区爬山。群里一片「收到」，你盯着屏幕看了很久。',
      '那天你本来约了人。'
    ],
    options: [
      { label: '去，并且一路扶着领导上山', fx: { career: 8, mood: -4, health: -3, money: 0, family: -1 }, result: '周一例会上，领导点名表扬了你。你笑着点头，腿还在抖。' },
      { label: '装病请假，在家躺一整天', fx: { career: -5, mood: 5, health: 4, money: 0 }, result: '你睡到中午，看了半部电影。傍晚有人发来山顶的合照，你划过去了。' },
      { label: '去，但在半山腰坐下来跟实习生聊天', fx: { career: 2, mood: 6, health: -1, family: 2 }, result: '那小孩刚毕业，说了很多真心话。下山时你们走在一起，谁也没提工作。' }
    ]
  },
  {
    id: 'n_any_subway_seat',
    phase: 'any',
    weight: 8,
    text: [
      '地铁上你终于抢到一个座。下一站上来一位抱着孩子的女人，站在你面前。',
      '车厢很挤，所有人都在看手机。'
    ],
    options: [
      { label: '立刻站起来让座', fx: { mood: 5, health: -1, career: 0, looks: 1, family: 2 }, result: '她连说了三声谢谢。你抓着扶手站了七站，到家时肩膀是酸的。' },
      { label: '假装没看见，把头扭向窗户', fx: { mood: -4, health: 1, career: 0, looks: -1, family: -2 }, result: '你到站时逃也似地下了车。那天晚上你翻来覆去，一直想着那个小孩。' },
      { label: '站起来，但顺手帮她把孩子接过来抱着', fx: { mood: 8, health: -2, career: 0, looks: 2, family: 3 }, result: '孩子在你怀里睡着了。她下车时说「你以后一定是个好爸爸」。你愣在原地。' }
    ]
  },
  {
    id: 'n_any_insomnia',
    phase: 'any',
    weight: 9,
    text: [
      '凌晨三点，你还是清醒的。天花板上有车灯划过的光，一道，又一道。',
      '明天九点还有个会。'
    ],
    options: [
      { label: '爬起来把明天的方案重做一遍', fx: { career: 6, health: -5, mood: -2, money: 0 }, result: '天亮时你做完了。会上你说得很顺，只是眼前有点发黑。' },
      { label: '吃半片安眠药，强迫自己睡', fx: { health: -2, mood: 3, career: 0, money: -50 }, result: '你睡了四个小时，像被人打晕了一样。醒来时头疼，但至少睡了。' },
      { label: '不睡了，出门走到天亮', fx: { mood: 6, health: -4, career: -2, looks: 1, money: -30 }, result: '你走到了江边，看了日出。那天你迟到了，但一点也不后悔。' }
    ]
  },
  {
    id: 'n_any_market_bargain',
    phase: 'any',
    weight: 8,
    text: [
      '菜市场里，摊主大姐报了个价，你下意识觉得贵。',
      '她一边给你装菜一边说：「小伙子，现在什么都贵。」'
    ],
    options: [
      { label: '认真砍价，砍下来三块', fx: { money: 3, mood: 2, career: 1, health: 0, family: -1 }, result: '大姐一边骂你小气一边给你多抓了把葱。你拎着菜，觉得自己赢了。' },
      { label: '不砍了，多给她五块', fx: { money: -5, mood: 5, family: 3, career: 0, health: 1 }, result: '她愣了，非要塞给你两个西红柿。回家的路上你心情莫名地好。' },
      { label: '跟她聊起各自的生意，聊了二十分钟', fx: { mood: 7, career: 2, family: 2, money: -10, health: 0 }, result: '她给你讲了她儿子考研的事。你走的时候，她喊「下次再来啊」。' }
    ]
  },
  {
    id: 'n_any_old_photo',
    phase: 'any',
    weight: 8,
    text: [
      '整理抽屉时翻出一张旧照片，是你和几个人的合影，背景是学校的操场。',
      '你已经叫不出其中两个人的名字了。'
    ],
    options: [
      { label: '把照片夹回书里，继续收拾', fx: { mood: -1, career: 1, family: 0, health: 0 }, result: '你手快了半秒，收住了那个念头。抽屉关上，声音很轻。' },
      { label: '拍下来，发到那个沉寂多年的群里', fx: { mood: 7, family: 3, career: -1, health: 1 }, result: '群里炸了。有人认出了那两个人，有人开始约饭。那天晚上你笑了很多次。' },
      { label: '盯着照片看了半小时，然后烧掉', fx: { mood: -6, career: 0, family: -3, health: -1 }, result: '灰烬落在垃圾桶里。你想不起来自己为什么要这么做。' }
    ]
  },
  {
    id: 'n_any_rain_no_umbrella',
    phase: 'any',
    weight: 8,
    text: [
      '下班时下起了雨，很大。你站在公司门口，没带伞。',
      '同事举着伞从你身边走过，犹豫了一下。'
    ],
    options: [
      { label: '冲进雨里跑回家', fx: { health: -4, mood: 3, money: 0, looks: -1, career: 0 }, result: '你跑了两站路，浑身湿透。到家时你站在门口笑，像个傻子。' },
      { label: '问同事能不能蹭一段', fx: { mood: 4, career: 2, family: 1, health: 1 }, result: '伞很小，你们挤得很近。那段路你们聊了工作之外的事。' },
      { label: '回公司加班，等雨停', fx: { career: 5, health: -2, mood: -2, money: 0 }, result: '雨停时已经九点。你做完了明天的活，走出大楼，空气是干净的。' }
    ]
  },
  {
    id: 'n_any_haircut',
    phase: 'any',
    weight: 8,
    text: [
      '理发师问你想剪什么样。你指了指墙上的海报，他说「这个要打理的」。',
      '你看了一眼镜子里那个头发已经盖住耳朵的人。'
    ],
    options: [
      { label: '「就剪短点，好打理。」', fx: { money: -40, looks: 2, mood: 2, career: 1 }, result: '剪完你摸了摸后脑勺，很凉快。同事说你精神了。' },
      { label: '「就按海报上那个来。」', fx: { money: -180, looks: 5, mood: 3, career: 0, health: -1 }, result: '你每天早上多了十五分钟。但那天相亲，对方多看了你两眼。' },
      { label: '「你看着办吧。」然后闭上眼', fx: { money: -60, looks: -2, mood: 4, career: 0, family: 1 }, result: '剪完你睁开眼，还算能看。有时候把决定权交出去，反而轻松。' }
    ]
  },
  {
    id: 'n_any_mom_calls',
    phase: 'any',
    weight: 10,
    text: [
      '我妈打来电话，第一句是「吃了吗」。',
      '你知道她真正想问的不是这个。'
    ],
    options: [
      { label: '「吃了。妈，我挺好的。」', fx: { mood: 3, family: -1, career: 0, health: 0 }, result: '她「嗯」了一声，又叮嘱了几句就挂了。你握着手机，知道她没信。' },
      { label: '把最近倒霉的事全说了', fx: { mood: -2, family: 5, health: 1, career: -1, money: 0 }, result: '她在那头沉默了很久，说「要不回来吧」。你说「不用」，眼眶有点热。' },
      { label: '反问「你和我爸最近怎么样」', fx: { family: 6, mood: 4, career: 0, health: 0 }, result: '她愣了一下，然后絮絮叨叨讲了起来。你第一次发现，她也需要人听。' }
    ]
  },
  {
    id: 'n_any_salary_raise_talk',
    phase: 'any',
    weight: 9,
    text: [
      '年度述职，你准备了一版 PPT，最后一页写着期望薪资。',
      '轮到你时，领导正在看手机。'
    ],
    options: [
      { label: '照着 PPT 讲完，最后一页也念出来', fx: { career: 6, money: 800, mood: -2, health: -1 }, result: '领导抬起了头，说了句「我考虑一下」。那个月工资多了八百。' },
      { label: '跳过最后一页，只讲业绩', fx: { career: 3, money: 0, mood: -4, health: 0, family: 0 }, result: '你讲完，领导说「辛苦了」。你走出会议室，把那页 PPT 永久删了。' },
      { label: '关掉 PPT，直接说「我想聊聊我的未来」', fx: { career: 7, money: 1200, mood: 3, health: -2, family: 0 }, result: '领导放下手机，看了你很久。那天你们聊了四十分钟，比任何一次述职都长。' }
    ]
  },

  /* ---------------- single：单身期 ---------------- */
  {
    id: 'n_single_xiangqinjiao',
    phase: 'single',
    weight: 10,
    text: [
      '周末被我妈拉去公园的相亲角。一张张 A4 纸挂在绳子上，写着年龄、学历、房、车。',
      '她掏出早就打印好的那张，找了个空隙挂上去。'
    ],
    options: [
      { label: '趁她不注意，把纸上的「有房」划掉', fx: { mood: 4, family: -3, career: 0, looks: 0 }, result: '她发现时气得说不出话。你说「本来就没有」，她沉默了很久。' },
      { label: '帮她把纸挂正，还用手抚平了卷边', fx: { family: 6, mood: -2, career: 0, health: 0 }, result: '她眼眶有点红，说「我儿子其实挺好的」。你在旁边假装看别处。' },
      { label: '掏出笔，在纸背面写「本人不知情，请勿打扰」', fx: { mood: 7, family: -6, career: 0, looks: 1 }, result: '那天下午没人来问。回家的路上我妈一句话没说，你却睡了个好觉。' }
    ]
  },
  {
    id: 'n_single_app_intro',
    phase: 'single',
    weight: 10,
    text: [
      '注册相亲软件，卡在「自我介绍」这一栏。',
      '光标闪了两分钟，你一个字也没打出来。'
    ],
    options: [
      { label: '照实写：「普通上班族，话不多，会做饭。」', fx: { mood: 3, looks: 1, career: 0, family: 1 }, result: '匹配的人不多，但打招呼的第一句都很正常。你觉得这样挺好。' },
      { label: '写一句莫名其妙的话：「我养了十三盆多肉。」', fx: { mood: 6, looks: 3, career: -1, money: 0 }, result: '居然有三个人因为这个来搭话。其中一个说她也养多肉。' },
      { label: '把年薪和房产都写上去，再补一句「非诚勿扰」', fx: { money: 0, mood: -3, looks: -2, career: 2, family: -1 }, result: '来的人明显多了。你聊了三天，发现没有一个人问过你喜欢什么。' }
    ]
  },
  {
    id: 'n_single_hotpot_alone',
    phase: 'single',
    weight: 9,
    text: [
      '一个人去吃火锅。服务员把一只熊放在对面座位上，说「这样不孤单」。',
      '那只熊穿着围裙，笑得很标准。'
    ],
    options: [
      { label: '把熊转过去，让它面朝墙', fx: { mood: -2, looks: 0, health: 1, career: 0 }, result: '你安安静静吃完了。结账时服务员说「下次带朋友来啊」。' },
      { label: '给熊也点了一份，还跟它碰杯', fx: { mood: 7, health: 2, money: -30, looks: -1, career: 0 }, result: '邻桌的小孩指着你笑。你冲他举了举杯，他也举了起来。' },
      { label: '拍张照发给我妈，配文「有人陪」', fx: { family: 4, mood: 3, money: 0, career: 0, health: 0 }, result: '她回了个「那就好」，还点了个赞。你收起手机，继续涮毛肚。' }
    ]
  },
  {
    id: 'n_single_mom_fake_ill',
    phase: 'single',
    weight: 10,
    text: [
      '我妈在电话里咳嗽了两声，说「没事，老毛病」。',
      '你听出来那两声是刻意压着嗓子的。'
    ],
    options: [
      { label: '当场订票，周末就回', fx: { money: -900, family: 7, mood: -2, career: -2, health: 0 }, result: '到家发现她正在跳广场舞。她愣了一下，随即笑得特别开心。' },
      { label: '说「我给你约个号，你去做个检查」', fx: { money: -300, family: 4, career: 0, mood: 0, health: 1 }, result: '她支吾了半天，说「不用不用」。你坚持，最后她去了，一切正常。' },
      { label: '直接说「你是不是又在装病催我」', fx: { family: -4, mood: 3, career: 0, health: 0 }, result: '电话那头静了三秒，然后她说「我是想你了」。你一下子说不出话。' }
    ]
  },
  {
    id: 'n_single_reunion_interrogate',
    phase: 'single',
    weight: 9,
    text: [
      '同学聚会，酒过三巡，话题准时转到了你身上。',
      '「你条件不差啊，怎么还单着？」'
    ],
    options: [
      { label: '举杯认罚：「是我挑，行了吧。」', fx: { mood: -3, career: 1, family: 1, health: -1 }, result: '大家笑着放过了你。你干了那杯酒，辣得眼睛发酸。' },
      { label: '反问「你们谁过得特别幸福，说说」', fx: { mood: 5, career: 2, family: -2, health: 0 }, result: '桌上安静了。有人开始倒苦水，最后话题转到房价上去了。' },
      { label: '掏出手机给大家看你的存款余额', fx: { mood: 2, money: 0, career: -2, family: -3, looks: 0 }, result: '气氛微妙地变了。没人再问你感情的事，但也没人再跟你说话。' }
    ]
  },
  {
    id: 'n_single_ex_wedding',
    phase: 'single',
    weight: 9,
    text: [
      '深夜刷到前任的婚纱照。九宫格，笑得很用力。',
      '你盯着看了很久，手指悬在屏幕上。'
    ],
    options: [
      { label: '点个赞，然后关掉手机', fx: { mood: 4, career: 0, family: 1, health: 1 }, result: '第二天她发来一句「谢谢」。你们都没再说话，但这件事算是过去了。' },
      { label: '把手机扣过去，起来倒了杯水', fx: { mood: 3, health: 2, career: 1, family: 0 }, result: '你站在阳台上喝完了那杯水。夜风很凉，你想了很多，也想通了一些。' },
      { label: '翻到她三年前给你写的那段话，重读一遍', fx: { mood: -6, career: -2, health: -2, family: 0 }, result: '那句话你倒背如流。看完你删掉了聊天记录，然后失眠到四点。' }
    ]
  },
  {
    id: 'n_single_keep_cat',
    phase: 'single',
    weight: 9,
    text: [
      '小区门口有只流浪猫，连着三天都在同一个位置。',
      '第四天你下班，它还在。'
    ],
    options: [
      { label: '买根火腿肠，蹲下来喂它', fx: { mood: 7, money: -20, health: 1, family: 2, career: 0 }, result: '它吃得很急，吃完蹭了蹭你的裤腿。你蹲在那儿，忽然不想起来。' },
      { label: '抱回家，第二天带去打疫苗', fx: { money: -600, mood: 8, health: 2, career: -1, family: 3 }, result: '它躲了两天沙发底下，第三天跳上了你的床。你开始回家有盼头了。' },
      { label: '走过去，假装没看见', fx: { mood: -3, money: 0, health: 0, career: 1, family: 0 }, result: '你走了十几米，回头看了一眼。它还在那儿。那晚你做了个梦。' }
    ]
  },
  {
    id: 'n_single_learn_cook',
    phase: 'single',
    weight: 8,
    text: [
      '你决定学做菜。理由很荒唐：万一以后有人来家里吃饭。',
      '第一道菜是番茄炒蛋，你查了三个教程。'
    ],
    options: [
      { label: '严格按教程来，称了克数', fx: { health: 4, mood: 3, money: -60, career: 0, looks: 1 }, result: '成品居然能吃。你拍了张照，没发出去，自己看了两遍。' },
      { label: '随手做，盐放多了', fx: { health: -1, mood: 4, money: -30, career: 0 }, result: '齁得你喝了三杯水。但你把一整盘都吃完了，因为是自己的。' },
      { label: '做了两份，给隔壁送一份', fx: { health: 3, mood: 7, money: -50, family: 4, career: -1 }, result: '隔壁门开了一条缝，后来变成了常来常往。你的菜越做越好。' }
    ]
  },
  {
    id: 'n_single_delete_wechat',
    phase: 'single',
    weight: 8,
    text: [
      '那个聊了半个月的人，最后一条消息是三天前你发的。',
      '对方已读，没回。'
    ],
    options: [
      { label: '再发一条，问「在吗」', fx: { mood: -4, looks: -2, career: 0, family: 0 }, result: '消息发出去，石沉大海。你盯着对话框，像个等判卷的学生。' },
      { label: '删掉，把聊天记录一起删了', fx: { mood: 3, career: 2, health: 1, family: -1 }, result: '删完通讯录空了一格。你洗了个澡，觉得轻松，又觉得有点空。' },
      { label: '发一句「那祝你顺利」，然后拉黑', fx: { mood: 5, looks: 1, career: 1, family: 0 }, result: '你先下手为强，保住了最后一点体面。虽然没人看见，但你自己知道。' }
    ]
  },
  {
    id: 'n_single_lower_standard',
    phase: 'single',
    weight: 9,
    text: [
      '朋友喝多了，拍着你的肩说：「你就是标准太高，差不多就行了。」',
      '她说这话时，自己已经离了一次婚。'
    ],
    options: [
      { label: '「我知道。」然后把酒干了', fx: { mood: -2, career: 0, family: 1, health: -1 }, result: '你没反驳，但心里清楚：你要的不是差不多，是不将就。' },
      { label: '「那你当初也是差不多吗？」', fx: { mood: 3, career: 2, family: -3, health: 0 }, result: '她愣住了，然后哭了。你递了纸巾，有点后悔，又不完全后悔。' },
      { label: '真的把标准列出来，划掉了三条', fx: { mood: 2, looks: 0, career: 1, family: 2, health: 0 }, result: '划完你发现，剩下的那几条反而不敢划了。原来你一直知道自己在等什么。' }
    ]
  },
  {
    id: 'n_single_travel_alone',
    phase: 'single',
    weight: 8,
    text: [
      '你请了年假，一个人去了趟海边。没人知道，包括我妈。',
      '第一天下午，你坐在礁石上，看了两个小时的浪。'
    ],
    options: [
      { label: '给所有人发风景照，假装很热闹', fx: { money: -200, mood: 2, looks: 1, family: 1, career: -1 }, result: '点赞不少。你收起手机，还是一个人吃晚饭。' },
      { label: '关掉手机，在海边睡了一觉', fx: { health: 5, mood: 8, career: -3, money: 0, looks: 1 }, result: '醒来时天快黑了，手机有七个未接。你回了最后一个，其余的都算了。' },
      { label: '跟民宿老板聊了一晚上', fx: { mood: 6, family: 3, career: 1, health: -1, money: -100 }, result: '他是个辞职来开店的程序员。临走他说「想清楚了再回去」。' }
    ]
  },
  {
    id: 'n_single_schedule',
    phase: 'single',
    weight: 9,
    text: [
      '我妈发来一张表格，是她给你排的相亲日程，一周三个，排到了下个月。',
      '最后一栏写着「备注」：这个有房，这个学历高，这个着急。'
    ],
    options: [
      { label: '照单全收，一个不落地去', fx: { family: 5, mood: -5, career: -2, health: -2, money: 0 }, result: '那个月你见了十二个人。年底你谁也没记住，只记住了自己很累。' },
      { label: '只挑一个，其余的推掉', fx: { family: -2, mood: 3, career: 0, health: 1, money: 0 }, result: '她骂了你三天，第四天自己消气了。你见的那个，后来聊了很久。' },
      { label: '把表格打印出来，逐条问她「这个你自己见过了吗」', fx: { family: -5, mood: 5, career: 1, health: 0 }, result: '她气得挂了电话。一周后她发来一句话：「你自己把握，妈不管了。」' }
    ]
  },
  {
    id: 'n_single_midnight_unsend',
    phase: 'single',
    weight: 8,
    text: [
      '凌晨一点，你给那个刚认识的人打了一段话，八十多个字。',
      '发出去两秒，你撤回了。'
    ],
    options: [
      { label: '重新发一句「晚安」', fx: { mood: 3, looks: 1, career: 0, family: 0 }, result: '第二天早上她回了个太阳的表情。你们就这么聊了起来。' },
      { label: '什么都不发，睡觉', fx: { mood: -1, health: 3, career: 1, looks: 0 }, result: '第二天你庆幸自己没发。有些话说出口，就再也收不回来了。' },
      { label: '把那段话存进备忘录，标题写「以后再说」', fx: { mood: 2, career: 2, family: 1, health: 0 }, result: '备忘录里这样的东西越来越多。有一天你翻到，发现已经用不上了。' }
    ]
  },
  {
    id: 'n_single_pause_three_months',
    phase: 'single',
    weight: 8,
    text: [
      '你把相亲软件卸载了，跟介绍人说「最近太忙」。',
      '其实你不忙，只是忽然想停一停。'
    ],
    options: [
      { label: '把时间全砸在工作上', fx: { career: 9, money: 1500, health: -4, mood: -2, family: 0 }, result: '三个月后你升了职。庆功宴上有人问你女朋友呢，你说不急。' },
      { label: '报了个班，学了点没用的东西', fx: { mood: 7, looks: 3, money: -1200, career: -1, health: 2 }, result: '你学会了弹一首完整的曲子。弹给你妈听时，她没提相亲的事。' },
      { label: '什么也不做，就是歇着', fx: { health: 6, mood: 5, career: -3, money: 0, family: -1 }, result: '三个月后你重新装回软件，发现心态不一样了。你不再着急。' }
    ]
  },

  /* ---------------- meeting：相亲现场 ---------------- */
  {
    id: 'n_meet_order_for_her',
    phase: 'meeting',
    weight: 10,
    text: [
      '{p}把菜单推回来：「你点吧，我都行。」',
      '这是相亲第三句最常见的话，也是最难接的一句。'
    ],
    options: [
      { label: '直接点，把她那份也点了', fx: { affection: 9, mood: 2, money: -180, career: 1 }, result: '菜上来时她说「你怎么知道我不吃香菜」。你没告诉她，是你问过介绍人。' },
      { label: '「那我们各点各的。」', fx: { affection: -2, mood: 0, money: -120, career: 0 }, result: '她愣了一下，自己拿起了菜单。这顿饭吃得很客气，也很平。' },
      { label: '问她三个问题，再决定点什么', fx: { affection: 12, mood: 3, money: -150, career: 0 }, result: '「辣吗？海鲜过敏吗？主食吃吗？」她笑了：「你比我爸问得还细。」' }
    ]
  },
  {
    id: 'n_meet_phone_on_table',
    phase: 'meeting',
    weight: 9,
    text: [
      '两个人的手机都扣在桌上。她的屏幕亮了一次，又亮了一次。',
      '你的也震了一下，是工作群。'
    ],
    options: [
      { label: '把手机翻过去，屏幕朝下', fx: { affection: 8, mood: 2, career: -1, health: 0 }, result: '她看见了，也把自己的手机翻了过去。那顿饭聊了很久。' },
      { label: '先接工作电话，说「两分钟」', fx: { affection: -3, career: 3, mood: -1, money: 0 }, result: '两分钟变成了二十分钟。回来时她已经吃完了，在刷手机。' },
      { label: '「要不我们都把手机放包里？」', fx: { affection: 11, mood: 4, career: -2, health: 1 }, result: '她笑着照做了。后来她说，这是那次见面她记得最清楚的一句。' }
    ]
  },
  {
    id: 'n_meet_pay_bill',
    phase: 'meeting',
    weight: 10,
    text: [
      '结账时{p}抢着买单，手已经伸向了二维码。',
      '这顿饭三百二十块。'
    ],
    options: [
      { label: '坚持自己付', fx: { affection: 5, money: -320, mood: 1, career: 0 }, result: '她让了半步，说了声谢谢。出门时她说「下次我请」。有下次，就是好消息。' },
      { label: '让她付，说「那下次我来」', fx: { affection: 7, money: 0, mood: 2, career: -1 }, result: '她付完扬了扬手机：「记住啊，你欠我一顿。」你把这个「欠」字听得很重。' },
      { label: '「AA 吧，各付各的。」', fx: { affection: -6, money: -160, mood: -1, career: 1 }, result: '她点点头，转了一半给你。气氛从这一刻起，变成了公事公办。' }
    ]
  },
  {
    id: 'n_meet_she_cries',
    phase: 'meeting',
    weight: 9,
    text: [
      '聊到工作，{p}忽然不说话了。过了一会儿，她低头说了句「不好意思」。',
      '她眼眶是红的，但没哭出声。'
    ],
    options: [
      { label: '递纸巾，什么也不问', fx: { affection: 13, mood: 3, health: 1, career: 0 }, result: '她擦完眼睛，说了句「谢谢」。然后她自己开口讲了，讲了很久。' },
      { label: '追问「怎么了，是不是我说错什么了」', fx: { affection: -4, mood: -2, career: 0, health: 0 }, result: '她摇头说没有，但话已经说不下去。剩下的时间都在尴尬里。' },
      { label: '换个话题，聊点轻松的', fx: { affection: 4, mood: 2, career: 0, family: 1 }, result: '她很快调整好了。你也不知道这样做对不对，但那顿饭至少吃完了。' }
    ]
  },
  {
    id: 'n_meet_cat_or_dog',
    phase: 'meeting',
    weight: 8,
    text: [
      '{p}翻着手机给你看她家的猫，一只橘的，胖得不成样子。',
      '「它叫年糕。」她说这话时眼睛是亮的。'
    ],
    options: [
      { label: '「我能去看看它吗？」', fx: { affection: 12, mood: 4, money: -60, career: -1 }, result: '她愣了一下，说「今天不行，改天吧」。你拿到了一个改天。' },
      { label: '说我其实对猫毛过敏', fx: { affection: -7, mood: -1, health: 0, career: 0 }, result: '她「哦」了一声，把手机收起来了。话题到此为止。' },
      { label: '「我以前也养过一只，叫米饭。」', fx: { affection: 9, mood: 5, family: 2, career: 0 }, result: '她笑出了声。你们聊了半小时各自养过的动物。' }
    ]
  },
  {
    id: 'n_meet_rain_share',
    phase: 'meeting',
    weight: 9,
    text: [
      '出来时下雨了。你们站在屋檐下，只有一把很小的伞。',
      '{p}看了看天，又看了看那把伞。'
    ],
    options: [
      { label: '把伞全撑在她那边，自己淋着', fx: { affection: 10, health: -3, mood: 3, looks: 0 }, result: '到地铁口你半边身子湿透了。她掏出纸巾给你擦，没说话。' },
      { label: '「要不等等？雨应该不大。」', fx: { affection: 5, mood: 4, health: 1, career: -1 }, result: '你们在屋檐下站了二十分钟，聊了很多不着边际的话。' },
      { label: '跑进雨里，拉她一起', fx: { affection: 14, mood: 6, health: -2, looks: -1 }, result: '你们笑得像两个傻子。她后来说，那天是她这半年最开心的一次。' }
    ]
  },
  {
    id: 'n_meet_talk_money',
    phase: 'meeting',
    weight: 9,
    text: [
      '{p}忽然问：「你现在一个月能存多少？」',
      '问得很自然，像是随口一提。'
    ],
    options: [
      { label: '如实说，顺便把负债也说了', fx: { affection: 8, mood: -1, money: 0, career: 1 }, result: '她点点头说「我也差不多」。诚实换来了诚实，她讲了自己的花呗。' },
      { label: '往多里说一点', fx: { affection: -3, mood: -2, money: 0, career: 2 }, result: '她「哇」了一声，你心里发虚。这个数字以后要圆很久。' },
      { label: '反问「你问这个，是在考虑我们的将来吗」', fx: { affection: 11, mood: 4, career: 0, family: 1 }, result: '她脸红了，说「你想多了」。但那天之后，她主动约了你第二次。' }
    ]
  },
  {
    id: 'n_meet_he_sleeps',
    phase: 'meeting',
    weight: 7,
    text: [
      '吃饭到一半，你发现{p}走神了。她盯着窗外，手停在半空。',
      '「抱歉，我昨晚只睡了三个小时。」'
    ],
    options: [
      { label: '「那今天就到这，我送你回去。」', fx: { affection: 12, mood: 3, money: -80, career: -1 }, result: '她在出租车上睡着了，头歪在你肩上。你一动没动，坐过了两站。' },
      { label: '继续聊，声音放轻', fx: { affection: 3, mood: 1, career: 0, health: 0 }, result: '她努力撑着听，但你看出她已经听不进去了。' },
      { label: '讲个特别无聊的笑话，把她逗醒', fx: { affection: 7, mood: 5, career: 0, health: 0 }, result: '她笑骂你「冷」。人醒了，气氛也活了。' }
    ]
  },
  {
    id: 'n_meet_ex_texts',
    phase: 'meeting',
    weight: 8,
    text: [
      '正说着话，{p}的手机弹出一条消息，备注是「A」。',
      '她迅速按灭了屏幕，但你已经看见了开头两个字：「在吗」。'
    ],
    options: [
      { label: '装作没看见，继续聊天', fx: { affection: 4, mood: -3, career: 0, family: 0 }, result: '你聊得比刚才更用力。回家后你反复想那两个字，一夜没睡好。' },
      { label: '「如果有事你先忙。」', fx: { affection: 9, mood: 2, career: 0, health: 1 }, result: '她看了你一眼，把手机彻底收进包里：「没事，不重要。」' },
      { label: '直接问「那是谁」', fx: { affection: -9, mood: -4, career: 0, family: -1 }, result: '她的表情一下子冷了：「我们才第一次见面。」' }
    ]
  },
  {
    id: 'n_meet_same_hometown',
    phase: 'meeting',
    weight: 8,
    text: [
      '聊着聊着发现，你们是同一个县城出来的，只隔了两条街。',
      '{p}眼睛一下亮了：「那你知道路口那家豆腐脑吗？」'
    ],
    options: [
      { label: '「知道！咸的，加辣子。」', fx: { affection: 11, mood: 6, family: 3, money: 0 }, result: '你们为甜咸之争吵了十分钟，最后笑成一团。这顿饭突然变成了老乡会。' },
      { label: '「我离开得早，记不清了。」', fx: { affection: 2, mood: 1, family: 0, career: 0 }, result: '她有点失望，话题慢慢转回了工作。' },
      { label: '「下次我带你去，那家现在还开着。」', fx: { affection: 14, mood: 7, family: 4, money: -100 }, result: '她愣了三秒，说「好啊」。你们真的去了，两个月后。' }
    ]
  },
  {
    id: 'n_meet_she_drinks',
    phase: 'meeting',
    weight: 7,
    text: [
      '{p}点了一瓶啤酒，一口下去半瓶。',
      '「我平时不喝的。」她又倒了一杯。'
    ],
    options: [
      { label: '陪她喝，但把她的杯子换成水', fx: { affection: 10, mood: 4, health: -1, money: -40 }, result: '她发现后笑骂你「心眼多」。但那晚她没醉，你们聊到店家打烊。' },
      { label: '由她喝，自己陪着', fx: { affection: 3, mood: 2, health: -2, money: -60 }, result: '她喝到第三瓶开始说胡话。你送她回去，全程她都靠在你肩上。' },
      { label: '「你是不是有什么事？」', fx: { affection: 8, mood: 3, family: 2, career: 0 }, result: '她放下杯子，沉默了很久，讲了她刚辞掉的那份工作。' }
    ]
  },
  {
    id: 'n_meet_wrong_person',
    phase: 'meeting',
    weight: 7,
    text: [
      '你坐下三分钟才发现，坐对面的不是照片上那个人。',
      '她也一样，看你的眼神带着同样的疑惑。'
    ],
    options: [
      { label: '「要不……既来之则安之？」', fx: { affection: 9, mood: 5, career: 0, family: 1 }, result: '你们笑了一场，然后真的聊开了。后来她说，这是最离谱的一次相亲。' },
      { label: '起身道歉，去找正确的人', fx: { affection: -2, mood: -1, career: 1, health: 0 }, result: '你找到了原本的对象，但那顿饭从头到尾都在尴尬里。' },
      { label: '拍照发给我妈，问「这是不是你安排的」', fx: { family: -3, mood: 6, career: 0, affection: 0 }, result: '我妈回了六个感叹号。你和对面的姑娘一起笑了半天。' }
    ]
  },

  /* ---------------- talking：接触期 ---------------- */
  {
    id: 'n_talk_first_night_text',
    phase: 'talking',
    weight: 10,
    text: [
      '认识第七天，{p}在晚上十一点发来：「睡了吗？」',
      '这三个字你已经等了一周。'
    ],
    options: [
      { label: '秒回「没呢」', fx: { affection: 6, mood: 5, health: -1, career: 0 }, result: '你们聊到凌晨两点。第二天顶着黑眼圈上班，但嘴角是翘的。' },
      { label: '忍到第二天早上再回', fx: { affection: 3, mood: 2, health: 2, career: 1 }, result: '她回了个「早起的人」。你们保持着一种舒服的距离。' },
      { label: '回「睡了。（其实没有）」', fx: { affection: 9, mood: 6, health: -2, career: 0 }, result: '她发来一个「哈哈」。你们都懂，但谁也没戳破。' }
    ]
  },
  {
    id: 'n_talk_voice_msg',
    phase: 'talking',
    weight: 9,
    text: [
      '{p}发来一条十五秒的语音。你点开，是她笑的声音。',
      '你忽然意识到，你还没听过她说话。'
    ],
    options: [
      { label: '也回一条语音', fx: { affection: 10, mood: 6, career: -1, looks: 0 }, result: '你的声音有点抖，她说「你声音跟我想的不一样」。这是个好信号。' },
      { label: '打字回复，不回语音', fx: { affection: 2, mood: 1, career: 1, health: 0 }, result: '她也没再发语音。你们退回文字，安全，但也少了一点什么。' },
      { label: '直接打过去', fx: { affection: 13, mood: 8, career: -2, health: 0 }, result: '她接了，第一句是「你怎么打过来了」。然后你们聊了一个半小时。' }
    ]
  },
  {
    id: 'n_talk_she_sick',
    phase: 'talking',
    weight: 10,
    text: [
      '{p}发来：「今天有点发烧，先睡了。」',
      '消息是晚上八点发的。'
    ],
    options: [
      { label: '下单送药过去，备注「放门口就好」', fx: { affection: 12, money: -150, mood: 4, career: -1 }, result: '她半夜发来一条：「药收到了，谢谢你。」后面跟了个拥抱的表情。' },
      { label: '回一句「多喝热水，早点睡」', fx: { affection: -3, mood: 0, career: 0, health: 0 }, result: '她回了个「嗯」。就一个字。你盯着那个字看了五分钟。' },
      { label: '请假过去，熬一锅粥', fx: { affection: 16, money: -80, health: -2, career: -3, mood: 5 }, result: '她开门时裹着被子，眼睛是红的。那锅粥熬糊了底，她还是喝完了。' }
    ]
  },
  {
    id: 'n_talk_reply_speed',
    phase: 'talking',
    weight: 8,
    text: [
      '你发现自己开始计算回消息的时间：她平均四分钟回，你三分钟回显得太急。',
      '这条消息你已经编辑了七分钟。'
    ],
    options: [
      { label: '删掉重来，只发四个字', fx: { affection: 5, mood: -1, career: 1, health: 0 }, result: '简洁是对的。她很快回了，你们聊得很顺。' },
      { label: '不管了，把心里话全发出去', fx: { affection: 11, mood: 7, career: -1, health: 1 }, result: '发出去那一刻你浑身轻松。她回得慢了些，但回得很长。' },
      { label: '关掉对话框，去洗澡', fx: { affection: -2, mood: 3, health: 3, career: 2 }, result: '洗完出来她发了两个问号。你说「刚在洗澡」，心里有点得意。' }
    ]
  },
  {
    id: 'n_talk_friend_zone',
    phase: 'talking',
    weight: 9,
    text: [
      '{p}开始跟你聊她喜欢的另一个人。',
      '「他今天又没回我，你说他是不是不喜欢我？」'
    ],
    options: [
      { label: '认真帮她分析，出谋划策', fx: { affection: 6, mood: -5, career: 1, family: 0 }, result: '她夸你「你真懂我」。你笑着收下，心里像被人攥了一下。' },
      { label: '「别理他了，他不配。」', fx: { affection: -4, mood: 2, career: 0, family: 0 }, result: '她沉默了一会儿说「你别这么说」。你们第一次有了隔阂。' },
      { label: '「那我呢？」', fx: { affection: 14, mood: -2, career: 0, health: 0 }, result: '对话框显示「正在输入」很久，最后只来了一句「你别闹」。' }
    ]
  },
  {
    id: 'n_talk_weekend_plan',
    phase: 'talking',
    weight: 9,
    text: [
      '周五下午，{p}问：「周末有什么安排？」',
      '这是她第一次主动问起你的时间。'
    ],
    options: [
      { label: '「本来有事，但可以改。」', fx: { affection: 8, career: -2, mood: 5, money: 0 }, result: '她回了个「那周六下午？」。你秒答应，然后才想起来要改的是什么。' },
      { label: '如实说：「加班。」', fx: { affection: -3, career: 4, mood: -1, money: 300 }, result: '她回「辛苦了」。那个周末你真的在加班，赚了三百块加班费。' },
      { label: '「你想干什么？」', fx: { affection: 11, mood: 6, career: 0, family: 1 }, result: '她发了三个选项，你们挑了中间的。这是你们第一次共同决定一件事。' }
    ]
  },
  {
    id: 'n_talk_old_photo_send',
    phase: 'talking',
    weight: 7,
    text: [
      '{p}忽然发来一张你朋友圈三年前的照片：你站在某个山顶，笑得没心没肺。',
      '「那时候的你看起来好开心。」'
    ],
    options: [
      { label: '「现在也挺开心的。」', fx: { affection: 7, mood: 4, career: 0, health: 1 }, result: '她回了个笑脸。你翻着那张旧照片，发现自己确实变了不少。' },
      { label: '讲那次爬山的经历，讲了很久', fx: { affection: 10, mood: 6, family: 2, career: 0 }, result: '她听完说「下次带我去」。你们有了一个共同的约定。' },
      { label: '「那是我分手前最后一次旅行。」', fx: { affection: 5, mood: -3, family: 1, health: 0 }, result: '她沉默了一会儿，说「对不起，我不知道」。你的坦诚换来她的认真。' }
    ]
  },
  {
    id: 'n_talk_mom_knows',
    phase: 'talking',
    weight: 8,
    text: [
      '我妈不知道从哪儿听说了{p}，发来一句：「这次是真的吗？」',
      '你还没想好怎么定义你们的关系。'
    ],
    options: [
      { label: '「妈，才认识两周。」', fx: { family: 2, mood: 2, career: 0, affection: 0 }, result: '她回「那就抓紧」。你没回，把手机扣在了桌上。' },
      { label: '「嗯，我觉得是。」', fx: { family: 6, mood: 5, career: 0, affection: 3 }, result: '我妈那天特别高兴，还给你转了两千块「约会经费」。' },
      { label: '把手机给{p}看，问她「你说我怎么回」', fx: { affection: 13, family: 4, mood: 6, career: 0 }, result: '她看完脸红了，说「你就说……还没定」。你把这句发了回去。' }
    ]
  },
  {
    id: 'n_talk_she_busy',
    phase: 'talking',
    weight: 8,
    text: [
      '连续三天，{p}的回复都很短：「嗯」「在忙」「回头说」。',
      '你开始怀疑自己是不是说错了什么。'
    ],
    options: [
      { label: '不问，照常发日常给她', fx: { affection: 8, mood: 2, career: 0, health: 0 }, result: '第四天她回了一长段，说这周项目要上线。你松了口气。' },
      { label: '直接问「我是不是惹你不高兴了」', fx: { affection: -3, mood: -3, career: 0, family: 0 }, result: '她回「你想多了，就是忙」。这句解释反而让你更不安。' },
      { label: '停止发消息，等她来找你', fx: { affection: 4, mood: -2, career: 2, health: 1 }, result: '第五天她主动发了：「你这几天怎么不理我？」你赢了这一局。' }
    ]
  },
  {
    id: 'n_talk_gift_unexpected',
    phase: 'talking',
    weight: 8,
    text: [
      '{p}寄来一个包裹，拆开是一本书，扉页上写着她的名字。',
      '「上次你说想看，我正好有两本。」'
    ],
    options: [
      { label: '当晚看完，发一段很长的读后感', fx: { affection: 12, mood: 6, career: 1, health: -1 }, result: '她惊讶你读得这么快。你们为书里一个情节争论到深夜。' },
      { label: '拍张照片发她，说「收到了，谢谢」', fx: { affection: 4, mood: 2, career: 0, money: 0 }, result: '她回了「不客气」。这本书会一直放在你的书架上，很久。' },
      { label: '回寄一本你喜欢的，也写在扉页上', fx: { affection: 15, money: -120, mood: 7, family: 2 }, result: '她收到后发来语音，说「这是第一次有人这样」。你们的进度条跳了一大截。' }
    ]
  },
  {
    id: 'n_talk_meet_her_friend',
    phase: 'talking',
    weight: 8,
    text: [
      '{p}说她闺蜜想见见你。周末，咖啡馆，她闺蜜已经坐在那儿了。',
      '那眼神，像是在验收一件商品。'
    ],
    options: [
      { label: '主动买单，全程陪笑', fx: { affection: 7, money: -200, mood: -1, career: 0 }, result: '闺蜜走后发来消息：「还行，可以处。」你算是过关了。' },
      { label: '全程做自己，不刻意讨好', fx: { affection: 9, mood: 4, career: 0, looks: 1 }, result: '闺蜜后来跟她说「你这回这个挺实在的」。真实反而赢了。' },
      { label: '反问闺蜜几个问题，把局面反过来', fx: { affection: 11, mood: 5, career: 2, family: 0 }, result: '闺蜜被问得愣住，然后笑了：「你这人有点意思。」' }
    ]
  },
  {
    id: 'n_talk_silence_three_days',
    phase: 'talking',
    weight: 7,
    text: [
      '你三天没给她发消息，她也没找你。',
      '对话框里最后一条是你发的，一个表情。'
    ],
    options: [
      { label: '发一句「最近还好吗」', fx: { affection: 6, mood: 3, career: 0, health: 0 }, result: '她秒回「挺好的，你呢」。原来她也在等。' },
      { label: '就这么算了', fx: { affection: -12, mood: -6, career: 1, family: 0 }, result: '这段关系像没系紧的扣子，自己松开了。你们再没说过话。' },
      { label: '发一段很长的话，把话说清楚', fx: { affection: 13, mood: 7, career: -1, health: 1 }, result: '她看完打了电话过来，说「我以为你不想理我了」。误会解开了。' }
    ]
  },

  /* ---------------- dating：恋爱中 ---------------- */
  {
    id: 'n_date_first_fight',
    phase: 'dating',
    weight: 10,
    text: [
      '你们第一次吵架。起因很小，小到事后谁都想不起来。',
      '{p}摔门进了卧室，你坐在客厅，听见里面翻来覆去的声音。'
    ],
    options: [
      { label: '敲门进去，先说「是我的问题」', fx: { affection: 12, mood: -2, family: 2, career: 0 }, result: '她背对着你，肩膀动了一下。过了一会儿，她转身抱住了你。' },
      { label: '在客厅坐一晚上，等她出来', fx: { affection: 4, mood: -5, health: -2, career: 0 }, result: '凌晨三点她出来喝水，看见你还在。你们谁也没说话，但气消了。' },
      { label: '出去走走，给她留张纸条', fx: { affection: 9, mood: 3, health: 1, family: 1 }, result: '纸条上写「我去买你爱吃的那个」。回来时她站在门口等。' }
    ]
  },
  {
    id: 'n_date_meet_parents',
    phase: 'dating',
    weight: 10,
    text: [
      '{p}带你回家见她爸妈。饭桌上她爸问了三个问题：工作、房子、打算。',
      '她妈一直给你夹菜，一句话没说。'
    ],
    options: [
      { label: '有问必答，有多说多', fx: { affection: 8, family: 6, mood: -2, career: 1 }, result: '她爸点了点头。出门时她悄悄握住你的手，手心全是汗。' },
      { label: '主动洗碗，陪她妈聊家常', fx: { affection: 11, family: 9, mood: 3, career: -1 }, result: '后来她妈跟她说「这个孩子踏实」。这句话比什么都管用。' },
      { label: '被问急了，说了句「叔叔，我会努力的」', fx: { affection: 5, family: 4, mood: -3, career: 0 }, result: '场面安静了两秒。她爸笑了：「光努力不行，得有数。」' }
    ]
  },
  {
    id: 'n_date_anniversary_forget',
    phase: 'dating',
    weight: 9,
    text: [
      '晚上十一点，{p}发来一句：「今天是什么日子，你知道吗？」',
      '你翻遍了脑子，只想起明天要交方案。'
    ],
    options: [
      { label: '连夜出门买花，跑遍三条街', fx: { affection: 14, money: -300, mood: 4, health: -2 }, result: '花店快关门了，只剩一把康乃馨。她接过花，眼圈红了。' },
      { label: '坦白说忘了，然后认错', fx: { affection: 6, mood: 2, family: 1, career: 0 }, result: '她说「你倒是诚实」。这句诚实比任何补救都有效。' },
      { label: '「当然知道，礼物明天到。」', fx: { affection: -8, mood: -4, money: 0, career: 0 }, result: '你连夜下了单，加急。她第二天收到，但什么都明白了。' }
    ]
  },
  {
    id: 'n_date_move_in',
    phase: 'dating',
    weight: 9,
    text: [
      '{p}提着两个箱子站在你家门口：「我租的房子到期了。」',
      '她没说要搬进来，但箱子已经放在玄关了。'
    ],
    options: [
      { label: '接过箱子，腾出半个衣柜', fx: { affection: 15, family: 5, mood: 6, money: -400 }, result: '那天晚上你们一起收拾到半夜。家忽然变小了，也变满了。' },
      { label: '说「要不我们先试试一个月」', fx: { affection: 4, mood: 1, family: 2, career: 0 }, result: '她点点头。理性是对的，但你会记住她当时眼里的那点失落。' },
      { label: '「我帮你找房子吧。」', fx: { affection: -10, mood: -3, family: -2, money: -200 }, result: '她愣了很久，说「不用了」，然后把箱子拖走了。' }
    ]
  },
  {
    id: 'n_date_job_offer_far',
    phase: 'dating',
    weight: 9,
    text: [
      '你拿到一个 offer，薪水翻倍，但在另一个城市。',
      '{p}看完薪资那一行，沉默了很久。'
    ],
    options: [
      { label: '拒绝 offer，留下来', fx: { affection: 14, money: 0, career: -6, family: 3 }, result: '她说「你傻不傻」。但你从没后悔过这个决定。' },
      { label: '接下 offer，问她愿不愿意一起', fx: { affection: 6, money: 3000, career: 9, family: -2 }, result: '她考虑了三天，说「我去」。你们一起搬到了一个陌生的城市。' },
      { label: '先不决定，把选择权交给她', fx: { affection: -4, mood: -3, career: 2, family: 0 }, result: '她说「这是你的事」。你把责任推给了她，她记住了。' }
    ]
  },
  {
    id: 'n_date_she_jealous',
    phase: 'dating',
    weight: 8,
    text: [
      '{p}看到你跟女同事的合照，是公司年会的。',
      '她没问，但你感觉到今晚的对话降了八度。'
    ],
    options: [
      { label: '主动解释，把合照发群里', fx: { affection: 9, mood: 2, career: 1, family: 0 }, result: '她看完说「我想多了」。你没戳破，心里暖了一下。' },
      { label: '删掉那条朋友圈', fx: { affection: 6, mood: 0, career: -1, family: 1 }, result: '她第二天发现了，什么也没说。但这个动作，她记了很久。' },
      { label: '装作没事，继续聊别的', fx: { affection: -6, mood: -2, career: 0, family: -1 }, result: '三天后她爆发了，把这五天所有的不满都倒了出来。' }
    ]
  },
  {
    id: 'n_date_money_together',
    phase: 'dating',
    weight: 8,
    text: [
      '{p}提议开一个共同账户，每月各存一千，用于以后。',
      '她说这话时很认真，像是已经想了很久。'
    ],
    options: [
      { label: '同意，并且第一个月多存了五百', fx: { affection: 12, money: -1500, family: 5, career: 0 }, result: '她看到余额时愣了一下。那五百块，比什么都实在。' },
      { label: '同意，但只存她说的数', fx: { affection: 7, money: -1000, family: 3, career: 1 }, result: '规矩立下来了。每月一号转账，成了你们之间的一个小仪式。' },
      { label: '「这个是不是太快了？」', fx: { affection: -9, mood: -2, family: -3, money: 0 }, result: '她把手机收起来说「那算了」。那晚你们第一次分房睡。' }
    ]
  },
  {
    id: 'n_date_meet_ex_again',
    phase: 'dating',
    weight: 8,
    text: [
      '商场里迎面撞上前任。她身边站着一个男的，手里拎着母婴用品。',
      '她也看见了你，和{p}牵着的手。'
    ],
    options: [
      { label: '点头打个招呼，然后走开', fx: { affection: 8, mood: 3, family: 1, career: 0 }, result: '{p}全程没说话，走出商场才问「那是谁」。你如实说了。' },
      { label: '主动介绍{p}：「这是我女朋友。」', fx: { affection: 13, mood: 6, looks: 2, family: 0 }, result: '{p}愣了一下，然后笑着伸手。那一瞬间你知道，你彻底过去了。' },
      { label: '拉着{p}转身就走', fx: { affection: -3, mood: -4, career: 0, health: 0 }, result: '{p}被你拽得踉跄了一下。她问「你跑什么」，你答不上来。' }
    ]
  },
  {
    id: 'n_date_she_wants_space',
    phase: 'dating',
    weight: 8,
    text: [
      '{p}说：「这周我们别见面了，我想一个人待会儿。」',
      '她说得很平静，平静得让你心慌。'
    ],
    options: [
      { label: '答应，但每天发一句晚安', fx: { affection: 9, mood: 2, career: 0, health: 0 }, result: '她每条都回，只是很短。一周后她回来了，说「谢谢你没烦我」。' },
      { label: '追问「是不是我做错了什么」', fx: { affection: -5, mood: -4, family: 0, career: 0 }, result: '她说「你别多想」，但语气里有一丝疲惫。' },
      { label: '也给自己放个假，去出差', fx: { affection: 6, career: 5, money: 800, mood: 3 }, result: '一周后你们各自回来，都带了一肚子话要说。距离有时候是好事。' }
    ]
  },
  {
    id: 'n_date_hospital',
    phase: 'dating',
    weight: 9,
    text: [
      '{p}半夜肚子疼，你背着她下楼，打车去了急诊。',
      '等待区的灯很亮，她攥着你的手，指甲掐进你肉里。'
    ],
    options: [
      { label: '全程陪着，跑前跑后', fx: { affection: 15, health: -4, money: -800, career: -2, mood: 2 }, result: '天亮时确诊是阑尾炎，要手术。你签了字，手是抖的。' },
      { label: '通知她父母，让他们来', fx: { affection: 5, family: 6, money: -200, career: -1 }, result: '她爸妈赶来时一直说谢谢。你站在走廊里，忽然觉得自己还不够格。' },
      { label: '在走廊坐了一夜，什么也没做', fx: { affection: 8, health: -3, mood: -2, career: 0 }, result: '她出来时看见你坐在那儿，说了句「你怎么还不走」。' }
    ]
  },
  {
    id: 'n_date_propose_hesitate',
    phase: 'dating',
    weight: 9,
    text: [
      '戒指在抽屉里躺了两个月。你每次想开口，话到嘴边又咽回去。',
      '{p}似乎察觉到了什么，最近总问你「在想什么」。'
    ],
    options: [
      { label: '今晚就求，不挑日子了', fx: { affection: 16, money: 0, mood: 8, family: 4 }, result: '你做完饭，把戒指放在她碗边。她愣了十秒，然后哭了。' },
      { label: '再等等，等攒够钱办个体面的', fx: { affection: 5, money: 2000, career: 3, mood: -2 }, result: '钱是攒了，但她眼里的期待一点点淡了下去。' },
      { label: '先问她「你想过以后吗」', fx: { affection: 11, mood: 5, family: 2, career: 0 }, result: '她说「想过」。这两个字，让你终于敢把抽屉打开。' }
    ]
  },
  {
    id: 'n_date_quiet_night',
    phase: 'dating',
    weight: 7,
    text: [
      '什么也没发生的晚上。你们各自靠在沙发两头，她在看书，你在刷手机。',
      '窗外在下雨。'
    ],
    options: [
      { label: '把手机放下，靠过去', fx: { affection: 10, mood: 7, health: 2, career: -1 }, result: '她把书合上，把头靠在你肩上。这样的晚上，比任何约会都好。' },
      { label: '问她「你将来想住什么样的房子」', fx: { affection: 8, family: 4, mood: 4, career: 1 }, result: '她讲了很多，讲到一半自己笑了：「怎么像在过家家。」' },
      { label: '就这么待着，谁也不说话', fx: { affection: 6, mood: 5, health: 3, career: 0 }, result: '雨声很大，但屋里很静。有些亲密，是不需要说话的。' }
    ]
  },

  /* ---------------- married：婚后 ---------------- */
  {
    id: 'n_marry_chore_fight',
    phase: 'married',
    weight: 10,
    text: [
      '碗在水槽里泡了两天。{p}终于忍不住：「你能不能动一下？」',
      '你说「我昨天才拖的地」，话一出口就知道错了。'
    ],
    options: [
      { label: '闭嘴，去把碗洗了', fx: { affection: 10, mood: 2, family: 3, health: -1 }, result: '洗到一半她也进来了，拿起抹布。你们没说话，但气消了。' },
      { label: '「我们排个值日表吧」', fx: { affection: 7, family: 5, career: 2, mood: 1 }, result: '表贴在冰箱上。规矩这东西不浪漫，但真的管用。' },
      { label: '「我上班不累吗？」', fx: { affection: -9, mood: -5, family: -4, career: 0 }, result: '她看了你一眼，转身回了卧室。那晚你睡在沙发上。' }
    ]
  },
  {
    id: 'n_marry_inlaw_visit',
    phase: 'married',
    weight: 9,
    text: [
      '我妈要来住一个月。{p}听完后，笑了笑说「好啊」。',
      '那个笑，你太熟悉了。'
    ],
    options: [
      { label: '提前跟妈约法三章', fx: { affection: 11, family: 4, mood: 3, career: -1 }, result: '我妈嘴上答应，来了还是老样子。但她至少知道边界在哪。' },
      { label: '让{p}回娘家躲一阵', fx: { affection: 6, family: -3, mood: 2, money: -300 }, result: '家里清净了，但我妈问了七次「她怎么还不回来」。' },
      { label: '什么都不做，走一步看一步', fx: { affection: -7, mood: -4, family: -2, health: 0 }, result: '第二周就爆发了。你夹在中间，两头不是人。' }
    ]
  },
  {
    id: 'n_marry_baby_or_not',
    phase: 'married',
    weight: 10,
    text: [
      '{p}把一张验孕棒的照片发给你。两条杠。',
      '你们之前说好，再等两年。'
    ],
    options: [
      { label: '回家抱住她，说「那就生」', fx: { affection: 15, family: 8, money: -2000, career: -3, mood: 7 }, result: '她哭了，说「我以为你会生气」。那一刻你长大了。' },
      { label: '认真算一笔账，把担心说出来', fx: { affection: 4, family: 2, money: 0, career: 3, mood: -2 }, result: '你们聊到凌晨。最后决定留下，但那笔账算得很值。' },
      { label: '沉默很久，问她「你想怎么办」', fx: { affection: -3, family: -2, mood: -4, career: 1 }, result: '她说「我问你呢」。你把决定权推出去的那一刻，她心凉了。' }
    ]
  },
  {
    id: 'n_marry_money_hidden',
    phase: 'married',
    weight: 8,
    text: [
      '你发现{p}有一张你不知道的卡，里面存了四万块。',
      '她说「我妈给的」，但你知道她妈没这个钱。'
    ],
    options: [
      { label: '直接问清楚', fx: { affection: 6, family: 3, mood: -1, career: 1 }, result: '她承认是私房钱，说是怕万一。你们第一次认真谈了安全感。' },
      { label: '装作没看见', fx: { affection: 3, mood: -3, family: 0, career: 0 }, result: '你什么都没说，但那笔钱从此横在你们中间。' },
      { label: '把自己的卡也藏起来', fx: { affection: -8, money: -500, family: -5, mood: -3 }, result: '你们开始各自留后手。婚姻里一旦有了这个，就很难回头。' }
    ]
  },
  {
    id: 'n_marry_boring_anniversary',
    phase: 'married',
    weight: 8,
    text: [
      '结婚两周年。你们都忘了，直到晚上十点同时想起来。',
      '{p}说「要不……点个外卖庆祝一下？」'
    ],
    options: [
      { label: '下楼买两个蛋糕，一人一个', fx: { affection: 11, money: -120, mood: 7, family: 2 }, result: '你们坐在地板上吃蛋糕，笑得像两个偷懒的小孩。' },
      { label: '「明年我们去趟海边吧。」', fx: { affection: 9, mood: 6, family: 4, money: 0 }, result: '她把这句话记在了手机备忘录里。第二年你们真的去了。' },
      { label: '「都老夫老妻了。」', fx: { affection: -6, mood: -3, family: -2, career: 0 }, result: '她笑了笑，没说话。有些话听着像玩笑，其实很伤人。' }
    ]
  },
  {
    id: 'n_marry_career_or_family',
    phase: 'married',
    weight: 9,
    text: [
      '公司要派你去外地半年，回来基本能升总监。',
      '{p}刚查出怀孕八周。'
    ],
    options: [
      { label: '拒绝外派', fx: { affection: 14, family: 7, career: -8, money: 0, mood: 3 }, result: '领导说「你会后悔的」。但你回家看见孕吐的她，一点都不后悔。' },
      { label: '去，但每周末飞回来', fx: { affection: 5, career: 7, money: -6000, health: -5, family: 2 }, result: '半年里你飞了二十四趟。人瘦了八斤，职位和家都在。' },
      { label: '让她跟你一起去', fx: { affection: 8, career: 6, family: 3, money: -3000, health: -2 }, result: '她答应了。陌生的城市里，你们反而比在家里更亲密。' }
    ]
  },
  {
    id: 'n_marry_sick_mother',
    phase: 'married',
    weight: 9,
    text: [
      '我妈住院了。医生说要做手术，费用不低。',
      '{p}把家里的存折拿出来，放在你面前。'
    ],
    options: [
      { label: '接过来，说「算我借的」', fx: { family: 8, money: -15000, affection: 6, mood: -3 }, result: '她说「一家人说什么借」。你记住这句话，记了一辈子。' },
      { label: '坚持不动这笔钱，去借', fx: { family: 5, money: -15000, affection: 3, career: -2, mood: -5 }, result: '你借遍了朋友。她说你傻，但还是帮你记着每一笔账。' },
      { label: '跟她商量，一起做决定', fx: { family: 7, affection: 11, mood: 2, money: -15000 }, result: '你们坐在灯下算了一夜。那一刻你觉得，结婚真好。' }
    ]
  },
  {
    id: 'n_marry_late_night_talk',
    phase: 'married',
    weight: 7,
    text: [
      '孩子睡了，家里终于安静。{p}靠在床头，忽然说：「我们多久没聊过天了？」',
      '你想了想，答不上来。'
    ],
    options: [
      { label: '把手机关掉，聊到困', fx: { affection: 12, mood: 8, health: -2, family: 3 }, result: '你们聊到孩子、聊到工作、聊到二十岁那年的自己。' },
      { label: '「明天还得早起呢。」', fx: { affection: -5, mood: -2, career: 1, family: -1 }, result: '她「嗯」了一声，翻身睡了。你听见她背对着你叹了口气。' },
      { label: '说「那现在开始聊」', fx: { affection: 10, mood: 6, family: 4, health: -1 }, result: '她笑了，说「算你识相」。那个夜晚比很多纪念日都值钱。' }
    ]
  },

  /* ---------------- date：约会中（dateType: simple / standard / activity） ---------------- */
  {
    id: 'n_date_01_movie_sleep',
    phase: 'date',
    dateType: 'simple',
    weight: 10,
    text: [
      '电影放到四十分钟，你听见旁边有均匀的呼吸声。',
      '{p}睡着了，头一点点往你肩上歪。'
    ],
    options: [
      { label: '一动不动，让她靠', fx: { affection: 12, health: -1, mood: 5, career: 0 }, result: '散场时她醒来，发现肩膀酸的是你。她红着脸说「你怎么不叫我」。' },
      { label: '轻轻推醒她', fx: { affection: -2, mood: 0, career: 1, health: 0 }, result: '她「啊」了一声，坐直了。后半场你们都没看进去。' },
      { label: '也闭上眼，跟着睡', fx: { affection: 9, mood: 7, health: 2, career: 0 }, result: '你们一起睡到了字幕结束。清洁阿姨把你们叫醒时，两人都笑了。' }
    ]
  },
  {
    id: 'n_date_02_walk_shop',
    phase: 'date',
    dateType: 'simple',
    weight: 9,
    text: [
      '{p}在橱窗前停下了，看一条裙子看了很久，然后说「走吧」。',
      '价签你瞥到了，是你一周的工资。'
    ],
    options: [
      { label: '回去买下来，说是「提前的生日礼物」', fx: { affection: 14, money: -1500, mood: 6, family: 2 }, result: '她抱着袋子不肯松手，说「你疯了」。但眼睛是亮的。' },
      { label: '记下款式，发工资那天偷偷买', fx: { affection: 15, money: -1500, career: 2, mood: 5 }, result: '一个月后她收到快递，愣在那里。有些惊喜，值得等。' },
      { label: '当作没看见，继续走', fx: { affection: -4, mood: -2, money: 0, career: 0 }, result: '她回头看了那扇窗两次。你假装在看手机。' }
    ]
  },
  {
    id: 'n_date_03_cook_together',
    phase: 'date',
    dateType: 'activity',
    weight: 9,
    text: [
      '你们决定一起做顿饭。{p}切菜切到手，血珠冒出来。',
      '厨房里全是油烟，和她吸气的声音。'
    ],
    options: [
      { label: '抓过她的手，去冲水找创可贴', fx: { affection: 13, health: 2, mood: 4, family: 3 }, result: '翻遍了抽屉才找到创可贴。她举着手指说「这顿饭代价好大」。' },
      { label: '把她推出厨房，自己做完', fx: { affection: 8, mood: 3, career: 1, health: -1 }, result: '菜端上桌时卖相一般。她吃了两碗，说「还行吧」。' },
      { label: '笑着把创可贴贴成十字，说「勋章」', fx: { affection: 11, mood: 8, family: 2, health: 1 }, result: '她打你一下，笑骂你幼稚。那顿饭的菜全糊了，你们还是吃完了。' }
    ]
  },
  {
    id: 'n_date_04_zoo',
    phase: 'date',
    dateType: 'activity',
    weight: 8,
    text: [
      '{p}在猴山前站了二十分钟，看得比旁边的孩子还认真。',
      '「你看那只小的，一直在抢。」'
    ],
    options: [
      { label: '陪她看，还给她买了个棉花糖', fx: { affection: 11, money: -40, mood: 7, health: 0 }, result: '她一手棉花糖一手指着猴子，说了句「像不像你」。' },
      { label: '催她「前面还有熊猫呢」', fx: { affection: -2, mood: 1, career: 1, health: 1 }, result: '她被你拉走了，但一步三回头。' },
      { label: '偷偷拍下她看猴子的侧脸', fx: { affection: 13, mood: 8, looks: 2, career: 0 }, result: '后来这张照片成了你的手机壁纸。她到现在都不知道。' }
    ]
  },
  {
    id: 'n_date_05_rain_cancel',
    phase: 'date',
    dateType: 'standard',
    weight: 9,
    text: [
      '约好了去露营，早上起来下大雨。{p}发来：「要不改天？」',
      '你已经把帐篷塞进了后备箱。'
    ],
    options: [
      { label: '「那就改天。」', fx: { affection: 4, mood: 1, health: 2, career: 0 }, result: '你们都松了口气。有时候取消计划，也是一种体贴。' },
      { label: '「在家露营吧」，把帐篷支在客厅', fx: { affection: 15, mood: 9, money: -200, family: 3 }, result: '你们在客厅睡了一晚，听着雨声。她说这是最棒的一次露营。' },
      { label: '照原计划出发', fx: { affection: -3, health: -4, money: -600, mood: -5 }, result: '帐篷漏雨，装备全湿。你们在车里坐到天亮，谁也没说话。' }
    ]
  },
  {
    id: 'n_date_06_she_late',
    phase: 'date',
    dateType: 'simple',
    weight: 8,
    text: [
      '约的七点，七点四十{p}才到，头发是湿的。',
      '「对不起，我睡过头了。」她喘着气。'
    ],
    options: [
      { label: '「我点了你爱喝的，快坐下。」', fx: { affection: 10, money: -60, mood: 3, family: 1 }, result: '她眼睛一下就红了。后来她说，那天她以为你会生气。' },
      { label: '「下次早点出门。」', fx: { affection: -3, mood: -1, career: 1, health: 0 }, result: '她点点头，整顿饭都很拘谨。道理没错，但气氛坏了。' },
      { label: '「你是不是跑来的？别感冒了。」', fx: { affection: 13, mood: 5, health: 1, family: 2 }, result: '她愣了一下，然后笑了。你递过去的纸巾，她一直攥着。' }
    ]
  },
  {
    id: 'n_date_07_photo',
    phase: 'date',
    dateType: 'standard',
    weight: 8,
    text: [
      '{p}说「我们拍张合照吧」，然后举起了手机。',
      '你下意识往后躲了一下。'
    ],
    options: [
      { label: '靠过去，笑一个', fx: { affection: 10, mood: 6, looks: 1, family: 2 }, result: '照片里你们挨得很近。她设成了聊天背景，你第二天才发现。' },
      { label: '「我不会拍照。」', fx: { affection: -2, mood: -1, looks: -1, career: 0 }, result: '她自己拍了两张，都有点糊。' },
      { label: '接过手机，说「我拍你吧」', fx: { affection: 12, mood: 7, looks: 3, career: 0 }, result: '你拍了十七张，她挑了第三张。她说「你挺会拍的」。' }
    ]
  },
  {
    id: 'n_date_08_drunk',
    phase: 'date',
    dateType: 'standard',
    weight: 8,
    text: [
      '{p}喝了两杯就上头了，趴在桌上说胡话。',
      '「你说……你是不是真的喜欢我？」'
    ],
    options: [
      { label: '「是。」', fx: { affection: 14, mood: 8, family: 2, health: 0 }, result: '她抬起头，眼睛很亮：「那你说三遍。」你说了三遍。' },
      { label: '转移话题，叫车送她回家', fx: { affection: 5, mood: 2, money: -80, health: 1 }, result: '第二天她什么也不记得。你没提，但这个答案你欠着。' },
      { label: '「你醉了，明天再说。」', fx: { affection: -5, mood: -3, career: 1, family: 0 }, result: '她「哦」了一声，趴回去不说话了。有些问题过期不候。' }
    ]
  },
  {
    id: 'n_date_09_arcade',
    phase: 'date',
    dateType: 'activity',
    weight: 8,
    text: [
      '{p}拉着你去抓娃娃。投了三十个币，一个也没上来。',
      '她不服气：「再来一次。」'
    ],
    options: [
      { label: '继续投，投到八十个', fx: { affection: 11, money: -160, mood: 6, career: -1 }, result: '最后一个终于上来了。她抱着那个丑娃娃，笑得比你还开心。' },
      { label: '趁她不注意，去服务台买一个', fx: { affection: 8, money: -120, mood: 4, career: 1 }, result: '你假装抓到了。她信了，但后来在包里发现了小票。' },
      { label: '「走吧，我给你买一个。」', fx: { affection: -1, money: -100, mood: 0, career: 1 }, result: '她说「那多没意思」。你要的不是娃娃，她要的是过程。' }
    ]
  },
  {
    id: 'n_date_10_sunset',
    phase: 'date',
    dateType: 'simple',
    weight: 8,
    text: [
      '你们坐在江边看落日。{p}把鞋脱了，脚泡在水里。',
      '「要是能一直这样就好了。」'
    ],
    options: [
      { label: '「会的。」', fx: { affection: 10, mood: 6, family: 2, health: 1 }, result: '她靠过来，头搭在你肩上。太阳沉下去，谁也没动。' },
      { label: '「以后每年都来一次。」', fx: { affection: 13, mood: 7, family: 4, career: 0 }, result: '她把这个约定记下了。第二年你们真的来了，还带了相机。' },
      { label: '什么也没说，把外套披在她身上', fx: { affection: 12, mood: 8, health: 2, looks: 1 }, result: '风有点凉。她裹紧了外套，往你这边靠了靠。' }
    ]
  },
  {
    id: 'n_date_11_meet_friend',
    phase: 'date',
    dateType: 'standard',
    weight: 7,
    text: [
      '吃饭时碰到你同事，他大声说「这就是你女朋友啊」，还拍了照。',
      '{p}笑着应付，筷子却放下了。'
    ],
    options: [
      { label: '当场澄清：「是，我女朋友。」', fx: { affection: 12, mood: 5, looks: 2, career: 1 }, result: '同事走了以后，她小声说「你倒是大方」。语气是甜的。' },
      { label: '含糊过去，说「朋友」', fx: { affection: -8, mood: -4, career: 2, family: 0 }, result: '她没说话，整顿饭没再抬头。这个词她记了很久。' },
      { label: '事后解释「公司人多嘴杂」', fx: { affection: 3, mood: 1, career: 1, family: 0 }, result: '她说「我懂」。但懂和介意，是两回事。' }
    ]
  },
  {
    id: 'n_date_12_her_bad_day',
    phase: 'date',
    dateType: 'simple',
    weight: 8,
    text: [
      '整场约会{p}都心不在焉。问她，她说「没事」。',
      '但你看见她指关节是红的，像是攥过拳。'
    ],
    options: [
      { label: '不再追问，带她去打游戏机', fx: { affection: 12, money: -150, mood: 6, health: 1 }, result: '她打了两局，脸色缓过来了。临走时说了句「今天谢谢」。' },
      { label: '直接问「谁欺负你了」', fx: { affection: 10, mood: 3, family: 3, career: 0 }, result: '她沉默了很久，讲了被领导当众骂的事。讲完就哭了。' },
      { label: '陪她安静地吃完，送她回家', fx: { affection: 8, mood: 3, health: 1, career: -1 }, result: '楼下她说「我今天不太好玩」。你说「我知道」。' }
    ]
  },
  {
    id: 'n_date_13_bookstore',
    phase: 'date',
    dateType: 'activity',
    weight: 7,
    text: [
      '书店里，{p}抽出一本你高中时翻烂过的书。',
      '「你也看这个？」'
    ],
    options: [
      { label: '聊这本书，聊到忘了时间', fx: { affection: 12, mood: 7, career: 1, family: 2 }, result: '你们坐在地上聊了两个小时。店员来关灯时才走。' },
      { label: '买下两本，一人一本', fx: { affection: 10, money: -120, mood: 5, family: 1 }, result: '她说「那我们什么时候讨论」。你们有了一个共同的事。' },
      { label: '「随便翻过，忘了。」', fx: { affection: -3, mood: -1, career: 0, health: 0 }, result: '她把书插回去了。话题断在了那里。' }
    ]
  },
  {
    id: 'n_date_14_bus_wrong',
    phase: 'date',
    dateType: 'simple',
    weight: 7,
    text: [
      '你们坐反了公交，开到了一个完全陌生的地方。',
      '下车时天已经黑了，手机只剩百分之八的电。'
    ],
    options: [
      { label: '「反正都来了，走走看。」', fx: { affection: 13, mood: 8, health: 1, career: -1 }, result: '你们在一条没见过的小巷里找到一家面馆，难吃但难忘。' },
      { label: '赶紧查地图，打车回去', fx: { affection: 3, money: -120, mood: 1, career: 1 }, result: '安全到家了，但那晚平淡得像没发生过。' },
      { label: '把手机关机，说「迷路也挺好」', fx: { affection: 15, mood: 9, health: -1, family: 2 }, result: '你们走了两个小时才找到地铁。她说这是她最疯的一次。' }
    ]
  },
  {
    id: 'n_date_15_gift_fail',
    phase: 'date',
    dateType: 'standard',
    weight: 7,
    text: [
      '你送她一条项链，她打开后愣了三秒，说了句「挺好看的」。',
      '那三秒，你心里咯噔了一下。'
    ],
    options: [
      { label: '问「是不是不喜欢」', fx: { affection: 9, mood: 2, family: 2, career: 0 }, result: '她说「我很少戴首饰」。你们聊开了，才知道她喜欢的是书。' },
      { label: '当作没察觉，继续约会', fx: { affection: 2, mood: -2, money: 0, career: 0 }, result: '那条项链后来一直躺在抽屉里。你每次看见都难受。' },
      { label: '「那我们回去换。」', fx: { affection: 11, money: -200, mood: 4, career: -1 }, result: '你们在商场逛到打烊，她挑了一本诗集。她说这才像你送的。' }
    ]
  },
  {
    id: 'n_date_16_she_pays',
    phase: 'date',
    dateType: 'simple',
    weight: 7,
    text: [
      '结账时{p}抢先扫了码，还冲你晃了晃手机。',
      '「上次你请的，这次该我了。」'
    ],
    options: [
      { label: '坦然接受，说「那下次我请贵的」', fx: { affection: 11, mood: 6, family: 2, money: 0 }, result: '她笑说「一言为定」。这种你来我往，比谁请客重要得多。' },
      { label: '坚持把钱转给她', fx: { affection: -4, money: -180, mood: -1, career: 0 }, result: '她收了，但说了句「你这样我很别扭」。' },
      { label: '「那我请你看电影。」', fx: { affection: 9, money: -160, mood: 5, career: 0 }, result: '一顿饭变成了一场约会。你们的时间被拉长了。' }
    ]
  },
  {
    id: 'n_date_17_karaoke',
    phase: 'date',
    dateType: 'activity',
    weight: 7,
    text: [
      '{p}点了一首很难的歌，唱到高音破了音。',
      '她捂着脸，笑得直不起腰。'
    ],
    options: [
      { label: '跟着一起唱，唱得更难听', fx: { affection: 13, mood: 9, health: -1, career: 0 }, result: '两个人在包厢里笑成一团。丢脸这件事，一起做就不丢脸了。' },
      { label: '鼓掌，说「唱得挺好的」', fx: { affection: 6, mood: 4, career: 1, family: 0 }, result: '她白你一眼：「你根本没听。」' },
      { label: '点一首简单的，跟她合唱', fx: { affection: 11, mood: 7, family: 2, health: 0 }, result: '合唱的时候，你们的节奏奇迹般地对上了。' }
    ]
  },
  {
    id: 'n_date_18_phone_dies',
    phase: 'date',
    dateType: 'simple',
    weight: 7,
    text: [
      '你的手机没电了。{p}的也只剩百分之三。',
      '你们坐在咖啡馆里，忽然不知道该干什么。'
    ],
    options: [
      { label: '找店员借纸笔，玩你画我猜', fx: { affection: 14, mood: 9, career: -1, family: 2 }, result: '你画得一塌糊涂，她笑到流泪。没有手机的两小时，是最久也最快的两小时。' },
      { label: '就这么聊天', fx: { affection: 10, mood: 6, health: 1, career: 0 }, result: '你们聊了很多平时不会聊的事。原来眼神交流是这样的。' },
      { label: '借充电宝，各玩各的', fx: { affection: -3, mood: -1, career: 1, health: 0 }, result: '手机充上电，你们各自低头。那半小时像隔了一堵墙。' }
    ]
  },
  {
    id: 'n_date_19_museum',
    phase: 'date',
    dateType: 'activity',
    weight: 7,
    text: [
      '在一幅画前，{p}站了很久。你看了半天，也没看出好在什么地方。',
      '「你觉得它在画什么？」她问。'
    ],
    options: [
      { label: '老实说「我看不懂」', fx: { affection: 9, mood: 4, career: 0, family: 1 }, result: '她笑着给你讲了二十分钟。你听不懂画，但听懂了她。' },
      { label: '硬编一个解读', fx: { affection: -2, mood: -1, career: 2, looks: 0 }, result: '她点点头，没再说什么。你看出她知道你在瞎编。' },
      { label: '反问「你觉得呢」', fx: { affection: 12, mood: 7, family: 2, career: 1 }, result: '她讲了很多，眼睛里全是光。你发现她说话的样子，比那幅画好看。' }
    ]
  },
  {
    id: 'n_date_20_street_cat',
    phase: 'date',
    dateType: 'simple',
    weight: 7,
    text: [
      '路上遇到一只流浪猫，{p}蹲下来就走不动了。',
      '「我们能不能带它回家？」'
    ],
    options: [
      { label: '「走吧，去买个猫包。」', fx: { affection: 15, money: -800, mood: 8, family: 4, health: 1 }, result: '从那天起你们有了一个共同的孩子。它叫「豆子」。' },
      { label: '「我们租房，房东不让养。」', fx: { affection: -2, mood: -2, money: 0, family: -1 }, result: '她站了很久才起来。走的时候回头看了三次。' },
      { label: '每天来喂，喂了一个月', fx: { affection: 11, money: -300, mood: 6, health: 2 }, result: '一个月后猫不见了。她说「至少它过得好」。你们都长大了。' }
    ]
  },

  /* ---------------- any（第二批） ---------------- */
  {
    id: 'n_any_b2_01',
    phase: 'any',
    weight: 9,
    text: ['公司楼下的咖啡涨价了，从十二块涨到十五。', '店员笑着说「豆子涨价了」，笑得很职业。'],
    options: [
      { label: '照买，还多买了一杯给同事', fx: { money: -30, mood: 4, career: 2, family: 0 }, result: '同事愣了半天，第二天回请你一杯。办公室的温度，就是这么来的。' },
      { label: '从此改喝速溶', fx: { money: 15, mood: -2, health: -1, career: 0 }, result: '速溶很难喝。你每天皱着眉喝完，省下的三块也不知道省给谁。' },
      { label: '问店员「你们豆子从哪来的」', fx: { mood: 5, career: 3, money: -15, family: 1 }, result: '他没想到你会问，认真答了一通。你们聊成了点头之交。' }
    ]
  },
  {
    id: 'n_any_b2_02',
    phase: 'any',
    weight: 9,
    text: ['你把用了六年的电脑开机，风扇响得像要起飞。', '维修师傅说：「换新的吧，修不划算。」'],
    options: [
      { label: '换，一步到位买好的', fx: { money: -6500, mood: 5, career: 4, health: 0 }, result: '新电脑开机只要八秒。你盯着桌面，忽然觉得这六年过得真快。' },
      { label: '先清灰凑合用', fx: { money: -80, career: -1, health: 0, mood: -1 }, result: '清完安静了三天，第四天又开始响。你学会了跟噪音相处。' },
      { label: '把旧电脑卖了，添点钱换二手', fx: { money: -2200, mood: 2, career: 2, health: 0 }, result: '旧机器卖了两百。你把它擦干净的时候，有点舍不得。' }
    ]
  },
  {
    id: 'n_any_b2_03',
    phase: 'any',
    weight: 8,
    text: ['体检报告出来了，好几项箭头朝上。医生只说了一句：「少熬夜。」', '你把报告折起来塞进包里。'],
    options: [
      { label: '当天开始十一点睡觉', fx: { health: 7, mood: 3, career: -2, money: 0 }, result: '坚持了两周就破了功。但那两周你精神好得出奇。' },
      { label: '办健身卡，请私教', fx: { money: -3600, health: 5, mood: 2, career: -1 }, result: '私教很贵，效果也确实有。三个月后指标全正常了。' },
      { label: '把报告拍照发给我妈', fx: { family: 5, mood: 2, health: 0, career: 0 }, result: '她当天打了四个电话。你嫌烦，但还是把她寄来的保健品吃了。' }
    ]
  },
  {
    id: 'n_any_b2_04',
    phase: 'any',
    weight: 8,
    text: ['地铁上有人吵架，为的是谁挤了谁。声音越来越大。', '全车厢都在看，没人劝。'],
    options: [
      { label: '上去劝，被骂了一句', fx: { mood: -3, health: 0, career: 0, family: 1 }, result: '你退回车厢角落。但下一站，两个人都下车了，没再打起来。' },
      { label: '默默往旁边挪，装作看手机', fx: { mood: -1, health: 0, career: 1, family: -1 }, result: '吵到第五站结束了。你到站下车，心里堵了一路。' },
      { label: '把自己的位置让给其中一个', fx: { mood: 6, health: 0, family: 3, career: 0 }, result: '荒谬的是，这样一来他们反而不吵了。有时候退一步真的有用。' }
    ]
  },
  {
    id: 'n_any_b2_05',
    phase: 'any',
    weight: 8,
    text: ['你发现自己开始记账了。每一笔支出都写下来，连三块钱的矿泉水。', '月底一看，光奶茶就喝了四百。'],
    options: [
      { label: '戒掉奶茶', fx: { money: 400, health: 4, mood: -3, looks: 1 }, result: '第一周很难熬。第二周开始，你发现自己皮肤变好了。' },
      { label: '不戒，但改成自己泡', fx: { money: 300, mood: 4, health: 2, career: -1 }, result: '你买了茶叶和奶，每天早起十分钟。省下的钱不多，但很有成就感。' },
      { label: '继续喝，但把账本删了', fx: { money: -400, mood: 5, health: -1, career: 0 }, result: '眼不见心不烦。你又过回了糊涂但痛快的日子。' }
    ]
  },
  {
    id: 'n_any_b2_06',
    phase: 'any',
    weight: 8,
    text: ['同事在群里发了张截图，是领导的朋友圈，配文「某些人不思进取」。', '群里一片沉默，然后有人点了个赞。'],
    options: [
      { label: '也跟着点个赞', fx: { career: 4, mood: -5, family: 0, health: 0 }, result: '你点完就后悔了。那天晚上你把手机扣着睡的。' },
      { label: '装作没看见', fx: { career: 0, mood: -1, health: 1, family: 0 }, result: '第二天上班一切照旧。有些事，不表态也是一种表态。' },
      { label: '私聊领导：「说的是我吗？」', fx: { career: 6, mood: -2, health: -1, family: 0 }, result: '领导回了个「你想多了」。但从此他对你客气了不少。' }
    ]
  },
  {
    id: 'n_any_b2_07',
    phase: 'any',
    weight: 8,
    text: ['下雨天的便利店，你和一个陌生人同时伸手去拿最后一盒便当。', '你们都愣住了。'],
    options: [
      { label: '让给他', fx: { mood: 4, money: 0, health: 0, family: 2 }, result: '他连声道谢。你买了包泡面，回家吃得也挺香。' },
      { label: '抢先拿走', fx: { mood: -2, money: -25, health: 1, career: 1 }, result: '你走出门时有点心虚。便当的味道一般。' },
      { label: '「要不一人一半？」', fx: { mood: 7, money: -12, family: 3, health: 0 }, result: '他笑了，说「行啊」。你们在便利店门口各吃了一半。' }
    ]
  },
  {
    id: 'n_any_b2_08',
    phase: 'any',
    weight: 8,
    text: ['你收到一条短信：「您的快递已放至丰巢，超时将收费。」', '你已经三天没取了。'],
    options: [
      { label: '立刻去取', fx: { money: 0, health: 1, mood: 1, career: 0 }, result: '取回来拆开，是双十一买的袜子。你忘了自己还买过这个。' },
      { label: '付两块钱超时费', fx: { money: -2, mood: -1, career: 1, health: 0 }, result: '两块钱不算什么，但你为这事生了一下午的闷气。' },
      { label: '干脆不取了', fx: { money: -30, mood: -3, career: 0, health: 0 }, result: '三天后快递被退回。你连里面是什么都不知道。' }
    ]
  },
  {
    id: 'n_any_b2_09',
    phase: 'any',
    weight: 8,
    text: ['深夜的便利店，你买了关东煮和一瓶啤酒，坐在窗边。', '隔壁桌一个中年男人也在喝，看了你一眼。'],
    options: [
      { label: '冲他举了举杯', fx: { mood: 6, family: 2, health: 0, career: 0 }, result: '他愣了一下，也举了举杯。你们没说话，但那晚没那么孤单。' },
      { label: '低头吃，快吃完就走', fx: { mood: 1, health: 1, career: 1, family: 0 }, result: '你吃完起身，他还在喝。玻璃上映出你们两个人的影子。' },
      { label: '搭话：「这么晚还不睡？」', fx: { mood: 8, family: 4, career: -1, health: -1 }, result: '他讲了半小时自己创业失败的事。你听完了，也讲了自己的。' }
    ]
  },
  {
    id: 'n_any_b2_10',
    phase: 'any',
    weight: 8,
    text: ['你妈寄来一箱橘子，二十斤。你一个人吃不完。', '箱子里还塞了张纸条：「分给同事。」'],
    options: [
      { label: '分给全办公室', fx: { career: 5, family: 3, mood: 5, money: 0 }, result: '那天办公室特别热闹。有人说「你妈真疼你」，你心里一暖。' },
      { label: '分给几个要好的', fx: { career: 2, family: 2, mood: 3, health: 1 }, result: '橘子很甜。你留了一箱底给自己，吃了两周。' },
      { label: '懒得带，自己慢慢吃', fx: { health: -2, mood: 1, career: -1, family: -2 }, result: '吃到第十天开始烂。你扔掉最后几个时，有点愧疚。' }
    ]
  },
  {
    id: 'n_any_b2_11',
    phase: 'any',
    weight: 8,
    text: ['公司要搞优化，名单还没出。茶水间里人人自危。', '你的直属领导找你谈话，说了句「好好干」。'],
    options: [
      { label: '主动接下最难的项目', fx: { career: 9, health: -5, mood: -3, money: 500 }, result: '项目做成了。名单出来时，你的名字不在上面。' },
      { label: '开始偷偷投简历', fx: { career: 3, mood: -4, health: -1, money: 0 }, result: '投了二十份，回了三个。你心里有底了，反而没那么慌。' },
      { label: '什么都不做，照常上下班', fx: { career: -2, mood: 3, health: 2, family: 1 }, result: '名单出来，你留下了。同事说你运气好，你说是因为不慌。' }
    ]
  },
  {
    id: 'n_any_b2_12',
    phase: 'any',
    weight: 8,
    text: ['你路过一家琴行，隔着玻璃看见一架旧钢琴。', '你已经十年没碰过琴键了。'],
    options: [
      { label: '进去问了价格，然后走了', fx: { mood: -1, money: 0, career: 1, health: 0 }, result: '价格比你想象的高三倍。你在门口站了一会儿，还是走了。' },
      { label: '进去弹了一首，弹得磕磕绊绊', fx: { mood: 8, career: -1, health: 1, looks: 1 }, result: '老板没赶你。弹完你红了眼眶，说不出为什么。' },
      { label: '报了成人钢琴班', fx: { money: -2400, mood: 7, health: 2, career: -2, looks: 2 }, result: '每周三晚上去上课。你成了班里年纪最小的学员。' }
    ]
  },
  {
    id: 'n_any_b2_13',
    phase: 'any',
    weight: 8,
    text: ['同学群里有人发了众筹链接，是另一个同学得了重病。', '目标三十万，已筹三万。'],
    options: [
      { label: '捐五百，转发', fx: { money: -500, mood: 4, family: 3, career: 0 }, result: '群里陆陆续续有人跟。你做的不多，但心里踏实。' },
      { label: '捐五十，不转发', fx: { money: -50, mood: -1, career: 1, family: 0 }, result: '你看着那三万变到五万。你算过，自己能承受的只有这个数。' },
      { label: '私下转给他家人一千', fx: { money: -1000, mood: 6, family: 5, career: -1 }, result: '他老婆发来一句「谢谢你，没留名字」。你没回。' }
    ]
  },
  {
    id: 'n_any_b2_14',
    phase: 'any',
    weight: 8,
    text: ['你发现自己的朋友圈已经三个月没更新了。', '上一条是转发的公司活动。'],
    options: [
      { label: '发一条真实的近况', fx: { mood: 6, family: 2, career: 0, looks: 1 }, result: '底下有人评论「好久不见」。你一个个回了，聊到很晚。' },
      { label: '把朋友圈关了', fx: { mood: 3, career: 2, health: 1, family: -1 }, result: '清净了不少。你开始用这些时间看书，一个月读完了三本。' },
      { label: '什么都不做', fx: { mood: -2, career: 0, health: 0, family: 0 }, result: '你划了半小时别人的动态，然后锁屏。什么也没留下。' }
    ]
  },
  {
    id: 'n_any_b2_15',
    phase: 'any',
    weight: 8,
    text: ['楼下早餐摊的阿姨记住了你：「还是老样子？」', '你忽然有点想哭，为一个不认识你名字的人。'],
    options: [
      { label: '「是的，谢谢阿姨。」', fx: { mood: 6, family: 3, health: 1, money: -8 }, result: '她多给你加了一勺咸菜。你端着豆浆走了很远才喝。' },
      { label: '「今天换个花样。」', fx: { mood: 4, health: 2, money: -12, career: 0 }, result: '她愣了一下，然后笑了。原来被记住，也可以被打破。' },
      { label: '点点头，扫码付钱', fx: { mood: 1, career: 1, health: 0, family: 0 }, result: '你照常吃完上班。但这件事，你在心里放了一整天。' }
    ]
  },
  {
    id: 'n_any_b2_16',
    phase: 'any',
    weight: 8,
    text: ['你在一个很旧的文件夹里找到了大学时写的计划书。', '第一页写着：「三十岁前要做到的十件事。」'],
    options: [
      { label: '一条条对照，划掉做到的三条', fx: { mood: 4, career: 2, health: 0, family: 0 }, result: '划完你发现，剩下的七条你已经不想做了。人变了。' },
      { label: '重新写一份新的', fx: { mood: 7, career: 5, health: 1, family: 1 }, result: '你写到凌晨。新的一份只有五条，但每一条都很实在。' },
      { label: '合上，放回原处', fx: { mood: -3, career: 0, health: 0, family: 0 }, result: '有些东西不看，就可以当不存在。你选择了这条路。' }
    ]
  },
  {
    id: 'n_any_b2_17',
    phase: 'any',
    weight: 8,
    text: ['邻居在楼道里堆了几个纸箱，把路堵了一半。', '已经两周了。'],
    options: [
      { label: '敲门提醒，顺手帮着搬', fx: { mood: 5, health: -1, family: 3, career: 0 }, result: '他一个劲道谢，第二天楼道就空了，还送了你一袋水果。' },
      { label: '贴张纸条在箱子上', fx: { mood: -1, career: 1, family: -1, health: 0 }, result: '第二天箱子没了，但纸条被撕碎扔在地上。' },
      { label: '绕着走，什么都不说', fx: { mood: -2, health: 0, career: 0, family: 0 }, result: '你每天侧身通过。三个月后搬家的是你。' }
    ]
  },
  {
    id: 'n_any_b2_18',
    phase: 'any',
    weight: 8,
    text: ['发了工资，你盯着银行卡余额看了很久。', '这个月还剩两千三。'],
    options: [
      { label: '给自己买件像样的东西', fx: { money: -800, mood: 7, looks: 3, career: 1 }, result: '你买了件外套。穿上它那天，你觉得生活还有点盼头。' },
      { label: '全存起来', fx: { money: 800, mood: 2, career: 3, health: -1 }, result: '余额多了八百。你看着那个数字，安全感涨了一点点。' },
      { label: '给我妈转一千', fx: { money: -1000, family: 7, mood: 5, career: 0 }, result: '她退回来五百，说「你自己留着」。你们推让了三个回合。' }
    ]
  },
  {
    id: 'n_any_b2_19',
    phase: 'any',
    weight: 8,
    text: ['地铁口有个卖唱的年轻人，唱得一般，但很卖力。', '琴盒里躺着几张零钱。'],
    options: [
      { label: '扫码给了二十', fx: { money: -20, mood: 5, family: 1, career: 0 }, result: '他停下来说了声谢谢。你摆摆手走了，心里有点暖。' },
      { label: '站着听完一整首', fx: { mood: 4, career: -1, health: 0, family: 0 }, result: '听完你鼓了掌。他朝你点了点头。你没给钱，但给了尊重。' },
      { label: '低头走过去', fx: { mood: -1, career: 1, money: 0, health: 0 }, result: '你走出了二十米，还能听见他的吉他声。' }
    ]
  },
  {
    id: 'n_any_b2_20',
    phase: 'any',
    weight: 8,
    text: ['你终于把攒了两年的年假休了，却不知道该干什么。', '第一天在家睡到了下午三点。'],
    options: [
      { label: '订张机票，随便去哪儿', fx: { money: -1800, mood: 8, health: 3, career: -2 }, result: '你去了个从没听说过的小城。在那儿你第一次睡到自然醒。' },
      { label: '在家大扫除，扔掉三大袋', fx: { health: 3, mood: 6, career: 0, family: 1 }, result: '扔完屋子空了一半，你坐在地板上，觉得呼吸都顺畅了。' },
      { label: '回老家待一周', fx: { family: 7, mood: 6, money: -500, career: -1 }, result: '我妈做了一桌子菜。你胖了三斤，也睡了七个好觉。' }
    ]
  },
  {
    id: 'n_any_b2_21',
    phase: 'any',
    weight: 8,
    text: ['你在电梯里听到两个同事议论你，说你「不太合群」。', '他们没看见你就在角落。'],
    options: [
      { label: '装没听见，照常打招呼', fx: { mood: -3, career: 2, health: 0, family: 0 }, result: '你冲他们笑了笑。那天下午你主动约大家喝了下午茶。' },
      { label: '当场说「我在呢」', fx: { mood: 3, career: -2, health: 0, family: 1 }, result: '两个人都僵住了。从此他们见你都绕着走。' },
      { label: '反思自己是不是真的不合群', fx: { mood: -5, career: 3, health: -1, family: 0 }, result: '你想了一周，最后决定：不合群就不合群吧。' }
    ]
  },
  {
    id: 'n_any_b2_22',
    phase: 'any',
    weight: 8,
    text: ['手机弹出提醒：「今天是爸爸生日。」', '你盯着那行字，手指悬在拨号键上。'],
    options: [
      { label: '打过去，说「爸，生日快乐」', fx: { family: 9, mood: 7, career: 0, health: 0 }, result: '他「嗯」了一声，然后说「你妈也想你了」。通话四分十七秒。' },
      { label: '发个红包，附一句祝福', fx: { family: 5, money: -200, mood: 3, career: 0 }, result: '他没收，第二天退回来了。你问他为什么，他说「你有心就行」。' },
      { label: '关掉提醒，什么也没做', fx: { family: -6, mood: -4, career: 1, health: 0 }, result: '第二天你想起这件事，一整天都不舒服。' }
    ]
  },
  {
    id: 'n_any_b2_23',
    phase: 'any',
    weight: 8,
    text: ['你常去的那家面馆要拆了。墙上贴着「感谢十年」。', '老板说下个月就搬走，搬到很远的地方。'],
    options: [
      { label: '最后来吃十次', fx: { money: -150, mood: 6, health: -1, family: 2 }, result: '老板记住了你，最后一次免了单。你们合了张影。' },
      { label: '问清新地址，以后去那吃', fx: { mood: 4, family: 2, career: 0, money: 0 }, result: '新店远了四十分钟。你去了两次，后来就少了。' },
      { label: '照常吃完，说声再见', fx: { mood: 3, health: 1, career: 1, family: 0 }, result: '你走出门时回头看了一眼。有些消失，是安静的。' }
    ]
  },
  {
    id: 'n_any_b2_24',
    phase: 'any',
    weight: 8,
    text: ['你开始掉头发。洗手池的滤网每周都要清理一次。', '网上说，这是压力大的表现。'],
    options: [
      { label: '买生发液，认真抹', fx: { money: -400, looks: 3, mood: -1, health: 1 }, result: '抹了三个月，效果微乎其微。但你坚持到了现在。' },
      { label: '剃光，一了百了', fx: { looks: -3, mood: 6, health: 2, career: 1 }, result: '剃完你照镜子，愣了三秒，然后笑了。清爽得不像话。' },
      { label: '不管它，顺其自然', fx: { mood: 2, money: 0, looks: -1, health: 0 }, result: '你学会了戴帽子。有些事，拖着拖着就习惯了。' }
    ]
  },
  {
    id: 'n_any_b2_25',
    phase: 'any',
    weight: 8,
    text: ['深夜加班回家，小区门口的保安跟你打招呼：「又这么晚。」', '这句话他每晚都说。'],
    options: [
      { label: '停下来跟他聊两句', fx: { mood: 6, family: 3, health: 1, career: -1 }, result: '他老家在河南，儿子今年高考。你听他讲了二十分钟。' },
      { label: '点点头，快步上楼', fx: { mood: 1, health: -1, career: 2, family: 0 }, result: '你倒在床上，连衣服都没脱就睡着了。' },
      { label: '第二天给他带了份早餐', fx: { money: -15, mood: 8, family: 4, career: 0 }, result: '他愣了很久才接过去。从那以后，他每晚都会等你回来。' }
    ]
  },
  {
    id: 'n_any_b2_26',
    phase: 'any',
    weight: 8,
    text: ['你参加了一场线上考试，考了两次都没过。', '第三次的机会，下个月。'],
    options: [
      { label: '报班，系统学一遍', fx: { money: -2800, career: 7, health: -3, mood: -2 }, result: '第三次你过了。证书寄到那天，你把照片发给了爸妈。' },
      { label: '自己整理错题，熬夜刷题', fx: { career: 5, health: -5, mood: -3, money: 0 }, result: '第三次差两分。你盯着成绩看了十分钟，然后关掉了页面。' },
      { label: '放弃了，不考了', fx: { career: -4, mood: 4, health: 3, money: 0 }, result: '你睡了个好觉。有些执念，放下比拿起来更需要勇气。' }
    ]
  },
  {
    id: 'n_any_b2_27',
    phase: 'any',
    weight: 8,
    text: ['朋友结婚，请你当伴郎。婚礼前一晚，他喝多了说：「我不确定。」', '你不知道该怎么接。'],
    options: [
      { label: '「现在说还来得及。」', fx: { family: 3, mood: 2, career: 0, health: 0 }, result: '他哭了半小时，第二天还是照常举行了。他过得很幸福。' },
      { label: '「都这时候了，别想了。」', fx: { career: 2, mood: -1, family: 1, health: 0 }, result: '婚礼很顺利。你站在他身边，替他捏了一把汗。' },
      { label: '陪他坐到天亮，什么也不说', fx: { family: 7, mood: 5, health: -3, career: -1 }, result: '天亮时他说「走吧」。有些决定，需要有人陪着做。' }
    ]
  },
  {
    id: 'n_any_b2_28',
    phase: 'any',
    weight: 8,
    text: ['你把用了三年的手机壳换了新的，图案是一只柴犬。', '同事说「你居然还有童心」。'],
    options: [
      { label: '「不行吗？」', fx: { mood: 6, looks: 2, career: 0, family: 1 }, result: '同事笑了。你发现承认自己喜欢什么，其实挺轻松的。' },
      { label: '换回纯色的', fx: { mood: -2, looks: -1, career: 2, health: 0 }, result: '你把柴犬壳收进抽屉。成熟有时候是种压抑。' },
      { label: '又买了个更幼稚的', fx: { money: -40, mood: 8, looks: 3, career: -1 }, result: '第二个是会发光的。你拿在手里，笑了整整一天。' }
    ]
  },
  {
    id: 'n_any_b2_29',
    phase: 'any',
    weight: 8,
    text: ['你在公交上给一位老人让座，他坐下后说了句：「现在的年轻人真好。」', '语气里有点意外。'],
    options: [
      { label: '笑一笑，说「应该的」', fx: { mood: 6, family: 3, health: 0, career: 0 }, result: '他一路都在跟旁边的人夸你。你有点不好意思，也很暖。' },
      { label: '「这话您说得好像很意外。」', fx: { mood: 3, career: 1, family: -1, health: 0 }, result: '老人愣了一下，然后笑了。你们聊了一路。' },
      { label: '戴上耳机，不再说话', fx: { mood: 2, health: 1, career: 1, family: 0 }, result: '你听着歌到站。那句话却一直在耳边转。' }
    ]
  },
  {
    id: 'n_any_b2_30',
    phase: 'any',
    weight: 8,
    text: ['年底了，公司发了一箱年货。你一个人拎着，走了两站路。', '箱子很沉，手勒得发红。'],
    options: [
      { label: '咬牙拎回去', fx: { health: -2, mood: 3, money: 0, career: 1 }, result: '到家你瘫在沙发上。但看着那箱年货，你觉得这一年没白过。' },
      { label: '叫个车', fx: { money: -30, health: 1, mood: 2, career: 0 }, result: '车来了，司机帮你搬上车。二十块买来了轻松，值。' },
      { label: '分一半给楼下保安', fx: { family: 5, mood: 7, money: 0, career: 0 }, result: '他推辞了半天还是收下了。那年春节，他给你留了门。' }
    ]
  },

  /* ---------------- meeting（第二批） ---------------- */
  {
    id: 'n_meet_b2_01', phase: 'meeting', weight: 9,
    text: ['{p}迟到了半小时，坐下第一句是「我把你照片给我妈看了」。', '她说得很急，像是在解释什么。'],
    options: [
      { label: '「她怎么说？」', fx: { affection: 11, family: 4, mood: 4 }, result: '「她说看着老实。」你们都笑了。这句评价，意外地靠谱。' },
      { label: '「你妈倒是很上心。」', fx: { affection: 4, mood: 1, career: 1 }, result: '她点点头，话题转到了别处。但你听出她家里催得紧。' },
      { label: '把手机递过去：「那我也看看你妈。」', fx: { affection: -5, mood: 2, family: -2 }, result: '她愣住了，笑得有点勉强。玩笑开过了头。' }
    ]
  },
  {
    id: 'n_meet_b2_02', phase: 'meeting', weight: 9,
    text: ['{p}问：「你相过多少次亲了？」', '这个问题像是在试探你的「库存」是否新鲜。'],
    options: [
      { label: '如实说，包括那些失败的', fx: { affection: 9, mood: 3, family: 1 }, result: '她说「你倒是坦白」。坦诚在这里，是最稀缺的东西。' },
      { label: '「你是第一个。」', fx: { affection: -6, mood: -2, career: 1 }, result: '她笑了笑，说「我不信」。一句谎，把整场的可信度都拉低了。' },
      { label: '「不重要，重要的是这次。」', fx: { affection: 13, mood: 6, career: 2 }, result: '她低头笑了一下。后来她说，就是这句让她决定再见面。' }
    ]
  },
  {
    id: 'n_meet_b2_03', phase: 'meeting', weight: 8,
    text: ['服务员上错了菜，端来一份你们没点的辣子鸡。', '{p}看着那盘菜，又看看你。'],
    options: [
      { label: '「那就吃这个吧，别浪费。」', fx: { affection: 8, mood: 4, money: 0, health: -1 }, result: '你们把这盘「意外」吃完了。她说这顿饭记得最清楚。' },
      { label: '叫服务员换掉', fx: { affection: -1, mood: 0, career: 1, money: 0 }, result: '菜换走了，气氛也跟着规矩了起来。' },
      { label: '「看来今天有惊喜。」', fx: { affection: 10, mood: 7, family: 1 }, result: '她笑出了声。一顿饭的走向，有时候就靠这一句。' }
    ]
  },
  {
    id: 'n_meet_b2_04', phase: 'meeting', weight: 8,
    text: ['{p}忽然问：「你觉得我们有可能吗？」', '这问题来得太直接，你手里的杯子停住了。'],
    options: [
      { label: '「我想试试。」', fx: { affection: 15, mood: 8, family: 3 }, result: '她低下头，耳根红了。那顿饭之后的每一句都轻松了起来。' },
      { label: '「这才第一次见面。」', fx: { affection: -4, mood: -1, career: 1 }, result: '她说「也是」。你们之间的空气，凉了半度。' },
      { label: '反问她：「你觉得呢？」', fx: { affection: 11, mood: 5, career: 1 }, result: '她说「如果你再主动一点，可能就有」。你听懂了。' }
    ]
  },
  {
    id: 'n_meet_b2_05', phase: 'meeting', weight: 8,
    text: ['{p}全程都很客气，客气得像在面试。', '她每句话都以「您」开头。'],
    options: [
      { label: '直接说「你不用这么客气」', fx: { affection: 9, mood: 4, career: 0 }, result: '她愣了一下，然后真的放松了。后半场才像两个人在说话。' },
      { label: '配合她的客气', fx: { affection: 1, mood: -2, career: 2 }, result: '你们像两个外交官，完成了一场没有破绽的会面。' },
      { label: '讲个自己出糗的事', fx: { affection: 12, mood: 7, looks: 1 }, result: '她笑了，第一次笑出了声。防线是从笑声里塌的。' }
    ]
  },
  {
    id: 'n_meet_b2_06', phase: 'meeting', weight: 8,
    text: ['结账时你发现钱包没带，手机也没电。', '{p}看着你，等着看你怎么收场。'],
    options: [
      { label: '坦白，押下手表说马上回来', fx: { affection: 6, mood: -3, career: 0, money: 0 }, result: '她笑了，说「我先付吧」。窘迫有时候也是种真诚。' },
      { label: '装作在找，拖时间', fx: { affection: -8, mood: -5, career: -2 }, result: '她默默拿出了手机。那顿饭剩下的时间，你一句话都说不出口。' },
      { label: '问店里能不能扫码加好友转账', fx: { affection: 9, mood: 3, career: 1, money: 0 }, result: '老板很好说话。你们加了微信，她说「这顿你欠我的」。' }
    ]
  },
  {
    id: 'n_meet_b2_07', phase: 'meeting', weight: 8,
    text: ['{p}说她刚分手三个月，是家里催着来相亲的。', '她说这话时一直看着窗外。'],
    options: [
      { label: '「那今天就不当相亲，就当认识个人。」', fx: { affection: 13, mood: 6, family: 2 }, result: '她转过头看了你很久，然后说「好」。那天你们聊了三个小时。' },
      { label: '「你还没放下吧。」', fx: { affection: 3, mood: -2, career: 1 }, result: '她沉默了一会儿。你戳破了，但没接住。' },
      { label: '讲自己也没完全放下的一段', fx: { affection: 11, mood: 5, family: 3 }, result: '两个没放下的人，反而聊得很投机。你们都懂那种感觉。' }
    ]
  },
  {
    id: 'n_meet_b2_08', phase: 'meeting', weight: 8,
    text: ['{p}带着她闺蜜来了。闺蜜坐在旁边，一句话不说，只是听。', '这像一场开卷考试，但监考老师在场。'],
    options: [
      { label: '把闺蜜也当成聊天对象', fx: { affection: 10, mood: 4, career: 2, family: 1 }, result: '闺蜜被逗笑了，气氛一下松了。她临走说「这人行」。' },
      { label: '只跟{p}说话，无视闺蜜', fx: { affection: 2, mood: -1, career: 0 }, result: '闺蜜全程黑脸。回去的路上，她给{p}发了很长一段话。' },
      { label: '直接问闺蜜「你觉得我怎么样」', fx: { affection: 8, mood: 5, career: 1, family: -1 }, result: '闺蜜被问懵了，半天憋出一句「还行吧」。大家都笑了。' }
    ]
  },
  {
    id: 'n_meet_b2_09', phase: 'meeting', weight: 7,
    text: ['你发现{p}的鞋很旧，鞋边都磨白了。', '但她背的包，明显不便宜。'],
    options: [
      { label: '什么也不说，正常聊天', fx: { affection: 6, mood: 2, career: 1 }, result: '你记住了这个细节，但没提。尊重比洞察力更难得。' },
      { label: '夸她的包好看', fx: { affection: 8, mood: 4, looks: 1, money: 0 }, result: '她笑得很开心，说「攒了三个月买的」。你听懂了她的优先级。' },
      { label: '问她「你这鞋穿多久了」', fx: { affection: -6, mood: -2, family: -1 }, result: '她低头看了一眼，笑容淡了。有些观察，说出来就成了冒犯。' }
    ]
  },
  {
    id: 'n_meet_b2_10', phase: 'meeting', weight: 7,
    text: ['临走时{p}说：「今天谢谢你，我会跟介绍人说的。」', '这句话听着像结束语。'],
    options: [
      { label: '「那我等你消息。」', fx: { affection: 7, mood: 2, career: 0 }, result: '你等了三天。第四天她主动发来消息。' },
      { label: '「明天有空吗？」', fx: { affection: 12, mood: 6, career: -1 }, result: '她愣了一下，说「明天……可以」。主动的人，运气不会差。' },
      { label: '「好，路上小心。」', fx: { affection: -2, mood: 1, career: 1 }, result: '你们礼貌告别。这条线，就这么断了。' }
    ]
  },
  {
    id: 'n_meet_b2_11', phase: 'meeting', weight: 7,
    text: ['{p}说她不想要孩子，说得很平静，像在陈述一个事实。', '「如果你接受不了，我们就不用继续了。」'],
    options: [
      { label: '「我也没想好，这个可以慢慢聊。」', fx: { affection: 10, family: 2, mood: 3 }, result: '她点了点头。坦诚的分歧，比虚假的附和更有生命力。' },
      { label: '「我家里可能接受不了。」', fx: { affection: -7, family: -3, mood: -2 }, result: '她说「我理解」。你们都很体面，也到此为止。' },
      { label: '「我也是这么想的。」（其实不是）', fx: { affection: 4, mood: -4, family: -2 }, result: '你撒了谎。这个谎，会在很久以后变成一颗雷。' }
    ]
  },
  {
    id: 'n_meet_b2_12', phase: 'meeting', weight: 7,
    text: ['{p}忽然说：「你比我相过的所有人都实在。」', '你不知道这是夸奖，还是她已经很累了。'],
    options: [
      { label: '「那是因为我笨，不会装。」', fx: { affection: 11, mood: 6, looks: 1 }, result: '她笑了很久。实在这个品质，在相亲市场里是稀缺品。' },
      { label: '「你这话听着像夸我自己。」', fx: { affection: 5, mood: 3, career: 1 }, result: '她也笑了，但笑声里有一点点疲惫。' },
      { label: '「你相过很多吗？」', fx: { affection: -3, mood: -1, family: 0 }, result: '她沉默了一下，说「二十几个吧」。话题就此打住。' }
    ]
  },
  {
    id: 'n_meet_b2_13', phase: 'meeting', weight: 7,
    text: ['你们聊到各自的童年。{p}说自己小时候被寄养在亲戚家。', '她说得很轻，像在讲别人的事。'],
    options: [
      { label: '认真听完，说「那你一定很懂事」', fx: { affection: 13, family: 4, mood: 4 }, result: '她眼眶红了，说「你是第一个这么说的」。' },
      { label: '讲一段自己小时候的事', fx: { affection: 9, family: 5, mood: 5 }, result: '你们交换了各自的童年。那种交换，比任何资料都管用。' },
      { label: '「那你现在一定很独立。」', fx: { affection: 6, mood: 2, career: 1 }, result: '她笑了笑。懂事和独立，是同一种伤的两种说法。' }
    ]
  },
  {
    id: 'n_meet_b2_14', phase: 'meeting', weight: 7,
    text: ['饭吃到一半，{p}的手机一直响。她看了三次，没接。', '第四次，她说了句「抱歉，我出去一下」。'],
    options: [
      { label: '等她，并且给她倒了杯热水', fx: { affection: 12, mood: 4, family: 3 }, result: '她回来时眼睛有点红，说「我爸住院了」。你送她去了医院。' },
      { label: '趁她出去，把单买了', fx: { affection: 8, money: -280, mood: 2 }, result: '她回来发现已经结过账，愣了很久。' },
      { label: '跟出去看看情况', fx: { affection: -4, mood: -2, career: 0 }, result: '她回头看见你，说了句「你跟着干嘛」。你退回了座位。' }
    ]
  },

  /* ---------------- date（第二批） ---------------- */
  {
    id: 'n_date_b2_01', phase: 'date', dateType: 'activity', weight: 8,
    text: ['你们去爬山。{p}爬到一半说「我不行了」。', '距离山顶还有八百米。'],
    options: [
      { label: '陪她坐下，不爬了', fx: { affection: 10, mood: 6, health: 2, career: 0 }, result: '你们在半山腰看了日落。她说这是她爬过最好的一次山。' },
      { label: '把她背包拿过来，说「我背你上去」', fx: { affection: 13, health: -4, mood: 7, looks: 1 }, result: '你背了她五十米就喘了，但她笑了一路，最后自己走完了。' },
      { label: '「来都来了，坚持一下。」', fx: { affection: -6, mood: -3, health: -2, career: 2 }, result: '她咬牙爬到了山顶，然后一句话也没跟你说。' }
    ]
  },
  {
    id: 'n_date_b2_02', phase: 'date', dateType: 'standard', weight: 8,
    text: ['餐厅里有人求婚，全场鼓掌。{p}看得眼睛发直。', '然后她好像意识到什么，赶紧低头吃饭。'],
    options: [
      { label: '「你很羡慕吗？」', fx: { affection: 9, mood: 4, family: 3 }, result: '她红着脸说「哪有」。但那顿饭她一直在笑。' },
      { label: '当作没看见，继续吃', fx: { affection: 2, mood: 1, career: 1 }, result: '你们安静地吃完了。有些话题，错过了就是错过了。' },
      { label: '「以后我也给你办一个。」', fx: { affection: 14, mood: 8, family: 5, money: 0 }, result: '她筷子都掉了。你没说时间，但她把这个承诺存起来了。' }
    ]
  },
  {
    id: 'n_date_b2_03', phase: 'date', dateType: 'simple', weight: 8,
    text: ['{p}带你去她常去的那家小馆子，藏在巷子最深处。', '「我一般不告诉别人的。」'],
    options: [
      { label: '「那我今天有口福了。」', fx: { affection: 11, mood: 6, family: 2, money: -90 }, result: '菜确实好吃。你也带她去了自己藏的那家，礼尚往来。' },
      { label: '拍照发朋友圈', fx: { affection: -3, mood: 1, looks: 1, career: 0 }, result: '她看了你一眼，说「别发定位」。你才意识到自己越界了。' },
      { label: '问她「为什么愿意带我来」', fx: { affection: 13, mood: 7, family: 3 }, result: '她低头扒饭，说「你自己想」。' }
    ]
  },
  {
    id: 'n_date_b2_04', phase: 'date', dateType: 'activity', weight: 8,
    text: ['你们去看展。{p}在一幅画前站了很久，那幅画是一片灰色的海。', '「你看，它是不是很难过。」'],
    options: [
      { label: '「嗯，我也觉得。」', fx: { affection: 10, mood: 5, family: 2 }, result: '她转头看你，眼睛很亮。能接住她感受的人不多。' },
      { label: '「不就是一片海吗。」', fx: { affection: -7, mood: -2, career: 1 }, result: '她没说话，往前走了。你们之间的距离拉开了两米。' },
      { label: '「你今天是有什么心事吗？」', fx: { affection: 12, mood: 6, family: 4 }, result: '她愣了一下，然后讲了工作上被冤枉的事。' }
    ]
  },
  {
    id: 'n_date_b2_05', phase: 'date', dateType: 'standard', weight: 8,
    text: ['{p}精心打扮了一个小时才出门。你说了句「今天怎么这么隆重」。', '她的笑容僵了一下。'],
    options: [
      { label: '补一句「很好看」', fx: { affection: 10, mood: 5, looks: 2 }, result: '她白你一眼，但嘴角是翘的。补救得还算及时。' },
      { label: '「我以为我们要去什么正式场合。」', fx: { affection: -2, mood: 0, career: 1 }, result: '她说「没有，就是想打扮一下」。你依然没听懂。' },
      { label: '什么也不说，牵她的手', fx: { affection: 13, mood: 7, family: 2 }, result: '有时候一个动作，比十句话都管用。' }
    ]
  },
  {
    id: 'n_date_b2_06', phase: 'date', dateType: 'simple', weight: 8,
    text: ['走路时{p}差点绊倒，你下意识扶了她一把。', '她站稳后，手没有松开。'],
    options: [
      { label: '就这么牵着走下去', fx: { affection: 15, mood: 8, family: 3, looks: 1 }, result: '你们牵了三条街。谁也没提这件事，谁也不想先松手。' },
      { label: '扶稳后立刻松开', fx: { affection: 2, mood: 1, career: 1 }, result: '她收回手，插进了口袋。后面的一段路走得很安静。' },
      { label: '「小心点，看路。」', fx: { affection: 5, mood: 2, health: 1 }, result: '她点点头。关心是对的，但时机错过了。' }
    ]
  },
  {
    id: 'n_date_b2_07', phase: 'date', dateType: 'activity', weight: 8,
    text: ['你们去玩密室逃脱。{p}被吓到尖叫，死死抓着你的胳膊。', '出来后她的手还在抖。'],
    options: [
      { label: '「早知道就不带你来了。」', fx: { affection: 12, mood: 5, family: 2, health: 0 }, result: '她说「没事，挺刺激的」。但你记住了，下次要选温和的。' },
      { label: '笑她胆小', fx: { affection: -5, mood: 2, career: 1 }, result: '她嘴上不服，但后面半小时都没怎么说话。' },
      { label: '去买两杯热饮，压压惊', fx: { affection: 14, money: -50, mood: 7, health: 1 }, result: '她捧着杯子，说「你刚才也吓到了吧」。你们笑成一团。' }
    ]
  },
  {
    id: 'n_date_b2_08', phase: 'date', dateType: 'standard', weight: 8,
    text: ['吃饭时{p}提到想换个城市发展，说得很随意。', '但你听出她是认真的。'],
    options: [
      { label: '认真问她「想好了吗」', fx: { affection: 12, family: 3, mood: 3, career: 0 }, result: '她说「还在想」。这场对话，把你们的关系往前推了一大步。' },
      { label: '「那我怎么办？」', fx: { affection: 4, mood: -1, family: 0, career: 1 }, result: '她愣住了，说「我还没决定呢」。你把压力给早了。' },
      { label: '「我支持你。」', fx: { affection: 15, mood: 6, family: 4, career: -2 }, result: '她眼眶红了。她后来说，这句话她记了很久很久。' }
    ]
  },
  {
    id: 'n_date_b2_09', phase: 'date', dateType: 'simple', weight: 7,
    text: ['{p}忽然问：「你手机里存了我的照片吗？」', '你的相册里，确实有一张她不知道的侧脸。'],
    options: [
      { label: '「有，你要看吗？」', fx: { affection: 14, mood: 7, looks: 2, family: 2 }, result: '她翻到那张侧脸，愣了很久，然后什么也没说。' },
      { label: '「没有。」', fx: { affection: -4, mood: -2, career: 1 }, result: '她「哦」了一声。你撒的谎，你自己都觉得没底气。' },
      { label: '把手机递给她，让她自己翻', fx: { affection: 11, mood: 6, family: 1, career: -1 }, result: '她翻了两下就还给你了，脸是红的。' }
    ]
  },
  {
    id: 'n_date_b2_10', phase: 'date', dateType: 'activity', weight: 7,
    text: ['你们一起做陶艺。{p}做了一个歪歪扭扭的杯子。', '「好丑啊。」她说着，却舍不得放下。'],
    options: [
      { label: '「丑得可爱，我要了。」', fx: { affection: 13, mood: 7, family: 3, money: -120 }, result: '那个杯子现在还在你桌上，用来装回形针。' },
      { label: '也做一个更丑的', fx: { affection: 11, mood: 8, looks: 1, money: -120 }, result: '两个丑杯子摆在一起，你们笑得直不起腰。' },
      { label: '「要不重新做一个？」', fx: { affection: -3, mood: -1, career: 1 }, result: '她放下杯子，说「算了，也没什么用」。' }
    ]
  },
  {
    id: 'n_date_b2_11', phase: 'date', dateType: 'standard', weight: 7,
    text: ['{p}说她最近在看心理医生，说得很平静。', '「我只是想告诉你，你别被吓到。」'],
    options: [
      { label: '「谢谢你告诉我。」', fx: { affection: 15, family: 5, mood: 5, health: 1 }, result: '她明显松了一口气。被接纳，比被安慰重要得多。' },
      { label: '「是不是我哪里做得不好？」', fx: { affection: 2, mood: -3, career: 0, family: 0 }, result: '她赶紧说「不是你的问题」。但话题的重心，被你抢走了。' },
      { label: '沉默很久，然后握住她的手', fx: { affection: 13, mood: 6, family: 4, health: 2 }, result: '她回握了一下。有些话不用说，力气到了就行。' }
    ]
  },
  {
    id: 'n_date_b2_12', phase: 'date', dateType: 'simple', weight: 7,
    text: ['你带她去你常去的天台，能看见半个城市的灯。', '「你经常一个人来吗？」'],
    options: [
      { label: '「以前是，以后想两个人来。」', fx: { affection: 14, mood: 8, family: 3, looks: 1 }, result: '她靠在你肩上，没说话。风很大，但你们都没觉得冷。' },
      { label: '「偶尔吧。」', fx: { affection: 6, mood: 3, career: 1 }, result: '你们看了会儿灯，然后下楼了。这个地方还是你的秘密。' },
      { label: '讲你在这里想过的那些事', fx: { affection: 11, mood: 6, family: 4, career: -1 }, result: '你讲了很多从没说过的话。她听完说「以后别一个人来了」。' }
    ]
  },
  {
    id: 'n_date_b2_13', phase: 'date', dateType: 'activity', weight: 7,
    text: ['你们去逛宜家。{p}在各种样板间里走来走去，看得特别认真。', '「以后我就想要个这样的厨房。」'],
    options: [
      { label: '「记下了。」', fx: { affection: 12, family: 4, mood: 6, career: 0 }, result: '她笑着推你。半天的宜家之行，比任何承诺都实在。' },
      { label: '「这个要三万八。」', fx: { affection: -3, mood: -1, career: 2, money: 0 }, result: '她看了眼价签，说「那算了」。气氛一下现实了。' },
      { label: '「那你教我做菜吧。」', fx: { affection: 13, mood: 7, family: 5, health: 1 }, result: '她愣了一下，然后笑了：「行啊，先从番茄炒蛋开始。」' }
    ]
  },
  {
    id: 'n_date_b2_14', phase: 'date', dateType: 'simple', weight: 7,
    text: ['送她到楼下，她说「上去喝杯水吧」。', '这句话的含义，你懂。'],
    options: [
      { label: '「好。」', fx: { affection: 16, mood: 9, health: -2, career: -1 }, result: '那杯水喝了三个小时。第二天你们都没去上班。' },
      { label: '「不了，太晚了，你早点休息。」', fx: { affection: 9, mood: 4, health: 2, family: 3 }, result: '她有点意外，也有点感动。分寸感，有时候更动人。' },
      { label: '「改天吧，我今天没洗澡。」', fx: { affection: 6, mood: 6, looks: -1, career: 0 }, result: '她笑骂你「滚」。你们在楼下笑了一分钟。' }
    ]
  },
  {
    id: 'n_date_b2_15', phase: 'date', dateType: 'standard', weight: 7,
    text: ['{p}忽然问：「如果我们以后分手了，你还会记得今天吗？」', '这个问题来得毫无预兆。'],
    options: [
      { label: '「别说这个。」', fx: { affection: 8, mood: -2, family: 2 }, result: '她「嗯」了一声。有些念头，说出来就成了预言。' },
      { label: '「会。所以我今天要表现好一点。」', fx: { affection: 14, mood: 7, career: 1, family: 2 }, result: '她笑了，说「你这个人真的很怪」。但她很高兴。' },
      { label: '认真回答「会，会记得很久」', fx: { affection: 12, mood: 5, family: 3, health: 0 }, result: '她沉默了一会儿，然后说「我也是」。' }
    ]
  },
  {
    id: 'n_date_b2_16', phase: 'date', dateType: 'activity', weight: 7,
    text: ['你们去听一场小型音乐会。{p}中途睡着了。', '她的头歪过来，靠在你肩上。'],
    options: [
      { label: '一动不动，让她睡', fx: { affection: 13, health: -2, mood: 6, career: 0 }, result: '散场时她醒来，说「我居然睡着了，对不起」。你说「没事」。' },
      { label: '轻轻叫醒她', fx: { affection: 3, mood: 1, career: 1, health: 0 }, result: '她勉强撑到最后。出来后说「其实我没听进去」。' },
      { label: '也跟着闭上眼', fx: { affection: 10, mood: 7, health: 2, career: -1 }, result: '你们在音乐里睡了二十分钟。她说这是她听过最好的一场。' }
    ]
  },

  /* ---------------- single（第二批） ---------------- */
  {
    id: 'n_single_b2_01', phase: 'single', weight: 9,
    text: ['介绍人发来一张照片，附言「条件很好，就是离过一次」。', '照片上的女人笑得很温和。'],
    options: [
      { label: '回「我不介意」', fx: { family: 3, mood: 4, looks: 0, career: 0 }, result: '介绍人很高兴，第二天就安排了见面。你后来一点也不后悔。' },
      { label: '回「我再想想」', fx: { mood: -2, career: 1, family: -1 }, result: '你想了三天，最后还是回绝了。有些偏见，要很久才能放下。' },
      { label: '直接问「为什么离的」', fx: { family: 2, mood: 2, career: 1, health: 0 }, result: '介绍人回了个「性格不合」。你知道这四个字背后，藏着很多东西。' }
    ]
  },
  {
    id: 'n_single_b2_02', phase: 'single', weight: 9,
    text: ['你在相亲软件上划了三百个人，一个都没匹配上。', '算法建议你：「试试放宽距离限制。」'],
    options: [
      { label: '放宽到全城', fx: { mood: -2, career: 1, health: 0, money: 0 }, result: '匹配数是上去了，但见面要两小时。你放弃了其中大部分。' },
      { label: '卸载软件，出门参加线下活动', fx: { mood: 6, looks: 2, money: -200, career: -1 }, result: '你报了个徒步团。现实里的人，比照片真实得多。' },
      { label: '把自我介绍全改了', fx: { mood: 4, looks: 1, career: 0, family: 0 }, result: '改完当天，匹配数涨了三倍。原来问题一直出在你自己身上。' }
    ]
  },
  {
    id: 'n_single_b2_03', phase: 'single', weight: 9,
    text: ['我妈给你转了三千块，备注「相亲经费」。', '你看着那笔钱，不知道该笑还是该叹气。'],
    options: [
      { label: '收下，真的用在相亲上', fx: { money: 3000, family: 4, mood: 2, career: 0 }, result: '你用这笔钱买了套像样的衣服，见了四个人。其中一个后来成了。' },
      { label: '退回去', fx: { family: -3, mood: 3, career: 1, money: 0 }, result: '我妈又转了一次，还多加了五百。你们来回推了四次。' },
      { label: '收下，但存起来没花', fx: { money: 3000, mood: -1, career: 2, family: 1 }, result: '这笔钱至今还在卡里。每次看到，都想起她的心意。' }
    ]
  },
  {
    id: 'n_single_b2_04', phase: 'single', weight: 8,
    text: ['同事说要给你介绍她表妹，条件是「必须有房」。', '你算了算首付，还差得远。'],
    options: [
      { label: '如实说「我暂时买不起」', fx: { mood: -3, career: 2, family: -1, health: 0 }, result: '同事说「那我再问问」。这件事就这么过去了。' },
      { label: '先见一面再说', fx: { mood: 3, looks: 1, career: 0, money: 0 }, result: '见面聊得不错。她说「房子可以一起想办法」。你松了口气。' },
      { label: '婉拒，说「条件不合适」', fx: { mood: 2, career: 1, family: 0, health: 0 }, result: '你保全了面子，也错过了一个可能。' }
    ]
  },
  {
    id: 'n_single_b2_05', phase: 'single', weight: 8,
    text: ['深夜，你给一个聊了一周的人发了句「在干嘛」。', '三分钟后她回：「在想你为什么还不睡。」'],
    options: [
      { label: '「因为想跟你说话。」', fx: { affection: 8, mood: 8, health: -1, career: 0 }, result: '你们聊到凌晨四点。第二天顶着黑眼圈，但心情好得像飞。' },
      { label: '「加班，习惯晚睡。」', fx: { affection: 2, career: 3, mood: 1, health: -2 }, result: '她说「别太累」。话题止步于此。' },
      { label: '「睡不着，你陪我聊聊？」', fx: { affection: 10, mood: 6, family: 2, health: -1 }, result: '她打了个语音过来。那一夜，你们第一次听到对方的声音。' }
    ]
  },
  {
    id: 'n_single_b2_06', phase: 'single', weight: 8,
    text: ['你一个人去看了场电影，全场只有你和一个大爷。', '散场时灯亮了，大爷看了你一眼。'],
    options: [
      { label: '冲他笑笑，先走', fx: { mood: 3, health: 1, career: 0, family: 0 }, result: '你走出影院，外面阳光很好。一个人也可以很好。' },
      { label: '跟大爷聊了两句剧情', fx: { mood: 6, family: 3, career: 0, health: 0 }, result: '大爷说他每周都来，老伴走了三年。你陪他走了两站路。' },
      { label: '发朋友圈吐槽「包场了」', fx: { mood: 4, looks: 1, career: 0, family: -1 }, result: '底下有人评论「下次叫我」。你没回，但记下了这条评论。' }
    ]
  },
  {
    id: 'n_single_b2_07', phase: 'single', weight: 8,
    text: ['你发现自己开始对相亲麻木了。每次见面都像在走流程。', '介绍人问「这次怎么样」，你说「还行」。'],
    options: [
      { label: '停一停，先不想这件事', fx: { mood: 5, health: 3, career: -2, family: -2 }, result: '你停了两个月。再开始时，你终于能看清对面那个人了。' },
      { label: '继续走流程', fx: { mood: -4, career: 2, health: -2, money: 0 }, result: '你又见了八个。年底复盘时，你发现自己一个都没记住。' },
      { label: '跟介绍人说「别给我安排了」', fx: { family: -4, mood: 6, career: 1, health: 1 }, result: '介绍人愣了。但那个月，你过得前所未有的清净。' }
    ]
  },
  {
    id: 'n_single_b2_08', phase: 'single', weight: 8,
    text: ['你去参加了一场八分钟约会。第十二个人坐下时，你已经在重复同样的自我介绍。', '她打断你：「你刚才说的是第几遍了？」'],
    options: [
      { label: '愣住，然后实话实说', fx: { mood: 5, looks: 1, career: 0, family: 1 }, result: '她笑了，说「那我们聊点别的吧」。那天你们聊得最久。' },
      { label: '继续背完', fx: { mood: -3, career: 1, health: 0, family: 0 }, result: '她礼貌听完，然后时间到了。' },
      { label: '反过来问她「你呢，第几遍了」', fx: { mood: 7, career: 2, family: 2, health: 0 }, result: '她说「第七遍」。你们相视苦笑，气氛一下就真实了。' }
    ]
  },
  {
    id: 'n_single_b2_09', phase: 'single', weight: 8,
    text: ['我爸难得给你打电话，只说了三句话：「别着急」「别将就」「缺钱说话」。', '然后就挂了。'],
    options: [
      { label: '回拨过去，跟他多聊两句', fx: { family: 9, mood: 7, career: 0, health: 1 }, result: '他明显有点意外，但还是聊了十分钟。这是你们最长的一次通话。' },
      { label: '发条短信说「知道了」', fx: { family: 4, mood: 3, career: 1, health: 0 }, result: '他回了个「嗯」。父子的交流，总是这么短。' },
      { label: '盯着手机看了很久，什么都没回', fx: { family: -3, mood: -2, career: 0, health: 0 }, result: '三天后你想起这件事，心里堵得慌。' }
    ]
  },
  {
    id: 'n_single_b2_10', phase: 'single', weight: 8,
    text: ['你在书店的相亲角看到一张卡片：「92年，女，喜欢做饭和爬山，想找个一起吃饭的人。」', '字迹很工整，右下角画了个笑脸。'],
    options: [
      { label: '扫码加上了', fx: { mood: 6, looks: 1, career: 0, family: 2 }, result: '她通过得很快。第一句是「你是第几个扫的」。你们聊了一晚上。' },
      { label: '拍下来，但没扫', fx: { mood: 1, career: 1, health: 0, family: 0 }, result: '照片至今还在你相册里。有些错过，是自己选的。' },
      { label: '在旁边也贴一张自己的', fx: { money: -20, mood: 7, looks: 2, career: -1 }, result: '一周后有人扫了你。她说「我看到你那张卡片，觉得这人挺有意思」。' }
    ]
  },
  {
    id: 'n_single_b2_11', phase: 'single', weight: 8,
    text: ['朋友说「我给你介绍个特别好的」，然后约你周末出来。', '到了才发现，是一屋子人的联谊。'],
    options: [
      { label: '硬着头皮待到最后', fx: { mood: -2, career: 1, looks: 1, health: -1 }, result: '你加了七个微信，最后只聊成了一个。但至少没白来。' },
      { label: '待半小时就走', fx: { mood: 3, career: 0, family: -1, health: 1 }, result: '朋友追出来问你怎么了。你说「不太适应」，他有点失望。' },
      { label: '找个角落，跟同样落单的人聊天', fx: { mood: 8, family: 3, career: 0, health: 0 }, result: '那个人也是被朋友骗来的。你们聊了一晚上，成了朋友。' }
    ]
  },
  {
    id: 'n_single_b2_12', phase: 'single', weight: 8,
    text: ['你妈给你发了个相亲对象的微信，说「人家主动加你的，好好聊」。', '你点开一看，对方已经发了三条消息。'],
    options: [
      { label: '认真回，聊起来', fx: { family: 5, mood: 4, career: 0, health: 0 }, result: '聊了三天，发现挺投缘。我妈的功劳，难得一次。' },
      { label: '回得敷衍', fx: { family: -3, mood: -1, career: 1, health: 0 }, result: '对方慢慢也不回了。我妈为此念叨了半个月。' },
      { label: '先问我妈「你怎么认识人家的」', fx: { family: 2, mood: 2, career: 1, health: 0 }, result: '原来是我妈跳广场舞认识的。你哭笑不得，但还是聊了。' }
    ]
  },
  {
    id: 'n_single_b2_13', phase: 'single', weight: 8,
    text: ['你把相亲对象的条件列成表格，打分排序。', '排到第十个时，你停下了。'],
    options: [
      { label: '删掉表格', fx: { mood: 5, career: -1, family: 2, health: 1 }, result: '你意识到自己在挑商品，不是在找人。这个觉醒很重要。' },
      { label: '继续排完，选分数最高的', fx: { career: 4, mood: -2, looks: 0, family: 1 }, result: '你见了分数最高的那个，聊了十分钟就发现不对。' },
      { label: '把「聊得来」这一项加到最高权重', fx: { mood: 7, career: 2, family: 3, health: 0 }, result: '重排之后，第一名换了人。后来的事实证明，这个权重是对的。' }
    ]
  },
  {
    id: 'n_single_b2_14', phase: 'single', weight: 8,
    text: ['凌晨两点，你还在刷相亲软件。划了四百多次，拇指发酸。', '你想不起来自己到底在找什么。'],
    options: [
      { label: '关掉，去睡觉', fx: { health: 5, mood: 3, career: 1, looks: 1 }, result: '第二天醒来，世界没变，但你清醒了很多。' },
      { label: '给三个聊过的人各发一句「晚安」', fx: { mood: -2, looks: -2, career: 0, family: 0 }, result: '只有一个人回。你看着那条回复，更加空虚了。' },
      { label: '打开备忘录，写下「我到底想找什么样的人」', fx: { mood: 6, career: 3, family: 2, health: -1 }, result: '你写到天亮。那份清单后来成了你的标准，也救了你。' }
    ]
  },

  /* ---------------- talking（第二批） ---------------- */
  {
    id: 'n_talk_b2_01', phase: 'talking', weight: 9,
    text: ['{p}发来一张傍晚的天空，说「今天的云很好看」。', '这是一句没什么用，但很重要的话。'],
    options: [
      { label: '回一张你这边拍的', fx: { affection: 11, mood: 6, career: -1, family: 2 }, result: '你们交换了各自的天空。从此这成了一个默契。' },
      { label: '「嗯，好看。」', fx: { affection: 3, mood: 2, career: 1, health: 0 }, result: '她回了个笑脸。对话就这样结束了。' },
      { label: '「你在哪儿？我过去找你。」', fx: { affection: 15, mood: 8, money: -60, career: -2 }, result: '半小时后你们站在同一片天空下。她愣了很久才笑出来。' }
    ]
  },
  {
    id: 'n_talk_b2_02', phase: 'talking', weight: 9,
    text: ['你发现{p}的朋友圈对你不可见了。', '你翻了三遍，确认自己没看错。'],
    options: [
      { label: '装作不知道', fx: { affection: -3, mood: -5, career: 1, health: 0 }, result: '你什么都没说，但那几天聊天都心不在焉。' },
      { label: '直接问她', fx: { affection: 6, mood: 3, family: 2, career: -1 }, result: '她说「怕你看到我发的废话」。这个解释，居然是真的。' },
      { label: '减少主动联系，看她会不会找你', fx: { affection: -6, mood: -3, career: 2, health: 1 }, result: '三天后她问「你最近怎么了」。你却不知道该怎么接。' }
    ]
  },
  {
    id: 'n_talk_b2_03', phase: 'talking', weight: 9,
    text: ['{p}问你：「你觉得我们算什么关系？」', '你盯着这行字，心跳漏了一拍。'],
    options: [
      { label: '「你觉得呢？」', fx: { affection: 7, mood: 4, career: 1, family: 0 }, result: '她说「你先说」。你们绕了半小时，还是没绕出来。' },
      { label: '「我想正式一点。」', fx: { affection: 15, mood: 9, family: 4, career: -1 }, result: '她打了很长一段话过来，中心思想是「我也是」。' },
      { label: '「现在这样不好吗？」', fx: { affection: -8, mood: -4, career: 1, family: -1 }, result: '她沉默了很久，说「挺好的」。但语气已经不一样了。' }
    ]
  },
  {
    id: 'n_talk_b2_04', phase: 'talking', weight: 8,
    text: ['{p}说自己周末要去参加前任的婚礼。', '她说得很轻松，但你听出了一丝试探。'],
    options: [
      { label: '「需要我陪你去吗？」', fx: { affection: 13, mood: 5, family: 3, career: -1 }, result: '她愣了一下，说「不用啦」。但那天你还是去了，站在她旁边。' },
      { label: '「那你穿好看点。」', fx: { affection: 8, mood: 6, looks: 1, career: 0 }, result: '她笑骂你「乌鸦嘴」。这句玩笑，反而化解了尴尬。' },
      { label: '「你还想去？」', fx: { affection: -9, mood: -3, family: -2, career: 0 }, result: '她说「人家请我了」。你们第一次有了明显的隔阂。' }
    ]
  },
  {
    id: 'n_talk_b2_05', phase: 'talking', weight: 8,
    text: ['你们约好周末见面，周五晚上她说「我妈让我回家」。', '理由很合理，但你总觉得哪里不对。'],
    options: [
      { label: '「那改天，没事。」', fx: { affection: 8, mood: 3, family: 3, career: 0 }, result: '她主动补了一句「下周我请你」。大度是有回报的。' },
      { label: '追问「是不是不想见我」', fx: { affection: -7, mood: -4, career: 0, health: 0 }, result: '她说「你想多了」。但那次之后，她真的开始躲你了。' },
      { label: '「那我送你回去吧。」', fx: { affection: 12, money: -120, mood: 5, career: -1 }, result: '她犹豫了一下，答应了。车上她说了实话：是有点紧张。' }
    ]
  },
  {
    id: 'n_talk_b2_06', phase: 'talking', weight: 8,
    text: ['{p}发来一段六十秒的语音，讲她今天遇到的烦心事。', '你听完，想了想该怎么回。'],
    options: [
      { label: '也发一段六十秒的语音回去', fx: { affection: 12, mood: 6, family: 2, career: -1 }, result: '她说「听你说话我就好多了」。声音比文字有温度。' },
      { label: '打字分析，帮她想办法', fx: { affection: 6, career: 3, mood: 2, health: 0 }, result: '她按你说的做了，事情解决了。但她好像没那么开心。' },
      { label: '只回一句「辛苦了，抱抱」', fx: { affection: 10, mood: 5, family: 3, career: 0 }, result: '她回了个拥抱的表情。有时候，被理解比被指导重要。' }
    ]
  },
  {
    id: 'n_talk_b2_07', phase: 'talking', weight: 8,
    text: ['你看到{p}给别的男生朋友圈点了赞。', '你翻了那个男生的主页，看了半小时。'],
    options: [
      { label: '忍不住问她那人是谁', fx: { affection: -5, mood: -6, career: 0, health: 0 }, result: '她说「大学同学」。你信了，但那晚没睡好。' },
      { label: '什么也不说，翻过去', fx: { affection: 4, mood: -2, career: 2, health: 0 }, result: '你忍住了。第二天醒来，觉得也没什么大不了。' },
      { label: '给她发条消息，聊聊别的', fx: { affection: 9, mood: 5, family: 2, career: 0 }, result: '她很快回了。你的不安，被她的回应化解了。' }
    ]
  },
  {
    id: 'n_talk_b2_08', phase: 'talking', weight: 8,
    text: ['{p}说她同事都在问她有没有对象。', '她讲这话的时候，语气有点期待。'],
    options: [
      { label: '「那你怎么说的？」', fx: { affection: 11, mood: 6, family: 3, career: 0 }, result: '她说「我说快了」。你盯着这三个字，笑了很久。' },
      { label: '「那你要不要考虑一下我？」', fx: { affection: 14, mood: 8, family: 4, career: -1 }, result: '她回了三个字：「考虑中。」你们的关系，就这么定了。' },
      { label: '「同事真爱管闲事。」', fx: { affection: 2, mood: 1, career: 1, family: 0 }, result: '她「嗯」了一声。你把话题岔开了，也岔开了机会。' }
    ]
  },
  {
    id: 'n_talk_b2_09', phase: 'talking', weight: 8,
    text: ['{p}半夜发来：「你睡了吗，我做了个噩梦。」', '时间是凌晨三点四十。'],
    options: [
      { label: '立刻打过去', fx: { affection: 14, health: -2, mood: 6, career: -1 }, result: '她接了，没说梦的内容，就听你说话。二十分钟后她睡着了。' },
      { label: '发语音讲个无聊的故事', fx: { affection: 11, mood: 6, health: -1, family: 2 }, result: '你讲了十分钟，她说「好了，我不怕了」。' },
      { label: '早上才看到，回「怎么了」', fx: { affection: -4, mood: -2, career: 1, health: 1 }, result: '她说「没事了」。你错过了一次很重要的机会。' }
    ]
  },
  {
    id: 'n_talk_b2_10', phase: 'talking', weight: 8,
    text: ['{p}问你：「你跟几个人同时聊着？」', '这个问题，回答什么都是坑。'],
    options: [
      { label: '「只有你。」', fx: { affection: 9, mood: 4, family: 2, career: 0 }, result: '她说「我不信，但爱听」。坦诚与情话之间，你找到了平衡。' },
      { label: '如实说「还有两个，但都快断了」', fx: { affection: 6, mood: 2, career: 1, family: 0 }, result: '她沉默了很久，说「你倒是诚实」。这个诚实有代价。' },
      { label: '反问「你呢」', fx: { affection: 4, mood: 3, career: 2, family: 0 }, result: '她说「比你多」。你们相视无言，各自有了心事。' }
    ]
  },
  {
    id: 'n_talk_b2_11', phase: 'talking', weight: 8,
    text: ['{p}给你发了一首歌，说「你听听这个」。', '歌很冷门，评论只有十三条。'],
    options: [
      { label: '听完，认真说感受', fx: { affection: 12, mood: 7, career: -1, family: 2 }, result: '她回了一大段，说「你是第一个听完的」。' },
      { label: '回一首你喜欢的', fx: { affection: 10, mood: 6, family: 1, career: 0 }, result: '你们交换歌单，聊到了深夜。音乐是最短的捷径。' },
      { label: '说「好听」，但没听完', fx: { affection: -2, mood: 0, career: 1, health: 0 }, result: '她问「哪里好听」，你答不上来。' }
    ]
  },
  {
    id: 'n_talk_b2_12', phase: 'talking', weight: 8,
    text: ['你们聊到各自对婚姻的看法。{p}说「我其实挺恐婚的」。', '她说完就看着你。'],
    options: [
      { label: '「我也是。」', fx: { affection: 11, mood: 5, family: 3, health: 0 }, result: '你们一起吐槽了半小时婚姻制度。恐婚的人，反而更认真。' },
      { label: '「那就不结，先过着。」', fx: { affection: 9, mood: 6, family: -2, career: 0 }, result: '她笑了，说「你这人真会偷换概念」。气氛轻松了。' },
      { label: '「别想那么远。」', fx: { affection: 3, mood: 1, career: 2, family: 0 }, result: '她「嗯」了一声。这个话题就这样被你按了下去。' }
    ]
  },
  {
    id: 'n_talk_b2_13', phase: 'talking', weight: 8,
    text: ['{p}忽然说：「我想见你。」就四个字，没有表情。', '现在是晚上九点，你们隔着半个城市。'],
    options: [
      { label: '「等我，一小时。」', fx: { affection: 16, money: -100, mood: 9, health: -2 }, result: '你在她楼下见到她时，她什么也没说，只是抱了你一下。' },
      { label: '「明天吧，今天太晚了。」', fx: { affection: 4, mood: 2, health: 2, career: 1 }, result: '她回「好」。第二天你们见了面，但那种冲动已经淡了。' },
      { label: '「怎么了，出什么事了？」', fx: { affection: 8, mood: 4, family: 3, career: 0 }, result: '她说「没事，就是想见你」。你才明白，这也是一种事。' }
    ]
  },
  {
    id: 'n_talk_b2_14', phase: 'talking', weight: 8,
    text: ['你发现自己每天醒来的第一件事，是看{p}有没有发消息。', '这个发现让你有点慌。'],
    options: [
      { label: '把这件事告诉她', fx: { affection: 13, mood: 7, family: 2, career: -1 }, result: '她回「我也是，从昨天开始的」。你们同时笑了。' },
      { label: '藏起来，装作无所谓', fx: { affection: 3, mood: -2, career: 2, health: 0 }, result: '你继续装作淡定。但这种在乎，藏是藏不住的。' },
      { label: '把手机放到客厅，强迫自己不去看', fx: { affection: -2, mood: 1, health: 3, career: 2 }, result: '你坚持了一周。但那条消息，你还是第一时间看了。' }
    ]
  },

  /* ---------------- dating（第二批） ---------------- */
  {
    id: 'n_dating_b2_01', phase: 'dating', weight: 9,
    text: ['{p}在你手机里看到一条暧昧的群消息，是同事开玩笑发的。', '她没说话，把手机放在了桌上。'],
    options: [
      { label: '当场解释，把上下文给她看', fx: { affection: 10, mood: 3, career: 1, family: 0 }, result: '她看完说「我想多了」。主动透明，是安全感最好的来源。' },
      { label: '说「你翻我手机？」', fx: { affection: -8, mood: -4, family: -2, career: 0 }, result: '她说「我不是故意的」。但这件事，从此横在你们中间。' },
      { label: '把手机递过去：「你可以随时看。」', fx: { affection: 13, mood: 5, family: 3, career: -1 }, result: '她愣了一下，把手机推回来：「我信你。」' }
    ]
  },
  {
    id: 'n_dating_b2_02', phase: 'dating', weight: 9,
    text: ['{p}升职了，薪水比你高不少。她请客吃饭，全程都很兴奋。', '你笑着祝贺，心里有点说不清的东西。'],
    options: [
      { label: '真心为她高兴，点了最贵的菜', fx: { affection: 14, mood: 7, family: 4, career: 0 }, result: '她说「你一点都不介意吗」。你说「我介意什么，我女朋友能干」。' },
      { label: '笑着祝贺，但话少了很多', fx: { affection: -4, mood: -5, career: 1, health: 0 }, result: '她察觉到了，问「你是不是不高兴」。你说没有，语气却出卖了你。' },
      { label: '当晚开始改简历', fx: { career: 6, mood: -2, health: -2, money: 0 }, result: '你把压力转成了动力。三个月后，你也升了。' }
    ]
  },
  {
    id: 'n_dating_b2_03', phase: 'dating', weight: 9,
    text: ['你们一起逛超市。{p}把一盒草莓放进车里，又拿了出来。', '这个动作她做了两次。'],
    options: [
      { label: '默默放回去，结账时说是自己想吃的', fx: { affection: 13, money: -60, mood: 6, family: 3 }, result: '她发现后什么也没说，但那天晚上草莓洗得很仔细。' },
      { label: '问她「想吃就买啊」', fx: { affection: 7, money: -60, mood: 4, career: 0 }, result: '她说「有点贵」。你才知道她一直在替你省钱。' },
      { label: '什么也没做', fx: { affection: -2, mood: 0, career: 1, family: -1 }, result: '草莓最终没买。这件小事，她会记很久。' }
    ]
  },
  {
    id: 'n_dating_b2_04', phase: 'dating', weight: 9,
    text: ['{p}说想养狗，你嫌麻烦。这个话题你们吵了三次。', '今天她又提起来了，语气有点冲。'],
    options: [
      { label: '「那就养，我负责遛。」', fx: { affection: 13, money: -1200, mood: 6, health: 1, family: 4 }, result: '她高兴得跳起来。后来狗每天逼着你早起，你反而更健康了。' },
      { label: '「等搬了大房子再说。」', fx: { affection: 4, mood: 1, career: 2, family: 1 }, result: '她说「那得等到什么时候」。但至少没有吵起来。' },
      { label: '「我说不行就是不行。」', fx: { affection: -12, mood: -6, family: -5, career: 0 }, result: '她摔门出去了。那晚你们第一次分房睡。' }
    ]
  },
  {
    id: 'n_dating_b2_05', phase: 'dating', weight: 9,
    text: ['{p}生病发烧，你请了假在家照顾她。她迷迷糊糊说了句「别走」。', '你握着她的手，手心很烫。'],
    options: [
      { label: '守到她退烧', fx: { affection: 15, health: -4, career: -3, mood: 4, family: 3 }, result: '凌晨四点她退烧了。你趴在床边睡着了，醒来时她正看着你。' },
      { label: '叫她闺蜜来，自己去上班', fx: { affection: -3, career: 3, mood: -2, family: 0 }, result: '她没说什么。但闺蜜看你的眼神，你读懂了。' },
      { label: '请假照顾，但抱怨了两句', fx: { affection: 6, career: -1, mood: -3, health: -1 }, result: '她听着你的抱怨，说「你回去上班吧」。' }
    ]
  },
  {
    id: 'n_dating_b2_06', phase: 'dating', weight: 8,
    text: ['{p}说她妈妈想见你第二次，这次是正式的家宴。', '上次是见面，这次是「考核」。'],
    options: [
      { label: '提前打听她爸妈的喜好', fx: { affection: 10, family: 7, mood: 3, career: 1, money: -500 }, result: '你带的礼很对路。她妈私下跟她说「这孩子上心」。' },
      { label: '照常去，不做特别准备', fx: { affection: 5, family: 3, mood: 2, career: 0 }, result: '家宴没什么纰漏，也没什么亮点。中规中矩。' },
      { label: '推说加班，改天再去', fx: { affection: -6, family: -5, career: 2, mood: -2 }, result: '她没说什么，但她妈的态度从此冷了下来。' }
    ]
  },
  {
    id: 'n_dating_b2_07', phase: 'dating', weight: 8,
    text: ['你妈和{p}第一次单独吃饭。你全程提心吊胆。', '回来后{p}的表情很微妙。'],
    options: [
      { label: '问她「我妈没说什么吧」', fx: { affection: 6, family: 3, mood: 2, career: 0 }, result: '她说「挺好的，就是问了我三次什么时候结婚」。' },
      { label: '分别问两个人感受', fx: { affection: 8, family: 5, mood: 3, career: 1 }, result: '两边的说法居然一致。你判断出这次是真的顺利。' },
      { label: '装作不在意', fx: { affection: 2, mood: -2, career: 1, family: 0 }, result: '你没问，她也没说。这件事就这么含糊过去了。' }
    ]
  },
  {
    id: 'n_dating_b2_08', phase: 'dating', weight: 8,
    text: ['{p}说想和你一起存钱买房。首付要四十万，你们现在只有八万。', '她把一张存折推到你面前。'],
    options: [
      { label: '一起做预算，每月固定存', fx: { affection: 13, money: -2000, family: 6, career: 2, mood: 3 }, result: '你们开了个共同账户。每月一号，成了你们的节日。' },
      { label: '说「这事太远了，先不想」', fx: { affection: -5, mood: -2, family: -3, career: 1 }, result: '她把存折收了回去。那天晚上她睡得很早。' },
      { label: '接下存折，说「我尽快」', fx: { affection: 9, family: 4, career: 4, money: -1000, health: -2 }, result: '你开始接私活。累是真累，但看着数字一点点涨，值。' }
    ]
  },
  {
    id: 'n_dating_b2_09', phase: 'dating', weight: 8,
    text: ['你们在商场遇到她前任。对方主动打招呼，{p}礼貌回应。', '整个过程不到两分钟，但你如坐针毡。'],
    options: [
      { label: '大方打招呼，搂住她', fx: { affection: 12, mood: 5, looks: 2, career: 1 }, result: '回去路上她说「你刚才那一下，帅死了」。' },
      { label: '一言不发，事后冷暴力', fx: { affection: -9, mood: -6, family: -2, health: 0 }, result: '她解释了一晚上，你一句也没听进去。' },
      { label: '回去后坦诚说「我吃醋了」', fx: { affection: 11, mood: 6, family: 3, career: 0 }, result: '她笑了，说「你这人真可爱」。坦白比装没事强得多。' }
    ]
  },
  {
    id: 'n_dating_b2_10', phase: 'dating', weight: 8,
    text: ['{p}说想去进修两年，学费不便宜，还要辞掉工作。', '她眼里有一种很久没见过的光。'],
    options: [
      { label: '全力支持，把存款拿出来', fx: { affection: 16, money: -15000, family: 5, mood: 6, career: -2 }, result: '她哭了，说「等我毕业」。那两年你过得很紧，但很值。' },
      { label: '支持，但建议她读在职的', fx: { affection: 8, career: 3, mood: 3, family: 2 }, result: '她考虑了很久，选了折中方案。理性，但少了点闯劲。' },
      { label: '「你现在这样不好吗？」', fx: { affection: -11, mood: -5, family: -4, career: 2 }, result: '她眼里的光灭了。很多年后你还在后悔这句话。' }
    ]
  },
  {
    id: 'n_dating_b2_11', phase: 'dating', weight: 8,
    text: ['你们一起整理旧物，{p}翻出一箱前任留下的东西。', '「要不要扔掉？」她问。'],
    options: [
      { label: '「你决定就好。」', fx: { affection: 11, mood: 4, family: 3, career: 0 }, result: '她想了很久，最后只留了一本书。她说「这样就好」。' },
      { label: '主动说「我帮你扔」', fx: { affection: 7, mood: 3, health: 1, family: 1 }, result: '你们一起把箱子抬下楼。回来的路上，她牵着你的手。' },
      { label: '「先别扔，万一有用呢。」', fx: { affection: -6, mood: -3, career: 1, family: -1 }, result: '她把箱子塞回了床底。有些东西留着，就是留着。' }
    ]
  },
  {
    id: 'n_dating_b2_12', phase: 'dating', weight: 8,
    text: ['你加班到十一点，回家时{p}已经睡了。桌上留着饭和一张纸条。', '纸条上写着：「菜在锅里，记得吃。」'],
    options: [
      { label: '吃完，在纸条背面写句话', fx: { affection: 12, mood: 7, family: 4, health: 1 }, result: '第二天她看到背面的「谢谢」，拍照发了朋友圈。' },
      { label: '轻手轻脚吃完，不打扰她', fx: { affection: 8, mood: 4, health: 2, career: 1 }, result: '你坐在她旁边看了一会儿，然后去睡了。' },
      { label: '把饭倒掉，直接睡', fx: { affection: -5, mood: -2, health: -2, career: 1 }, result: '第二天她问「饭吃了吗」，你说「吃了」。' }
    ]
  },

  /* ---------------- married（第二批） ---------------- */
  {
    id: 'n_marry_b2_01', phase: 'married', weight: 9,
    text: ['我妈和{p}又因为带孩子的方式吵起来了。你在客厅，两个房间的门都开着。', '一个在哭，一个在叹气。'],
    options: [
      { label: '进去先安慰{p}，再哄我妈', fx: { affection: 12, family: 4, mood: 3, health: -1 }, result: '顺序很重要。你先站了她，再哄老人，居然都哄好了。' },
      { label: '把两人都叫出来，当面说清楚', fx: { affection: 6, family: 6, mood: -2, career: 1 }, result: '吵了一小时，最后达成共识。疼，但一次到位。' },
      { label: '躲出去，等她们自己解决', fx: { affection: -8, family: -5, mood: -4, career: 0 }, result: '等你回来，战场是静了，但两个人都记着你的缺席。' }
    ]
  },
  {
    id: 'n_marry_b2_02', phase: 'married', weight: 9,
    text: ['{p}说她想辞职在家带孩子，但你知道她有多喜欢那份工作。', '她说这话时，一直在叠衣服。'],
    options: [
      { label: '「别辞，我妈可以来帮忙。」', fx: { affection: 14, family: 6, money: -2000, mood: 5, career: -1 }, result: '她停下手的动作，抬头看你，眼睛红了。' },
      { label: '「你自己决定，我都支持。」', fx: { affection: 7, family: 3, mood: 3, career: 0 }, result: '她想了一周，最后还是辞了。你至今不知道那是不是她的本意。' },
      { label: '算一笔经济账给她看', fx: { affection: -4, career: 4, money: 0, mood: -2 }, result: '她听完说「我知道」。那晚你们背对背睡的。' }
    ]
  },
  {
    id: 'n_marry_b2_03', phase: 'married', weight: 9,
    text: ['结婚三年，你们的对话越来越短。「嗯」「好」「知道了」。', '有天你数了数，一天说的话不超过二十句。'],
    options: [
      { label: '主动约她出去吃顿饭', fx: { affection: 12, money: -300, mood: 7, family: 3 }, result: '饭桌上你们聊了两小时。原来话都在，只是没人先开口。' },
      { label: '写张纸条放在她包里', fx: { affection: 10, mood: 6, family: 4, career: 0 }, result: '她中午发现，下午发来一条：「晚上早点回来。」' },
      { label: '就这样吧，老夫老妻都这样', fx: { affection: -7, mood: -4, career: 1, family: -2 }, result: '沉默继续。有些婚姻，是在安静里慢慢凉掉的。' }
    ]
  },
  {
    id: 'n_marry_b2_04', phase: 'married', weight: 8,
    text: ['孩子发烧到三十九度，半夜两点。{p}抱着孩子，你打车。', '急诊室里全是人，队伍排得很长。'],
    options: [
      { label: '陪到底，天亮才回家', fx: { affection: 13, health: -5, career: -3, family: 5, money: -600 }, result: '孩子退烧时，{p}靠在你肩上睡着了。你们仨挤在塑料椅上。' },
      { label: '让她先带孩子，你去排队挂号', fx: { affection: 8, career: 1, health: -3, family: 3, money: -600 }, result: '分工明确，效率高。但那晚她一个人抱了很久。' },
      { label: '打电话叫你妈过来', fx: { affection: 2, family: 4, mood: -2, money: -600 }, result: '我妈来了，但{p}整晚没怎么说话。' }
    ]
  },
  {
    id: 'n_marry_b2_05', phase: 'married', weight: 8,
    text: ['{p}翻出你们恋爱时的照片，一张张给你看。', '「你看你那时候多瘦。」'],
    options: [
      { label: '跟着一起看，聊到很晚', fx: { affection: 11, mood: 8, family: 4, health: 1 }, result: '你们翻完了三个相册。那天晚上比任何纪念日都暖。' },
      { label: '「别看了，都过去了。」', fx: { affection: -4, mood: -2, career: 1, family: -1 }, result: '她默默把相册收了起来。' },
      { label: '提议再拍一组一样的', fx: { affection: 14, money: -800, mood: 9, looks: 2, family: 5 }, result: '你们真的去了同一家照相馆。照片里多了个人，少了点腰围。' }
    ]
  },
  {
    id: 'n_marry_b2_06', phase: 'married', weight: 8,
    text: ['你发现自己越来越怕回家。车停在楼下，总要坐十分钟才上去。', '这十分钟里，你想了很多。'],
    options: [
      { label: '跟{p}坦白这件事', fx: { affection: 10, mood: 5, family: 3, health: 1 }, result: '她沉默了很久，说「我也是」。原来你们都在怕。' },
      { label: '给自己找点事做，晚点回', fx: { career: 4, health: -2, mood: -2, family: -3 }, result: '你加了两个月的班。家越来越像旅馆。' },
      { label: '什么都不做，继续坐十分钟', fx: { mood: -5, health: 0, career: 0, family: -2 }, result: '这十分钟变成了二十分钟，然后是半小时。' }
    ]
  },

  /* ---------------- any（第三批） ---------------- */
  {
    id: 'n_any_b3_01', phase: 'any', weight: 8,
    text: ['你在旧外套口袋里摸到两百块，已经洗得发软。', '你想不起来是什么时候放进去的。'],
    options: [
      { label: '当成意外之财，吃顿好的', fx: { money: 200, mood: 7, health: 1, career: 0 }, result: '你用这钱吃了顿火锅。这大概是今年最开心的一顿。' },
      { label: '存起来', fx: { money: 200, career: 2, mood: 2, health: 0 }, result: '你把它夹进书里。三个月后你又忘了它在哪。' },
      { label: '给楼下卖唱的', fx: { money: -200, mood: 9, family: 4, career: 0 }, result: '他愣了很久，连鞠了两个躬。你走得很快，但心里很暖。' }
    ]
  },
  {
    id: 'n_any_b3_02', phase: 'any', weight: 8,
    text: ['公司新来了个实习生，管你叫「老师」，什么都问。', '你从他身上看到了三年前的自己。'],
    options: [
      { label: '认真带他，花不少时间', fx: { career: 6, mood: 5, health: -2, money: 0 }, result: '三个月后他能独当一面了。他请客那天，说了句「谢谢你」。' },
      { label: '应付了事', fx: { career: 1, mood: -1, health: 1, family: 0 }, result: '他后来跟了别人。你偶尔会想起那双眼睛。' },
      { label: '告诉他一些职场的实话', fx: { career: 4, mood: 6, family: 2, health: 0 }, result: '他听完沉默了很久。一年后他说「您当年那句话，我记到现在」。' }
    ]
  },
  {
    id: 'n_any_b3_03', phase: 'any', weight: 8,
    text: ['你收到大学室友的结婚请柬，附了一张合照。', '照片上八个人，现在还联系的只有三个。'],
    options: [
      { label: '去，并且提前一天到', fx: { money: -1200, family: 5, mood: 7, career: -2 }, result: '你们八个人聚齐了六个。喝到凌晨，像回到十九岁。' },
      { label: '去，随礼就走', fx: { money: -600, mood: 1, career: 1, family: 0 }, result: '你待了四十分钟。红包到了，人也到了，心没到。' },
      { label: '找借口不去，只转红包', fx: { money: -600, mood: -3, career: 2, family: -3 }, result: '他回了个「谢谢兄弟」。你们的关系，又淡了一层。' }
    ]
  },
  {
    id: 'n_any_b3_04', phase: 'any', weight: 8,
    text: ['你在地铁上看到一个人在看书，是你想读但一直没读的那本。', '到站时他合上书，你忍不住多看了两眼。'],
    options: [
      { label: '开口问他在哪买的', fx: { mood: 6, career: 2, family: 2, health: 0 }, result: '他笑了，说「图书馆借的」。你们聊了一路，还加了微信。' },
      { label: '默默记下书名，回去下单', fx: { money: -50, career: 3, mood: 4, health: 0 }, result: '书到了，你读了三十页就放下了。但至少开始了。' },
      { label: '什么也没做', fx: { mood: -1, career: 0, health: 0, family: 0 }, result: '你下车，走进人群。那本书你到现在也没读。' }
    ]
  },
  {
    id: 'n_any_b3_05', phase: 'any', weight: 8,
    text: ['连续加了一周班，今天终于准点下班。走出大楼时天还亮着。', '你忽然不知道该干什么。'],
    options: [
      { label: '在街上漫无目的地走', fx: { mood: 7, health: 3, career: -1, looks: 1 }, result: '你走了两个小时，路过很多平时没注意过的店。' },
      { label: '回家倒头就睡', fx: { health: 6, mood: 3, career: 1, family: 0 }, result: '你睡了十个小时。醒来时天又黑了，但你精神很好。' },
      { label: '给很久没联系的朋友打电话', fx: { family: 6, mood: 8, career: -1, health: 0 }, result: '他也很意外。你们聊了一个小时，约了下周吃饭。' }
    ]
  },
  {
    id: 'n_any_b3_06', phase: 'any', weight: 8,
    text: ['你妈学会用微信视频了，每天晚上都要打过来。', '内容大同小异：吃了什么，穿得够不够。'],
    options: [
      { label: '每天都接，哪怕只有两分钟', fx: { family: 9, mood: 5, career: -1, health: 0 }, result: '这两分钟成了她的期待。你后来才知道，她每天掐着点等。' },
      { label: '隔三差五接一次', fx: { family: 3, mood: 2, career: 1, health: 0 }, result: '她从不抱怨，只是每次接通都特别高兴。' },
      { label: '教她用朋友圈，让她有事看那边', fx: { family: 4, career: 3, mood: 1, health: 0 }, result: '她学会了点赞。从此你的每条动态，第一个赞都是她的。' }
    ]
  },
  {
    id: 'n_any_b3_07', phase: 'any', weight: 8,
    text: ['你发现自己开始在意养生：泡枸杞、戴护腰、十一点前睡。', '同事笑你「提前进入老年」。'],
    options: [
      { label: '继续，不管别人怎么说', fx: { health: 7, mood: 4, career: -1, looks: 1 }, result: '半年后体检，各项指标都好了。他们不笑了，开始问你怎么做到的。' },
      { label: '偷偷养生，嘴上不承认', fx: { health: 5, career: 2, mood: 2, looks: 0 }, result: '你把枸杞装进咖啡杯里。养生这件事，也可以很酷。' },
      { label: '算了，爱咋咋地', fx: { health: -3, mood: 3, career: 1, looks: -1 }, result: '你继续熬夜。年轻是资本，但资本会花完。' }
    ]
  },
  {
    id: 'n_any_b3_08', phase: 'any', weight: 8,
    text: ['楼下新开了家早餐店，老板娘每天五点就起来和面。', '她说「习惯了，睡久了腰疼」。'],
    options: [
      { label: '每天都去，成了常客', fx: { money: -60, mood: 6, health: 2, family: 2 }, result: '一个月后，她记得你不吃香菜。这座城市因此小了一点。' },
      { label: '偶尔去，偶尔不去', fx: { money: -20, mood: 2, health: 1, career: 0 }, result: '你去了几次。那家的包子确实不错。' },
      { label: '从来没去过', fx: { mood: -1, career: 1, health: 0, family: 0 }, result: '半年后店关了。你不知道，也没错过什么。' }
    ]
  },
  {
    id: 'n_any_b3_09', phase: 'any', weight: 8,
    text: ['你把用了五年的枕套换掉了，洗得发白，边角都起了球。', '新的很白，白得有点不习惯。'],
    options: [
      { label: '把旧的留着当抹布', fx: { mood: 3, health: 1, career: 1, family: 0 }, result: '勤俭是种习惯。你妈要是知道，一定会夸你。' },
      { label: '干脆扔了', fx: { mood: 5, health: 2, looks: 1, career: 0 }, result: '你扔得很果断。有时候告别旧东西，也是一种仪式。' },
      { label: '有点舍不得，收进柜子', fx: { mood: -1, family: 2, health: 0, career: 0 }, result: '柜子里的东西越来越多。你怕自己会变成一个念旧的人。' }
    ]
  },
  {
    id: 'n_any_b3_10', phase: 'any', weight: 8,
    text: ['你在公司年会上抽到三等奖，是一台豆浆机。', '台下有人起哄，说「正好给你以后对象用」。'],
    options: [
      { label: '笑着重重点头', fx: { mood: 6, looks: 1, career: 1, family: 2 }, result: '你把豆浆机抱回了家。它至今还在，用了很多年。' },
      { label: '转手挂到二手平台', fx: { money: 120, career: 2, mood: 1, family: -1 }, result: '卖了以前的一半价。你算得很清楚，但少了点乐趣。' },
      { label: '送给我妈', fx: { family: 7, mood: 5, money: 0, career: 0 }, result: '她高兴得天天打豆浆，还拍视频发给你。' }
    ]
  },
  {
    id: 'n_any_b3_11', phase: 'any', weight: 8,
    text: ['你路过母校，门卫还是那个门卫，只是头发白了。', '他想了想，还是挥手让你进去了。'],
    options: [
      { label: '在操场走两圈', fx: { mood: 7, health: 2, career: -1, family: 1 }, result: '跑道还是红色的。你走完两圈，像是跟十九岁的自己打了个招呼。' },
      { label: '去食堂吃一顿', fx: { money: -20, mood: 6, health: -1, family: 0 }, result: '味道没变，价格涨了一倍。你吃得比当年慢。' },
      { label: '只在门口看了看，没进去', fx: { mood: 2, career: 1, health: 0, family: 0 }, result: '有些地方，远远看一眼就够了。' }
    ]
  },
  {
    id: 'n_any_b3_12', phase: 'any', weight: 8,
    text: ['同事结婚，全公司凑份子。有人提议每人五百，你觉得有点多。', '但大家都没说话。'],
    options: [
      { label: '照给，入乡随俗', fx: { money: -500, career: 3, mood: -2, family: 0 }, result: '你给了。婚礼上他特意过来敬了你一杯。' },
      { label: '私下少给，说自己手头紧', fx: { money: -200, career: -2, mood: 1, family: 1 }, result: '组织者愣了一下，还是收了。但这件事有人记下了。' },
      { label: '公开说「这个数有点多吧」', fx: { money: -300, career: -3, mood: 3, family: 0 }, result: '最后降到三百。有人谢你，也有人怪你。' }
    ]
  },
  {
    id: 'n_any_b3_13', phase: 'any', weight: 8,
    text: ['深夜，你接到一个陌生号码，是老家的堂弟。', '「哥，我在你那个城市，能住你那儿几天吗？」'],
    options: [
      { label: '「来吧，地址发你。」', fx: { family: 6, money: -300, mood: 4, career: -1 }, result: '他住了五天，走的时候把屋子收拾得干干净净。' },
      { label: '「我这儿不方便，我给你订个酒店。」', fx: { money: -600, family: 2, career: 1, mood: 1 }, result: '他连声道谢。你们都体面，但疏远了一点。' },
      { label: '问清楚什么事，再看帮不帮', fx: { family: 4, mood: 3, career: 1, money: -200 }, result: '他是来找工作的。你托人帮他牵了线，比留宿管用得多。' }
    ]
  },
  {
    id: 'n_any_b3_14', phase: 'any', weight: 8,
    text: ['你发现自己连续三天没说过一句超过十个字的话。', '除了外卖和「收到」。'],
    options: [
      { label: '给家里打个电话', fx: { family: 7, mood: 6, health: 1, career: 0 }, result: '我妈说了四十分钟。你只说了「嗯」，但声音是活的。' },
      { label: '去楼下便利店跟店员多聊两句', fx: { mood: 5, family: 2, health: 1, career: 0 }, result: '你们聊了天气和关东煮。三分钟，够了。' },
      { label: '什么都不做', fx: { mood: -4, health: -1, career: 1, family: -2 }, result: '第四天你说了两个字：「好的。」' }
    ]
  },
  {
    id: 'n_any_b3_15', phase: 'any', weight: 8,
    text: ['你买了个小台灯，暖光的。装上那天，屋子的感觉完全变了。', '你坐在灯下看了很久。'],
    options: [
      { label: '换掉所有冷光灯', fx: { money: -300, mood: 7, health: 2, looks: 1 }, result: '屋子暖了，你的睡眠也好了。光真的能改变心情。' },
      { label: '只留这一盏', fx: { money: -80, mood: 5, health: 1, career: 0 }, result: '你把它放在床头。每晚睡前，只看这一片暖。' },
      { label: '拍照发给我妈', fx: { family: 5, mood: 5, money: -80, career: 0 }, result: '她说「这才像个家」。你盯着这四个字看了很久。' }
    ]
  },
  {
    id: 'n_any_b3_16', phase: 'any', weight: 8,
    text: ['你参加了一场行业分享会，主讲人只比你大两岁。', '散场后大家都在加他微信，你站在人群外。'],
    options: [
      { label: '等人群散了再上去聊', fx: { career: 8, mood: 5, health: -1, money: 0 }, result: '你们聊了二十分钟。他后来推荐了你一个机会。' },
      { label: '也挤上去加微信', fx: { career: 4, mood: 2, health: -1, looks: 0 }, result: '加上了，但从来没说过话。通讯录里又多了一个名字。' },
      { label: '听完就走', fx: { career: 1, mood: -2, health: 1, family: 0 }, result: '你带着笔记回家了。那些笔记，你后来也没翻过。' }
    ]
  },
  {
    id: 'n_any_b3_17', phase: 'any', weight: 8,
    text: ['你在阳台上种的小葱活了，绿油油的一小盆。', '这是你养活的第一个活物。'],
    options: [
      { label: '拍照发给我妈', fx: { family: 6, mood: 7, health: 1, career: 0 }, result: '她回「比我种的强」。你笑了一整天。' },
      { label: '做菜时掐两根用', fx: { health: 3, mood: 5, money: 0, career: 0 }, result: '自己种的葱，味道竟然真的不一样。' },
      { label: '又买了三个花盆', fx: { money: -90, mood: 6, health: 2, family: 1 }, result: '阳台变成了小菜园。你开始期待每天回家。' }
    ]
  },
  {
    id: 'n_any_b3_18', phase: 'any', weight: 8,
    text: ['地铁上有人晕倒了，周围一片慌乱。', '你离得最近。'],
    options: [
      { label: '立刻上前，让人打 120', fx: { health: -2, mood: 6, family: 4, career: -1 }, result: '人没事。家属后来找到你，跪下要谢，你扶起来了。' },
      { label: '站在人群里，等别人先动', fx: { mood: -3, career: 1, health: 0, family: -1 }, result: '有人上前了。你退到一边，心里堵了一整天。' },
      { label: '帮忙维持秩序，让人群散开', fx: { mood: 5, career: 2, health: -1, family: 2 }, result: '你做的事不大，但空气流通了。有时候这就是最关键的。' }
    ]
  },
  {
    id: 'n_any_b3_19', phase: 'any', weight: 8,
    text: ['你把手机里三千张照片整理了一遍，删到只剩四百张。', '删掉的大多是拍糊的风景和重复的午餐。'],
    options: [
      { label: '把剩下的做成相册', fx: { money: -150, mood: 7, family: 4, career: -1 }, result: '相册寄到那天，你翻了一遍。原来这几年你过得并不差。' },
      { label: '继续删，删到一百张', fx: { mood: 4, career: 2, health: 1, family: 0 }, result: '断舍离是会传染的。你第二天扔了三大袋衣服。' },
      { label: '算了，太麻烦', fx: { mood: -1, career: 0, health: 0, family: 0 }, result: '三千张照片继续躺着。你再也没打开过那个相册。' }
    ]
  },
  {
    id: 'n_any_b3_20', phase: 'any', weight: 8,
    text: ['你开始每天走路上班，四十分钟。', '第三天下起了雨。'],
    options: [
      { label: '打伞照走', fx: { health: 4, mood: 5, career: -1, looks: 0 }, result: '你到公司时鞋湿了，但精神很好。走路这件事会上瘾。' },
      { label: '今天坐地铁，明天再说', fx: { health: -1, mood: 1, career: 1, money: -6 }, result: '「明天再说」说了三天，习惯就断了。' },
      { label: '跑起来，当作锻炼', fx: { health: 6, mood: 6, career: -1, looks: 1 }, result: '你跑到公司，喘得像条狗，但一整天都很亢奋。' }
    ]
  },
  {
    id: 'n_any_b3_21', phase: 'any', weight: 8,
    text: ['你妈寄来一件毛衣，说是她自己织的，针脚有点歪。', '你试了试，袖子一长一短。'],
    options: [
      { label: '当场穿上，拍照片发回去', fx: { family: 9, mood: 8, looks: -1, career: 0 }, result: '她回了五个感叹号。那件毛衣你穿了整个冬天。' },
      { label: '收起来，说「挺好的」', fx: { family: 4, mood: 3, career: 1, looks: 0 }, result: '毛衣在柜底躺了两年。你偶尔看见，心里有点愧疚。' },
      { label: '说「妈，现在没人穿这个了」', fx: { family: -6, mood: -2, career: 2, looks: 1 }, result: '电话那头静了很久，她说「哦，那我下次不织了」。' }
    ]
  },
  {
    id: 'n_any_b3_22', phase: 'any', weight: 8,
    text: ['你在便利店排队，前面的人忘带手机，付不了钱。', '他翻遍了口袋，只有几个硬币。'],
    options: [
      { label: '帮他付了', fx: { money: -18, mood: 7, family: 3, career: 0 }, result: '他非要加你微信还钱。你们后来成了点头之交。' },
      { label: '什么也没做', fx: { mood: -2, career: 1, health: 0, family: 0 }, result: '他最后只买了一瓶水。你看着他走出去。' },
      { label: '让他先买，自己垫上', fx: { money: -18, mood: 6, family: 2, career: 1 }, result: '他第二天真来还钱了。你还记得他那句「谢谢」很认真。' }
    ]
  },
  {
    id: 'n_any_b3_23', phase: 'any', weight: 8,
    text: ['你发现自己已经很久没认真看过一场日落了。', '今天难得六点下班。'],
    options: [
      { label: '找个地方，看完再回家', fx: { mood: 8, health: 2, career: -1, looks: 1 }, result: '你在江边看了二十分钟。天黑透了才起身，心情出奇地平静。' },
      { label: '边走边看，拍张照', fx: { mood: 4, career: 1, health: 1, family: 0 }, result: '照片存在手机里，你至今没发过。' },
      { label: '回家加班', fx: { career: 4, health: -2, mood: -2, family: 0 }, result: '你错过了这场日落。还有下一场，但你不确定会去看。' }
    ]
  },
  {
    id: 'n_any_b3_24', phase: 'any', weight: 8,
    text: ['你收到一条银行短信：定期存款到期，利息一百三十七块。', '你盯着那个数字，忽然有点感慨。'],
    options: [
      { label: '继续存，加一点进去', fx: { money: -2000, career: 3, mood: 3, health: 0 }, result: '你又存了两千。复利这件事，时间越长越明显。' },
      { label: '取出来花掉', fx: { money: 137, mood: 5, health: 1, career: -1 }, result: '你用这笔钱吃了顿好的。一百三十七块，买来一顿满足。' },
      { label: '转给我妈', fx: { money: -137, family: 6, mood: 5, career: 0 }, result: '她说「你自己留着」。你说是利息，她才高兴地收下。' }
    ]
  },
  {
    id: 'n_any_b3_25', phase: 'any', weight: 8,
    text: ['深夜，你听到楼上有孩子的哭声，还有大人压低的呵斥。', '哭声持续了很久。'],
    options: [
      { label: '上去敲门提醒', fx: { family: 3, mood: -2, health: -1, career: 0 }, result: '门开了一条缝，里面的人说了句「知道了」。哭声停了。' },
      { label: '报警', fx: { family: 2, mood: 1, career: 1, health: -1 }, result: '警察来过之后安静了。你不知道自己做的是不是多余。' },
      { label: '关上窗，装作没听见', fx: { mood: -4, health: 0, career: 0, family: -2 }, result: '你戴上了耳机。那晚你睡得很不安稳。' }
    ]
  },

  /* ---------------- 收尾补齐：single 2 / meeting 1 / talking 2 / dating 2 / date 1 ---------------- */
  {
    id: 'n_single_b3_01', phase: 'single', weight: 10,
    text: ['你把手机里的相亲软件卸了又装，装了又卸。', '这次你没装回去，而是把头像换成了侧脸。'],
    options: [
      { label: '认真写一段自我介绍', fx: { mood: 4, career: 2, looks: 2, health: -1 }, result: '你写了三百字，删到只剩两句。发出去后，一整天都在等红点。' },
      { label: '什么都不写，只传照片', fx: { looks: 5, mood: -2, family: -2, career: 0 }, result: '来打招呼的人多了三倍，但没一个聊过三句。' },
      { label: '把软件彻底删掉', fx: { mood: -5, career: 3, health: 2, family: 3 }, result: '你清净了三天，第四天又手贱装了回来。' }
    ]
  },
  {
    id: 'n_single_b3_02', phase: 'single', weight: 10,
    text: ['你妈把你拉进一个相亲群，群里两百人，全是爸妈。', '第一条消息是：「我家女儿 92 年，本科，有编制。」'],
    options: [
      { label: '默默把群消息免打扰', fx: { mood: 3, career: 1, family: -3, health: 0 }, result: '你清净了。但每次打开微信，都看得见那个红点。' },
      { label: '也发一条自己的资料', fx: { family: 5, mood: -2, looks: 1, career: -1 }, result: '你妈在群里连发十个点赞表情。当天有三个人加了你。' },
      { label: '退群', fx: { mood: 4, family: -6, career: 2, health: 0 }, result: '你妈打了三个电话。第三个你接了，她说「就当没这回事」。' }
    ]
  },
  {
    id: 'n_meet_b3_01', phase: 'meeting', weight: 10,
    text: ['第二次见面，她迟到了二十分钟。', '坐下第一句是：「我跟你说个事，我可能要被派去外地一年。」'],
    options: [
      { label: '「那就先别开始了吧」', fx: { mood: -3, career: 2, health: 1, affection: -8 }, result: '她愣了一下，然后点头说「我理解」。那顿饭吃得很客气。' },
      { label: '「一年而已，我可以等」', fx: { affection: 10, mood: -2, family: -2, career: -2 }, result: '她眼睛红了。后来的一年里，你们谁都没再提这句话。' },
      { label: '「那你什么时候走？」', fx: { affection: 3, mood: 1, career: 3, looks: -1 }, result: '你问得太实际了。她笑了一下，说「下个月」。' }
    ]
  },
  {
    id: 'n_talk_b3_01', phase: 'talking', weight: 10,
    text: ['她发来一张照片：两只猫并排睡在纸箱里。', '配文：「楼下那只又来了，我给它起名叫周五。」'],
    options: [
      { label: '「那我是周几？」', fx: { affection: 9, mood: 5, career: -1, family: 0 }, result: '她回了个「你烦人」，然后发了一串笑哭的表情。' },
      { label: '「别喂了，喂了就赖着不走了」', fx: { affection: -3, mood: 2, career: 2, health: 0 }, result: '她说「我知道」。第二天照片里还是有两只猫。' },
      { label: '第二天带了一袋猫粮过去', fx: { money: -60, affection: 12, mood: 4, health: -1 }, result: '她开门时愣住了。那个瞬间你觉得自己做对了。' }
    ]
  },
  {
    id: 'n_talk_b3_02', phase: 'talking', weight: 10,
    text: ['凌晨一点，她发来：「你睡了吗。」', '你回过去。她说：「没事，就是想确认一下。」'],
    options: [
      { label: '打语音过去', fx: { affection: 11, mood: 6, health: -3, career: -2 }, result: '你们聊到三点。她最后一句是「明天要迟到了，都怪你」。' },
      { label: '「我在，说吧」', fx: { affection: 6, mood: 3, health: -1, family: 0 }, result: '她说了半小时工作的事。挂的时候说了句晚安，很轻。' },
      { label: '「我睡了，明天说」', fx: { affection: -7, mood: -2, health: 3, career: 2 }, result: '那边沉默了很久，回了一个「好」。之后再没在深夜找过你。' }
    ]
  },
  {
    id: 'n_dating_b3_01', phase: 'dating', weight: 10,
    text: ['她把钥匙放在你桌上，说：「我家门锁不太好，你留一把吧。」', '语气很平常，像在说外卖。'],
    options: [
      { label: '收下，什么也没说', fx: { affection: 12, mood: 6, family: 4, career: -1 }, result: '你把钥匙串进自己那串里。沉甸甸的，比想象中沉。' },
      { label: '「这也太快了吧」', fx: { affection: -6, mood: -2, career: 1, health: 0 }, result: '她收回手，笑着说「那算了」。钥匙在她掌心攥了很久。' },
      { label: '当场配一把自己的给她', fx: { money: -30, affection: 15, mood: 5, family: 5 }, result: '你下楼找了开锁店。回来时她还在原地站着等你。' }
    ]
  },
  {
    id: 'n_dating_b3_02', phase: 'dating', weight: 10,
    text: ['她发烧三十八度五，却坚持说「不用你来」。', '你听得出她鼻音很重。'],
    options: [
      { label: '直接买药过去', fx: { money: -80, affection: 13, mood: 4, health: -2 }, result: '她开门时穿着睡衣，头发乱着。你说「进来躺好」，她这次没反驳。' },
      { label: '点个外卖送药', fx: { money: -50, affection: 6, mood: 2, career: 1 }, result: '药送到了。她发来「谢谢」，语气客气得让你有点堵。' },
      { label: '「那你好好休息」', fx: { affection: -9, mood: -3, career: 3, health: 1 }, result: '她说「嗯」。你们两天没说话。' }
    ]
  },
  {
    id: 'n_date_b3_01', phase: 'date', dateType: 'activity', weight: 10,
    text: ['你们去爬一座没什么名气的小山。', '半山腰下了雨，两个人都没带伞。'],
    options: [
      { label: '把外套撑在两个人头上', fx: { affection: 11, health: -4, mood: 5, money: 0 }, result: '你们挤在一件外套下跑完了剩下的路。到山顶时，两个人都湿透了。' },
      { label: '在亭子里等雨停', fx: { affection: 5, health: 2, mood: 2, career: -1 }, result: '雨下了四十分钟。你们把能聊的都聊完了，剩下的时间看着雨发呆。' },
      { label: '冒雨往上冲', fx: { health: -6, affection: 8, mood: 7, looks: -2 }, result: '你在山顶喊了一嗓子。她笑得站不直，说你像个傻子。' }
    ]
  }
];
