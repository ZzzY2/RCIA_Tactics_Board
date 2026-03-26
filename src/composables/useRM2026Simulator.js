import { computed, reactive, ref, watch } from 'vue';
import {
  RM2026_CAPTURE_POINTS,
  RM2026_CORE_REWARD_BY_DIFFICULTY,
  RM2026_DART,
  RM2026_ECONOMY,
  RM2026_LEVEL_THRESHOLDS,
  RM2026_MATCH_SECONDS,
  RM2026_PERFORMANCE_OPTIONS,
  RM2026_ROBOT_KEYS,
  RM2026_ROBOT_LABELS,
  RM2026_TEAM_KEYS,
  RM2026_TEAM_LABELS,
  RM2026_TIMELINE_EVENTS,
  RM2026_UAV,
} from '@/constants/rm2026Config';

const createRobotState = (type) => ({
  type,
  hp: 300,
  maxHp: 300,
  level: 1,
  exp: 0,
  alive: true,
  respawnProgress: 0,
  weak: false,
  invincibleSeconds: 0,
});

const createTeamState = () => ({
  baseHp: 5000,
  baseShield: 0,
  outpostHp: 1500,
  outpostDestroyedOnce: false,
  totalAttackDamage: 0,
  gold: RM2026_ECONOMY.initialGold,
  totalGoldIncome: RM2026_ECONOMY.initialGold,
  extraGoldPer10s: 0,
  persistentDefenseBonus: 0,
  levelCap: 5,
  ammo17: 0,
  ammo42: 0,
  ammo17ByGold: 0,
  ammo42ByGold: 0,
  robots: {
    hero: createRobotState('hero'),
    engineer: createRobotState('engineer'),
    infantry3: createRobotState('infantry3'),
    infantry4: createRobotState('infantry4'),
    sentry: createRobotState('sentry'),
    air: createRobotState('air'),
  },
  capture: {
    supply: false,
    base: false,
    centralHighland: false,
    trapezoidHighland: false,
    terrainPass: false,
    outpost: false,
    fortress: false,
    assembly: false,
  },
  energy: {
    smallDefenseUntil: 0,
    bigDefenseUntil: 0,
  },
  coreAssembly: {
    selectedDifficulty: 1,
    currentStep: 1,
    secondCoreSynced: true,
    selectedAtElapsed: 0,
    completedCounts: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
    },
  },
  dart: {
    loaded: RM2026_DART.maxDarts,
    launched: 0,
    gateOpenUntil: 0,
    gateOpenChances: 0,
    grantedChanceMilestones: [],
    penalized: false,
  },
  uav: {
    airborne: false,
    penalized: false,
    moduleOnline: true,
    supportUsedSeconds: 0,
    takeoffChecklistPassed: true,
  },
  performance: {
    heroType: RM2026_PERFORMANCE_OPTIONS.heroType[1],
    infantryChassis: RM2026_PERFORMANCE_OPTIONS.infantryChassis[0],
    infantryShooter: RM2026_PERFORMANCE_OPTIONS.infantryShooter[0],
  },
});

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const findLevelByExp = (exp) => {
  let level = 1;
  for (let i = 0; i < RM2026_LEVEL_THRESHOLDS.length; i += 1) {
    if (exp >= RM2026_LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
};

export function useRM2026Simulator(ruleSet, time, maxTime) {
  const teams = reactive({
    red: createTeamState(),
    blue: createTeamState(),
  });

  const lastElapsed = ref(0);
  const tacticalNotes = ref('');
  const savedPlans = ref([]);

  const isRMUC = computed(() => ruleSet.value === 'RMUC');
  const elapsed = computed(() => maxTime.value - time.value);
  const isMatchEnded = computed(() => time.value <= 0);

  const timeline = computed(() =>
    RM2026_TIMELINE_EVENTS.map((evt) => ({
      ...evt,
      status: elapsed.value >= evt.at ? 'done' : 'pending',
      remain: Math.max(0, evt.at - elapsed.value),
    }))
  );

  const canAttemptCoreDifficulty = (difficulty) => {
    const e = elapsed.value;
    if (difficulty === 1) return true;
    if (difficulty === 2) return e >= 60;
    if (difficulty === 3) return e >= 120;
    return e >= 180;
  };

  const getDefenseBonusNow = (teamKey) => {
    const team = teams[teamKey];
    let bonus = team.persistentDefenseBonus;

    if (team.capture.base) bonus += 0.5;
    if (team.capture.centralHighland) bonus += 0.25;
    if (team.capture.trapezoidHighland) bonus += 0.5;
    if (team.capture.outpost) bonus += 0.25;

    if (team.energy.smallDefenseUntil > elapsed.value) bonus += 0.25;
    if (team.energy.bigDefenseUntil > elapsed.value) bonus += 0.25;

    return clamp(bonus, 0, 0.9);
  };

  const applyPeriodicEconomy = (fromElapsed, toElapsed) => {
    for (let t = fromElapsed + 1; t <= toElapsed; t += 1) {
      if (t % 10 === 0) {
        RM2026_TEAM_KEYS.forEach((teamKey) => {
          const team = teams[teamKey];
          const gain = RM2026_ECONOMY.periodicGoldPer10s + team.extraGoldPer10s;
          team.gold += gain;
          team.totalGoldIncome += gain;
        });
      }

      if (t % 60 === 0) {
        RM2026_TEAM_KEYS.forEach((teamKey) => {
          const team = teams[teamKey];
          if (team.capture.supply) {
            team.ammo17 += 100;
          }
        });
      }
    }
  };

  const applyDartGateChance = (fromElapsed, toElapsed) => {
    RM2026_TEAM_KEYS.forEach((teamKey) => {
      const team = teams[teamKey];
      RM2026_DART.gateOpenAt.forEach((milestone, idx) => {
        const crossed = fromElapsed < milestone && toElapsed >= milestone;
        const alreadyGranted = team.dart.grantedChanceMilestones.includes(idx);
        if (crossed && !alreadyGranted) {
          team.dart.gateOpenChances += 1;
          team.dart.grantedChanceMilestones.push(idx);
        }
      });
    });
  };

  const updateUavSupport = (fromElapsed, toElapsed) => {
    RM2026_TEAM_KEYS.forEach((teamKey) => {
      const uav = teams[teamKey].uav;
      if (uav.airborne) {
        const delta = Math.max(0, toElapsed - fromElapsed);
        uav.supportUsedSeconds += delta;
      }
    });
  };

  const updateRobotRespawn = (fromElapsed, toElapsed) => {
    const delta = Math.max(0, toElapsed - fromElapsed);
    RM2026_TEAM_KEYS.forEach((teamKey) => {
      const team = teams[teamKey];
      RM2026_ROBOT_KEYS.forEach((robotKey) => {
        const robot = team.robots[robotKey];
        if (!robot.alive) {
          const speed = team.capture.supply || team.capture.base ? 4 : 1;
          robot.respawnProgress = clamp(robot.respawnProgress + speed * delta, 0, 100);
        }
        if (robot.invincibleSeconds > 0) {
          robot.invincibleSeconds = Math.max(0, robot.invincibleSeconds - delta);
        }
      });
    });
  };

  watch(
    elapsed,
    (next, prev) => {
      const fromElapsed = Math.floor(prev || 0);
      const toElapsed = Math.floor(next || 0);
      if (toElapsed <= fromElapsed) {
        lastElapsed.value = toElapsed;
        return;
      }

      applyPeriodicEconomy(fromElapsed, toElapsed);
      applyDartGateChance(fromElapsed, toElapsed);
      updateUavSupport(fromElapsed, toElapsed);
      updateRobotRespawn(fromElapsed, toElapsed);

      lastElapsed.value = toElapsed;
    },
    { immediate: true }
  );

  const getTeam = (teamKey) => teams[teamKey];

  const toggleCapture = (teamKey, pointKey) => {
    const team = getTeam(teamKey);
    team.capture[pointKey] = !team.capture[pointKey];
  };

  const activateSmallEnergy = (teamKey) => {
    const team = getTeam(teamKey);
    team.energy.smallDefenseUntil = elapsed.value + 45;
  };

  const activateBigEnergy = (teamKey) => {
    const team = getTeam(teamKey);
    team.energy.bigDefenseUntil = elapsed.value + 45;
  };

  const damageTeamBase = (teamKey, rawDamage) => {
    const team = getTeam(teamKey);
    let damage = Math.max(0, rawDamage);

    if (team.baseShield > 0) {
      const shieldBlocked = Math.min(team.baseShield, damage);
      team.baseShield -= shieldBlocked;
      damage -= shieldBlocked;
    }

    team.baseHp = Math.max(0, team.baseHp - damage);
  };

  const addAttackDamage = (teamKey, damage) => {
    getTeam(teamKey).totalAttackDamage += Math.max(0, damage);
  };

  const applyDamageToTeam = (targetTeamKey, rawDamage, sourceTeamKey) => {
    const defense = getDefenseBonusNow(targetTeamKey);
    const actual = Math.round(rawDamage * (1 - defense));
    damageTeamBase(targetTeamKey, actual);

    if (sourceTeamKey) addAttackDamage(sourceTeamKey, actual);
    return actual;
  };

  const spendGold = (teamKey, amount) => {
    const team = getTeam(teamKey);
    if (team.gold < amount) return false;
    team.gold -= amount;
    return true;
  };

  const exchangeAmmo17 = (teamKey, remote = false) => {
    const team = getTeam(teamKey);
    const cost = remote ? RM2026_ECONOMY.remoteAmmo17CostPer100 : RM2026_ECONOMY.localAmmo17CostPer10;
    const gain = remote ? 100 : 10;
    if (team.ammo17ByGold + gain > RM2026_ECONOMY.ammo17MaxByGold) return false;
    if (!spendGold(teamKey, cost)) return false;
    team.ammo17 += gain;
    team.ammo17ByGold += gain;
    return true;
  };

  const exchangeAmmo42 = (teamKey, remote = false) => {
    const team = getTeam(teamKey);
    const cost = remote ? RM2026_ECONOMY.remoteAmmo42CostPer10 : RM2026_ECONOMY.localAmmo42CostPer1;
    const gain = remote ? 10 : 1;
    if (team.ammo42ByGold + gain > RM2026_ECONOMY.ammo42MaxByGold) return false;
    if (!spendGold(teamKey, cost)) return false;
    team.ammo42 += gain;
    team.ammo42ByGold += gain;
    return true;
  };

  const remoteHealRobot = (teamKey, robotKey) => {
    const team = getTeam(teamKey);
    const robot = team.robots[robotKey];
    if (!robot.alive) return false;
    if (!spendGold(teamKey, RM2026_ECONOMY.remoteHealCostPer100)) return false;
    robot.hp = clamp(robot.hp + 100, 1, robot.maxHp);
    return true;
  };

  const markRobotDown = (teamKey, robotKey) => {
    const robot = getTeam(teamKey).robots[robotKey];
    robot.alive = false;
    robot.hp = 0;
    robot.respawnProgress = 0;
  };

  const respawnRobotByProgress = (teamKey, robotKey) => {
    const team = getTeam(teamKey);
    const robot = team.robots[robotKey];
    if (robot.alive) return false;
    if (robot.respawnProgress < 100) return false;
    robot.alive = true;
    robot.hp = Math.ceil(robot.maxHp * 0.5);
    robot.respawnProgress = 0;
    robot.invincibleSeconds = 30;
    return true;
  };

  const instantRespawnRobot = (teamKey, robotKey) => {
    const team = getTeam(teamKey);
    const robot = team.robots[robotKey];
    if (robot.alive) return false;
    if (!spendGold(teamKey, RM2026_ECONOMY.instantRespawnCost)) return false;
    robot.alive = true;
    robot.hp = Math.ceil(robot.maxHp * 0.6);
    robot.respawnProgress = 0;
    robot.invincibleSeconds = 3;
    return true;
  };

  const addRobotExp = (teamKey, robotKey, exp) => {
    const team = getTeam(teamKey);
    const robot = team.robots[robotKey];
    robot.exp += Math.max(0, exp);
    robot.level = clamp(findLevelByExp(robot.exp), 1, team.levelCap);
  };

  const applyPerformancePreset = (teamKey) => {
    const team = getTeam(teamKey);
    const hero = team.robots.hero;
    const infantry3 = team.robots.infantry3;
    const infantry4 = team.robots.infantry4;

    hero.maxHp = team.performance.heroType === '近战优先' ? 450 : 300;
    hero.hp = clamp(hero.hp, 1, hero.maxHp);

    const infantryMaxHp = team.performance.infantryChassis === '血量优先' ? 400 : 300;
    infantry3.maxHp = infantryMaxHp;
    infantry4.maxHp = infantryMaxHp;
    infantry3.hp = clamp(infantry3.hp, 1, infantry3.maxHp);
    infantry4.hp = clamp(infantry4.hp, 1, infantry4.maxHp);
  };

  const reviveRobot = (teamKey, robotKey) => {
    const robot = getTeam(teamKey).robots[robotKey];
    robot.alive = true;
    robot.hp = robot.maxHp;
    robot.respawnProgress = 0;
    robot.weak = false;
    robot.invincibleSeconds = 0;
    return true;
  };

  const beginCoreAssembly = (teamKey) => {
    const team = getTeam(teamKey);
    const difficulty = team.coreAssembly.selectedDifficulty;

    if (!canAttemptCoreDifficulty(difficulty)) return false;

    team.coreAssembly.currentStep = 1;
    team.coreAssembly.secondCoreSynced = difficulty === 4 ? false : true;
    team.coreAssembly.selectedAtElapsed = elapsed.value;
    return true;
  };

  const advanceCoreStep = (teamKey) => {
    const team = getTeam(teamKey);
    const assembly = team.coreAssembly;
    assembly.currentStep = clamp(assembly.currentStep + 1, 1, 6);
  };

  const syncSecondCoreStep = (teamKey) => {
    const team = getTeam(teamKey);
    team.coreAssembly.secondCoreSynced = true;
  };

  const confirmCoreAssembly = (teamKey) => {
    const team = getTeam(teamKey);
    const assembly = team.coreAssembly;
    const difficulty = assembly.selectedDifficulty;

    if (assembly.currentStep < 6) return false;

    if (difficulty === 4) {
      const within45s = elapsed.value - assembly.selectedAtElapsed <= 45;
      if (!within45s || !assembly.secondCoreSynced) return false;
    }

    const reward = RM2026_CORE_REWARD_BY_DIFFICULTY[difficulty];
    assembly.completedCounts[difficulty] += 1;
    team.extraGoldPer10s += reward.goldPer10s;
    team.persistentDefenseBonus = clamp(team.persistentDefenseBonus + reward.defenseBonus, 0, 0.9);
    team.levelCap = Math.max(team.levelCap, reward.levelCap);

    if (reward.baseShield > 0) {
      const overflow = Math.max(0, team.baseHp + reward.baseShield - 5000);
      team.baseHp = Math.min(5000, team.baseHp + reward.baseShield);
      team.baseShield += overflow;
    }

    assembly.currentStep = 1;
    assembly.secondCoreSynced = difficulty === 4 ? false : true;
    return true;
  };

  const getAvailableUavSupportSeconds = (teamKey) => {
    const team = getTeam(teamKey);
    const totalEarned =
      RM2026_UAV.initialSupportSeconds + Math.floor(elapsed.value / 60) * RM2026_UAV.supportEveryMinute;
    return Math.max(0, totalEarned - team.uav.supportUsedSeconds);
  };

  const canTakeoff = (teamKey) => {
    const team = getTeam(teamKey);
    const robot = team.robots.air;

    return (
      isRMUC.value &&
      elapsed.value > 0 &&
      !isMatchEnded.value &&
      robot.alive &&
      team.uav.moduleOnline &&
      !team.uav.penalized &&
      team.uav.takeoffChecklistPassed &&
      getAvailableUavSupportSeconds(teamKey) > 0
    );
  };

  const toggleUavAirborne = (teamKey) => {
    const team = getTeam(teamKey);

    if (team.uav.airborne) {
      team.uav.airborne = false;
      return true;
    }

    if (!canTakeoff(teamKey)) return false;

    team.uav.airborne = true;
    return true;
  };

  const isDartGateOpen = (teamKey) => {
    const team = getTeam(teamKey);
    return elapsed.value < team.dart.gateOpenUntil;
  };

  const getDartTriggerState = (teamKey) => {
    const team = getTeam(teamKey);
    const canTrigger = team.dart.gateOpenChances > 0 && !team.dart.penalized;

    return {
      canTrigger,
      label:
        canTrigger
          ? `当前可触发，剩余机会 ${team.dart.gateOpenChances} 次`
          : `当前不可触发，剩余机会 ${team.dart.gateOpenChances} 次`,
    };
  };

  const triggerDartGate = (teamKey) => {
    const team = getTeam(teamKey);
    const state = getDartTriggerState(teamKey);
    if (!state.canTrigger) return false;

    team.dart.gateOpenChances -= 1;
    team.dart.gateOpenUntil = Math.max(
      team.dart.gateOpenUntil,
      elapsed.value + RM2026_DART.gateOpenDurationSec
    );
    return true;
  };

  const launchDart = (teamKey, target = 'outpost') => {
    const team = getTeam(teamKey);
    const enemy = teamKey === 'red' ? 'blue' : 'red';

    if (team.dart.penalized) return false;
    if (!isDartGateOpen(teamKey)) return false;
    if (team.dart.loaded <= 0) return false;

    team.dart.loaded -= 1;
    team.dart.launched += 1;

    if (target === 'outpost') {
      teams[enemy].outpostHp = Math.max(0, teams[enemy].outpostHp - RM2026_DART.outpostDamage);
      if (teams[enemy].outpostHp <= 0) teams[enemy].outpostDestroyedOnce = true;
      addAttackDamage(teamKey, RM2026_DART.outpostDamage);
    } else {
      const actual = applyDamageToTeam(enemy, RM2026_DART.baseDamage, teamKey);
      addAttackDamage(teamKey, Math.max(0, actual - RM2026_DART.baseDamage));
    }

    return true;
  };

  const togglePenalty = (teamKey, systemKey) => {
    const team = getTeam(teamKey);
    if (systemKey === 'dart') team.dart.penalized = !team.dart.penalized;
    if (systemKey === 'uav') {
      team.uav.penalized = !team.uav.penalized;
      if (team.uav.penalized) team.uav.airborne = false;
    }
  };

  const scoreSummary = computed(() => {
    const red = teams.red;
    const blue = teams.blue;

    const redRemainHp = RM2026_ROBOT_KEYS.reduce((sum, key) => sum + (red.robots[key].alive ? red.robots[key].hp : 0), 0);
    const blueRemainHp = RM2026_ROBOT_KEYS.reduce((sum, key) => sum + (blue.robots[key].alive ? blue.robots[key].hp : 0), 0);

    const detail = {
      red: {
        baseHp: red.baseHp,
        outpostHp: red.outpostHp,
        outpostDestroyedOnce: red.outpostDestroyedOnce,
        attackDamage: red.totalAttackDamage,
        remainHp: redRemainHp,
      },
      blue: {
        baseHp: blue.baseHp,
        outpostHp: blue.outpostHp,
        outpostDestroyedOnce: blue.outpostDestroyedOnce,
        attackDamage: blue.totalAttackDamage,
        remainHp: blueRemainHp,
      },
    };

    const byBase = red.baseHp - blue.baseHp;
    if (byBase !== 0) {
      return {
        winner: byBase > 0 ? 'red' : 'blue',
        reason: '基地剩余血量更高',
        detail,
      };
    }

    const sameBaseNoOutpostDestroyed = !red.outpostDestroyedOnce && !blue.outpostDestroyedOnce;
    if (sameBaseNoOutpostDestroyed && red.outpostHp !== blue.outpostHp) {
      return {
        winner: red.outpostHp > blue.outpostHp ? 'red' : 'blue',
        reason: '前哨站剩余血量更高',
        detail,
      };
    }

    const oneOutpostNeverDestroyed = red.outpostDestroyedOnce !== blue.outpostDestroyedOnce;
    if (oneOutpostNeverDestroyed) {
      return {
        winner: red.outpostDestroyedOnce ? 'blue' : 'red',
        reason: '前哨站是否被击毁判定',
        detail,
      };
    }

    if (red.totalAttackDamage !== blue.totalAttackDamage) {
      return {
        winner: red.totalAttackDamage > blue.totalAttackDamage ? 'red' : 'blue',
        reason: '全队攻击伤害更高',
        detail,
      };
    }

    if (redRemainHp !== blueRemainHp) {
      return {
        winner: redRemainHp > blueRemainHp ? 'red' : 'blue',
        reason: '全队总剩余血量更高',
        detail,
      };
    }

    return {
      winner: 'draw',
      reason: '平局（需加赛）',
      detail,
    };
  });

  const saveTacticPlan = () => {
    const snapshot = {
      at: elapsed.value,
      note: tacticalNotes.value || '未命名预案',
      score: scoreSummary.value,
      red: JSON.parse(JSON.stringify(teams.red)),
      blue: JSON.parse(JSON.stringify(teams.blue)),
    };

    savedPlans.value.unshift(snapshot);
    savedPlans.value = savedPlans.value.slice(0, 6);
  };

  const resetSimulator = () => {
    teams.red = createTeamState();
    teams.blue = createTeamState();
    tacticalNotes.value = '';
    savedPlans.value = [];
    lastElapsed.value = elapsed.value;
  };

  const teamViews = computed(() =>
    RM2026_TEAM_KEYS.map((teamKey) => {
      const team = teams[teamKey];
      return {
        key: teamKey,
        label: RM2026_TEAM_LABELS[teamKey],
        defenseNow: getDefenseBonusNow(teamKey),
        availableUavSupportSeconds: getAvailableUavSupportSeconds(teamKey),
        canTakeoff: canTakeoff(teamKey),
        ammo17ByGold: team.ammo17ByGold,
        ammo42ByGold: team.ammo42ByGold,
        dartGateOpen: isDartGateOpen(teamKey),
        dartTrigger: getDartTriggerState(teamKey),
        dartGateOpenChances: team.dart.gateOpenChances,
        robots: RM2026_ROBOT_KEYS.map((robotKey) => ({
          key: robotKey,
          label: RM2026_ROBOT_LABELS[robotKey],
          ...team.robots[robotKey],
        })),
      };
    })
  );

  return {
    isRMUC,
    elapsed,
    timeline,
    scoreSummary,
    teams,
    teamViews,
    tacticalNotes,
    savedPlans,
    capturePoints: RM2026_CAPTURE_POINTS,
    performanceOptions: RM2026_PERFORMANCE_OPTIONS,
    robotKeys: RM2026_ROBOT_KEYS,
    robotLabels: RM2026_ROBOT_LABELS,
    teamKeys: RM2026_TEAM_KEYS,
    teamLabels: RM2026_TEAM_LABELS,
    levelThresholds: RM2026_LEVEL_THRESHOLDS,
    matchSeconds: RM2026_MATCH_SECONDS,
    canAttemptCoreDifficulty,
    toggleCapture,
    activateSmallEnergy,
    activateBigEnergy,
    applyDamageToTeam,
    exchangeAmmo17,
    exchangeAmmo42,
    remoteHealRobot,
    markRobotDown,
    reviveRobot,
    respawnRobotByProgress,
    instantRespawnRobot,
    addRobotExp,
    applyPerformancePreset,
    beginCoreAssembly,
    advanceCoreStep,
    syncSecondCoreStep,
    confirmCoreAssembly,
    toggleUavAirborne,
    togglePenalty,
    triggerDartGate,
    launchDart,
    saveTacticPlan,
    resetSimulator,
  };
}
