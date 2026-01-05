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

    <!-- 可用宏变量介绍 -->
    <div class="macro-help-section">
      <div class="section-header" @click="showMacroHelp = !showMacroHelp">
        <h4>📚 可用宏变量与占位符</h4>
        <span class="toggle-icon">{{ showMacroHelp ? '▼' : '▶' }}</span>
      </div>
      <div v-if="showMacroHelp" class="macro-help-content">
        <div class="macro-category">
          <h5>🏷️ 基础宏变量（在提示词内容中使用）</h5>
          <div class="macro-list">
            <div class="macro-item">
              <code>{{user}}</code>
              <span>用户/角色名称（来自角色基础信息.名字）</span>
            </div>
            <div class="macro-item">
              <code>{{char}}</code>
              <span>AI角色名（预设名称）</span>
            </div>
            <div class="macro-item">
              <code>{{personaDescription}}</code>
              <span>用户人设描述（设置面板 → AI服务配置中编辑）</span>
            </div>
            <div class="macro-item">
              <code>{{scenario}}</code>
              <span>场景设定（自动从游戏状态生成：位置、时间、物品等）</span>
            </div>
            <div class="macro-item">
              <code>{{lastUserMessage}}</code>
              <span>最后一条用户消息</span>
            </div>
            <div class="macro-item">
              <code>{{lastCharMessage}}</code>
              <span>最后一条AI消息</span>
            </div>
          </div>
        </div>
        <div class="macro-category">
          <h5>📍 占位符条目（系统自动填充内容）</h5>
          <div class="macro-list">
            <div class="macro-item">
              <code>personaDescription</code>
              <span>用户人设 → 来自设置面板"Persona Description"</span>
            </div>
            <div class="macro-item">
              <code>scenario</code>
              <span>场景设定 → 自动从游戏状态生成</span>
            </div>
            <div class="macro-item">
              <code>charDescription</code>
              <span>角色描述 → 自动从角色基础信息生成</span>
            </div>
            <div class="macro-item">
              <code>charPersonality</code>
              <span>角色性格 → 自动从角色信息生成</span>
            </div>
            <div class="macro-item">
              <code>chatHistory</code>
              <span>聊天历史 → 记忆系统（短期+中期+长期）</span>
            </div>
            <div class="macro-item">
              <code>worldInfoBefore</code>
              <span>前置世界书 → 从世界书条目读取</span>
            </div>
            <div class="macro-item">
              <code>worldInfoAfter</code>
              <span>后置世界书 → 从世界书条目读取</span>
            </div>
          </div>
        </div>
        <div class="macro-tip">
          💡 <strong>提示：</strong>占位符是位置标记，内容由系统自动填充。要修改内容请去对应来源处修改（设置面板、世界书、角色信息等）。
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
            <button class="action-btn add-btn" @click="showCreatePromptModal = true">
              <span class="btn-icon">➕</span>
              创建条目
            </button>
          </div>
          <div ref="promptsListRef" class="prompts-list expandable">
            <div
              v-for="(prompt, idx) in filteredPrompts"
              :key="prompt.identifier"
              class="prompt-item"
              :class="{
                disabled: !prompt.enabled,
                marker: prompt.marker,
                expanded: expandedPromptId === prompt.identifier,
                'drag-over': dragOverPromptId === prompt.identifier,
                'touch-dragging': isTouchDragging && draggedPrompt?.identifier === prompt.identifier
              }"
              :draggable="!isMobile"
              @click="handlePromptClick($event, prompt)"
              @dragstart="handleDragStart($event, prompt)"
              @dragend="handleDragEnd($event)"
              @dragover="handleDragOver($event, prompt)"
              @dragleave="handleDragLeave($event)"
              @drop="handleDrop($event, prompt)"
              @touchstart="handleTouchStart($event, prompt)"
              @touchmove.prevent="handleTouchMove($event, prompt)"
              @touchend="handleTouchEnd($event, prompt)"
              @touchcancel="handleTouchCancel"
              @contextmenu.prevent
            >
              <div class="prompt-item-header">
                <span class="drag-handle" title="拖动排序">⋮⋮</span>
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

    <!-- 创建提示词条目模态框 -->
    <div v-if="showCreatePromptModal" class="modal-overlay" @click.self="showCreatePromptModal = false">
      <div class="modal-container prompt-modal">
        <div class="modal-header">
          <h3>➕ 创建自定义条目</h3>
          <button class="close-btn" @click="showCreatePromptModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="prompt-detail-info">
            <div class="info-row">
              <label>名称：</label>
              <input
                v-model="newPromptData.name"
                type="text"
                class="edit-input"
                placeholder="输入条目名称..."
              />
            </div>
            <div class="info-row">
              <label>角色：</label>
              <select v-model="newPromptData.role" class="edit-select">
                <option value="system">system</option>
                <option value="user">user</option>
                <option value="assistant">assistant</option>
              </select>
            </div>
            <div class="info-row">
              <label>状态：</label>
              <label class="toggle-switch">
                <input type="checkbox" v-model="newPromptData.enabled" />
                <span class="toggle-slider"></span>
                <span class="toggle-label">{{ newPromptData.enabled ? '启用' : '禁用' }}</span>
              </label>
            </div>
            <div class="info-row">
              <label>注入位置：</label>
              <select v-model="newPromptData.injection_position" class="edit-select">
                <option :value="0">消息之前</option>
                <option :value="1">消息之后</option>
              </select>
            </div>
            <div class="info-row">
              <label>注入深度：</label>
              <input
                v-model.number="newPromptData.injection_depth"
                type="number"
                min="0"
                class="edit-input small"
              />
              <span class="depth-hint">（数值越大越靠前）</span>
            </div>
          </div>
          <div class="prompt-content-preview">
            <label>内容：</label>
            <div class="macro-hints">
              可用宏：<code>{{user}}</code> <code>{{char}}</code> <code>{{personaDescription}}</code> <code>{{scenario}}</code>
            </div>
            <textarea
              v-model="newPromptData.content"
              class="edit-textarea"
              rows="10"
              placeholder="输入提示词内容...&#10;&#10;示例：&#10;你正在与{{user}}互动。&#10;{{personaDescription}}&#10;当前场景：{{scenario}}"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="action-btn cancel" @click="showCreatePromptModal = false">取消</button>
          <button class="action-btn save" @click="createNewPrompt" :disabled="isCreatingPrompt || !newPromptData.name.trim()">
            {{ isCreatingPrompt ? '创建中...' : '创建' }}
          </button>
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
import { ref, computed, onMounted, onUnmounted, toRaw, nextTick } from 'vue'
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

