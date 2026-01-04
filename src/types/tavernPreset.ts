/**
 * 酒馆(SillyTavern)预设格式完整类型定义
 * 用于支持导入酒馆预设功能
 */

// 单个提示词项
export interface TavernPromptItem {
  identifier: string // 唯一标识符
  name: string // 显示名称
  enabled: boolean // 是否启用
  injection_position: number // 0=系统后, 1=消息中
  injection_depth: number // 注入深度（0=最后，越大越靠前）
  injection_order: number // 同深度时的排序
  role: 'system' | 'user' | 'assistant' // 角色
  content: string // 提示词内容
  system_prompt?: boolean // 是否是系统提示
  marker?: boolean // 是否是占位标记
  forbid_overrides?: boolean // 是否禁止覆盖
  injection_trigger?: string[] // 触发条件
}

// 提示词排序项
export interface TavernPromptOrderItem {
  identifier: string
  enabled: boolean
}

// 角色提示词顺序
export interface TavernPromptOrder {
  character_id: number // 100000=默认, 100001=特定角色
  order: TavernPromptOrderItem[]
  // 扩展字段（某些预设包含）
  xiaobai_ext?: {
    regexBindings?: unknown
    scheduledTasks?: unknown[]
  }
}

// 正则脚本（强化版正则替换规则）
export interface TavernRegexScript {
  id: string
  scriptName: string
  findRegex: string // 正则表达式（酒馆格式：/pattern/flags）
  replaceString: string // 替换字符串
  trimStrings: string[] // 需要trim的字符串
  placement: number[] // 应用位置: 0=用户输入, 1=AI输出, 2=斜杠命令
  disabled: boolean // 是否禁用
  markdownOnly: boolean // 仅在Markdown渲染时应用
  promptOnly: boolean // 仅在发送Prompt时应用
  runOnEdit: boolean // 编辑消息时运行
  substituteRegex: number // 替换正则索引
  minDepth: number | null // 最小聊天深度
  maxDepth: number | null // 最大聊天深度
}

// SPreset扩展配置 - ChatSquash
export interface TavernChatSquashConfig {
  enabled: boolean
  separate_chat_history?: boolean
  parse_clewd?: boolean
  role: string
  stop_string: string
  user_prefix: string
  user_suffix: string
  char_prefix: string
  char_suffix: string
  prefix_system?: string
  suffix_system?: string
  enable_squashed_separator?: boolean
  squashed_separator_regex?: boolean
  squashed_separator_string?: string
  squashed_post_script_enable?: boolean
  squashed_post_script?: string
  enable_stop_string: boolean
  user_role_system?: boolean
}

// SPreset扩展配置
export interface TavernSPresetConfig {
  ChatSquash?: TavernChatSquashConfig
  RegexBinding?: {
    regexes: TavernRegexScript[]
  }
  MacroNest?: boolean
}

// TavernHelper脚本
export interface TavernHelperScript {
  type: string
  enabled: boolean
  name: string
  id: string
  content: string
  info?: string
  button?: {
    enabled: boolean
    buttons: unknown[]
  }
  data?: Record<string, unknown>
}

// TavernHelper配置
export interface TavernHelperConfig {
  scripts: TavernHelperScript[]
  variables?: Record<string, unknown>
}

// 预设详情信息
export interface TavernPresetDetailInfo {
  uniqueValue?: string
  timestamp?: string
  nameGroup?: string
  linkAddress?: string
  updateNote?: string
}

// 完整预设格式
export interface TavernPreset {
  // 模型参数
  temperature: number
  frequency_penalty: number
  presence_penalty: number
  top_p: number
  top_k: number
  top_a?: number
  min_p?: number
  repetition_penalty?: number
  openai_max_context: number
  openai_max_tokens: number
  seed?: number
  n?: number

  // 提示词配置
  prompts: TavernPromptItem[]
  prompt_order: TavernPromptOrder[]

  // 格式配置
  wrap_in_quotes: boolean
  names_behavior: number
  send_if_empty: string
  impersonation_prompt: string
  new_chat_prompt: string
  new_group_chat_prompt?: string
  new_example_chat_prompt?: string
  continue_nudge_prompt: string
  bias_preset_selected?: string
  wi_format?: string
  scenario_format?: string
  personality_format?: string
  group_nudge_prompt?: string

