<template>
  <v-card class="pa-4 sim-panel" elevation="6" v-if="isRMUC">
    <v-card-title class="text-h5">RM2026 战术模拟面板</v-card-title>
    <v-card-subtitle>覆盖：时间轴、占点、经济、复活、经验/性能、能量机关、科技核心、飞镖、空中支援、胜负判定、预案回放</v-card-subtitle>

    <v-alert type="info" variant="tonal" class="mt-4">
      当前比赛已进行 {{ elapsed }} 秒，剩余 {{ time }} 秒
    </v-alert>

    <v-expansion-panels class="mt-4" multiple>
      <v-expansion-panel title="1) 规则时间轴">
        <v-expansion-panel-text>
          <v-row>
            <v-col cols="12" md="6" v-for="evt in timeline" :key="evt.key">
              <v-card :color="evt.status === 'done' ? 'green-lighten-5' : 'grey-lighten-4'" class="pa-3" variant="tonal">
                <div class="font-weight-bold">{{ evt.label }}</div>
                <div class="text-caption">
                  {{ evt.status === 'done' ? '已到达' : `倒计时 ${evt.remain}s` }}
                </div>
              </v-card>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel title="2) 双方状态总览 + 伤害模拟 + 胜负自动判定">
        <v-expansion-panel-text>
          <v-row>
            <v-col cols="12" md="6" v-for="team in teamViews" :key="team.key">
              <v-card class="pa-3" :color="team.key === 'red' ? 'red-lighten-5' : 'blue-lighten-5'" variant="tonal">
                <div class="text-h6">{{ team.label }}</div>
                <div class="text-body-2">基地血量: {{ teams[team.key].baseHp }} / 5000（护盾 {{ teams[team.key].baseShield }}）</div>
                <div class="text-body-2">前哨站血量: {{ teams[team.key].outpostHp }} / 1500</div>
                <div class="text-body-2">总攻击伤害: {{ teams[team.key].totalAttackDamage }}</div>
                <div class="text-body-2">当前防御增益: {{ Math.round(team.defenseNow * 100) }}%</div>

                <div class="d-flex flex-wrap ga-2 mt-3">
                  <v-btn size="small" color="error" @click="attackEnemy(team.key, 200)">对敌方基地造成200原始伤害</v-btn>
                  <v-btn size="small" color="warning" @click="damageEnemyOutpost(team.key, 200)">对敌方前哨站造成200伤害</v-btn>
                </div>
              </v-card>
            </v-col>
          </v-row>

          <v-alert class="mt-4" :type="scoreSummary.winner === 'draw' ? 'warning' : 'success'" variant="tonal">
            当前判定：
            <strong>
              {{ scoreSummary.winner === 'draw' ? '平局' : (scoreSummary.winner === 'red' ? '红方领先' : '蓝方领先') }}
            </strong>
            （{{ scoreSummary.reason }}）
          </v-alert>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel title="3) 场地增益点占领模拟">
        <v-expansion-panel-text>
          <v-row>
            <v-col cols="12" md="6" v-for="team in teamViews" :key="`capture-${team.key}`">
              <v-card class="pa-3" variant="outlined">
                <div class="text-h6 mb-2">{{ team.label }} 占点状态</div>
                <div class="d-flex flex-wrap ga-2">
                  <v-btn
                    v-for="point in capturePoints"
                    :key="`${team.key}-${point.key}`"
                    size="small"
                    :color="teams[team.key].capture[point.key] ? 'success' : 'grey'"
                    @click="toggleCaptureWithLog(team.key, point.key, point.label)"
                  >
                    {{ point.label }}
                  </v-btn>
                </div>
              </v-card>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel title="4) 经济体系 + 弹量兑换 + 回血/复活">
        <v-expansion-panel-text>
          <v-row>
            <v-col cols="12" md="6" v-for="team in teamViews" :key="`econ-${team.key}`">
              <v-card class="pa-3" variant="outlined">
                <div class="text-h6">{{ team.label }}</div>
                <div>金币: {{ teams[team.key].gold }}（累计收入 {{ teams[team.key].totalGoldIncome }}）</div>
                <div>17mm: {{ teams[team.key].ammo17 }} | 42mm: {{ teams[team.key].ammo42 }}</div>
                <div class="text-caption">金币兑换上限进度: 17mm {{ team.ammo17ByGold }}/1000，42mm {{ team.ammo42ByGold }}/100</div>
                <div>每10秒额外金币: {{ teams[team.key].extraGoldPer10s }}</div>

                <div class="d-flex flex-wrap ga-2 mt-3">
                  <v-btn size="small" @click="doOrWarn(exchangeAmmo17(team.key, false), '兑换17mm失败：金币不足或已达金币兑换上限(1000)')">占点兑换17mm(+10)</v-btn>
                  <v-btn size="small" @click="doOrWarn(exchangeAmmo17(team.key, true), '远程兑换17mm失败：金币不足或已达金币兑换上限(1000)')">远程兑换17mm(+100)</v-btn>
                  <v-btn size="small" @click="doOrWarn(exchangeAmmo42(team.key, false), '兑换42mm失败：金币不足或已达金币兑换上限(100)')">占点兑换42mm(+1)</v-btn>
                  <v-btn size="small" @click="doOrWarn(exchangeAmmo42(team.key, true), '远程兑换42mm失败：金币不足或已达金币兑换上限(100)')">远程兑换42mm(+10)</v-btn>
                </div>

                <div class="text-subtitle-2 mt-3">机器人血量/复活</div>
                <v-row dense>
                  <v-col cols="12" v-for="robotDef in combatRobotDefs" :key="`${team.key}-${robotDef.key}`">
                    <div class="d-flex align-center justify-space-between robot-row">
                      <div>
                        {{ robotDef.label }}
                        <span class="text-caption">HP {{ teams[team.key].robots[robotDef.key].hp }}/{{ teams[team.key].robots[robotDef.key].maxHp }}</span>
                        <span class="text-caption ml-2" v-if="!teams[team.key].robots[robotDef.key].alive">
                          复活进度 {{ teams[team.key].robots[robotDef.key].respawnProgress }}%
                        </span>
                      </div>
                      <div class="d-flex ga-1">
                        <v-btn size="x-small" color="error" @click="markRobotDownWithLog(team.key, robotDef.key, robotDef.label)">战亡</v-btn>
                        <v-btn size="x-small" color="grey-darken-1" @click="reviveRobotWithLog(team.key, robotDef.key, robotDef.label)">恢复状态</v-btn>
                        <v-btn size="x-small" color="primary" @click="doOrWarn(remoteHealRobot(team.key, robotDef.key), '回血失败：需存活且金币足够')">远程回血</v-btn>
                        <v-btn size="x-small" color="success" @click="doOrWarn(respawnRobotByProgress(team.key, robotDef.key), '复活失败：读条未满')">读条复活</v-btn>
                        <v-btn size="x-small" color="warning" @click="doOrWarn(instantRespawnRobot(team.key, robotDef.key), '立即复活失败：需战亡且金币足够')">立即复活</v-btn>
                      </div>
                    </div>
                  </v-col>
                </v-row>
              </v-card>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel title="5) 经验体系 + 性能体系">
        <v-expansion-panel-text>
          <v-row>
            <v-col cols="12" md="6" v-for="team in teamViews" :key="`xp-${team.key}`">
              <v-card class="pa-3" variant="outlined">
                <div class="text-h6">{{ team.label }}</div>

                <div class="d-flex flex-wrap ga-2 mt-2">
                  <v-select
                    density="compact"
                    hide-details
                    label="英雄整机类型"
                    :items="performanceOptions.heroType"
                    v-model="teams[team.key].performance.heroType"
                  />
                  <v-select
                    density="compact"
                    hide-details
                    label="步兵底盘类型"
                    :items="performanceOptions.infantryChassis"
                    v-model="teams[team.key].performance.infantryChassis"
                  />
                  <v-select
                    density="compact"
                    hide-details
                    label="步兵发射机构类型"
                    :items="performanceOptions.infantryShooter"
                    v-model="teams[team.key].performance.infantryShooter"
                  />
                  <v-btn size="small" color="primary" @click="applyPerformancePresetWithLog(team.key)">应用性能配置</v-btn>
                </div>

                <div class="mt-3 text-subtitle-2">经验增量</div>
                <v-row dense>
                  <v-col cols="12" v-for="robot in team.robots" :key="`exp-${team.key}-${robot.key}`">
                    <div class="d-flex align-center justify-space-between robot-row">
                      <div>{{ robot.label }} Lv{{ teams[team.key].robots[robot.key].level }} EXP {{ teams[team.key].robots[robot.key].exp }}</div>
                      <div class="d-flex ga-1">
                        <v-btn size="x-small" @click="addRobotExpWithLog(team.key, robot.key, robot.label, 50)">+50</v-btn>
                        <v-btn size="x-small" @click="addRobotExpWithLog(team.key, robot.key, robot.label, 200)">+200</v-btn>
                      </div>
                    </div>
                  </v-col>
                </v-row>
              </v-card>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel title="6) 小/大能量机关 + 科技核心装配">
        <v-expansion-panel-text>
          <v-row>
            <v-col cols="12" md="6" v-for="team in teamViews" :key="`energy-${team.key}`">
              <v-card class="pa-3" variant="outlined">
                <div class="text-h6">{{ team.label }}</div>

                <div class="d-flex flex-wrap ga-2 mt-2">
                  <v-btn size="small" color="teal" @click="activateSmallEnergyWithLog(team.key)">激活小能量机关(45s)</v-btn>
                  <v-btn size="small" color="cyan" @click="activateBigEnergyWithLog(team.key)">激活大能量机关(45s)</v-btn>
                </div>

                <v-divider class="my-3" />

                <div class="text-subtitle-2">科技核心装配</div>
                <div class="d-flex flex-wrap ga-2 align-center mt-2">
                  <v-select
                    style="max-width: 180px"
                    density="compact"
                    hide-details
                    label="难度"
                    :items="[1,2,3,4]"
                    v-model="teams[team.key].coreAssembly.selectedDifficulty"
                  />
                  <v-btn size="small" @click="doOrWarn(beginCoreAssembly(team.key), '当前时间不允许选择该难度')">开始装配</v-btn>
                  <v-btn size="small" @click="advanceCoreStep(team.key)">步骤+1</v-btn>
                  <v-btn size="small" v-if="teams[team.key].coreAssembly.selectedDifficulty === 4" @click="syncSecondCoreStep(team.key)">四级同步另一核心</v-btn>
                  <v-btn size="small" color="success" @click="doOrWarn(confirmCoreAssembly(team.key), '装配失败：步骤不足或四级条件不满足')">确认装配成功</v-btn>
                </div>
                <div class="text-caption mt-2">
                  当前步骤: {{ teams[team.key].coreAssembly.currentStep }}/6，等级上限: {{ teams[team.key].levelCap }}
                </div>
              </v-card>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel title="7) 飞镖系统 + 空中机器人起飞条件">
        <v-expansion-panel-text>
          <v-row>
            <v-col cols="12" md="6" v-for="team in teamViews" :key="`dart-uav-${team.key}`">
              <v-card class="pa-3" variant="outlined">
                <div class="text-h6">{{ team.label }}</div>

                <div class="text-subtitle-2 mt-2">飞镖系统</div>
                <div>闸门状态: <strong>{{ team.dartGateOpen ? '开启' : '关闭' }}</strong></div>
                <div>闸门机会: {{ team.dartGateOpenChances }} 次</div>
                <div class="text-caption">触发后闸门持续 35 秒，随后自动关闭</div>
                <div class="text-caption">触发条件: {{ team.dartTrigger.label }}</div>
                <div>剩余飞镖: {{ teams[team.key].dart.loaded }}（已发射 {{ teams[team.key].dart.launched }}）</div>
                <div class="d-flex flex-wrap ga-2 mt-2">
                  <v-btn size="small" color="primary" @click="doOrWarn(triggerDartGate(team.key), '闸门触发失败：不在可触发时间窗口、窗口已消耗或系统被罚下', `${team.label} 触发飞镖闸门`)">
                    触发飞镖闸门
                  </v-btn>
                  <v-btn size="small" color="error" @click="doOrWarn(launchDart(team.key, 'outpost'), '飞镖发射失败：闸门未开/飞镖不足/系统罚下')">打前哨站</v-btn>
                  <v-btn size="small" color="error" @click="doOrWarn(launchDart(team.key, 'base'), '飞镖发射失败：闸门未开/飞镖不足/系统罚下')">打基地</v-btn>
                  <v-btn size="small" :color="teams[team.key].dart.penalized ? 'warning' : 'grey'" @click="togglePenaltyWithLog(team.key, 'dart')">
                    {{ teams[team.key].dart.penalized ? '取消飞镖罚下' : '飞镖罚下' }}
                  </v-btn>
                </div>

                <v-divider class="my-3" />

                <div class="text-subtitle-2">空中机器人（起飞条件）</div>
                <div>可用空中支援秒数: {{ team.availableUavSupportSeconds }}</div>
                <div>起飞判定: <strong>{{ team.canTakeoff ? '满足' : '不满足' }}</strong></div>
                <div class="d-flex flex-wrap ga-2 mt-2">
                  <v-btn size="small" color="primary" @click="doOrWarn(toggleUavAirborne(team.key), '起飞失败：检查模块、罚下状态、比赛阶段和剩余支援时长')">
                    {{ teams[team.key].uav.airborne ? '结束空中支援' : '发起空中支援/起飞' }}
                  </v-btn>
                  <v-btn size="small" :color="teams[team.key].uav.penalized ? 'warning' : 'grey'" @click="togglePenaltyWithLog(team.key, 'uav')">
                    {{ teams[team.key].uav.penalized ? '取消空中罚下' : '空中罚下' }}
                  </v-btn>
                </div>
              </v-card>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel title="8) 预案记录与回放快照">
        <v-expansion-panel-text>
          <v-textarea v-model="tacticalNotes" label="战术备注" rows="2" hide-details class="mb-3" />
          <div class="d-flex ga-2 mb-3">
            <v-btn color="primary" @click="saveTacticPlanWithLog">保存当前预案快照</v-btn>
            <v-btn color="error" variant="tonal" @click="resetSimulatorWithLog">重置模拟器</v-btn>
          </div>

          <v-row>
            <v-col cols="12" md="6" v-for="(item, idx) in savedPlans" :key="`plan-${idx}`">
              <v-card class="pa-3" variant="tonal">
                <div class="font-weight-bold">{{ item.note }}</div>
                <div class="text-caption">记录时刻: {{ item.at }}s</div>
                <div class="text-caption">判定: {{ item.score.winner === 'draw' ? '平局' : (item.score.winner === 'red' ? '红方领先' : '蓝方领先') }} / {{ item.score.reason }}</div>
              </v-card>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-snackbar v-model="snackbar.show" color="warning" timeout="2200">
      {{ snackbar.text }}
    </v-snackbar>
  </v-card>

  <v-card v-else class="pa-4 sim-panel" variant="tonal">
    <v-card-title>RM2026 模拟面板仅在 RMUC 模式启用</v-card-title>
    <v-card-text>当前为 RMUL，可切换到 RMUC 查看完整 2026 规则模拟模块。</v-card-text>
  </v-card>
