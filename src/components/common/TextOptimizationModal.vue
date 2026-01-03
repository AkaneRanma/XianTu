<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container">
        <!-- 头部 -->
        <div class="modal-header">
          <div class="header-left">
            <Sparkles :size="20" />
            <h3 class="modal-title">正文优化设置</h3>
          </div>
          <button class="close-btn" @click="handleClose">
            <X :size="20" />
          </button>
        </div>

        <!-- 内容区 -->
        <div class="modal-body">
          <!-- 工具栏 -->
          <div class="toolbar">
            <div class="toolbar-left">
              <button class="tool-btn" @click="addEntry">
                <Plus :size="16" />
                添加条目
              </button>
              <button class="tool-btn" @click="importPreset">
                <Upload :size="16" />
                导入预设
              </button>
              <button class="tool-btn" @click="exportPreset">
                <Download :size="16" />
                导出预设
              </button>
            </div>
            <div class="toolbar-right">
              <span class="entry-count">{{ enabledCount }}/{{ entries.length }} 条启用</span>
            </div>
          </div>

          <!-- 条目列表 -->
          <div class="entries-list">
            <div v-if="entries.length === 0" class="empty-state">
              <FileText :size="48" />
              <p>暂无优化条目</p>
              <span>点击"添加条目"或"导入预设"开始配置</span>
            </div>

            <div
              v-for="(entry, index) in entries"
              :key="entry.id"
              class="entry-card"
              :class="{ disabled: !entry.enabled }"
            >
              <div class="entry-header">
                <div class="entry-title-row">
                  <label class="switch small">
                    <input type="checkbox" v-model="entry.enabled" />
                    <span class="slider"></span>
                  </label>
                  <input
                    v-model="entry.name"
                    class="entry-name-input"
                    placeholder="条目名称"
                  />
                  <div class="entry-badges">
                    <span class="badge trigger" :class="entry.triggerMode === 'keyword' ? 'green' : 'blue'">
                      {{ entry.triggerMode === 'keyword' ? '🟢 关键词' : '🔵 始终' }}
                    </span>
                    <span class="badge role" :class="entry.role">
                      {{ getRoleLabel(entry.role) }}
                    </span>
                    <span class="badge depth">
                      深度: {{ entry.depth }}
                    </span>
                  </div>
                </div>
                <div class="entry-actions">
                  <button class="icon-btn" @click="toggleExpand(index)" :title="expandedIndex === index ? '收起' : '展开'">
                    <ChevronDown :size="16" :class="{ rotated: expandedIndex === index }" />
                  </button>
                  <button class="icon-btn danger" @click="removeEntry(index)" title="删除">
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>

              <!-- 展开的编辑区 -->
              <div v-if="expandedIndex === index" class="entry-body">
                <div class="form-row">
                  <label>角色类型</label>
                  <select v-model="entry.role" class="form-select">
                    <option value="system">System</option>
                    <option value="user">User</option>
                    <option value="assistant">Assistant</option>
                  </select>
                </div>
                <div class="form-row">
                  <label>注入深度</label>
                  <input
                    type="number"
                    v-model.number="entry.depth"
                    class="form-input small"
                    placeholder="4"
                    min="0"
                    max="100"
                  />
                </div>
                <div class="form-row">
                  <label>触发模式</label>
                  <select v-model="entry.triggerMode" class="form-select">
                    <option value="always">始终触发</option>
                    <option value="keyword">关键词触发</option>
                  </select>
                </div>
                <div class="form-row full" v-if="entry.triggerMode === 'keyword'">
                  <label>关键词（逗号分隔）</label>
                  <input
                    :value="entry.keywords?.join(', ')"
                    @input="updateKeywords(entry, $event)"
                    class="form-input"
                    placeholder="关键词1, 关键词2, ..."
                  />
                </div>
                <div class="form-row full">
                  <label>提示词内容</label>
                  <textarea
                    v-model="entry.content"
                    class="form-textarea"
                    placeholder="输入优化提示词..."
                    rows="6"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="handleClose">取消</button>
          <button class="btn btn-primary" @click="handleSave">保存</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Sparkles, X, Plus, Upload, Download, FileText, ChevronDown, Trash2 } from 'lucide-vue-next';
import { toast } from '@/utils/toast';
import { textOptimizationService } from '@/services/textOptimizationService';
import type { TextOptimizationEntry } from '@/types/textOptimization';
import { convertTavernWorldBook, createDefaultEntry } from '@/types/textOptimization';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

// 本地状态
const entries = ref<TextOptimizationEntry[]>([]);
const expandedIndex = ref<number | null>(null);
const presetName = ref('默认预设');

// 计算启用数量
const enabledCount = computed(() => entries.value.filter(e => e.enabled).length);

