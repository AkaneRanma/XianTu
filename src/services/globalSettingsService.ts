/**
 * 全局设置导出导入服务
 * 用于一键导出/导入所有提示词相关设置
 */

import { promptPreviewService, type WorldBookEntry, type ShortTermMemoryConfig, type PreviewScenario } from './promptPreviewService';
import { textOptimizationService } from './textOptimizationService';
import { tavernPresetService } from './tavernPresetService';
import { promptOrderService } from './promptOrderService';
import type { TextOptimizationEntry } from '@/types/textOptimization';
import type { LocalTavernPreset } from '@/types/tavernPreset';

// ==================== 类型定义 ====================

export interface GlobalSettings {
  version: string;
  exportedAt: string;
  memoryConfig: ShortTermMemoryConfig;
  worldBookEntries: WorldBookEntry[];
  textOptimizationEntries: TextOptimizationEntry[];
  customPrompts?: Record<string, string>;
  // 酒馆预设
  tavernPresets?: LocalTavernPreset[];
  activeTavernPresetId?: string | null;
  // 消息序列自定义顺序（按场景存储）
  promptOrders?: Record<string, string[]>;
}

// ==================== 服务实现 ====================

class GlobalSettingsService {
  private readonly CURRENT_VERSION = '1.2'; // 升级版本号以支持消息序列顺序
  private readonly PROMPT_ORDER_STORAGE_KEY = 'dad_prompt_order_v2';

  /**
   * 导出所有设置（异步，因为需要从IndexedDB读取酒馆预设）
   */
  public async exportAllSettings(): Promise<string> {
    const settings: GlobalSettings = {
      version: this.CURRENT_VERSION,
      exportedAt: new Date().toISOString(),
      memoryConfig: promptPreviewService.getMemoryConfig(),
      worldBookEntries: promptPreviewService.getWorldBookEntries(),
      textOptimizationEntries: textOptimizationService.getEntries(),
    };

    // 收集自定义提示词（如果有）
    const customPrompts: Record<string, string> = {};
    const customPromptKeys = [
      'customSystemPrompt',
      'customActionOptionsPrompt',
    ];

    for (const key of customPromptKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        customPrompts[key] = value;
      }
    }

    if (Object.keys(customPrompts).length > 0) {
      settings.customPrompts = customPrompts;
    }

    // 导出酒馆预设（从IndexedDB）
    try {
      await tavernPresetService.init();
      const tavernPresets = await tavernPresetService.getAllPresets();
      const activeTavernPresetId = await tavernPresetService.getActivePresetId();

      if (tavernPresets.length > 0) {
        settings.tavernPresets = tavernPresets;
        settings.activeTavernPresetId = activeTavernPresetId;
        console.log(`[GlobalSettingsService] 导出 ${tavernPresets.length} 个酒馆预设`);
      }
    } catch (error) {
      console.error('[GlobalSettingsService] 导出酒馆预设失败:', error);
    }

    // 导出消息序列自定义顺序
    try {
      const savedOrders = localStorage.getItem(this.PROMPT_ORDER_STORAGE_KEY);
      if (savedOrders) {
        const orders = JSON.parse(savedOrders) as Record<string, string[]>;
        if (Object.keys(orders).length > 0) {
          settings.promptOrders = orders;
          console.log(`[GlobalSettingsService] 导出 ${Object.keys(orders).length} 个场景的消息序列顺序`);
        }
      }
    } catch (error) {
      console.error('[GlobalSettingsService] 导出消息序列顺序失败:', error);
    }

