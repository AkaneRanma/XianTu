<template>
  <div class="scenario-selector">
    <div class="selector-header">
      <span class="selector-title">预览场景</span>
    </div>
    <div class="scenario-tabs">
      <button
        v-for="scenario in scenarios"
        :key="scenario.value"
        class="scenario-tab"
        :class="{ active: modelValue === scenario.value }"
        @click="selectScenario(scenario.value)"
        :title="scenario.description"
      >
        <span class="tab-icon" v-html="scenario.icon"></span>
        <span class="tab-label">{{ scenario.label }}</span>
      </button>
    </div>
    <div class="scenario-description" v-if="currentDescription">
      {{ currentDescription }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PreviewScenario } from '@/services/promptPreviewService';

interface ScenarioOption {
  value: PreviewScenario;
  label: string;
  description: string;
  icon: string;
}

const props = defineProps<{
  modelValue: PreviewScenario;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: PreviewScenario): void;
}>();

const scenarios: ScenarioOption[] = [
  {
    value: 'text_generation',
    label: '正文生成',
    description: '生成故事正文时发送的完整消息',
    icon: '📝',
  },
  {
    value: 'variable_generation',
    label: '变量生成',
    description: '第二步生成独立变量时发送的消息',
    icon: '🔢',
  },
  {
    value: 'variable_reroll',
    label: '重新变量',
    description: '点击重新生成变量时发送的消息',
    icon: '🔄',
  },
  {
    value: 'text_optimization',
    label: '正文优化',
    description: '优化正文内容时发送的消息',
    icon: '✨',
  },
  {
    value: 'text_optimization_reroll',
    label: '重新优化',
    description: '重新优化正文时发送的消息',
    icon: '♻️',
  },
  {
    value: 'tavern_preset',
    label: '酒馆预设',
    description: '预览当前激活的酒馆预设构建的消息',
    icon: '🍺',
  },
  {
    value: 'opening_text',
    label: '开局正文',
    description: '开局第1步：只生成正文text的提示词（splitInitStep1）',
    icon: '🌅',
  },
  {
    value: 'opening_variable',
    label: '开局变量',
    description: '开局第2步：只生成JSON变量的提示词（splitInitStep2）',
    icon: '🔧',
  },
];

const currentDescription = computed(() => {
  const scenario = scenarios.find(s => s.value === props.modelValue);
  return scenario?.description || '';
});

const selectScenario = (value: PreviewScenario) => {
  emit('update:modelValue', value);
};
</script>

<style scoped>
.scenario-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selector-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selector-title {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.scenario-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.scenario-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.scenario-tab:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.scenario-tab.active {
  background: rgba(74, 158, 255, 0.15);
  border-color: rgba(74, 158, 255, 0.4);
  color: #4a9eff;
}

.tab-icon {
  font-size: 14px;
}

.tab-label {
  white-space: nowrap;
}

.scenario-description {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
}
</style>