// 拖动状态
const draggedPrompt = ref<TavernPromptItem | null>(null)
const dragOverPromptId = ref<string | null>(null)
const isDragging = ref(false)

// 触摸拖动状态
const touchStartY = ref(0)
const touchStartX = ref(0)
const touchStartTime = ref(0)
const touchDragElement = ref<HTMLElement | null>(null)
const touchClone = ref<HTMLElement | null>(null)
const isTouchDragging = ref(false)
const longPressTimer = ref<number | null>(null)
const LONG_PRESS_DURATION = 400 // 长按400ms后开始拖动
const touchMoved = ref(false)

// 检测是否为移动设备
const isMobile = ref(false)

// 搜索和筛选
const promptSearch = ref('')
const promptFilter = ref<'all' | 'enabled' | 'disabled' | 'marker'>('all')

// 宏帮助显示状态
const showMacroHelp = ref(false)

// 模态框状态
const viewingPreset = ref<LocalTavernPreset | null>(null)
const viewingPrompt = ref<TavernPromptItem | null>(null)
const deletingPreset = ref<LocalTavernPreset | null>(null)
const showCreatePromptModal = ref(false)
const isCreatingPrompt = ref(false)

// 新条目数据
const newPromptData = ref({
  name: '',
  role: 'system' as 'system' | 'user' | 'assistant',
  enabled: true,
  injection_position: 0,
  injection_depth: 4,
  content: '',
})

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
  // 如果正在拖动，不触发展开
  if (isDragging.value || isTouchDragging.value) return

  if (expandedPromptId.value === prompt.identifier) {
    expandedPromptId.value = null
  } else {
    expandedPromptId.value = prompt.identifier
  }
}

