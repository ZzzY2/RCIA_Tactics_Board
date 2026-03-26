<template>
  <v-container fluid class="fill-height pa-2">
    <v-row class="layout-row">
      <v-col cols="12" md="3" class="layout-col">
        <RM2026Panel
          ref="rm2026PanelRef"
          :rule-set="ruleSet"
          :time="time"
          :max-time="maxTime"
          @interaction="handleSimInteraction"
          @status="handleSimStatus"
        />
      </v-col>

      <v-col cols="12" md="6" class="layout-col">
        <v-card class="pa-4 center-board" elevation="6">
          <div class="d-flex flex-wrap ga-2 mb-3">
            <v-btn-toggle
              v-model="ruleSet"
              mandatory
              density="comfortable"
            >
              <v-btn value="RMUC">RMUC</v-btn>
              <v-btn value="RMUL">RMUL</v-btn>
            </v-btn-toggle>

            <v-btn color="green" @click="handleStartCountdown">开始倒计时</v-btn>
            <v-btn color="yellow" @click="handlePauseCountdown">暂停倒计时</v-btn>
            <v-btn color="red" @click="handleResetCountdown">重置倒计时</v-btn>
            <v-btn color="deep-purple" @click="handleResetMatchState">重置比赛状态</v-btn>
            <v-btn :color="drawingMode ? 'primary' : 'grey'" @click="toggleDrawingMode">
              {{ drawingMode ? '退出画笔' : '画笔模式' }}
            </v-btn>
            <v-btn
              v-if="drawingMode"
              :color="eraserMode ? 'warning' : 'grey'"
              @click="toggleEraserMode"
            >
              {{ eraserMode ? '退出橡皮擦' : '橡皮擦' }}
            </v-btn>
            <v-menu v-if="drawingMode && !eraserMode" offset-y>
              <template v-slot:activator="{ props }">
                <v-btn v-bind="props" :style="{ backgroundColor: penColor }">
                  画笔颜色
                </v-btn>
              </template>
              <v-list>
                <v-list-item
                  v-for="color in penColors"
                  :key="color.value"
                  @click="penColor = color.value"
                >
                  <v-list-item-title>
                    <v-icon :style="{ color: color.value }" class="mr-2">mdi-circle</v-icon>
                    {{ color.name }}
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
            <v-btn
              v-if="drawingMode"
              color="orange"
              @click="undoLastPath"
              :disabled="paths.length === 0"
            >
              撤销
            </v-btn>
            <v-btn
              v-if="drawingMode"
              color="blue-grey"
              @click="clearDrawings"
            >
              清除全部
            </v-btn>
          </div>

          <div class="text-center mb-3">
            <h1 class="text-h3 font-weight-bold">
              {{ Math.floor(time / 60) }}:{{ Math.floor((time % 60)).toString().padStart(2, '0') }}
            </h1>
          </div>

          <v-row v-if="isRMUC" class="mb-3" dense>
            <v-col cols="6">
              <v-card class="h-100 small-buff-card" :color="smallBuffColor" dense>
                <v-card-text class="text-center pa-2">
                  <v-icon size="small">{{ smallBuffIcon }}</v-icon>
                  <div class="text-caption font-weight-bold">{{ smallBuffStatusText }}</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="6">
              <v-card class="h-100 big-buff-card" :color="bigBuffColor" dense>
                <v-card-text class="text-center pa-2">
                  <v-icon size="small">{{ bigBuffIcon }}</v-icon>
                  <div class="text-caption font-weight-bold">{{ bigBuffStatusText }}</div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <v-row v-else class="mb-3" dense>
            <v-col cols="12">
              <v-card class="h-100" color="yellow-lighten-4" dense>
                <v-card-text class="text-center coin-card-text">
                  <div class="text-h5 font-weight-bold">{{ rmulCoins }} 金币</div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <v-sheet width="95%" class="mx-auto mt-2 mb-4">
            <v-slider
              v-model="sliderValue"
              :max="maxTime"
              :min="0"
              color="primary"
              track-color="grey lighten-3"
              hide-details
              @start="onSliderStart"
              @end="onSliderEnd"
              :disabled="countdownInterval !== null && !sliderDragging"
              reverse
            >
              <template v-slot:prepend>
                <span class="text-body-1">{{ formatTime(maxTime) }}</span>
              </template>
              <template v-slot:append>
                <span class="text-body-1">0:00</span>
              </template>
            </v-slider>
          </v-sheet>

          <div class="map-shell">
            <v-img
              :src="mapImage"
              width="100%"
              class="mx-auto mb-2"
              ref="mapImageRef"
              @load="handleMapLoaded"
            ></v-img>

            <canvas
              ref="drawingCanvasRef"
              class="drawing-canvas"
              :width="mapWidth"
              :height="mapHeight"
              :style="{
                width: `${mapWidth}px`,
                height: `${mapHeight}px`,
                pointerEvents: drawingMode ? 'auto' : 'none',
              }"
              @mousedown="handleMouseDown"
              @mousemove="handleMouseMove"
              @mouseup="handleMouseUp"
              @mouseleave="handleMouseUp"
              @touchstart.prevent="handleTouchStart"
              @touchmove.prevent="handleTouchMove"
              @touchend.prevent="handleTouchEnd"
              @touchcancel.prevent="handleTouchEnd"
            ></canvas>

            <div
              v-for="(player, index) in players"
              :key="index"
              class="player-circle"
              :style="{
                left: `${getPlayerPixelX(player)}px`,
                top: `${getPlayerPixelY(player)}px`,
                backgroundColor: getPlayerDisplayColor(player),
              }"
              @mousedown="(e) => startDrag(e, index)"
              @touchstart="(e) => startTouchDrag(e, index)"
            >
              {{ player.number }}
            </div>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" md="3" class="layout-col">
        <v-card class="pa-3 status-card" elevation="6">
          <div class="text-h6 mb-2">交互信息栏</div>
          <v-list density="compact" class="status-list">
            <v-list-item
              v-for="(log, idx) in interactionLogs"
              :key="`log-${idx}`"
            >
              <v-list-item-title class="text-caption">
                [{{ log.elapsed }}s] {{ log.text }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item v-if="interactionLogs.length === 0">
              <v-list-item-title class="text-caption">暂无交互记录</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>

        <v-card class="pa-3 status-card mt-3" elevation="6">
          <div class="text-h6 mb-2">双方状态栏</div>
          <div class="text-caption mb-2" v-if="simulatorStatus">
            判定：{{ simulatorStatus.winner === 'draw' ? '平局' : (simulatorStatus.winner === 'red' ? '红方领先' : '蓝方领先') }} / {{ simulatorStatus.reason }}
          </div>
          <v-divider class="mb-2" />
          <div v-for="team in simulatorStatus?.teams || []" :key="team.key" class="mb-2">
            <div class="font-weight-bold">{{ team.label }}</div>
            <div class="text-caption">基地: {{ team.baseHp }}（盾 {{ team.baseShield }}）</div>
            <div class="text-caption">前哨站: {{ team.outpostHp }} | 金币: {{ team.gold }}</div>
            <div class="text-caption">金币兑换弹量: 17mm {{ team.ammo17ByGold }}/1000，42mm {{ team.ammo42ByGold }}/100</div>
            <div class="text-caption">防御增益: {{ team.defensePercent }}%</div>
            <div class="text-caption">空中可起飞: {{ team.canTakeoff ? '是' : '否' }} / 支援秒数: {{ team.availableUavSupportSeconds }}</div>
            <div class="text-caption">飞镖闸门: {{ team.dartGateOpen ? '开启' : '关闭' }}（{{ team.dartTriggerLabel }}）</div>
            <div class="text-caption">飞镖闸门机会: {{ team.dartGateOpenChances }} 次</div>
            <div class="text-caption">
              占点:
              {{ team.activePoints.length ? team.activePoints.join('、') : '无' }}
            </div>
            <v-divider class="mt-1" />
          </div>
          <div class="text-caption" v-if="!simulatorStatus">等待战术面板状态同步...</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- 对话框 -->
    <v-dialog v-model="dialog" max-width="590">
      <v-card>
        <v-card-title class="headline">{{ dialogTitle }}</v-card-title>
        <v-card-text>{{ dialogText }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" text @click="dialog = false">关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import {
  MAP_IMAGES,
  PLAYERS_RMUC,
  PLAYERS_RMUL,
  GAME_RULES,
  clonePlayers,
} from '@/constants/gameConfig';
import { useCountdown } from '@/composables/useCountdown';
import { useDrawing } from '@/composables/useDrawing';
import { usePlayerDrag } from '@/composables/usePlayerDrag';
import { useGameState } from '@/composables/useGameState';
import { useMapManagement } from '@/composables/useMapManagement';

// ========== 基础状态 ==========
const ruleSet = ref('RMUC');
const dialog = ref(false);
const dialogTitle = ref('');
const dialogText = ref('');
const players = ref(clonePlayers(PLAYERS_RMUC));
const rm2026PanelRef = ref(null);
const interactionLogs = ref([]);
const simulatorStatus = ref(null);

// ========== Refs ==========
const mapImageRef = ref(null);
const drawingCanvasRef = ref(null);

// ========== 地图管理 ==========
const {
  mapLoaded,
  mapWidth,
  mapHeight,
  handleMapLoaded: mapLoadedHandler,
  updateMapSize,
  cleanup: cleanupMap,
} = useMapManagement();

// ========== 倒计时 ==========
const {
  time,
  maxTime,
  sliderValue,
  sliderDragging,
  countdownInterval,
  formatTime,
  onSliderStart,
  onSliderEnd,
  startCountdown,
  pauseCountdown,
  resetCountdown,
  setMaxTime,
} = useCountdown(GAME_RULES.RMUC.maxTime);

// ========== 绘图 ==========
const {
  drawingMode,
  eraserMode,
  paths,
  penColor,
  penColors,
  setCanvasConfig,
  toggleDrawingMode,
  toggleEraserMode,
  undoLastPath,
  clearDrawings,
  startDraw,
  moveDraw,
  endDraw,
  redrawPaths,
} = useDrawing();

// ========== 玩家拖拽 ==========
const {
  getPlayerPixelX,
  getPlayerPixelY,
  startDrag: startPlayerDrag,
  startTouchDrag: startPlayerTouchDrag,
} = usePlayerDrag(players, mapWidth, mapHeight);

// ========== 游戏状态 ==========
const {
  smallBuffStatusText,
  smallBuffColor,
  smallBuffIcon,
  bigBuffStatusText,
  bigBuffColor,
  bigBuffIcon,
  rmulCoins,
} = useGameState(ruleSet, time, maxTime);

// ========== 计算属性 ==========
const isRMUC = computed(() => ruleSet.value === 'RMUC');
const mapImage = computed(() => MAP_IMAGES[ruleSet.value]);

// ========== 监听器 ==========
watch(ruleSet, () => {
  const sourcePlayers = ruleSet.value === 'RMUC' ? PLAYERS_RMUC : PLAYERS_RMUL;
  players.value = clonePlayers(sourcePlayers);
  
  const nextMax = GAME_RULES[ruleSet.value].maxTime;
  setMaxTime(nextMax);
});

watch(mapImage, () => {
  mapLoaded.value = false;
});

// ========== 方法 ==========
const handleMapLoaded = () => {
  mapLoadedHandler(mapImageRef.value, handleResize);
};

const handleResize = () => {
  if (!mapLoaded.value) return;
  updateMapSize(mapImageRef.value);
  nextTick(() => {
    setCanvasConfig(drawingCanvasRef.value, mapWidth.value, mapHeight.value);
    redrawPaths();
  });
};

const startDrag = (event, index) => {
  const parent = event.currentTarget.parentElement;
  startPlayerDrag(event, index, parent);
};

const startTouchDrag = (event, index) => {
  const parent = event.currentTarget.parentElement;
  startPlayerTouchDrag(event, index, parent);
};

const getNormalizedPoint = (event) => {
  const mapEl = mapImageRef.value?.$el;
  if (!mapEl || mapWidth.value === 0 || mapHeight.value === 0) return null;
  
  const rect = mapEl.getBoundingClientRect();
  const clientX = event.clientX;
  const clientY = event.clientY;
  const x = (clientX - rect.left) / mapWidth.value;
  const y = (clientY - rect.top) / mapHeight.value;
  
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
};

const handleMouseDown = (event) => {
  const point = getNormalizedPoint(event);
  if (point) startDraw(point);
};

const handleMouseMove = (event) => {
  const point = getNormalizedPoint(event);
  if (point) moveDraw(point);
};

const handleMouseUp = () => {
  endDraw();
};

const handleTouchStart = (event) => {
  const point = getNormalizedPoint(event.touches[0]);
  if (point) startDraw(point);
};

const handleTouchMove = (event) => {
  const point = getNormalizedPoint(event.touches[0]);
  if (point) moveDraw(point);
};

const handleTouchEnd = () => {
  endDraw();
};

const showDialog = (title, text) => {
  dialogTitle.value = title;
  dialogText.value = text;
  dialog.value = true;
};

const handleStartCountdown = () => {
  const result = startCountdown();
  if (!result.success) {
    showDialog('倒计时开始', result.message);
  }
};

const handlePauseCountdown = () => {
  const result = pauseCountdown();
  showDialog('倒计时暂停', result.message);
};

const handleResetCountdown = () => {
  const result = resetCountdown();
};

const handleResetMatchState = async () => {
  ruleSet.value = 'RMUC';
  players.value = clonePlayers(PLAYERS_RMUC);
  setMaxTime(GAME_RULES.RMUC.maxTime);
  clearDrawings();
  interactionLogs.value = [];
  simulatorStatus.value = null;

  await nextTick();
  rm2026PanelRef.value?.resetAllState?.();
};

const handleSimInteraction = (payload) => {
  interactionLogs.value.unshift(payload);
  interactionLogs.value = interactionLogs.value.slice(0, 40);
};

const handleSimStatus = (payload) => {
  simulatorStatus.value = payload;
};

const roleByNumber = {
  1: 'hero',
  2: 'engineer',
  3: 'infantry3',
  4: 'infantry4',
  6: 'air',
  7: 'sentry',
};

const getPlayerDisplayColor = (player) => {
  if (!simulatorStatus.value) return player.color;
  const teamKey = player.color === 'red' ? 'red' : 'blue';
  const roleKey = roleByNumber[player.number];
  if (!roleKey) return player.color;

  const team = simulatorStatus.value.teams?.find((item) => item.key === teamKey);
  const alive = team?.robotAlive?.[roleKey];
  if (alive === false) return '#9E9E9E';
  return player.color;
};

// ========== 生命周期 ==========
onMounted(() => {
  console.log('Component mounted');
  updateMapSize(mapImageRef.value);
});

onBeforeUnmount(() => {
  cleanupMap(handleResize);
});
</script>

<style scoped>
.layout-row {
  min-height: calc(100vh - 24px);
}

.layout-col {
  display: flex;
  flex-direction: column;
}

.center-board {
  height: 100%;
  overflow: auto;
}

.map-shell {
  position: relative;
  width: 100%;
  margin: 0 auto;
}

.status-card {
  max-height: calc((100vh - 80px) / 2);
  overflow: auto;
}

.status-list {
  max-height: calc((100vh - 160px) / 2);
  overflow: auto;
}

.player-circle {
  position: absolute;
  width: 30px;
  height: 30px;
  border-radius: 15px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  cursor: move;
  user-select: none;
  transition: transform 0.1s;
  z-index: 2;
}

.player-circle:active {
  transform: scale(1.1);
}

.small-buff-card,
.big-buff-card,
.hits-card {
  transition: background-color 0.5s, transform 0.3s;
}

.small-buff-card.v-card--active,
.big-buff-card.v-card--active,
.hits-card.v-card--active {
  transform: scale(1.05);
}

.drawing-canvas {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.coin-card-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
}
</style>
