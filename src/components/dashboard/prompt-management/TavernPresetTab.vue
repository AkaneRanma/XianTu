<template>
  <div class="tavern-preset-tab">
    <!-- 顶部操作栏 -->
    <div class="tab-header">
      <h3>🍺 酒馆预设管理</h3>
      <div class="header-actions">
        <button class="action-btn import-btn" @click="showImportModal = true">
          <span class="btn-icon">📥</span>
          导入预设
        </button>
        <button class="action-btn refresh-btn" @click="refreshPresets" :disabled="isLoading">
          <span class="btn-icon">🔄</span>
          刷新
        </button>
      </div>
    </div>

    <!-- 当前激活预设状态 -->
    <div class="active-preset-card" :class="{ empty: !activePreset }">
      <div class="status-indicator" :class="{ active: activePreset }"></div>
      <div class="preset-info">
        <div class="preset-label">当前激活预设</div>
        <div class="preset-name">
          {{ activePreset?.name || '未激活任何预设' }}
        </div>
        <div v-if="activePreset" class="preset-meta">
          导入于 {{ formatDate(activePreset.importedAt) }}
        </div>
      </div>
      <div v-if="activePreset" class="preset-actions">
        <button class="action-btn small" @click="deactivatePreset">停用</button>
      </div>
    </div>

    <!-- 预设列表 -->
    <div class="presets-section">
      <div class="section-header">
        <h4>📋 已导入预设 ({{ presets.length }})</h4>
      </div>

      <div v-if="isLoading" class="loading-state">
        <span class="loading-icon">⏳</span>
        加载中...
      </div>

      <div v-else-if="presets.length === 0" class="empty-state">
        <span class="empty-icon">📭</span>
        <p>暂无导入的预设</p>
        <p class="empty-hint">点击上方"导入预设"按钮开始使用</p>
      </div>

      <div v-else class="presets-list">
        <div
          v-for="preset in presets"
          :key="preset.id"
          class="preset-card"
          :class="{ active: activePreset?.id === preset.id }"
        >
          <div class="preset-header">
            <span class="preset-icon">📄</span>
            <div class="preset-title">
              <span class="name">{{ preset.name }}</span>
              <span v-if="activePreset?.id === preset.id" class="active-badge">激活中</span>
            </div>
            <div class="preset-actions">
              <button
                v-if="activePreset?.id !== preset.id"
                class="icon-btn activate"
                title="激活此预设"
                @click="activatePreset(preset.id)"
              >
                ⚡
              </button>
              <button class="icon-btn view" title="查看详情" @click="viewPreset(preset)">👁️</button>
              <button class="icon-btn delete" title="删除" @click="confirmDelete(preset)">🗑️</button>
            </div>
          </div>

          <div class="preset-stats">
            <div class="stat">
              <span class="stat-value">{{ preset.stats.enabledPrompts }}</span>
              <span class="stat-label">启用提示词</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ preset.stats.totalRegexScripts }}</span>
              <span class="stat-label">正则脚本</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 当前预设详情 -->
    <div v-if="activePreset" class="detail-sections">
      <!-- 提示词列表 -->
      <div class="detail-section">
        <div class="section-header" @click="showPrompts = !showPrompts">
          <h4>📝 提示词列表 ({{ activePreset.stats.totalPrompts }})</h4>
          <span class="toggle-icon">{{ showPrompts ? '▼' : '▶' }}</span>
        </div>
        <div v-if="showPrompts" class="section-content prompts-section-content">
          <div class="prompts-toolbar">
            <input
              v-model="promptSearch"
              type="text"
              placeholder="搜索提示词..."
              class="search-input"
            />
            <select v-model="promptFilter" class="filter-select">
              <option value="all">全部</option>
              <option value="enabled">启用</option>
              <option value="disabled">禁用</option>
              <option value="marker">占位符</option>
            </select>
          </div>
          <div ref="promptsListRef" class="prompts-list expandable">
            <div
              v-for="(prompt, idx) in filteredPrompts"
              :key="prompt.identifier"
              class="prompt-item"
              :class="{ disabled: !prompt.enabled, marker: prompt.marker, expanded: expandedPromptId === prompt.identifier }"
              @click="togglePromptExpand(prompt)"
            >
              <div class="prompt-item-header">
                <span class="prompt-order">{{ idx + 1 }}</span>
                <span class="prompt-status">{{ prompt.enabled ? '✓' : '✗' }}</span>
                <span class="prompt-name">{{ prompt.name }}</span>
                <span class="prompt-role" :class="prompt.role">{{ prompt.role }}</span>
                <span v-if="prompt.marker" class="prompt-marker-badge">
                  <span class="marker-icon">📍</span>
                  {{ getMarkerPlaceholderName(prompt.identifier) }}
                </span>
                <span v-if="prompt.injection_depth" class="prompt-depth"
                  >深度:{{ prompt.injection_depth }}</span>
                <button class="prompt-expand-btn" @click.stop="viewPromptDetail(prompt)" title="编辑详情">
                  ✏️
                </button>
              </div>
              <!-- 占位符预览信息 -->
              <div v-if="prompt.marker && expandedPromptId === prompt.identifier" class="prompt-marker-preview">
                <div class="marker-info">
                  <div class="marker-info-row">
                    <span class="marker-label">占位符ID:</span>
                    <code class="marker-value">{{ prompt.identifier }}</code>
                  </div>
                  <div class="marker-info-row">
                    <span class="marker-label">代表内容:</span>
                    <span class="marker-value">{{ getMarkerDescription(prompt.identifier) }}</span>
                  </div>
                  <div v-if="prompt.content" class="marker-info-row content-row">
                    <span class="marker-label">原始内容:</span>
                    <pre class="marker-content-preview">{{ prompt.content || '(空)' }}</pre>
                  </div>
                </div>
              </div>
              <!-- 普通提示词预览 -->
              <div v-else-if="!prompt.marker && expandedPromptId === prompt.identifier" class="prompt-content-inline-preview">
                <pre class="inline-content">{{ truncateContent(prompt.content, 200) }}</pre>
              </div>
            </div>
          </div>
          <!-- 回顶按钮 -->
          <button
            v-if="filteredPrompts.length > 10"
            class="scroll-to-top-btn"
            @click="scrollPromptsToTop"
            title="回到顶部"
          >
            ⬆️ 回顶
          </button>
        </div>
      </div>

      <!-- 正则脚本列表 -->
      <div class="detail-section">
        <div class="section-header" @click="showRegex = !showRegex">
          <h4>🔧 正则脚本 ({{ activePreset.stats.totalRegexScripts }})</h4>
          <span class="toggle-icon">{{ showRegex ? '▼' : '▶' }}</span>
        </div>
        <div v-if="showRegex && regexScripts.length > 0" class="section-content">
          <div class="regex-list">
            <div
              v-for="script in regexScripts"
              :key="script.id"
              class="regex-item"
              :class="{ disabled: script.disabled }"
            >
              <div class="regex-header">
                <span class="regex-status">{{ script.disabled ? '✗' : '✓' }}</span>
                <span class="regex-name">{{ script.scriptName }}</span>
                <span class="regex-placement">{{ formatPlacement(script.placement) }}</span>
              </div>
              <div class="regex-pattern">
                <code>{{ script.findRegex }}</code>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="showRegex" class="section-content empty">暂无正则脚本</div>
      </div>

      <!-- 模型参数 -->
      <div v-if="activePreset.rawData" class="detail-section">
        <div class="section-header" @click="showParams = !showParams">
          <h4>⚙️ 模型参数</h4>
          <span class="toggle-icon">{{ showParams ? '▼' : '▶' }}</span>
        </div>
        <div v-if="showParams" class="section-content">
          <div class="params-grid">
            <div class="param-item">
              <label>Temperature</label>
              <span>{{ activePreset.rawData.temperature ?? 'N/A' }}</span>
            </div>
            <div class="param-item">
              <label>Top P</label>
              <span>{{ activePreset.rawData.top_p ?? 'N/A' }}</span>
            </div>
            <div class="param-item">
              <label>Top K</label>
              <span>{{ activePreset.rawData.top_k ?? 'N/A' }}</span>
            </div>
            <div class="param-item">
              <label>Frequency Penalty</label>
              <span>{{ activePreset.rawData.frequency_penalty ?? 'N/A' }}</span>
            </div>
            <div class="param-item">
              <label>Presence Penalty</label>
              <span>{{ activePreset.rawData.presence_penalty ?? 'N/A' }}</span>
            </div>
            <div class="param-item">
              <label>Max Tokens</label>
              <span>{{ activePreset.rawData.openai_max_tokens ?? 'N/A' }}</span>
            </div>
          </div>
          <div class="params-actions">
            <button class="action-btn apply-btn" @click="applyModelParams" :disabled="isApplyingParams">
              <span class="btn-icon">{{ isApplyingParams ? '⏳' : '✨' }}</span>
              {{ isApplyingParams ? '应用中...' : '应用到当前API配置' }}
            </button>
            <span class="params-hint">将预设中的模型参数应用到当前API配置</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 导入模态框 -->
    <TavernPresetImportModal
      v-if="showImportModal"
      @close="showImportModal = false"
      @imported="handleImported"
    />

    <!-- 预设详情模态框 -->
    <div v-if="viewingPreset" class="modal-overlay" @click.self="viewingPreset = null">
      <div class="modal-container detail-modal">
        <div class="modal-header">
          <h3>📄 预设详情</h3>
          <button class="close-btn" @click="viewingPreset = null">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-info">
            <div class="info-row">
              <label>名称：</label>
              <span>{{ viewingPreset.name }}</span>
            </div>
            <div class="info-row">
              <label>ID：</label>
              <span class="mono">{{ viewingPreset.id }}</span>
            </div>
            <div class="info-row">
              <label>导入时间：</label>
              <span>{{ formatDate(viewingPreset.importedAt) }}</span>
            </div>
          </div>
          <div class="detail-stats">
            <div class="stat">
              <span class="stat-value">{{ viewingPreset.stats.totalPrompts }}</span>
              <span class="stat-label">总提示词</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ viewingPreset.stats.enabledPrompts }}</span>
              <span class="stat-label">已启用</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ viewingPreset.stats.totalRegexScripts }}</span>
              <span class="stat-label">正则脚本</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="action-btn" @click="viewingPreset = null">关闭</button>
        </div>
      </div>
    </div>

    <!-- 提示词详情/编辑模态框 -->
    <div v-if="viewingPrompt" class="modal-overlay" @click.self="closePromptModal">
      <div class="modal-container prompt-modal">
        <div class="modal-header">
          <h3>{{ isEditingPrompt ? '✏️ 编辑提示词' : '📝 提示词详情' }}</h3>
          <button class="close-btn" @click="closePromptModal">×</button>
        </div>
        <div class="modal-body">
          <div class="prompt-detail-info">
            <div class="info-row">
              <label>名称：</label>
              <input
                v-if="isEditingPrompt"
                v-model="editingPromptData.name"
                type="text"
                class="edit-input"
              />
              <span v-else>{{ viewingPrompt.name }}</span>
            </div>
            <div class="info-row">
              <label>角色：</label>
              <select v-if="isEditingPrompt" v-model="editingPromptData.role" class="edit-select">
                <option value="system">system</option>
                <option value="user">user</option>
                <option value="assistant">assistant</option>
              </select>
              <span v-else class="role-badge" :class="viewingPrompt.role">{{ viewingPrompt.role }}</span>
            </div>
            <div class="info-row">
              <label>状态：</label>
              <label v-if="isEditingPrompt" class="toggle-switch">
                <input type="checkbox" v-model="editingPromptData.enabled" />
                <span class="toggle-slider"></span>
                <span class="toggle-label">{{ editingPromptData.enabled ? '启用' : '禁用' }}</span>
              </label>
              <span v-else>{{ viewingPrompt.enabled ? '启用' : '禁用' }}</span>
            </div>
            <div class="info-row">
              <label>注入位置：</label>
              <select v-if="isEditingPrompt" v-model="editingPromptData.injection_position" class="edit-select">
                <option :value="0">消息之前</option>
                <option :value="1">消息之后</option>
              </select>
              <span v-else>{{ viewingPrompt.injection_position === 0 ? '消息之前' : '消息之后' }}</span>
            </div>
            <div class="info-row">
              <label>注入深度：</label>
              <input
                v-if="isEditingPrompt"
                v-model.number="editingPromptData.injection_depth"
                type="number"
                min="0"
                class="edit-input small"
              />
              <span v-else>{{ viewingPrompt.injection_depth }}</span>
            </div>
          </div>
          <div class="prompt-content-preview">
            <label>内容：</label>
            <textarea
              v-if="isEditingPrompt"
              v-model="editingPromptData.content"
              class="edit-textarea"
              rows="12"
              placeholder="输入提示词内容..."
            ></textarea>
            <pre v-else>{{ viewingPrompt.content || '(空)' }}</pre>
          </div>
        </div>
        <div class="modal-footer">
          <template v-if="isEditingPrompt">
            <button class="action-btn cancel" @click="cancelEditPrompt">取消</button>
            <button class="action-btn save" @click="saveEditedPrompt" :disabled="isSavingPrompt">
              {{ isSavingPrompt ? '保存中...' : '保存' }}
            </button>
          </template>
          <template v-else>
            <button class="action-btn edit" @click="startEditPrompt">
              <span class="btn-icon">✏️</span>
              编辑
            </button>
            <button class="action-btn" @click="viewingPrompt = null">关闭</button>
          </template>
        </div>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="deletingPreset" class="modal-overlay" @click.self="deletingPreset = null">
      <div class="modal-container confirm-modal">
        <div class="modal-header">
          <h3>⚠️ 确认删除</h3>
          <button class="close-btn" @click="deletingPreset = null">×</button>
        </div>
        <div class="modal-body">
          <p>确定要删除预设 <strong>{{ deletingPreset.name }}</strong> 吗？</p>
          <p class="warning-text">此操作无法撤销。</p>
        </div>
        <div class="modal-footer">
          <button class="action-btn cancel" @click="deletingPreset = null">取消</button>
          <button class="action-btn delete" @click="executeDelete">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { tavernPresetService } from '@/services/tavernPresetService'
