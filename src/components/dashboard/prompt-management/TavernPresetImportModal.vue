<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-header">
        <h3>🍺 导入酒馆预设</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <!-- 文件上传区域 -->
        <div
          v-if="!previewData"
          class="upload-area"
          :class="{ dragover: isDragover }"
          @dragover.prevent="isDragover = true"
          @dragleave.prevent="isDragover = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            style="display: none"
            @change="handleFileSelect"
          />
          <div class="upload-icon">📁</div>
          <p class="upload-text">拖拽文件到此处，或点击选择</p>
          <p class="upload-hint">支持 SillyTavern 预设文件 (.json)</p>
        </div>

        <!-- 预览区域 -->
        <div v-else class="preview-area">
          <div class="preview-header">
            <span class="preview-icon">✅</span>
            <span class="preview-title">文件已解析</span>
            <button class="reset-btn" @click="resetPreview">重新选择</button>
          </div>

          <!-- 基本信息 -->
          <div class="info-card">
            <h4>📋 基本信息</h4>
            <div class="info-row">
              <label>文件名：</label>
              <span>{{ fileName }}</span>
            </div>
            <div class="info-row">
              <label>预设名称：</label>
              <input
                v-model="customName"
                type="text"
                class="name-input"
                placeholder="输入自定义名称（可选）"
              />
            </div>
          </div>

          <!-- 统计信息 -->
          <div class="stats-card">
            <h4>📊 内容统计</h4>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-value">{{ validationResult?.stats.totalPrompts || 0 }}</span>
                <span class="stat-label">提示词总数</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ validationResult?.stats.enabledPrompts || 0 }}</span>
                <span class="stat-label">启用数量</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{
                  validationResult?.stats.totalRegexScripts || 0
                }}</span>
                <span class="stat-label">正则脚本</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{
                  validationResult?.stats.hasModelParams ? '✓' : '✗'
                }}</span>
                <span class="stat-label">模型参数</span>
              </div>
            </div>
          </div>

          <!-- 模型参数预览 -->
          <div v-if="validationResult?.stats.hasModelParams" class="params-card">
            <h4>⚙️ 模型参数（仅供参考）</h4>
            <div class="params-grid">
              <div class="param-item">
                <label>Temperature</label>
                <span>{{ previewData.temperature }}</span>
              </div>
              <div class="param-item">
                <label>Top P</label>
                <span>{{ previewData.top_p }}</span>
              </div>
              <div class="param-item">
                <label>Top K</label>
                <span>{{ previewData.top_k }}</span>
              </div>
              <div class="param-item">
                <label>Max Tokens</label>
                <span>{{ previewData.openai_max_tokens }}</span>
              </div>
            </div>
          </div>

          <!-- 提示词列表预览 -->
          <div class="prompts-preview">
            <h4 @click="showPromptsList = !showPromptsList" class="collapsible-header">
              📝 提示词列表
              <span class="toggle-icon">{{ showPromptsList ? '▼' : '▶' }}</span>
            </h4>
            <div v-if="showPromptsList" class="prompts-list">
              <div
                v-for="prompt in sortedPrompts.slice(0, 20)"
                :key="prompt.identifier"
                class="prompt-item"
                :class="{ disabled: !prompt.enabled, marker: prompt.marker }"
              >
                <span class="prompt-status">{{ prompt.enabled ? '✓' : '✗' }}</span>
                <span class="prompt-name">{{ prompt.name }}</span>
                <span class="prompt-role">{{ prompt.role }}</span>
                <span v-if="prompt.marker" class="prompt-marker">占位符</span>
              </div>
              <div v-if="sortedPrompts.length > 20" class="more-hint">
                还有 {{ sortedPrompts.length - 20 }} 个提示词...
              </div>
            </div>
          </div>

          <!-- 导入选项 -->
          <div class="options-card">
            <h4>🔧 导入选项</h4>
            <div class="option-row">
              <label>
                <input v-model="activateImmediately" type="checkbox" />
                导入后立即激活
              </label>
            </div>
            <div class="option-row">
              <label>合并策略：</label>
              <select v-model="mergeMode">
                <option value="replace">完全替换（仅使用酒馆预设）</option>
                <option value="tavern-first">酒馆优先（推荐）</option>
                <option value="web-first">网页优先</option>
              </select>
            </div>
          </div>

          <!-- 警告信息 -->
          <div v-if="validationResult?.warnings.length" class="warnings-card">
            <h4>⚠️ 警告</h4>
            <ul>
              <li v-for="(warning, idx) in validationResult.warnings" :key="idx">
                {{ warning }}
              </li>
            </ul>
          </div>
        </div>

        <!-- 错误信息 -->
        <div v-if="errorMessage" class="error-message">
          <span class="error-icon">❌</span>
          {{ errorMessage }}
        </div>
      </div>

      <div class="modal-footer">
        <button class="cancel-btn" @click="$emit('close')">取消</button>
        <button class="import-btn" :disabled="!canImport || isImporting" @click="handleImport">
          <span v-if="isImporting">导入中...</span>
          <span v-else>导入预设</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { tavernPresetService } from '@/services/tavernPresetService'
