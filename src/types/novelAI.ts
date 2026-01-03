/**
 * Novel AI 文生图功能类型定义
 */

// ============ 站点类型 ============
export type NovelAISite = 'official' | 'custom'

// ============ 模型选项 ============
export const NOVELAI_MODELS = [
  { value: 'nai-diffusion-4-5-full', label: 'NAI Diffusion V4.5 Full (全量版)' },
  { value: 'nai-diffusion-4-5-curated', label: 'NAI Diffusion V4.5 Curated (精选版)' },
  { value: 'nai-diffusion-4-full', label: 'NAI Diffusion V4 Full (全量版)' },
  { value: 'nai-diffusion-4-curated-preview', label: 'NAI Diffusion V4 Curated (精选预览版)' },
  { value: 'nai-diffusion-3', label: 'NAI Diffusion V3 (Anime)' },
] as const

export type NovelAIModel = typeof NOVELAI_MODELS[number]['value']

// ============ 采样器选项 ============
export const NOVELAI_SAMPLERS = [
  { value: 'k_euler', label: 'Euler' },
  { value: 'k_euler_ancestral', label: 'Euler Ancestral' },
  { value: 'k_dpmpp_2s_ancestral', label: 'DPM++ 2S Ancestral' },
  { value: 'k_dpmpp_2m', label: 'DPM++ 2M' },
  { value: 'k_dpmpp_2m_sde', label: 'DPM++ 2M SDE' },
  { value: 'k_dpmpp_sde', label: 'DPM++ SDE' },
] as const

export type NovelAISampler = typeof NOVELAI_SAMPLERS[number]['value']

// ============ 噪点表选项 ============
export const NOVELAI_NOISE_SCHEDULES = [
  { value: 'karras', label: 'Karras (推荐)' },
  { value: 'exponential', label: 'Exponential (指数级)' },
  { value: 'polyexponential', label: 'Polyexponential (多项式指数级)' },
] as const

export type NovelAINoiseSchedule = typeof NOVELAI_NOISE_SCHEDULES[number]['value']

// ============ 尺寸预设选项 ============
export const NOVELAI_SIZE_PRESETS = [
  { value: 'square_icon', label: '图标 (512×512) 1:1', width: 512, height: 512 },
  { value: 'square_icon_lg', label: '大图标 (640×640) 1:1', width: 640, height: 640 },
  { value: 'portrait_small', label: '竖版小 (512×768) 2:3', width: 512, height: 768 },
  { value: 'landscape_small', label: '横版小 (768×512) 3:2', width: 768, height: 512 },
  { value: 'square', label: '方形 SDXL (1024×1024) 1:1', width: 1024, height: 1024 },
  { value: 'landscape', label: '超高清横版 (1216×832) 19:13', width: 1216, height: 832 },
  { value: 'portrait', label: '超高清竖版 (832×1216) 13:19', width: 832, height: 1216 },
  { value: 'custom', label: '自定义 Custom', width: 0, height: 0 },
] as const

export type NovelAISizePreset = typeof NOVELAI_SIZE_PRESETS[number]['value']

// ============ Novel AI 配置接口 ============
export interface NovelAIConfig {
  /** 是否启用图像生成功能 */
  enabled: boolean

  // 模型与接口
  /** API 密钥 */
  apiKey: string
  /** 站点类型 */
  site: NovelAISite
  /** 自定义 API URL（当 site 为 custom 时使用） */
  customUrl: string
  /** 模型名称 */
  model: NovelAIModel

  // 采样与算法
  /** 采样方法 */
  sampler: NovelAISampler
  /** 噪点表 */
  noiseSchedule: NovelAINoiseSchedule
  /** 提示词引导 (CFG Scale)，范围 0-10 */
  promptGuidance: number
  /** 多样性增强 (SMEA) */
  variety: boolean
  /** AI 默认角色位置 */
  aiDefaultPosition: boolean

  // 尺寸与比例
  /** 预设尺寸 */
  sizePreset: NovelAISizePreset
  /** 宽度 */
  width: number
  /** 高度 */
  height: number

