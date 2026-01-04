/**
 * 提示词排序服务
 * 统一管理预览和实际发送的消息顺序
 *
 * 功能：
 * 1. 存储和加载自定义排序顺序（按场景）
 * 2. 应用排序到消息列表
 * 3. 迁移旧版本数据格式
 */

import type { PreviewScenario } from './promptPreviewService';

// 存储键
const STORAGE_KEY = 'dad_prompt_order_v2';
const OLD_STORAGE_KEY = 'dad_prompt_preview_order';

/**
 * 带有源标识符的消息接口
 */
export interface OrderableMessage {
  sourceId: string;
  [key: string]: unknown;
}

/**
 * 注入消息接口（用于AI发送）
 */
export interface InjectMessage {
  sourceId?: string;
  content: string;
  role: 'system' | 'user' | 'assistant';
  depth: number;
  position: 'in_chat' | 'none';
}

class PromptOrderService {
  private initialized = false;

  constructor() {
    this.migrateOldFormat();
    this.initialized = true;
  }

  /**
   * 迁移旧版本数据格式
   * 旧格式是索引数组，无法可靠转换为sourceId数组，直接清除
   */
  private migrateOldFormat(): void {
    try {
      const oldData = localStorage.getItem(OLD_STORAGE_KEY);
      if (oldData) {
        console.log('[PromptOrderService] 检测到旧版排序数据，已清除（需重新配置）');
        localStorage.removeItem(OLD_STORAGE_KEY);
      }
    } catch (error) {
      console.error('[PromptOrderService] 迁移旧格式失败:', error);
    }
  }

  /**
   * 获取场景的自定义顺序
   * @param scenario 预览场景
   * @returns sourceId数组，如果没有自定义顺序则返回null
   */
  getCustomOrder(scenario: PreviewScenario): string[] | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const allOrders = JSON.parse(saved) as Record<string, string[]>;
        return allOrders[scenario] || null;
      }
    } catch (error) {
      console.error('[PromptOrderService] 加载排序失败:', error);
    }
    return null;
  }

  /**
   * 保存场景的自定义顺序
   * @param scenario 预览场景
   * @param order sourceId数组，传null清除该场景的排序
   */
  saveCustomOrder(scenario: PreviewScenario, order: string[] | null): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const allOrders: Record<string, string[]> = saved ? JSON.parse(saved) : {};

      if (order === null) {
        delete allOrders[scenario];
      } else {
        allOrders[scenario] = order;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(allOrders));
      console.log(`[PromptOrderService] 已保存 ${scenario} 的排序顺序`);
    } catch (error) {
      console.error('[PromptOrderService] 保存排序失败:', error);
    }
  }

  /**
   * 检查场景是否有自定义顺序
   */
  hasCustomOrder(scenario: PreviewScenario): boolean {
    const order = this.getCustomOrder(scenario);
    return order !== null && order.length > 0;
  }

  /**
   * 清除场景的自定义顺序
   */
  clearCustomOrder(scenario: PreviewScenario): void {
    this.saveCustomOrder(scenario, null);
  }

  /**
   * 清除所有场景的自定义顺序
   */
  clearAllOrders(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[PromptOrderService] 已清除所有排序顺序');
    } catch (error) {
      console.error('[PromptOrderService] 清除排序失败:', error);
    }
  }

  /**
   * 应用自定义顺序到消息列表
   * @param messages 原始消息列表（需要包含sourceId字段）
   * @param customOrder 自定义顺序（sourceId数组）
   * @returns 排序后的消息列表
   */
  applyOrder<T extends OrderableMessage>(
    messages: T[],
    customOrder: string[] | null
  ): T[] {
    if (!customOrder || customOrder.length === 0) {
      return messages;
    }

    // 创建 sourceId -> message 的映射
    const messageMap = new Map<string, T>();
    messages.forEach(msg => {
      if (msg.sourceId) {
        messageMap.set(msg.sourceId, msg);
      }
    });

    // 按自定义顺序排列
    const ordered: T[] = [];
    const usedIds = new Set<string>();

    // 先添加在自定义顺序中的消息
    for (const sourceId of customOrder) {
      const msg = messageMap.get(sourceId);
      if (msg) {
        ordered.push(msg);
        usedIds.add(sourceId);
      }
    }

    // 添加不在自定义顺序中的新消息（保持原顺序，放到末尾）
    for (const msg of messages) {
      if (msg.sourceId && !usedIds.has(msg.sourceId)) {
        ordered.push(msg);
      }
    }

    // 添加没有sourceId的消息（保持原顺序，放到最末尾）
    for (const msg of messages) {
      if (!msg.sourceId) {
        ordered.push(msg);
      }
    }

    return ordered;
  }

  /**
   * 应用自定义顺序到注入消息列表（用于AI发送）
   * @param injects 原始注入消息列表
   * @param scenario 场景
   * @returns 排序后的注入消息列表
   */
  applyOrderToInjects(
    injects: InjectMessage[],
    scenario: PreviewScenario
  ): InjectMessage[] {
    const customOrder = this.getCustomOrder(scenario);
    if (!customOrder || customOrder.length === 0) {
      return injects;
    }

    // 转换为可排序格式
    const orderable = injects.map(inject => ({
      ...inject,
      sourceId: inject.sourceId || '',
    }));

    // 应用排序
    const sorted = this.applyOrder(orderable, customOrder);

    // 转换回原格式
    return sorted.map(({ sourceId, ...rest }) => ({
      ...rest,
      sourceId,
    } as InjectMessage));
  }

  /**
   * 从消息列表生成默认顺序
   */
  generateDefaultOrder<T extends OrderableMessage>(messages: T[]): string[] {
    return messages
      .filter(msg => msg.sourceId)
      .map(msg => msg.sourceId);
  }
}

// 导出单例
export const promptOrderService = new PromptOrderService();
