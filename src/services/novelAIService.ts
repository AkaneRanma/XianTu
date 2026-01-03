/**
 * Novel AI 文生图服务
 * 负责配置管理、预设管理、图像生成
 */

import type {
  NovelAIConfig,
  NovelAIPromptPreset,
  NovelAIPresetFile,
  NovelAIGenerateRequest,
  NovelAIGenerateResponse,
  NovelAIAPIRequest,
  NovelAIAPIParameters,
  CacheKeyParams
} from '@/types/novelAI'

import {
  DEFAULT_NOVELAI_CONFIG,
  DEFAULT_NOVELAI_PRESETS,
  isV4PlusModel
} from '@/types/novelAI'

import { imageCacheService, generateCacheKey } from './imageCacheService'

// ============ 常量定义 ============
const CONFIG_STORAGE_KEY = 'novelai_config'
const PRESETS_STORAGE_KEY = 'novelai_presets'
// Novel AI API URLs (2024年4月起图像生成使用专用域名)
const IMAGE_API_URL = 'https://image.novelai.net'  // 图像生成专用
const USER_API_URL = 'https://api.novelai.net'      // 用户信息等其他API
// 开发环境代理路径（Webpack DevServer 代理）
const IMAGE_PROXY_PATH = '/novelai-image-proxy'
const USER_PROXY_PATH = '/novelai-user-proxy'

// ============ Novel AI 服务类 ============
class NovelAIService {
  private config: NovelAIConfig = { ...DEFAULT_NOVELAI_CONFIG }
  private presets: NovelAIPromptPreset[] = []

  constructor() {
    this.loadConfig()
    this.loadPresets()
  }

  // ============ 配置管理 ============

