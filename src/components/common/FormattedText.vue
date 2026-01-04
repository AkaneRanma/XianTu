<template>
  <div class="formatted-text">
    <template v-for="(part, index) in parsedText" :key="index">
      <!-- HTML 类型 - 使用 v-html 渲染 -->
      <span v-if="part.type === 'html'" class="text-html" v-html="sanitizeHtml(String(part.content))"></span>

      <!-- 普通文本类型 -->
      <span v-else-if="part.type !== 'judgement-card' && part.type !== 'image-marker'" :class="getPartClass(part.type)">
        {{ part.content }}
      </span>

      <!-- 图像标记类型 -->
      <div v-else-if="part.type === 'image-marker' && isImageMarkerData(part.content)" class="image-marker-container">
        <!-- 已生成的图片 -->
        <div v-if="getImageState(part.content.id)?.imageData" class="generated-image-wrapper-xiantu">
          <img
            :src="getImageState(part.content.id)?.imageData"
            :alt="part.content.tags"
            class="generated-image-xiantu"
            @click="handleImageClick($event, part.content)"
            @mousedown="startLongPress($event, part.content)"
            @mouseup="cancelLongPress"
            @mouseleave="cancelLongPress"
            @touchstart.passive="startLongPress($event, part.content)"
            @touchend="cancelLongPress"
            @touchcancel="cancelLongPress"
          />
        </div>
        <!-- 生成中状态 -->
        <div v-else-if="getImageState(part.content.id)?.loading" class="image-loading-xiantu">
          <div class="loading-spinner-xiantu"></div>
          <span>生成中...</span>
        </div>
        <!-- 生成失败状态 -->
        <div v-else-if="getImageState(part.content.id)?.error" class="image-error-xiantu">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{{ getImageState(part.content.id)?.error }}</span>
          <button class="retry-btn-xiantu" @click="generateImage(part.content)">重试</button>
        </div>
        <!-- 待生成按钮 - 仙侠风格小按钮 -->
        <button v-else class="generate-image-btn-xiantu" @click="generateImage(part.content)" @mousedown="startLongPress($event, part.content)" @mouseup="cancelLongPress" @mouseleave="cancelLongPress" @touchstart.passive="startLongPress($event, part.content)" @touchend="cancelLongPress" @touchcancel="cancelLongPress">
          <span class="btn-icon-xiantu">✦</span>
          <span class="btn-text-xiantu">生图</span>
        </button>
      </div>

      <!-- 判定卡片类型 -->
      <div v-else-if="isJudgementData(part.content)" class="judgement-card" :class="{
        'is-success': isSuccessResult(part.content.result),
        'is-failure': isFailureResult(part.content.result),
        'is-great-success': part.content.result?.includes('大成功'),
        'is-great-failure': part.content.result?.includes('大失败')
      }">
        <div class="card-icon">
          <svg v-if="isSuccessResult(part.content.result)" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <svg v-else-if="isFailureResult(part.content.result)" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div class="card-content">
          <div class="card-header">
            <span class="judgement-title">{{ part.content.title }}</span>
            <div class="header-right">
              <span class="judgement-badge">{{ part.content.result }}</span>
              <button class="help-btn" @click.stop="showJudgementHelp" title="查看判定规则">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </button>
            </div>
          </div>
          <div class="card-body">
            <div class="stat-item" v-if="part.content.finalValue">
              <span class="stat-icon">✨</span>
              <div class="stat-info">
                <span class="stat-label">判定值</span>
                <span class="stat-value">{{ part.content.finalValue }}</span>
              </div>
            </div>
            <div class="stat-item difficulty-item" v-if="part.content.difficulty">
              <span class="stat-icon">🎯</span>
              <div class="stat-info">
                <span class="stat-label">难度</span>
                <span class="stat-value">{{ part.content.difficulty }}</span>
              </div>
            </div>
            <div class="stat-item" v-if="part.content.damage">
              <span class="stat-icon">⚔️</span>
              <div class="stat-info">
                <span class="stat-label">伤害</span>
                <span class="stat-value">{{ part.content.damage }}</span>
              </div>
            </div>
            <div class="stat-item" v-if="part.content.remainingHp">
              <span class="stat-icon">❤️</span>
              <div class="stat-info">
                <span class="stat-label">剩余气血</span>
                <span class="stat-value">{{ part.content.remainingHp }}</span>
              </div>
            </div>
            <div class="details-list" v-if="part.content.details && part.content.details.length > 0">
              <div class="detail-item" v-for="(detail, idx) in part.content.details" :key="idx">
                <span class="detail-label">{{ parseDetailLabel(detail) }}</span>
                <span class="detail-value">{{ parseDetailValue(detail) }}</span>
                <span class="detail-source" v-if="parseDetailSource(detail)">{{ parseDetailSource(detail) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- 新版全屏图片预览弹窗 -->
  <ImagePreviewModal
    :visible="showPreviewModal"
    :image-data="previewImage || ''"
    @close="closeImagePreview"
    @download="onPreviewDownload"
    @regenerate="onPreviewRegenerate"
  />

  <!-- Tag 编辑弹窗 -->
  <TagEditModal
    :visible="showTagEditModal"
    :tags="editingTags"
    :image-id="editingImageId"
    @close="closeTagEditModal"
    @save="saveEditedTags"
    @save-and-regenerate="saveTagsAndRegenerate"
  />

  <!-- 判定规则帮助弹窗 -->
  <Teleport to="body">
    <div v-if="showHelpModal" class="help-modal-overlay" @click="closeHelpModal">
      <div class="help-modal" @click.stop>
        <div class="help-modal-header">
          <h3>🎲 {{ $t('判定规则说明') }}</h3>
          <button class="close-btn" @click="closeHelpModal">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="help-modal-content">
          <div class="help-section">
            <h4>📊 {{ $t('判定计算公式') }}</h4>
            <div class="formula-box">
              <strong>{{ $t('判定值') }}</strong> = {{ $t('先天') }} + {{ $t('后天') }} + {{ $t('境界') }} + {{ $t('装备') }} + {{ $t('功法') }} + {{ $t('状态') }}
            </div>
            <ol>
              <li><strong>{{ $t('先天') }}</strong>：{{ $t('根据判定类型加权（战斗：根骨50%+灵性30%+气运20%，修炼：悟性50%+灵性30%+心性20%）') }}</li>
              <li><strong>{{ $t('后天') }}</strong>：{{ $t('对应后天六司加权 ÷ 5') }}</li>
              <li><strong>{{ $t('境界') }}</strong>：{{ $t('炼气5 | 筑基12 | 金丹20 | 元婴30...（阶段：初期+0，中期+2，后期+4，圆满+6）') }}</li>
              <li><strong>{{ $t('装备') }}</strong>：{{ $t('装备提供的加成') }}</li>
              <li><strong>{{ $t('功法') }}</strong>：{{ $t('功法品质+熟练度') }}</li>
              <li><strong>{{ $t('状态') }}</strong>：{{ $t('buff/debuff效果') }}</li>
            </ol>
          </div>

          <div class="help-section">
            <h4>🎯 {{ $t('判定结果') }}</h4>
            <div class="formula-note">
              <strong>{{ $t('判定规则') }}</strong>: {{ $t('判定值与难度对比，完全基于属性、境界和加成') }}
            </div>
            <div class="result-list">
              <div class="result-item perfect">
                <span class="result-label">{{ $t('完美') }}</span>
                <span class="result-desc">{{ $t('判定值 ≥ 难度+30') }}</span>
              </div>
              <div class="result-item great-success">
                <span class="result-label">{{ $t('大成功') }}</span>
                <span class="result-desc">{{ $t('判定值 ≥ 难度+15，超额完成') }}</span>
              </div>
              <div class="result-item success">
                <span class="result-label">{{ $t('成功') }}</span>
                <span class="result-desc">{{ $t('判定值 ≥ 难度，达成目标') }}</span>
              </div>
              <div class="result-item failure">
                <span class="result-label">{{ $t('失败') }}</span>
                <span class="result-desc">{{ $t('判定值 < 难度，未达成') }}</span>
              </div>
              <div class="result-item critical-failure">
                <span class="result-label">{{ $t('大失败') }}</span>
                <span class="result-desc">{{ $t('判定值远低于难度（难度-15以下）') }}</span>
              </div>
            </div>
          </div>

          <div class="help-section">
            <h4>⚔️ {{ $t('判定类型与属性配比') }}</h4>
            <div class="judgement-types">
              <div class="type-item">
                <span class="type-name">{{ $t('战斗判定') }}</span>
                <span class="type-attrs">{{ $t('根骨50% + 灵性30% + 气运20%') }}</span>
              </div>
              <div class="type-item">
                <span class="type-name">{{ $t('修炼判定') }}</span>
                <span class="type-attrs">{{ $t('悟性50% + 灵性30% + 心性20%') }}</span>
              </div>
              <div class="type-item">
                <span class="type-name">{{ $t('技艺判定') }}</span>
                <span class="type-attrs">{{ $t('悟性50% + 根骨30% + 灵性20%') }}</span>
              </div>
              <div class="type-item">
                <span class="type-name">{{ $t('社交判定') }}</span>
                <span class="type-attrs">{{ $t('魅力50% + 悟性30% + 心性20%') }}</span>
              </div>
              <div class="type-item">
                <span class="type-name">{{ $t('探索判定') }}</span>
                <span class="type-attrs">{{ $t('气运50% + 灵性30% + 悟性20%') }}</span>
              </div>
            </div>
          </div>

          <div class="help-section">
            <h4>📖 {{ $t('六司属性说明') }}</h4>
            <div class="attributes-desc">
              <div class="attr-card">
                <div class="attr-header">
                  <span class="attr-icon">💪</span>
                  <span class="attr-name">{{ $t('根骨') }}</span>
                </div>
                <p>{{ $t('决定气血上限、恢复速度、寿命上限。影响炼体修行、抗打击能力。') }}</p>
              </div>
              <div class="attr-card">
                <div class="attr-header">
                  <span class="attr-icon">✨</span>
                  <span class="attr-name">{{ $t('灵性') }}</span>
                </div>
                <p>{{ $t('决定灵气上限、吸收效率。影响修炼速度、法术威力。') }}</p>
              </div>
              <div class="attr-card">
                <div class="attr-header">
                  <span class="attr-icon">🧠</span>
                  <span class="attr-name">{{ $t('悟性') }}</span>
                </div>
                <p>{{ $t('决定神识上限、学习效率。影响功法领悟、技能掌握速度。') }}</p>
              </div>
              <div class="attr-card">
                <div class="attr-header">
                  <span class="attr-icon">🍀</span>
                  <span class="attr-name">{{ $t('气运') }}</span>
                </div>
                <p>{{ $t('决定各种概率、物品掉落品质。影响天材地宝获取、贵人相助。') }}</p>
              </div>
              <div class="attr-card">
                <div class="attr-header">
                  <span class="attr-icon">🌺</span>
                  <span class="attr-name">{{ $t('魅力') }}</span>
                </div>
                <p>{{ $t('决定初始好感度、社交加成。影响NPC互动、门派声望获取。') }}</p>
              </div>
              <div class="attr-card">
                <div class="attr-header">
                  <span class="attr-icon">💎</span>
                  <span class="attr-name">{{ $t('心性') }}</span>
                </div>
                <p>{{ $t('决定心魔抗性、意志力。影响走火入魔抵抗、关键抉择。') }}</p>
              </div>
            </div>
          </div>

          <div class="help-section">
            <h4>💡 {{ $t('提升判定成功率') }}</h4>
            <ul class="tips-list">
              <li>{{ $t('先天六司：天赋决定上限，无法改变但影响最大') }}</li>
              <li>{{ $t('提升境界：境界越高，判定基础加成越大（炼气+5，筑基+12...）') }}</li>
              <li>{{ $t('修炼后天：后天六司可提升，但权重仅20%') }}</li>
              <li>{{ $t('学习功法：高品质功法和技能熟练度提供显著加成') }}</li>
              <li>{{ $t('装备法器：合适的装备能大幅提升判定值') }}</li>
              <li>{{ $t('状态效果：buff增强判定，注意避免debuff') }}</li>
              <li>{{ $t('境界压制：高境界对低境界有明显优势，但不是绝对') }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick, onUnmounted } from 'vue'
import { novelAIService } from '@/services/novelAIService'
import { imageCacheService, generateCacheKey } from '@/services/imageCacheService'
import { useNovelAIStore } from '@/stores/novelAIStore'
import { toast } from '@/utils/toast'
import ImagePreviewModal from './ImagePreviewModal.vue'
import TagEditModal from './TagEditModal.vue'

const showHelpModal = ref(false)
const showPreviewModal = ref(false)
const showTagEditModal = ref(false)
const editingTags = ref('')
const editingImageId = ref('')
const editingMarker = ref<ImageMarkerData | null>(null)

// 长按相关
const longPressTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const longPressThreshold = 500 // 长按阈值 500ms
const longPressTriggered = ref(false) // 标记长按是否真的完成触发

// 保存当前预览的 marker（用于重新生成）
const previewMarker = ref<ImageMarkerData | null>(null)

// 并发生成锁 - 防止重复触发
const pendingGenerations = ref<Set<string>>(new Set())

// 获取 Pinia Store
const novelAIStore = useNovelAIStore()

// 图片预览状态
const previewImage = ref<string | null>(null)
const previewTags = ref('')

// 图像状态类型
interface ImageState {
  loading: boolean
  imageData: string | null
  error: string | null
}

// 获取图像状态（从 store）
function getImageState(id: string): ImageState | null {
  return novelAIStore.getImageState(id)
}

// 生成图像 - 带防重复机制
async function generateImage(marker: ImageMarkerData, forceRegenerate = false) {
  const id = marker.id

  // 获取当前状态（从全局 store，跨组件实例共享）
  const existingState = novelAIStore.getImageState(id)

  // 检查是否已经在 store 中标记为加载中（跨组件实例有效）
  // 这可以防止 UI 切换时新组件实例重复触发请求
  if (existingState?.loading) {
    console.log(`[NovelAI] 图片 ${id} 在 store 中已标记为加载中，跳过重复请求`)
    return
  }

  // 检查是否已经在当前组件实例的生成队列中（本地防抖）
  if (pendingGenerations.value.has(id)) {
    console.log(`[NovelAI] 图片 ${id} 在本地队列中，跳过重复请求`)
    return
  }

  // 如果不是强制重新生成，且已有完成的图片，跳过
  if (!forceRegenerate && existingState?.imageData) {
    console.log(`[NovelAI] 图片 ${id} 已生成，跳过`)
    return
  }

  // 标记为正在生成
  pendingGenerations.value.add(id)

  // 设置加载状态
  novelAIStore.startGeneration(id)

  try {
    const result = await novelAIService.generateImage({ tags: marker.tags })

    if (result.success && result.imageBase64) {
      novelAIStore.completeGeneration(id, true, result.imageBase64)
    } else {
      novelAIStore.completeGeneration(id, false, undefined, result.error || '生成失败')
    }
  } catch (e) {
    novelAIStore.completeGeneration(id, false, undefined, e instanceof Error ? e.message : '未知错误')
  } finally {
    // 移除生成锁
    pendingGenerations.value.delete(id)
  }
}

// 重新生成图像（强制重新生成）
function regenerateImage(marker: ImageMarkerData) {
  // 清除现有状态，强制重新生成
  novelAIStore.clearImageState(marker.id)
  generateImage(marker, true)
}

// 处理图片点击 - 单击打开预览
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
    openImagePreview(imageData, marker.tags, marker)
  }
}

