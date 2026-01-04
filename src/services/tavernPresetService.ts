/**
 * 酒馆预设管理服务
 * 负责预设的导入、存储、管理和消息构建
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import type {
  TavernPreset,
  LocalTavernPreset,
  TavernPromptItem,
  TavernPromptOrderItem,
  TavernRegexScript,
  MacroContext,
  TavernPresetImportOptions,
  TavernPresetValidationResult,
} from '@/types/tavernPreset'
import { MARKER_IDENTIFIERS } from '@/types/tavernPreset'
import { TavernMacroProcessor, createDefaultMacroContext } from '@/utils/tavernMacros'
import { TavernRegexEngine, type RegexExecutionOptions } from '@/utils/tavernRegex'

// IndexedDB Schema
interface TavernPresetDB extends DBSchema {
  tavernPresets: {
    key: string
    value: LocalTavernPreset
    indexes: {
      'by-name': string
      'by-importedAt': string
    }
  }
  activePreset: {
    key: string
    value: { id: string }
  }
}

const DB_NAME = 'XianTu_TavernPresets'
const DB_VERSION = 1

/**
 * 酒馆预设服务类
 */
class TavernPresetService {
  private db: IDBPDatabase<TavernPresetDB> | null = null
  private macroProcessor = new TavernMacroProcessor()
  private regexEngine = new TavernRegexEngine()
  private initPromise: Promise<void> | null = null

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.doInit()
    return this.initPromise
  }

  private async doInit(): Promise<void> {
    try {
      this.db = await openDB<TavernPresetDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // 创建预设存储
          if (!db.objectStoreNames.contains('tavernPresets')) {
            const presetStore = db.createObjectStore('tavernPresets', { keyPath: 'id' })
            presetStore.createIndex('by-name', 'name')
            presetStore.createIndex('by-importedAt', 'importedAt')
          }

          // 创建激活预设存储
          if (!db.objectStoreNames.contains('activePreset')) {
            db.createObjectStore('activePreset')
          }
        },
      })
      console.log('[TavernPresetService] 数据库初始化完成')
    } catch (error) {
      console.error('[TavernPresetService] 数据库初始化失败:', error)
      throw error
    }
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureDB(): Promise<IDBPDatabase<TavernPresetDB>> {
    await this.init()
    if (!this.db) {
      throw new Error('数据库未初始化')
    }
    return this.db
  }

  // ==================== 导入功能 ====================

  /**
   * 导入预设文件
   */
  async importPreset(file: File, options?: TavernPresetImportOptions): Promise<LocalTavernPreset> {
    // 读取文件内容
    const text = await file.text()
    let rawData: TavernPreset

    try {
      rawData = JSON.parse(text)
    } catch {
      throw new Error('无效的JSON文件格式')
    }

    // 验证预设格式
    const validation = this.validatePreset(rawData)
    if (!validation.valid) {
      throw new Error(`预设格式无效: ${validation.errors.join(', ')}`)
    }

    // 转换为本地格式
    const localPreset = this.convertToLocalPreset(rawData, {
      fileName: file.name,
      customName: options?.customName,
      mergeMode: options?.mergeMode,
    })

    // 保存到数据库
    await this.savePreset(localPreset)

    // 如果需要立即激活
    if (options?.activateImmediately) {
      await this.setActivePreset(localPreset.id)
    }

    console.log('[TavernPresetService] 预设导入成功:', localPreset.name)
    return localPreset
  }

  /**
   * 从JSON字符串导入预设
   */
  async importPresetFromJSON(
    jsonString: string,
    options?: TavernPresetImportOptions & { fileName?: string },
  ): Promise<LocalTavernPreset> {
    let rawData: TavernPreset

    try {
      rawData = JSON.parse(jsonString)
    } catch {
      throw new Error('无效的JSON格式')
    }

    const validation = this.validatePreset(rawData)
    if (!validation.valid) {
      throw new Error(`预设格式无效: ${validation.errors.join(', ')}`)
    }

    const localPreset = this.convertToLocalPreset(rawData, {
      fileName: options?.fileName,
      customName: options?.customName,
      mergeMode: options?.mergeMode,
    })

    await this.savePreset(localPreset)

    if (options?.activateImmediately) {
      await this.setActivePreset(localPreset.id)
    }

    return localPreset
  }

  /**
   * 验证预设格式
   */
  validatePreset(data: unknown): TavernPresetValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const stats = {
      totalPrompts: 0,
      enabledPrompts: 0,
      totalRegexScripts: 0,
      enabledRegexScripts: 0,
      hasModelParams: false,
      hasSPresetConfig: false,
    }

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['数据不是有效的对象'], warnings, stats }
    }

    const preset = data as Record<string, unknown>

    // 检查必需字段
    if (!Array.isArray(preset.prompts)) {
      errors.push('缺少 prompts 数组')
    } else {
      stats.totalPrompts = preset.prompts.length
      stats.enabledPrompts = preset.prompts.filter(
        (p: TavernPromptItem) => p.enabled && !p.marker,
      ).length
    }

    // 检查模型参数
    if (typeof preset.temperature === 'number') {
      stats.hasModelParams = true
    }

    // 检查正则脚本
    if (preset.extensions && typeof preset.extensions === 'object') {
      const ext = preset.extensions as Record<string, unknown>

      if (Array.isArray(ext.regex_scripts)) {
        stats.totalRegexScripts = ext.regex_scripts.length
        stats.enabledRegexScripts = ext.regex_scripts.filter(
          (s: TavernRegexScript) => !s.disabled,
        ).length
      }

      if (ext.SPreset && typeof ext.SPreset === 'object') {
        stats.hasSPresetConfig = true
        // 检查 SPreset 中的正则
        const sPreset = ext.SPreset as Record<string, unknown>
        if (sPreset.RegexBinding && typeof sPreset.RegexBinding === 'object') {
          const regexBinding = sPreset.RegexBinding as Record<string, unknown>
          if (Array.isArray(regexBinding.regexes)) {
            stats.totalRegexScripts += regexBinding.regexes.length
            stats.enabledRegexScripts += regexBinding.regexes.filter(
              (s: TavernRegexScript) => !s.disabled,
            ).length
          }
        }
      }
    }

    // 警告
    if (!Array.isArray(preset.prompt_order)) {
      warnings.push('缺少 prompt_order，将使用默认顺序')
    }

    if (stats.totalPrompts === 0) {
      warnings.push('预设中没有提示词')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats,
    }
  }

  /**
   * 转换为本地预设格式
   */
  private convertToLocalPreset(
    rawData: TavernPreset,
    options: {
      fileName?: string
      customName?: string
      mergeMode?: 'replace' | 'tavern-first' | 'web-first'
    },
  ): LocalTavernPreset {
    // 生成唯一ID
    const id = `tavern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 提取名称
    let name = options.customName || ''
    if (!name && options.fileName) {
      // 从文件名提取（去掉扩展名）
      name = options.fileName.replace(/\.json$/i, '')
    }
    if (!name) {
      name = `酒馆预设 ${new Date().toLocaleDateString()}`
    }

    // 提取 prompt_order（优先使用 character_id = 100001）
    let promptOrder: TavernPromptOrderItem[] = []
    if (Array.isArray(rawData.prompt_order)) {
      const charOrder = rawData.prompt_order.find((o) => o.character_id === 100001)
      const defaultOrder = rawData.prompt_order.find((o) => o.character_id === 100000)
      const orderConfig = charOrder || defaultOrder
      if (orderConfig && Array.isArray(orderConfig.order)) {
        promptOrder = orderConfig.order
      }
    }

    // 合并正则脚本（extensions.regex_scripts + SPreset.RegexBinding.regexes）
    const regexScripts: TavernRegexScript[] = []
    if (rawData.extensions?.regex_scripts) {
      regexScripts.push(...rawData.extensions.regex_scripts)
    }
    if (rawData.extensions?.SPreset?.RegexBinding?.regexes) {
      regexScripts.push(...rawData.extensions.SPreset.RegexBinding.regexes)
    }

    // 计算排序后的提示词
    const prompts = rawData.prompts || []
    const promptMap = new Map(prompts.map((p) => [p.identifier, p]))
    const orderedPrompts: TavernPromptItem[] = []

    // 按 promptOrder 排序
    if (promptOrder.length > 0) {
      for (const orderItem of promptOrder) {
        const prompt = promptMap.get(orderItem.identifier)
        if (prompt) {
          orderedPrompts.push({ ...prompt, enabled: orderItem.enabled })
          promptMap.delete(orderItem.identifier)
        }
      }
    }

    // 添加未在 promptOrder 中的提示词
    for (const prompt of promptMap.values()) {
      orderedPrompts.push(prompt)
    }

    // 计算统计信息
    const stats = {
      totalPrompts: prompts.length,
      enabledPrompts: orderedPrompts.filter((p) => p.enabled && !p.marker).length,
      totalRegexScripts: regexScripts.length,
      enabledRegexScripts: regexScripts.filter((s) => !s.disabled).length,
      hasModelParams: typeof rawData.temperature === 'number',
      hasSPresetConfig: !!rawData.extensions?.SPreset,
    }

    return {
      id,
      name,
      description: rawData.extensions?.presetdetailnfo?.updateNote,
      source: 'tavern',
      sourceFileName: options.fileName,
      importedAt: new Date().toISOString(),
      enabled: false,

      mergeMode: options.mergeMode || 'tavern-first',

      modelParams: {
        temperature: rawData.temperature ?? 1.0,
        top_p: rawData.top_p ?? 1.0,
        top_k: rawData.top_k ?? 0,
        frequency_penalty: rawData.frequency_penalty ?? 0,
        presence_penalty: rawData.presence_penalty ?? 0,
        max_context: rawData.openai_max_context ?? 8192,
        max_tokens: rawData.openai_max_tokens ?? 2048,
      },

      prompts,
      promptOrder,
      orderedPrompts,
      regexScripts,
      sPresetConfig: rawData.extensions?.SPreset,
      stats,

      rawData,
    }
  }

  // ==================== CRUD 操作 ====================

  /**
   * 保存预设
   */
  async savePreset(preset: LocalTavernPreset): Promise<void> {
    const db = await this.ensureDB()
    await db.put('tavernPresets', preset)
  }

  /**
   * 获取单个预设
   */
  async getPreset(id: string): Promise<LocalTavernPreset | null> {
    const db = await this.ensureDB()
    const preset = await db.get('tavernPresets', id)
    return preset || null
  }

  /**
   * 获取所有预设
   */
  async getAllPresets(): Promise<LocalTavernPreset[]> {
    const db = await this.ensureDB()
    return await db.getAll('tavernPresets')
  }

  /**
   * 删除预设
   */
  async deletePreset(id: string): Promise<void> {
    const db = await this.ensureDB()

    // 如果是当前激活的预设，先清除激活状态
    const activeId = await this.getActivePresetId()
    if (activeId === id) {
      await this.clearActivePreset()
    }

    await db.delete('tavernPresets', id)
  }

  /**
   * 更新预设
   */
  async updatePreset(id: string, updates: Partial<LocalTavernPreset>): Promise<void> {
    const preset = await this.getPreset(id)
    if (!preset) {
      throw new Error(`预设不存在: ${id}`)
    }

    const updatedPreset = { ...preset, ...updates, id } // 确保ID不变
    await this.savePreset(updatedPreset)
  }

  // ==================== 激活管理 ====================

  /**
   * 设置激活的预设
   */
  async setActivePreset(id: string): Promise<void> {
    const db = await this.ensureDB()

    // 验证预设存在
    const preset = await this.getPreset(id)
    if (!preset) {
      throw new Error(`预设不存在: ${id}`)
    }

    await db.put('activePreset', { id }, 'current')

    // 更新预设的 enabled 状态
    await this.updatePreset(id, { enabled: true })

    console.log('[TavernPresetService] 激活预设:', preset.name)
  }

  /**
   * 获取当前激活的预设ID
   */
  async getActivePresetId(): Promise<string | null> {
    const db = await this.ensureDB()
    const record = await db.get('activePreset', 'current')
    return record?.id || null
  }

  /**
   * 获取当前激活的预设
   */
  async getActivePreset(): Promise<LocalTavernPreset | null> {
    const activeId = await this.getActivePresetId()
    if (!activeId) return null
    return await this.getPreset(activeId)
  }

  /**
   * 清除激活的预设
   */
  async clearActivePreset(): Promise<void> {
    const db = await this.ensureDB()
    const activeId = await this.getActivePresetId()

    if (activeId) {
      // 更新预设的 enabled 状态
      try {
        await this.updatePreset(activeId, { enabled: false })
      } catch {
        // 预设可能已被删除，忽略错误
      }
    }

    await db.delete('activePreset', 'current')
    console.log('[TavernPresetService] 已清除激活预设')
  }

  // ==================== 消息构建 ====================

  /**
   * 构建发送给AI的消息列表（核心方法）
   */
  buildPromptMessages(
    preset: LocalTavernPreset,
    context: MacroContext,
    _webPrompts?: Array<{ role: string; content: string }>,
  ): Array<{ role: string; content: string; source?: string; depth?: number }> {
    const messages: Array<{ role: string; content: string; source?: string; depth?: number }> = []

    // 重置宏处理器状态
    this.macroProcessor.reset()
    this.macroProcessor.initFromContext(context)

    // 获取排序后的提示词
    const orderedPrompts = this.getOrderedPrompts(preset)

    // 处理每个提示词
    for (const prompt of orderedPrompts) {
      if (!prompt.enabled) continue

      // 处理 marker 类型
      if (prompt.marker) {
        const markerContent = this.resolveMarker(prompt.identifier, context)
        if (markerContent) {
          messages.push({
            role: prompt.role,
            content: markerContent,
            source: `占位符: ${prompt.name}`,
            depth: prompt.injection_depth,
          })
        }
        continue
      }

      // 处理普通提示词
      const processedContent = this.macroProcessor.process(prompt.content, context)

      // 跳过空内容
      if (!processedContent.trim()) continue

      messages.push({
        role: prompt.role,
        content: processedContent,
        source: prompt.name,
        depth: prompt.injection_depth,
      })
    }

    // 按 injection_depth 排序（降序，depth大的在前）
    messages.sort((a, b) => (b.depth || 0) - (a.depth || 0))

    return messages
  }

  /**
   * 获取排序后的提示词
   */
  getOrderedPrompts(preset: LocalTavernPreset): TavernPromptItem[] {
    const promptMap = new Map(preset.prompts.map((p) => [p.identifier, p]))
    const ordered: TavernPromptItem[] = []

    // 按 promptOrder 排序
    if (preset.promptOrder.length > 0) {
      for (const orderItem of preset.promptOrder) {
        const prompt = promptMap.get(orderItem.identifier)
        if (prompt) {
          // 使用排序配置中的 enabled 状态覆盖原始状态
          ordered.push({ ...prompt, enabled: orderItem.enabled })
          promptMap.delete(orderItem.identifier)
        }
      }
    }

    // 添加未在 promptOrder 中的提示词
    for (const prompt of promptMap.values()) {
      ordered.push(prompt)
    }

    return ordered
  }

  /**
   * 解析 marker 占位符
   */
  private resolveMarker(identifier: string, context: MacroContext): string | null {
    switch (identifier) {
      case 'charDescription':
        return context.charDescription || null
      case 'charPersonality':
        return context.charPersonality || null
      case 'personaDescription':
        return context.personaDescription || null
      case 'scenario':
        return context.scenario || null
      case 'worldInfoBefore':
        return context.worldInfoBefore || null
      case 'worldInfoAfter':
        return context.worldInfoAfter || null
      case 'dialogueExamples':
        return context.dialogueExamples || null
      case 'chatHistory':
        // 聊天历史需要特殊处理
        if (context.chatHistory && context.chatHistory.length > 0) {
          return context.chatHistory.map((m) => `${m.role}: ${m.content}`).join('\n\n')
        }
        return null
      default:
        // 检查是否是已知的 marker
        if (identifier in MARKER_IDENTIFIERS) {
          console.log(`[TavernPresetService] 未处理的 marker: ${identifier}`)
        }
        return null
    }
  }

  // ==================== 正则脚本处理 ====================

  /**
   * 对AI输出应用正则脚本
   */
  applyRegexScripts(
    output: string,
    preset: LocalTavernPreset,
    options?: RegexExecutionOptions,
  ): string {
    if (!preset.regexScripts || preset.regexScripts.length === 0) {
      return output
    }

    const result = this.regexEngine.applyToOutput(output, preset.regexScripts, options)

    if (result.appliedScripts.length > 0) {
      console.log('[TavernPresetService] 应用的正则脚本:', result.appliedScripts)
    }

    if (result.errors.length > 0) {
      console.warn('[TavernPresetService] 正则脚本错误:', result.errors)
    }

    return result.output
  }

  /**
   * 对用户输入应用正则脚本
   */
  applyRegexScriptsToInput(
    input: string,
    preset: LocalTavernPreset,
    options?: RegexExecutionOptions,
  ): string {
    if (!preset.regexScripts || preset.regexScripts.length === 0) {
      return input
    }

    const result = this.regexEngine.applyToInput(input, preset.regexScripts, options)
    return result.output
  }

  // ==================== 导出功能 ====================

  /**
   * 导出预设为JSON
   */
  exportPreset(preset: LocalTavernPreset): string {
    return JSON.stringify(preset.rawData, null, 2)
  }

  /**
   * 导出预设为文件
   */
  exportPresetAsFile(preset: LocalTavernPreset): void {
    const json = this.exportPreset(preset)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `${preset.name}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ==================== 工具方法 ====================

  /**
   * 获取预设统计信息
   */
  getPresetStats(preset: LocalTavernPreset): {
    totalPrompts: number
    enabledPrompts: number
    markerPrompts: number
    totalRegexScripts: number
    enabledRegexScripts: number
  } {
    const orderedPrompts = this.getOrderedPrompts(preset)

    return {
      totalPrompts: preset.prompts.length,
      enabledPrompts: orderedPrompts.filter((p) => p.enabled && !p.marker).length,
      markerPrompts: orderedPrompts.filter((p) => p.marker).length,
      totalRegexScripts: preset.regexScripts.length,
      enabledRegexScripts: preset.regexScripts.filter((s) => !s.disabled).length,
    }
  }

  /**
   * 创建默认宏上下文
   */
  createMacroContext(overrides?: Partial<MacroContext>): MacroContext {
    return createDefaultMacroContext(overrides)
  }

  /**
   * 获取宏处理器
   */
  getMacroProcessor(): TavernMacroProcessor {
    return this.macroProcessor
  }

  /**
   * 获取正则引擎
   */
  getRegexEngine(): TavernRegexEngine {
    return this.regexEngine
  }
}

// 导出单例
export const tavernPresetService = new TavernPresetService()

// 导出类型和工具函数
export { createDefaultMacroContext }
