/**
 * 酒馆正则脚本执行引擎
 * 用于处理酒馆预设中的正则替换规则
 */

import type { TavernRegexScript } from '@/types/tavernPreset'
import { REGEX_PLACEMENT } from '@/types/tavernPreset'

/**
 * 正则脚本执行选项
 */
export interface RegexExecutionOptions {
  chatDepth?: number // 当前聊天深度（消息位置）
  isMarkdownRender?: boolean // 是否是Markdown渲染阶段
  isPromptPhase?: boolean // 是否是发送Prompt阶段
  isEditMode?: boolean // 是否是编辑模式
}

/**
 * 正则脚本执行结果
 */
export interface RegexExecutionResult {
  output: string
  appliedScripts: string[] // 应用的脚本名称列表
  errors: Array<{ scriptName: string; error: string }>
}

/**
 * 酒馆正则脚本执行引擎类
 */
export class TavernRegexEngine {
  /**
   * 对AI输出应用正则脚本
   * @param output AI原始输出
   * @param scripts 正则脚本列表
   * @param options 执行选项
   * @returns 执行结果
   */
  applyToOutput(
    output: string,
    scripts: TavernRegexScript[],
    options: RegexExecutionOptions = {},
  ): RegexExecutionResult {
    return this.apply(output, scripts, REGEX_PLACEMENT.AI_OUTPUT, options)
  }

  /**
   * 对用户输入应用正则脚本
   * @param input 用户输入
   * @param scripts 正则脚本列表
   * @param options 执行选项
   * @returns 执行结果
   */
  applyToInput(
    input: string,
    scripts: TavernRegexScript[],
    options: RegexExecutionOptions = {},
  ): RegexExecutionResult {
    return this.apply(input, scripts, REGEX_PLACEMENT.USER_INPUT, options)
  }

  /**
   * 通用应用方法
   */
  private apply(
    content: string,
    scripts: TavernRegexScript[],
    placementType: number,
    options: RegexExecutionOptions = {},
  ): RegexExecutionResult {
    let result = content
    const appliedScripts: string[] = []
    const errors: Array<{ scriptName: string; error: string }> = []

    for (const script of scripts) {
      // 1. 检查脚本是否禁用
      if (script.disabled) continue

      // 2. 检查 placement（应用位置）
      if (!script.placement.includes(placementType)) continue

      // 3. 检查深度限制
      if (options.chatDepth !== undefined) {
        if (script.minDepth !== null && options.chatDepth < script.minDepth) continue
        if (script.maxDepth !== null && options.chatDepth > script.maxDepth) continue
      }

      // 4. 检查 markdownOnly 限制
      if (script.markdownOnly && !options.isMarkdownRender) continue

      // 5. 检查 promptOnly 限制
      if (script.promptOnly && !options.isPromptPhase) continue

      // 6. 检查 runOnEdit 限制
      if (options.isEditMode && !script.runOnEdit) continue

      // 7. 执行正则替换
      try {
        const newResult = this.executeScript(result, script)
        if (newResult !== result) {
          result = newResult
          appliedScripts.push(script.scriptName)
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e)
        errors.push({
          scriptName: script.scriptName,
          error: errorMessage,
        })
        console.warn(`[TavernRegex] 执行失败: ${script.scriptName}`, e)
      }
    }

    return { output: result, appliedScripts, errors }
  }

  /**
   * 执行单个正则脚本
   */
  private executeScript(content: string, script: TavernRegexScript): string {
    const regex = this.parseRegex(script.findRegex)
    if (!regex) {
      throw new Error(`无效的正则表达式: ${script.findRegex}`)
    }

    let result = content.replace(regex, script.replaceString)

    // 处理 trimStrings
    if (script.trimStrings && script.trimStrings.length > 0) {
      for (const trimStr of script.trimStrings) {
        if (trimStr) {
          result = result.split(trimStr).join('')
        }
      }
    }

    return result
  }

  /**
   * 解析酒馆格式的正则表达式
   * 酒馆格式: /pattern/flags
   */
  parseRegex(regexStr: string): RegExp | null {
    if (!regexStr) return null

    // 尝试匹配 /pattern/flags 格式
    const match = regexStr.match(/^\/(.+)\/([gimsuy]*)$/)
    if (match) {
      const [, pattern, flags] = match
      try {
        return new RegExp(pattern, flags)
      } catch {
        return null
      }
    }

    // 如果不是标准格式，尝试作为普通正则处理
    try {
      return new RegExp(regexStr, 'g')
    } catch {
      return null
    }
  }

