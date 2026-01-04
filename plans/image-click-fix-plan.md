# 图片交互修复与功能增强计划

## 问题分析

### 当前问题根源

在 [`FormattedText.vue`](../src/components/common/FormattedText.vue:393) 的 `handleImageClick` 函数中存在逻辑问题：

```typescript
// 问题代码 (第 398-401 行)
if (longPressTimer.value === null && editingMarker.value) {
  editingMarker.value = null
  return
}
```

**问题原因**：

1. `mousedown` 触发 `startLongPress`，设置 `editingMarker.value = marker`
2. 用户快速点击（非长按），`mouseup` 触发 `cancelLongPress`，将 `longPressTimer.value` 设为 `null`
3. 此时 `click` 事件触发，条件 `longPressTimer.value === null && editingMarker.value` 为 **true**
4. 导致正常单击被错误忽略并 return

## 修改方案

### 1. 修复 FormattedText.vue 点击逻辑

**新增状态变量**：

```typescript
const longPressTriggered = ref(false) // 标记长按是否真的完成触发
```

**修改 `startLongPress` 函数**（第 455-469 行）：

```typescript
function startLongPress(event: MouseEvent | TouchEvent, marker: ImageMarkerData) {
  cancelLongPress()
  editingMarker.value = marker
  longPressTriggered.value = false // 重置标记

  longPressTimer.value = setTimeout(() => {
    longPressTriggered.value = true // 标记长按真的触发了
    openTagEditModal(marker)
    longPressTimer.value = null
  }, longPressThreshold)
}
```

**简化 `handleImageClick` 函数**（移除双击检测）：

```typescript
function handleImageClick(event: MouseEvent, marker: ImageMarkerData) {
  event.preventDefault()

  // 如果长按真的触发了（打开了弹窗），忽略这次点击
  if (longPressTriggered.value) {
    longPressTriggered.value = false
    editingMarker.value = null
    return
  }

  // 清理状态
  editingMarker.value = null

  // 直接打开预览
  const imageData = getImageState(marker.id)?.imageData
  if (imageData) {
    openImagePreview(imageData, marker.tags)
  }
}
```

**需要删除的代码**：

- 第 311-314 行的双击检测变量
- 第 405-432 行的双击检测逻辑

### 2. 更新 ImagePreviewModal.vue

**新增 props**：

```typescript
defineProps<{
  visible: boolean
  imageData: string
  showRegenerate?: boolean // 是否显示重新生成按钮，默认 true
}>()
```

**新增 emit**：

```typescript
defineEmits<{
  (e: 'close'): void
  (e: 'download'): void
  (e: 'regenerate'): void // 新增
}>()
```

**修改模板**（底部操作区域）：

```html
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
```

**新增样式**（按钮并排对称布局）：

```css
.preview-actions-xiantu {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
  gap: 1.5rem; /* 两个按钮之间的间距 */
}

.regenerate-btn-xiantu {
  /* 与 download-btn-xiantu 相同的样式 */
}
```

### 3. 更新 TagEditModal.vue

**新增 emit**：

```typescript
defineEmits<{
  (e: 'close'): void
  (e: 'save', newTags: string): void
  (e: 'saveAndRegenerate', newTags: string): void // 新增
}>()
```

**修改底部按钮**（第 41-48 行）：

```html
<div class="modal-footer-xiantu">
  <button class="btn-cancel-xiantu" @click="handleCancel">取消</button>
  <button class="btn-save-regen-xiantu" @click="handleSaveAndRegenerate">
    <span class="save-icon">↻</span>
    <span>保存并重新生成</span>
  </button>
  <button class="btn-save-xiantu" @click="handleSave">
    <span class="save-icon">✓</span>
    <span>保存标签</span>
  </button>
</div>
```

### 4. 更新 FormattedText.vue 事件处理

**新增状态保存当前预览的 marker**：

```typescript
const previewMarker = ref<ImageMarkerData | null>(null)
```

**修改 `openImagePreview` 函数**：

```typescript
function openImagePreview(imageData: string, tags: string, marker: ImageMarkerData) {
  previewImage.value = imageData
  previewTags.value = tags
  previewMarker.value = marker // 保存 marker
  showPreviewModal.value = true
}
```

**新增 ImagePreviewModal 的 regenerate 事件处理**：

```typescript
function onPreviewRegenerate() {
  if (previewMarker.value) {
    regenerateImage(previewMarker.value)
    closeImagePreview()
  }
}
```

**修改 TagEditModal 事件绑定**：

```html
<TagEditModal
  :visible="showTagEditModal"
  :tags="editingTags"
  :image-id="editingImageId"
  @close="closeTagEditModal"
  @save="saveEditedTags"
  @save-and-regenerate="saveTagsAndRegenerate"
/>
```

**新增保存并重新生成函数**：

```typescript
function saveTagsAndRegenerate(newTags: string) {
  if (editingMarker.value) {
    editingMarker.value.tags = newTags
    regenerateImage(editingMarker.value)
    toast.success('标签已保存，正在重新生成图片')
  }
  closeTagEditModal()
}
```

### 5. 更新提示文字

修改 CSS 伪元素内容（第 1997-1998 行）：

```css
.generated-image-wrapper-xiantu::after {
  content: '单击预览 · 长按编辑标签';
  /* 其他样式保持不变 */
}
```

## 文件修改清单

| 文件                    | 修改类型 | 说明                                     |
| ----------------------- | -------- | ---------------------------------------- |
| `FormattedText.vue`     | 修改     | 修复点击逻辑、移除双击、添加重新生成处理 |
| `ImagePreviewModal.vue` | 修改     | 添加重新生成按钮和事件                   |
| `TagEditModal.vue`      | 修改     | 添加保存并重新生成按钮和事件             |

## 交互流程

```
┌─────────────────────────────────────────────────────────────┐
│                      图片交互流程                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  单击图片 ──────────► 打开预览弹窗                          │
│                         │                                   │
│                         ├── [重新生成] ──► 关闭弹窗并重新生成│
│                         │                                   │
│                         └── [下载图片] ──► 下载当前图片      │
│                                                             │
│  长按图片 ──────────► 打开标签编辑弹窗                      │
│                         │                                   │
│                         ├── [保存并重新生成] ──► 保存标签并重新生成│
│                         │                                   │
│                         └── [保存标签] ──► 仅保存标签        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