  // 渲染控制
  /** 生成步数，范围 1-50 */
  steps: number
  /** 种子，0 表示随机 */
  seed: number

  // 标记设置
  /** 开始标记，默认 image### */
  startMarker: string
  /** 结束标记，默认 ### */
  endMarker: string
  /** 检测到标记时自动生成 */
  autoGenerate: boolean

  // 当前选中的预设名称
  currentPreset: string
}

// ============ 提示词预设接口 ============
export interface NovelAIPromptPreset {
  /** 预设名称 */
  name: string
  /** 固定正面提示词（前置） */
  fixedPrompt: string
  /** 后置固定正面提示词 */
  fixedPrompt_end: string
  /** 负面提示词 */
  negativePrompt: string
}

// ============ 预设文件格式（兼容 SillyTavern 格式） ============
export interface NovelAIPresetFile {
  [presetName: string]: {
    fixedPrompt: string
    fixedPrompt_end: string
    negativePrompt: string
  }
}

// ============ 图像生成请求 ============
export interface NovelAIGenerateRequest {
  /** 从标记中提取的 tags */
  tags: string
  /** 使用的预设名称（可选） */
  preset?: string
  /** 自定义宽度（可选，覆盖配置） */
  width?: number
  /** 自定义高度（可选，覆盖配置） */
  height?: number
  /** 自定义种子（可选，覆盖配置） */
  seed?: number
  /** 自定义正面提示词（可选，覆盖预设） */
  positivePrompt?: string
  /** 自定义负面提示词（可选，覆盖预设） */
  negativePrompt?: string
}

// ============ 图像生成响应 ============
export interface NovelAIGenerateResponse {
  /** 是否成功 */
  success: boolean
  /** Base64 编码的图片数据 */
  imageBase64?: string
  /** 错误信息 */
  error?: string
  /** 实际使用的种子 */
  seed?: number
  /** 是否来自缓存 */
  fromCache?: boolean
}

// ============ 图像标记数据 ============
export interface ImageMarkerData {
  /** 唯一标识符 */
  markerId: string
  /** 提取的标签内容 */
  tags: string
  /** 原始标记文本 */
  rawMarker: string
}

// ============ 图片缓存条目 ============
export interface ImageCacheEntry {
  /** 缓存键 (hash) */
  id: string
  /** Base64 图片数据 */
  imageBase64: string
  /** 原始标签 */
  tags: string
  /** 使用的预设名称 */
  presetName: string
  /** 图片宽度 */
  width: number
  /** 图片高度 */
  height: number
  /** 实际使用的种子 */
  seed: number
  /** 创建时间戳 */
  createdAt: number
  /** 最后访问时间戳 */
  lastAccessedAt: number
  /** 图片大小 (bytes) */
  size: number
}

// ============ 缓存统计信息 ============
export interface ImageCacheStats {
  /** 总条目数 */
  totalEntries: number
  /** 总大小 (bytes) */
  totalSize: number
  /** 最早条目日期 */
  oldestEntry: Date | null
}

// ============ 缓存键参数 ============
export interface CacheKeyParams {
  /** 用户输入的标签 */
  tags: string
  /** 使用的预设名称 */
  presetName: string
  /** 固定正面提示词 */
  fixedPrompt: string
  /** 后置正面提示词 */
  fixedPrompt_end: string
  /** 负面提示词 */
  negativePrompt: string
  /** 模型 */
  model: string
  /** 采样方法 */
  sampler: string
  /** 宽度 */
  width: number
  /** 高度 */
  height: number
  /** 步数 */
  steps: number
  /** CFG */
  cfg: number
  /** 种子（非0时才纳入） */
  seed: number
}

// ============ 默认配置 ============
export const DEFAULT_NOVELAI_CONFIG: NovelAIConfig = {
  enabled: false,

  // 模型与接口
  apiKey: '',
  site: 'official',
  customUrl: '',
  model: 'nai-diffusion-4-5-full',

  // 采样与算法
  sampler: 'k_euler',
  noiseSchedule: 'karras',
  promptGuidance: 5.0,
  variety: true,
  aiDefaultPosition: false,

  // 尺寸与比例
  sizePreset: 'square',
  width: 1024,
  height: 1024,

  // 渲染控制
  steps: 28,
  seed: 0,

  // 标记设置
  startMarker: 'image###',
  endMarker: '###',
  autoGenerate: false,

  // 当前预设
  currentPreset: '',
}