// 打开图片预览
function openImagePreview(imageData: string, tags: string, marker: ImageMarkerData) {
  previewImage.value = imageData
  previewTags.value = tags
  previewMarker.value = marker
  showPreviewModal.value = true
}

// 关闭图片预览
function closeImagePreview() {
  showPreviewModal.value = false
  previewImage.value = null
  previewTags.value = ''
  previewMarker.value = null
}

// 预览弹窗下载回调
function onPreviewDownload() {
  toast.success('图片已下载')
}

// 预览弹窗重新生成回调
function onPreviewRegenerate() {
  if (previewMarker.value) {
    regenerateImage(previewMarker.value)
    closeImagePreview()
    toast.success('正在重新生成图片')
  }
}

// 长按开始
function startLongPress(event: MouseEvent | TouchEvent, marker: ImageMarkerData) {
  // 阻止默认行为（移动端长按可能触发上下文菜单）
  if (event.type === 'touchstart') {
    // 不阻止默认行为，避免影响滚动
  }

  cancelLongPress()
  editingMarker.value = marker
  longPressTriggered.value = false // 重置标记

  longPressTimer.value = setTimeout(() => {
    longPressTriggered.value = true // 标记长按真的触发了
    // 触发 tag 编辑
    openTagEditModal(marker)
    longPressTimer.value = null
  }, longPressThreshold)
}