  /**
   * 加载配置
   */
  loadConfig(): NovelAIConfig {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        this.config = { ...DEFAULT_NOVELAI_CONFIG, ...parsed }
        console.log('[NovelAI] 配置已加载')
      }
    } catch (e) {
      console.error('[NovelAI] 加载配置失败:', e)
    }
    return { ...this.config }
  }

  /**
   * 保存配置
   */
  saveConfig(config: Partial<NovelAIConfig>): void {
    this.config = { ...this.config, ...config }
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config))
    console.log('[NovelAI] 配置已保存')
  }

  /**
   * 获取当前配置
   */
  getConfig(): NovelAIConfig {
    return { ...this.config }
  }

  /**
   * 重置配置为默认值
   */
  resetConfig(): void {
    this.config = { ...DEFAULT_NOVELAI_CONFIG }
    localStorage.removeItem(CONFIG_STORAGE_KEY)
    console.log('[NovelAI] 配置已重置')
  }

  // ============ 预设管理 ============

  /**
   * 加载预设列表
   */
  loadPresets(): NovelAIPromptPreset[] {
    try {
      const saved = localStorage.getItem(PRESETS_STORAGE_KEY)
      if (saved) {
        this.presets = JSON.parse(saved)
        console.log(`[NovelAI] 已加载 ${this.presets.length} 个预设`)
      } else {
        // 使用默认预设
        this.presets = [...DEFAULT_NOVELAI_PRESETS]
        this.savePresetsToStorage()
      }
    } catch (e) {
      console.error('[NovelAI] 加载预设失败:', e)
      this.presets = [...DEFAULT_NOVELAI_PRESETS]
    }
    return [...this.presets]
  }

  /**
   * 获取所有预设
   */
  getPresets(): NovelAIPromptPreset[] {
    return [...this.presets]
  }

  /**
   * 获取单个预设
   */
  getPreset(name: string): NovelAIPromptPreset | null {
    return this.presets.find(p => p.name === name) || null
  }

  /**
   * 保存预设（新增或更新）
   */
  savePreset(preset: NovelAIPromptPreset): void {
    const index = this.presets.findIndex(p => p.name === preset.name)
    if (index >= 0) {
      this.presets[index] = { ...preset }
    } else {
      this.presets.push({ ...preset })
    }
    this.savePresetsToStorage()
    console.log(`[NovelAI] 预设已保存: ${preset.name}`)
  }

  /**
   * 删除预设
   */
  deletePreset(name: string): boolean {
    const index = this.presets.findIndex(p => p.name === name)
    if (index >= 0) {
      this.presets.splice(index, 1)
      this.savePresetsToStorage()
      console.log(`[NovelAI] 预设已删除: ${name}`)
      return true
    }
    return false
  }

  /**
   * 导入预设（从 JSON 文件）
   * 支持 SillyTavern 格式
   */
  importPresets(fileContent: string, mode: 'merge' | 'replace' = 'merge'): NovelAIPromptPreset[] {
    try {
      const data = JSON.parse(fileContent) as NovelAIPresetFile
      const importedPresets: NovelAIPromptPreset[] = []

      for (const [name, preset] of Object.entries(data)) {
        importedPresets.push({
          name,
          fixedPrompt: preset.fixedPrompt || '',
          fixedPrompt_end: preset.fixedPrompt_end || '',
          negativePrompt: preset.negativePrompt || ''
        })
      }

      if (mode === 'replace') {
        this.presets = importedPresets
      } else {
        // 合并模式：同名覆盖，新名添加
        for (const preset of importedPresets) {
          const index = this.presets.findIndex(p => p.name === preset.name)
          if (index >= 0) {
            this.presets[index] = preset
          } else {
            this.presets.push(preset)
          }
        }
      }

      this.savePresetsToStorage()
      console.log(`[NovelAI] 已导入 ${importedPresets.length} 个预设 (${mode} 模式)`)
      return importedPresets
    } catch (e) {
      console.error('[NovelAI] 导入预设失败:', e)
      throw new Error('预设文件格式无效')
    }
  }

  /**
   * 导出预设为 JSON 字符串
   * 使用 SillyTavern 兼容格式
   */
  exportPresets(presetNames?: string[]): string {
    const presetsToExport = presetNames
      ? this.presets.filter(p => presetNames.includes(p.name))
      : this.presets

    const exportData: NovelAIPresetFile = {}
    for (const preset of presetsToExport) {
      exportData[preset.name] = {
        fixedPrompt: preset.fixedPrompt,
        fixedPrompt_end: preset.fixedPrompt_end,
        negativePrompt: preset.negativePrompt
      }
    }

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * 保存预设到 localStorage
   */
  private savePresetsToStorage(): void {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(this.presets))
  }

  // ============ 图像生成 ============

  /**
   * 生成图像
   */
  async generateImage(request: NovelAIGenerateRequest): Promise<NovelAIGenerateResponse> {
    if (!this.config.enabled) {
      return { success: false, error: '图像生成功能未启用' }
    }

    if (!this.config.apiKey) {
      return { success: false, error: '请先配置 API Key' }
    }

    try {
      // 获取预设
      const preset = request.preset
        ? this.getPreset(request.preset)
        : (this.config.currentPreset ? this.getPreset(this.config.currentPreset) : null)

      // 构建最终尺寸
      const width = request.width || this.config.width
      const height = request.height || this.config.height
      const seed = request.seed ?? this.config.seed

      // 构建缓存键参数
      const cacheParams: CacheKeyParams = {
        tags: request.tags,
        presetName: preset?.name || '',
        fixedPrompt: request.positivePrompt || preset?.fixedPrompt || '',
        fixedPrompt_end: preset?.fixedPrompt_end || '',
        negativePrompt: request.negativePrompt || preset?.negativePrompt || '',
        model: this.config.model,
        sampler: this.config.sampler,
        width,
        height,
        steps: this.config.steps,
        cfg: this.config.promptGuidance,
        seed
      }

      // 检查缓存（仅当 seed 不为 0 时）
      if (seed !== 0) {
        const cacheKey = await generateCacheKey(cacheParams)
        const cached = await imageCacheService.get(cacheKey)

        if (cached) {
          console.log('[NovelAI] 缓存命中')
          return {
            success: true,
            imageBase64: cached.imageBase64,
            seed: cached.seed,
            fromCache: true
          }
        }
      }

      // 构建提示词
      const positivePrompt = this.buildPositivePrompt(request.tags, preset, request.positivePrompt)
      const negativePrompt = request.negativePrompt || preset?.negativePrompt || ''

      // 生成随机种子（如果 seed 为 0）
      const actualSeed = seed === 0 ? Math.floor(Math.random() * 4294967295) : seed

      // 构建 API 请求
      const apiRequest = this.buildAPIRequest(
        positivePrompt,
        negativePrompt,
        width,
        height,
        actualSeed
      )

      // 调用 API
      const imageBase64 = await this.callAPI(apiRequest)

      // 存入缓存
      if (imageBase64) {
        const finalParams = { ...cacheParams, seed: actualSeed }
        const cacheKey = await generateCacheKey(finalParams)

        await imageCacheService.set({
          id: cacheKey,
          imageBase64,
          tags: request.tags,
          presetName: preset?.name || '',
          width,
          height,
          seed: actualSeed,
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
          size: imageBase64.length
        })
      }

      return {
        success: true,
        imageBase64,
        seed: actualSeed,
        fromCache: false
      }
    } catch (error) {
      console.error('[NovelAI] 生成失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '生成失败'
      }
    }
  }

  /**
   * 构建正面提示词
   */
  private buildPositivePrompt(
    tags: string,
    preset: NovelAIPromptPreset | null,
    customPrompt?: string
  ): string {
    const parts: string[] = []

    // 固定前置提示词
    if (customPrompt) {
      parts.push(customPrompt)
    } else if (preset?.fixedPrompt) {
      parts.push(preset.fixedPrompt)
    }

    // 用户输入的标签
    if (tags) {
      parts.push(tags)
    }

    // 后置固定提示词
    if (preset?.fixedPrompt_end) {
      parts.push(preset.fixedPrompt_end)
    }

    return parts.filter(p => p.trim()).join(', ')
  }

  /**
   * 构建 API 请求（自动区分 V3 和 V4+ 格式）
   */
  private buildAPIRequest(
    positivePrompt: string,
    negativePrompt: string,
    width: number,
    height: number,
    seed: number
  ): NovelAIAPIRequest {
    const isV4 = isV4PlusModel(this.config.model)

    // 基础参数（V3 和 V4+ 共用）
    const baseParameters: NovelAIAPIParameters = {
      width,
      height,
      scale: this.config.promptGuidance,
      sampler: this.config.sampler,
      steps: this.config.steps,
      seed,
      n_samples: 1,
      negative_prompt: negativePrompt,
      noise_schedule: this.config.noiseSchedule,
      ucPreset: isV4 ? 3 : 0,
      qualityToggle: true,
    }

    if (isV4) {
      // V4+ 专用参数
      const v4Parameters: NovelAIAPIParameters = {
        ...baseParameters,
        // V4+ 必需参数
        params_version: 3,
        autoSmea: this.config.variety,

        // Legacy 设置
        legacy: false,
        legacy_uc: false,
        legacy_v3_extend: false,

        // 高级参数
        cfg_rescale: 0,
        skip_cfg_above_sigma: 59.04722600415217,
        prefer_brownian: true,
        dynamic_thresholding: false,
        controlnet_strength: 1,
        add_original_image: true,
        inpaintImg2ImgStrength: 1,
        normalize_reference_strength_multiple: false,
        deliberate_euler_ancestral_bug: false,

        // 使用坐标（用于角色定位）
        use_coords: this.config.aiDefaultPosition,

        // V4+ 提示词结构
        v4_prompt: {
          caption: {
            base_caption: positivePrompt,
            char_captions: []
          },
          use_coords: this.config.aiDefaultPosition,
          use_order: true
        },

        v4_negative_prompt: {
          caption: {
            base_caption: negativePrompt,
            char_captions: []
          },
          legacy_uc: false
        }
      }

      return {
        input: positivePrompt,
        model: this.config.model,
        action: 'generate',
        parameters: v4Parameters
      }
    } else {
      // V3 参数
      return {
        input: positivePrompt,
        model: this.config.model,
        action: 'generate',
        parameters: {
          ...baseParameters,
          sm: this.config.variety,
          sm_dyn: false
        }
      }
    }
  }

  /**
   * 检测是否在开发服务器环境
   */
  private isDevServer(): boolean {
    return typeof window !== 'undefined' &&
      window.location.port === '8080' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  }

  /**
   * 获取图像生成 API 基础 URL
   */
  private getImageApiUrl(): string {
    if (this.config.site === 'custom') {
      return this.config.customUrl.replace(/\/+$/, '')
    }

    if (this.isDevServer()) {
      return IMAGE_PROXY_PATH
    }

    return IMAGE_API_URL
  }

  /**
   * 获取用户 API 基础 URL
   */
  private getUserApiUrl(): string {
    if (this.config.site === 'custom') {
      return this.config.customUrl.replace(/\/+$/, '')
    }

    if (this.isDevServer()) {
      return USER_PROXY_PATH
    }

    return USER_API_URL
  }

  /**
   * 调用 Novel AI 图像生成 API
   */
  private async callAPI(request: NovelAIAPIRequest): Promise<string> {
    const baseUrl = this.getImageApiUrl()

    const response = await fetch(`${baseUrl}/ai/generate-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/zip'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `API 错误 ${response.status}`

      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.message || errorJson.error || errorMessage
      } catch {
        if (errorText) {
          errorMessage += `: ${errorText.substring(0, 100)}`
        }
      }

      throw new Error(errorMessage)
    }

    // Novel AI 返回 ZIP 格式，需要解压
    const blob = await response.blob()
    return await this.extractImageFromZip(blob)
  }

  /**
   * 从 ZIP 响应中提取图片
   * Novel AI 返回的是标准 ZIP 格式，包含一个 PNG 图片
   */
  private async extractImageFromZip(zipBlob: Blob): Promise<string> {
    const arrayBuffer = await zipBlob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const dataView = new DataView(arrayBuffer)

    // 验证 ZIP 本地文件头签名: 0x04034b50 (PK\x03\x04)
    if (dataView.getUint32(0, true) !== 0x04034b50) {
      throw new Error('无效的 ZIP 文件格式')
    }

    // 读取本地文件头信息
    const generalPurposeFlag = dataView.getUint16(6, true)
    const compressionMethod = dataView.getUint16(8, true)
    const fileNameLength = dataView.getUint16(26, true)
    const extraFieldLength = dataView.getUint16(28, true)

    // 检查 bit 3：如果设置，压缩大小在数据描述符中
    const hasDataDescriptor = (generalPurposeFlag & 0x08) !== 0

    // 数据开始位置
    const dataStart = 30 + fileNameLength + extraFieldLength

    let compressedSize: number
    let uncompressedSize: number

    if (hasDataDescriptor) {
      // 需要查找中央目录来获取正确的大小
      // 或者通过搜索下一个签名来确定数据范围
      // 查找中央目录签名 0x02014b50 (PK\x01\x02)
      let centralDirOffset = -1
      for (let i = dataStart; i < bytes.length - 4; i++) {
        if (dataView.getUint32(i, true) === 0x02014b50) {
          centralDirOffset = i
          break
        }
      }

      if (centralDirOffset === -1) {
        // 找不到中央目录，尝试查找数据描述符签名
        // 数据描述符可能有可选的签名 0x08074b50
        for (let i = dataStart; i < bytes.length - 16; i++) {
          if (dataView.getUint32(i, true) === 0x08074b50) {
            compressedSize = dataView.getUint32(i + 8, true)
            uncompressedSize = dataView.getUint32(i + 12, true)
            break
          }
        }
        // 如果还是找不到，使用剩余所有数据
        compressedSize = compressedSize! || (bytes.length - dataStart - 16)
      } else {
        // 从中央目录读取压缩大小
        compressedSize = dataView.getUint32(centralDirOffset + 20, true)
        uncompressedSize = dataView.getUint32(centralDirOffset + 24, true)
      }
    } else {
      // 直接从本地文件头读取
      compressedSize = dataView.getUint32(18, true)
      uncompressedSize = dataView.getUint32(22, true)
    }

    // 确保压缩大小有效
    if (compressedSize <= 0 || dataStart + compressedSize > bytes.length) {
      // 尝试计算实际可用的数据大小
      // 查找下一个 PK 签名或使用剩余全部数据
      let endOffset = bytes.length
      for (let i = dataStart + 1; i < bytes.length - 4; i++) {
        const sig = dataView.getUint32(i, true)
        // 检查是否是 ZIP 签名 (PK\x01\x02 或 PK\x03\x04 或 PK\x05\x06)
        if (sig === 0x02014b50 || sig === 0x04034b50 || sig === 0x06054b50) {
          endOffset = i
          break
        }
      }
      compressedSize = endOffset - dataStart
    }

    // 提取压缩数据
    const compressedData = bytes.slice(dataStart, dataStart + compressedSize)

    let imageData: Uint8Array

    if (compressionMethod === 0) {
      // 无压缩 (Stored)
      imageData = compressedData
    } else if (compressionMethod === 8) {
      // Deflate 压缩
      try {
        imageData = await this.inflateData(compressedData)
      } catch (inflateError) {
        console.error('[NovelAI] Deflate 解压失败，尝试直接使用数据:', inflateError)
        // 有时数据可能未压缩但标记为压缩
        imageData = compressedData
      }
    } else {
      throw new Error(`不支持的压缩方法: ${compressionMethod}`)
    }

    // 检测图片类型
    const mimeType = this.detectImageType(imageData)

    // 转换为 Base64
    const base64 = this.uint8ArrayToBase64(imageData)

    return `data:${mimeType};base64,${base64}`
  }

  /**
   * 解压 Deflate 数据
   */
  private async inflateData(compressedData: Uint8Array): Promise<Uint8Array> {
    // 使用 DecompressionStream API (现代浏览器支持)
    const ds = new DecompressionStream('deflate-raw')
    const writer = ds.writable.getWriter()
    const reader = ds.readable.getReader()

    // 创建一个新的 ArrayBuffer 副本以确保类型兼容
    const buffer = new Uint8Array(compressedData).buffer as ArrayBuffer

    // 写入数据并关闭
    const writePromise = writer.write(new Uint8Array(buffer)).then(() => writer.close())

    // 读取解压后的数据
    const chunks: Uint8Array[] = []
    let totalSize = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        totalSize += value.length
      }
    } catch (readError) {
      // 确保writer已关闭
      await writePromise.catch(() => {})
      throw readError
    }

    // 合并所有块
    const result = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result
  }

  /**
   * Uint8Array 转 Base64
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * 检测图片类型
   */
  private detectImageType(data: Uint8Array): string {
    // PNG: 89 50 4E 47
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
      return 'image/png'
    }
    // JPEG: FF D8 FF
    if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
      return 'image/jpeg'
    }
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
      return 'image/webp'
    }
    // 默认 PNG
    return 'image/png'
  }

  /**
   * 测试 API 连接
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.config.apiKey) {
      return { success: false, message: '请先配置 API Key' }
    }

    try {
      const baseUrl = this.getUserApiUrl()

      // 使用用户信息接口测试连接（仍在 api.novelai.net）
      const response = await fetch(`${baseUrl}/user/data`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      })

      if (response.ok) {
        return { success: true, message: '连接成功' }
      } else if (response.status === 401) {
        return { success: false, message: 'API Key 无效' }
      } else {
        return { success: false, message: `连接失败: ${response.status}` }
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '网络错误'
      }
    }
  }

  // ============ 文本标记解析 ============

  /**
   * 解析文本中的图像标记
   * 返回标记列表和替换后的文本
   */
  parseImageMarkers(text: string): {
    markers: Array<{ id: string; tags: string; rawMarker: string; start: number; end: number }>;
    hasMarkers: boolean;
  } {
    const startMarker = this.escapeRegex(this.config.startMarker)
    const endMarker = this.escapeRegex(this.config.endMarker)

    const regex = new RegExp(`${startMarker}(.+?)${endMarker}`, 'gs')
    const markers: Array<{ id: string; tags: string; rawMarker: string; start: number; end: number }> = []

    let match
    while ((match = regex.exec(text)) !== null) {
      markers.push({
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tags: match[1].trim(),
        rawMarker: match[0],
        start: match.index,
        end: match.index + match[0].length
      })
    }

    return {
      markers,
      hasMarkers: markers.length > 0
    }
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 检查是否配置完成
   */
  isConfigured(): boolean {
    return !!(this.config.enabled && this.config.apiKey)
  }
}

// 导出单例
export const novelAIService = new NovelAIService()