    return JSON.stringify(settings, null, 2);
  }

  /**
   * 导入所有设置（异步，因为需要写入IndexedDB）
   */
  public async importAllSettings(data: string, options?: {
    overwrite?: boolean;
    skipMemoryConfig?: boolean;
    skipWorldBook?: boolean;
    skipTextOptimization?: boolean;
    skipCustomPrompts?: boolean;
    skipTavernPresets?: boolean;
    skipPromptOrders?: boolean;
  }): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      memoryConfigImported: false,
      worldBookEntriesCount: 0,
      textOptimizationEntriesCount: 0,
      customPromptsCount: 0,
      tavernPresetsCount: 0,
      promptOrdersCount: 0,
      errors: [],
    };

    try {
      const settings = JSON.parse(data) as GlobalSettings;

      // 验证版本
      if (!settings.version) {
        result.errors.push('缺少版本信息，可能是旧格式');
      }

      // 导入记忆配置
      if (!options?.skipMemoryConfig && settings.memoryConfig) {
        try {
          promptPreviewService.setMemoryConfig(settings.memoryConfig);
          result.memoryConfigImported = true;
        } catch (error) {
          result.errors.push(`导入记忆配置失败: ${error}`);
        }
      }

      // 导入世界书条目
      if (!options?.skipWorldBook && settings.worldBookEntries) {
        try {
          if (options?.overwrite) {
            promptPreviewService.setWorldBookEntries(settings.worldBookEntries);
          } else {
            // 合并模式
            const existingEntries = promptPreviewService.getWorldBookEntries();
            const existingIds = new Set(existingEntries.map(e => e.id));
            const newEntries = settings.worldBookEntries.filter(e => !existingIds.has(e.id));
            promptPreviewService.setWorldBookEntries([...existingEntries, ...newEntries]);
          }
          result.worldBookEntriesCount = settings.worldBookEntries.length;
        } catch (error) {
          result.errors.push(`导入世界书失败: ${error}`);
        }
      }

      // 导入正文优化条目
      if (!options?.skipTextOptimization && settings.textOptimizationEntries) {
        try {
          if (options?.overwrite) {
            textOptimizationService.setEntries(settings.textOptimizationEntries);
          } else {
            // 合并模式
            const existingEntries = textOptimizationService.getEntries();
            const existingIds = new Set(existingEntries.map(e => e.id));
            const newEntries = settings.textOptimizationEntries.filter(e => !existingIds.has(e.id));
            textOptimizationService.setEntries([...existingEntries, ...newEntries]);
          }
          result.textOptimizationEntriesCount = settings.textOptimizationEntries.length;
        } catch (error) {
          result.errors.push(`导入正文优化条目失败: ${error}`);
        }
      }

      // 导入自定义提示词
      if (!options?.skipCustomPrompts && settings.customPrompts) {
        try {
          for (const [key, value] of Object.entries(settings.customPrompts)) {
            localStorage.setItem(key, value);
            result.customPromptsCount++;
          }
        } catch (error) {
          result.errors.push(`导入自定义提示词失败: ${error}`);
        }
      }

      // 导入酒馆预设（写入IndexedDB）
      if (!options?.skipTavernPresets && settings.tavernPresets && settings.tavernPresets.length > 0) {
        try {
          await tavernPresetService.init();

          if (options?.overwrite) {
            // 覆盖模式：先删除所有现有预设
            const existingPresets = await tavernPresetService.getAllPresets();
            for (const preset of existingPresets) {
              await tavernPresetService.deletePreset(preset.id);
            }
          }

          // 导入预设
          for (const preset of settings.tavernPresets) {
            // 检查是否已存在同ID的预设
            const existing = await tavernPresetService.getPreset(preset.id);
            if (existing && !options?.overwrite) {
              // 合并模式下跳过已存在的预设
              continue;
            }
            await tavernPresetService.savePreset(preset);
            result.tavernPresetsCount++;
          }

          // 恢复激活状态
          if (settings.activeTavernPresetId) {
            const activePreset = await tavernPresetService.getPreset(settings.activeTavernPresetId);
            if (activePreset) {
              await tavernPresetService.setActivePreset(settings.activeTavernPresetId);
            }
          }

          console.log(`[GlobalSettingsService] 导入 ${result.tavernPresetsCount} 个酒馆预设`);
        } catch (error) {
          result.errors.push(`导入酒馆预设失败: ${error}`);
        }
      }

      // 导入消息序列自定义顺序
      if (!options?.skipPromptOrders && settings.promptOrders) {
        try {
          if (options?.overwrite) {
            // 覆盖模式：直接替换
            localStorage.setItem(this.PROMPT_ORDER_STORAGE_KEY, JSON.stringify(settings.promptOrders));
            result.promptOrdersCount = Object.keys(settings.promptOrders).length;
          } else {
            // 合并模式：合并现有顺序
            const existingData = localStorage.getItem(this.PROMPT_ORDER_STORAGE_KEY);
            const existingOrders: Record<string, string[]> = existingData ? JSON.parse(existingData) : {};

            for (const [scenario, order] of Object.entries(settings.promptOrders)) {
              // 只导入不存在的场景顺序
              if (!existingOrders[scenario]) {
                existingOrders[scenario] = order;
                result.promptOrdersCount++;
              }
            }

            localStorage.setItem(this.PROMPT_ORDER_STORAGE_KEY, JSON.stringify(existingOrders));
          }
          console.log(`[GlobalSettingsService] 导入 ${result.promptOrdersCount} 个场景的消息序列顺序`);
        } catch (error) {
          result.errors.push(`导入消息序列顺序失败: ${error}`);
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`解析JSON失败: ${error}`);
    }

    return result;
  }

  /**
   * 重置所有设置为默认值
   */
  public resetAllSettings(): void {
    // 重置记忆配置
    promptPreviewService.setMemoryConfig({
      textGenerationCount: 3,
      variableGenerationCount: 3,
      textOptimizationCount: 0,
      promptTemplate: `# 【最近事件】
{{memories}}
根据这刚刚发生的文本事件，合理生成下一次文本信息，要保证衔接流畅、不断层，符合上文的文本信息`,
    });

    // 清空世界书
    promptPreviewService.setWorldBookEntries([]);

    // 重置正文优化条目
    textOptimizationService.reset();

    // 清除自定义提示词
    const customPromptKeys = [
      'customSystemPrompt',
      'customActionOptionsPrompt',
    ];
    for (const key of customPromptKeys) {
      localStorage.removeItem(key);
    }

    // 清除消息序列顺序
    promptOrderService.clearAllOrders();
  }

  /**
   * 下载设置文件（异步）
   */
  public async downloadSettings(filename?: string): Promise<void> {
    const data = await this.exportAllSettings();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `xiantu-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 从文件导入设置
   */
  public async importFromFile(file: File, options?: {
    overwrite?: boolean;
    skipMemoryConfig?: boolean;
    skipWorldBook?: boolean;
    skipTextOptimization?: boolean;
    skipCustomPrompts?: boolean;
    skipTavernPresets?: boolean;
    skipPromptOrders?: boolean;
  }): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result as string;
          const result = await this.importAllSettings(data, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });
  }

  /**
   * 获取酒馆预设统计信息
   */
  public async getTavernPresetStats(): Promise<{ count: number; activeId: string | null }> {
    try {
      await tavernPresetService.init();
      const presets = await tavernPresetService.getAllPresets();
      const activeId = await tavernPresetService.getActivePresetId();
      return { count: presets.length, activeId };
    } catch (error) {
      console.error('[GlobalSettingsService] 获取酒馆预设统计失败:', error);
      return { count: 0, activeId: null };
    }
  }
}

export interface ImportResult {
  success: boolean;
  memoryConfigImported: boolean;
  worldBookEntriesCount: number;
  textOptimizationEntriesCount: number;
  customPromptsCount: number;
  tavernPresetsCount: number;
  promptOrdersCount: number;
  errors: string[];
}

// 导出单例
export const globalSettingsService = new GlobalSettingsService();