// 取消长按
function cancelLongPress() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

// 打开 tag 编辑弹窗
function openTagEditModal(marker: ImageMarkerData) {
  editingTags.value = marker.tags
  editingImageId.value = marker.id
  editingMarker.value = marker
  showTagEditModal.value = true
}

// 关闭 tag 编辑弹窗
function closeTagEditModal() {
  showTagEditModal.value = false
  editingTags.value = ''
  editingImageId.value = ''
  editingMarker.value = null
}

// 保存编辑后的 tags（不自动重新生成）
function saveEditedTags(newTags: string) {
  if (editingMarker.value) {
    // 更新 marker 的 tags（这里只是更新内存中的数据）
    editingMarker.value.tags = newTags
    toast.success('标签已保存')
  }
  closeTagEditModal()
}

// 保存 tags 并重新生成图片
function saveTagsAndRegenerate(newTags: string) {
  if (editingMarker.value) {
    editingMarker.value.tags = newTags
    regenerateImage(editingMarker.value)
    toast.success('标签已保存，正在重新生成图片')
  }
  closeTagEditModal()
}

// 组件卸载时清理
onUnmounted(() => {
  cancelLongPress()
})

// 截断标签显示
function truncateTags(tags: string): string {
  if (tags.length <= 30) return tags
  return tags.slice(0, 30) + '...'
}

const showJudgementHelp = () => {
  showHelpModal.value = true
}

const closeHelpModal = () => {
  showHelpModal.value = false
}

interface JudgementData {
  title: string
  result: '成功' | '失败' | '完美' | '大成功' | '大失败' | string
  dice: string
  attribute: string
  difficulty?: string
  bonus?: string
  finalValue?: string
  damage?: string
  remainingHp?: string
  details?: string[]
}

interface ImageMarkerData {
  id: string
  tags: string
  originalText: string
}

interface TextPart {
  type: 'environment' | 'psychology' | 'dialogue' | 'judgement-card' | 'normal' | 'quote' | 'image-marker' | 'html'
  content: string | JudgementData | ImageMarkerData
}

// 安全 HTML 白名单配置
const ALLOWED_HTML_TAGS = [
  'font', 'span', 'b', 'i', 'u', 's', 'strong', 'em', 'mark', 'small', 'big',
  'sub', 'sup', 'del', 'ins', 'code', 'kbd', 'var', 'samp', 'abbr', 'cite',
  'ruby', 'rt', 'rp', 'bdi', 'bdo', 'wbr', 'br'
]

const ALLOWED_HTML_ATTRS = [
  'color', 'size', 'face', 'style', 'class', 'title', 'lang', 'dir'
]

// 危险样式属性（需要过滤）
const DANGEROUS_STYLE_PATTERNS = [
  /expression\s*\(/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /data\s*:/gi,
  /-moz-binding/gi,
  /behavior\s*:/gi,
  /url\s*\(/gi,
]

// 安全过滤 HTML 内容
function sanitizeHtml(html: string): string {
  // 创建临时 DOM 解析器
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const container = doc.body.firstChild as HTMLElement

  if (!container) return ''

  // 递归清理节点
  function cleanNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode()
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null
    }

    const element = node as HTMLElement
    const tagName = element.tagName.toLowerCase()

    // 检查标签是否在白名单中
    if (!ALLOWED_HTML_TAGS.includes(tagName)) {
      // 不在白名单中，只保留子节点内容
      const fragment = document.createDocumentFragment()
      element.childNodes.forEach(child => {
        const cleanedChild = cleanNode(child)
        if (cleanedChild) {
          fragment.appendChild(cleanedChild)
        }
      })
      return fragment
    }

    // 创建安全的元素
    const cleanElement = document.createElement(tagName)

    // 过滤属性
    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase()

      // 检查属性是否在白名单中
      if (!ALLOWED_HTML_ATTRS.includes(attrName)) {
        continue
      }

      // 事件处理器属性直接跳过
      if (attrName.startsWith('on')) {
        continue
      }

      const attrValue = attr.value

      // 特殊处理 style 属性
      if (attrName === 'style') {
        // 检查是否包含危险模式
        let isSafe = true
        for (const pattern of DANGEROUS_STYLE_PATTERNS) {
          if (pattern.test(attrValue)) {
            isSafe = false
            break
          }
        }
        if (!isSafe) {
          continue
        }
      }

      cleanElement.setAttribute(attrName, attrValue)
    }

    // 递归处理子节点
    element.childNodes.forEach(child => {
      const cleanedChild = cleanNode(child)
      if (cleanedChild) {
        cleanElement.appendChild(cleanedChild)
      }
    })

    return cleanElement
  }

  const cleanedContainer = document.createElement('div')
  container.childNodes.forEach(child => {
    const cleanedChild = cleanNode(child)
    if (cleanedChild) {
      cleanedContainer.appendChild(cleanedChild)
    }
  })

  return cleanedContainer.innerHTML
}