</template>

<script setup>
import { reactive, watch } from 'vue';
import { useRM2026Simulator } from '@/composables/useRM2026Simulator';

const props = defineProps({
  ruleSet: {
    type: String,
    required: true,
  },
  time: {
    type: Number,
    required: true,
  },
  maxTime: {
    type: Number,
    required: true,
  },
});
const emit = defineEmits(['interaction', 'status']);

const {
  isRMUC,
  elapsed,
  timeline,
  scoreSummary,
  teams,
  teamViews,
  tacticalNotes,
  savedPlans,
  capturePoints,
  performanceOptions,
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
} = useRM2026Simulator(
  {
    get value() {
      return props.ruleSet;
    },
  },
  {
    get value() {
      return props.time;
    },
  },
  {
    get value() {
      return props.maxTime;
    },
  }
);

const snackbar = reactive({
  show: false,
  text: '',
});
const combatRobotDefs = [
  { key: 'hero', label: '英雄(1号)' },
  { key: 'engineer', label: '工程(2号)' },
  { key: 'infantry3', label: '步兵(3号)' },
  { key: 'infantry4', label: '步兵(4号)' },
  { key: 'sentry', label: '哨兵(7号)' },
];

const emitStatus = () => {
  const payload = {
    elapsed: elapsed.value,
    winner: scoreSummary.value.winner,
    reason: scoreSummary.value.reason,
    teams: teamViews.value.map((team) => {
      const activePoints = capturePoints
        .filter((point) => teams[team.key].capture[point.key])
        .map((point) => point.label);

      return {
        key: team.key,
        label: team.label,
        baseHp: teams[team.key].baseHp,
        baseShield: teams[team.key].baseShield,
        outpostHp: teams[team.key].outpostHp,
        gold: teams[team.key].gold,
        defensePercent: Math.round(team.defenseNow * 100),
        ammo17ByGold: team.ammo17ByGold,
        ammo42ByGold: team.ammo42ByGold,
        activePoints,
        dartGateOpen: team.dartGateOpen,
        dartTriggerLabel: team.dartTrigger.label,
        availableUavSupportSeconds: team.availableUavSupportSeconds,
        canTakeoff: team.canTakeoff,
        robotAlive: {
          hero: teams[team.key].robots.hero.alive,
          engineer: teams[team.key].robots.engineer.alive,
          infantry3: teams[team.key].robots.infantry3.alive,
          infantry4: teams[team.key].robots.infantry4.alive,
          sentry: teams[team.key].robots.sentry.alive,
          air: teams[team.key].robots.air.alive,
        },
      };
    }),
  };
  emit('status', payload);
};