  /**
   * 验证正则表达式是否有效
   */
  validateRegex(regexStr: string): { valid: boolean; error?: string } {
    try {
      const regex = this.parseRegex(regexStr)
      if (!regex) {
        return { valid: false, error: '无法解析正则表达式' }
      }
      return { valid: true }
    } catch (e) {
      return {
        valid: false,
        error: e instanceof Error ? e.message : '未知错误',
      }
    }
  }

  /**
   * 测试正则脚本
   * @param testInput 测试输入
   * @param script 正则脚本
   * @returns 测试结果
   */
  testScript(
    testInput: string,
    script: TavernRegexScript,
  ): {
    success: boolean
    output: string
    matches: string[]
    error?: string
  } {
    try {
      const regex = this.parseRegex(script.findRegex)
      if (!regex) {
        return {
          success: false,
          output: testInput,
          matches: [],
          error: '无法解析正则表达式',
        }
      }

      // 收集所有匹配
      const matches: string[] = []
      let match: RegExpExecArray | null
      const testRegex = new RegExp(regex.source, regex.flags.replace('g', '') + 'g')
      while ((match = testRegex.exec(testInput)) !== null) {
        matches.push(match[0])
        if (!regex.global) break
      }

      // 执行替换
      const output = this.executeScript(testInput, script)

      return {
        success: true,
        output,
        matches,
      }
    } catch (e) {
      return {
        success: false,
        output: testInput,
        matches: [],
        error: e instanceof Error ? e.message : '执行错误',
      }
    }
  }

  /**
   * 批量测试正则脚本
   */
  testScripts(
    testInput: string,
    scripts: TavernRegexScript[],
    placementType: number = REGEX_PLACEMENT.AI_OUTPUT,
  ): {
    finalOutput: string
    steps: Array<{
      scriptName: string
      input: string
      output: string
      applied: boolean
    }>
  } {
    let currentOutput = testInput
    const steps: Array<{
      scriptName: string
      input: string
      output: string
      applied: boolean
    }> = []

    for (const script of scripts) {
      if (script.disabled) continue
      if (!script.placement.includes(placementType)) continue

      const input = currentOutput
      try {
        const output = this.executeScript(currentOutput, script)
        const applied = output !== input
        steps.push({
          scriptName: script.scriptName,
          input,
          output,
          applied,
        })
        currentOutput = output
      } catch {
        steps.push({
          scriptName: script.scriptName,
          input,
          output: input,
          applied: false,
        })
      }
    }

    return {
      finalOutput: currentOutput,
      steps,
    }
  }
}

/**
 * 将酒馆正则脚本转换为简化格式（用于存储和显示）
 */
export interface SimplifiedRegexRule {
  id: string
  name: string
  pattern: string
  flags: string
  replacement: string
  enabled: boolean
  appliesTo: ('input' | 'output' | 'command')[]
  depthRange?: { min?: number; max?: number }
}

export function convertToSimplifiedRule(script: TavernRegexScript): SimplifiedRegexRule {
  const regexMatch = script.findRegex.match(/^\/(.+)\/([gimsuy]*)$/)
  const pattern = regexMatch ? regexMatch[1] : script.findRegex
  const flags = regexMatch ? regexMatch[2] : 'g'

  const appliesTo: ('input' | 'output' | 'command')[] = []
  if (script.placement.includes(REGEX_PLACEMENT.USER_INPUT)) appliesTo.push('input')
  if (script.placement.includes(REGEX_PLACEMENT.AI_OUTPUT)) appliesTo.push('output')
  if (script.placement.includes(REGEX_PLACEMENT.SLASH_COMMAND)) appliesTo.push('command')

  return {
    id: script.id,
    name: script.scriptName,
    pattern,
    flags,
    replacement: script.replaceString,
    enabled: !script.disabled,
    appliesTo,
    depthRange:
      script.minDepth !== null || script.maxDepth !== null
        ? {
            min: script.minDepth ?? undefined,
            max: script.maxDepth ?? undefined,
          }
        : undefined,
  }
}

/**
 * 格式化 placement 为可读字符串
 */
export function formatPlacement(placement: number[]): string {
  const labels: string[] = []
  if (placement.includes(REGEX_PLACEMENT.USER_INPUT)) labels.push('输入')
  if (placement.includes(REGEX_PLACEMENT.AI_OUTPUT)) labels.push('输出')
  if (placement.includes(REGEX_PLACEMENT.SLASH_COMMAND)) labels.push('命令')
  return labels.join(', ') || '无'
}

/**
 * 单例正则引擎
 */
let globalRegexEngine: TavernRegexEngine | null = null

export function getGlobalRegexEngine(): TavernRegexEngine {
  if (!globalRegexEngine) {
    globalRegexEngine = new TavernRegexEngine()
  }
  return globalRegexEngine
}