// 检测文本中是否包含 HTML 标签
function containsHtmlTags(text: string): boolean {
  // 匹配常见的 HTML 标签
  const htmlTagPattern = /<\/?(?:font|span|b|i|u|s|strong|em|mark|small|big|sub|sup|del|ins|code|kbd|var|samp|abbr|cite|ruby|rt|rp|bdi|bdo|wbr|br)\b[^>]*>/i
  return htmlTagPattern.test(text)
}

const isJudgementData = (content: string | JudgementData | ImageMarkerData): content is JudgementData => {
  return typeof content === 'object' && content !== null && 'title' in content
}

const isImageMarkerData = (content: string | JudgementData | ImageMarkerData): content is ImageMarkerData => {
  return typeof content === 'object' && content !== null && 'tags' in content && 'id' in content
}

const props = defineProps<{
  text: string
}>()

// 获取 Novel AI 配置中的标记设置
const getImageMarkers = () => {
  const config = novelAIService.getConfig()
  return {
    startMarker: config.startMarker || 'image###',
    endMarker: config.endMarker || '###',
    enabled: config.enabled,
    autoGenerate: config.autoGenerate
  }
}

// 生成稳定的 ID（仅基于 tags 内容哈希，不依赖位置）
// 这样在流式传输时 UI 重新渲染不会因为位置变化而生成新 ID
const generateStableMarkerId = (tags: string, _position?: number) => {
  // 只使用 tags 内容作为哈希，忽略位置参数
  // 这确保同样的 tags 在任何位置都生成相同的 ID
  let hash = 0
  const str = tags.trim().toLowerCase() // 规范化处理
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `img_${Math.abs(hash).toString(36)}`
}

// 从缓存恢复图片状态
async function tryRestoreFromCache(marker: ImageMarkerData) {
  const id = marker.id

  // 如果已经有状态（正在加载或已加载），跳过
  if (novelAIStore.getImageState(id)) return

  try {
    const config = novelAIService.getConfig()
    const preset = config.currentPreset ? novelAIService.getPreset(config.currentPreset) : null

    // 构建缓存键参数
    const cacheParams = {
      tags: marker.tags,
      presetName: preset?.name || '',
      fixedPrompt: preset?.fixedPrompt || '',
      fixedPrompt_end: preset?.fixedPrompt_end || '',
      negativePrompt: preset?.negativePrompt || '',
      model: config.model,
      sampler: config.sampler,
      width: config.width,
      height: config.height,
      steps: config.steps,
      cfg: config.promptGuidance,
      seed: config.seed // seed 为 0 时每次生成不同，无法匹配缓存
    }

    // 只有非随机 seed 时才尝试从缓存恢复
    if (config.seed !== 0) {
      const cacheKey = await generateCacheKey(cacheParams)
      const cached = await imageCacheService.get(cacheKey)

      if (cached) {
        novelAIStore.setImageState(id, {
          loading: false,
          imageData: cached.imageBase64,
          error: null
        })
        console.log(`[NovelAI] 从缓存恢复图片: ${id}`)
        return
      }
    }

    // 没有缓存，尝试用最近的任意匹配
    // 这里可以扩展为更智能的匹配逻辑
  } catch (e) {
    console.warn('[NovelAI] 缓存恢复失败:', e)
  }
}