const pushInteraction = (text) => {
  emit('interaction', {
    text,
    elapsed: elapsed.value,
  });
  emitStatus();
};

const doOrWarn = (ok, failMessage, successMessage = '操作成功') => {
  if (ok) {
    pushInteraction(successMessage);
    return;
  }
  snackbar.text = failMessage;
  snackbar.show = true;
  pushInteraction(`失败: ${failMessage}`);
};

const enemyOf = (teamKey) => (teamKey === 'red' ? 'blue' : 'red');

const attackEnemy = (teamKey, damage) => {
  const enemy = enemyOf(teamKey);
  applyDamageToTeam(enemy, damage, teamKey);
  pushInteraction(`${teamKey === 'red' ? '红方' : '蓝方'}对敌方基地造成${damage}原始伤害`);
};

const damageEnemyOutpost = (teamKey, damage) => {
  const enemy = enemyOf(teamKey);
  teams[enemy].outpostHp = Math.max(0, teams[enemy].outpostHp - damage);
  teams[teamKey].totalAttackDamage += damage;
  if (teams[enemy].outpostHp <= 0) teams[enemy].outpostDestroyedOnce = true;
  pushInteraction(`${teamKey === 'red' ? '红方' : '蓝方'}对敌方前哨站造成${damage}伤害`);
};

