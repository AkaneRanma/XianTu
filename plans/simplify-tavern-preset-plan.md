# 简化酒馆预设方案 - 实施计划

## 需求概述

用户需求：**简化酒馆预设功能，去除花里胡哨的模式**

- 启用酒馆预设时，完全用酒馆预设的提示词替代网页端正文生成
- 网页端的正文生成预览在酒馆预设激活时自动停用
- 预览界面的拖拽排序需要影响实际发送的消息顺序（所有场景、全局设置）

---

## 当前状态分析

### 已完成的功能

1. **酒馆预设替换正文生成** ✅
   - [`AIBidirectionalSystem.ts:202-290`](src/utils/AIBidirectionalSystem.ts:202) 已实现检测酒馆预设并替换提示词
   - 当 `activePreset` 存在时，使用 `tavernPresetService.buildPromptMessages()` 构建消息

2. **正文生成预览停用提示** ✅
   - [`SendPreviewTab.vue:7-24`](src/components/dashboard/prompt-management/SendPreviewTab.vue:7) 显示酒馆预设激活提示
   - 正文生成场景自动隐藏预览界面

3. **拖拽排序功能** ✅
   - [`SendPreviewTab.vue:200-262`](src/components/dashboard/prompt-management/SendPreviewTab.vue:200) 排序持久化到 localStorage
   - 存储键: `dad_prompt_preview_order`
   - 按场景分别保存: `{ [scenario]: number[] }`

### 待实现的功能

**核心问题**: 预览界面的排序目前只影响显示，**不影响实际发送给AI的消息顺序**

---

## 技术方案

### 方案设计思路

当前的排序存储格式是按**索引位置**存储的数组 `[2, 0, 1, 3]`，表示将第2条移到第1位、第0条移到第2位等。这个设计有一个问题：**预览界面的消息数量和实际发送的消息数量可能不完全一致**。

为了让排序可靠地影响实际发送，需要：

1. 为每个消息块分配**稳定的源标识符** (source identifier)
2. 存储排序时使用标识符而不是索引
3. 发送时根据标识符映射重新排序

### 消息源标识符设计

```typescript
// 统一的消息源标识符
type MessageSourceId =
  // 正文生成场景
  | 'system_prompt' // 系统提示词（含游戏状态）
  | 'world_book_*' // 世界书条目 (world_book_0, world_book_1, ...)
  | 'memory_combined' // 组合记忆（短期+中期+长期）
  | 'cot_prompt' // CoT思维链提示词
  | 'user_input' // 用户输入
  | 'input_end_marker' // 输入结束占位符
  // 变量生成场景
  | 'step2_system' // Step2系统提示词
  | 'short_term_memory' // 短期记忆
  | 'step2_user_input' // Step2用户输入
  // 正文优化场景
  | 'optimization_entry_*' // 优化条目
  | 'source_text' // 待优化正文
  // 酒馆预设场景
  | 'tavern_prompt_*' // 酒馆预设消息
```

### 存储格式调整

```typescript
// 旧格式（索引数组）
{ "text_generation": [2, 0, 1, 3] }

// 新格式（源标识符数组）
{
  "text_generation": [
    "memory_combined",
    "system_prompt",
    "world_book_0",
    "user_input",
    "cot_prompt",
    "input_end_marker"
  ]
}
```

---

## 实施步骤

### 第1步：创建提示词排序服务

创建 [`src/services/promptOrderService.ts`](src/services/promptOrderService.ts)

```typescript
/**
 * 提示词排序服务
 * 统一管理预览和实际发送的消息顺序
 */

import type { PreviewScenario } from './promptPreviewService'

export interface OrderedMessage {
  sourceId: string // 唯一源标识符
  content: string
  role: 'system' | 'user' | 'assistant'
  depth?: number
}

const STORAGE_KEY = 'dad_prompt_order_v2'

class PromptOrderService {
  /**
   * 获取场景的自定义顺序
   */
  getCustomOrder(scenario: PreviewScenario): string[] | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const allOrders = JSON.parse(saved)
        return allOrders[scenario] || null
      }
    } catch (error) {
      console.error('[PromptOrderService] 加载排序失败:', error)
    }
    return null
  }

  /**
   * 保存场景的自定义顺序
   */
  saveCustomOrder(scenario: PreviewScenario, order: string[] | null): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const allOrders = saved ? JSON.parse(saved) : {}

      if (order === null) {
        delete allOrders[scenario]
      } else {
        allOrders[scenario] = order
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(allOrders))
    } catch (error) {
      console.error('[PromptOrderService] 保存排序失败:', error)
    }
  }

  /**
   * 应用自定义顺序到消息列表
   */
  applyOrder<T extends { sourceId: string }>(messages: T[], customOrder: string[] | null): T[] {
    if (!customOrder || customOrder.length === 0) {
      return messages
    }

    // 创建 sourceId -> message 的映射
    const messageMap = new Map<string, T>()
    messages.forEach((msg) => messageMap.set(msg.sourceId, msg))

    // 按自定义顺序排列
    const ordered: T[] = []
    const usedIds = new Set<string>()

    // 先添加在自定义顺序中的消息
    for (const sourceId of customOrder) {
      const msg = messageMap.get(sourceId)
      if (msg) {
        ordered.push(msg)
        usedIds.add(sourceId)
      }
    }

    // 添加不在自定义顺序中的新消息（保持原顺序）
    for (const msg of messages) {
      if (!usedIds.has(msg.sourceId)) {
        ordered.push(msg)
      }
    }

    return ordered
  }
}

export const promptOrderService = new PromptOrderService()
```

