<template>
  <Teleport to="body">
    <Transition name="cache-fade">
      <div
        v-if="visible"
        class="cache-viewer-overlay"
        @click.self="handleClose"
        @keydown.esc="handleClose"
        tabindex="0"
        ref="overlayRef"
      >
        <Transition name="cache-slide">
          <div v-if="visible" class="cache-viewer-modal">
            <!-- 标题栏 -->
            <div class="viewer-header">
              <div class="header-left">
                <span class="header-icon">🖼️</span>
                <h3 class="header-title">图片缓存管理</h3>
                <span class="cache-count">({{ cacheEntries.length }} 张)</span>
              </div>
              <div class="header-actions">
                <button
                  v-if="cacheEntries.length > 0"
                  class="btn-clear-all"
                  @click="handleClearAll"
                  :disabled="isClearing"
                >
                  <span v-if="!isClearing">🗑️ 清空全部</span>
                  <span v-else>清空中...</span>
                </button>
                <button class="btn-close" @click="handleClose">
                  <span>×</span>
                </button>
              </div>
            </div>

            <!-- 内容区域 -->
            <div class="viewer-body">
              <!-- 加载状态 -->
              <div v-if="isLoading" class="loading-state">
                <div class="loading-spinner"></div>
                <p>正在加载缓存图片...</p>
              </div>

              <!-- 空状态 -->
              <div v-else-if="cacheEntries.length === 0" class="empty-state">
                <div class="empty-icon">📭</div>
                <p class="empty-text">暂无缓存图片</p>
                <p class="empty-hint">生成的图片将自动缓存在此处</p>
              </div>

              <!-- 图片网格 -->
              <div v-else class="image-grid">
                <div
                  v-for="entry in cacheEntries"
                  :key="entry.id"
                  class="image-card"
                  @click="handlePreview(entry)"
                >
                  <div class="image-wrapper">
                    <img
                      :src="entry.imageBase64"
                      :alt="entry.tags || '缓存图片'"
                      loading="lazy"
                    />
                    <div class="image-overlay">
                      <button
                        class="btn-delete"
                        @click.stop="handleDelete(entry.id)"
                        title="删除此图片"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div class="image-info">
                    <p class="image-date">
                      {{ formatDate(entry.createdAt) }}
                    </p>
                    <p class="image-tags" :title="entry.tags">
                      {{ truncateText(entry.tags || '无标签', 40) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部状态栏 -->
            <div class="viewer-footer">
              <span class="storage-info">
                💾 缓存占用: {{ formatSize(totalSize) }}
              </span>
              <button class="btn-refresh" @click="loadCacheEntries" :disabled="isLoading">
                🔄 刷新
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- 预览弹窗 -->
    <ImagePreviewModal
      :visible="previewVisible"
      :image-data="previewImage?.imageBase64 || ''"
      @close="previewVisible = false"
      @download="handleDownload"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { imageCacheService } from '@/services/imageCacheService'
import type { ImageCacheEntry } from '@/types/novelAI'
import ImagePreviewModal from './ImagePreviewModal.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const overlayRef = ref<HTMLElement | null>(null)
const cacheEntries = ref<ImageCacheEntry[]>([])
const isLoading = ref(false)
const isClearing = ref(false)
const previewVisible = ref(false)
const previewImage = ref<ImageCacheEntry | null>(null)

// 计算总大小
const totalSize = computed(() => {
  return cacheEntries.value.reduce((sum: number, entry: ImageCacheEntry) => {
    // 估算 base64 数据大小
    const base64Length = entry.imageBase64?.length || 0
    return sum + (base64Length * 3 / 4)
  }, 0)
})

// 监听弹窗打开
watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await nextTick()
    overlayRef.value?.focus()
    await loadCacheEntries()
  }
})

// 加载缓存条目
async function loadCacheEntries() {
  isLoading.value = true
  try {
    cacheEntries.value = await imageCacheService.getAllEntries()
  } catch (error) {
    console.error('加载缓存失败:', error)
    cacheEntries.value = []
  } finally {
    isLoading.value = false
  }
}

