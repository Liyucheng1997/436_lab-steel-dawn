// 全局常量与数据表：阵营、武器、单位、建筑
export const CS = 2;          // 单元格边长（世界单位）
export const N = 88;          // 地图边长（格）
export const WORLD = N * CS;

export const TEAMS = [
  { name: '苍穹同盟', hull: 0xa3b1c0, hull2: 0x5e6c7b, dark: 0x2c333c, accent: 0x1b74ff, glow: [0.28, 0.85, 2.5], css: '#46a8ff' },
  { name: '熔炉军团', hull: 0x6e625b, hull2: 0x473e3a, dark: 0x262120, accent: 0xd42f1c, glow: [3.0, 0.7, 0.18], css: '#ff563c' },
];

// mult: 对不同护甲的伤害系数
export const WEAPONS = {
  rifle:    { dmg: 11,  cd: 0.45, range: 11,   type: 'bullet', sound: 'rifle',  mult: { inf: 1, light: 0.5, heavy: 0.22, bldg: 0.22 } },
  rocket:   { dmg: 48,  cd: 2.2,  range: 13,   type: 'rocket', sound: 'rocket', speed: 24, splash: 0.8, mult: { inf: 0.3, light: 1, heavy: 1, bldg: 0.85 } },
  mg:       { dmg: 9,   cd: 0.16, range: 11,   type: 'bullet', sound: 'mg',     mult: { inf: 1, light: 0.6, heavy: 0.22, bldg: 0.2 } },
  cannon:   { dmg: 58,  cd: 1.6,  range: 12.5, type: 'shell',  sound: 'cannon', speed: 60, splash: 1.3, mult: { inf: 0.4, light: 1, heavy: 0.85, bldg: 0.7 } },
  heavygun: { dmg: 125, cd: 2.3,  range: 14,   type: 'shell',  sound: 'heavy',  speed: 75, splash: 1.9, mult: { inf: 0.5, light: 1, heavy: 1, bldg: 0.9 } },
  howitzer: { dmg: 150, cd: 4.6,  range: 27,   minRange: 7, type: 'arc', sound: 'arty', speed: 21, splash: 3.6, mult: { inf: 1, light: 0.7, heavy: 0.5, bldg: 1.35 } },
  turretmg: { dmg: 15,  cd: 0.13, range: 14.5, type: 'bullet', sound: 'mg',     mult: { inf: 1.2, light: 0.75, heavy: 0.35, bldg: 0.2 } },
  rail:     { dmg: 240, cd: 3.2,  range: 18,   type: 'beam',   sound: 'beam',   mult: { inf: 1, light: 1, heavy: 1, bldg: 0.5 } },
};

export const UNITS = {
  rifle:  { name: '步枪兵', desc: '廉价的基础步兵，克制步兵，对装甲乏力。', queue: 'inf', from: 'barracks', cat: 'inf', cost: 100, hp: 110, speed: 3.3, radius: 0.45, mass: 1, armor: 'inf', weapon: 'rifle', sight: 8, height: 1.5, req: [] },
  rocket: { name: '火箭兵', desc: '肩扛火箭筒，专门猎杀载具与建筑。', queue: 'inf', from: 'barracks', cat: 'inf', cost: 250, hp: 100, speed: 3.0, radius: 0.45, mass: 1, armor: 'inf', weapon: 'rocket', sight: 8, height: 1.5, req: [] },
  harv:   { name: '晶矿采集车', desc: '自动采集紫晶矿并运回精炼厂。', queue: 'veh', from: 'factory', cat: 'veh', cost: 1000, hp: 850, speed: 3.5, radius: 1.7, mass: 8, armor: 'heavy', weapon: null, sight: 6, turn: 2.2, height: 2.6, harvester: true, req: [] },
  buggy:  { name: '游隼突击车', desc: '高速轮式侦察车，双联机枪扫射步兵。', queue: 'veh', from: 'factory', cat: 'veh', cost: 450, hp: 260, speed: 8, radius: 1.05, mass: 3, armor: 'light', weapon: 'mg', sight: 10, turn: 4, height: 1.7, req: [] },
  tank:   { name: '猎犬主战坦克', desc: '攻防均衡的主力坦克。', queue: 'veh', from: 'factory', cat: 'veh', cost: 700, hp: 520, speed: 4.8, radius: 1.3, mass: 5, armor: 'heavy', weapon: 'cannon', sight: 9, turn: 2.6, height: 1.8, req: [] },
  heavy:  { name: '泰坦重型坦克', desc: '四履带重甲平台，电磁主炮威力惊人。', queue: 'veh', from: 'factory', cat: 'veh', cost: 1400, hp: 1150, speed: 4.2, radius: 1.5, mass: 9, armor: 'heavy', weapon: 'heavygun', sight: 9, turn: 1.8, height: 2.3, req: ['tech'] },
  arty:   { name: '雷霆自行火炮', desc: '超远程曲射火炮，拆建筑利器，但近身脆弱。', queue: 'veh', from: 'factory', cat: 'veh', cost: 1000, hp: 300, speed: 3.8, radius: 1.3, mass: 5, armor: 'light', weapon: 'howitzer', sight: 9, turn: 2.2, height: 2.6, req: ['tech'] },
};