### 第2步：修改 promptPreviewService.ts

在 [`promptPreviewService.ts`](src/services/promptPreviewService.ts) 中为每个消息添加 `sourceId`：

```typescript
// 修改 PreviewMessage 接口
export interface PreviewMessage {
  id: string;
  sourceId: string;           // 🔥 新增：稳定的源标识符
  role: 'system' | 'user' | 'assistant';
  content: string;
  source: string;
  depth: number;
  charCount: number;
  truncated?: boolean;
  fullContent?: string;
}

// 修改 createMessage 方法
private createMessage(
  role: 'system' | 'user' | 'assistant',
  content: string,
  source: string,
  depth: number,
  sourceId: string  // 🔥 新增参数
): PreviewMessage {
  // ...
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    sourceId,  // 🔥 添加
    role,
    content: truncated ? content.substring(0, truncateLength) + '...' : content,
    // ...
  };
}
```

### 第3步：修改 AIBidirectionalSystem.ts

在 [`AIBidirectionalSystem.ts`](src/utils/AIBidirectionalSystem.ts) 的 `processPlayerAction` 方法中应用自定义排序：

```typescript
import { promptOrderService } from '@/services/promptOrderService'

// 在构建 injects 后、发送前应用排序
// 约第290行处

// 🔥 应用自定义排序
const scenario = activePreset ? 'tavern_preset' : 'text_generation'
const customOrder = promptOrderService.getCustomOrder(scenario)
if (customOrder && customOrder.length > 0) {
  injects = promptOrderService.applyOrder(injects, customOrder)
  console.log('[AI双向系统] 已应用自定义消息顺序')
}
```

### 第4步：修改 SendPreviewTab.vue

更新拖拽排序逻辑使用 `sourceId` 而不是索引：

```typescript
// 存储键改用新版本
const STORAGE_KEY_CUSTOM_ORDER = 'dad_prompt_order_v2'

// handleDrop 修改
const handleDrop = (targetIndex: number) => {
  // ...

  // 获取所有消息的 sourceId 顺序
  const currentOrder = sortedMessages.value.map((msg) => msg.sourceId)

  // 执行移动
  const [movedId] = currentOrder.splice(sourceIndex, 1)
  currentOrder.splice(targetIndex, 0, movedId)

  // 保存 sourceId 顺序而不是索引顺序
  promptOrderService.saveCustomOrder(selectedScenario.value, currentOrder)

  // ...
}
```

---

## 影响范围

### 需要修改的文件

| 文件                                                            | 修改内容           |
| --------------------------------------------------------------- | ------------------ |
| `src/services/promptOrderService.ts`                            | 🆕 新建文件        |
| `src/services/promptPreviewService.ts`                          | 添加 sourceId 字段 |
| `src/utils/AIBidirectionalSystem.ts`                            | 发送前应用排序     |
| `src/components/dashboard/prompt-management/SendPreviewTab.vue` | 使用新的存储格式   |

### 不需要修改的文件

- `tavernPresetService.ts` - 酒馆预设核心逻辑已完成
- `TavernPresetTab.vue` - UI已简化
- `MessagePreviewCard.vue` - 拖拽UI已完成

---

## 迁移策略

由于存储格式从索引数组改为 sourceId 数组，需要处理旧数据：

```typescript
// promptOrderService.ts 中添加迁移逻辑
private migrateOldFormat(): void {
  const oldKey = 'dad_prompt_preview_order';
  const oldData = localStorage.getItem(oldKey);

  if (oldData) {
    // 旧格式无法可靠转换，直接清除
    localStorage.removeItem(oldKey);
    console.log('[PromptOrderService] 已清除旧版排序数据，需重新配置');
  }
}
```

---

## 验证清单

- [ ] 正文生成场景：拖拽排序后，实际发送的消息顺序与预览一致
- [ ] 变量生成场景：拖拽排序后，实际发送的消息顺序与预览一致
- [ ] 正文优化场景：拖拽排序后，实际发送的消息顺序与预览一致
- [ ] 酒馆预设场景：拖拽排序后，实际发送的消息顺序与预览一致
- [ ] 切换场景后，排序配置正确加载
- [ ] 刷新页面后，排序配置保持
- [ ] 重置排序功能正常工作
- [ ] 酒馆预设激活时，正文生成预览正确停用

---

## 下一步

确认此方案后，切换到 Code 模式进行实施。