// 角色标签
const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'system': return 'System';
    case 'user': return 'User';
    case 'assistant': return 'Assistant';
    default: return role;
  }
};

// 更新关键词
const updateKeywords = (entry: TextOptimizationEntry, event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  entry.keywords = value.split(',').map(k => k.trim()).filter(k => k);
};

// 加载数据
const loadData = () => {
  const preset = textOptimizationService.getPreset();
  if (preset) {
    entries.value = JSON.parse(JSON.stringify(preset.entries));
    presetName.value = preset.name;
  } else {
    entries.value = [];
    presetName.value = '默认预设';
  }
};

// 监听打开状态
watch(() => props.open, (newVal) => {
  if (newVal) {
    loadData();
    expandedIndex.value = null;
  }
});

// 添加条目
const addEntry = () => {
  const newEntry = createDefaultEntry();
  newEntry.name = `新条目 ${entries.value.length + 1}`;
  newEntry.order = entries.value.length;
  entries.value.push(newEntry);
  expandedIndex.value = entries.value.length - 1;
};

// 删除条目
const removeEntry = (index: number) => {
  entries.value.splice(index, 1);
  if (expandedIndex.value === index) {
    expandedIndex.value = null;
  } else if (expandedIndex.value !== null && expandedIndex.value > index) {
    expandedIndex.value--;
  }
};

// 切换展开
const toggleExpand = (index: number) => {
  expandedIndex.value = expandedIndex.value === index ? null : index;
};

/**
 * 将 worldBooks 格式的条目转换为内部格式
 * worldBooks 格式: { name, content, triggerMode, keywords, role, enabled, depth, id }
 *
 * 酒馆 triggerMode 对照：
 * - 'blue' = 蓝色时钟 = 始终触发 (constant/always)
 * - 'green' = 绿色 = 关键词触发 (selective/keyword)
 * - 'keyword' = 关键词触发（兼容旧格式）
 */