// 预览图片
function handlePreview(entry: ImageCacheEntry) {
  previewImage.value = entry
  previewVisible.value = true
}

// 删除单张图片
async function handleDelete(id: string) {
  if (!confirm('确定删除此图片？')) return
  try {
    await imageCacheService.delete(id)
    cacheEntries.value = cacheEntries.value.filter((e: ImageCacheEntry) => e.id !== id)
  } catch (error) {
    console.error('删除失败:', error)
  }
}

// 清空全部
async function handleClearAll() {
  if (!confirm('确定清空所有缓存图片？此操作不可恢复。')) return
  isClearing.value = true
  try {
    await imageCacheService.clearAll()
    cacheEntries.value = []
  } catch (error) {
    console.error('清空失败:', error)
  } finally {
    isClearing.value = false
  }
}

// 下载图片
function handleDownload() {
  if (!previewImage.value) return
  const link = document.createElement('a')
  link.href = previewImage.value.imageBase64
  link.download = `xiantu-image-${Date.now()}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 关闭弹窗
function handleClose() {
  emit('close')
}

// 格式化日期
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// 截断文本
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
</script>

<style scoped>
/* 遮罩层 */
.cache-viewer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10002;
  padding: 1rem;
  outline: none;
}

/* 弹窗主体 */
.cache-viewer-modal {
  background: var(--color-surface, #232e40);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 16px;
  width: 100%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow:
    0 25px 60px rgba(0, 0, 0, 0.5),
    0 0 50px rgba(102, 126, 234, 0.1);
}

/* 头部 */
.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.08));
  border-bottom: 1px solid rgba(102, 126, 234, 0.2);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-icon {
  font-size: 1.25rem;
}

.header-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text, #f7f7f5);
  font-family: var(--font-family-serif, 'SimSun', serif);
  letter-spacing: 0.05em;
}

.cache-count {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #94a3b8);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-clear-all {
  padding: 0.5rem 0.875rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-clear-all:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.btn-clear-all:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--color-text-secondary, #94a3b8);
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-close:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

/* 内容区域 */
.viewer-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  min-height: 300px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--color-text-secondary, #94a3b8);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(102, 126, 234, 0.2);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.6;
}

.empty-text {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-text, #f7f7f5);
}

.empty-hint {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
  color: var(--color-text-secondary, #94a3b8);
}

/* 图片网格 */
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.image-card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s ease;
}

.image-card:hover {
  border-color: rgba(102, 126, 234, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.image-wrapper {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}

.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.image-card:hover .image-wrapper img {
  transform: scale(1.05);
}

.image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 50%, rgba(0, 0, 0, 0.7) 100%);
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-card:hover .image-overlay {
  opacity: 1;
}

.btn-delete {
  width: 32px;
  height: 32px;
  background: rgba(239, 68, 68, 0.8);
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-delete:hover {
  background: #ef4444;
  transform: scale(1.1);
}

.image-info {
  padding: 0.625rem 0.75rem;
}

.image-date {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
}

.image-tags {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #94a3b8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 底部状态栏 */
.viewer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.storage-info {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #94a3b8);
}

.btn-refresh {
  padding: 0.4rem 0.75rem;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 6px;
  color: #a78bfa;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-refresh:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.5);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 动画 */
.cache-fade-enter-active,
.cache-fade-leave-active {
  transition: opacity 0.3s ease;
}

.cache-fade-enter-from,
.cache-fade-leave-to {
  opacity: 0;
}

.cache-slide-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.cache-slide-leave-active {
  transition: all 0.25s ease-in;
}

.cache-slide-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(-30px);
}

.cache-slide-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(15px);
}

/* 亮色主题适配 */
[data-theme="light"] .cache-viewer-modal {
  background: var(--color-surface, #f1eee7);
}

[data-theme="light"] .image-card {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);
}

[data-theme="light"] .viewer-footer {
  background: rgba(0, 0, 0, 0.04);
}

/* 移动端适配 */
@media (max-width: 640px) {
  .cache-viewer-modal {
    max-height: 90vh;
    border-radius: 12px 12px 0 0;
  }

  .viewer-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  .viewer-footer {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
    text-align: center;
  }
}
</style>
