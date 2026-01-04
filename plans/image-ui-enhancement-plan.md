# 图片UI增强实施计划

## 需求概述

根据用户要求，对图片预览和生成功能进行全面UI升级，使其符合仙侠游戏风格。

### 核心需求

| 功能点       | 需求描述                                           |
| ------------ | -------------------------------------------------- |
| 图片预览弹窗 | 纯净设计，带动画，底部仅透明背景的仙侠风格下载按钮 |
| 图片悬浮行为 | 移除悬浮按钮，单击预览，双击重新生成               |
| 长按编辑Tag  | 长按图片弹出Tag编辑框，保存不自动生成              |
| 缓存查看器   | 放在设置面板文生图API区域底部                      |
| 生图按钮     | 更小更精致，不显示tag，符合仙侠风格                |

---

## 文件变更清单

### 1. 新建文件

#### `src/components/common/ImagePreviewModal.vue`

全屏图片预览弹窗组件

**Props**:

- `visible: boolean` - 是否显示
- `imageData: string` - Base64图片数据

**Events**:

- `close` - 关闭弹窗
- `download` - 下载图片

**样式特点**:

- 全屏黑色半透明背景 `rgba(0, 0, 0, 0.9)`
- 毛玻璃效果 `backdrop-filter: blur(12px)`
- 图片居中，带缩放动画进入
- 底部居中下载按钮：透明背景 + 渐变边框 + 发光效果
- 点击空白区域或按ESC关闭
- 响应式布局

---

#### `src/components/common/TagEditModal.vue`

Tag编辑弹窗组件

**Props**:

- `visible: boolean` - 是否显示
- `tags: string` - 当前tags内容
- `imageId: string` - 图片标识符

**Events**:

- `close` - 关闭弹窗
- `save: (newTags: string) => void` - 保存tags

**样式特点**:

- 居中弹窗
- 多行文本输入框
- 仙侠风格按钮
- 提示文字：保存后双击图片可重新生成

---

#### `src/components/common/ImageCacheViewer.vue`

缓存图片查看器组件

**功能**:

- 显示缓存统计（数量、大小、最早日期）
- 网格展示缓存图片缩略图
- 支持点击预览
- 支持单个删除
- 支持批量清空

**调用接口**:

- `imageCacheService.getStats()` - 获取统计信息
- `imageCacheService.getAllEntries()` - 获取所有条目（需新增）
- `imageCacheService.delete(id)` - 删除单个
- `imageCacheService.clearAll()` - 清空全部

---

### 2. 修改文件

#### `src/services/imageCacheService.ts`

**新增方法**:

```typescript
async getAllEntries(): Promise<ImageCacheEntry[]> {
  const db = await this.ensureDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as ImageCacheEntry[])
  })
}
```

---

#### `src/components/common/FormattedText.vue`

**变更内容**:

1. **移除悬浮按钮** (删除 `.image-overlay` 相关代码)

2. **修改图片容器模板**:

```vue
<div
  class="generated-image-wrapper"
  @click="handleImageClick"
  @dblclick="handleImageDoubleClick"
  @mousedown="startLongPress"
  @mouseup="cancelLongPress"
  @mouseleave="cancelLongPress"
  @touchstart="startLongPress"
  @touchend="cancelLongPress"
>
  <img :src="getImageState(part.content.id)?.imageData" class="generated-image" />
</div>
```

3. **新增交互方法**:

```typescript
// 长按计时器
const longPressTimer = ref<number | null>(null)
const LONG_PRESS_DURATION = 500 // 500ms

function startLongPress(marker: ImageMarkerData) {
  longPressTimer.value = window.setTimeout(() => {
    openTagEditor(marker)
  }, LONG_PRESS_DURATION)
}

function cancelLongPress() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

function handleImageClick(imageData: string) {
  openImagePreview(imageData)
}

function handleImageDoubleClick(marker: ImageMarkerData) {
  regenerateImage(marker)
}

function openTagEditor(marker: ImageMarkerData) {
  currentEditingMarker.value = marker
  showTagEditModal.value = true
}
```

4. **修改生图按钮样式**:

```vue
<button class="generate-image-btn-xiantu" @click="generateImage(part.content)">
  <span class="btn-icon">✦</span>
  <span class="btn-text">生成图</span>
</button>
```