import { aiService } from '@/services/aiService'
import type { LocalTavernPreset, TavernPromptItem, TavernRegexScript } from '@/types/tavernPreset'
import TavernPresetImportModal from './TavernPresetImportModal.vue'

// 状态
const isLoading = ref(false)
const presets = ref<LocalTavernPreset[]>([])
const activePreset = ref<LocalTavernPreset | null>(null)
const showImportModal = ref(false)

// 详情展开状态
const showPrompts = ref(true)
const showRegex = ref(false)
const showParams = ref(false)

// 提示词列表引用和展开状态
const promptsListRef = ref<HTMLElement | null>(null)
const expandedPromptId = ref<string | null>(null)

// 搜索和筛选
const promptSearch = ref('')
const promptFilter = ref<'all' | 'enabled' | 'disabled' | 'marker'>('all')

// 模态框状态
const viewingPreset = ref<LocalTavernPreset | null>(null)
const viewingPrompt = ref<TavernPromptItem | null>(null)
const deletingPreset = ref<LocalTavernPreset | null>(null)

// 编辑状态
const isEditingPrompt = ref(false)
const isSavingPrompt = ref(false)
const editingPromptData = ref<{
  name: string
  role: string
  enabled: boolean
  injection_position: number
  injection_depth: number
  content: string
  identifier: string
}>({
  name: '',
  role: 'system',
  enabled: true,
  injection_position: 0,
  injection_depth: 4,
  content: '',
  identifier: '',
})

