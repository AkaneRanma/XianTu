<template>
  <div class="world-book-tab">
    <!-- 工具栏 -->
    <div class="toolbar">
      <button class="add-btn" @click="addEntry">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        添加条目
      </button>
      <div class="toolbar-right">
        <button class="import-btn" @click="showImportDialog = true">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
          </svg>
          导入
        </button>
        <button class="export-btn" @click="exportWorldBook">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
          </svg>
          导出
        </button>
      </div>
    </div>

    <!-- 条目列表 -->
    <div class="entries-container">
      <div v-if="entries.length === 0" class="empty-state">
        <div class="empty-icon">📚</div>
        <p>暂无世界书条目</p>
        <p class="empty-hint">点击"添加条目"或"导入"开始使用</p>
      </div>

      <div
        v-for="entry in entries"
        :key="entry.id"
        class="entry-card"
        :class="{ disabled: !entry.enabled }"
      >
        <div class="entry-header">
          <div class="entry-left">
            <label class="toggle-switch">
              <input type="checkbox" v-model="entry.enabled" @change="saveEntries" />
              <span class="toggle-slider"></span>
            </label>
            <input
              type="text"
              v-model="entry.name"
              class="entry-name-input"
              placeholder="条目名称"
              @blur="saveEntries"
            />
          </div>
          <div class="entry-actions">
            <button class="action-btn-fancy edit" @click="toggleEditEntry(entry)" :title="editingId === entry.id ? '收起' : '编辑'">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
            <button class="action-btn-fancy delete" @click="deleteEntry(entry.id)" title="删除">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 编辑区域 -->
        <div v-if="editingId === entry.id" class="entry-edit">
          <div class="edit-row">
            <label>角色</label>
            <select v-model="entry.role" @change="saveEntries" class="role-select">
              <option value="system">System</option>
              <option value="user">User</option>
              <option value="assistant">Assistant</option>
            </select>
          </div>
          <div class="edit-row">
            <label>深度</label>
            <input type="number" v-model.number="entry.depth" min="0" max="10" @change="saveEntries" class="depth-input" />
          </div>
          <div class="edit-row">
            <label>触发模式</label>
            <select v-model="entry.triggerMode" @change="saveEntries" class="trigger-select">
              <option value="always">始终触发</option>
              <option value="keyword">关键词触发</option>
            </select>
          </div>
          <div v-if="entry.triggerMode === 'keyword'" class="edit-row">
            <label>关键词</label>
            <input
              type="text"
              :value="entry.keywords.join(', ')"
              @blur="updateKeywords(entry, $event)"
              class="keywords-input"
              placeholder="多个关键词用逗号分隔"
            />
          </div>
          <div class="edit-row targets-row">
            <label>作用场景</label>
            <div class="target-checkboxes">
              <label class="target-checkbox">
                <input type="checkbox" :checked="entry.targets.includes('text')" @change="toggleTarget(entry, 'text')" />
                <span>正文生成</span>
              </label>
              <label class="target-checkbox">
                <input type="checkbox" :checked="entry.targets.includes('variable')" @change="toggleTarget(entry, 'variable')" />
                <span>变量生成</span>
              </label>
              <label class="target-checkbox">
                <input type="checkbox" :checked="entry.targets.includes('optimization')" @change="toggleTarget(entry, 'optimization')" />
                <span>正文优化</span>
              </label>
              <label class="target-checkbox">
                <input type="checkbox" :checked="entry.targets.includes('opening_text')" @change="toggleTarget(entry, 'opening_text')" />
                <span>开局正文</span>
              </label>
              <label class="target-checkbox">
                <input type="checkbox" :checked="entry.targets.includes('opening_variable')" @change="toggleTarget(entry, 'opening_variable')" />
                <span>开局变量</span>
              </label>
            </div>
          </div>
          <div class="edit-row content-row">
            <label>内容</label>
            <textarea
              v-model="entry.content"
              @blur="saveEntries"
              class="content-textarea"
              placeholder="输入提示词内容..."
              rows="10"
            ></textarea>
          </div>
        </div>

        <!-- 预览区域 -->
        <div v-else class="entry-preview">
          <div class="preview-tags">
            <span class="tag role-tag" :class="entry.role">{{ getRoleLabel(entry.role) }}</span>
            <span class="tag depth-tag">深度: {{ entry.depth }}</span>
            <span v-for="target in entry.targets" :key="target" class="tag target-tag">
              {{ getTargetLabel(target) }}
            </span>
          </div>
          <div class="preview-content">{{ truncateContent(entry.content) }}</div>
        </div>
      </div>
    </div>

    <!-- 导入对话框 -->
    <div v-if="showImportDialog" class="modal-overlay" @click.self="showImportDialog = false">
      <div class="import-modal">
        <div class="modal-header">
          <h3>导入世界书</h3>
          <button class="close-btn" @click="showImportDialog = false">×</button>
        </div>
        <div class="modal-body">
          <div class="import-tabs">
            <button
              class="import-tab"
              :class="{ active: importMode === 'file' }"
              @click="importMode = 'file'"
            >文件导入</button>
            <button
              class="import-tab"
              :class="{ active: importMode === 'paste' }"
              @click="importMode = 'paste'"
            >粘贴JSON</button>
          </div>

          <div v-if="importMode === 'file'" class="import-file">
            <input
              type="file"
              ref="fileInputEl"
              accept=".json"
              @change="handleFileSelect"
              style="display: none"
            />
            <button class="select-file-btn" @click="triggerFileInput">
              选择JSON文件
            </button>
            <p class="import-hint">支持酒馆世界书格式和自定义格式</p>
          </div>

          <div v-else class="import-paste">
            <textarea
              v-model="importJson"
              class="import-textarea"
              placeholder="粘贴世界书JSON内容..."
              rows="10"
            ></textarea>
          </div>

          <div class="import-options">
            <label class="option-checkbox">
              <input type="checkbox" v-model="importMerge" />
              <span>合并模式（保留现有条目）</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" @click="showImportDialog = false">取消</button>
          <button class="confirm-btn" @click="doImport" :disabled="importMode === 'paste' && !importJson.trim()">
            导入
          </button>
        </div>
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
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  promptPreviewService,
  type WorldBookEntry,
  type WorldBookTarget
} from '@/services/promptPreviewService';
import { toast } from '@/utils/toast';

