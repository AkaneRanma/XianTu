<template>
  <div class="global-settings-manager">
    <div class="section-header">
      <span class="section-title">全局设置管理</span>
    </div>

    <p class="section-description">
      一键导出或导入所有提示词相关设置，包括记忆配置、世界书条目和正文优化条目。
    </p>

    <div class="actions-grid">
      <!-- 导出设置 -->
      <div class="action-card">
        <div class="action-icon">📤</div>
        <div class="action-content">
          <h4>导出设置</h4>
          <p>将所有设置导出为JSON文件</p>
        </div>
        <button class="action-btn export" @click="exportSettings">
          导出
        </button>
      </div>

      <!-- 导入设置 -->
      <div class="action-card">
        <div class="action-icon">📥</div>
        <div class="action-content">
          <h4>导入设置</h4>
          <p>从JSON文件导入设置</p>
        </div>
        <input
          type="file"
          ref="importFileInput"
          accept=".json"
          @change="handleImportFile"
          style="display: none"
        />
        <button class="action-btn import" @click="triggerImport">
          导入
        </button>
      </div>

      <!-- 重置设置 -->
      <div class="action-card danger">
        <div class="action-icon">🗑️</div>
        <div class="action-content">
          <h4>重置设置</h4>
          <p>恢复所有设置为默认值</p>
        </div>
        <button class="action-btn reset" @click="resetSettings">
          重置
        </button>
      </div>
    </div>

    <!-- 导入选项对话框 -->
    <div v-if="showImportOptions" class="modal-overlay" @click.self="showImportOptions = false">
      <div class="import-options-modal">
        <div class="modal-header">
          <h3>导入选项</h3>
          <button class="close-btn" @click="showImportOptions = false">×</button>
        </div>
        <div class="modal-body">
          <div class="file-info" v-if="importFileInfo">
            <span class="file-name">{{ importFileInfo.name }}</span>
            <span class="file-size">{{ formatFileSize(importFileInfo.size) }}</span>
          </div>

          <div class="options-list">
            <label class="option-item">
              <input type="checkbox" v-model="importOptions.overwrite" />
              <span>覆盖模式（替换现有数据）</span>
            </label>
            <label class="option-item">
              <input type="checkbox" v-model="importOptions.skipMemoryConfig" />
              <span>跳过记忆配置</span>
            </label>
            <label class="option-item">
              <input type="checkbox" v-model="importOptions.skipWorldBook" />
              <span>跳过世界书条目</span>
            </label>
            <label class="option-item">
              <input type="checkbox" v-model="importOptions.skipTextOptimization" />
              <span>跳过正文优化条目</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" @click="showImportOptions = false">取消</button>
          <button class="confirm-btn" @click="doImport">确认导入</button>
        </div>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-section">
      <div class="section-header">
        <span class="section-title">当前配置统计</span>
        <button class="refresh-btn" @click="loadStats">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">{{ stats.worldBookCount }}</span>
          <span class="stat-label">世界书条目</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ stats.textOptimizationCount }}</span>
          <span class="stat-label">优化条目</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ stats.shortTermMemoryCount }}</span>
          <span class="stat-label">短期记忆</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { globalSettingsService } from '@/services/globalSettingsService';
import { promptPreviewService } from '@/services/promptPreviewService';
import { textOptimizationService } from '@/services/textOptimizationService';
import { toast } from '@/utils/toast';

const importFileInput = ref<HTMLInputElement | null>(null);
const showImportOptions = ref(false);
const importFileInfo = ref<{ name: string; size: number } | null>(null);
const pendingImportFile = ref<File | null>(null);

const importOptions = reactive({
  overwrite: false,
  skipMemoryConfig: false,
  skipWorldBook: false,
  skipTextOptimization: false,
});

const stats = reactive({
  worldBookCount: 0,
  textOptimizationCount: 0,
  shortTermMemoryCount: 0,
});

// 加载统计信息
const loadStats = () => {
  stats.worldBookCount = promptPreviewService.getWorldBookEntries().length;
  stats.textOptimizationCount = textOptimizationService.getEntries().length;
  stats.shortTermMemoryCount = promptPreviewService.getShortTermMemories().length;
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// 导出设置
const exportSettings = () => {
  globalSettingsService.downloadSettings();
  toast.success('设置已导出');
};

// 触发导入
const triggerImport = () => {
  importFileInput.value?.click();
};

// 处理导入文件选择
const handleImportFile = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  pendingImportFile.value = file;
  importFileInfo.value = {
    name: file.name,
    size: file.size,
  };
  showImportOptions.value = true;
  input.value = '';
};

// 执行导入
const doImport = async () => {
  if (!pendingImportFile.value) return;

  try {
    const result = await globalSettingsService.importFromFile(
      pendingImportFile.value,
      {
        overwrite: importOptions.overwrite,
        skipMemoryConfig: importOptions.skipMemoryConfig,
        skipWorldBook: importOptions.skipWorldBook,
        skipTextOptimization: importOptions.skipTextOptimization,
      }
    );

    showImportOptions.value = false;
    pendingImportFile.value = null;

    if (result.success) {
      let message = '导入成功！';
      const parts = [];
      if (result.memoryConfigImported) parts.push('记忆配置');
      if (result.worldBookEntriesCount > 0) parts.push(`${result.worldBookEntriesCount}个世界书条目`);
      if (result.textOptimizationEntriesCount > 0) parts.push(`${result.textOptimizationEntriesCount}个优化条目`);
      if (parts.length > 0) message = `已导入: ${parts.join(', ')}`;
      toast.success(message);
      loadStats();
    } else {
      toast.error('导入失败: ' + result.errors.join('; '));
    }
  } catch (error) {
    toast.error('导入失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
};

// 重置设置
const resetSettings = () => {
  if (confirm('确定要重置所有设置吗？此操作不可撤销。')) {
    globalSettingsService.resetAllSettings();
    loadStats();
    toast.success('设置已重置');
  }
};

onMounted(() => {
  loadStats();
});
</script>

<style scoped>
.global-settings-manager {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.section-description {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.5;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(30, 35, 45, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.action-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
}

.action-card.danger {
  border-color: rgba(239, 68, 68, 0.2);
}

.action-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.action-content {
  flex: 1;
  min-width: 0;
}

.action-content h4 {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
}

.action-content p {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.action-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.action-btn.export {
  background: rgba(74, 158, 255, 0.15);
  border: 1px solid rgba(74, 158, 255, 0.3);
  color: #4a9eff;
}

.action-btn.export:hover {
  background: rgba(74, 158, 255, 0.25);
  border-color: rgba(74, 158, 255, 0.5);
}

.action-btn.import {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.action-btn.import:hover {
  background: rgba(16, 185, 129, 0.25);
  border-color: rgba(16, 185, 129, 0.5);
}

.action-btn.reset {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.action-btn.reset:hover {
  background: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.5);
}

.stats-section {
  padding: 16px;
  background: rgba(30, 35, 45, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s ease;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

/* 导入选项对话框 */
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

.import-options-modal {
  background: #1e2330;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  width: 400px;
  max-width: 90vw;
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
}

.file-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(74, 158, 255, 0.1);
  border-radius: 6px;
  margin-bottom: 16px;
}

.file-name {
  font-size: 13px;
  color: #4a9eff;
  font-weight: 500;
}

.file-size {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.option-item input {
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

.confirm-btn:hover {
  background: rgba(74, 158, 255, 0.3);
  border-color: rgba(74, 158, 255, 0.6);
}
</style>