const toggleCaptureWithLog = (teamKey, pointKey, pointLabel) => {
  toggleCapture(teamKey, pointKey);
  pushInteraction(`${teamKey === 'red' ? '红方' : '蓝方'}切换占点: ${pointLabel}`);
};

const activateSmallEnergyWithLog = (teamKey) => {
  activateSmallEnergy(teamKey);
  pushInteraction(`${teamKey === 'red' ? '红方' : '蓝方'}激活小能量机关`);
};

const activateBigEnergyWithLog = (teamKey) => {
  activateBigEnergy(teamKey);
  pushInteraction(`${teamKey === 'red' ? '红方' : '蓝方'}激活大能量机关`);
};

const markRobotDownWithLog = (teamKey, robotKey, robotLabel) => {
  markRobotDown(teamKey, robotKey);
  pushInteraction(`${teamKey === 'red' ? '红方' : '蓝方'} ${robotLabel}标记战亡`);
};

const reviveRobotWithLog = (teamKey, robotKey, robotLabel) => {
  reviveRobot(teamKey, robotKey);
  pushInteraction(`${teamKey === 'red' ? '红方' : '蓝方'} ${robotLabel}恢复状态`);
};

const addRobotExpWithLog = (teamKey, robotKey, robotLabel, delta) => {
  addRobotExp(teamKey, robotKey, delta);
  pushInteraction(`${teamKey === 'red' ? '红方' : '蓝方'} ${robotLabel}经验+${delta}`);
};

const applyPerformancePresetWithLog = (teamKey) => {
  applyPerformancePreset(teamKey);
  pushInteraction(`${teamKey === 'red' ? '红方' : '蓝方'}应用性能体系`);
};

const togglePenaltyWithLog = (teamKey, systemKey) => {
  togglePenalty(teamKey, systemKey);
  pushInteraction(`${teamKey === 'red' ? '红方' : '蓝方'}切换${systemKey === 'dart' ? '飞镖' : '空中'}罚下状态`);
};

const saveTacticPlanWithLog = () => {
  saveTacticPlan();
  pushInteraction('保存战术快照');
};

const resetSimulatorWithLog = () => {
  resetSimulator();
  pushInteraction('重置战术模拟器');
};

const resetAllState = () => {
  resetSimulator();
  pushInteraction('外部触发：重置战术模拟器');
};

watch(
  () => [elapsed.value, scoreSummary.value.winner, scoreSummary.value.reason],
  () => {
    emitStatus();
  },
  { immediate: true }
);

defineExpose({
  resetAllState,
});
</script>

<style scoped>
.robot-row {
  min-height: 34px;
}

.sim-panel {
  max-height: calc(100vh - 120px);
  overflow: auto;
}
</style>
