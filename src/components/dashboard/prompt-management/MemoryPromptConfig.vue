<template>
  <div class="memory-prompt-config">
    <!-- 记忆条数配置 -->
    <div class="config-section">
      <div class="section-header">
        <span class="section-title">短期记忆条数配置</span>
      </div>
      <div class="config-grid-4">
        <div class="config-item">
          <label>正文生成</label>
          <input
            type="number"
            v-model.number="config.textGenerationCount"
            min="0"
            max="20"
            @change="saveConfig"
            class="number-input"
          />
          <span class="unit">条</span>
        </div>
        <div class="config-item">
          <label>变量生成</label>
          <input
            type="number"
            v-model.number="config.variableGenerationCount"
            min="0"
            max="20"
            @change="saveConfig"
            class="number-input"
          />
          <span class="unit">条</span>
        </div>
        <div class="config-item">
          <label>变量再生成</label>
          <input
            type="number"
            v-model.number="config.variableRerollCount"
            min="0"
            max="20"
            @change="saveConfig"
            class="number-input"
          />
          <span class="unit">条</span>
        </div>
        <div class="config-item">
          <label>酒馆预设</label>
          <input
            type="number"
            v-model.number="config.tavernPresetCount"
            min="0"
            max="20"
            @change="saveConfig"
            class="number-input"
          />
          <span class="unit">条</span>
        </div>
      </div>
      <p class="config-hint">
        每个场景独立配置记忆条数。正文生成和酒馆预设会额外包含全部中期和长期记忆。正文优化不使用短期记忆，而是使用历史优化正文+第一步正文。
      </p>
      <div class="memory-stats">
        <span class="stat-item">
          <span class="stat-label">长期:</span>
          <span class="stat-value">{{ longTermCount }}</span>
        </span>
        <span class="stat-item">
          <span class="stat-label">中期:</span>
          <span class="stat-value">{{ midTermCount }}</span>
        </span>
        <span class="stat-item">
          <span class="stat-label">短期:</span>
          <span class="stat-value">{{ shortTermCount }}</span>
        </span>
        <span class="stat-item total">
          <span class="stat-label">合计:</span>
          <span class="stat-value">{{ totalMemoryCount }}</span>
        </span>
      </div>
    </div>

    <!-- 优化正文历史配置 -->
    <div class="config-section">
      <div class="section-header">
        <span class="section-title">优化正文历史配置</span>
        <button class="clear-btn" @click="clearOptimizedTextHistory">
          <svg viewBox="0 0 24 24" width="12" height="12">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
          清空历史
        </button>
      </div>
      <div class="history-config-row">
        <div class="config-item history-count-item">
          <label>历史上下文层数</label>
          <input
            type="number"
            v-model.number="config.optimizedTextHistoryCount"
            min="0"
            max="10"
            @change="saveConfig"
            class="number-input"
          />
          <span class="unit">层</span>
        </div>
        <div class="history-stats">
          <span class="stat-item">
            <span class="stat-label">当前历史:</span>
            <span class="stat-value history-value">{{ optimizedTextHistoryCount }}</span>
            <span class="stat-label">/10 层</span>
          </span>
        </div>
      </div>
      <p class="config-hint">
        生成优化正文时，会将最新的 N 层历史优化正文作为上下文。Re-roll 时会替换最新层而非新增。最多保存10层历史。
      </p>
    </div>

    <!-- 记忆提示词模板 -->
    <div class="template-section">
      <div class="section-header">
        <span class="section-title">短期记忆提示词模板</span>
        <button class="reset-btn" @click="resetTemplate">
          重置默认
        </button>
      </div>
      <div class="template-info">
        <p>可用变量（正文生成/酒馆预设支持分类变量）:</p>
        <div class="variables-grid">
          <div class="var-group">
            <span class="var-group-title">记忆内容</span>
            <ul>
              <li><code v-pre>{{memories}}</code> - 所有记忆</li>
              <li><code v-pre>{{shortTermMemories}}</code> - 仅短期</li>
              <li><code v-pre>{{midTermMemories}}</code> - 仅中期</li>
              <li><code v-pre>{{longTermMemories}}</code> - 仅长期</li>
            </ul>
          </div>
          <div class="var-group">
            <span class="var-group-title">条数统计</span>
            <ul>
              <li><code v-pre>{{count}}</code> - 总条数</li>
              <li><code v-pre>{{shortTermCount}}</code> - 短期条数</li>
              <li><code v-pre>{{midTermCount}}</code> - 中期条数</li>
              <li><code v-pre>{{longTermCount}}</code> - 长期条数</li>
            </ul>
          </div>
        </div>
      </div>
      <textarea
        v-model="config.promptTemplate"
        @blur="saveConfig"
        class="template-textarea"
        rows="8"
        placeholder="输入短期记忆提示词模板..."
      ></textarea>
    </div>

    <!-- 预览 -->
    <div class="preview-section">
      <div class="section-header">
        <span class="section-title">效果预览</span>
        <button class="refresh-btn" @click="refreshPreview">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
          刷新
        </button>
      </div>
      <div class="preview-box">
        <pre>{{ previewText }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  promptPreviewService,
  type ShortTermMemoryConfig
} from '@/services/promptPreviewService';
import { textOptimizationService } from '@/services/textOptimizationService';
import { useGameStateStore } from '@/stores/gameStateStore';
import { toast } from '@/utils/toast';

const config = ref<ShortTermMemoryConfig>({
  textGenerationCount: 3,
  variableGenerationCount: 3,
  variableRerollCount: 3,
  textOptimizationCount: 0,
  textOptimizationRerollCount: 0,
  tavernPresetCount: 5,
  optimizedTextHistoryCount: 3,
  promptTemplate: '',
});

