<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="visible"
        class="tag-edit-overlay-xiantu"
        @click.self="handleCancel"
        @keydown.esc="handleCancel"
        tabindex="0"
        ref="overlayRef"
      >
        <Transition name="modal-slide">
          <div v-if="visible" class="tag-edit-modal-xiantu">
            <!-- 标题 -->
            <div class="modal-header-xiantu">
              <span class="header-icon">✦</span>
              <h3 class="header-title">编辑生图标签</h3>
              <button class="close-btn-xiantu" @click="handleCancel">
                <span>×</span>
              </button>
            </div>

            <!-- 内容区域 -->
            <div class="modal-body-xiantu">
              <div class="input-wrapper">
                <label class="input-label">图像标签 (Tags)</label>
                <textarea
                  v-model="editedTags"
                  class="tags-textarea-xiantu"
                  rows="6"
                  placeholder="输入生成图像的描述标签，多个标签用英文逗号分隔..."
                  ref="textareaRef"
                ></textarea>
              </div>
              <p class="hint-text">
                💡 点击"保存并重新生成"可立即使用新标签生成图片
              </p>
            </div>

            <!-- 底部按钮 -->
            <div class="modal-footer-xiantu">
              <button class="btn-cancel-xiantu" @click="handleCancel">
                取消
              </button>
              <button class="btn-save-regen-xiantu" @click="handleSaveAndRegenerate">
                <span class="save-icon">↻</span>
                <span>保存并重新生成</span>
              </button>
              <button class="btn-save-xiantu" @click="handleSave">
                <span class="save-icon">✓</span>
                <span>保存标签</span>
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

const props = defineProps<{
  visible: boolean
  tags: string
  imageId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', newTags: string): void
  (e: 'saveAndRegenerate', newTags: string): void
}>()

const overlayRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const editedTags = ref('')

// 当弹窗打开时初始化编辑内容并获取焦点
watch(() => props.visible, async (newVal) => {
  if (newVal) {
    editedTags.value = props.tags
    await nextTick()
    overlayRef.value?.focus()
    textareaRef.value?.focus()
    textareaRef.value?.select()
  }
})

// 同步外部 tags 变化
watch(() => props.tags, (newTags) => {
  if (props.visible) {
    editedTags.value = newTags
  }
})

function handleCancel() {
  emit('close')
}

function handleSave() {
  const trimmedTags = editedTags.value.trim()
  emit('save', trimmedTags)
  emit('close')
}

function handleSaveAndRegenerate() {
  const trimmedTags = editedTags.value.trim()
  emit('saveAndRegenerate', trimmedTags)
  emit('close')
}
</script>

<style scoped>
/* 遮罩层 */
.tag-edit-overlay-xiantu {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10003;
  padding: 1rem;
  outline: none;
}

/* 弹窗主体 */
.tag-edit-modal-xiantu {
  background: var(--color-surface, #232e40);
  border: 1px solid;
  border-image: linear-gradient(135deg, rgba(102, 126, 234, 0.5), rgba(118, 75, 162, 0.5)) 1;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
  box-shadow:
    0 25px 60px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(102, 126, 234, 0.15);
}

/* 头部 */
.modal-header-xiantu {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.08));
  border-bottom: 1px solid rgba(102, 126, 234, 0.2);
}

.header-icon {
  font-size: 1.25rem;
  color: #a78bfa;
}

.header-title {
  flex: 1;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text, #f7f7f5);
  font-family: var(--font-family-serif, 'SimSun', serif);
  letter-spacing: 0.05em;
}

.close-btn-xiantu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--color-text-secondary, #94a3b8);
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn-xiantu:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

/* 内容区域 */
.modal-body-xiantu {
  padding: 1.25rem;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-secondary, #94a3b8);
}

.tags-textarea-xiantu {
  width: 100%;
  padding: 0.875rem 1rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 10px;
  color: var(--color-text, #f7f7f5);
  font-size: 0.95rem;
  font-family: var(--font-family-sans-serif, 'SimSun', sans-serif);
  line-height: 1.6;
  resize: vertical;
  min-height: 120px;
  transition: all 0.25s ease;
  box-sizing: border-box;
}

.tags-textarea-xiantu::placeholder {
  color: var(--color-text-muted, #64748b);
}

.tags-textarea-xiantu:focus {
  outline: none;
  border-color: rgba(102, 126, 234, 0.6);
  box-shadow:
    0 0 0 3px rgba(102, 126, 234, 0.1),
    0 0 20px rgba(102, 126, 234, 0.15);
}

.hint-text {
  margin: 1rem 0 0;
  padding: 0.75rem 1rem;
  background: linear-gradient(90deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.05));
  border-left: 3px solid #fbbf24;
  border-radius: 0 8px 8px 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary, #94a3b8);
}

/* 底部按钮区域 */
.modal-footer-xiantu {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: rgba(0, 0, 0, 0.15);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* 取消按钮 */
.btn-cancel-xiantu {
  padding: 0.6rem 1.25rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: var(--color-text-secondary, #94a3b8);
  font-size: 0.9rem;
  font-family: var(--font-family-serif, 'SimSun', serif);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel-xiantu:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.25);
  color: var(--color-text, #f7f7f5);
}

/* 保存并重新生成按钮 */
.btn-save-regen-xiantu {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.25rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: var(--font-family-serif, 'SimSun', serif);
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
}

.btn-save-regen-xiantu:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

.btn-save-regen-xiantu:active {
  transform: translateY(0);
}

.btn-save-regen-xiantu .save-icon {
  transition: transform 0.3s ease;
}

.btn-save-regen-xiantu:hover .save-icon {
  animation: spin-icon 0.8s ease infinite;
}

@keyframes spin-icon {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 保存按钮 */
.btn-save-xiantu {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.25rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: var(--font-family-serif, 'SimSun', serif);
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.btn-save-xiantu:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.btn-save-xiantu:active {
  transform: translateY(0);
}

.save-icon {
  font-size: 1rem;
}

/* 动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-slide-leave-active {
  transition: all 0.2s ease-in;
}

.modal-slide-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

.modal-slide-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

/* 亮色主题适配 */
[data-theme="light"] .tag-edit-modal-xiantu {
  background: var(--color-surface, #f1eee7);
}

[data-theme="light"] .tags-textarea-xiantu {
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(102, 126, 234, 0.4);
}

[data-theme="light"] .modal-footer-xiantu {
  background: rgba(0, 0, 0, 0.03);
}

/* 移动端适配 */
@media (max-width: 480px) {
  .tag-edit-modal-xiantu {
    max-width: 100%;
    margin: 0.5rem;
    border-radius: 12px;
  }

  .modal-header-xiantu,
  .modal-body-xiantu,
  .modal-footer-xiantu {
    padding: 1rem;
  }

  .modal-footer-xiantu {
    flex-direction: column;
  }

  .btn-cancel-xiantu,
  .btn-save-xiantu,
  .btn-save-regen-xiantu {
    width: 100%;
    justify-content: center;
  }
}
</style>