const entries = ref<WorldBookEntry[]>([]);
const showScrollTop = ref(false);
const tabPanelRef = ref<HTMLElement | null>(null);
const editingId = ref<string | null>(null);
const showImportDialog = ref(false);
const importMode = ref<'file' | 'paste'>('file');
const importJson = ref('');
const importMerge = ref(true);
const fileInputEl = ref<HTMLInputElement | null>(null);

// 触发文件选择
const triggerFileInput = () => {
  fileInputEl.value?.click();
};

// 加载条目
const loadEntries = () => {
  entries.value = promptPreviewService.getWorldBookEntries();
};

// 保存条目
const saveEntries = () => {
  promptPreviewService.setWorldBookEntries(entries.value);
};

// 添加条目
const addEntry = () => {
  const newEntry = promptPreviewService.addWorldBookEntry({
    name: '新条目',
    content: '',
    role: 'system',
    enabled: true,
    depth: 4,
    triggerMode: 'always',
    keywords: [],
    order: entries.value.length,
    targets: ['text'],
  });
  entries.value.push(newEntry);
  editingId.value = newEntry.id;
};

// 删除条目
const deleteEntry = (id: string) => {
  if (confirm('确定要删除这个条目吗？')) {
    promptPreviewService.removeWorldBookEntry(id);
    entries.value = entries.value.filter(e => e.id !== id);
    if (editingId.value === id) {
      editingId.value = null;
    }
    toast.success('条目已删除');
  }
};

