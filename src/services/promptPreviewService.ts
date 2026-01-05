/**
 * 提示词预览服务
 * 用于生成各种场景下的AI请求消息预览
 */

import { useGameStateStore } from '@/stores/gameStateStore';
import { useUIStore } from '@/stores/uiStore';
import { cloneDeep } from 'lodash';
import { getPrompt } from '@/services/defaultPrompts';
import { assembleSystemPrompt } from '@/utils/prompts/promptAssembler';
import { textOptimizationService } from '@/services/textOptimizationService';
import { tavernPresetService } from '@/services/tavernPresetService';
import { TavernMacroProcessor, createDefaultMacroContext } from '@/utils/tavernMacros';
import { TavernRegexEngine } from '@/utils/tavernRegex';
import type { MacroContext, TavernRegexScript } from '@/types/tavernPreset';
import { REGEX_PLACEMENT } from '@/types/tavernPreset';

// ==================== 类型定义 ====================

export interface PreviewMessage {
  id: string;
  sourceId: string;         // 🔥 稳定的源标识符（用于排序持久化）
  role: 'system' | 'user' | 'assistant';
  content: string;
  source: string;           // 来源说明（如"系统提示词"、"短期记忆"等）
  depth: number;            // 注入深度
  charCount: number;        // 字符数
  truncated?: boolean;      // 是否被截断显示
  fullContent?: string;     // 完整内容（用于展开查看）
}

export interface PreviewResult {
  messages: PreviewMessage[];
  totalCharCount: number;
  estimatedTokens: number;  // 估算token数（字符数/2.5）
  // 用于酒馆预设ChatSquash模式
  preMergeMessages?: PreviewMessage[];  // 合并前的原始消息
  isChatSquashed?: boolean;              // 是否使用了ChatSquash
}

export type PreviewScenario =
  | 'text_generation'       // 正文生成
  | 'variable_generation'   // 变量生成
  | 'variable_reroll'       // 重新生成变量
  | 'text_optimization'     // 正文优化
  | 'text_optimization_reroll' // 重新优化正文
  | 'tavern_preset'         // 酒馆预设预览
  | 'opening_text'          // 开局正文（第1步）
  | 'opening_variable';     // 开局变量（第2步）

// 世界书条目作用场景
export type WorldBookTarget = 'text' | 'variable' | 'optimization' | 'opening_text' | 'opening_variable';

export interface WorldBookEntry {
  id: string;
  name: string;
  content: string;
  role: 'system' | 'user' | 'assistant';
  enabled: boolean;
  depth: number;
  triggerMode: 'always' | 'keyword';
  keywords: string[];
  order: number;
  // 作用场景（可多选）
  targets: WorldBookTarget[];
}

export interface ShortTermMemoryConfig {
  textGenerationCount: number;
  variableGenerationCount: number;
  variableRerollCount: number;          // 变量再生成独立配置
  textOptimizationCount: number;
  textOptimizationRerollCount: number;  // 正文再优化独立配置
  tavernPresetCount: number;            // 酒馆预设独立配置
  promptTemplate: string;
  optimizedTextHistoryCount: number;    // 优化正文历史层数（用于生成时的上下文）
}

export interface PreviewOptions {
  shortTermMemoryCount?: number;  // 使用的短期记忆条数
  userInput?: string;             // 模拟的用户输入
  step1Text?: string;             // 第一步正文（用于变量生成预览）
  step1Thinking?: string;         // 第一步思维链
}

// 组合记忆结果
export interface CombinedMemories {
  shortTerm: string[];           // 短期记忆（最新N条）
  midTerm: string[];             // 中期记忆（全部）
  longTerm: string[];            // 长期记忆（全部）
  combined: string[];            // 合并后的全部记忆（顺序：长期→中期→短期）
}

// ==================== 默认值 ====================

const DEFAULT_MEMORY_TEMPLATE = `# 【最近事件】
{{memories}}
根据这刚刚发生的文本事件，合理生成下一次文本信息，要保证衔接流畅、不断层，符合上文的文本信息`;

const DEFAULT_MEMORY_CONFIG: ShortTermMemoryConfig = {
  textGenerationCount: 3,
  variableGenerationCount: 3,
  variableRerollCount: 3,
  textOptimizationCount: 0,
  textOptimizationRerollCount: 0,
  tavernPresetCount: 5,
  promptTemplate: DEFAULT_MEMORY_TEMPLATE,
  optimizedTextHistoryCount: 3,  // 默认使用3层历史优化正文作为上下文
};

const STORAGE_KEY_MEMORY_CONFIG = 'prompt-preview-memory-config';
const STORAGE_KEY_WORLD_BOOK = 'prompt-preview-world-book';

// ==================== 服务实现 ====================

class PromptPreviewService {
  private worldBookEntries: WorldBookEntry[] = [];
  private memoryConfig: ShortTermMemoryConfig = { ...DEFAULT_MEMORY_CONFIG };

  constructor() {
    this.loadFromStorage();
  }

  // ==================== 存储管理 ====================

  private loadFromStorage(): void {
    try {
      // 加载记忆配置
      const configStr = localStorage.getItem(STORAGE_KEY_MEMORY_CONFIG);
      if (configStr) {
        const config = JSON.parse(configStr);
        this.memoryConfig = { ...DEFAULT_MEMORY_CONFIG, ...config };
      }

      // 加载世界书
      const worldBookStr = localStorage.getItem(STORAGE_KEY_WORLD_BOOK);
      if (worldBookStr) {
        this.worldBookEntries = JSON.parse(worldBookStr);
      }
    } catch (error) {
      console.error('[PromptPreviewService] 加载配置失败:', error);
    }
  }

