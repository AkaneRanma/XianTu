/**
 * 酒馆宏变量处理器
 * 处理酒馆预设中的各种宏变量，如 {{user}}, {{char}}, {{setvar}}, {{getvar}} 等
 */

import type { MacroContext } from '@/types/tavernPreset'

/**
 * 酒馆宏变量处理器类
 */
export class TavernMacroProcessor {
  private variables: Map<string, string> = new Map()

  /**
   * 处理内容中的所有宏变量
   * @param content 原始内容
   * @param context 宏变量上下文
   * @returns 处理后的内容
   */
  process(content: string, context: MacroContext): string {
    if (!content) return ''

    let result = content

    // 1. 首先处理注释 {{//...}} - 完全移除（包括多行注释）
    result = this.processComments(result)

    // 2. 处理 trim 标记（如果在开头）
    const hasTrim = result.includes('{{trim}}')
    result = result.replace(/\{\{trim\}\}/gi, '')

    // 3. 处理 setvar - 必须在 getvar 之前处理
    result = this.processSetVar(result, context)

    // 4. 处理基础变量替换
    result = this.processBasicVariables(result, context)

    // 5. 处理 getvar
    result = this.processGetVar(result, context)

    // 6. 处理随机选择 {{random::a::b::c}}
    result = this.processRandom(result)

    // 7. 处理嵌套宏（如果有 MacroNest 启用）
    let iterations = 0
    const maxIterations = 5
    while (this.hasUnprocessedMacros(result) && iterations < maxIterations) {
      const prevResult = result
      result = this.processBasicVariables(result, context)
      result = this.processGetVar(result, context)
      result = this.processRandom(result)
      if (prevResult === result) break
      iterations++
    }

    // 8. 最后处理 trim
    if (hasTrim) {
      result = result.trim()
    }

    return result
  }

  /**
   * 处理注释宏 {{//...}}
   * 支持多行注释和嵌套大括号（包括内部的 {{user}} 等宏）
   */
  private processComments(content: string): string {
    const input = content

    // 使用状态机方式处理嵌套的 {{ }} 对
    // 注释格式: {{// ... }}，可能包含嵌套的 {{ }}
    let output = ''
    let i = 0

    while (i < input.length) {
      // 检查是否是注释开始 {{//
      if (input.substring(i, i + 4) === '{{//' || input.substring(i, i + 5) === '{{// ') {
        // 找到注释开始，使用括号计数找到匹配的结束
        let depth = 1
        let j = i + 2 // 跳过第一个 {{

        while (j < input.length && depth > 0) {
          if (input.substring(j, j + 2) === '{{') {
            depth++
            j += 2
          } else if (input.substring(j, j + 2) === '}}') {
            depth--
            if (depth === 0) {
              // 找到匹配的结束 }}
              j += 2
              break
            }
            j += 2
          } else {
            j++
          }
        }

        // 跳过整个注释块
        i = j
      } else {
        output += input[i]
        i++
      }
    }

    return output
  }

  /**
   * 处理 setvar 宏 {{setvar::key::value}}
   * 支持复杂值（包含换行、嵌套宏等）
   * 使用状态机方式处理嵌套的 {{ }}
   */
  private processSetVar(content: string, context: MacroContext): string {
    let result = ''
    let i = 0
    const input = content

    while (i < input.length) {
      // 检查是否是 setvar 开始 {{setvar::
      if (input.substring(i, i + 10) === '{{setvar::') {
        // 找到 setvar 开始，解析 key 和 value
        let j = i + 10 // 跳过 {{setvar::

        // 解析 key（直到遇到 ::）
        let key = ''
        while (j < input.length && input.substring(j, j + 2) !== '::') {
          key += input[j]
          j++
        }

        if (input.substring(j, j + 2) === '::') {
          j += 2 // 跳过 ::

          // 使用括号计数解析 value（直到找到匹配的 }}）
          let value = ''
          let depth = 1 // 已经有一个 {{ 在 setvar 开始时

          while (j < input.length && depth > 0) {
            if (input.substring(j, j + 2) === '{{') {
              depth++
              value += '{{'
              j += 2
            } else if (input.substring(j, j + 2) === '}}') {
              depth--
              if (depth === 0) {
                // 找到匹配的结束 }}，不加入 value
                j += 2
                break
              }
              value += '}}'
              j += 2
            } else {
              value += input[j]
              j++
            }
          }

          // 存储变量（key 需要 trim，value 保持原样）
          const trimmedKey = key.trim()
          this.variables.set(trimmedKey, value)
          context.variables[trimmedKey] = value

          // setvar 不产生输出
          i = j
          continue
        }
      }

      // 普通字符
      result += input[i]
      i++
    }

    return result
  }