const parsedText = computed(() => {
  const parts: TextPart[] = []
  const text = props.text || ''

  if (!text.trim()) {
    return [{ type: 'normal', content: text }]
  }

  // 获取图像标记配置
  const { startMarker, endMarker, enabled: imageEnabled } = getImageMarkers()

  let currentIndex = 0
  // 统一换行并规范化引号（压缩重复的中英文引号，避免解析异常）
  // 🔥 增强：将各种Unicode引号统一转换为标准引号，并处理转义反斜杠
  const processedText = text
    .replace(/\\\\/g, '\n')     // 处理 \\ 转义的换行符
    .replace(/\\n/g, '\n')       // 处理 \n 换行符
    .replace(/\r\n/g, '\n')      // 统一 Windows 换行符
    .replace(/\r/g, '\n')        // 统一 Mac 换行符

  while (currentIndex < processedText.length) {
    // 查找标记的顺序：先找最近的开始标记
    const markers = []

    // 环境描写 【】
    const envStart = processedText.indexOf('【', currentIndex)
    if (envStart !== -1) {
      const envEnd = processedText.indexOf('】', envStart + 1)
      if (envEnd !== -1) {
        markers.push({
          start: envStart,
          end: envEnd + 1,
          type: 'environment' as const,
          contentStart: envStart + 1,
          contentEnd: envEnd
        })
      }
    }

    // 心理描写 ``
    const psyStart = processedText.indexOf('`', currentIndex)
    if (psyStart !== -1) {
      const psyEnd = processedText.indexOf('`', psyStart + 1)
      if (psyEnd !== -1) {
        markers.push({
          start: psyStart,
          end: psyEnd + 1,
          type: 'psychology' as const,
          contentStart: psyStart + 1,
          contentEnd: psyEnd
        })
      }
    }

    // 对话：半角双引号 ""
    const dialogStart = processedText.indexOf('"', currentIndex)
    if (dialogStart !== -1) {
      const dialogEnd = processedText.indexOf('"', dialogStart + 1)
      if (dialogEnd !== -1) {
        markers.push({
          start: dialogStart,
          end: dialogEnd + 1,
          type: 'dialogue' as const,
          contentStart: dialogStart + 1,
          contentEnd: dialogEnd
        })
      }
    }

    // 引用/独白：中文引号 “ ”
    const quoteStart = processedText.indexOf('“', currentIndex)
    if (quoteStart !== -1) {
      const quoteEnd = processedText.indexOf('”', quoteStart + 1)
      if (quoteEnd !== -1) {
        markers.push({
          start: quoteStart,
          end: quoteEnd + 1,
          type: 'quote' as const,
          // 包含引号本身
          contentStart: quoteStart,
          contentEnd: quoteEnd + 1
        })
      }
    }

    // 🔥 新增：书名号「」也解析为对话
    const bookQuoteStart = processedText.indexOf('「', currentIndex)
    if (bookQuoteStart !== -1) {
      const bookQuoteEnd = processedText.indexOf('」', bookQuoteStart + 1)
      if (bookQuoteEnd !== -1) {
        markers.push({
          start: bookQuoteStart,
          end: bookQuoteEnd + 1,
          type: 'dialogue' as const,
          // 包含书名号本身
          contentStart: bookQuoteStart,
          contentEnd: bookQuoteEnd + 1
        })
      }
    }

    // 判定结果 〖〗
    const judgementStart = processedText.indexOf('〖', currentIndex)
    if (judgementStart !== -1) {
      const judgementEnd = processedText.indexOf('〗', judgementStart + 1)
      if (judgementEnd !== -1) {
        markers.push({
          start: judgementStart,
          end: judgementEnd + 1,
          type: 'judgement' as const,
          contentStart: judgementStart + 1,
          contentEnd: judgementEnd
        })
      }
    }

    // 🎨 HTML 标签检测 (如: <font color="steelblue">text</font>)
    // 匹配开放标签和自闭合标签
    const htmlTagPatterns = ALLOWED_HTML_TAGS.map(tag => {
      // 匹配 <tag ...>...</tag> 或 <tag ... />
      const openTagPattern = `<${tag}\\b[^>]*>`
      const closeTagPattern = `</${tag}>`
      return { tag, openTagPattern, closeTagPattern }
    })

    // 查找 HTML 标签
    for (const { tag, openTagPattern, closeTagPattern } of htmlTagPatterns) {
      const openRegex = new RegExp(openTagPattern, 'gi')
      let match
      let searchPos = currentIndex

      while ((match = openRegex.exec(processedText)) !== null) {
        if (match.index < searchPos) continue

        const openTagStart = match.index
        const openTagEnd = openTagStart + match[0].length

        // 对于自闭合标签如 <br /> 或 <wbr>
        if (match[0].endsWith('/>') || ['br', 'wbr'].includes(tag)) {
          markers.push({
            start: openTagStart,
            end: openTagEnd,
            type: 'html' as const,
            contentStart: openTagStart,
            contentEnd: openTagEnd
          })
          continue
        }

        // 查找对应的闭合标签
        const closeRegex = new RegExp(closeTagPattern, 'gi')
        closeRegex.lastIndex = openTagEnd
        const closeMatch = closeRegex.exec(processedText)

        if (closeMatch) {
          markers.push({
            start: openTagStart,
            end: closeMatch.index + closeMatch[0].length,
            type: 'html' as const,
            contentStart: openTagStart,
            contentEnd: closeMatch.index + closeMatch[0].length
          })
        }
      }
    }

    // 🎨 图像标记 (如: image###tags###)
    if (imageEnabled && startMarker && endMarker) {
      let imgSearchPos = currentIndex
      while (imgSearchPos < processedText.length) {
        const imgStart = processedText.indexOf(startMarker, imgSearchPos)
        if (imgStart === -1) break

        const imgEnd = processedText.indexOf(endMarker, imgStart + startMarker.length)
        if (imgEnd === -1) break

        markers.push({
          start: imgStart,
          end: imgEnd + endMarker.length,
          type: 'image' as const,
          contentStart: imgStart + startMarker.length,
          contentEnd: imgEnd
        })

        imgSearchPos = imgEnd + endMarker.length
      }
    }

    // 过滤和排序标记
    const validMarkers = markers
      .filter(m => m.start >= currentIndex && m.contentStart < m.contentEnd)
      .sort((a, b) => a.start - b.start)

    if (validMarkers.length === 0) {
      // 没有更多标记，剩余的都是普通文本
      if (currentIndex < processedText.length) {
        parts.push({
          type: 'normal',
          content: processedText.slice(currentIndex)
        })
      }
      break
    }

    const nextMarker = validMarkers[0]

    // 添加标记前的普通文本
    if (nextMarker.start > currentIndex) {
      const normalText = processedText.slice(currentIndex, nextMarker.start)
      if (normalText) {
        parts.push({
          type: 'normal',
          content: normalText
        })
      }
    }

    // 添加标记内容
    const markedContent = processedText.slice(nextMarker.contentStart, nextMarker.contentEnd)
    if (markedContent.trim()) {
      if (nextMarker.type === 'judgement') {
        // 增强的判定解析
        // 支持格式: "修炼判定:完美,骰点:45,灵性:8,加成:12,最终值:65,难度:50"
        const contentParts = markedContent.split(',').map(p => p.trim())

        if (contentParts.length >= 1) {
          const titleResult = contentParts[0].split(':')

          if (titleResult.length === 2) {
            const judgement: JudgementData = {
              title: titleResult[0].trim(),
              result: titleResult[1].trim(),
              dice: '未知',
              attribute: '',
              details: []
            }

            // 解析所有其他字段
            for (let i = 1; i < contentParts.length; i++) {
              const part = contentParts[i]
              const [key, value] = part.split(':').map(s => s.trim())

              if (!key || !value) continue

              if (key.includes('难度')) {
                judgement.difficulty = value
              } else if (key.includes('判定值')) {
                judgement.finalValue = value
              } else if (key.includes('加成')) {
                judgement.bonus = value
              } else if (key.includes('最终值') || key.includes('总值')) {
                judgement.finalValue = value
              } else if (key.includes('造成伤害')) {
                judgement.damage = value
              } else if (key.includes('剩余气血')) {
                judgement.remainingHp = value
              } else {
                // 通用字段处理：自动识别所有加成字段（先天、后天、境界、装备、功法、状态、天赋、大道、阵法、法宝等）
                judgement.details?.push(`${key}:${value}`)
              }
            }

            parts.push({
              type: 'judgement-card',
              content: judgement
            })
          } else if (titleResult.length === 1) {
            // 处理简单系统提示格式，如"系统提示：星屑吊坠效果触发，悟性+2，灵性+2，凝神静气效果生效。"
            const judgement: JudgementData = {
              title: '系统提示',
              result: markedContent.trim(),
              dice: '',
              attribute: '',
              details: []
            }

            // 解析所有其他字段
            for (let i = 1; i < contentParts.length; i++) {
              const part = contentParts[i]
              const [key, value] = part.split(':').map(s => s.trim())

              if (!key || !value) continue

              if (key.includes('难度')) {
                judgement.difficulty = value
              } else if (key.includes('加成')) {
                judgement.bonus = value
              } else if (key.includes('最终值') || key.includes('总值')) {
                judgement.finalValue = value
              } else if (key.match(/^[^\d\s]+$/)) {
                // 属性名(如"灵性"、"悟性"等)
                if (!judgement.attribute) {
                  judgement.attribute = `${key}:${value}`
                } else {
                  judgement.details?.push(`${key}:${value}`)
                }
              } else {
                // 其他信息放入详情
                judgement.details?.push(part)
              }
            }

            parts.push({
              type: 'judgement-card',
              content: judgement
            })
          } else {
            // 解析失败，作为普通文本处理
            parts.push({ type: 'normal', content: `〖${markedContent}〗` })
          }
        } else {
          // 解析失败，作为普通文本处理
          parts.push({ type: 'normal', content: `〖${markedContent}〗` })
        }
      } else if (nextMarker.type === 'html') {
        // HTML 标签内容直接保留
        parts.push({
          type: 'html',
          content: markedContent
        })
      } else if (nextMarker.type === 'image') {
        // 解析图像标记
        const tags = processedText.slice(nextMarker.contentStart, nextMarker.contentEnd).trim()
        if (tags) {
          // 使用稳定的 ID，基于标记位置和内容
          const stableId = generateStableMarkerId(tags, nextMarker.start)

          const imageMarker: ImageMarkerData = {
            id: stableId,
            tags: tags,
            originalText: processedText.slice(nextMarker.start, nextMarker.end)
          }
          parts.push({
            type: 'image-marker',
            content: imageMarker
          })

          // 尝试从缓存恢复（异步操作，不阻塞渲染）
          nextTick(() => {
            if (!novelAIStore.getImageState(stableId)) {
              tryRestoreFromCache(imageMarker)
            }
          })

          // 如果开启自动生成，则自动触发生成
          const { autoGenerate } = getImageMarkers()
          if (autoGenerate) {
            // 使用 nextTick 避免在 computed 中直接修改响应式状态
            nextTick(() => {
              const existingState = novelAIStore.getImageState(imageMarker.id)
              // 只有在没有状态、没有已生成的图片、没有正在加载、且没有在 pending 队列中时才触发生成
              if (!existingState?.imageData && !existingState?.loading && !pendingGenerations.value.has(imageMarker.id)) {
                generateImage(imageMarker)
              }
            })
          }
        }
      } else {
        parts.push({
          type: nextMarker.type,
          content: processedText.slice(nextMarker.start, nextMarker.end)
        })
      }
    }

    currentIndex = nextMarker.end
  }

  return parts.length > 0 ? parts : [{ type: 'normal', content: text }]
})

