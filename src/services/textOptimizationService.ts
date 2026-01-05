/**
 * 正文优化提示词管理服务
 * 管理正文优化预设的加载、保存、导入、导出
 */

import type {
  TextOptimizationEntry,
  TextOptimizationPreset,
  TavernWorldBookFormat,
} from '@/types/textOptimization';
import {
  convertTavernWorldBook,
  exportToTavernWorldBook,
  generateEntryId,
  createDefaultEntry,
} from '@/types/textOptimization';

const STORAGE_KEY = 'text_optimization_preset';
const ENABLED_KEY = 'text_optimization_enabled';
const HISTORY_KEY = 'text_optimization_history';
const MAX_HISTORY_SIZE = 10;

class TextOptimizationService {
  private currentPreset: TextOptimizationPreset | null = null;
  private enabled: boolean = false;
  private optimizedTextHistory: string[] = [];
  private currentSaveId: string | null = null; // 当前存档ID

  constructor() {
    this.load();
  }

  /**
   * 从localStorage加载预设
   */
  load(): void {
    try {
      // 加载启用状态
      const enabledStr = localStorage.getItem(ENABLED_KEY);
      this.enabled = enabledStr === 'true';

      // 加载预设
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.currentPreset = parsed;
        console.log('[正文优化服务] 已加载预设:', this.currentPreset?.name, '条目数:', this.currentPreset?.entries?.length);
      } else {
        // 创建默认预设
        this.currentPreset = {
          id: 'default',
          name: '默认预设',
          entries: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
        };
      }

      // 加载优化历史
      this.loadHistory();
    } catch (e) {
      console.error('[正文优化服务] 加载预设失败:', e);
      this.currentPreset = {
        id: 'default',
        name: '默认预设',
        entries: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
      };
    }
  }

  /**
   * 保存预设到localStorage
   */
  save(): void {
    try {
      if (this.currentPreset) {
        this.currentPreset.updatedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentPreset));
      }
      localStorage.setItem(ENABLED_KEY, String(this.enabled));
      console.log('[正文优化服务] 预设已保存');
    } catch (e) {
      console.error('[正文优化服务] 保存预设失败:', e);
    }
  }

  /**
   * 获取当前预设
   */
  getPreset(): TextOptimizationPreset | null {
    return this.currentPreset;
  }

  /**
   * 获取所有条目
   */
  getEntries(): TextOptimizationEntry[] {
    return this.currentPreset?.entries || [];
  }

  /**
   * 获取启用的条目（按depth排序）
   */
  getEnabledEntries(): TextOptimizationEntry[] {
    const entries = this.getEntries().filter(e => e.enabled);
    // 按depth降序排序（depth越大越靠前）
    entries.sort((a, b) => (b.depth || 0) - (a.depth || 0));
    return entries;
  }

  /**
   * 获取启用的条目数量
   */
  getEnabledCount(): number {
    return this.getEntries().filter(e => e.enabled).length;
  }

  /**
   * 是否启用正文优化功能
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 设置启用状态
   */
  setEnabled(value: boolean): void {
    this.enabled = value;
    this.save();
  }

  /**
   * 添加条目
   */
  addEntry(entry?: Partial<TextOptimizationEntry>): TextOptimizationEntry {
    const newEntry = {
      ...createDefaultEntry(),
      ...entry,
      id: entry?.id || generateEntryId(),
    };

    if (this.currentPreset) {
      this.currentPreset.entries.push(newEntry);
      this.save();
    }

    return newEntry;
  }

  /**
   * 更新条目
   */
  updateEntry(id: string, updates: Partial<TextOptimizationEntry>): boolean {
    if (!this.currentPreset) return false;

    const index = this.currentPreset.entries.findIndex(e => e.id === id);
    if (index === -1) return false;

    this.currentPreset.entries[index] = {
      ...this.currentPreset.entries[index],
      ...updates,
    };
    this.save();
    return true;
  }

  /**
   * 删除条目
   */
  deleteEntry(id: string): boolean {
    if (!this.currentPreset) return false;

    const index = this.currentPreset.entries.findIndex(e => e.id === id);
    if (index === -1) return false;

    this.currentPreset.entries.splice(index, 1);
    this.save();
    return true;
  }

  /**
   * 移动条目（调整顺序）
   */
  moveEntry(id: string, direction: 'up' | 'down'): boolean {
    if (!this.currentPreset) return false;

    const entries = this.currentPreset.entries;
    const index = entries.findIndex(e => e.id === id);
    if (index === -1) return false;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= entries.length) return false;

    // 交换位置
    [entries[index], entries[newIndex]] = [entries[newIndex], entries[index]];

    // 更新order
    entries.forEach((e, i) => { e.order = i; });

    this.save();
    return true;
  }

  /**
   * 设置条目列表（替换全部）
   */
  setEntries(entries: TextOptimizationEntry[]): void {
    if (this.currentPreset) {
      this.currentPreset.entries = entries;
      this.save();
    }
  }

  /**
   * 导入酒馆世界书格式
   */
  importFromTavernWorldBook(worldBook: TavernWorldBookFormat, merge: boolean = false): number {
    const newEntries = convertTavernWorldBook(worldBook);

    if (!this.currentPreset) {
      this.currentPreset = {
        id: 'imported',
        name: worldBook.name || '导入的预设',
        entries: newEntries,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
      };
    } else if (merge) {
      // 合并模式：追加条目
      this.currentPreset.entries.push(...newEntries);
      this.currentPreset.name = worldBook.name || this.currentPreset.name;
    } else {
      // 替换模式：覆盖全部
      this.currentPreset.entries = newEntries;
      this.currentPreset.name = worldBook.name || this.currentPreset.name;
    }

    this.save();
    console.log('[正文优化服务] 导入成功，条目数:', newEntries.length);
    return newEntries.length;
  }

  /**
   * 导入JSON格式（支持多种格式自动识别）
   */
  importFromJSON(json: any, merge: boolean = false): number {
    try {
      // 尝试识别格式

      // 格式1: 酒馆世界书格式（有entries对象）
      if (json.entries && typeof json.entries === 'object' && !Array.isArray(json.entries)) {
        return this.importFromTavernWorldBook(json as TavernWorldBookFormat, merge);
      }

      // 格式2: 内部预设格式（有entries数组）
      if (json.entries && Array.isArray(json.entries)) {
        const preset = json as TextOptimizationPreset;
        if (!this.currentPreset) {
          this.currentPreset = preset;
        } else if (merge) {
          this.currentPreset.entries.push(...preset.entries);
          this.currentPreset.name = preset.name || this.currentPreset.name;
        } else {
          this.currentPreset = preset;
        }
        this.save();
        return preset.entries.length;
      }

      // 格式3: 纯条目数组
      if (Array.isArray(json)) {
        const entries = json as TextOptimizationEntry[];
        if (merge && this.currentPreset) {
          this.currentPreset.entries.push(...entries);
        } else {
          if (!this.currentPreset) {
            this.currentPreset = {
              id: 'imported',
              name: '导入的预设',
              entries,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: '1.0.0',
            };
          } else {
            this.currentPreset.entries = entries;
          }
        }
        this.save();
        return entries.length;
      }

      throw new Error('无法识别的预设格式');
    } catch (e) {
      console.error('[正文优化服务] 导入失败:', e);
      throw e;
    }
  }

  /**
   * 导出为酒馆世界书格式
   */
  exportToTavernWorldBook(): TavernWorldBookFormat {
    const entries = this.getEntries();
    const name = this.currentPreset?.name || '正文优化预设';
    return exportToTavernWorldBook(entries, name);
  }

  /**
   * 导出为内部格式
   */
  exportToJSON(): TextOptimizationPreset {
    if (!this.currentPreset) {
      return {
        id: 'exported',
        name: '导出的预设',
        entries: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
      };
    }
    return { ...this.currentPreset };
  }

  /**
   * 下载预设文件（酒馆格式）
   */
  downloadAsTavernFormat(): void {
    const data = this.exportToTavernWorldBook();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentPreset?.name || '正文优化预设'}_worldbook.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 下载预设文件（内部格式）
   */
  downloadAsJSON(): void {
    const data = this.exportToJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentPreset?.name || '正文优化预设'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 清空所有条目
   */
  clearEntries(): void {
    if (this.currentPreset) {
      this.currentPreset.entries = [];
      this.save();
    }
  }

  /**
   * 重置为默认
   */
  reset(): void {
    this.currentPreset = {
      id: 'default',
      name: '默认预设',
      entries: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
    };
    this.enabled = false;
    this.save();
    // 重置时也清空优化历史
    this.clearHistory();
  }

  // =====================================================
  // 优化正文历史管理
  // =====================================================

  /**
   * 添加优化后的正文到历史（用于首次优化）
   * @param text 优化后的正文
   */
  addOptimizedText(text: string): void {
    this.optimizedTextHistory.push(text);
    // 保持最多10层
    if (this.optimizedTextHistory.length > MAX_HISTORY_SIZE) {
      this.optimizedTextHistory.shift();
    }
    this.saveHistory();
    console.log('[正文优化服务] 已添加优化正文到历史，当前层数:', this.optimizedTextHistory.length);
  }

  /**
   * 替换最新一层优化正文（用于re-roll）
   * @param text 新的优化正文
   */
  replaceLatestOptimizedText(text: string): void {
    if (this.optimizedTextHistory.length > 0) {
      this.optimizedTextHistory[this.optimizedTextHistory.length - 1] = text;
      console.log('[正文优化服务] 已替换最新优化正文历史层');
    } else {
      this.optimizedTextHistory.push(text);
      console.log('[正文优化服务] 历史为空，已添加为第一层');
    }
    this.saveHistory();
  }

  /**
   * 获取最新N层历史优化正文
   * @param count 需要的层数
   * @param excludeLatest 是否排除最新一层（Re-roll时使用）
   * @returns 历史优化正文数组
   */
  getOptimizedTextHistory(count: number, excludeLatest: boolean = false): string[] {
    if (count <= 0) return [];

    if (excludeLatest && this.optimizedTextHistory.length > 0) {
      // Re-roll场景：排除最新一层，从倒数第二层开始取
      const historyWithoutLatest = this.optimizedTextHistory.slice(0, -1);
      return historyWithoutLatest.slice(-count);
    }

    // 首次优化场景：正常取最新N层
    return this.optimizedTextHistory.slice(-count);
  }

  /**
   * 获取当前历史层数
   */
  getHistoryCount(): number {
    return this.optimizedTextHistory.length;
  }

  /**
   * 清空优化历史
   */
  clearHistory(): void {
    this.optimizedTextHistory = [];
    // 不再保存到 localStorage，历史现在跟随存档
    console.log('[正文优化服务] 已清空优化正文历史');
  }

  /**
   * 切换到指定存档的历史（存档加载时调用）
   * @param saveId 存档ID
   * @param history 该存档的历史数据
   */
  switchSave(saveId: string, history: string[] = []): void {
    this.currentSaveId = saveId;
    this.optimizedTextHistory = [...history]; // 深拷贝避免引用问题
    console.log(`[正文优化服务] 切换到存档 ${saveId}，历史层数:`, this.optimizedTextHistory.length);
  }

  /**
   * 获取当前历史数据（存档保存时调用）
   * @returns 当前的优化历史数组
   */
  getCurrentHistory(): string[] {
    return [...this.optimizedTextHistory]; // 返回副本避免外部修改
  }

  /**
   * 获取当前存档ID
   */
  getCurrentSaveId(): string | null {
    return this.currentSaveId;
  }

  /**
   * 保存历史到localStorage（兼容旧逻辑，作为备份）
   * 注意：主要的历史存储现在是存档级别的
   */
  private saveHistory(): void {
    // 保留 localStorage 作为临时备份，但主要存储在存档中
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.optimizedTextHistory));
    } catch (e) {
      console.error('[正文优化服务] 保存优化历史失败:', e);
    }
  }

  /**
   * 从localStorage加载历史（仅在没有存档数据时使用）
   */
  private loadHistory(): void {
    // 如果已有存档数据，不从 localStorage 加载
    if (this.currentSaveId && this.optimizedTextHistory.length > 0) {
      return;
    }

    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        this.optimizedTextHistory = JSON.parse(saved);
        console.log('[正文优化服务] 从localStorage加载优化历史，层数:', this.optimizedTextHistory.length);
      }
    } catch (e) {
      console.warn('[正文优化服务] 加载优化历史失败:', e);
      this.optimizedTextHistory = [];
    }
  }

  /**
   * 迁移旧的localStorage历史到当前存档
   * @returns 迁移的历史数组，如果没有则返回空数组
   */
  migrateFromLocalStorage(): string[] {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const history = JSON.parse(saved);
        if (Array.isArray(history) && history.length > 0) {
          console.log('[正文优化服务] 迁移旧历史数据，层数:', history.length);
          // 迁移后清除旧数据
          localStorage.removeItem(HISTORY_KEY);
          return history;
        }
      }
    } catch (e) {
      console.warn('[正文优化服务] 迁移旧历史失败:', e);
    }
    return [];
  }

  /**
   * 构建正文优化的提示词消息列表
   * @param originalText 原始正文（Step1最新生成的）
   * @param historyCount 要包含的历史优化正文层数（从配置获取）
   * @param isReroll 是否为Re-roll场景（Re-roll时需排除最新一层历史）
   * @returns 用于AI调用的消息列表
   */
  buildOptimizationMessages(
    originalText: string,
    historyCount: number = 0,
    isReroll: boolean = false
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // 获取启用的条目（已按depth排序）
    const entries = this.getEnabledEntries();

    // 添加条目内容
    for (const entry of entries) {
      messages.push({
        role: entry.role,
        content: entry.content,
      });
    }

    // 新增：如果配置了历史层数，添加历史优化正文作为上下文
    if (historyCount > 0) {
      // Re-roll时排除最新一层（因为那是要被替换的）
      const history = this.getOptimizedTextHistory(historyCount, isReroll);
      if (history.length > 0) {
        const historyContext = history.map((text, index) =>
          `【历史优化正文 ${index + 1}】\n${text}`
        ).join('\n\n---\n\n');

        messages.push({
          role: 'system',
          content: `以下是之前的优化正文历史，作为风格参考，请保持一致的写作风格：\n\n${historyContext}`,
        });
        console.log('[正文优化服务] 已添加', history.length, '层历史优化正文作为上下文');
      }
    }

    // 添加原始正文作为用户输入
    messages.push({
      role: 'user',
      content: `请优化以下正文内容：\n\n${originalText}`,
    });

    return messages;
  }
}

// 导出单例
export const textOptimizationService = new TextOptimizationService();