  /**
   * 处理基础变量替换
   */
  private processBasicVariables(content: string, context: MacroContext): string {
    let result = content

    // {{user}} - 用户名
    result = result.replace(/\{\{user\}\}/gi, context.user || '用户')

    // {{char}} - 角色名
    result = result.replace(/\{\{char\}\}/gi, context.char || 'AI')

    // {{lastUserMessage}} - 最后一条用户消息
    result = result.replace(/\{\{lastUserMessage\}\}/gi, context.lastUserMessage || '')

    // {{lastCharMessage}} - 最后一条角色消息
    if (context.lastCharMessage !== undefined) {
      result = result.replace(/\{\{lastCharMessage\}\}/gi, context.lastCharMessage || '')
    }

    // {{persona}} / {{personaDescription}} - 用户角色描述
    if (context.personaDescription !== undefined) {
      result = result.replace(/\{\{persona\}\}/gi, context.personaDescription || '')
      result = result.replace(/\{\{personaDescription\}\}/gi, context.personaDescription || '')
    }

    // {{personality}} / {{charPersonality}} - 角色性格
    if (context.charPersonality !== undefined) {
      result = result.replace(/\{\{personality\}\}/gi, context.charPersonality || '')
      result = result.replace(/\{\{charPersonality\}\}/gi, context.charPersonality || '')
    }

    // {{description}} / {{charDescription}} - 角色描述
    if (context.charDescription !== undefined) {
      result = result.replace(/\{\{description\}\}/gi, context.charDescription || '')
      result = result.replace(/\{\{charDescription\}\}/gi, context.charDescription || '')
    }

    // {{scenario}} - 场景
    if (context.scenario !== undefined) {
      result = result.replace(/\{\{scenario\}\}/gi, context.scenario || '')
    }

    // {{mesExamples}} / {{dialogueExamples}} - 对话示例
    if (context.dialogueExamples !== undefined) {
      result = result.replace(/\{\{mesExamples\}\}/gi, context.dialogueExamples || '')
      result = result.replace(/\{\{dialogueExamples\}\}/gi, context.dialogueExamples || '')
    }

    return result
  }

  /**
   * 处理 getvar 宏 {{getvar::key}}
   */
  private processGetVar(content: string, context: MacroContext): string {
    return content.replace(/\{\{getvar::([^}]+)\}\}/gi, (_, key) => {
      const trimmedKey = key.trim()
      // 优先从实例变量获取，其次从上下文获取
      return this.variables.get(trimmedKey) || context.variables[trimmedKey] || ''
    })
  }

  /**
   * 处理随机选择 {{random::a::b::c}}
   */
  private processRandom(content: string): string {
    return content.replace(/\{\{random::([^}]+)\}\}/gi, (_, options) => {
      const choices = options.split('::').filter((c: string) => c.length > 0)
      if (choices.length === 0) return ''
      return choices[Math.floor(Math.random() * choices.length)]
    })
  }

  /**
   * 检查是否还有未处理的宏
   */
  private hasUnprocessedMacros(content: string): boolean {
    const macroPatterns = [
      /\{\{user\}\}/i,
      /\{\{char\}\}/i,
      /\{\{getvar::/i,
      /\{\{random::/i,
    ]
    return macroPatterns.some((pattern) => pattern.test(content))
  }

  /**
   * 获取当前存储的所有变量
   */
  getVariables(): Record<string, string> {
    const result: Record<string, string> = {}
    this.variables.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  /**
   * 设置变量
   */
  setVariable(key: string, value: string): void {
    this.variables.set(key, value)
  }

  /**
   * 获取单个变量
   */
  getVariable(key: string): string | undefined {
    return this.variables.get(key)
  }

  /**
   * 重置变量状态
   */
  reset(): void {
    this.variables.clear()
  }

  /**
   * 从上下文初始化变量
   */
  initFromContext(context: MacroContext): void {
    Object.entries(context.variables).forEach(([key, value]) => {
      this.variables.set(key, value)
    })
  }
}

/**
 * 创建默认的宏上下文
 */
export function createDefaultMacroContext(overrides?: Partial<MacroContext>): MacroContext {
  return {
    user: '修士',
    char: 'AI',
    lastUserMessage: '',
    lastCharMessage: '',
    chatHistory: [],
    variables: {},
    worldInfoBefore: '',
    worldInfoAfter: '',
    personaDescription: '',
    charDescription: '',
    charPersonality: '',
    scenario: '',
    dialogueExamples: '',
    ...overrides,
  }
}

/**
 * 单例宏处理器（用于全局共享变量状态）
 */
let globalMacroProcessor: TavernMacroProcessor | null = null

export function getGlobalMacroProcessor(): TavernMacroProcessor {
  if (!globalMacroProcessor) {
    globalMacroProcessor = new TavernMacroProcessor()
  }
  return globalMacroProcessor
}

export function resetGlobalMacroProcessor(): void {
  if (globalMacroProcessor) {
    globalMacroProcessor.reset()
  }
}
