export const RM2026_MATCH_SECONDS = 420;

export const RM2026_TIMELINE_EVENTS = [
  { key: 'small-energy-1', at: 0, label: '小能量机关机会 #1' },
  { key: 'small-energy-2', at: 90, label: '小能量机关机会 #2' },
  { key: 'big-energy-1', at: 180, label: '大能量机关机会 #1' },
  { key: 'big-energy-2', at: 255, label: '大能量机关机会 #2' },
  { key: 'big-energy-3', at: 330, label: '大能量机关机会 #3' },
  { key: 'uav-gate-1', at: 0, label: '空中支援可用（初始）' },
  { key: 'dart-gate-1', at: 30, label: '飞镖闸门开启机会 #1' },
  { key: 'outpost-rebuild-deadline', at: 300, label: '前哨站重建窗口关闭' },
  { key: 'dart-gate-2', at: 240, label: '飞镖闸门开启机会 #2' },
];

export const RM2026_CAPTURE_POINTS = [
  { key: 'supply', label: '补给区增益点' },
  { key: 'base', label: '基地增益点' },
  { key: 'centralHighland', label: '中央高地增益点' },
  { key: 'trapezoidHighland', label: '梯形高地增益点' },
  { key: 'terrainPass', label: '地形跨越增益点' },
  { key: 'outpost', label: '前哨站增益点' },
  { key: 'fortress', label: '堡垒增益点' },
  { key: 'assembly', label: '装配区增益点' },
];

export const RM2026_TEAM_KEYS = ['red', 'blue'];

export const RM2026_TEAM_LABELS = {
  red: '红方',
  blue: '蓝方',
};

export const RM2026_ROBOT_KEYS = ['hero', 'engineer', 'infantry3', 'infantry4', 'sentry', 'air'];

export const RM2026_ROBOT_LABELS = {
  hero: '英雄',
  engineer: '工程',
  infantry3: '步兵3号',
  infantry4: '步兵4号',
  sentry: '哨兵',
  air: '空中',
};

export const RM2026_PERFORMANCE_OPTIONS = {
  heroType: ['近战优先', '远程优先'],
  infantryChassis: ['血量优先', '功率优先'],
  infantryShooter: ['冷却优先', '热量优先'],
};

export const RM2026_LEVEL_THRESHOLDS = [0, 550, 1100, 1650, 2200, 2750, 3300, 3850, 4400, 5000];

export const RM2026_CORE_REWARD_BY_DIFFICULTY = {
  1: { goldPer10s: 5, defenseBonus: 0, levelCap: 5, baseShield: 0 },
  2: { goldPer10s: 10, defenseBonus: 0, levelCap: 7, baseShield: 0 },
  3: { goldPer10s: 25, defenseBonus: 0.25, levelCap: 10, baseShield: 0 },
  4: { goldPer10s: 50, defenseBonus: 0.5, levelCap: 10, baseShield: 2000 },
};

export const RM2026_ECONOMY = {
  initialGold: 200,
  periodicGoldPer10s: 50,
  ammo17MaxByGold: 1000,
  ammo42MaxByGold: 100,
  remoteAmmo17CostPer100: 150,
  localAmmo17CostPer10: 10,
  remoteAmmo42CostPer10: 150,
  localAmmo42CostPer1: 10,
  remoteHealCostPer100: 80,
  instantRespawnCost: 200,
  airSupportCostPerSec: 1,
};

export const RM2026_DART = {
  maxDarts: 4,
  gateOpenAt: [30, 240],
  gateOpenDurationSec: 35,
  outpostDamage: 750,
  baseDamage: 1000,
};

export const RM2026_UAV = {
  initialSupportSeconds: 30,
  supportEveryMinute: 20,
};
