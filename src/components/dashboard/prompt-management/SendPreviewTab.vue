<template>
  <div class="send-preview-tab">
    <!-- 场景选择器 -->
    <ScenarioSelector v-model="selectedScenario" />

    <!-- 记忆配置 -->
    <div class="memory-config">
      <div class="config-row">
        <label class="config-label">短期记忆条数</label>
        <div class="config-input">
          <input
            type="number"
            v-model.number="memoryCount"
            min="0"
            max="20"
            class="number-input"
          />
          <span class="input-hint">条 (可用: {{ availableMemoryCount }})</span>
        </div>
      </div>
      <div class="config-row" v-if="showUserInput">
        <label class="config-label">模拟用户输入</label>
        <input
          type="text"
          v-model="userInput"
          class="text-input"
          placeholder="输入内容预览效果..."
        />
      </div>
    </div>

    <!-- 刷新按钮 -->
    <div class="action-bar">
      <button class="refresh-btn" @click="refreshPreview" :disabled="isLoading">
        <svg viewBox="0 0 24 24" width="16" height="16" :class="{ spinning: isLoading }">
          <path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
        </svg>
        刷新预览
      </button>
      <button class="export-btn" @click="exportPreview">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
        </svg>
        导出
      </button>
    </div>

    <!-- 统计信息 -->
    <CharacterStats
      :message-count="previewResult.messages.length"
      :total-chars="previewResult.totalCharCount"
      :estimated-tokens="previewResult.estimatedTokens"
    />

    <!-- 消息列表 -->
    <div class="messages-container" v-if="!isLoading">
      <div class="messages-header">
        <span class="messages-title">消息序列 ({{ previewResult.messages.length }})</span>
        <span class="messages-hint">按发送顺序排列</span>
      </div>
      <div class="messages-list">
        <MessagePreviewCard
          v-for="message in previewResult.messages"
          :key="message.id"
          :message="message"
          @copy="handleCopy"
        />
        <div v-if="previewResult.messages.length === 0" class="empty-state">
          暂无消息，请点击刷新预览
        </div>
      </div>
      <!-- 回顶按钮 -->
      <button
        v-show="showScrollTop"
        class="scroll-top-btn"
        @click="scrollToTop"
        title="回到顶部"
      >
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
        </svg>
      </button>
    </div>

    <!-- 加载状态 -->
    <div class="loading-state" v-if="isLoading">
      <div class="loading-spinner"></div>
      <span>生成预览中...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import ScenarioSelector from './components/ScenarioSelector.vue';
import CharacterStats from './components/CharacterStats.vue';
import MessagePreviewCard from './components/MessagePreviewCard.vue';
import {
  promptPreviewService,
  type PreviewScenario,
  type PreviewResult
} from '@/services/promptPreviewService';
import { toast } from '@/utils/toast';

const selectedScenario = ref<PreviewScenario>('text_generation');
const memoryCount = ref(3);
const userInput = ref('继续当前活动');
const isLoading = ref(false);
const showScrollTop = ref(false);
const tabPanelRef = ref<HTMLElement | null>(null);

const previewResult = ref<PreviewResult>({
  messages: [],
  totalCharCount: 0,
  estimatedTokens: 0,
});

// 可用的短期记忆条数
const availableMemoryCount = computed(() => {
  return promptPreviewService.getShortTermMemories().length;
});

// 是否显示用户输入框
const showUserInput = computed(() => {
  return ['text_generation', 'variable_generation'].includes(selectedScenario.value);
});

// 获取场景对应的默认记忆条数
const getDefaultMemoryCount = (scenario: PreviewScenario): number => {
  const config = promptPreviewService.getMemoryConfig();
  switch (scenario) {
    case 'text_generation':
      return config.textGenerationCount;
    case 'variable_generation':
      return config.variableGenerationCount;
    case 'variable_reroll':
      return config.variableRerollCount;
    case 'text_optimization':
      return config.textOptimizationCount;
    case 'text_optimization_reroll':
      return config.textOptimizationRerollCount;
    default:
      return 3;
  }
};

// 刷新预览
const refreshPreview = async () => {
  isLoading.value = true;
  try {
    previewResult.value = await promptPreviewService.generatePreview(
      selectedScenario.value,
      {
        shortTermMemoryCount: memoryCount.value,
        userInput: userInput.value,
      }
    );
  } catch (error) {
    console.error('生成预览失败:', error);
    toast.error('生成预览失败');
  } finally {
    isLoading.value = false;
  }
};

// 导出预览
const exportPreview = () => {
  const data = {
    scenario: selectedScenario.value,
    generatedAt: new Date().toISOString(),
    memoryCount: memoryCount.value,
    ...previewResult.value,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `preview-${selectedScenario.value}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast.success('预览已导出');
};

// 复制处理
const handleCopy = () => {
  toast.success('已复制到剪贴板');
};

// 获取父级滚动容器
const getScrollContainer = (): HTMLElement | null => {
  if (tabPanelRef.value) return tabPanelRef.value;
  // 查找父级 .tab-panel 容器
  const el = document.querySelector('.tab-panel') as HTMLElement;
  tabPanelRef.value = el;
  return el;
};

// 处理滚动
const handleScroll = () => {
  const container = getScrollContainer();
  if (container) {
    showScrollTop.value = container.scrollTop > 200;
  }
};

// 回到顶部
const scrollToTop = () => {
  const container = getScrollContainer();
  if (container) {
    container.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
};

// 监听场景变化
watch(selectedScenario, (newScenario) => {
  memoryCount.value = getDefaultMemoryCount(newScenario);
  refreshPreview();
});

// 刷新预览后自动滚动到顶部
watch(() => previewResult.value.messages.length, () => {
  nextTick(() => {
    const container = getScrollContainer();
    if (container) {
      container.scrollTop = 0;
      showScrollTop.value = false;
    }
  });
});

// 组件挂载时刷新预览和绑定滚动事件
onMounted(() => {
  memoryCount.value = getDefaultMemoryCount(selectedScenario.value);
  refreshPreview();

  // 延迟绑定滚动事件，等待DOM渲染
  nextTick(() => {
    const container = getScrollContainer();
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
  });
});

// 组件卸载时解绑滚动事件
onUnmounted(() => {
  const container = getScrollContainer();
  if (container) {
    container.removeEventListener('scroll', handleScroll);
  }
});
</script>

<style scoped>
.send-preview-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.memory-config {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: rgba(30, 35, 45, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  min-width: 100px;
}

.config-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.number-input {
  width: 60px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
  text-align: center;
}

.number-input:focus {
  outline: none;
  border-color: rgba(74, 158, 255, 0.5);
}

.input-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.text-input {
  flex: 1;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
}

.text-input:focus {
  outline: none;
  border-color: rgba(74, 158, 255, 0.5);
}

.text-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.action-bar {
  display: flex;
  gap: 8px;
}

.refresh-btn,
.export-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn {
  background: rgba(74, 158, 255, 0.15);
  border: 1px solid rgba(74, 158, 255, 0.3);
  color: #4a9eff;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(74, 158, 255, 0.25);
  border-color: rgba(74, 158, 255, 0.5);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.export-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.messages-container {
  display: flex;
  flex-direction: column;
  position: relative;
}

.messages-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.messages-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.messages-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #4a9eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* 回顶按钮 */
.scroll-top-btn {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(74, 158, 255, 0.95);
  border: none;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
  z-index: 100;
}

.scroll-top-btn:hover {
  background: #4a9eff;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(74, 158, 255, 0.5);
}

.scroll-top-btn:active {
  transform: translateY(0);
}
</style>