  public saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_MEMORY_CONFIG, JSON.stringify(this.memoryConfig));
      localStorage.setItem(STORAGE_KEY_WORLD_BOOK, JSON.stringify(this.worldBookEntries));
    } catch (error) {
      console.error('[PromptPreviewService] 保存配置失败:', error);
    }
  }

  // ==================== 记忆配置 ====================

  public getMemoryConfig(): ShortTermMemoryConfig {
    return { ...this.memoryConfig };
  }

  public setMemoryConfig(config: Partial<ShortTermMemoryConfig>): void {
    this.memoryConfig = { ...this.memoryConfig, ...config };
    this.saveToStorage();
  }

  public getShortTermMemoryPromptTemplate(): string {
    return this.memoryConfig.promptTemplate;
  }

  public setShortTermMemoryPromptTemplate(template: string): void {
    this.memoryConfig.promptTemplate = template;
    this.saveToStorage();
  }

  public resetMemoryTemplate(): void {
    this.memoryConfig.promptTemplate = DEFAULT_MEMORY_TEMPLATE;
    this.saveToStorage();
  }

  // ==================== 世界书管理 ====================

  public getWorldBookEntries(): WorldBookEntry[] {
    return cloneDeep(this.worldBookEntries);
  }

  public setWorldBookEntries(entries: WorldBookEntry[]): void {
    this.worldBookEntries = cloneDeep(entries);
    this.saveToStorage();
  }

  public addWorldBookEntry(entry: Omit<WorldBookEntry, 'id'>): WorldBookEntry {
    const newEntry: WorldBookEntry = {
      ...entry,
      id: `wb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    this.worldBookEntries.push(newEntry);
    this.saveToStorage();
    return newEntry;
  }

  public updateWorldBookEntry(id: string, updates: Partial<WorldBookEntry>): void {
    const index = this.worldBookEntries.findIndex(e => e.id === id);
    if (index !== -1) {
      this.worldBookEntries[index] = { ...this.worldBookEntries[index], ...updates };
      this.saveToStorage();
    }
  }

  public removeWorldBookEntry(id: string): void {
    this.worldBookEntries = this.worldBookEntries.filter(e => e.id !== id);
    this.saveToStorage();
  }

  public getWorldBookEntriesForTarget(target: WorldBookTarget, matchContext?: string): WorldBookEntry[] {
    return this.worldBookEntries
      .filter(e => {
        if (!e.enabled || !e.targets.includes(target)) return false;
        // 如果是关键词触发模式，需要检查关键词匹配
        if (e.triggerMode === 'keyword') {
          if (!matchContext) return false;
          return this.matchKeywords(e.keywords, matchContext);
        }
        return true; // 始终触发模式
      })
      .sort((a, b) => b.depth - a.depth); // 按depth降序
  }

  /**
   * 检查关键词是否匹配上下文
   * @param keywords 关键词列表
   * @param context 匹配上下文（用户输入 + 短期记忆等）
   * @returns 是否匹配
   */
  private matchKeywords(keywords: string[], context: string): boolean {
    if (!keywords || keywords.length === 0) return false;
    const lowerContext = context.toLowerCase();
    return keywords.some(keyword => {
      if (!keyword || keyword.trim() === '') return false;
      return lowerContext.includes(keyword.toLowerCase().trim());
    });
  }

  // ==================== 辅助方法 ====================

  public getShortTermMemories(): string[] {
    const gameStateStore = useGameStateStore();
    return gameStateStore.memory?.短期记忆 || [];
  }

  /**
   * 获取组合记忆（短期+中期+长期）
   * 仅用于正文生成和酒馆预设场景
   * @param shortTermCount 短期记忆条数限制
   * @returns 分类的记忆内容
   *
   * 记忆去重逻辑：
   * - 短期记忆：取最新的N条
   * - 中期记忆：去除最新的N条（因为可能与短期记忆重复）
   * - 长期记忆：全部保留
   */
  public getCombinedMemories(shortTermCount: number): CombinedMemories {
    const gameStateStore = useGameStateStore();
    const memory = gameStateStore.memory;

    // 获取各类记忆
    const allShortTerm = memory?.短期记忆 || [];
    const allMidTerm = memory?.中期记忆 || [];
    const longTerm = memory?.长期记忆 || [];

    // 短期记忆：取最新的N条
    const shortTerm = shortTermCount > 0 ? allShortTerm.slice(-shortTermCount) : [];

    // 中期记忆：去除最新的N条（避免与短期记忆重复）
    // 例如：10条中期，选5条短期 → 中期取前5条（去掉最新5条）
    // 如果中期条数 <= 短期条数，则中期全部去除
    const midTermCount = shortTermCount > 0
      ? Math.max(0, allMidTerm.length - shortTermCount)
      : allMidTerm.length;
    const midTerm = allMidTerm.slice(0, midTermCount);

    // 按时间线顺序合并：长期（最早）→ 中期 → 短期（最新）
    const combined = [...longTerm, ...midTerm, ...shortTerm];

    return { shortTerm, midTerm, longTerm, combined };
  }

  public getGameStateJson(): string {
    const gameStateStore = useGameStateStore();
    const saveData = gameStateStore.toSaveData();
    if (!saveData) return '{}';

    const stateForAI = cloneDeep(saveData);
    if (stateForAI.记忆) {
      delete stateForAI.记忆.短期记忆;
      delete stateForAI.记忆.隐式中期记忆;
    }
    if (stateForAI.叙事历史) delete stateForAI.叙事历史;
    // 移除优化正文历史（独立管理，不发送给 AI）
    if (stateForAI.优化正文历史) delete stateForAI.优化正文历史;

    return JSON.stringify(stateForAI, null, 2);
  }

  /**
   * 格式化短期记忆提示词（仅短期记忆）
   * 用于变量生成、正文优化等场景
   */
  private formatMemoryPrompt(memories: string[], count: number): string {
    const selectedMemories = memories.slice(-count);
    const memoriesText = selectedMemories.join('\n');

    return this.memoryConfig.promptTemplate
      .replace(/\{\{memories\}\}/g, memoriesText)
      .replace(/\{\{shortTermMemories\}\}/g, memoriesText)
      .replace(/\{\{midTermMemories\}\}/g, '')
      .replace(/\{\{longTermMemories\}\}/g, '')
      .replace(/\{\{count\}\}/g, String(selectedMemories.length))
      .replace(/\{\{shortTermCount\}\}/g, String(selectedMemories.length))
      .replace(/\{\{midTermCount\}\}/g, '0')
      .replace(/\{\{longTermCount\}\}/g, '0');
  }

  /**
   * 格式化完整记忆提示词（支持分类变量）
   * 用于正文生成和酒馆预设场景
   *
   * 支持的模板变量：
   * - {{memories}} - 所有记忆（长期+中期+短期合并）
   * - {{shortTermMemories}} - 仅短期记忆
   * - {{midTermMemories}} - 仅中期记忆
   * - {{longTermMemories}} - 仅长期记忆
   * - {{count}} - 总记忆条数
   * - {{shortTermCount}} - 短期记忆条数
   * - {{midTermCount}} - 中期记忆条数
   * - {{longTermCount}} - 长期记忆条数
   */
  private formatCombinedMemoryPrompt(combinedMemories: CombinedMemories): string {
    const { shortTerm, midTerm, longTerm, combined } = combinedMemories;

    // 格式化各类记忆文本
    const allMemoriesText = combined.join('\n');
    const shortTermText = shortTerm.join('\n');
    const midTermText = midTerm.join('\n');
    const longTermText = longTerm.join('\n');

    return this.memoryConfig.promptTemplate
      // 全部记忆
      .replace(/\{\{memories\}\}/g, allMemoriesText)
      // 分类记忆
      .replace(/\{\{shortTermMemories\}\}/g, shortTermText)
      .replace(/\{\{midTermMemories\}\}/g, midTermText)
      .replace(/\{\{longTermMemories\}\}/g, longTermText)
      // 条数统计
      .replace(/\{\{count\}\}/g, String(combined.length))
      .replace(/\{\{shortTermCount\}\}/g, String(shortTerm.length))
      .replace(/\{\{midTermCount\}\}/g, String(midTerm.length))
      .replace(/\{\{longTermCount\}\}/g, String(longTerm.length));
  }

  private createMessage(
    role: 'system' | 'user' | 'assistant',
    content: string,
    source: string,
    depth: number,
    sourceId: string  // 🔥 新增：稳定的源标识符
  ): PreviewMessage {
    const truncateLength = 500;
    const truncated = content.length > truncateLength;

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourceId,  // 🔥 添加源标识符
      role,
      content: truncated ? content.substring(0, truncateLength) + '...' : content,
      source,
      depth,
      charCount: content.length,
      truncated,
      fullContent: truncated ? content : undefined,
    };
  }

  private calculateResult(messages: PreviewMessage[]): PreviewResult {
    const totalCharCount = messages.reduce((sum, m) => sum + m.charCount, 0);
    return {
      messages,
      totalCharCount,
      estimatedTokens: Math.ceil(totalCharCount / 2.5),
    };
  }

  // ==================== 预览生成 ====================

  public async generatePreview(
    scenario: PreviewScenario,
    options?: PreviewOptions
  ): Promise<PreviewResult> {
    switch (scenario) {
      case 'text_generation':
        return this.generateTextGenerationPreview(options);
      case 'variable_generation':
        return this.generateVariableGenerationPreview(options);
      case 'variable_reroll':
        return this.generateVariableRerollPreview(options);
      case 'text_optimization':
        return this.generateTextOptimizationPreview(options);
      case 'text_optimization_reroll':
        return this.generateTextOptimizationRerollPreview(options);
      case 'tavern_preset':
        return this.generateTavernPresetPreview(options);
      case 'opening_text':
        return this.generateOpeningTextPreview(options);
      case 'opening_variable':
        return this.generateOpeningVariablePreview(options);
      default:
        return { messages: [], totalCharCount: 0, estimatedTokens: 0 };
    }
  }

  // ==================== 正文生成预览 ====================

  private async generateTextGenerationPreview(options?: PreviewOptions): Promise<PreviewResult> {
    const messages: PreviewMessage[] = [];
    const uiStore = useUIStore();
    const gameStateStore = useGameStateStore();

    const memoryCount = options?.shortTermMemoryCount ?? this.memoryConfig.textGenerationCount;
    const userInput = options?.userInput || '继续当前活动';

    // 1. 获取游戏状态
    const saveData = gameStateStore.toSaveData();
    const stateForAI = cloneDeep(saveData);
    if (stateForAI?.记忆) {
      delete stateForAI.记忆.短期记忆;
      delete stateForAI.记忆.隐式中期记忆;
    }
    if (stateForAI?.叙事历史) delete stateForAI.叙事历史;
    const stateJsonString = JSON.stringify(stateForAI);

    // 2. 核心状态速览
    let coreStatusSummary = '# 角色核心状态速览\n';
    const playerStatus = stateForAI?.玩家角色状态;
    const character = stateForAI?.角色基础信息;

    if (playerStatus) {
      coreStatusSummary += `\n- 生命: 气血${playerStatus.气血?.当前}/${playerStatus.气血?.上限}`;
      if (playerStatus.境界) {
        const realm = playerStatus.境界;
        coreStatusSummary += `\n- 境界: ${realm.名称}-${realm.阶段}`;
      }
    }

    // 3. 组装系统提示词
    const activePrompts: string[] = [];
    if (uiStore.enableActionOptions) {
      activePrompts.push('actionOptions');
    }

    const assembledPrompt = await assembleSystemPrompt(activePrompts, uiStore.actionOptionsPrompt);
    const systemPrompt = `
${assembledPrompt}

${coreStatusSummary}

# 游戏状态
你正在修仙世界《仙途》中扮演GM。以下是当前完整游戏存档(JSON格式):
${stateJsonString}
`.trim();

    messages.push(this.createMessage('system', systemPrompt, '系统提示词（包含游戏状态）', 4, 'system_prompt'));

    // 4. 获取组合记忆（短期+中期+长期）- 正文生成使用完整记忆
    const combinedMemories = this.getCombinedMemories(memoryCount);

    // 5. 世界书条目（作用于正文）- 需要提供匹配上下文
    const matchContext = `${userInput}\n${combinedMemories.combined.slice(-5).join('\n')}`;
    const textWorldBooks = this.getWorldBookEntriesForTarget('text', matchContext);
    for (let i = 0; i < textWorldBooks.length; i++) {
      const entry = textWorldBooks[i];
      const triggerInfo = entry.triggerMode === 'keyword' ? ' 🟢' : ' 🔵';
      messages.push(this.createMessage(
        entry.role,
        entry.content,
        `世界书: ${entry.name}${triggerInfo}`,
        entry.depth,
        `world_book_text_${i}`  // 🔥 世界书条目标识符
      ));
    }

    // 6. 记忆提示词（短期+中期+长期）
    if (combinedMemories.combined.length > 0) {
      const memoryPrompt = this.formatCombinedMemoryPrompt(combinedMemories);
      const memorySummary = `短期${combinedMemories.shortTerm.length} + 中期${combinedMemories.midTerm.length} + 长期${combinedMemories.longTerm.length}`;
      messages.push(this.createMessage('assistant', memoryPrompt, `记忆信息（${memorySummary}）`, 2, 'memory_combined'));
    }

    // 7. CoT提示词（如果启用）
    if (uiStore.useSystemCot) {
      const cotPrompt = await getPrompt('cotCore');
      messages.push(this.createMessage(
        'system',
        cotPrompt.replace('{{用户输入}}', userInput),
        'CoT思维链提示词',
        1,
        'cot_prompt'
      ));
    }

    // 8. 用户输入
    messages.push(this.createMessage('user', userInput, '用户输入', 0, 'user_input'));

    // 9. 占位符
    messages.push(this.createMessage('assistant', '</input>', '输入结束占位符', 0, 'input_end_marker'));

    // 按depth排序（降序）
    messages.sort((a, b) => b.depth - a.depth);

    return this.calculateResult(messages);
  }

  // ==================== 变量生成预览 ====================

  private async generateVariableGenerationPreview(options?: PreviewOptions): Promise<PreviewResult> {
    const messages: PreviewMessage[] = [];
    const uiStore = useUIStore();
    const gameStateStore = useGameStateStore();

    const memoryCount = options?.shortTermMemoryCount ?? this.memoryConfig.variableGenerationCount;
    const step1Text = options?.step1Text || '（第一步正文内容将在此显示）';
    const step1Thinking = options?.step1Thinking || '';
    const userInput = options?.userInput || '继续当前活动';

    // 获取游戏状态
    const saveData = gameStateStore.toSaveData();
    const stateForAI = cloneDeep(saveData);
    if (stateForAI?.记忆) {
      delete stateForAI.记忆.短期记忆;
      delete stateForAI.记忆.隐式中期记忆;
    }
    if (stateForAI?.叙事历史) delete stateForAI.叙事历史;
    // 移除优化正文历史（独立管理，不发送给 AI）
    if (stateForAI?.优化正文历史) delete stateForAI.优化正文历史;
    const stateJsonString = JSON.stringify(stateForAI);

    // 1. Step2系统提示词
    const [
      stepRulesPrompt,
      coreOutputRulesPrompt,
      businessRulesPrompt,
      dataDefinitionsPrompt,
      textFormatsPrompt,
      worldStandardsPrompt
    ] = await Promise.all([
      getPrompt('splitGenerationStep2'),
      getPrompt('coreOutputRules'),
      getPrompt('businessRules'),
      getPrompt('dataDefinitions'),
      getPrompt('textFormatRules'),
      getPrompt('worldStandards')
    ]);

    // 彻底放开NSFW内容，不再过滤

    const sections: string[] = [
      stepRulesPrompt.trim(),
      coreOutputRulesPrompt,
      businessRulesPrompt,
      dataDefinitionsPrompt,
      textFormatsPrompt,
      worldStandardsPrompt
    ];

    // 如果启用了行动选项
    if (uiStore.enableActionOptions) {
      const actionOptionsPrompt = await getPrompt('actionOptions');
      const customPromptSection = uiStore.actionOptionsPrompt
        ? `**用户自定义要求**：${uiStore.actionOptionsPrompt}\n\n请严格按以上要求生成行动选项。`
        : '（无特殊要求，按默认规则生成）';
      sections.push(actionOptionsPrompt.replace('{{CUSTOM_ACTION_PROMPT}}', customPromptSection));
    }

    const step2SystemPrompt = `
${sections.join('\n\n---\n\n')}

# 游戏状态（JSON）
${stateJsonString}
`.trim();

    messages.push(this.createMessage('system', step2SystemPrompt, 'Step2系统提示词', 4, 'step2_system'));

    // 2. 获取短期记忆（需要先获取，用于世界书关键词匹配）
    const shortTermMemories = this.getShortTermMemories();

    // 3. 世界书条目（作用于变量）- 需要提供匹配上下文
    const matchContext = `${userInput}\n${step1Text}\n${shortTermMemories.slice(-memoryCount).join('\n')}`;
    const variableWorldBooks = this.getWorldBookEntriesForTarget('variable', matchContext);
    for (let i = 0; i < variableWorldBooks.length; i++) {
      const entry = variableWorldBooks[i];
      const triggerInfo = entry.triggerMode === 'keyword' ? ' 🟢' : ' 🔵';
      messages.push(this.createMessage(
        entry.role,
        entry.content,
        `世界书: ${entry.name}${triggerInfo}`,
        entry.depth,
        `world_book_variable_${i}`  // 🔥 变量场景世界书标识符
      ));
    }

    // 4. 短期记忆提示词
    if (memoryCount > 0 && shortTermMemories.length > 0) {
      const memoryPrompt = this.formatMemoryPrompt(shortTermMemories, memoryCount);
      messages.push(this.createMessage('assistant', memoryPrompt, `短期记忆（${Math.min(memoryCount, shortTermMemories.length)}条）`, 2, 'short_term_memory'));
    }

    // 5. 用户输入（包含第1步结果）
    const step2UserInput = `
【用户本次操作】
${userInput}

【第1步思维链】
${step1Thinking || '（无）'}

【第1步正文】
${step1Text}

请按"分步生成（第2步）"规则输出 JSON。
`.trim();

    messages.push(this.createMessage('user', step2UserInput, '用户输入（含Step1结果）', 0, 'step2_user_input'));

    // 6. 占位符
    messages.push(this.createMessage('assistant', '</input>', '输入结束占位符', 0, 'input_end_marker'));

    // 按depth排序（降序）
    messages.sort((a, b) => b.depth - a.depth);

    return this.calculateResult(messages);
  }

  private async generateVariableRerollPreview(options?: PreviewOptions): Promise<PreviewResult> {
    return this.generateVariableRerollPreviewInternal(options);
  }

  // ==================== 开局正文预览（第1步） ====================

  /**
   * 开局正文预览（第1步）
   * 不使用短期记忆，包含用户输入占位条目
   */
  private async generateOpeningTextPreview(options?: PreviewOptions): Promise<PreviewResult> {
    const messages: PreviewMessage[] = [];
    const uiStore = useUIStore();
    const gameStateStore = useGameStateStore();

    // 1. 获取开局分步系统提示词
    const [
      splitInitStep1,
      coreOutputRulesPrompt,
      businessRulesPrompt,
      dataDefinitionsPrompt,
      textFormatsPrompt,
      worldStandardsPrompt,
      characterInitPrompt
    ] = await Promise.all([
      getPrompt('splitInitStep1'),
      getPrompt('coreOutputRules'),
      getPrompt('businessRules'),
      getPrompt('dataDefinitions'),
      getPrompt('textFormatRules'),
      getPrompt('worldStandards'),
      getPrompt('characterInit')
    ]);

    // 2. 获取游戏状态（用于原始系统提示词）
    const saveData = gameStateStore.toSaveData();
    const stateForAI = cloneDeep(saveData);
    if (stateForAI?.记忆) {
      delete stateForAI.记忆.短期记忆;
      delete stateForAI.记忆.隐式中期记忆;
    }
    if (stateForAI?.叙事历史) delete stateForAI.叙事历史;
    if (stateForAI?.优化正文历史) delete stateForAI.优化正文历史;

    // 3. 组装原始系统提示词
    const sections: string[] = [
      coreOutputRulesPrompt,
      businessRulesPrompt,
      dataDefinitionsPrompt,
      textFormatsPrompt,
      worldStandardsPrompt,
      characterInitPrompt
    ];

    if (uiStore.enableActionOptions) {
      const actionOptionsPrompt = await getPrompt('actionOptions');
      const customPromptSection = uiStore.actionOptionsPrompt
        ? `**用户自定义要求**：${uiStore.actionOptionsPrompt}\n\n请严格按以上要求生成行动选项。`
        : '（无特殊要求，按默认规则生成）';
      sections.push(actionOptionsPrompt.replace('{{CUSTOM_ACTION_PROMPT}}', customPromptSection));
    }

    const originalSystemPrompt = sections.join('\n\n---\n\n');

    // 4. 组合成开局第1步系统提示词
    const step1SystemPrompt = `
${splitInitStep1.trim()}

---

# 原始系统提示词（供参考；若与本步目标冲突，以本步规则为准）
${originalSystemPrompt}

# 游戏状态（JSON）
${JSON.stringify(stateForAI)}
    `.trim();

    messages.push(this.createMessage('system', step1SystemPrompt, '开局第1步系统提示词（splitInitStep1）', 4, 'opening_step1_system'));

    // 5. 世界书条目（作用于开局正文）
    const openingTextWorldBooks = this.getWorldBookEntriesForTarget('opening_text', '开局');
    for (let i = 0; i < openingTextWorldBooks.length; i++) {
      const entry = openingTextWorldBooks[i];
      const triggerInfo = entry.triggerMode === 'keyword' ? ' 🟢' : ' 🔵';
      messages.push(this.createMessage(
        entry.role,
        entry.content,
        `世界书: ${entry.name}${triggerInfo}`,
        entry.depth,
        `world_book_opening_text_${i}`
      ));
    }

    // 6. 用户开局设定占位条目
    const userOpeningInput = options?.userInput || '（用户开局设定：角色名、世界选择、出身背景等将在此显示）';
    messages.push(this.createMessage('user', userOpeningInput, '用户开局设定（占位）', 0, 'opening_user_input'));

    // 7. 占位符
    messages.push(this.createMessage('assistant', '</input>', '输入结束占位符', 0, 'input_end_marker'));

    // 按depth排序（降序）
    messages.sort((a, b) => b.depth - a.depth);

    return this.calculateResult(messages);
  }

  // ==================== 开局变量预览（第2步） ====================

  /**
   * 开局变量预览（第2步）
   * 不使用短期记忆，包含第1步正文占位条目
   */
  private async generateOpeningVariablePreview(options?: PreviewOptions): Promise<PreviewResult> {
    const messages: PreviewMessage[] = [];
    const uiStore = useUIStore();
    const gameStateStore = useGameStateStore();

    // 1. 获取开局分步第2步系统提示词
    const [
      splitInitStep2,
      coreOutputRulesPrompt,
      businessRulesPrompt,
      dataDefinitionsPrompt,
      textFormatsPrompt,
      worldStandardsPrompt
    ] = await Promise.all([
      getPrompt('splitInitStep2'),
      getPrompt('coreOutputRules'),
      getPrompt('businessRules'),
      getPrompt('dataDefinitions'),
      getPrompt('textFormatRules'),
      getPrompt('worldStandards')
    ]);

    // 2. 获取游戏状态
    const saveData = gameStateStore.toSaveData();
    const stateForAI = cloneDeep(saveData);
    if (stateForAI?.记忆) {
      delete stateForAI.记忆.短期记忆;
      delete stateForAI.记忆.隐式中期记忆;
    }
    if (stateForAI?.叙事历史) delete stateForAI.叙事历史;
    if (stateForAI?.优化正文历史) delete stateForAI.优化正文历史;

    // 3. 组装开局第2步系统提示词
    const sections: string[] = [
      splitInitStep2.trim(),
      coreOutputRulesPrompt,
      businessRulesPrompt,
      dataDefinitionsPrompt,
      textFormatsPrompt,
      worldStandardsPrompt
    ];

    if (uiStore.enableActionOptions) {
      const actionOptionsPrompt = await getPrompt('actionOptions');
      const customPromptSection = uiStore.actionOptionsPrompt
        ? `**用户自定义要求**：${uiStore.actionOptionsPrompt}\n\n请严格按以上要求生成行动选项。`
        : '（无特殊要求，按默认规则生成）';
      sections.push(actionOptionsPrompt.replace('{{CUSTOM_ACTION_PROMPT}}', customPromptSection));
    }

    const step2SystemPrompt = `
${sections.join('\n\n---\n\n')}

# 游戏状态（JSON）
${JSON.stringify(stateForAI)}
    `.trim();

    messages.push(this.createMessage('system', step2SystemPrompt, '开局第2步系统提示词（splitInitStep2）', 4, 'opening_step2_system'));

    // 4. 世界书条目（作用于开局变量）
    const openingVariableWorldBooks = this.getWorldBookEntriesForTarget('opening_variable', '开局');
    for (let i = 0; i < openingVariableWorldBooks.length; i++) {
      const entry = openingVariableWorldBooks[i];
      const triggerInfo = entry.triggerMode === 'keyword' ? ' 🟢' : ' 🔵';
      messages.push(this.createMessage(
        entry.role,
        entry.content,
        `世界书: ${entry.name}${triggerInfo}`,
        entry.depth,
        `world_book_opening_variable_${i}`
      ));
    }

    // 5. 用户输入（包含第1步结果占位）
    const step1Text = options?.step1Text || '（第1步正文内容将在此显示）';
    const step1Thinking = options?.step1Thinking || '（第1步思维链内容将在此显示）';
    const userOpeningInput = options?.userInput || '（用户开局设定）';

    const step2UserInput = `
【用户开局设定】
${userOpeningInput}

【第1步思维链】
${step1Thinking}

【第1步正文】
${step1Text}

请按"分步生成（开局-第2步）"规则输出 JSON。
    `.trim();

    messages.push(this.createMessage('user', step2UserInput, '用户输入（含开局第1步结果占位）', 0, 'opening_step2_user_input'));

    // 6. 占位符
    messages.push(this.createMessage('assistant', '</input>', '输入结束占位符', 0, 'input_end_marker'));

    // 按depth排序（降序）
    messages.sort((a, b) => b.depth - a.depth);

    return this.calculateResult(messages);
  }

  // ==================== 正文优化预览 ====================

  private async generateTextOptimizationPreview(options?: PreviewOptions): Promise<PreviewResult> {
    const messages: PreviewMessage[] = [];

    const sourceText = options?.step1Text || '（待优化的正文内容将在此显示）';
    const userInput = options?.userInput || '';

    // 🔥 获取最新一层历史优化正文（用于关键词匹配）
    // 首次优化时，不排除最新层（isReroll=false）
    const latestHistoryText = textOptimizationService.getLatestHistoryText(false);

    // 🔥 构建关键词匹配上下文：待优化正文 + 用户输入 + 最新一层历史优化正文
    const keywordContext = [sourceText, userInput, latestHistoryText]
      .filter(text => text && text.trim())
      .join('\n\n');

    // 🔥 构建宏上下文（用于占位符处理）
    const macroContext = textOptimizationService.buildOptimizationMacroContext(
      sourceText,
      userInput,
      false  // isReroll = false
    );
    const macroProcessor = new TavernMacroProcessor();

    // 🔥 诊断日志：打印宏上下文
    console.log('[正文优化预览] macroContext:', {
      sourceText: macroContext.sourceText?.substring(0, 100) || '(空)',
      optimizedHistory: Array.isArray(macroContext.optimizedHistory)
        ? `[${macroContext.optimizedHistory.length}层] ${macroContext.optimizedHistory.join('\n').substring(0, 100)}`
        : '(空)',
      playerInput: macroContext.playerInput?.substring(0, 100) || '(空)',
    });

    // 1. 获取正文优化条目（按order排序）
    const allEntries = textOptimizationService.getEnabledEntries();

    // 🔥 诊断日志：打印所有启用条目
    console.log('[正文优化预览] 获取到的全部启用条目数量:', allEntries.length);
    allEntries.forEach((entry, idx) => {
      console.log(`[正文优化预览] 条目${idx} "${entry.name}" 原始内容:`, entry.content?.substring(0, 100) || '(空)', '长度:', entry.content?.length || 0);
    });

    const enabledEntries = allEntries.filter(entry => {
      // 如果是关键词触发模式，检查是否匹配
      if (entry.triggerMode === 'keyword') {
        return this.matchKeywords(entry.keywords || [], keywordContext);
      }
      return true; // 始终触发模式
    });

    // 🔥 诊断日志：打印过滤后的条目
    console.log('[正文优化预览] 过滤后的条目数量:', enabledEntries.length);

    // 🔥 按order顺序添加消息（保持用户配置的顺序，不再按depth排序）
    for (let i = 0; i < enabledEntries.length; i++) {
      const entry = enabledEntries[i];
      const triggerInfo = entry.triggerMode === 'keyword' ? ' 🟢' : ' 🔵';

      // 🔥 诊断日志：打印处理前的原始内容
      console.log(`[正文优化预览] 处理条目${i} "${entry.name}"`);
      console.log(`[正文优化预览] 条目${i} 原始内容长度:`, entry.content?.length || 0);
      console.log(`[正文优化预览] 条目${i} 原始内容前200字符:`, entry.content?.substring(0, 200) || '(空)');

      // 🔥 应用占位符处理
      const processedContent = macroProcessor.process(entry.content, macroContext);

      // 🔥 诊断日志：打印处理后的内容
      console.log(`[正文优化预览] 条目${i} "${entry.name}" 处理后内容长度:`, processedContent?.length || 0);
      console.log(`[正文优化预览] 条目${i} 处理后内容前200字符:`, processedContent?.substring(0, 200) || '(空)');

      messages.push(this.createMessage(
        entry.role,
        processedContent,
        `优化条目: ${entry.name}${triggerInfo}`,
        i,  // 🔥 使用索引作为顺序标识，不再用于排序
        `optimization_entry_${i}`
      ));
    }

    // 2. 世界书条目（作用于优化）- 需要提供匹配上下文
    const optimizationWorldBooks = this.getWorldBookEntriesForTarget('optimization', sourceText);
    for (let i = 0; i < optimizationWorldBooks.length; i++) {
      const entry = optimizationWorldBooks[i];
      messages.push(this.createMessage(
        entry.role,
        entry.content,
        `世界书: ${entry.name}`,
        enabledEntries.length + i,
        `world_book_optimization_${i}`
      ));
    }

    // 🔥 不再自动插入"历史优化正文"和"待优化正文"消息
    // 用户通过 {{optimizedHistory}} 和 {{sourceText}} 占位符自行控制

    // 🔥 不再按depth排序，保持原始顺序
    // messages.sort((a, b) => b.depth - a.depth);  // 已删除

    return this.calculateResult(messages);
  }

  // ==================== 正文再优化预览 ====================

  private async generateTextOptimizationRerollPreview(options?: PreviewOptions): Promise<PreviewResult> {
    const uiStore = useUIStore();

    // 🔥 Re-roll时使用原始正文（未优化的Step1文本）
    const originalText = uiStore.originalStep1Text || uiStore.lastStep1Text || uiStore.splitStep1Text || '';
    const userInput = options?.userInput || uiStore.lastUserInput || '';

    // 🔥 正文再优化不使用短期记忆，只使用历史优化正文+第一步正文
    // 与首次优化相同，但传递 isReroll=true 参数
    const messages: PreviewMessage[] = [];
    const sourceText = options?.step1Text || originalText || '（请先生成一次正文）';

    // 🔥 获取最新一层历史优化正文（用于关键词匹配）
    // Re-roll时，排除最新层（isReroll=true），模拟删除后的状态
    const latestHistoryText = textOptimizationService.getLatestHistoryText(true);

    // 🔥 构建关键词匹配上下文：待优化正文 + 用户输入 + (删除最新层后的)最新一层历史优化正文
    const keywordContext = [sourceText, userInput, latestHistoryText]
      .filter(text => text && text.trim())
      .join('\n\n');

    // 🔥 构建宏上下文（用于占位符处理）- Re-roll时排除最新层
    const macroContext = textOptimizationService.buildOptimizationMacroContext(
      sourceText,
      userInput,
      true  // isReroll = true
    );
    const macroProcessor = new TavernMacroProcessor();

    // 1. 获取正文优化条目（按order排序）
    const allEntries = textOptimizationService.getEnabledEntries();
    const enabledEntries = allEntries.filter(entry => {
      if (entry.triggerMode === 'keyword') {
        return this.matchKeywords(entry.keywords || [], keywordContext);
      }
      return true;
    });

    // 🔥 按order顺序添加消息（保持用户配置的顺序，不再按depth排序）
      for (let i = 0; i < enabledEntries.length; i++) {
        const entry = enabledEntries[i];
        const triggerInfo = entry.triggerMode === 'keyword' ? ' 🟢' : ' 🔵';

        // 🔥 诊断日志：打印处理前的原始内容
        console.log(`[正文优化预览] 条目${i} "${entry.name}" 原始内容长度:`, entry.content?.length || 0);
        console.log(`[正文优化预览] 条目${i} 原始内容前100字符:`, entry.content?.substring(0, 100) || '(空)');

        // 🔥 应用占位符处理
        const processedContent = macroProcessor.process(entry.content, macroContext);

        // 🔥 诊断日志：打印处理后的内容
        console.log(`[正文优化预览] 条目${i} "${entry.name}" 处理后内容长度:`, processedContent?.length || 0);
        console.log(`[正文优化预览] 条目${i} 处理后内容前100字符:`, processedContent?.substring(0, 100) || '(空)');

        messages.push(this.createMessage(
          entry.role,
          processedContent,
          `优化条目: ${entry.name}${triggerInfo}`,
          i,  // 🔥 使用索引作为顺序标识，不再用于排序
          `optimization_entry_${i}`
        ));
      }

    // 2. 世界书条目（作用于优化）
    const optimizationWorldBooks = this.getWorldBookEntriesForTarget('optimization', sourceText);
    for (let i = 0; i < optimizationWorldBooks.length; i++) {
      const entry = optimizationWorldBooks[i];
      messages.push(this.createMessage(
        entry.role,
        entry.content,
        `世界书: ${entry.name}`,
        enabledEntries.length + i,
        `world_book_optimization_${i}`
      ));
    }

    // 🔥 不再自动插入"历史优化正文"和"待优化正文"消息
    // 用户通过 {{optimizedHistory}} 和 {{sourceText}} 占位符自行控制

    // 🔥 不再按depth排序，保持原始顺序
    // messages.sort((a, b) => b.depth - a.depth);  // 已删除

    return this.calculateResult(messages);
  }

  // ==================== 变量再生成预览 ====================

  private async generateVariableRerollPreviewInternal(options?: PreviewOptions): Promise<PreviewResult> {
    const uiStore = useUIStore();

    // 使用保存的上下文
    const savedStep1Text = uiStore.originalStep1Text || uiStore.lastStep1Text || '';
    const savedStep1Thinking = uiStore.lastStep1Thinking || '';
    const savedUserInput = uiStore.lastUserInput || '';

    // 使用再生成的独立记忆配置
    const memoryCount = options?.shortTermMemoryCount ?? this.memoryConfig.variableRerollCount;

    return this.generateVariableGenerationPreview({
      ...options,
      shortTermMemoryCount: memoryCount,
      step1Text: options?.step1Text || savedStep1Text || '（请先生成一次正文）',
      step1Thinking: options?.step1Thinking || savedStep1Thinking,
      userInput: options?.userInput || savedUserInput || '继续当前活动',
    });
  }

  // ==================== 导入导出 ====================

  public exportWorldBook(): string {
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      entries: this.worldBookEntries,
    }, null, 2);
  }

  public importWorldBook(data: string): number {
    try {
      const parsed = JSON.parse(data);
      let entries: WorldBookEntry[] = [];

      // 支持多种格式
      if (Array.isArray(parsed)) {
        entries = parsed.map(this.convertToWorldBookEntry);
      } else if (parsed.entries && Array.isArray(parsed.entries)) {
        entries = parsed.entries.map(this.convertToWorldBookEntry);
      } else if (parsed.worldBooks && Array.isArray(parsed.worldBooks)) {
        entries = parsed.worldBooks.map(this.convertToWorldBookEntry);
      }

      // 合并而不是替换
      for (const entry of entries) {
        if (!this.worldBookEntries.find(e => e.id === entry.id)) {
          this.worldBookEntries.push(entry);
        }
      }

      this.saveToStorage();
      return entries.length;
    } catch (error) {
      console.error('[PromptPreviewService] 导入世界书失败:', error);
      throw new Error('导入失败：格式错误');
    }
  }

  private convertToWorldBookEntry(raw: any): WorldBookEntry {
    // 处理 triggerMode
    let triggerMode: 'always' | 'keyword' = 'always';
    if (raw.triggerMode === 'green' || raw.triggerMode === 'keyword' || raw.selective) {
      triggerMode = 'keyword';
    }

    // 处理 role
    let role: 'system' | 'user' | 'assistant' = 'system';
    if (raw.role === 'user') role = 'user';
    else if (raw.role === 'assistant') role = 'assistant';

    // 处理 targets（默认只作用于正文）
    let targets: WorldBookTarget[] = ['text'];
    if (Array.isArray(raw.targets)) {
      targets = raw.targets.filter((t: any) => ['text', 'variable', 'optimization'].includes(t));
    }

    return {
      id: raw.id || raw.uid || `wb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: raw.name || raw.comment || '未命名条目',
      content: raw.content || '',
      role,
      enabled: raw.enabled !== false && raw.disable !== true,
      depth: typeof raw.depth === 'number' ? raw.depth : 4,
      triggerMode,
      keywords: Array.isArray(raw.keywords) ? raw.keywords :
                Array.isArray(raw.key) ? raw.key :
                typeof raw.keysecondary === 'string' ? raw.keysecondary.split(',').map((k: string) => k.trim()) : [],
      order: typeof raw.order === 'number' ? raw.order : 0,
      targets,
    };
  }

  // ==================== 酒馆预设预览 ====================

  private async generateTavernPresetPreview(options?: PreviewOptions): Promise<PreviewResult> {
    const messages: PreviewMessage[] = [];

    // 获取当前激活的酒馆预设
    const activePreset = await tavernPresetService.getActivePreset();
    if (!activePreset) {
      messages.push(this.createMessage(
        'system',
        '⚠️ 没有激活的酒馆预设。请在"酒馆预设"标签页中导入并激活一个预设。',
        '提示',
        0,
        'tavern_no_preset'
      ));
      return this.calculateResult(messages);
    }

    const userInput = options?.userInput || '继续当前活动';
    // 使用传入的记忆条数或默认配置
    const memoryCount = options?.shortTermMemoryCount ?? this.memoryConfig.tavernPresetCount;

    // 检查是否启用了ChatSquash
    const sPresetConfig = activePreset.sPresetConfig;
    const chatSquashConfig = sPresetConfig?.ChatSquash;

    if (chatSquashConfig?.enabled) {
      // 使用ChatSquash模式生成连续文本流
      return this.generateChatSquashPreview(activePreset, userInput, { ...options, shortTermMemoryCount: memoryCount });
    }

    // 非ChatSquash模式：使用传统消息块格式
    return this.generateTraditionalTavernPreview(activePreset, userInput, { ...options, shortTermMemoryCount: memoryCount });
  }

  /**
   * 使用ChatSquash模式生成预览 - 输出连续文本流
   */
  private async generateChatSquashPreview(
    activePreset: any,
    userInput: string,
    options?: PreviewOptions
  ): Promise<PreviewResult> {
    const messages: PreviewMessage[] = [];
    const preMergeMessages: PreviewMessage[] = [];
    const gameStateStore = useGameStateStore();

    // 创建宏处理器
    const macroProcessor = new TavernMacroProcessor();

    // 获取游戏状态
    const saveData = gameStateStore.toSaveData();
    const characterInfo = saveData?.角色基础信息;

    // 获取组合记忆（短期+中期+长期）- 酒馆预设使用完整记忆
    const memoryCount = options?.shortTermMemoryCount ?? this.memoryConfig.tavernPresetCount;
    const combinedMemories = this.getCombinedMemories(memoryCount);
    const allMemories = combinedMemories.combined; // 使用合并后的全部记忆

    // 预先准备各个占位符的内容
    const markerContents = await this.prepareMarkerContents(saveData, characterInfo, userInput, allMemories);

    // 创建宏上下文
    const chatHistoryFormatted = allMemories.map((content, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content,
    }));

    const userName = characterInfo?.名字 || '修士';
    const macroContext: MacroContext = {
      user: userName,
      char: activePreset.name,
      lastUserMessage: userInput,
      lastCharMessage: allMemories[allMemories.length - 1] || '',
      chatHistory: chatHistoryFormatted,
      variables: {},
      ...markerContents,
    };

    // 获取ChatSquash配置
    const chatSquashConfig = activePreset.sPresetConfig?.ChatSquash;
    const separatorString = chatSquashConfig?.squashed_separator_string || '<|sep|>';

    // 收集所有内容片段
    const contentParts: string[] = [];

    // 获取排序后的prompts
    const orderedPrompts = activePreset.orderedPrompts || [];
    const enabledPrompts = orderedPrompts.filter((p: { enabled?: boolean }) => p.enabled);

    // 处理每个启用的提示词条目
    let depthCounter = 100;
    for (const prompt of enabledPrompts) {
      // 处理marker类型（占位符）- 填充实际内容
      if (prompt.marker) {
        const markerContent = this.getMarkerContentForChatSquash(
          prompt.identifier,
          markerContents,
          userInput,
          allMemories
        );
        if (markerContent) {
          contentParts.push(markerContent);
          // 保存合并前的消息用于分离视图
          const markerName = this.getMarkerDisplayName(prompt.identifier);
          // 对于chatHistory，在标题中显示记忆分类统计
          let sourceLabel = `📍 ${markerName}`;
          if (prompt.identifier === 'chatHistory' && allMemories.length > 0) {
            const { shortTerm, midTerm, longTerm } = combinedMemories;
            sourceLabel += ` (${shortTerm.length}短期+${midTerm.length}中期+${longTerm.length}长期)`;
          }
          preMergeMessages.push(this.createMessage(
            'system',
            markerContent,
            sourceLabel,
            depthCounter--,
            `tavern_marker_${prompt.identifier}`  // 🔥 酒馆预设占位符标识符
          ));
        }
        continue;
      }

      // 处理内容中的宏变量
      let processedContent = prompt.content || '';
      if (processedContent) {
        processedContent = macroProcessor.process(processedContent, macroContext);
      }

      // 跳过空内容
      if (!processedContent.trim()) continue;

      contentParts.push(processedContent);

      // 保存合并前的消息用于分离视图
      const role = this.mapTavernRole(prompt.role);
      const sourceName = prompt.name || prompt.identifier || '未命名';
      const sourceIcon = prompt.system_prompt ? '⚙️' :
                        prompt.injection_position === 1 ? '💉' : '📝';
      preMergeMessages.push(this.createMessage(
        role,
        processedContent,
        `${sourceIcon} ${sourceName}`,
        depthCounter--,
        `tavern_prompt_${prompt.identifier || depthCounter}`  // 🔥 酒馆预设消息标识符
      ));
    }

    // 使用分隔符连接所有内容
    let squashedContent = contentParts.join(separatorString);

    // 应用ChatSquash后处理脚本
    if (chatSquashConfig?.squashed_post_script_enable && chatSquashConfig?.squashed_post_script) {
      try {
        squashedContent = this.executeChatSquashPostScript(
          squashedContent,
          chatSquashConfig.squashed_post_script,
          userName
        );
      } catch (error) {
        console.error('[PromptPreviewService] ChatSquash后处理脚本执行失败:', error);
      }
    }

    // 应用正则脚本（仅限promptOnly=true的脚本在prompt阶段执行）
    const regexScripts = activePreset.regexScripts || [];
    if (regexScripts.length > 0) {
      try {
        squashedContent = this.applyRegexScriptsToContent(
          squashedContent,
          regexScripts,
          { isPromptPhase: true }
        );
      } catch (error) {
        console.error('[PromptPreviewService] 正则脚本执行失败:', error);
      }
    }

    // 创建单个消息包含完整内容
    messages.push(this.createMessage(
      'assistant',
      squashedContent,
      `ChatSquash输出 (${activePreset.name})`,
      0,
      'tavern_squashed_output'  // 🔥 ChatSquash输出标识符
    ));

    // 返回结果，包含合并前的消息
    const result = this.calculateResult(messages);
    result.preMergeMessages = preMergeMessages;
    result.isChatSquashed = true;
    return result;
  }

  /**
   * 执行ChatSquash后处理脚本
   * 这个脚本负责将 |用户|/|小猫之神| 标记转换为 <role>xxx 格式
   */
  private executeChatSquashPostScript(content: string, script: string, userName: string): string {
    let result: string;

    try {
      // 尝试使用 Function 构造器执行脚本
      // 脚本格式: content => { ... return result; }
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function('content', `
        const scriptFn = ${script};
        return scriptFn(content);
      `);

      const scriptResult = fn(content);
      if (typeof scriptResult === 'string') {
        result = scriptResult;
      } else {
        // 脚本返回非字符串，使用内置转换
        result = this.builtInChatSquashTransform(content, userName);
      }
    } catch (error) {
      console.warn('[PromptPreviewService] 脚本执行失败，使用内置转换:', error);
      // 脚本执行失败时，使用内置的转换逻辑（模拟小猫之神预设的后处理）
      result = this.builtInChatSquashTransform(content, userName);
    }

    // 无论脚本是否成功执行，都要确保移除 <|sep|> 分隔符
    // 因为原始脚本可能没有处理这个
    result = result.replace(/<\|sep\|>/g, '\n');

    // 清理多余的空行
    result = result.replace(/\n{3,}/g, '\n\n');

    return result;
  }

  /**
   * 内置的ChatSquash转换逻辑
   * 模拟小猫之神预设的后处理脚本
   */
  private builtInChatSquashTransform(content: string, defaultUserName: string): string {
    let result = content;

    // 1. 提取用户名 |用户：xxx|
    const usernameRegex = /\|用户：(.*?)\|/;
    const usernameMatches = result.match(usernameRegex);
    let username = defaultUserName;
    if (usernameMatches && usernameMatches.length > 1) {
      username = usernameMatches[1];
    }
    // 移除用户名标记
    result = result.replace(usernameRegex, '');

    // 2. 处理 <小猫之神世界书处理>...</小猫之神世界书处理> 标签
    const worldBookRegex = /<小猫之神世界书处理>([\s\S]*?)<\/小猫之神世界书处理>/g;

    // 提取所有世界书内容
    const worldBookMatches: string[] = [];
    let match;
    while ((match = worldBookRegex.exec(result)) !== null) {
      worldBookMatches.push(match[1]);
    }

    // 去掉世界书标签和内容
    const withoutWorldBooks = result.replace(worldBookRegex, '');

    // 分离最后几组和之前的
    const lastMatches = worldBookMatches.slice(-3);
    const previousMatches = worldBookMatches.slice(0, -3);

    const lastContent = lastMatches.join('\n').trim();
    const previousContent = previousMatches.join('\n').trim();

    // 替换占位符
    result = withoutWorldBooks
      .replace(/<\|前置世界书\|>/g, previousContent ? '\n\n|额外设定| \n' + previousContent : '')
      .replace(/\|小猫之神_世界书\|/g, lastContent ? '\n\n|额外信息&要求| \n' + lastContent : '')
      .trim();

    // 3. 处理 |delete|...|/delete| 标记
    result = result.replace(/\|delete\|[\s\S]*?\|\/delete\|/g, '');

    // 4. 转换角色标记 |小猫之神| 和 |用户|
    let prev: 'cat' | 'user' | null = null;
    const roleRegex = /[\n]*\|(小猫之神|用户)\|/g;

    result = result.replace(roleRegex, (_, who) => {
      const isCat = who === '小猫之神';
      let replacement: string;

      if (isCat) {
        replacement = '\n<role>soliumbra\n';
        prev = 'cat';
      } else {
        const prefix = prev === 'cat' ? '<end>' : '';
        replacement = `${prefix}\n<role>${username}\n`;
        prev = 'user';
      }

      return replacement;
    });

    // 5. 处理 summary 标签
    const summaryPositions: number[] = [];
    const summaryRegex = /<summary>/g;
    let summaryMatch;

    while ((summaryMatch = summaryRegex.exec(result)) !== null) {
      const index = summaryMatch.index;
      // 检查前面是否紧跟着 details>（排除 <details><summary> 的情况）
      const before = result.substring(Math.max(0, index - 10), index);
      if (!/details>\s*$/.test(before)) {
        summaryPositions.push(index);
      }
    }

    // 排除最后几个，只处理前面的
    const positionsToProcess = summaryPositions.slice(0, -3);

    // 从后往前处理，避免索引偏移问题
    for (let i = positionsToProcess.length - 1; i >= 0; i--) {
      const pos = positionsToProcess[i];
      const insertPos = pos + '<summary>'.length;
      const insertText = `\n---第${i + 1}段剧情总结---`;
      result = result.substring(0, insertPos) + insertText + result.substring(insertPos);
    }

    // 6. 移除 <|sep|> 分隔符（在最后的输出中不需要）
    result = result.replace(/<\|sep\|>/g, '\n');

    // 7. 清理多余的空行
    result = result.replace(/\n{3,}/g, '\n\n');

    return result;
  }

  /**
   * 获取marker的显示名称
   */
  private getMarkerDisplayName(identifier: string): string {
    const markerNames: Record<string, string> = {
      'worldInfoBefore': '前置世界书',
      'personaDescription': '用户角色描述',
      'charDescription': '角色描述',
      'charPersonality': '角色性格',
      'scenario': '场景设定',
      'worldInfoAfter': '后置世界书',
      'dialogueExamples': '对话示例',
      'chatHistory': '聊天历史',
    };
    return markerNames[identifier] || identifier;
  }

  /**
   * 传统消息块格式预览
   */
  private async generateTraditionalTavernPreview(
    activePreset: any,
    userInput: string,
    options?: PreviewOptions
  ): Promise<PreviewResult> {
    const messages: PreviewMessage[] = [];
    const gameStateStore = useGameStateStore();

    // 创建宏处理器
    const macroProcessor = new TavernMacroProcessor();

    // 获取游戏状态
    const saveData = gameStateStore.toSaveData();
    const characterInfo = saveData?.角色基础信息;

    // 获取组合记忆（短期+中期+长期）- 酒馆预设使用完整记忆
    const memoryCount = options?.shortTermMemoryCount ?? this.memoryConfig.tavernPresetCount;
    const combinedMemories = this.getCombinedMemories(memoryCount);
    const shortTermMemories = combinedMemories.combined; // 使用合并后的全部记忆

    // 预先准备各个占位符的内容
    const markerContents = await this.prepareMarkerContents(saveData, characterInfo, userInput, shortTermMemories);

    // 创建宏上下文
    const chatHistoryFormatted = shortTermMemories.map((content, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content,
    }));

    const macroContext: MacroContext = {
      user: characterInfo?.名字 || '修士',
      char: activePreset.name,
      lastUserMessage: userInput,
      lastCharMessage: shortTermMemories[shortTermMemories.length - 1] || '',
      chatHistory: chatHistoryFormatted,
      variables: {},
      ...markerContents,
    };

    // 获取排序后的prompts
    const orderedPrompts = activePreset.orderedPrompts || [];
    const enabledPrompts = orderedPrompts.filter((p: { enabled?: boolean }) => p.enabled);

    // 1. 添加预设信息头
    const modelParams = activePreset.modelParams;
    messages.push(this.createMessage(
      'system',
      `📋 预设: ${activePreset.name}\n` +
      `📊 启用提示词: ${enabledPrompts.length}/${orderedPrompts.length}\n` +
      `🔧 温度: ${modelParams?.temperature || 'N/A'} | Top-P: ${modelParams?.top_p || 'N/A'}`,
      '预设信息',
      999,
      'tavern_preset_info'  // 🔥 预设信息标识符
    ));

    // 2. 处理每个启用的提示词条目
    let depthCounter = 100;
    for (const prompt of enabledPrompts) {
      // 处理marker类型（占位符）- 填充实际内容
      if (prompt.marker) {
        const markerContent = this.getMarkerContent(prompt.identifier, markerContents, userInput, shortTermMemories);
        if (markerContent) {
          const markerName = this.getMarkerDisplayName(prompt.identifier);
          messages.push(this.createMessage(
            'system',
            markerContent,
            `📍 ${markerName}`,
            depthCounter--,
            `tavern_marker_${prompt.identifier}`  // 🔥 酒馆预设占位符标识符
          ));
        }
        continue;
      }

      // 处理内容中的宏变量
      let processedContent = prompt.content || '';
      if (processedContent) {
        processedContent = macroProcessor.process(processedContent, macroContext);
      }

      if (!processedContent.trim()) continue;

      // 确定角色
      const role = this.mapTavernRole(prompt.role);

      // 获取来源名称
      const sourceName = prompt.name || prompt.identifier || '未命名';
      const sourceIcon = prompt.system_prompt ? '⚙️' :
                        prompt.injection_position === 1 ? '💉' : '📝';

      messages.push(this.createMessage(
        role,
        processedContent,
        `${sourceIcon} ${sourceName}`,
        depthCounter--,
        `tavern_prompt_${prompt.identifier || depthCounter}`  // 🔥 酒馆预设消息标识符
      ));
    }

    // 3. 添加用户输入示例
    messages.push(this.createMessage(
      'user',
      userInput,
      '用户输入',
      0,
      'user_input'
    ));

    // 4. 如果有正则脚本，添加正则信息
    const regexScripts = activePreset.regexScripts || [];
    const enabledRegex = regexScripts.filter((r: { disabled?: boolean }) => !r.disabled);
    if (enabledRegex.length > 0) {
      const regexInfo = enabledRegex.map((r: { scriptName?: string; findRegex?: string }) =>
        `• ${r.scriptName || '未命名'}: ${(r.findRegex || '').substring(0, 50)}...`
      ).join('\n');

      messages.push(this.createMessage(
        'system',
        `🔄 启用的正则脚本 (${enabledRegex.length}):\n${regexInfo}`,
        '正则脚本',
        -1,
        'tavern_regex_info'  // 🔥 正则脚本信息标识符
      ));
    }

    return this.calculateResult(messages);
  }

  /**
   * 获取marker内容（ChatSquash模式）- 跳过空内容
   */
  private getMarkerContentForChatSquash(
    identifier: string,
    markerContents: Record<string, string>,
    userInput: string,
    shortTermMemories: string[]
  ): string {
    switch (identifier) {
      case 'worldInfoBefore':
        return markerContents.worldInfoBefore || '';
      case 'worldInfoAfter':
        return markerContents.worldInfoAfter || '';
      case 'personaDescription':
        return markerContents.personaDescription || '';
      case 'charDescription':
        return markerContents.charDescription || '';
      case 'charPersonality':
        return markerContents.charPersonality || '';
      case 'scenario':
        return markerContents.scenario || '';
      case 'dialogueExamples':
        return markerContents.dialogueExamples || '';
      case 'chatHistory':
        // 返回组合记忆作为聊天历史
        if (shortTermMemories.length === 0) {
          return '';
        }
        // 直接返回完整记忆内容，格式与正文生成保持一致
        return shortTermMemories.join('\n\n');
      default:
        return '';
    }
  }

  /**
   * 准备各个marker占位符的内容
   */
  private async prepareMarkerContents(
    saveData: any,
    characterInfo: any,
    userInput: string,
    shortTermMemories: string[]
  ): Promise<Record<string, string>> {
    // 准备世界书内容
    const matchContext = `${userInput}\n${shortTermMemories.slice(-3).join('\n')}`;
    const worldBooksBefore = this.getWorldBookEntriesForTarget('text', matchContext);
    const worldBooksAfter = this.getWorldBookEntriesForTarget('variable', matchContext);

    const worldInfoBefore = worldBooksBefore.map(e => e.content).join('\n\n');
    const worldInfoAfter = worldBooksAfter.map(e => e.content).join('\n\n');

    // 准备角色描述 - 从游戏状态提取
    const charDescription = this.buildCharacterDescription(saveData);
    const charPersonality = this.buildCharacterPersonality(characterInfo);
    const personaDescription = this.buildPersonaDescription(characterInfo);
    const scenario = this.buildScenario(saveData);

    return {
      worldInfoBefore,
      worldInfoAfter,
      personaDescription,
      charDescription,
      charPersonality,
      scenario,
      dialogueExamples: '',
    };
  }

  /**
   * 根据marker标识符获取对应内容
   */
  private getMarkerContent(
    identifier: string,
    markerContents: Record<string, string>,
    userInput: string,
    shortTermMemories: string[]
  ): string {
    switch (identifier) {
      case 'worldInfoBefore':
        return markerContents.worldInfoBefore || '（无匹配的世界书条目）';
      case 'worldInfoAfter':
        return markerContents.worldInfoAfter || '（无匹配的世界书条目）';
      case 'personaDescription':
        return markerContents.personaDescription || '（无用户人设）';
      case 'charDescription':
        return markerContents.charDescription || '（无角色描述）';
      case 'charPersonality':
        return markerContents.charPersonality || '（无角色性格）';
      case 'scenario':
        return markerContents.scenario || '（无场景设定）';
      case 'dialogueExamples':
        return markerContents.dialogueExamples || '（无对话示例）';
      case 'chatHistory':
        // 返回短期记忆作为聊天历史
        if (shortTermMemories.length === 0) {
          return '（无聊天历史）';
        }
        return shortTermMemories.slice(-5).map((m, i) =>
          `[${i + 1}] ${m.substring(0, 200)}${m.length > 200 ? '...' : ''}`
        ).join('\n\n');
      default:
        return '';
    }
  }

  /**
   * 构建角色描述（从游戏状态）
   */
  private buildCharacterDescription(saveData: any): string {
    if (!saveData) return '';

    const parts: string[] = [];

    // 角色基础信息
    const info = saveData.角色基础信息;
    if (info) {
      parts.push(`# 角色基础信息`);
      if (info.名字) parts.push(`名字: ${info.名字}`);
      if (info.性别) parts.push(`性别: ${info.性别}`);
      if (info.年龄) parts.push(`年龄: ${info.年龄}`);
      if (info.出身) parts.push(`出身: ${this.stringifyValue(info.出身)}`);
      if (info.灵根) parts.push(`灵根: ${this.stringifyValue(info.灵根)}`);
      if (info.天赋) parts.push(`天赋: ${this.stringifyValue(info.天赋)}`);
    }

    // 玩家角色状态
    const status = saveData.玩家角色状态;
    if (status) {
      parts.push(`\n# 当前状态`);
      if (status.境界) {
        const realm = status.境界;
        if (typeof realm === 'object') {
          parts.push(`境界: ${realm.名称 || ''}${realm.阶段 ? '-' + realm.阶段 : ''}`);
        } else {
          parts.push(`境界: ${this.stringifyValue(realm)}`);
        }
      }
      if (status.气血) {
        const hp = status.气血;
        if (typeof hp === 'object') {
          parts.push(`气血: ${hp.当前 || 0}/${hp.上限 || 0}`);
        } else {
          parts.push(`气血: ${this.stringifyValue(hp)}`);
        }
      }
      if (status.法力) {
        const mp = status.法力;
        if (typeof mp === 'object') {
          parts.push(`法力: ${mp.当前 || 0}/${mp.上限 || 0}`);
        } else {
          parts.push(`法力: ${this.stringifyValue(mp)}`);
        }
      }
    }

    return parts.join('\n');
  }

  /**
   * 将任意值转换为可读字符串
   */
  private stringifyValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(v => this.stringifyValue(v)).filter(Boolean).join('、');
    }
    if (typeof value === 'object') {
      // 对于对象，尝试提取常见属性
      if (value.名称) return value.名称;
      if (value.name) return value.name;
      if (value.名字) return value.名字;
      // 否则返回JSON字符串（但去除引号）
      try {
        const str = JSON.stringify(value);
        return str.replace(/"/g, '');
      } catch {
        return '[对象]';
      }
    }
    return String(value);
  }

  /**
   * 构建角色性格
   */
  private buildCharacterPersonality(characterInfo: any): string {
    if (!characterInfo) return '';

    const parts: string[] = [];
    if (characterInfo.性格) parts.push(`性格: ${characterInfo.性格}`);
    if (characterInfo.背景故事) parts.push(`背景: ${characterInfo.背景故事}`);

    return parts.join('\n');
  }

  /**
   * 构建用户人设描述
   * 优先使用用户在设置中配置的 personaDescription，否则使用默认内容
   */
  private buildPersonaDescription(characterInfo: any): string {
    // 🔥 优先从 localStorage 读取用户设置的 personaDescription
    try {
      const savedSettings = localStorage.getItem('dad_game_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.personaDescription && settings.personaDescription.trim()) {
          return settings.personaDescription.trim();
        }
      }
    } catch (error) {
      console.warn('[PromptPreviewService] 读取 personaDescription 设置失败:', error);
    }

    // 如果没有用户设置，返回默认内容
    if (!characterInfo) return '';
    return `你正在扮演一位名为"${characterInfo.名字 || '修士'}"的修仙者。`;
  }

  /**
   * 构建场景设定
   * 返回完整的游戏状态 JSON（与 Step2 变量生成一致）
   */
  private buildScenario(saveData: any): string {
    if (!saveData) return '';

    // 复制游戏状态，移除记忆和叙事历史（避免重复）
    const stateForScenario = cloneDeep(saveData);
    if (stateForScenario?.记忆) {
      delete stateForScenario.记忆.短期记忆;
      delete stateForScenario.记忆.隐式中期记忆;
    }
    if (stateForScenario?.叙事历史) {
      delete stateForScenario.叙事历史;
    }
    // 移除优化正文历史（独立管理，不发送给 AI）
    if (stateForScenario?.优化正文历史) {
      delete stateForScenario.优化正文历史;
    }

    // 返回紧凑型 JSON（与 Step2 变量生成一致）
    try {
      return JSON.stringify(stateForScenario);
    } catch (error) {
      console.error('[PromptPreviewService] buildScenario JSON序列化失败:', error);
      return '';
    }
  }

  private mapTavernRole(role?: string): 'system' | 'user' | 'assistant' {
    switch (role) {
      case 'user': return 'user';
      case 'assistant': return 'assistant';
      default: return 'system';
    }
  }

  /**
   * 应用正则脚本到内容
   * @param content 输入内容
   * @param scripts 正则脚本列表
   * @param options 执行选项
   * @returns 处理后的内容
   */
  private applyRegexScriptsToContent(
    content: string,
    scripts: TavernRegexScript[],
    options: {
      isPromptPhase?: boolean;
      isMarkdownRender?: boolean;
      chatDepth?: number;
    } = {}
  ): string {
    const regexEngine = new TavernRegexEngine();

    // 筛选适用于当前场景的脚本
    const applicableScripts = scripts.filter(script => {
      // 跳过禁用的脚本
      if (script.disabled) return false;

      // 在prompt阶段，只应用promptOnly=true的脚本
      if (options.isPromptPhase && !script.promptOnly) return false;

      // 在markdown渲染阶段，只应用markdownOnly=true的脚本
      if (options.isMarkdownRender && !script.markdownOnly) return false;

      // 检查placement是否包含AI_OUTPUT
      if (!script.placement.includes(REGEX_PLACEMENT.AI_OUTPUT)) return false;

      // 检查深度限制
      if (options.chatDepth !== undefined) {
        if (script.minDepth !== null && options.chatDepth < script.minDepth) return false;
        if (script.maxDepth !== null && options.chatDepth > script.maxDepth) return false;
      }

      return true;
    });

    if (applicableScripts.length === 0) {
      return content;
    }

    // 应用正则脚本
    const result = regexEngine.applyToOutput(content, applicableScripts, {
      isPromptPhase: options.isPromptPhase,
      isMarkdownRender: options.isMarkdownRender,
      chatDepth: options.chatDepth,
    });

    if (result.errors.length > 0) {
      console.warn('[PromptPreviewService] 正则脚本执行错误:', result.errors);
    }

    if (result.appliedScripts.length > 0) {
      console.log('[PromptPreviewService] 应用的正则脚本:', result.appliedScripts);
    }

    return result.output;
  }

  public importTavernWorldBook(data: string): number {
    try {
      const parsed = JSON.parse(data);
      let entries: WorldBookEntry[] = [];

      // 酒馆世界书格式: { entries: { "0": {...}, "1": {...} } }
      if (parsed.entries && typeof parsed.entries === 'object' && !Array.isArray(parsed.entries)) {
        const entriesObj = parsed.entries;
        entries = Object.values(entriesObj).map((entry: any) => this.convertToWorldBookEntry(entry));
      }
      // 其他格式
      else {
        return this.importWorldBook(data);
      }

      // 合并
      for (const entry of entries) {
        if (!this.worldBookEntries.find(e => e.id === entry.id)) {
          this.worldBookEntries.push(entry);
        }
      }

      this.saveToStorage();
      return entries.length;
    } catch (error) {
      console.error('[PromptPreviewService] 导入酒馆世界书失败:', error);
      throw new Error('导入失败：格式错误');
    }
  }
}

// 导出单例
export const promptPreviewService = new PromptPreviewService();
