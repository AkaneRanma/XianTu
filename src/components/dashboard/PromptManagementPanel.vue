<template>
  <div class="prompt-panel">
    <!-- 面板头部 -->
    <div class="panel-header compact">
      <button class="back-btn" @click="goBack" title="返回">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <div class="panel-title-compact">
        <span class="title-text">📝 提示词管理</span>
      </div>
      <div class="panel-actions">
        <button class="action-btn-compact" @click="showGlobalSettings = true" title="全局设置">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- 标签页导航 -->
    <div class="tabs-nav">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <!-- 标签页内容 -->
    <div class="tabs-content">
      <!-- 提示词编辑 -->
      <div v-if="activeTab === 'prompts'" class="tab-panel">
        <div class="prompts-toolbar">
          <button class="toolbar-btn" @click="expandAllCategories" title="全部展开">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            展开
          </button>
          <button class="toolbar-btn" @click="collapseAllCategories" title="全部折叠">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
            折叠
          </button>
          <button class="toolbar-btn" @click="exportPrompts" title="导出全部">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            导出
          </button>
          <button class="toolbar-btn" @click="importPrompts" title="导入">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            导入
          </button>
          <button class="toolbar-btn primary" @click="saveAll" title="保存全部">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            保存
          </button>
        </div>

        <div class="prompt-list">
          <div v-for="(categoryData, categoryKey) in promptsByCategory" :key="categoryKey" class="category-section">
            <div class="category-header" @click="toggleCategory(String(categoryKey))">
              <div class="category-title">
                <span class="category-icon">{{ categoryData.info.icon }}</span>
                <span class="category-name">{{ categoryData.info.name }}</span>
                <span class="category-count">{{ categoryData.prompts.length }}</span>
              </div>
              <div class="category-actions">
                <span class="category-desc">{{ categoryData.info.description }}</span>
                <svg
                    class="expand-icon"
                    :class="{ expanded: expandedCategories[String(categoryKey)] }"
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
            <div v-if="expandedCategories[String(categoryKey)]" class="category-content">
              <div v-for="prompt in categoryData.prompts" :key="prompt.key" class="prompt-item">
                <div class="prompt-header" @click="togglePrompt(prompt.key)">
                  <div class="prompt-title-area">
                    <span v-if="String(categoryKey) === 'coreRequest' && prompt.order" class="prompt-order">
                      {{ prompt.order }}
                    </span>
                    <span class="prompt-title">{{ prompt.name }}</span>
                  </div>
                  <div class="prompt-meta">
                    <span v-if="prompt.description" class="prompt-desc" :title="prompt.description">
                      {{ truncateText(prompt.description, 30) }}
                    </span>
                    <span class="prompt-status" :class="{ modified: prompt.modified }">
                      {{ prompt.modified ? '已修改' : '默认' }}
                    </span>
                  </div>
                </div>
                <div v-if="expandedPrompts[prompt.key]" class="prompt-content">
                  <div v-if="prompt.description" class="prompt-description-full">
                    {{ prompt.description }}
                  </div>
                  <textarea
                    v-model="prompt.content"
                    @input="markModified(prompt.key)"
                    rows="20"
                    class="prompt-textarea"
                  ></textarea>
                  <div class="prompt-actions">
                    <button class="btn-small" @click="resetPrompt(prompt.key)">重置为默认</button>
                    <button class="btn-small" @click="exportSingle(prompt.key)">导出此项</button>
                    <button class="btn-small btn-primary" @click="saveSingle(prompt.key)">保存修改</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 发送预览 -->
      <div v-else-if="activeTab === 'preview'" class="tab-panel">
        <SendPreviewTab />
      </div>

      <!-- 酒馆预设 -->
      <div v-else-if="activeTab === 'tavern'" class="tab-panel tavern-panel">
        <TavernPresetTab />
      </div>

      <!-- 世界书 -->
      <div v-else-if="activeTab === 'worldbook'" class="tab-panel">
        <WorldBookTab />
      </div>

      <!-- 正文优化 -->
      <div v-else-if="activeTab === 'optimization'" class="tab-panel">
        <TextOptimizationTab />
      </div>

      <!-- 记忆设置 -->
      <div v-else-if="activeTab === 'memory'" class="tab-panel">
        <MemoryPromptConfig />
      </div>
    </div>

    <!-- 全局设置弹窗 -->
    <div v-if="showGlobalSettings" class="modal-overlay" @click.self="showGlobalSettings = false">
      <div class="global-settings-modal">
        <div class="modal-header">
          <h3>全局设置</h3>
          <button class="close-btn" @click="showGlobalSettings = false">×</button>
        </div>
        <div class="modal-body">
          <GlobalSettingsManager />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { promptStorage, type PromptsByCategory } from '@/services/promptStorage';