5. **引入新组件**:

```typescript
import ImagePreviewModal from './ImagePreviewModal.vue'
import TagEditModal from './TagEditModal.vue'
```

---

#### `src/components/dashboard/SettingsPanel.vue`

**变更内容**:

在文生图API配置区域底部添加缓存查看器：

```vue
<!-- 在 NovelAI 配置区域末尾添加 -->
<div class="cache-viewer-section">
  <h4 class="section-subtitle">缓存管理</h4>
  <ImageCacheViewer />
</div>
```

---

## 样式设计规范

### 颜色变量

```css
/* 仙侠主题色 */
--xiantu-primary: #667eea;
--xiantu-secondary: #764ba2;
--xiantu-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--xiantu-glow: rgba(102, 126, 234, 0.4);
--xiantu-glass-bg: rgba(15, 23, 42, 0.85);
--xiantu-glass-border: rgba(255, 255, 255, 0.1);
```

### 下载按钮样式

```css
.download-btn-xiantu {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: 1.5px solid transparent;
  border-image: linear-gradient(135deg, #667eea, #764ba2) 1;
  border-radius: 25px;
  color: #e2e8f0;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 0 15px rgba(102, 126, 234, 0.25);
}

.download-btn-xiantu:hover {
  background: rgba(102, 126, 234, 0.15);
  box-shadow: 0 0 25px rgba(102, 126, 234, 0.4);
  transform: translateY(-2px);
}
```

### 生图按钮样式

```css
.generate-image-btn-xiantu {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.12));
  border: 1px solid rgba(102, 126, 234, 0.45);
  border-radius: 6px;
  color: var(--color-primary, #667eea);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 0 8px rgba(102, 126, 234, 0.15);
}

.generate-image-btn-xiantu:hover {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
  border-color: rgba(102, 126, 234, 0.7);
  box-shadow: 0 0 15px rgba(102, 126, 234, 0.3);
  transform: translateY(-1px);
}

.generate-image-btn-xiantu .btn-icon {
  font-size: 1rem;
  color: #a78bfa;
}
```

---

## 交互流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                        图片交互流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐                                          │
│   │   生成按钮      │ ──单击──> 调用 generateImage()           │
│   │   (更小精致)    │                                          │
│   └─────────────────┘                                          │
│                                                                 │
│   ┌─────────────────┐                                          │
│   │   已生成图片    │ ──单击──> 打开全屏预览弹窗               │
│   │   (无悬浮按钮)  │ ──双击──> 重新生成图片                   │
│   │                 │ ──长按──> 打开Tag编辑弹窗                │
│   └─────────────────┘                                          │
│                                                                 │
│   ┌─────────────────┐                                          │
│   │   预览弹窗      │ ──点击背景──> 关闭弹窗                   │
│   │   (纯净设计)    │ ──点击下载──> 下载图片                   │
│   │                 │ ──按ESC键──> 关闭弹窗                    │
│   └─────────────────┘                                          │
│                                                                 │
│   ┌─────────────────┐                                          │
│   │   Tag编辑弹窗   │ ──保存──> 更新Store中的tags              │
│   │                 │ ──取消──> 关闭弹窗                       │
│   │                 │ (提示:双击图片可重新生成)                │
│   └─────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 实施顺序

1. **修改 imageCacheService.ts** - 添加 `getAllEntries()` 方法
2. **创建 ImagePreviewModal.vue** - 全屏预览弹窗
3. **创建 TagEditModal.vue** - Tag编辑弹窗
4. **创建 ImageCacheViewer.vue** - 缓存查看器
5. **修改 FormattedText.vue** - 整合所有新功能和交互
6. **修改 SettingsPanel.vue** - 添加缓存查看器入口

---

## 测试要点

- [ ] 单击图片能打开全屏预览
- [ ] 双击图片能触发重新生成
- [ ] 长按500ms能打开Tag编辑弹窗
- [ ] 预览弹窗点击空白处能关闭
- [ ] 预览弹窗按ESC能关闭
- [ ] 下载按钮能正常下载图片
- [ ] Tag编辑保存后更新Store
- [ ] 设置面板能查看缓存图片
- [ ] 能删除单个缓存图片
- [ ] 能清空所有缓存
- [ ] 暗色/亮色主题切换正常
- [ ] 移动端触摸交互正常
