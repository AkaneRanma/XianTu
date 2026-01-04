<template>
  <Teleport to="body">
    <Transition name="preview-fade">
      <div
        v-if="visible"
        class="image-preview-overlay-xiantu"
        @click="handleOverlayClick"
        @keydown.esc="close"
        tabindex="0"
        ref="overlayRef"
      >
        <Transition name="preview-zoom">
          <div v-if="visible" class="preview-content-xiantu" @click.stop>
            <!-- 图片容器 -->
            <div class="preview-image-container">
              <img
                :src="imageData"
                class="preview-image-xiantu"
                alt="预览图片"
                @load="onImageLoad"
              />
            </div>

            <!-- 底部操作按钮 -->
            <div class="preview-actions-xiantu">
              <button class="regenerate-btn-xiantu" @click="handleRegenerate">
                <span class="regenerate-icon">↻</span>
                <span class="regenerate-text">重新生成</span>
              </button>
              <button class="download-btn-xiantu" @click="handleDownload">
                <span class="download-icon">⬇</span>
                <span class="download-text">下载图片</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { toast } from '@/utils/toast'

const props = defineProps<{
  visible: boolean
  imageData: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'download'): void
  (e: 'regenerate'): void
}>()

const overlayRef = ref<HTMLElement | null>(null)

// 当弹窗打开时自动获取焦点以支持ESC关闭
watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await nextTick()
    overlayRef.value?.focus()
  }
})

function handleOverlayClick() {
  close()
}

function close() {
  emit('close')
}

function handleDownload() {
  if (!props.imageData) return

  try {
    const link = document.createElement('a')
    link.href = props.imageData
    link.download = `xiantu-image-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('图片已下载')
    emit('download')
  } catch (error) {
    console.error('[ImagePreview] 下载失败:', error)
    toast.error('下载失败')
  }
}

function handleRegenerate() {
  emit('regenerate')
}

function onImageLoad() {
  // 图片加载完成的回调，可用于添加加载动画
}
</script>

<style scoped>
/* 全屏遮罩层 */
.image-preview-overlay-xiantu {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10002;
  cursor: pointer;
  outline: none;
}

/* 预览内容容器 */
.preview-content-xiantu {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 95vw;
  max-height: 95vh;
  cursor: default;
}

/* 图片容器 */
.preview-image-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  overflow: hidden;
}

/* 预览图片 */
.preview-image-xiantu {
  max-width: 90vw;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

/* 底部操作区域 */
.preview-actions-xiantu {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
  gap: 1.5rem;
}

/* 仙侠风格下载按钮 - 椭圆形渐变边框 */
.download-btn-xiantu {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.75rem;
  background: rgba(15, 23, 42, 0.85);
  border: none;
  border-radius: 25px;
  color: #e2e8f0;
  font-size: 0.95rem;
  font-weight: 500;
  font-family: var(--font-family-serif, 'SimSun', serif);
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 0 20px rgba(102, 126, 234, 0.25),
    inset 0 0 20px rgba(102, 126, 234, 0.05);
  position: relative;
  overflow: visible;
  isolation: isolate;
}

/* 渐变边框效果 - 使用伪元素 */
.download-btn-xiantu::before {
  content: '';
  position: absolute;
  inset: -1.5px;
  background: linear-gradient(135deg, #667eea 0%, #a78bfa 50%, #764ba2 100%);
  border-radius: 27px;
  z-index: -2;
  opacity: 0.7;
  transition: opacity 0.35s ease;
}

/* 按钮内部背景 */
.download-btn-xiantu::after {
  content: '';
  position: absolute;
  inset: 1.5px;
  background: rgba(15, 23, 42, 0.95);
  border-radius: 23px;
  z-index: -1;
}

.download-btn-xiantu:hover {
  color: #fff;
  transform: translateY(-3px);
  box-shadow:
    0 0 35px rgba(102, 126, 234, 0.45),
    0 10px 30px rgba(118, 75, 162, 0.25),
    inset 0 0 25px rgba(102, 126, 234, 0.1);
}

.download-btn-xiantu:hover::before {
  opacity: 1;
}

.download-btn-xiantu:active {
  transform: translateY(-1px);
}

/* 重新生成按钮 - 与下载按钮相同样式 */
.regenerate-btn-xiantu {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.75rem;
  background: rgba(15, 23, 42, 0.85);
  border: none;
  border-radius: 25px;
  color: #e2e8f0;
  font-size: 0.95rem;
  font-weight: 500;
  font-family: var(--font-family-serif, 'SimSun', serif);
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 0 20px rgba(102, 126, 234, 0.25),
    inset 0 0 20px rgba(102, 126, 234, 0.05);
  position: relative;
  overflow: visible;
  isolation: isolate;
}

/* 渐变边框效果 - 使用伪元素 */
.regenerate-btn-xiantu::before {
  content: '';
  position: absolute;
  inset: -1.5px;
  background: linear-gradient(135deg, #667eea 0%, #a78bfa 50%, #764ba2 100%);
  border-radius: 27px;
  z-index: -2;
  opacity: 0.7;
  transition: opacity 0.35s ease;
}

/* 按钮内部背景 */
.regenerate-btn-xiantu::after {
  content: '';
  position: absolute;
  inset: 1.5px;
  background: rgba(15, 23, 42, 0.95);
  border-radius: 23px;
  z-index: -1;
}

.regenerate-btn-xiantu:hover {
  color: #fff;
  transform: translateY(-3px);
  box-shadow:
    0 0 35px rgba(102, 126, 234, 0.45),
    0 10px 30px rgba(118, 75, 162, 0.25),
    inset 0 0 25px rgba(102, 126, 234, 0.1);
}

.regenerate-btn-xiantu:hover::before {
  opacity: 1;
}

.regenerate-btn-xiantu:active {
  transform: translateY(-1px);
}

/* 重新生成图标 */
.regenerate-icon {
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

.regenerate-btn-xiantu:hover .regenerate-icon {
  animation: spin-regenerate 0.8s ease infinite;
}

@keyframes spin-regenerate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 重新生成文字 */
.regenerate-text {
  letter-spacing: 0.05em;
}

/* 下载图标 */
.download-icon {
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

.download-btn-xiantu:hover .download-icon {
  transform: translateY(2px);
  animation: bounce-down 0.6s ease infinite;
}

@keyframes bounce-down {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
}

/* 下载文字 */
.download-text {
  letter-spacing: 0.05em;
}

/* 弹窗淡入淡出动画 */
.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.3s ease;
}

.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}

/* 图片缩放动画 */
.preview-zoom-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.preview-zoom-leave-active {
  transition: all 0.25s ease-in;
}

.preview-zoom-enter-from {
  opacity: 0;
  transform: scale(0.85);
}

.preview-zoom-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* 移动端适配 */
@media (max-width: 640px) {
  .preview-image-xiantu {
    max-width: 95vw;
    max-height: 70vh;
  }

  .download-btn-xiantu,
  .regenerate-btn-xiantu {
    padding: 0.65rem 1.5rem;
    font-size: 0.9rem;
  }

  .preview-actions-xiantu {
    margin-top: 1rem;
    gap: 1rem;
  }
}

/* 深色主题额外优化 */
[data-theme="dark"] .download-btn-xiantu,
[data-theme="dark"] .regenerate-btn-xiantu {
  color: #c0caf5;
}

[data-theme="dark"] .download-btn-xiantu:hover,
[data-theme="dark"] .regenerate-btn-xiantu:hover {
  color: #fff;
}
</style>