import { toast } from '@/utils/toast';

// 子组件
import SendPreviewTab from './prompt-management/SendPreviewTab.vue';
import TavernPresetTab from './prompt-management/TavernPresetTab.vue';
import WorldBookTab from './prompt-management/WorldBookTab.vue';
import TextOptimizationTab from './prompt-management/TextOptimizationTab.vue';
import MemoryPromptConfig from './prompt-management/MemoryPromptConfig.vue';
import GlobalSettingsManager from './prompt-management/GlobalSettingsManager.vue';

const router = useRouter();

// 标签页配置
const tabs = [
  { key: 'prompts', label: '提示词', icon: '📝' },
  { key: 'preview', label: '发送预览', icon: '👁️' },
  { key: 'tavern', label: '酒馆预设', icon: '🍺' },
  { key: 'worldbook', label: '世界书', icon: '📚' },
  { key: 'optimization', label: '正文优化', icon: '✨' },
  { key: 'memory', label: '记忆设置', icon: '🧠' },
];

const activeTab = ref('prompts');
const showGlobalSettings = ref(false);

// 提示词相关状态
const promptsByCategory = ref<PromptsByCategory>({});
const expandedPrompts = ref<Record<string, boolean>>({});
const expandedCategories = ref<Record<string, boolean>>({});

onMounted(async () => {
  await loadPrompts();
});

async function loadPrompts() {
  promptsByCategory.value = await promptStorage.loadByCategory();
  const firstCategory = Object.keys(promptsByCategory.value)[0];
  if (firstCategory) {
    expandedCategories.value[firstCategory] = true;
  }
}

function goBack() {
  const currentPath = router.currentRoute.value.path;
  if (currentPath === '/prompts') {
    router.push('/');
  } else {
    router.push('/game/settings');
  }
}

function toggleCategory(categoryKey: string) {
  expandedCategories.value[categoryKey] = !expandedCategories.value[categoryKey];
}

function togglePrompt(key: string) {
  expandedPrompts.value[key] = !expandedPrompts.value[key];
}

function expandAllCategories() {
  for (const key in promptsByCategory.value) {
    expandedCategories.value[key] = true;
  }
}

function collapseAllCategories() {
  for (const key in promptsByCategory.value) {
    expandedCategories.value[key] = false;
  }
  expandedPrompts.value = {};
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function markModified(key: string) {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      prompt.modified = prompt.content !== prompt.default;
      break;
    }
  }
}

async function saveSingle(key: string) {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      await promptStorage.save(key, prompt.content);
      toast.success(`已保存: ${prompt.name}`);
      break;
    }
  }
}

async function saveAll() {
  let savedCount = 0;
  for (const categoryKey in promptsByCategory.value) {
    for (const prompt of promptsByCategory.value[categoryKey].prompts) {
      if (prompt.modified) {
        await promptStorage.save(prompt.key, prompt.content);
        savedCount++;
      }
    }
  }
  if (savedCount > 0) {
    toast.success(`已保存 ${savedCount} 项修改`);
  } else {
    toast.info('没有需要保存的修改');
  }
}

async function resetPrompt(key: string) {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      prompt.content = prompt.default;
      prompt.modified = false;
      await promptStorage.reset(key);
      toast.info(`已重置: ${prompt.name}`);
      break;
    }
  }
}

function exportSingle(key: string) {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      const data = { [key]: prompt.content };
      downloadJSON(data, `prompt_${key}.json`);
      break;
    }
  }
}