  // 预填充配置
  assistant_prefill?: string
  assistant_impersonation?: string
  continue_prefill?: boolean
  continue_postfix?: string

  // 功能开关
  max_context_unlocked: boolean
  stream_openai: boolean
  show_thoughts?: boolean
  reasoning_effort?: string
  enable_web_search?: boolean
  request_images?: boolean
  claude_use_sysprompt?: boolean
  use_makersuite_sysprompt?: boolean
  squash_system_messages?: boolean
  image_inlining?: boolean
  inline_image_quality?: string
  video_inlining?: boolean
  function_calling?: boolean

  // 扩展
  extensions?: {
    SPreset?: TavernSPresetConfig
    regex_scripts?: TavernRegexScript[]
    tavern_helper?: TavernHelperConfig
    presetdetailnfo?: TavernPresetDetailInfo
    [key: string]: unknown
  }
}

// 宏变量上下文
export interface MacroContext {
  user: string // {{user}} - 用户名
  char: string // {{char}} - 角色名
  lastUserMessage: string // {{lastUserMessage}}
  lastCharMessage?: string // {{lastCharMessage}}
  chatHistory?: Array<{ role: string; content: string }> // 聊天历史
  variables: Record<string, string> // {{getvar::key}} / {{setvar::key::value}}
  // Marker替换内容
  worldInfoBefore?: string
  worldInfoAfter?: string
  personaDescription?: string
  charDescription?: string
  charPersonality?: string
  scenario?: string
  dialogueExamples?: string
}

// 预设统计信息
export interface LocalTavernPresetStats {
  totalPrompts: number
  enabledPrompts: number
  totalRegexScripts: number
  enabledRegexScripts: number
  hasModelParams: boolean
  hasSPresetConfig: boolean
}

// 导入后的本地预设格式
export interface LocalTavernPreset {
  id: string // 本地唯一ID
  name: string // 预设名称
  description?: string // 描述
  source: 'tavern' // 来源标识
  sourceFileName?: string // 源文件名
  importedAt: string // 导入时间（ISO格式）
  enabled: boolean // 是否激活

  // 原始配置
  modelParams: {
    temperature: number
    top_p: number
    top_k: number
    frequency_penalty: number
    presence_penalty: number
    max_context: number
    max_tokens: number
  }

  // 转换后的提示词
  prompts: TavernPromptItem[]
  promptOrder: TavernPromptOrderItem[]

  // 排序后的提示词（用于显示）
  orderedPrompts: TavernPromptItem[]

  // 正则脚本
  regexScripts: TavernRegexScript[]

  // SPreset配置（如果有）
  sPresetConfig?: TavernSPresetConfig

  // 统计信息
  stats: LocalTavernPresetStats

  // 原始数据（用于导出）
  rawData: TavernPreset
}

// 预设导入选项
export interface TavernPresetImportOptions {
  customName?: string
  activateImmediately?: boolean
}

// 预设验证结果
export interface TavernPresetValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    totalPrompts: number
    enabledPrompts: number
    totalRegexScripts: number
    enabledRegexScripts: number
    hasModelParams: boolean
    hasSPresetConfig: boolean
  }
}

// 标记类型映射
export const MARKER_IDENTIFIERS = {
  worldInfoBefore: 'World Info (before)',
  worldInfoAfter: 'World Info (after)',
  personaDescription: 'Persona Description',
  charDescription: 'Char Description',
  charPersonality: 'Char Personality',
  scenario: 'Scenario',
  dialogueExamples: 'Chat Examples',
  chatHistory: 'Chat History',
  main: 'Main Prompt',
  jailbreak: 'Jailbreak',
  nsfw: 'NSFW Prompt',
  enhanceDefinitions: 'Enhance Definitions',
} as const

export type MarkerIdentifier = keyof typeof MARKER_IDENTIFIERS

// 正则脚本应用位置
export const REGEX_PLACEMENT = {
  USER_INPUT: 0,
  AI_OUTPUT: 1,
  SLASH_COMMAND: 2,
} as const

// 注入位置
export const INJECTION_POSITION = {
  AFTER_SYSTEM: 0,
  IN_CHAT: 1,
} as const