// 切换编辑状态
const toggleEditEntry = (entry: WorldBookEntry) => {
  editingId.value = editingId.value === entry.id ? null : entry.id;
};

// 更新关键词
const updateKeywords = (entry: WorldBookEntry, event: Event) => {
  const input = event.target as HTMLInputElement;
  entry.keywords = input.value.split(',').map(k => k.trim()).filter(k => k);
  saveEntries();
};

// 切换目标场景
const toggleTarget = (entry: WorldBookEntry, target: WorldBookTarget) => {
  const index = entry.targets.indexOf(target);
  if (index === -1) {
    entry.targets.push(target);
  } else if (entry.targets.length > 1) {
    entry.targets.splice(index, 1);
  }
  saveEntries();
};

// 获取角色标签
const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'system': return 'SYS';
    case 'user': return 'USR';
    case 'assistant': return 'AST';
    default: return role;
  }
};

// 获取目标标签
const getTargetLabel = (target: WorldBookTarget): string => {
  switch (target) {
    case 'text': return '正文';
    case 'variable': return '变量';
    case 'optimization': return '优化';
    case 'opening_text': return '开局正文';
    case 'opening_variable': return '开局变量';
    default: return target;
  }
};

// 截断内容
const truncateContent = (content: string): string => {
  const maxLength = 100;
  if (content.length > maxLength) {
    return content.substring(0, maxLength) + '...';
  }
  return content || '(无内容)';
};