const getPartClass = (type: string) => {
  return {
    'text-environment': type === 'environment',
    'text-psychology': type === 'psychology',
    'text-dialogue': type === 'dialogue',
    'text-quote': type === 'quote',
    'text-normal': type === 'normal',
    'text-html': type === 'html'
  }
}

// 判断成功/失败的辅助函数
const isSuccessResult = (result: string) => {
  return ['成功', '大成功', '完美', '通过'].includes(result)
}

const isFailureResult = (result: string) => {
  return ['失败', '大失败', '失败惨重', '未通过'].includes(result)
}

// 解析详情字段的辅助函数
const parseDetailLabel = (detail: string) => {
  const parts = detail.split(':')
  return parts[0] + ':'
}

const parseDetailValue = (detail: string) => {
  const parts = detail.split(':')
  if (parts.length < 2) return ''

  // 提取数值部分（可能包含括号内容）
  const valueWithSource = parts[1]
  const match = valueWithSource.match(/^([+-]?\d+)/)
  return match ? match[1] : valueWithSource.split('(')[0].trim()
}

const parseDetailSource = (detail: string) => {
  const parts = detail.split(':')
  if (parts.length < 2) return ''

  // 提取括号内的来源信息
  const valueWithSource = parts[1]
  const match = valueWithSource.match(/\(([^)]+)\)/)
  return match ? `(${match[1]})` : ''
}

</script>

<style scoped>
.formatted-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  text-align: justify;
  text-indent: 2em;
  margin: 0;
  line-height: 1.8;
  padding-bottom: 1.5rem;
}

/* 环境描写 - 青色 */
.text-environment {
  color: #0891b2;
  font-weight: 500;
}

/* 心理描写 - 紫色 */
.text-psychology {
  color: #7c3aed;
  font-style: italic;
  font-weight: 500;
}

/* 对话 - 橙色 */
.text-dialogue {
  color: #d97706;
  font-weight: 500;
}

/* 引用/独白 - 橙色斜体 */
.text-quote {
  color: rgb(254 125 0);
  font-style: italic;
}

/* 普通文本 */
.text-normal {
  color: var(--color-text, #1a1a1a);
}

/* HTML 渲染内容 */
.text-html {
  /* 继承父级样式 */
}

.text-html :deep(font),
.text-html :deep(span) {
  /* 允许 HTML 标签的样式生效 */
}

/* 判定卡片样式 - 重新设计 */
.judgement-card {
  display: flex;
  gap: 1rem;
  margin: 1.25rem 0;
  padding: 1.25rem;
  background: linear-gradient(135deg, #fefefe 0%, #f8f9fa 100%);
  border-radius: 16px;
  border: 2px solid #e2e8f0;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.04),
    0 4px 16px rgba(0, 0, 0, 0.02);
  text-indent: 0;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.judgement-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--card-color, #6366f1) 50%,
    transparent 100%);
}

.judgement-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.06),
    0 8px 24px rgba(0, 0, 0, 0.04);
}

/* 成功状态 */
.judgement-card.is-success {
  border-color: #86efac;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  --card-color: #10b981;
}

.judgement-card.is-great-success {
  border-color: #fbbf24;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  --card-color: #f59e0b;
  animation: pulse-success 2s ease-in-out infinite;
}

/* 失败状态 */
.judgement-card.is-failure {
  border-color: #fca5a5;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  --card-color: #ef4444;
}

.judgement-card.is-great-failure {
  border-color: #c084fc;
  background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
  --card-color: #a855f7;
  animation: pulse-failure 2s ease-in-out infinite;
}

@keyframes pulse-success {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(251, 191, 36, 0); }
}

@keyframes pulse-failure {
  0%, 100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(168, 85, 247, 0); }
}