// 处理点击事件（区分桌面端和移动端）
function handlePromptClick(event: MouseEvent, prompt: TavernPromptItem) {
  // 移动端由触摸事件处理，忽略合成的点击事件
  if (isMobile.value) return
  // 如果正在拖动，不触发
  if (isDragging.value) return
  togglePromptExpand(prompt)
}

// 拖动功能
function handleDragStart(event: DragEvent, prompt: TavernPromptItem) {
  if (!event.dataTransfer) return

  isDragging.value = true
  draggedPrompt.value = prompt

  // 设置拖动数据
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', prompt.identifier)

  // 添加拖动中的样式类
  const target = event.target as HTMLElement
  setTimeout(() => {
    target.classList.add('dragging')
  }, 0)
}

function handleDragEnd(event: DragEvent) {
  isDragging.value = false
  draggedPrompt.value = null
  dragOverPromptId.value = null

  // 移除拖动样式
  const target = event.target as HTMLElement
  target.classList.remove('dragging')
}

function handleDragOver(event: DragEvent, prompt: TavernPromptItem) {
  event.preventDefault()
  if (!event.dataTransfer) return

  event.dataTransfer.dropEffect = 'move'

  // 更新悬停目标
  if (draggedPrompt.value && draggedPrompt.value.identifier !== prompt.identifier) {
    dragOverPromptId.value = prompt.identifier
  }
}

function handleDragLeave(event: DragEvent) {
  // 检查是否真的离开了元素（而不是进入子元素）
  const relatedTarget = event.relatedTarget as HTMLElement
  const currentTarget = event.currentTarget as HTMLElement

  if (!currentTarget.contains(relatedTarget)) {
    dragOverPromptId.value = null
  }
}

// 触摸拖动功能
function handleTouchStart(event: TouchEvent, prompt: TavernPromptItem) {
  // 重置状态
  touchMoved.value = false

  // 记录触摸开始位置和时间
  touchStartY.value = event.touches[0].clientY
  touchStartX.value = event.touches[0].clientX
  touchStartTime.value = Date.now()
  touchDragElement.value = event.currentTarget as HTMLElement
  draggedPrompt.value = prompt

  // 添加样式类防止变暗
  touchDragElement.value.classList.add('touch-active')

  // 阻止长按上下文菜单
  document.body.classList.add('touch-dragging-active')

  // 设置长按计时器
  longPressTimer.value = window.setTimeout(() => {
    if (!touchMoved.value) {
      startTouchDrag(prompt)
    }
  }, LONG_PRESS_DURATION)
}

