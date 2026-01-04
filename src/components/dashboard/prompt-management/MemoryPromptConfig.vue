<template>
  <div class="memory-prompt-config">
    <!-- 记忆条数配置 -->
    <div class="config-section">
      <div class="section-header">
        <span class="section-title">短期记忆条数配置</span>
      </div>
      <div class="config-grid-5">
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
          <label>正文优化</label>
          <input
            type="number"
            v-model.number="config.textOptimizationCount"
            min="0"
            max="20"
            @change="saveConfig"
            class="number-input"
          />
          <span class="unit">条</span>
        </div>
        <div class="config-item">
          <label>优化再生成</label>
          <input
            type="number"
            v-model.number="config.textOptimizationRerollCount"
            min="0"
            max="20"
            @change="saveConfig"
            class="number-input"
          />
          <span class="unit">条</span>
        </div>
      </div>
      <p class="config-hint">
        当前可用短期记忆: {{ availableMemoryCount }} 条。每个场景独立配置，再生成场景可设置不同的记忆条数。
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
        <p>可用变量:</p>
        <ul>
          <li><code v-pre>{{memories}}</code> - 记忆内容</li>
          <li><code v-pre>{{count}}</code> - 记忆条数</li>
        </ul>
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
import { toast } from '@/utils/toast';

const config = ref<ShortTermMemoryConfig>({
  textGenerationCount: 3,
  variableGenerationCount: 3,
  variableRerollCount: 3,
  textOptimizationCount: 0,
  textOptimizationRerollCount: 0,
  promptTemplate: '',
});

const previewText = ref('');

// 可用的短期记忆条数
const availableMemoryCount = computed(() => {
  return promptPreviewService.getShortTermMemories().length;
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

// 刷新预览
const refreshPreview = () => {
  const memories = promptPreviewService.getShortTermMemories();
  const count = Math.min(config.value.textGenerationCount, memories.length);

  if (count === 0 || memories.length === 0) {
    previewText.value = '(暂无短期记忆)';
    return;
  }

  const selectedMemories = memories.slice(-count);
  const memoriesText = selectedMemories.join('\n');

  previewText.value = config.value.promptTemplate
    .replace('{{memories}}', memoriesText)
    .replace('{{count}}', String(count));
};

onMounted(() => {
  loadConfig();
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

.config-grid-5 {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

@media (max-width: 800px) {
  .config-grid-5 {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 500px) {
  .config-grid-5 {
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
  margin: 0 0 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.template-info ul {
  margin: 0;
  padding-left: 16px;
}

.template-info li {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 2px;
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