/* 图标区域 */
.card-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 12px;
  border: 2px solid var(--card-color, #6366f1);
  color: var(--card-color, #6366f1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 内容区域 */
.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* 标题行 */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.judgement-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
  opacity: 1;
}

.judgement-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.875rem;
  background: var(--card-color, #6366f1);
  color: white;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  opacity: 1;
}

/* 统计信息行 */
.card-body {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: white;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  min-width: fit-content;
}

.difficulty-item {
  min-width: 120px;
}

.details-list {
  width: 100%;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e2e8f0;
}

.detail-item {
  font-size: 0.875rem;
  color: #64748b;
  padding: 0.25rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.detail-item::before {
  content: '•';
  color: #94a3b8;
}

.detail-label {
  font-weight: 600;
  color: #475569;
}

.detail-value {
  font-weight: 700;
  color: #1e293b;
  min-width: 2rem;
}

.detail-source {
  font-size: 0.75rem;
  color: #94a3b8;
  font-style: italic;
}


.stat-icon {
  font-size: 1.375rem;
  line-height: 1;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
}

.dice-roll, .attribute-check {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem;
  background: var(--color-surface-light, #ebe9e6);
  border-radius: 8px;
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
  transition: all 0.2s ease;
  text-align: center;
}

.dice-roll:hover, .attribute-check:hover {
  background: var(--color-surface, #f2f1ee);
  transform: translateY(-1px);
}

.dice-roll .label, .attribute-check .label {
  font-size: 0.8em;
  color: var(--color-text-secondary, #666666);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.dice-roll .value, .attribute-check .value {
  font-size: 1.4em;
  font-weight: 700;
  color: var(--color-text, #1a1a1a);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.dice-roll .value {
  color: #6366f1;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 深色主题适配 */
[data-theme="dark"] .text-normal {
  color: var(--color-text, #f7f7f5);
}

[data-theme="dark"] .text-environment {
  color: #22d3ee;
}

[data-theme="dark"] .text-psychology {
  color: #a78bfa;
}

[data-theme="dark"] .text-dialogue {
  color: #fb923c;
}

[data-theme="dark"] .text-quote {
  color: rgb(254 125 0);
}

[data-theme="dark"] .judgement-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, var(--color-background, rgb(30, 41, 59)) 100%);
  border-color: var(--color-border, rgba(173, 216, 230, 0.5));
}

[data-theme="dark"] .card-header {
  color: var(--color-text, #f7f7f5);
}

[data-theme="dark"] .result-text,
[data-theme="dark"] .dice-roll,
[data-theme="dark"] .attribute-check {
  background: var(--color-surface-light, #414868);
  border-color: var(--color-border, rgba(173, 216, 230, 0.5));
}

[data-theme="dark"] .dice-roll .label,
[data-theme="dark"] .attribute-check .label {
  color: var(--color-text-secondary, #d0d0d0);
}

[data-theme="dark"] .dice-roll .value,
[data-theme="dark"] .attribute-check .value {
  color: var(--color-text, #f7f7f5);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.help-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #64748b;
}

.help-btn:hover {
  background: white;
  border-color: var(--card-color, #6366f1);
  color: var(--card-color, #6366f1);
  transform: scale(1.1);
}

.help-btn:active {
  transform: scale(0.95);
}

/* 帮助弹窗 */
.help-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.help-modal {
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.help-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.help-modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #64748b;
}

.close-btn:hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #ef4444;
}

.help-modal-content {
  padding: 1.5rem;
  overflow-y: auto;
  max-height: calc(80vh - 80px);
}

.help-section {
  margin-bottom: 1.5rem;
}

.help-section:last-child {
  margin-bottom: 0;
}

.help-section h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.help-section ol {
  margin: 0;
  padding-left: 1.5rem;
  color: var(--color-text-secondary);
  line-height: 1.8;
}

.help-section ol li {
  margin-bottom: 0.5rem;
}

.help-section ol li strong {
  color: var(--color-text);
  font-weight: 600;
}

.formula-box {
  padding: 1rem;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-left: 4px solid #f59e0b;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: #78350f;
}

.formula-box strong {
  color: #92400e;
  font-weight: 700;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1px solid;
  gap: 1rem;
}

.result-item.perfect {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border-color: #fbbf24;
}

.result-item.great-success {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #86efac;
}

.result-item.success {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #93c5fd;
}

.result-item.failure {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border-color: #fca5a5;
}

.result-item.critical-failure {
  background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
  border-color: #c084fc;
}

.result-label {
  font-weight: 700;
  font-size: 0.875rem;
  min-width: 60px;
  opacity: 1;
}

.result-desc {
  font-size: 0.875rem;
  flex: 1;
  opacity: 1;
}

/* -- 为不同结果类型设置文字颜色 -- */

/* 完美 */
.result-item.perfect .result-label,
.result-item.perfect .result-desc {
  color: #92400e;
}

/* 大成功 */
.result-item.great-success .result-label,
.result-item.great-success .result-desc {
  color: #14532d;
}

/* 成功 */
.result-item.success .result-label,
.result-item.success .result-desc {
  color: #1e40af;
}

/* 失败 */
.result-item.failure .result-label,
.result-item.failure .result-desc {
  color: #991b1b;
}

/* 大失败 */
.result-item.critical-failure .result-label,
.result-item.critical-failure .result-desc {
  color: #581c87;
}

.formula-note {
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-left: 4px solid #3b82f6;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: #1e40af;
}

.formula-note strong {
  color: #1e3a8a;
  font-weight: 700;
}

.tips-list {
  margin: 0;
  padding-left: 1.25rem;
  color: #475569;
  line-height: 1.8;
}

.tips-list li {
  margin-bottom: 0.5rem;
}

.judgement-types {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.type-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.type-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: #1e293b;
}

.type-attrs {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.attributes-desc {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 0.75rem;
}

.attr-card {
  padding: 0.75rem;
  background: linear-gradient(135deg, #fefefe 0%, #f8fafc 100%);
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.attr-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.attr-icon {
  font-size: 1.25rem;
}

.attr-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: #1e293b;
}

.attr-card p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* 深色主题适配 */
[data-theme="dark"] .help-modal {
  background: var(--color-surface, #1e293b);
  color: var(--color-text, #f7f7f5);
}

[data-theme="dark"] .help-modal-header {
  background: rgba(255, 255, 255, 0.05);
  border-bottom-color: var(--color-border, rgba(255, 255, 255, 0.1));
}

[data-theme="dark"] .help-modal-header h3,
[data-theme="dark"] .help-section h4 {
  color: var(--color-text, #f7f7f5);
}

[data-theme="dark"] .help-section ol,
[data-theme="dark"] .tips-list {
  color: var(--color-text-secondary, #94a3b8);
}

/* -- 深色主题下的结果文字颜色 -- */
[data-theme="dark"] .result-item.perfect .result-label,
[data-theme="dark"] .result-item.perfect .result-desc {
  color: #fcd34d;
}

[data-theme="dark"] .result-item.great-success .result-label,
[data-theme="dark"] .result-item.great-success .result-desc {
  color: #86efac;
}

[data-theme="dark"] .result-item.success .result-label,
[data-theme="dark"] .result-item.success .result-desc {
  color: #93c5fd;
}

[data-theme="dark"] .result-item.failure .result-label,
[data-theme="dark"] .result-item.failure .result-desc {
  color: #fca5a5;
}

[data-theme="dark"] .result-item.critical-failure .result-label,
[data-theme="dark"] .result-item.critical-failure .result-desc {
  color: #d8b4fe;
}

[data-theme="dark"] .close-btn {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--color-border, rgba(255, 255, 255, 0.1));
  color: var(--color-text-secondary, #94a3b8);
}

[data-theme="dark"] .close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}

[data-theme="dark"] .help-btn {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--color-border, rgba(255, 255, 255, 0.1));
  color: var(--color-text-secondary, #94a3b8);
}

[data-theme="dark"] .help-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--card-color, #6366f1);
  color: var(--card-color, #6366f1);
}

[data-theme="dark"] .type-item {
  background: rgba(255, 255, 255, 0.03);
  border-color: var(--color-border, rgba(255, 255, 255, 0.1));
}

[data-theme="dark"] .type-name {
  color: var(--color-text, #f7f7f5);
}

[data-theme="dark"] .type-attrs {
  color: var(--color-text-secondary, #94a3b8);
}

[data-theme="dark"] .attr-card {
  background: rgba(255, 255, 255, 0.03);
  border-color: var(--color-border, rgba(255, 255, 255, 0.1));
}

[data-theme="dark"] .attr-name {
  color: var(--color-text, #f7f7f5);
}

[data-theme="dark"] .attr-card p {
  color: var(--color-text-secondary, #94a3b8);
}

[data-theme="dark"] .formula-box {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%);
  border-left-color: #f59e0b;
  color: #fbbf24;
}

[data-theme="dark"] .formula-box strong {
  color: #fcd34d;
}

[data-theme="dark"] .detail-label {
  color: #94a3b8;
}

[data-theme="dark"] .detail-value {
  color: #f1f5f9;
}

[data-theme="dark"] .detail-source {
  color: #64748b;
}

/* ========== 仙侠风格图像标记样式 ========== */

.image-marker-container {
  display: block;
  margin: 1rem 0;
  text-indent: 0;
}

/* 仙侠风格生成按钮 - 小巧精致 - 使用伪元素实现渐变边框 */
.generate-image-btn-xiantu {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  background: rgba(15, 23, 42, 0.6);
  border: none;
  border-radius: 16px;
  color: #a78bfa;
  font-size: 0.8rem;
  font-family: var(--font-family-serif, 'SimSun', serif);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
  position: relative;
  overflow: visible;
  isolation: isolate;
}

/* 渐变边框 - 外层 */
.generate-image-btn-xiantu::before {
  content: '';
  position: absolute;
  inset: -1px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.7), rgba(167, 139, 250, 0.5), rgba(118, 75, 162, 0.7));
  border-radius: 17px;
  z-index: -2;
  transition: all 0.3s ease;
}

/* 内层背景 */
.generate-image-btn-xiantu::after {
  content: '';
  position: absolute;
  inset: 1px;
  background: rgba(15, 23, 42, 0.85);
  border-radius: 15px;
  z-index: -1;
  transition: all 0.3s ease;
}

.generate-image-btn-xiantu:hover {
  color: #c4b5fd;
  transform: translateY(-1px);
  box-shadow:
    0 4px 12px rgba(102, 126, 234, 0.35),
    0 0 15px rgba(167, 139, 250, 0.2);
}

.generate-image-btn-xiantu:hover::before {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.9), rgba(167, 139, 250, 0.7), rgba(118, 75, 162, 0.9));
}

.generate-image-btn-xiantu:hover::after {
  background: rgba(15, 23, 42, 0.75);
}

.generate-image-btn-xiantu:active {
  transform: translateY(0);
}

.btn-icon-xiantu {
  font-size: 0.9rem;
  color: #667eea;
  animation: twinkle 2s ease-in-out infinite;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

.btn-text-xiantu {
  font-weight: 500;
  letter-spacing: 0.05em;
}

/* 仙侠风格加载状态 */
.image-loading-xiantu {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.05));
  border-radius: 12px;
  border: 1px dashed rgba(102, 126, 234, 0.4);
  color: #a78bfa;
  font-size: 0.85rem;
  font-family: var(--font-family-serif, 'SimSun', serif);
}

.loading-spinner-xiantu {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(102, 126, 234, 0.2);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin-xiantu 1s linear infinite;
}

@keyframes spin-xiantu {
  to { transform: rotate(360deg); }
}

/* 仙侠风格错误状态 */
.image-error-xiantu {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.03));
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.image-error-xiantu .error-icon {
  font-size: 1rem;
}

.image-error-xiantu .error-text {
  flex: 1;
  color: #f87171;
  font-size: 0.8rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.retry-btn-xiantu {
  padding: 0.3rem 0.6rem;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn-xiantu:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
}

/* 仙侠风格已生成图片 - 无悬停按钮 */
.generated-image-wrapper-xiantu {
  position: relative;
  display: inline-block;
  max-width: 100%;
  border-radius: 10px;
  overflow: hidden;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.12),
    0 0 30px rgba(102, 126, 234, 0.08);
  transition: all 0.3s ease;
}

.generated-image-wrapper-xiantu:hover {
  box-shadow:
    0 6px 25px rgba(0, 0, 0, 0.18),
    0 0 40px rgba(102, 126, 234, 0.15);
}

.generated-image-xiantu {
  display: block;
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
  cursor: pointer;
  transition: transform 0.3s ease;
  user-select: none;
  -webkit-user-select: none;
}

.generated-image-xiantu:hover {
  transform: scale(1.01);
}

/* 提示文字（可选，用于提示用户交互） */
.generated-image-wrapper-xiantu::after {
  content: '单击预览 · 长按编辑标签';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.4rem;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.generated-image-wrapper-xiantu:hover::after {
  opacity: 1;
}

/* ========== 深色主题适配 - 仙侠图像相关 ========== */

[data-theme="dark"] .generate-image-btn-xiantu {
  color: #c4b5fd;
  background: rgba(15, 23, 42, 0.7);
}

[data-theme="dark"] .generate-image-btn-xiantu::before {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.6), rgba(167, 139, 250, 0.4), rgba(118, 75, 162, 0.6));
}

[data-theme="dark"] .generate-image-btn-xiantu::after {
  background: rgba(15, 23, 42, 0.9);
}

[data-theme="dark"] .generate-image-btn-xiantu:hover {
  color: #e9d5ff;
}

[data-theme="dark"] .generate-image-btn-xiantu:hover::before {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.8), rgba(167, 139, 250, 0.6), rgba(118, 75, 162, 0.8));
}

[data-theme="dark"] .image-loading-xiantu {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.08));
  border-color: rgba(102, 126, 234, 0.3);
}

[data-theme="dark"] .image-error-xiantu {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.06));
}

[data-theme="dark"] .image-error-xiantu .error-text {
  color: #fca5a5;
}

/* 亮色主题适配 */
[data-theme="light"] .generate-image-btn-xiantu {
  color: #7c3aed;
  background: rgba(248, 250, 252, 0.9);
}

[data-theme="light"] .generate-image-btn-xiantu::before {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.8), rgba(167, 139, 250, 0.6), rgba(118, 75, 162, 0.8));
}

[data-theme="light"] .generate-image-btn-xiantu::after {
  background: rgba(248, 250, 252, 0.95);
}

[data-theme="light"] .btn-icon-xiantu {
  color: #6366f1;
}

[data-theme="light"] .image-loading-xiantu {
  color: #7c3aed;
}

/* 响应式适配 */
@media (max-width: 640px) {
  .generate-image-btn-xiantu {
    padding: 0.35rem 0.6rem;
    font-size: 0.75rem;
  }

  .generated-image-xiantu {
    max-height: 280px;
  }

  .generated-image-wrapper-xiantu::after {
    font-size: 0.6rem;
    padding: 0.3rem;
  }
}
</style>