const convertWorldBooksEntry = (entry: Record<string, unknown>): TextOptimizationEntry => {
  // 处理 triggerMode: 'green' 或 'keyword' 表示关键词触发，'blue' 表示始终触发
  const triggerMode = (entry.triggerMode === 'green' || entry.triggerMode === 'keyword') ? 'keyword' : 'always';

  // 处理 role
  let role: 'system' | 'user' | 'assistant' = 'system';
  if (entry.role === 'user') role = 'user';
  else if (entry.role === 'assistant') role = 'assistant';

  return {
    id: (entry.id as string) || `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: (entry.name as string) || '未命名条目',
    content: (entry.content as string) || '',
    role,
    enabled: entry.enabled !== false, // 默认启用
    depth: typeof entry.depth === 'number' ? entry.depth : 4,
    triggerMode,
    keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
    order: typeof entry.order === 'number' ? entry.order : 0,
  };
};

// 导入预设
const importPreset = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // 检测格式：多种格式兼容

      // 格式1: worldBooks 数组格式 [{ name, worldBooks: [...] }]
      if (Array.isArray(data) && data.length > 0 && data[0].worldBooks) {
        const allEntries: TextOptimizationEntry[] = [];
        let importedName = '导入的预设';

        for (const preset of data) {
          if (preset.name && !importedName.includes(preset.name)) {
            importedName = preset.name;
          }
          if (Array.isArray(preset.worldBooks)) {
            for (const wb of preset.worldBooks) {
              allEntries.push(convertWorldBooksEntry(wb));
            }
          }
        }

        entries.value = allEntries;
        presetName.value = importedName;
        toast.success(`导入成功：${allEntries.length} 条目`);
      }
      // 格式2: 单个对象包含 worldBooks { name, worldBooks: [...] }
      else if (data.worldBooks && Array.isArray(data.worldBooks)) {
        const converted = data.worldBooks.map((wb: Record<string, unknown>) => convertWorldBooksEntry(wb));
        entries.value = converted;
        presetName.value = data.name || '导入的预设';
        toast.success(`导入成功：${converted.length} 条目`);
      }
      // 格式3: 酒馆世界书格式 { entries: { "0": {...}, "1": {...} } }
      else if (data.entries && typeof data.entries === 'object' && !Array.isArray(data.entries)) {
        const converted = convertTavernWorldBook(data);
        entries.value = converted;
        presetName.value = data.name || '导入的预设';
        toast.success(`导入成功：${converted.length} 条目`);
      }
      // 格式4: 自定义预设格式 { entries: [...] }
      else if (Array.isArray(data.entries)) {
        entries.value = data.entries;
        presetName.value = data.name || '导入的预设';
        toast.success(`导入成功：${data.entries.length} 条目`);
      }
      // 格式5: 纯条目数组（检查是否像条目格式）
      else if (Array.isArray(data) && data.length > 0 && (data[0].content !== undefined || data[0].name !== undefined)) {
        // 检查是否是 worldBooks 格式的条目
        if (data[0].triggerMode !== undefined || data[0].depth !== undefined) {
          const converted = data.map((item: Record<string, unknown>) => convertWorldBooksEntry(item));
          entries.value = converted;
        } else {
          entries.value = data;
        }
        presetName.value = '导入的预设';
        toast.success(`导入成功：${data.length} 条目`);
      }
      else {
        throw new Error('无法识别的预设格式');
      }
    } catch (error) {
      toast.error('导入失败：' + (error instanceof Error ? error.message : '格式错误'));
    }
  };

  input.click();
};

// 导出预设
const exportPreset = () => {
  try {
    // 使用服务的导出功能
    textOptimizationService.setEntries(entries.value);
    textOptimizationService.downloadAsTavernFormat();
    toast.success('预设已导出');
  } catch (error) {
    toast.error('导出失败');
  }
};

// 保存
const handleSave = () => {
  try {
    // 更新order
    entries.value.forEach((entry, idx) => {
      entry.order = idx;
    });

    // 保存到服务
    textOptimizationService.setEntries(entries.value);
    textOptimizationService.save();

    toast.success('保存成功');
    emit('close');
  } catch (error) {
    toast.error('保存失败');
  }
};

// 关闭
const handleClose = () => {
  emit('close');
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.modal-container {
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(30, 41, 59, 0.5);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #f1f5f9;
}

.modal-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(30, 41, 59, 0.5);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.toolbar-left {
  display: flex;
  gap: 0.5rem;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(51, 65, 85, 0.5);
  color: #e2e8f0;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: rgba(71, 85, 105, 0.6);
  border-color: rgba(255, 255, 255, 0.15);
}

.entry-count {
  color: #94a3b8;
  font-size: 0.875rem;
}

.entries-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #64748b;
  text-align: center;
}

.empty-state p {
  margin: 1rem 0 0.5rem;
  font-size: 1rem;
  color: #94a3b8;
}

.empty-state span {
  font-size: 0.875rem;
}

.entry-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s;
}

.entry-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.entry-card.disabled {
  opacity: 0.6;
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: rgba(51, 65, 85, 0.3);
}

.entry-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.entry-name-input {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #f1f5f9;
  font-size: 0.9rem;
  font-weight: 500;
}

.entry-name-input:hover,
.entry-name-input:focus {
  background: rgba(30, 41, 59, 0.5);
  border-color: rgba(255, 255, 255, 0.1);
  outline: none;
}

.entry-badges {
  display: flex;
  gap: 0.375rem;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge.role {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.badge.role.user {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.badge.role.assistant {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.badge.depth {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
}

.badge.trigger.blue {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.badge.trigger.green {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.entry-actions {
  display: flex;
  gap: 0.25rem;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
}

.icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.icon-btn svg.rotated {
  transform: rotate(180deg);
}

.entry-body {
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 150px;
}

.form-row.full {
  width: 100%;
}

.form-row label {
  font-size: 0.8rem;
  color: #94a3b8;
  font-weight: 500;
}

.form-input,
.form-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.5);
  color: #e2e8f0;
  font-size: 0.875rem;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #60a5fa;
}

.form-input.small {
  width: 80px;
}

.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.5);
  color: #e2e8f0;
  font-size: 0.875rem;
  font-family: 'Monaco', 'Menlo', monospace;
  resize: vertical;
  min-height: 120px;
}

.form-textarea:focus {
  outline: none;
  border-color: #60a5fa;
}

/* Switch样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}

.switch.small {
  width: 32px;
  height: 18px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch .slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: rgba(100, 116, 139, 0.5);
  transition: 0.3s;
  border-radius: 20px;
}

.switch .slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.switch.small .slider:before {
  height: 12px;
  width: 12px;
  left: 3px;
  bottom: 3px;
}

.switch input:checked + .slider {
  background-color: #3b82f6;
}

.switch input:checked + .slider:before {
  transform: translateX(16px);
}

.switch.small input:checked + .slider:before {
  transform: translateX(14px);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(30, 41, 59, 0.5);
}

.btn {
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(51, 65, 85, 0.5);
  color: #e2e8f0;
}

.btn-secondary:hover {
  background: rgba(71, 85, 105, 0.6);
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

@media (max-width: 640px) {
  .modal-container {
    max-height: 100vh;
    border-radius: 0;
  }

  .toolbar {
    flex-direction: column;
    gap: 0.75rem;
  }

  .toolbar-left {
    width: 100%;
    flex-wrap: wrap;
  }

  .entry-title-row {
    flex-wrap: wrap;
  }

  .entry-badges {
    width: 100%;
    margin-top: 0.5rem;
  }
}
</style>