// ============ 默认预设 ============
export const DEFAULT_NOVELAI_PRESETS: NovelAIPromptPreset[] = [
  {
    name: '默认预设',
    fixedPrompt: 'masterpiece, best quality, very aesthetic',
    fixedPrompt_end: '',
    negativePrompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
  },
]

// ============ V4+ 提示词结构 ============
export interface V4CharacterCaption {
  char_caption: string
  centers: Array<{ x: number; y: number }>
}

export interface V4Caption {
  base_caption: string
  char_captions?: V4CharacterCaption[]
}

export interface V4PromptStructure {
  caption: V4Caption
  use_coords?: boolean
  use_order?: boolean
}

export interface V4NegativePromptStructure {
  caption: V4Caption
  legacy_uc?: boolean
}

// ============ Novel AI API 请求格式 ============
export interface NovelAIAPIRequest {
  /** 正面提示词 */
  input: string
  /** 模型名称 */
  model: string
  /** 动作类型，固定为 "generate" */
  action: 'generate'
  /** 生成参数 */
  parameters: NovelAIAPIParameters
}

// ============ API 参数（支持 V3 和 V4+） ============
export interface NovelAIAPIParameters {
  // 基础参数
  /** 图片宽度 */
  width: number
  /** 图片高度 */
  height: number
  /** CFG Scale / Prompt Guidance */
  scale: number
  /** 采样器 */
  sampler: string
  /** 生成步数 */
  steps: number
  /** 种子 */
  seed: number
  /** 生成数量，固定为 1 */
  n_samples: number
  /** 负面提示词 */
  negative_prompt: string
  /** 噪点表 */
  noise_schedule: string

  // V4+ 新增必需参数
  /** 参数版本，V4+ 使用 3 */
  params_version?: number
  /** UC 预设，V4+ 使用 3 */
  ucPreset: number
  /** 质量开关 */
  qualityToggle: boolean
  /** 自动 SMEA（V4+ 使用 autoSmea 替代 sm） */
  autoSmea?: boolean
  /** SMEA（V3 使用） */
  sm?: boolean
  /** SMEA Dynamic */
  sm_dyn?: boolean

  // V4+ 高级参数
  /** Legacy 模式 */
  legacy?: boolean
  /** Legacy UC 模式 */
  legacy_uc?: boolean
  /** Legacy V3 扩展 */
  legacy_v3_extend?: boolean
  /** CFG Rescale */
  cfg_rescale?: number
  /** 跳过高 sigma 的 CFG */
  skip_cfg_above_sigma?: number
  /** 偏好布朗运动 */
  prefer_brownian?: boolean
  /** 动态阈值 */
  dynamic_thresholding?: boolean
  /** ControlNet 强度 */
  controlnet_strength?: number
  /** 添加原始图像 */
  add_original_image?: boolean
  /** Inpaint img2img 强度 */
  inpaintImg2ImgStrength?: number
  /** 归一化参考强度倍数 */
  normalize_reference_strength_multiple?: boolean
  /** 使用坐标 */
  use_coords?: boolean

  // V4+ 提示词结构
  /** V4+ 正面提示词结构 */
  v4_prompt?: V4PromptStructure
  /** V4+ 负面提示词结构 */
  v4_negative_prompt?: V4NegativePromptStructure

  // 角色提示词（V4+）
  characterPrompts?: Array<{
    enabled: boolean
    prompt: string
    center: { x: number; y: number }
    uc: string
  }>

  // 实验性参数
  /** 刻意的 Euler Ancestral bug */
  deliberate_euler_ancestral_bug?: boolean
}

// ============ 判断是否为 V4+ 模型 ============
export function isV4PlusModel(model: string): boolean {
  return model.includes('nai-diffusion-4')
}
