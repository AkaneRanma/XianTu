<template>
  <div v-if="open" class="overlay" @click.self="close">
    <div class="modal" @click.stop>
      <div class="header">
        <div class="title">
          <h3>提示词预设管理</h3>
          <p class="subtitle">管理 Novel AI 图像生成的提示词预设</p>
        </div>
        <button class="icon-btn" @click="close" aria-label="关闭">×</button>
      </div>

      <div class="body">
        <!-- 预设列表 -->
        <div class="preset-list-section">
          <div class="section-header">
            <span class="section-title">预设列表</span>
            <div class="section-actions">
              <button class="btn-action" @click="createNewPreset">
                <span>➕</span> 新建
              </button>
              <button class="btn-action" @click="triggerImport">
                <span>📥</span> 导入
              </button>
              <button class="btn-action" @click="exportAllPresets">
                <span>📤</span> 导出
              </button>
              <input
                ref="fileInputRef"
                type="file"
                accept=".json"
                style="display: none"
                @change="handleFileImport"
              />
            </div>
          </div>

          <div class="preset-list" v-if="presets.length > 0">
            <div
              v-for="preset in presets"
              :key="preset.name"
              class="preset-item"
              :class="{ active: selectedPreset?.name === preset.name }"
              @click="selectPreset(preset)"
            >
              <div class="preset-info">
                <span class="preset-name">{{ preset.name }}</span>
                <span class="preset-preview">
                  {{ truncateText(preset.fixedPrompt, 50) }}
                </span>
              </div>
              <div class="preset-actions">
                <button class="btn-small" @click.stop="editPreset(preset)" title="编辑">
                  ✏️
                </button>
                <button class="btn-small btn-danger" @click.stop="deletePreset(preset.name)" title="删除">
                  🗑️
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-list">
            <p>暂无预设，点击"新建"创建一个</p>
          </div>
        </div>

        <!-- 预设编辑区域 -->
        <div v-if="editingPreset" class="preset-edit-section">
          <div class="section-header">
            <span class="section-title">{{ isNewPreset ? '新建预设' : '编辑预设' }}</span>
          </div>

          <div class="edit-form">
            <div class="form-row">
              <label class="form-label">预设名称</label>
              <input
                v-model="editingPreset.name"
                class="form-input"
                placeholder="输入预设名称"
                :disabled="!isNewPreset && !!originalPresetName"
              />
            </div>

            <div class="form-row">
              <label class="form-label">固定正面提示词（前置）</label>
              <textarea
                v-model="editingPreset.fixedPrompt"
                class="form-textarea"
                placeholder="如：masterpiece, best quality, ..."
                rows="4"
              ></textarea>
              <span class="form-hint">这些提示词会添加在用户标签之前</span>
            </div>

            <div class="form-row">
              <label class="form-label">后置正面提示词</label>
              <textarea
                v-model="editingPreset.fixedPrompt_end"
                class="form-textarea"
                placeholder="如：no text, high resolution, ..."
                rows="2"
              ></textarea>
              <span class="form-hint">这些提示词会添加在用户标签之后</span>
            </div>

            <div class="form-row">
              <label class="form-label">负面提示词</label>
              <textarea
                v-model="editingPreset.negativePrompt"
                class="form-textarea"
                placeholder="如：lowres, bad anatomy, ..."
                rows="4"
              ></textarea>
              <span class="form-hint">用于排除不想要的元素</span>
            </div>

            <div class="edit-actions">
              <button class="btn btn-secondary" @click="cancelEdit">取消</button>
              <button class="btn btn-primary" @click="savePreset" :disabled="!canSavePreset">
                保存预设
              </button>
            </div>
          </div>
        </div>

        <!-- 预设预览区域 -->
        <div v-else-if="selectedPreset" class="preset-preview-section">
          <div class="section-header">
            <span class="section-title">预设详情</span>
            <button class="btn-action" @click="editPreset(selectedPreset)">
              <span>✏️</span> 编辑
            </button>
          </div>

          <div class="preview-content">
            <div class="preview-item">
              <label class="preview-label">固定正面提示词（前置）</label>
              <div class="preview-text">{{ selectedPreset.fixedPrompt || '（空）' }}</div>
            </div>

            <div class="preview-item">
              <label class="preview-label">后置正面提示词</label>
              <div class="preview-text">{{ selectedPreset.fixedPrompt_end || '（空）' }}</div>
            </div>

            <div class="preview-item">
              <label class="preview-label">负面提示词</label>
              <div class="preview-text">{{ selectedPreset.negativePrompt || '（空）' }}</div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-preview">
          <p>选择一个预设查看详情，或创建新预设</p>
        </div>
      </div>

      <div class="footer">
        <button class="btn btn-secondary" @click="close">关闭</button>
      </div>
    </div>

    <!-- 导入模式选择弹窗 -->
    <div v-if="showImportModeDialog" class="import-dialog-overlay" @click.self="cancelImport">
      <div class="import-dialog">
        <h4>导入模式</h4>
        <p>检测到 {{ pendingImportPresets.length }} 个预设，请选择导入方式：</p>
        <div class="import-mode-options">
          <button class="btn btn-secondary" @click="doImport('merge')">
            合并（同名覆盖）
          </button>
          <button class="btn btn-primary" @click="doImport('replace')">
            替换（清空现有）
          </button>
        </div>
        <button class="btn-cancel" @click="cancelImport">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { novelAIService } from '@/services/novelAIService'
