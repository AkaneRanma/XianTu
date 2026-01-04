/**
 * 全局设置导出导入服务
 * 用于一键导出/导入所有提示词相关设置
 */

import { promptPreviewService, type WorldBookEntry, type ShortTermMemoryConfig } from './promptPreviewService';
import { textOptimizationService } from './textOptimizationService';
import type { TextOptimizationEntry } from '@/types/textOptimization';

// ==================== 类型定义 ====================

export interface GlobalSettings {
  version: string;
  exportedAt: string;
  memoryConfig: ShortTermMemoryConfig;
  worldBookEntries: WorldBookEntry[];
  textOptimizationEntries: TextOptimizationEntry[];
  customPrompts?: Record<string, string>;
}

// ==================== 服务实现 ====================

class GlobalSettingsService {
  private readonly CURRENT_VERSION = '1.0';

  /**
   * 导出所有设置
   */
  public exportAllSettings(): string {
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

    return JSON.stringify(settings, null, 2);
  }

  /**
   * 导入所有设置
   */
  public importAllSettings(data: string, options?: {
    overwrite?: boolean;
    skipMemoryConfig?: boolean;
    skipWorldBook?: boolean;
    skipTextOptimization?: boolean;
    skipCustomPrompts?: boolean;
  }): ImportResult {
    const result: ImportResult = {
      success: true,
      memoryConfigImported: false,
      worldBookEntriesCount: 0,
      textOptimizationEntriesCount: 0,
      customPromptsCount: 0,
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
  }

  /**
   * 下载设置文件
   */
  public downloadSettings(filename?: string): void {
    const data = this.exportAllSettings();
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
  }): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result as string;
          const result = this.importAllSettings(data, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });
  }
}

export interface ImportResult {
  success: boolean;
  memoryConfigImported: boolean;
  worldBookEntriesCount: number;
  textOptimizationEntriesCount: number;
  customPromptsCount: number;
  errors: string[];
}

// 导出单例
export const globalSettingsService = new GlobalSettingsService();
