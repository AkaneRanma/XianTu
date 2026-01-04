<template>
  <div class="character-stats">
    <div class="stat-item">
      <span class="stat-label">消息数</span>
      <span class="stat-value">{{ messageCount }}</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item">
      <span class="stat-label">总字符</span>
      <span class="stat-value" :class="{ warning: isOverLimit }">
        {{ formatNumber(totalChars) }}
      </span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item">
      <span class="stat-label">预估Token</span>
      <span class="stat-value" :class="{ warning: isOverLimit }">
        ~{{ formatNumber(estimatedTokens) }}
      </span>
    </div>
    <div class="stat-divider" v-if="showLimit"></div>
    <div class="stat-item limit" v-if="showLimit">
      <span class="stat-label">上下文限制</span>
      <span class="stat-value">{{ formatNumber(contextLimit) }}</span>
    </div>
    <div class="progress-bar" v-if="showLimit">
      <div
        class="progress-fill"
        :class="{ warning: usagePercent > 80, danger: usagePercent > 95 }"
        :style="{ width: `${Math.min(usagePercent, 100)}%` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  messageCount: number;
  totalChars: number;
  estimatedTokens: number;
  contextLimit?: number;
  showLimit?: boolean;
}>(), {
  contextLimit: 128000,
  showLimit: false,
});

const usagePercent = computed(() => {
  return (props.estimatedTokens / props.contextLimit) * 100;
});

const isOverLimit = computed(() => {
  return props.showLimit && props.estimatedTokens > props.contextLimit;
});

const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}w`;
  }
  return String(num);
};
</script>

<style scoped>
.character-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(30, 35, 45, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
}

.stat-value.warning {
  color: #f59e0b;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
}

.stat-item.limit .stat-value {
  color: rgba(255, 255, 255, 0.6);
}

.progress-bar {
  flex: 1;
  min-width: 100px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4a9eff;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;
}

.progress-fill.warning {
  background: #f59e0b;
}

.progress-fill.danger {
  background: #ef4444;
}
</style>