// 模型参数应用状态
const isApplyingParams = ref(false)

// 计算属性
const filteredPrompts = computed(() => {
  if (!activePreset.value) return []

  let prompts = [...activePreset.value.orderedPrompts]

  // 搜索过滤
  if (promptSearch.value) {
    const search = promptSearch.value.toLowerCase()
    prompts = prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(search) || p.content?.toLowerCase().includes(search) || false,
    )
  }

  // 状态过滤
  switch (promptFilter.value) {
    case 'enabled':
      prompts = prompts.filter((p) => p.enabled)
      break
    case 'disabled':
      prompts = prompts.filter((p) => !p.enabled)
      break
    case 'marker':
      prompts = prompts.filter((p) => p.marker)
      break
  }

  return prompts
})

const regexScripts = computed((): TavernRegexScript[] => {
  if (!activePreset.value) return []
  return activePreset.value.regexScripts || []
})

// 方法
async function refreshPresets() {
  isLoading.value = true
  try {
    presets.value = await tavernPresetService.getAllPresets()
    activePreset.value = await tavernPresetService.getActivePreset()
  } catch (e) {
    console.error('Failed to refresh presets:', e)
  } finally {
    isLoading.value = false
  }
}

async function activatePreset(id: string) {
  try {
    await tavernPresetService.setActivePreset(id)
    await refreshPresets()
  } catch (e) {
    console.error('Failed to activate preset:', e)
  }
}