function startTouchDrag(prompt: TavernPromptItem) {
  if (!touchDragElement.value) return

  isTouchDragging.value = true
  isDragging.value = true

  // 创建拖动时的克隆元素
  const rect = touchDragElement.value.getBoundingClientRect()
  const clone = touchDragElement.value.cloneNode(true) as HTMLElement
  clone.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    z-index: 9999;
    opacity: 0.95;
    pointer-events: none;
    box-shadow: 0 8px 32px rgba(139, 92, 246, 0.5);
    transform: scale(1.02);
    border: 2px solid var(--accent-color, #8b5cf6);
    border-radius: 6px;
    background: var(--bg-tertiary, #252536);
  `
  clone.classList.add('touch-dragging-clone')
  document.body.appendChild(clone)
  touchClone.value = clone

  // 触发震动反馈（如果支持）
  if (navigator.vibrate) {
    navigator.vibrate(50)
  }

  console.log('[TavernPresetTab] 开始触摸拖动:', prompt.name)
}

function handleTouchMove(event: TouchEvent, prompt: TavernPromptItem) {
  const touch = event.touches[0]
  const deltaX = Math.abs(touch.clientX - touchStartX.value)
  const deltaY = Math.abs(touch.clientY - touchStartY.value)

  // 如果还没开始拖动
  if (!isTouchDragging.value) {
    // 检查是否移动了足够距离来取消长按
    if (deltaX > 10 || deltaY > 10) {
      touchMoved.value = true
      // 取消长按计时器
      if (longPressTimer.value) {
        clearTimeout(longPressTimer.value)
        longPressTimer.value = null
      }
    }
    return
  }

  // 已经在拖动中，阻止默认滚动行为
  event.preventDefault()

  // 更新克隆元素位置
  if (touchClone.value) {
    const initialRect = touchDragElement.value?.getBoundingClientRect()
    if (initialRect) {
      touchClone.value.style.top = `${touch.clientY - initialRect.height / 2}px`
      touchClone.value.style.left = `${touch.clientX - initialRect.width / 2}px`
    }
  }

  // 临时隐藏克隆元素以检测下方元素
  if (touchClone.value) {
    touchClone.value.style.display = 'none'
  }

  // 检测当前触摸位置下的元素
  const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY)

  // 恢复克隆元素显示
  if (touchClone.value) {
    touchClone.value.style.display = ''
  }

  const targetElement = elementsAtPoint.find(el =>
    el.classList.contains('prompt-item') && el !== touchDragElement.value
  ) as HTMLElement | undefined

  if (targetElement) {
    // 找到对应的 prompt
    const allItems = Array.from(promptsListRef.value?.querySelectorAll('.prompt-item') || [])
    const targetIndex = allItems.indexOf(targetElement)
    if (targetIndex >= 0 && filteredPrompts.value[targetIndex]) {
      const newTargetId = filteredPrompts.value[targetIndex].identifier
      if (dragOverPromptId.value !== newTargetId) {
        dragOverPromptId.value = newTargetId
        // 轻微震动反馈
        if (navigator.vibrate) {
          navigator.vibrate(10)
        }
      }
    }
  } else {
    dragOverPromptId.value = null
  }
}

async function handleTouchEnd(event: TouchEvent, prompt: TavernPromptItem) {
  // 清除长按计时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  // 如果没有拖动
  if (!isTouchDragging.value) {
    const timeDiff = Date.now() - touchStartTime.value
    // 短按且没有移动，触发展开/折叠
    if (timeDiff < LONG_PRESS_DURATION && !touchMoved.value) {
      togglePromptExpand(prompt)
    }
    resetTouchState()
    return
  }

  // 移除克隆元素
  if (touchClone.value) {
    touchClone.value.remove()
    touchClone.value = null
  }

  // 执行排序
  if (draggedPrompt.value && dragOverPromptId.value && activePreset.value) {
    const targetPrompt = filteredPrompts.value.find(p => p.identifier === dragOverPromptId.value)
    if (targetPrompt && draggedPrompt.value.identifier !== targetPrompt.identifier) {
      console.log('[TavernPresetTab] 执行触摸排序')
      await executeReorder(draggedPrompt.value, targetPrompt)
    }
  }

  resetTouchState()
}

function handleTouchCancel() {
  // 清除长按计时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  // 移除克隆元素
  if (touchClone.value) {
    touchClone.value.remove()
    touchClone.value = null
  }

  resetTouchState()
}

function resetTouchState() {
  // 移除样式类
  if (touchDragElement.value) {
    touchDragElement.value.classList.remove('touch-active')
  }
  document.body.classList.remove('touch-dragging-active')

  isTouchDragging.value = false
  isDragging.value = false
  draggedPrompt.value = null
  dragOverPromptId.value = null
  touchDragElement.value = null
  touchMoved.value = false
}

// 提取排序逻辑为独立函数
async function executeReorder(sourcePrompt: TavernPromptItem, targetPrompt: TavernPromptItem) {
  if (!activePreset.value) return

  console.log('[TavernPresetTab] 执行排序:', {
    from: sourcePrompt.name,
    to: targetPrompt.name
  })

  try {
    // 获取当前的排序列表
    const orderedPrompts = [...activePreset.value.orderedPrompts]

    // 找到拖动项和目标项的索引
    const fromIndex = orderedPrompts.findIndex(p => p.identifier === sourcePrompt.identifier)
    const toIndex = orderedPrompts.findIndex(p => p.identifier === targetPrompt.identifier)

    if (fromIndex === -1 || toIndex === -1) {
      console.error('[TavernPresetTab] 未找到拖动项或目标项')
      return
    }

    // 执行移动
    const [movedItem] = orderedPrompts.splice(fromIndex, 1)
    orderedPrompts.splice(toIndex, 0, movedItem)

    // 更新 promptOrder 数组
    const updatedPromptOrder = orderedPrompts.map(p => ({
      identifier: p.identifier,
      enabled: p.enabled
    }))

    // 保存到数据库
    const plainUpdates = JSON.parse(JSON.stringify({
      orderedPrompts,
      promptOrder: updatedPromptOrder
    }))

    await tavernPresetService.updatePreset(activePreset.value.id, plainUpdates)

    console.log('[TavernPresetTab] 排序已保存')

    // 刷新预设
    await refreshPresets()

    // 触发震动反馈表示成功
    if (navigator.vibrate) {
      navigator.vibrate(30)
    }

  } catch (error) {
    console.error('[TavernPresetTab] 保存排序失败:', error)
    alert('保存排序失败: ' + (error instanceof Error ? error.message : String(error)))
  }
}

async function handleDrop(event: DragEvent, targetPrompt: TavernPromptItem) {
  event.preventDefault()

  if (!draggedPrompt.value || !activePreset.value) {
    dragOverPromptId.value = null
    return
  }

  // 如果拖到自己身上，忽略
  if (draggedPrompt.value.identifier === targetPrompt.identifier) {
    dragOverPromptId.value = null
    return
  }

  // 使用共享的排序逻辑
  await executeReorder(draggedPrompt.value, targetPrompt)
  dragOverPromptId.value = null
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
  if (!activePreset.value || !viewingPrompt.value) {
    console.error('[TavernPresetTab] 保存失败: activePreset 或 viewingPrompt 为空', {
      activePreset: !!activePreset.value,
      viewingPrompt: !!viewingPrompt.value
    })
    return
  }

  isSavingPrompt.value = true
  console.log('[TavernPresetTab] 开始保存提示词:', {
    identifier: editingPromptData.value.identifier,
    name: editingPromptData.value.name,
    promptsCount: activePreset.value.prompts.length,
    orderedPromptsCount: activePreset.value.orderedPrompts.length
  })

  try {
    // 找到并更新对应的提示词
    const promptIndex = activePreset.value.prompts.findIndex(
      p => p.identifier === editingPromptData.value.identifier
    )

    console.log('[TavernPresetTab] 在 prompts 中查找结果:', {
      promptIndex,
      searchingFor: editingPromptData.value.identifier,
      availableIdentifiers: activePreset.value.prompts.map(p => p.identifier)
    })

    if (promptIndex === -1) {
      console.error('[TavernPresetTab] 未找到要编辑的提示词，identifier:', editingPromptData.value.identifier)
      // 显示错误提示给用户
      alert('保存失败：未找到要编辑的提示词，请刷新页面后重试')
      isSavingPrompt.value = false  // 重置保存状态！
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
    // 重要：需要将响应式代理对象转换为纯对象，否则 IndexedDB 无法克隆
    const plainUpdates = JSON.parse(JSON.stringify({
      prompts: updatedPrompts,
      orderedPrompts: updatedOrderedPrompts,
      rawData: updatedRawData,
      stats: updatedStats,
    }))

    console.log('[TavernPresetTab] 准备保存到数据库:', {
      presetId: activePreset.value.id,
      updatedPromptsCount: plainUpdates.prompts.length,
      updatedOrderedPromptsCount: plainUpdates.orderedPrompts.length,
      rawDataPromptsCount: plainUpdates.rawData?.prompts?.length
    })

    await tavernPresetService.updatePreset(activePreset.value.id, plainUpdates)

    console.log('[TavernPresetTab] 数据库保存成功')

    // 更新本地状态
    viewingPrompt.value = updatedPrompts[promptIndex]
    isEditingPrompt.value = false

    // 刷新预设列表
    await refreshPresets()

    console.log('[TavernPresetTab] 提示词已更新:', editingPromptData.value.name)
  } catch (error) {
    console.error('[TavernPresetTab] 保存提示词失败:', error)
    // 显示错误提示给用户
    alert('保存提示词失败: ' + (error instanceof Error ? error.message : String(error)))
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

// 创建新的提示词条目
async function createNewPrompt() {
  if (!activePreset.value || !newPromptData.value.name.trim()) {
    return
  }

  isCreatingPrompt.value = true

  try {
    // 生成唯一标识符
    const identifier = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 创建新条目
    const newPrompt: TavernPromptItem = {
      identifier,
      name: newPromptData.value.name.trim(),
      enabled: newPromptData.value.enabled,
      injection_position: newPromptData.value.injection_position,
      injection_depth: newPromptData.value.injection_depth,
      injection_order: 0,
      role: newPromptData.value.role,
      content: newPromptData.value.content,
      system_prompt: newPromptData.value.role === 'system',
      marker: false,
    }

    // 更新 prompts 数组
    const updatedPrompts = [...activePreset.value.prompts, newPrompt]

    // 更新 orderedPrompts 数组（添加到末尾）
    const updatedOrderedPrompts = [...activePreset.value.orderedPrompts, newPrompt]

    // 更新 promptOrder 数组
    const updatedPromptOrder = [
      ...activePreset.value.promptOrder,
      { identifier, enabled: newPromptData.value.enabled }
    ]

    // 更新统计信息
    const updatedStats = {
      ...activePreset.value.stats,
      totalPrompts: updatedPrompts.length,
      enabledPrompts: updatedOrderedPrompts.filter(p => p.enabled && !p.marker).length,
    }

    // 保存到数据库
    const plainUpdates = JSON.parse(JSON.stringify({
      prompts: updatedPrompts,
      orderedPrompts: updatedOrderedPrompts,
      promptOrder: updatedPromptOrder,
      stats: updatedStats,
    }))

    await tavernPresetService.updatePreset(activePreset.value.id, plainUpdates)

    console.log('[TavernPresetTab] 新条目已创建:', newPrompt.name)

    // 重置表单
    newPromptData.value = {
      name: '',
      role: 'system',
      enabled: true,
      injection_position: 0,
      injection_depth: 4,
      content: '',
    }

    // 关闭模态框
    showCreatePromptModal.value = false

    // 刷新预设列表
    await refreshPresets()

  } catch (error) {
    console.error('[TavernPresetTab] 创建条目失败:', error)
    alert('创建条目失败: ' + (error instanceof Error ? error.message : String(error)))
  } finally {
    isCreatingPrompt.value = false
  }
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

  // 检测是否为移动设备
  isMobile.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  console.log('[TavernPresetTab] 移动设备检测:', isMobile.value)
})

onUnmounted(() => {
  // 清理触摸拖动相关资源
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
  }
  if (touchClone.value) {
    touchClone.value.remove()
  }
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

.action-btn.add-btn {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  flex-shrink: 0;
}

.action-btn.add-btn:hover {
  background: linear-gradient(135deg, #16a34a, #15803d);
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
  /* 禁用移动端默认的触摸高亮 */
  -webkit-tap-highlight-color: transparent !important;
  -webkit-touch-callout: none !important;
  /* 禁用用户选择 */
  -webkit-user-select: none;
  user-select: none;
}

/* 触摸时防止变暗 */
.prompt-item.touch-active {
  background: var(--bg-tertiary, #252536) !important;
  opacity: 1 !important;
}

.prompt-item:active {
  /* 覆盖默认的 :active 状态样式 */
  background: var(--bg-tertiary, #252536);
}

.prompt-item:hover {
  background: rgba(139, 92, 246, 0.1);
}

.prompt-item.dragging,
.prompt-item.touch-dragging {
  opacity: 0.3;
  background: rgba(139, 92, 246, 0.2);
  border: 2px dashed var(--accent-color, #8b5cf6);
  transform: scale(0.98);
}

.prompt-item.drag-over {
  border-top: 3px solid var(--accent-color, #8b5cf6);
  background: rgba(139, 92, 246, 0.15);
}

/* 触摸拖动克隆元素样式 */
.touch-dragging-clone {
  background: var(--bg-tertiary, #252536) !important;
  border: 2px solid var(--accent-color, #8b5cf6) !important;
  border-radius: 6px !important;
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

.drag-handle {
  font-size: 14px;
  color: var(--text-secondary, #666);
  cursor: grab;
  user-select: none;
  padding: 4px 8px;
  opacity: 0.5;
  transition: opacity 0.2s ease;
  letter-spacing: 2px;
  /* 移动端增大触摸区域 */
  min-width: 32px;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

.prompt-item:hover .drag-handle,
.prompt-item:active .drag-handle {
  opacity: 1;
}

.drag-handle:active {
  cursor: grabbing;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .drag-handle {
    opacity: 0.8;
    min-width: 44px;
    min-height: 44px;
    font-size: 18px;
  }

  .prompt-item {
    /* 禁用移动端的默认触摸行为 */
    touch-action: manipulation;
    -webkit-user-select: none !important;
    user-select: none !important;
    /* 禁用长按菜单 */
    -webkit-touch-callout: none !important;
    /* 禁用触摸高亮 */
    -webkit-tap-highlight-color: transparent !important;
  }

  /* 移动端触摸时保持原样 */
  .prompt-item:active,
  .prompt-item.touch-active {
    background: var(--bg-tertiary, #252536) !important;
    opacity: 1 !important;
    filter: none !important;
  }

  .prompt-item.dragging,
  .prompt-item.touch-dragging {
    opacity: 0.25 !important;
  }

  .prompt-item-header {
    min-height: 48px;
  }
}

/* 触摸拖动时的全局样式 */
body.touch-dragging-active {
  overflow: hidden;
  touch-action: none;
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}

/* 防止触摸时元素变暗 */
body.touch-dragging-active * {
  -webkit-tap-highlight-color: transparent !important;
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

/* 宏变量帮助区域 */
.macro-help-section {
  margin-bottom: 20px;
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid var(--border-color, #333);
  border-radius: 12px;
  overflow: hidden;
}

.macro-help-section .section-header {
  padding: 12px 16px;
  margin: 0;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  cursor: pointer;
}

.macro-help-section .section-header h4 {
  color: white;
}

.macro-help-content {
  padding: 16px;
}

.macro-category {
  margin-bottom: 16px;
}

.macro-category h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--text-primary, #fff);
}

.macro-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.macro-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg-tertiary, #252536);
  border-radius: 6px;
}

.macro-item code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  padding: 2px 8px;
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  border-radius: 4px;
  white-space: nowrap;
}

.macro-item span {
  font-size: 13px;
  color: var(--text-secondary, #888);
}

.macro-tip {
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.1);
  border-left: 3px solid #f59e0b;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary, #fff);
}

.macro-tip strong {
  color: #f59e0b;
}

/* 深度提示 */
.depth-hint {
  font-size: 12px;
  color: var(--text-secondary, #888);
  margin-left: 8px;
}

/* 宏提示 */
.macro-hints {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-secondary, #888);
}

.macro-hints code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 11px;
  padding: 1px 6px;
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  border-radius: 3px;
  margin-right: 4px;
}
</style>
