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
import { stripNsfwContent } from '@/utils/prompts/definitions/dataDefinitions';

// ==================== 类型定义 ====================

export interface PreviewMessage {
  id: string;
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
}

export type PreviewScenario =
  | 'text_generation'       // 正文生成
  | 'variable_generation'   // 变量生成
  | 'variable_reroll'       // 重新生成变量
  | 'text_optimization'     // 正文优化
  | 'text_optimization_reroll'; // 重新优化正文

// 世界书条目作用场景
export type WorldBookTarget = 'text' | 'variable' | 'optimization';

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
  promptTemplate: string;
}

export interface PreviewOptions {
  shortTermMemoryCount?: number;  // 使用的短期记忆条数
  userInput?: string;             // 模拟的用户输入
  step1Text?: string;             // 第一步正文（用于变量生成预览）
  step1Thinking?: string;         // 第一步思维链
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
  promptTemplate: DEFAULT_MEMORY_TEMPLATE,
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

    return JSON.stringify(stateForAI, null, 2);
  }

  private formatMemoryPrompt(memories: string[], count: number): string {
    const selectedMemories = memories.slice(-count);
    const memoriesText = selectedMemories.join('\n');

    return this.memoryConfig.promptTemplate
      .replace('{{memories}}', memoriesText)
      .replace('{{count}}', String(selectedMemories.length));
  }

  private createMessage(
    role: 'system' | 'user' | 'assistant',
    content: string,
    source: string,
    depth: number
  ): PreviewMessage {
    const truncateLength = 500;
    const truncated = content.length > truncateLength;

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

    messages.push(this.createMessage('system', systemPrompt, '系统提示词（包含游戏状态）', 4));

    // 4. 获取短期记忆（需要先获取，用于世界书关键词匹配）
    const shortTermMemories = this.getShortTermMemories();

    // 5. 世界书条目（作用于正文）- 需要提供匹配上下文
    const matchContext = `${userInput}\n${shortTermMemories.slice(-memoryCount).join('\n')}`;
    const textWorldBooks = this.getWorldBookEntriesForTarget('text', matchContext);
    for (const entry of textWorldBooks) {
      const triggerInfo = entry.triggerMode === 'keyword' ? ' 🟢' : ' 🔵';
      messages.push(this.createMessage(
        entry.role,
        entry.content,
        `世界书: ${entry.name}${triggerInfo}`,
        entry.depth
      ));
    }

    // 6. 短期记忆提示词
    if (memoryCount > 0 && shortTermMemories.length > 0) {
      const memoryPrompt = this.formatMemoryPrompt(shortTermMemories, memoryCount);
      messages.push(this.createMessage('assistant', memoryPrompt, `短期记忆（${Math.min(memoryCount, shortTermMemories.length)}条）`, 2));
    }

    // 7. CoT提示词（如果启用）
    if (uiStore.useSystemCot) {
      const cotPrompt = await getPrompt('cotCore');
      messages.push(this.createMessage(
        'system',
        cotPrompt.replace('{{用户输入}}', userInput),
        'CoT思维链提示词',
        1
      ));
    }

    // 8. 用户输入
    messages.push(this.createMessage('user', userInput, '用户输入', 0));

    // 9. 占位符
    messages.push(this.createMessage('assistant', '</input>', '输入结束占位符', 0));

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

    // 根据环境处理 NSFW 内容
    const sanitizedDataDefinitionsPrompt = stripNsfwContent(dataDefinitionsPrompt);

    const sections: string[] = [
      stepRulesPrompt.trim(),
      coreOutputRulesPrompt,
      businessRulesPrompt,
      sanitizedDataDefinitionsPrompt,
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

    messages.push(this.createMessage('system', step2SystemPrompt, 'Step2系统提示词', 4));

    // 2. 获取短期记忆（需要先获取，用于世界书关键词匹配）
    const shortTermMemories = this.getShortTermMemories();

    // 3. 世界书条目（作用于变量）- 需要提供匹配上下文
    const matchContext = `${userInput}\n${step1Text}\n${shortTermMemories.slice(-memoryCount).join('\n')}`;
    const variableWorldBooks = this.getWorldBookEntriesForTarget('variable', matchContext);
    for (const entry of variableWorldBooks) {
      const triggerInfo = entry.triggerMode === 'keyword' ? ' 🟢' : ' 🔵';
      messages.push(this.createMessage(
        entry.role,
        entry.content,
        `世界书: ${entry.name}${triggerInfo}`,
        entry.depth
      ));
    }

    // 4. 短期记忆提示词
    if (memoryCount > 0 && shortTermMemories.length > 0) {
      const memoryPrompt = this.formatMemoryPrompt(shortTermMemories, memoryCount);
      messages.push(this.createMessage('assistant', memoryPrompt, `短期记忆（${Math.min(memoryCount, shortTermMemories.length)}条）`, 2));
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

    messages.push(this.createMessage('user', step2UserInput, '用户输入（含Step1结果）', 0));

    // 6. 占位符
    messages.push(this.createMessage('assistant', '</input>', '输入结束占位符', 0));

    // 按depth排序（降序）
    messages.sort((a, b) => b.depth - a.depth);

    return this.calculateResult(messages);
  }

  private async generateVariableRerollPreview(options?: PreviewOptions): Promise<PreviewResult> {
    return this.generateVariableRerollPreviewInternal(options);
  }

  // ==================== 正文优化预览 ====================

  private async generateTextOptimizationPreview(options?: PreviewOptions): Promise<PreviewResult> {
    const messages: PreviewMessage[] = [];

    const memoryCount = options?.shortTermMemoryCount ?? this.memoryConfig.textOptimizationCount;
    const sourceText = options?.step1Text || '（待优化的正文内容将在此显示）';

    // 1. 获取正文优化条目（需要检查关键词触发）
    const allEntries = textOptimizationService.getEnabledEntries();
    const enabledEntries = allEntries.filter(entry => {
      // 如果是关键词触发模式，检查是否匹配
      if (entry.triggerMode === 'keyword') {
        return this.matchKeywords(entry.keywords || [], sourceText);
      }
      return true; // 始终触发模式
    });

    for (const entry of enabledEntries) {
      const triggerInfo = entry.triggerMode === 'keyword' ? ' 🟢' : ' 🔵';
      messages.push(this.createMessage(
        entry.role,
        entry.content,
        `优化条目: ${entry.name}${triggerInfo}`,
        entry.depth
      ));
    }

    // 2. 世界书条目（作用于优化）- 需要提供匹配上下文
    const optimizationWorldBooks = this.getWorldBookEntriesForTarget('optimization', sourceText);
    for (const entry of optimizationWorldBooks) {
      messages.push(this.createMessage(
        entry.role,
        entry.content,
        `世界书: ${entry.name}`,
        entry.depth
      ));
    }

    // 3. 短期记忆（如果配置了）
    if (memoryCount > 0) {
      const shortTermMemories = this.getShortTermMemories();
      if (shortTermMemories.length > 0) {
        const memoryPrompt = this.formatMemoryPrompt(shortTermMemories, memoryCount);
        messages.push(this.createMessage('assistant', memoryPrompt, `短期记忆（${Math.min(memoryCount, shortTermMemories.length)}条）`, 2));
      }
    }

    // 4. 原始正文
    messages.push(this.createMessage('user', sourceText, '待优化正文', 0));

    // 按depth排序（降序）
    messages.sort((a, b) => b.depth - a.depth);

    return this.calculateResult(messages);
  }

  // ==================== 正文再优化预览 ====================

  private async generateTextOptimizationRerollPreview(options?: PreviewOptions): Promise<PreviewResult> {
    const uiStore = useUIStore();

    // 使用当前显示的正文
    const currentText = uiStore.lastStep1Text || uiStore.splitStep1Text || '';

    // 使用再优化的独立记忆配置
    const memoryCount = options?.shortTermMemoryCount ?? this.memoryConfig.textOptimizationRerollCount;

    return this.generateTextOptimizationPreview({
      ...options,
      shortTermMemoryCount: memoryCount,
      step1Text: options?.step1Text || currentText || '（请先生成一次正文）',
    });
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