import { toast } from '@/utils/toast'
import type { NovelAIPromptPreset } from '@/types/novelAI'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update'): void
}>()

// 预设列表
const presets = ref<NovelAIPromptPreset[]>([])

// 选中的预设
const selectedPreset = ref<NovelAIPromptPreset | null>(null)

// 正在编辑的预设
const editingPreset = ref<NovelAIPromptPreset | null>(null)
const isNewPreset = ref(false)
const originalPresetName = ref<string>('')

// 文件导入
const fileInputRef = ref<HTMLInputElement | null>(null)
const showImportModeDialog = ref(false)
const pendingImportPresets = ref<NovelAIPromptPreset[]>([])

// 计算是否可以保存
const canSavePreset = computed(() => {
  if (!editingPreset.value) return false
  return editingPreset.value.name.trim().length > 0
})

// 监听弹窗打开
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    loadPresets()
    selectedPreset.value = null
    editingPreset.value = null
    isNewPreset.value = false
  }
})

// 加载预设列表
function loadPresets() {
  presets.value = novelAIService.getPresets()
}

// 选择预设
function selectPreset(preset: NovelAIPromptPreset) {
  if (editingPreset.value) {
    if (!confirm('正在编辑中，确定要切换吗？未保存的更改将丢失。')) {
      return
    }
  }
  selectedPreset.value = preset
  editingPreset.value = null
  isNewPreset.value = false
}

// 创建新预设
function createNewPreset() {
  isNewPreset.value = true
  originalPresetName.value = ''
  editingPreset.value = {
    name: '',
    fixedPrompt: '',
    fixedPrompt_end: '',
    negativePrompt: ''
  }
  selectedPreset.value = null
}

// 编辑预设
function editPreset(preset: NovelAIPromptPreset) {
  isNewPreset.value = false
  originalPresetName.value = preset.name
  editingPreset.value = { ...preset }
  selectedPreset.value = null
}

// 取消编辑
function cancelEdit() {
  editingPreset.value = null
  isNewPreset.value = false
  originalPresetName.value = ''
}

// 保存预设
function savePreset() {
  if (!editingPreset.value || !canSavePreset.value) return

  const preset = editingPreset.value

  // 检查名称是否重复（新建时）
  if (isNewPreset.value) {
    const existing = presets.value.find(p => p.name === preset.name)
    if (existing) {
      if (!confirm(`预设"${preset.name}"已存在，是否覆盖？`)) {
        return
      }
    }
  }

  novelAIService.savePreset(preset)
  loadPresets()

  selectedPreset.value = preset
  editingPreset.value = null
  isNewPreset.value = false
  originalPresetName.value = ''

  toast.success('预设已保存')
  emit('update')
}

// 删除预设
function deletePreset(name: string) {
  if (!confirm(`确定要删除预设"${name}"吗？`)) {
    return
  }

  novelAIService.deletePreset(name)
  loadPresets()

  if (selectedPreset.value?.name === name) {
    selectedPreset.value = null
  }
  if (editingPreset.value?.name === name) {
    editingPreset.value = null
    isNewPreset.value = false
  }

  toast.success('预设已删除')
  emit('update')
}

// 触发文件导入
function triggerImport() {
  fileInputRef.value?.click()
}

// 处理文件导入
async function handleFileImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  try {
    const content = await file.text()
    const data = JSON.parse(content)

    // 解析预设
    const importedPresets: NovelAIPromptPreset[] = []
    for (const [name, preset] of Object.entries(data)) {
      const p = preset as any
      importedPresets.push({
        name,
        fixedPrompt: p.fixedPrompt || '',
        fixedPrompt_end: p.fixedPrompt_end || '',
        negativePrompt: p.negativePrompt || ''
      })
    }

    if (importedPresets.length === 0) {
      toast.error('未找到有效的预设')
      return
    }

    pendingImportPresets.value = importedPresets
    showImportModeDialog.value = true
  } catch (e) {
    toast.error('导入失败：文件格式无效')
  } finally {
    // 重置文件输入
    input.value = ''
  }
}