async function exportPrompts() {
  const data = await promptStorage.exportAll();
  downloadJSON(data, 'prompts_all.json');
  toast.success('已导出全部提示词');
}

function importPrompts() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const count = await promptStorage.importPrompts(data);
      await loadPrompts();
      toast.success(`成功导入 ${count} 个提示词`);
    } catch {
      toast.error('导入失败，请检查文件格式');
    }
  };
  input.click();
}

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.prompt-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-background, #0f1117);
}

.panel-header.compact {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(30, 35, 45, 0.95);
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #4a9eff;
}

.panel-title-compact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.title-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn-compact:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(74, 158, 255, 0.5);
  color: #4a9eff;
}

/* 标签页导航 */
.tabs-nav {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(20, 25, 35, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  overflow-x: auto;
  flex-shrink: 0;
}

.tabs-nav::-webkit-scrollbar {
  height: 4px;
}

.tabs-nav::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.tabs-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}

.tab-btn.active {
  background: rgba(74, 158, 255, 0.15);
  border-color: rgba(74, 158, 255, 0.4);
  color: #4a9eff;
}

.tab-icon {
  font-size: 14px;
}

.tab-label {
  font-weight: 500;
}

/* 标签页内容 */
.tabs-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tab-panel {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.tab-panel::-webkit-scrollbar {
  width: 6px;
}

.tab-panel::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.tab-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

/* 提示词工具栏 */
.prompts-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.toolbar-btn.primary {
  background: rgba(74, 158, 255, 0.15);
  border-color: rgba(74, 158, 255, 0.3);
  color: #4a9eff;
}

.toolbar-btn.primary:hover {
  background: rgba(74, 158, 255, 0.25);
  border-color: rgba(74, 158, 255, 0.5);
}

/* 提示词列表 */
.prompt-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-section {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(30, 35, 45, 0.6);
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.category-header:hover {
  background: rgba(0, 0, 0, 0.3);
}

.category-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.category-icon {
  font-size: 1.1rem;
}

.category-name {
  font-weight: 600;
  font-size: 13px;
  color: #fff;
}

.category-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
}

.category-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.expand-icon {
  transition: transform 0.3s ease;
  color: rgba(255, 255, 255, 0.5);
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.category-content {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.prompt-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.prompt-item:last-child {
  border-bottom: none;
}

.prompt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.prompt-header:hover {
  background: rgba(255, 255, 255, 0.03);
}

.prompt-title-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.prompt-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  background: #4a9eff;
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 5px;
}

.prompt-title {
  font-weight: 500;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
}

.prompt-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.prompt-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-status {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

.prompt-status.modified {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.prompt-content {
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.15);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.prompt-description-full {
  margin-bottom: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
}

.prompt-textarea {
  width: 100%;
  min-height: 300px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
}

.prompt-textarea:focus {
  outline: none;
  border-color: rgba(74, 158, 255, 0.5);
}

.prompt-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  justify-content: flex-end;
}

.btn-small {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
}

.btn-small:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.btn-small.btn-primary {
  background: rgba(74, 158, 255, 0.2);
  color: #4a9eff;
  border-color: rgba(74, 158, 255, 0.3);
}

.btn-small.btn-primary:hover {
  background: rgba(74, 158, 255, 0.3);
  border-color: rgba(74, 158, 255, 0.5);
}

/* 全局设置弹窗 */
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

.global-settings-modal {
  background: #1e2330;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  width: 600px;
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

/* 酒馆预设面板特殊样式 */
.tab-panel.tavern-panel {
  padding: 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .tabs-nav {
    padding: 6px 8px;
    gap: 2px;
  }

  .tab-btn {
    padding: 6px 10px;
    font-size: 11px;
  }

  .tab-icon {
    font-size: 12px;
  }

  .category-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .category-actions {
    width: 100%;
    justify-content: space-between;
  }

  .prompt-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .prompt-meta {
    width: 100%;
    justify-content: space-between;
  }

  .prompt-desc {
    max-width: 120px;
  }

  .prompt-textarea {
    min-height: 200px;
  }

  .prompts-toolbar {
    gap: 4px;
  }

  .toolbar-btn {
    padding: 4px 8px;
    font-size: 10px;
  }
}
</style>