import type {
  TavernPreset,
  TavernPresetValidationResult,
  TavernPromptItem,
} from '@/types/tavernPreset'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'imported', preset: { id: string; name: string }): void
}>()

// 状态
const fileInput = ref<HTMLInputElement | null>(null)
const isDragover = ref(false)
const fileName = ref('')
const previewData = ref<TavernPreset | null>(null)
const validationResult = ref<TavernPresetValidationResult | null>(null)
const errorMessage = ref('')
const isImporting = ref(false)

// 选项
const customName = ref('')
const mergeMode = ref<'replace' | 'tavern-first' | 'web-first'>('tavern-first')
const activateImmediately = ref(true)
const showPromptsList = ref(false)

// 计算属性
const canImport = computed(() => {
  return previewData.value && validationResult.value?.valid && !errorMessage.value
})

const sortedPrompts = computed(() => {
  if (!previewData.value) return []

  const prompts = [...previewData.value.prompts]

  // 尝试按 prompt_order 排序
  if (previewData.value.prompt_order?.length) {
    const orderConfig =
      previewData.value.prompt_order.find((o) => o.character_id === 100001) ||
      previewData.value.prompt_order.find((o) => o.character_id === 100000)

    if (orderConfig?.order) {
      const orderMap = new Map(orderConfig.order.map((item, idx) => [item.identifier, idx]))

      prompts.sort((a, b) => {
        const aIdx = orderMap.get(a.identifier) ?? 999
        const bIdx = orderMap.get(b.identifier) ?? 999
        return aIdx - bIdx
      })

      // 应用 order 中的 enabled 状态
      return prompts.map((p) => {
        const orderItem = orderConfig.order.find((o) => o.identifier === p.identifier)
        return {
          ...p,
          enabled: orderItem?.enabled ?? p.enabled,
        }
      })
    }
  }

  return prompts
})

// 方法
function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    parseFile(file)
  }
}

function handleDrop(event: DragEvent) {
  isDragover.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    parseFile(file)
  }
}

async function parseFile(file: File) {
  errorMessage.value = ''
  fileName.value = file.name

  if (!file.name.endsWith('.json')) {
    errorMessage.value = '请选择 JSON 文件'
    return
  }

  try {
    const text = await file.text()
    const data = JSON.parse(text) as TavernPreset

    // 验证预设
    const validation = tavernPresetService.validatePreset(data)
    validationResult.value = validation

    if (!validation.valid) {
      errorMessage.value = `预设格式无效: ${validation.errors.join(', ')}`
      return
    }

    previewData.value = data

    // 设置默认名称
    if (!customName.value) {
      customName.value = file.name.replace(/\.json$/i, '')
    }
  } catch (e) {
    errorMessage.value = '文件解析失败: ' + (e instanceof Error ? e.message : '未知错误')
  }
}