async function deactivatePreset() {
  try {
    await tavernPresetService.clearActivePreset()
    await refreshPresets()
  } catch (e) {
    console.error('Failed to deactivate preset:', e)
  }
}

function viewPreset(preset: LocalTavernPreset) {
  viewingPreset.value = preset
}

function viewPromptDetail(prompt: TavernPromptItem) {
  viewingPrompt.value = prompt
  isEditingPrompt.value = false
}

function togglePromptExpand(prompt: TavernPromptItem) {
  if (expandedPromptId.value === prompt.identifier) {
    expandedPromptId.value = null
  } else {
    expandedPromptId.value = prompt.identifier
  }
}

function scrollPromptsToTop() {
  if (promptsListRef.value) {
    promptsListRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function truncateContent(content: string | undefined, maxLength: number): string {
  if (!content) return '(空)'
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength) + '...'
}

// 占位符名称映射
const markerNameMap: Record<string, string> = {
  'worldInfoBefore': '世界书(前)',
  'worldInfoAfter': '世界书(后)',
  'personaDescription': '用户人设',
  'charDescription': '角色描述',
  'charPersonality': '角色性格',
  'scenario': '场景设定',
  'dialogueExamples': '对话示例',
  'chatHistory': '聊天历史',
  'main': '主提示词',
  'nsfw': 'NSFW设置',
  'jailbreak': '越狱提示',
  'enhanceDefinitions': '增强定义',
}

// 占位符描述映射
const markerDescriptionMap: Record<string, string> = {
  'worldInfoBefore': '在消息前插入的世界书条目，包含背景设定、规则等',
  'worldInfoAfter': '在消息后插入的世界书条目',
  'personaDescription': '用户角色的人设描述，{{user}} 的身份信息',
  'charDescription': 'AI角色的描述，包含外貌、背景等信息',
  'charPersonality': 'AI角色的性格特征描述',
  'scenario': '当前场景的设定和背景描述',
  'dialogueExamples': '对话格式示例，帮助AI理解期望的输出格式',
  'chatHistory': '聊天历史记录，包含之前的对话消息',
  'main': '主系统提示词，定义AI的基本行为',
  'nsfw': 'NSFW内容相关的设置和权限',
  'jailbreak': '用于解除AI限制的提示词',
  'enhanceDefinitions': '增强角色定义的额外提示词',
}

function getMarkerPlaceholderName(identifier: string): string {
  return markerNameMap[identifier] || identifier
}

function getMarkerDescription(identifier: string): string {
  return markerDescriptionMap[identifier] || '自定义占位符，将在运行时被实际内容替换'
}

function startEditPrompt() {
  if (!viewingPrompt.value) return

  editingPromptData.value = {
    name: viewingPrompt.value.name,
    role: viewingPrompt.value.role,
    enabled: viewingPrompt.value.enabled,
    injection_position: viewingPrompt.value.injection_position ?? 0,
    injection_depth: viewingPrompt.value.injection_depth ?? 4,
    content: viewingPrompt.value.content || '',
    identifier: viewingPrompt.value.identifier,
  }
  isEditingPrompt.value = true
}

function cancelEditPrompt() {
  isEditingPrompt.value = false
}

function closePromptModal() {
  viewingPrompt.value = null
  isEditingPrompt.value = false
}

async function saveEditedPrompt() {
  if (!activePreset.value || !viewingPrompt.value) return

  isSavingPrompt.value = true
  try {
    // 找到并更新对应的提示词
    const promptIndex = activePreset.value.prompts.findIndex(
      p => p.identifier === editingPromptData.value.identifier
    )

    if (promptIndex === -1) {
      console.error('未找到要编辑的提示词')
      return
    }

    // 更新 prompts 数组
    const updatedPrompts = [...activePreset.value.prompts]
    updatedPrompts[promptIndex] = {
      ...updatedPrompts[promptIndex],
      name: editingPromptData.value.name,
      role: editingPromptData.value.role as 'system' | 'user' | 'assistant',
      enabled: editingPromptData.value.enabled,
      injection_position: editingPromptData.value.injection_position,
      injection_depth: editingPromptData.value.injection_depth,
      content: editingPromptData.value.content,
    }

    // 同步更新 orderedPrompts
    const orderedIndex = activePreset.value.orderedPrompts.findIndex(
      p => p.identifier === editingPromptData.value.identifier
    )
    const updatedOrderedPrompts = [...activePreset.value.orderedPrompts]
    if (orderedIndex !== -1) {
      updatedOrderedPrompts[orderedIndex] = {
        ...updatedOrderedPrompts[orderedIndex],
        name: editingPromptData.value.name,
        role: editingPromptData.value.role as 'system' | 'user' | 'assistant',
        enabled: editingPromptData.value.enabled,
        injection_position: editingPromptData.value.injection_position,
        injection_depth: editingPromptData.value.injection_depth,
        content: editingPromptData.value.content,
      }
    }

    // 同步更新 rawData 中的 prompts
    let updatedRawData = activePreset.value.rawData
    if (updatedRawData && Array.isArray(updatedRawData.prompts)) {
      const rawPromptIndex = updatedRawData.prompts.findIndex(
        p => p.identifier === editingPromptData.value.identifier
      )
      if (rawPromptIndex !== -1) {
        updatedRawData = {
          ...updatedRawData,
          prompts: [...updatedRawData.prompts]
        }
        updatedRawData.prompts[rawPromptIndex] = {
          ...updatedRawData.prompts[rawPromptIndex],
          name: editingPromptData.value.name,
          role: editingPromptData.value.role as 'system' | 'user' | 'assistant',
          enabled: editingPromptData.value.enabled,
          injection_position: editingPromptData.value.injection_position,
          injection_depth: editingPromptData.value.injection_depth,
          content: editingPromptData.value.content,
        }
      }
    }

    // 更新统计信息
    const updatedStats = {
      ...activePreset.value.stats,
      enabledPrompts: updatedOrderedPrompts.filter(p => p.enabled && !p.marker).length,
    }

    // 保存到数据库
    await tavernPresetService.updatePreset(activePreset.value.id, {
      prompts: updatedPrompts,
      orderedPrompts: updatedOrderedPrompts,
      rawData: updatedRawData,
      stats: updatedStats,
    })

    // 更新本地状态
    viewingPrompt.value = updatedPrompts[promptIndex]
    isEditingPrompt.value = false

    // 刷新预设列表
    await refreshPresets()

    console.log('[TavernPresetTab] 提示词已更新:', editingPromptData.value.name)
  } catch (error) {
    console.error('[TavernPresetTab] 保存提示词失败:', error)
  } finally {
    isSavingPrompt.value = false
  }
}

async function applyModelParams() {
  if (!activePreset.value?.modelParams) return

  isApplyingParams.value = true
  try {
    const params = activePreset.value.modelParams
    const currentConfig = await aiService.getConfig()

    // 构建更新配置
    const updateConfig: Record<string, unknown> = {}

    // 更新 customAPI 中的参数
    if (currentConfig.customAPI) {
      updateConfig.customAPI = {
        ...currentConfig.customAPI,
        temperature: params.temperature,
        maxTokens: params.max_tokens,
      }
    }

    // 保存配置
    await aiService.saveConfig(updateConfig)

    console.log('[TavernPresetTab] 模型参数已应用:', {
      temperature: params.temperature,
      maxTokens: params.max_tokens,
      top_p: params.top_p,
      top_k: params.top_k,
      frequency_penalty: params.frequency_penalty,
      presence_penalty: params.presence_penalty,
    })

    // 显示成功提示（可以通过 emit 或 toast 系统）
    alert('模型参数已成功应用到当前API配置！')
  } catch (error) {
    console.error('[TavernPresetTab] 应用模型参数失败:', error)
    alert('应用模型参数失败，请查看控制台了解详情')
  } finally {
    isApplyingParams.value = false
  }
}

function confirmDelete(preset: LocalTavernPreset) {
  deletingPreset.value = preset
}

async function executeDelete() {
  if (!deletingPreset.value) return

  try {
    await tavernPresetService.deletePreset(deletingPreset.value.id)
    deletingPreset.value = null
    await refreshPresets()
  } catch (e) {
    console.error('Failed to delete preset:', e)
  }
}

function handleImported(info: { id: string; name: string }) {
  console.log('Preset imported:', info)
  refreshPresets()
}

function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPlacement(placement: number[]): string {
  const labels: Record<number, string> = {
    0: '用户输入',
    1: 'AI输出',
    2: '斜杠命令',
  }
  return placement.map((p) => labels[p] || String(p)).join(', ')
}

// 生命周期
onMounted(() => {
  refreshPresets()
})
</script>

<style scoped>
.tavern-preset-tab {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.tab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.tab-header h3 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary, #fff);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.action-btn.import-btn {
  background: var(--accent-color, #8b5cf6);
  color: white;
}

.action-btn.import-btn:hover {
  background: var(--accent-hover, #7c3aed);
}

.action-btn.refresh-btn {
  background: var(--bg-tertiary, #252536);
  border: 1px solid var(--border-color, #444);
  color: var(--text-primary, #fff);
}

.action-btn.refresh-btn:hover:not(:disabled) {
  background: var(--bg-secondary, #1e1e2e);
}

.action-btn.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.small {
  padding: 6px 12px;
  font-size: 12px;
  background: var(--bg-tertiary, #252536);
  border: 1px solid var(--border-color, #444);
  color: var(--text-primary, #fff);
}

.action-btn.cancel {
  background: var(--bg-tertiary, #252536);
  border: 1px solid var(--border-color, #444);
  color: var(--text-primary, #fff);
}

.action-btn.delete {
  background: #ef4444;
  color: white;
}

.btn-icon {
  font-size: 16px;
}

/* 激活预设卡片 */
.active-preset-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid var(--border-color, #333);
  border-radius: 12px;
  margin-bottom: 20px;
}

.active-preset-card.empty {
  border-style: dashed;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--text-secondary, #666);
}

.status-indicator.active {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.preset-info {
  flex: 1;
}

.preset-label {
  font-size: 12px;
  color: var(--text-secondary, #888);
  margin-bottom: 4px;
}

.preset-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.preset-meta {
  font-size: 12px;
  color: var(--text-secondary, #888);
  margin-top: 4px;
}

/* 预设列表 */
.presets-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  cursor: pointer;
}

.section-header h4 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #fff);
}

.toggle-icon {
  font-size: 12px;
  color: var(--text-secondary, #888);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: var(--bg-secondary, #1e1e2e);
  border: 1px dashed var(--border-color, #444);
  border-radius: 12px;
  color: var(--text-secondary, #888);
}

.loading-icon,
.empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.empty-hint {
  font-size: 13px;
  margin-top: 4px;
}

.presets-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.preset-card {
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid var(--border-color, #333);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s ease;
}

.preset-card.active {
  border-color: var(--accent-color, #8b5cf6);
  background: rgba(139, 92, 246, 0.1);
}

.preset-card:hover {
  border-color: var(--accent-color, #8b5cf6);
}

.preset-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.preset-icon {
  font-size: 20px;
}

.preset-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.preset-title .name {
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.active-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--accent-color, #8b5cf6);
  color: white;
  border-radius: 4px;
}

.preset-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: var(--bg-tertiary, #252536);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background: var(--bg-secondary, #1e1e2e);
}

.icon-btn.delete:hover {
  background: rgba(239, 68, 68, 0.2);
}

.preset-stats {
  display: flex;
  gap: 16px;
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: var(--accent-color, #8b5cf6);
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary, #888);
}

/* 详情区块 */
.detail-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-section {
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid var(--border-color, #333);
  border-radius: 12px;
  overflow: hidden;
}

.detail-section .section-header {
  padding: 12px 16px;
  margin: 0;
  background: var(--bg-tertiary, #252536);
  border-bottom: 1px solid var(--border-color, #333);
}

.section-content {
  padding: 16px;
}

.section-content.empty {
  color: var(--text-secondary, #888);
  text-align: center;
}

/* 提示词工具栏 */
.prompts-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--bg-tertiary, #252536);
  color: var(--text-primary, #fff);
  font-size: 13px;
}

.filter-select {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--bg-tertiary, #252536);
  color: var(--text-primary, #fff);
  font-size: 13px;
}

/* 提示词列表 - 可展开样式 */
.prompts-section-content {
  position: relative;
}

.prompts-list {
  max-height: 400px;
  overflow-y: auto;
}

.prompts-list.expandable {
  max-height: 600px;
}

.prompt-item {
  display: flex;
  flex-direction: column;
  padding: 0;
  border-radius: 6px;
  background: var(--bg-tertiary, #252536);
  margin-bottom: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.prompt-item:hover {
  background: rgba(139, 92, 246, 0.1);
}

.prompt-item.disabled {
  opacity: 0.5;
}

.prompt-item.marker {
  border-left: 3px solid #f59e0b;
}

.prompt-item.expanded {
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.prompt-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
}

.prompt-order {
  font-size: 11px;
  color: var(--text-secondary, #888);
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.prompt-status {
  font-size: 12px;
  flex-shrink: 0;
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
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-secondary, #1e1e2e);
  flex-shrink: 0;
}

.prompt-role.system {
  color: #f59e0b;
}

.prompt-role.user {
  color: #22c55e;
}

.prompt-role.assistant {
  color: #3b82f6;
}

.prompt-marker-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 2px 8px;
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border-radius: 4px;
  flex-shrink: 0;
}

.prompt-marker-badge .marker-icon {
  font-size: 10px;
}

.prompt-depth {
  font-size: 10px;
  color: var(--text-secondary, #888);
  flex-shrink: 0;
}

.prompt-expand-btn {
  padding: 4px 8px;
  border-radius: 4px;
  border: none;
  background: rgba(139, 92, 246, 0.2);
  color: var(--accent-color, #8b5cf6);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.prompt-expand-btn:hover {
  background: rgba(139, 92, 246, 0.4);
}

/* 占位符预览样式 */
.prompt-marker-preview {
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.08);
  border-top: 1px solid rgba(245, 158, 11, 0.2);
}

.marker-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.marker-info-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.marker-info-row.content-row {
  flex-direction: column;
}

.marker-label {
  font-size: 11px;
  color: var(--text-secondary, #888);
  min-width: 70px;
  flex-shrink: 0;
}

.marker-value {
  font-size: 12px;
  color: var(--text-primary, #fff);
}

code.marker-value {
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: #22c55e;
}

.marker-content-preview {
  margin: 4px 0 0 0;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-secondary, #aaa);
  max-height: 100px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

/* 普通提示词内联预览 */
.prompt-content-inline-preview {
  padding: 12px 16px;
  background: rgba(139, 92, 246, 0.05);
  border-top: 1px solid rgba(139, 92, 246, 0.15);
}

.prompt-content-inline-preview .inline-content {
  margin: 0;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary, #ddd);
  max-height: 150px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

/* 回顶按钮 */
.scroll-to-top-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 12px;
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--bg-tertiary, #252536);
  color: var(--text-primary, #fff);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.scroll-to-top-btn:hover {
  background: rgba(139, 92, 246, 0.2);
  border-color: var(--accent-color, #8b5cf6);
}

/* 正则列表 */
.regex-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.regex-item {
  padding: 12px;
  background: var(--bg-tertiary, #252536);
  border-radius: 8px;
}

.regex-item.disabled {
  opacity: 0.5;
}

.regex-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.regex-status {
  font-size: 12px;
}

.regex-name {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.regex-placement {
  font-size: 11px;
  color: var(--text-secondary, #888);
}

.regex-pattern {
  padding: 8px;
  background: var(--bg-secondary, #1e1e2e);
  border-radius: 4px;
  overflow-x: auto;
}

.regex-pattern code {
  font-size: 12px;
  color: #22c55e;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

/* 参数网格 */
.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.params-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, #333);
}

.params-actions .apply-btn {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
}

.params-actions .apply-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #16a34a, #15803d);
}

.params-actions .apply-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.params-hint {
  font-size: 12px;
  color: var(--text-secondary, #888);
}

.param-item {
  padding: 12px;
  background: var(--bg-tertiary, #252536);
  border-radius: 8px;
  text-align: center;
}

.param-item label {
  display: block;
  font-size: 11px;
  color: var(--text-secondary, #888);
  margin-bottom: 4px;
}

.param-item span {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid var(--border-color, #333);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-container.prompt-modal {
  max-width: 600px;
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
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--bg-tertiary, #252536);
  color: var(--text-primary, #fff);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #333);
}

/* 详情信息 */
.detail-info,
.prompt-detail-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-row label {
  font-size: 13px;
  color: var(--text-secondary, #888);
  min-width: 80px;
}

.info-row span {
  font-size: 14px;
  color: var(--text-primary, #fff);
}

.info-row .mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.role-badge {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
}

.role-badge.system {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.role-badge.user {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.role-badge.assistant {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.detail-stats {
  display: flex;
  gap: 24px;
  justify-content: center;
  padding: 16px;
  background: var(--bg-tertiary, #252536);
  border-radius: 8px;
}

/* 提示词内容预览 */
.prompt-content-preview {
  margin-top: 16px;
}

.prompt-content-preview label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary, #888);
  margin-bottom: 8px;
}

.prompt-content-preview pre {
  padding: 16px;
  background: var(--bg-tertiary, #252536);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-primary, #fff);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

/* 编辑表单样式 */
.edit-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--bg-tertiary, #252536);
  color: var(--text-primary, #fff);
  font-size: 14px;
}

.edit-input.small {
  width: 80px;
  flex: none;
}

.edit-select {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--bg-tertiary, #252536);
  color: var(--text-primary, #fff);
  font-size: 14px;
  min-width: 120px;
}

.edit-textarea {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #444);
  background: var(--bg-tertiary, #252536);
  color: var(--text-primary, #fff);
  font-size: 13px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  resize: vertical;
  min-height: 200px;
}

.edit-textarea:focus,
.edit-input:focus,
.edit-select:focus {
  outline: none;
  border-color: var(--accent-color, #8b5cf6);
}

/* Toggle Switch */
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toggle-switch input {
  display: none;
}

.toggle-slider {
  width: 40px;
  height: 22px;
  background: var(--bg-tertiary, #252536);
  border-radius: 11px;
  position: relative;
  transition: background 0.2s ease;
  border: 1px solid var(--border-color, #444);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text-secondary, #888);
  top: 2px;
  left: 2px;
  transition: all 0.2s ease;
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--accent-color, #8b5cf6);
  border-color: var(--accent-color, #8b5cf6);
}

.toggle-switch input:checked + .toggle-slider::before {
  background: white;
  transform: translateX(18px);
}

.toggle-label {
  font-size: 14px;
  color: var(--text-primary, #fff);
}

/* 编辑/保存按钮 */
.action-btn.edit {
  background: var(--accent-color, #8b5cf6);
  color: white;
}

.action-btn.edit:hover {
  background: var(--accent-hover, #7c3aed);
}

.action-btn.save {
  background: #22c55e;
  color: white;
}

.action-btn.save:hover:not(:disabled) {
  background: #16a34a;
}

.action-btn.save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 警告文本 */
.warning-text {
  color: #ef4444;
  font-size: 13px;
}

/* 确认模态框 */
.confirm-modal .modal-body p {
  margin: 0 0 12px;
  color: var(--text-primary, #fff);
}

/* 滚动条样式 */
.tavern-preset-tab::-webkit-scrollbar,
.prompts-list::-webkit-scrollbar,
.modal-body::-webkit-scrollbar,
.prompt-content-preview pre::-webkit-scrollbar {
  width: 6px;
}

.tavern-preset-tab::-webkit-scrollbar-track,
.prompts-list::-webkit-scrollbar-track,
.modal-body::-webkit-scrollbar-track,
.prompt-content-preview pre::-webkit-scrollbar-track {
  background: transparent;
}

.tavern-preset-tab::-webkit-scrollbar-thumb,
.prompts-list::-webkit-scrollbar-thumb,
.modal-body::-webkit-scrollbar-thumb,
.prompt-content-preview pre::-webkit-scrollbar-thumb {
  background: var(--border-color, #444);
  border-radius: 3px;
}

.tavern-preset-tab::-webkit-scrollbar-thumb:hover,
.prompts-list::-webkit-scrollbar-thumb:hover,
.modal-body::-webkit-scrollbar-thumb:hover,
.prompt-content-preview pre::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary, #666);
}
</style>