export const BUILDINGS = {
  hq:       { name: '指挥中心', desc: '基地核心。失去它将无法再建造建筑。', queue: 'build', w: 3, h: 3, cost: 3000, hp: 3500, power: 30, sight: 11, height: 5.2, armor: 'bldg', req: [], buildable: false },
  power:    { name: '聚变电站', desc: '为基地供电。电力不足时生产减速、防御失效。', queue: 'build', w: 2, h: 2, cost: 400, hp: 900, power: 100, sight: 6, height: 2.9, armor: 'bldg', req: [] },
  refinery: { name: '晶矿精炼厂', desc: '提炼紫晶矿换取资金，附赠一辆采集车。', queue: 'build', w: 3, h: 3, cost: 1500, hp: 1500, power: -30, sight: 7, height: 3.8, armor: 'bldg', req: ['power'] },
  barracks: { name: '兵营', desc: '训练步兵。', queue: 'build', w: 2, h: 2, cost: 500, hp: 1000, power: -15, sight: 6, height: 2.6, armor: 'bldg', req: ['power'] },
  factory:  { name: '战车工厂', desc: '生产各类载具。', queue: 'build', w: 3, h: 3, cost: 1800, hp: 1800, power: -40, sight: 7, height: 3.6, armor: 'bldg', req: ['refinery'] },
  tech:     { name: '科技中心', desc: '解锁重型坦克、自行火炮与轨道炮塔。', queue: 'build', w: 2, h: 2, cost: 1500, hp: 1000, power: -60, sight: 12, height: 4.4, armor: 'bldg', req: ['factory'] },
  turret:   { name: '机炮塔', desc: '速射机炮，压制步兵与轻型载具。', queue: 'def', w: 1, h: 1, cost: 600, hp: 750, power: -15, sight: 9, height: 1.9, armor: 'bldg', weapon: 'turretmg', req: ['barracks'] },
  rail:     { name: '轨道炮塔', desc: '电磁轨道炮，一击重创装甲。需要充足电力。', queue: 'def', w: 1, h: 1, cost: 1400, hp: 900, power: -60, sight: 10, height: 3.8, armor: 'bldg', weapon: 'rail', needsPower: true, req: ['tech'] },
};

for (const k in UNITS) { UNITS[k].kind = 'unit'; UNITS[k].id = k; }
for (const k in BUILDINGS) { BUILDINGS[k].kind = 'building'; BUILDINGS[k].id = k; }

export const defOf = t => UNITS[t] || BUILDINGS[t];
export const buildTime = def => Math.max(3, def.cost / 75);
export const QUEUES = ['build', 'def', 'inf', 'veh'];

export const BUILD_TABS = [
  { id: 'build', name: '建筑', items: ['power', 'refinery', 'barracks', 'factory', 'tech'] },
  { id: 'def', name: '防御', items: ['turret', 'rail'] },
  { id: 'inf', name: '步兵', items: ['rifle', 'rocket'] },
  { id: 'veh', name: '载具', items: ['harv', 'buggy', 'tank', 'heavy', 'arty'] },
];

export const ARMOR_NAME = { inf: '步兵', light: '轻甲', heavy: '重甲', bldg: '建筑' };