// 执行导入
function doImport(mode: 'merge' | 'replace') {
  try {
    if (mode === 'replace') {
      // 替换模式：先清空
      for (const preset of presets.value) {
        novelAIService.deletePreset(preset.name)
      }
    }

    // 导入预设
    for (const preset of pendingImportPresets.value) {
      novelAIService.savePreset(preset)
    }

    loadPresets()
    showImportModeDialog.value = false
    pendingImportPresets.value = []

    toast.success(`成功导入 ${pendingImportPresets.value.length} 个预设`)
    emit('update')
  } catch (e) {
    toast.error('导入失败')
  }
}

// 取消导入
function cancelImport() {
  showImportModeDialog.value = false
  pendingImportPresets.value = []
}

// 导出所有预设
function exportAllPresets() {
  if (presets.value.length === 0) {
    toast.warning('没有可导出的预设')
    return
  }

  const jsonContent = novelAIService.exportPresets()
  const blob = new Blob([jsonContent], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `novelai-presets-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  toast.success('预设已导出')
}

// 截断文本
function truncateText(text: string, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// 关闭弹窗
function close() {
  if (editingPreset.value) {
    if (!confirm('正在编辑中，确定要关闭吗？未保存的更改将丢失。')) {
      return
    }
  }
  emit('close')
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 2100;
}

.modal {
  width: min(900px, 100%);
  max-height: 85vh;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(15, 23, 42, 0.95);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.55);
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.title h3 {
  margin: 0;
  font-size: 1.2rem;
}

.subtitle {
  margin: 0.35rem 0 0;
  color: rgba(148, 163, 184, 0.95);
  font-size: 0.9rem;
}

.icon-btn {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1.25rem;
  min-height: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #60a5fa;
}

.section-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-action:hover {
  background: rgba(51, 65, 85, 0.75);
}

/* 预设列表 */
.preset-list-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.preset-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
}

.preset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.3);
  cursor: pointer;
  transition: all 0.2s;
}

.preset-item:hover {
  background: rgba(30, 41, 59, 0.5);
  border-color: rgba(255, 255, 255, 0.15);
}

.preset-item.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.4);
}

.preset-info {
  flex: 1;
  min-width: 0;
}

.preset-name {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: #e2e8f0;
  margin-bottom: 0.25rem;
}

.preset-preview {
  display: block;
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preset-actions {
  display: flex;
  gap: 0.25rem;
  margin-left: 0.5rem;
}

.btn-small {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  font-size: 0.8rem;
}

.btn-small:hover {
  background: rgba(255, 255, 255, 0.1);
}

.btn-small.btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
}

.empty-list {
  padding: 2rem;
  text-align: center;
  color: rgba(148, 163, 184, 0.7);
  font-size: 0.9rem;
}

/* 编辑区域 */
.preset-edit-section,
.preset-preview-section {
  display: flex;
  flex-direction: column;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-label {
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.95);
}

.form-input {
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
  font-size: 0.9rem;
}

.form-input:focus {
  outline: none;
  border-color: #60a5fa;
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-textarea {
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
  font-size: 0.85rem;
  font-family: monospace;
  resize: vertical;
  min-height: 60px;
}

.form-textarea:focus {
  outline: none;
  border-color: #60a5fa;
}

.form-hint {
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.6);
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

/* 预览区域 */
.preview-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.preview-label {
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.95);
}

.preview-text {
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.3);
  color: #e2e8f0;
  font-size: 0.85rem;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 120px;
  overflow-y: auto;
}

.empty-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(148, 163, 184, 0.7);
  font-size: 0.9rem;
}

/* 按钮 */
.btn {
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
}

.btn-secondary:hover {
  background: rgba(51, 65, 85, 0.75);
}

.btn-primary {
  border: none;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

/* 导入模式对话框 */
.import-dialog-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.import-dialog {
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 400px;
  text-align: center;
}

.import-dialog h4 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}

.import-dialog p {
  margin: 0 0 1rem;
  color: rgba(148, 163, 184, 0.9);
  font-size: 0.9rem;
}

.import-mode-options {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.btn-cancel {
  border: none;
  background: transparent;
  color: rgba(148, 163, 184, 0.7);
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-cancel:hover {
  color: #e2e8f0;
}

@media (max-width: 768px) {
  .body {
    grid-template-columns: 1fr;
  }

  .preset-list {
    max-height: 200px;
  }
}
</style>