// 优化正文历史数量
const optimizedTextHistoryCount = ref(0);

// 刷新优化正文历史数量
const refreshOptimizedTextHistoryCount = () => {
  optimizedTextHistoryCount.value = textOptimizationService.getHistoryCount();
};

// 清空优化正文历史
const clearOptimizedTextHistory = () => {
  if (confirm('确定要清空优化正文历史吗？清空后无法恢复。')) {
    textOptimizationService.clearHistory();
    refreshOptimizedTextHistoryCount();
    toast.success('已清空优化正文历史');
  }
};

const previewText = ref('');
const gameStateStore = useGameStateStore();

// 各类记忆条数
const longTermCount = computed(() => {
  return gameStateStore.memory?.长期记忆?.length || 0;
});

const midTermCount = computed(() => {
  return gameStateStore.memory?.中期记忆?.length || 0;
});

const shortTermCount = computed(() => {
  return gameStateStore.memory?.短期记忆?.length || 0;
});

const totalMemoryCount = computed(() => {
  return longTermCount.value + midTermCount.value + shortTermCount.value;
});

// 加载配置
const loadConfig = () => {
  config.value = promptPreviewService.getMemoryConfig();
  refreshPreview();
};

// 保存配置
const saveConfig = () => {
  promptPreviewService.setMemoryConfig(config.value);
  refreshPreview();
};

// 重置模板
const resetTemplate = () => {
  if (confirm('确定要重置为默认模板吗？')) {
    promptPreviewService.resetMemoryTemplate();
    config.value = promptPreviewService.getMemoryConfig();
    refreshPreview();
    toast.success('已重置为默认模板');
  }
};

// 刷新预览（使用正文生成场景的完整记忆）
const refreshPreview = () => {
  const memory = gameStateStore.memory;

  const longTerm = memory?.长期记忆 || [];
  const midTerm = memory?.中期记忆 || [];
  const shortTerm = memory?.短期记忆 || [];

  // 按配置的条数获取短期记忆
  const limitedShortTerm = shortTerm.slice(-config.value.textGenerationCount);

  // 合并记忆（顺序：长期→中期→短期）
  const combined = [...longTerm, ...midTerm, ...limitedShortTerm];

  if (combined.length === 0) {
    previewText.value = '(暂无记忆)';
    return;
  }

  // 应用模板（支持所有分类变量）
  previewText.value = config.value.promptTemplate
    .replace(/\{\{memories\}\}/g, combined.join('\n'))
    .replace(/\{\{shortTermMemories\}\}/g, limitedShortTerm.join('\n'))
    .replace(/\{\{midTermMemories\}\}/g, midTerm.join('\n'))
    .replace(/\{\{longTermMemories\}\}/g, longTerm.join('\n'))
    .replace(/\{\{count\}\}/g, String(combined.length))
    .replace(/\{\{shortTermCount\}\}/g, String(limitedShortTerm.length))
    .replace(/\{\{midTermCount\}\}/g, String(midTerm.length))
    .replace(/\{\{longTermCount\}\}/g, String(longTerm.length));
};

onMounted(() => {
  loadConfig();
  refreshOptimizedTextHistoryCount();
});
</script>

<style scoped>
.memory-prompt-config {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-section,
.template-section,
.preview-section {
  padding: 16px;
  background: rgba(30, 35, 45, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 500;
  color: #fff;
}

.config-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 900px) {
  .config-grid-4 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 500px) {
  .config-grid-4 {
    grid-template-columns: repeat(2, 1fr);
  }
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-item label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.number-input {
  width: 100%;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  text-align: center;
}

.number-input:focus {
  outline: none;
  border-color: rgba(74, 158, 255, 0.5);
}

.unit {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
}

.config-hint {
  margin: 12px 0 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.memory-stats {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.stat-value {
  font-size: 13px;
  font-weight: 600;
  color: #4a9eff;
}

.stat-item.total .stat-value {
  color: #4aff9e;
}

.stat-value.history-value {
  color: #ff9e4a;
}

.clear-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(255, 100, 100, 0.1);
  border: 1px solid rgba(255, 100, 100, 0.2);
  border-radius: 4px;
  color: rgba(255, 150, 150, 0.8);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-btn:hover {
  background: rgba(255, 100, 100, 0.2);
  border-color: rgba(255, 100, 100, 0.4);
  color: #ff8080;
}

.history-config-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.history-count-item {
  width: 120px;
  flex-shrink: 0;
}

.history-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  height: fit-content;
  margin-bottom: 18px;
}

.reset-btn,
.refresh-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-btn:hover,
.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.template-info {
  margin-bottom: 10px;
  padding: 10px;
  background: rgba(74, 158, 255, 0.1);
  border-radius: 6px;
}

.template-info p {
  margin: 0 0 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.variables-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 500px) {
  .variables-grid {
    grid-template-columns: 1fr;
  }
}

.var-group {
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.var-group-title {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.var-group ul {
  margin: 0;
  padding-left: 0;
  list-style: none;
}

.var-group li {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 3px;
}

.template-info code {
  background: rgba(0, 0, 0, 0.3);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  color: #4a9eff;
}

.template-textarea {
  width: 100%;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
  font-family: 'JetBrains Mono', monospace;
}

.template-textarea:focus {
  outline: none;
  border-color: rgba(74, 158, 255, 0.5);
}

.preview-box {
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.preview-box pre {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.8);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'JetBrains Mono', monospace;
}

.preview-box::-webkit-scrollbar {
  width: 6px;
}

.preview-box::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.preview-box::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}
</style>