// 导出世界书
const exportWorldBook = () => {
  const data = promptPreviewService.exportWorldBook();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `worldbook-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('世界书已导出');
};

// 处理文件选择
const handleFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const content = await file.text();
    const count = promptPreviewService.importTavernWorldBook(content);
    loadEntries();
    showImportDialog.value = false;
    toast.success(`成功导入 ${count} 个条目`);
  } catch (error) {
    toast.error('导入失败：' + (error instanceof Error ? error.message : '格式错误'));
  }
  input.value = '';
};

// 执行导入
const doImport = () => {
  if (importMode.value === 'paste') {
    try {
      const count = promptPreviewService.importWorldBook(importJson.value);
      loadEntries();
      showImportDialog.value = false;
      importJson.value = '';
      toast.success(`成功导入 ${count} 个条目`);
    } catch (error) {
      toast.error('导入失败：' + (error instanceof Error ? error.message : '格式错误'));
    }
  }
};

// 获取滚动容器（父级 .tab-panel）
const getScrollContainer = (): HTMLElement | null => {
  if (tabPanelRef.value) return tabPanelRef.value;
  const el = document.querySelector('.tab-panel') as HTMLElement;
  tabPanelRef.value = el;
  return el;
};

// 处理滚动事件
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

onMounted(() => {
  loadEntries();
  // 延迟绑定滚动事件，确保 DOM 已渲染
  setTimeout(() => {
    const container = getScrollContainer();
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
  }, 100);
});

onUnmounted(() => {
  const container = getScrollContainer();
  if (container) {
    container.removeEventListener('scroll', handleScroll);
  }
});
</script>

<style scoped>
.world-book-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.add-btn,
.import-btn,
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

.add-btn {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.add-btn:hover {
  background: rgba(16, 185, 129, 0.25);
  border-color: rgba(16, 185, 129, 0.5);
}

.import-btn,
.export-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.import-btn:hover,
.export-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.entries-container {
  padding-right: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
}

.entry-card {
  background: rgba(30, 35, 45, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.entry-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
}

.entry-card.disabled {
  opacity: 0.5;
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
}

.entry-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.15);
  transition: .3s;
  border-radius: 20px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #10b981;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(16px);
}

.entry-name-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  padding: 4px 0;
  outline: none;
}

.entry-name-input:focus {
  border-bottom: 1px solid rgba(74, 158, 255, 0.5);
}

.entry-actions {
  display: flex;
  gap: 6px;
}

/* 高级游戏风格操作按钮 */
.action-btn-fancy {
  position: relative;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(4px);
  overflow: hidden;
}

.action-btn-fancy::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, transparent 100%);
  border-radius: 8px 8px 0 0;
  pointer-events: none;
}

.action-btn-fancy::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.15) 100%);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.action-btn-fancy:hover {
  background: linear-gradient(135deg, rgba(74, 158, 255, 0.15) 0%, rgba(74, 158, 255, 0.05) 100%);
  border-color: rgba(74, 158, 255, 0.35);
  color: #4a9eff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 158, 255, 0.15);
}

.action-btn-fancy:hover::after {
  opacity: 1;
}

.action-btn-fancy:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(74, 158, 255, 0.1);
}

.action-btn-fancy.edit:hover {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%);
  border-color: rgba(16, 185, 129, 0.35);
  color: #10b981;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
}

.action-btn-fancy.delete:hover {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%);
  border-color: rgba(239, 68, 68, 0.35);
  color: #ef4444;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
}

.entry-edit {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.edit-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.edit-row label {
  min-width: 70px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  padding-top: 6px;
}

.role-select,
.trigger-select,
.depth-input,
.keywords-input {
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
}

.role-select:focus,
.trigger-select:focus,
.depth-input:focus,
.keywords-input:focus {
  outline: none;
  border-color: rgba(74, 158, 255, 0.5);
}

.depth-input {
  width: 60px;
}

.keywords-input {
  flex: 1;
}

.targets-row {
  align-items: center;
}

.target-checkboxes {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.target-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.target-checkbox input {
  cursor: pointer;
}

.content-row {
  align-items: flex-start;
}

.content-textarea {
  flex: 1;
  width: 100%;
  min-height: 180px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.content-textarea:focus {
  outline: none;
  border-color: rgba(74, 158, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.1);
}

.content-textarea::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.entry-preview {
  padding: 10px 12px;
}

.preview-tags {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.role-tag.system {
  background: rgba(74, 158, 255, 0.2);
  color: #4a9eff;
}

.role-tag.user {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.role-tag.assistant {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.depth-tag {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.target-tag {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
}

.preview-content {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}

/* 导入对话框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.import-modal {
  background: #1e2330;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  width: 500px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: #fff;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #fff;
}

.modal-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.import-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.import-tab {
  flex: 1;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.import-tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

.import-tab.active {
  background: rgba(74, 158, 255, 0.15);
  border-color: rgba(74, 158, 255, 0.4);
  color: #4a9eff;
}

.import-file {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 30px;
}

.select-file-btn {
  padding: 12px 24px;
  background: rgba(74, 158, 255, 0.15);
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 8px;
  color: #4a9eff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.select-file-btn:hover {
  background: rgba(74, 158, 255, 0.25);
  border-color: rgba(74, 158, 255, 0.5);
}

.import-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.import-textarea {
  width: 100%;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  resize: vertical;
}

.import-textarea:focus {
  outline: none;
  border-color: rgba(74, 158, 255, 0.5);
}

.import-options {
  margin-top: 12px;
}

.option-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-btn,
.confirm-btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.confirm-btn {
  background: rgba(74, 158, 255, 0.2);
  border: 1px solid rgba(74, 158, 255, 0.4);
  color: #4a9eff;
}

.confirm-btn:hover:not(:disabled) {
  background: rgba(74, 158, 255, 0.3);
  border-color: rgba(74, 158, 255, 0.6);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 回顶按钮 */
.scroll-top-btn {
  position: fixed;
  bottom: 80px;
  right: 40px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(74, 158, 255, 0.2);
  border: 1px solid rgba(74, 158, 255, 0.4);
  color: #4a9eff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.scroll-top-btn:hover {
  background: rgba(74, 158, 255, 0.3);
  border-color: rgba(74, 158, 255, 0.6);
  transform: translateY(-2px);
}
</style>