function resetPreview() {
  previewData.value = null
  validationResult.value = null
  fileName.value = ''
  customName.value = ''
  errorMessage.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function handleImport() {
  if (!previewData.value || isImporting.value) return

  isImporting.value = true
  errorMessage.value = ''

  try {
    const preset = await tavernPresetService.importPresetFromJSON(
      JSON.stringify(previewData.value),
      {
        fileName: fileName.value,
        customName: customName.value || undefined,
        mergeMode: mergeMode.value,
        activateImmediately: activateImmediately.value,
      },
    )

    emit('imported', { id: preset.id, name: preset.name })
    emit('close')
  } catch (e) {
    errorMessage.value = '导入失败: ' + (e instanceof Error ? e.message : '未知错误')
  } finally {
    isImporting.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: var(--bg-secondary, #1e1e2e);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-color, #333);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #333);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary, #fff);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary, #888);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary, #fff);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.upload-area {
  border: 2px dashed var(--border-color, #444);
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-area:hover,
.upload-area.dragover {
  border-color: var(--accent-color, #8b5cf6);
  background: rgba(139, 92, 246, 0.1);
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-text {
  color: var(--text-primary, #fff);
  margin: 0 0 8px;
}

.upload-hint {
  color: var(--text-secondary, #888);
  font-size: 14px;
  margin: 0;
}

.preview-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 8px;
}

.preview-icon {
  font-size: 20px;
}

.preview-title {
  flex: 1;
  color: #22c55e;
  font-weight: 500;
}

.reset-btn {
  background: transparent;
  border: 1px solid var(--border-color, #444);
  color: var(--text-secondary, #888);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.reset-btn:hover {
  background: var(--bg-tertiary, #2a2a3e);
  color: var(--text-primary, #fff);
}

.info-card,
.stats-card,
.params-card,
.options-card,
.warnings-card {
  background: var(--bg-tertiary, #252536);
  border-radius: 8px;
  padding: 16px;
}

.info-card h4,
.stats-card h4,
.params-card h4,
.options-card h4,
.warnings-card h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary, #888);
}

.info-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.info-row label {
  color: var(--text-secondary, #888);
  min-width: 80px;
}

.info-row span {
  color: var(--text-primary, #fff);
}

.name-input {
  flex: 1;
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--text-primary, #fff);
  font-size: 14px;
}

.name-input:focus {
  outline: none;
  border-color: var(--accent-color, #8b5cf6);
}

.stats-grid,
.params-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-item,
.param-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: var(--accent-color, #8b5cf6);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary, #888);
}

.param-item label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary, #888);
  margin-bottom: 4px;
}

.param-item span {
  color: var(--text-primary, #fff);
  font-weight: 500;
}

.prompts-preview {
  background: var(--bg-tertiary, #252536);
  border-radius: 8px;
  padding: 16px;
}

.collapsible-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary, #888);
}

.toggle-icon {
  font-size: 12px;
}

.prompts-list {
  margin-top: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.prompt-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: var(--bg-secondary, #1e1e2e);
  margin-bottom: 4px;
}

.prompt-item.disabled {
  opacity: 0.5;
}

.prompt-item.marker {
  border-left: 3px solid #f59e0b;
}

.prompt-status {
  font-size: 12px;
}

.prompt-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary, #fff);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-role {
  font-size: 11px;
  color: var(--text-secondary, #888);
  background: var(--bg-tertiary, #252536);
  padding: 2px 6px;
  border-radius: 4px;
}

.prompt-marker {
  font-size: 11px;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.more-hint {
  text-align: center;
  padding: 8px;
  color: var(--text-secondary, #888);
  font-size: 13px;
}

.option-row {
  margin-bottom: 12px;
}

.option-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary, #fff);
  font-size: 14px;
}

.option-row select {
  flex: 1;
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--text-primary, #fff);
  font-size: 14px;
  margin-left: 8px;
}

.warnings-card {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.warnings-card h4 {
  color: #f59e0b;
}

.warnings-card ul {
  margin: 0;
  padding-left: 20px;
  color: #f59e0b;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  margin-top: 16px;
}

.error-icon {
  font-size: 16px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #333);
}

.cancel-btn,
.import-btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--border-color, #444);
  color: var(--text-secondary, #888);
}

.cancel-btn:hover {
  background: var(--bg-tertiary, #2a2a3e);
  color: var(--text-primary, #fff);
}

.import-btn {
  background: var(--accent-color, #8b5cf6);
  border: none;
  color: white;
}

.import-btn:hover:not(:disabled) {
  background: var(--accent-hover, #7c3aed);
}

.import-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
