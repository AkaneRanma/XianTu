# 一键导出功能修复方案

## 问题分析

### 当前导出功能覆盖的内容

通过分析 [`globalSettingsService.ts`](src/services/globalSettingsService.ts:29) 中的 `exportAllSettings()` 方法：

```typescript
const settings: GlobalSettings = {
  version: this.CURRENT_VERSION,
  exportedAt: new Date().toISOString(),
  memoryConfig: promptPreviewService.getMemoryConfig(), // ✅ 已包含
  worldBookEntries: promptPreviewService.getWorldBookEntries(), // ✅ 已包含
  textOptimizationEntries: textOptimizationService.getEntries(), // ✅ 已包含
  // customPrompts 从 localStorage 读取                           // ✅ 已包含
}
```

### 缺失的内容

| 功能模块         | 存储位置                           | 状态       | 优先级 |
| ---------------- | ---------------------------------- | ---------- | ------ |
| 酒馆预设         | IndexedDB (`XianTu_TavernPresets`) | ❌ 未导出  | 高     |
| 酒馆预设激活状态 | IndexedDB (`activePreset`)         | ❌ 未导出  | 高     |
| ~~优化正文历史~~ | ~~localStorage~~                   | 不需要导出 | -      |

> **注意**：优化正文历史不应该在全局设置中导出，因为它是存档级别的数据。需要将其迁移到存档中保存（见附加任务）。

### 详细问题

#### 1. 酒馆预设未导出（严重）

酒馆预设存储在 IndexedDB 中，由 [`tavernPresetService.ts`](src/services/tavernPresetService.ts:43) 管理：

- 预设数据存储在 `tavernPresets` 表中
- 激活状态存储在 `activePreset` 表中
- 需要使用 `tavernPresetService.getAllPresets()` 获取所有预设
- 需要使用 `tavernPresetService.getActivePresetId()` 获取激活ID

#### 2. 记忆配置字段已同步（无问题）

[`ShortTermMemoryConfig`](src/services/promptPreviewService.ts:66) 接口包含所有新字段：

```typescript
export interface ShortTermMemoryConfig {
  textGenerationCount: number
  variableGenerationCount: number
  variableRerollCount: number // ✅ 新增
  textOptimizationCount: number
  textOptimizationRerollCount: number // ✅ 新增
  tavernPresetCount: number // ✅ 新增
  promptTemplate: string
  optimizedTextHistoryCount: number // ✅ 新增
}
```

由于 `promptPreviewService.getMemoryConfig()` 返回完整配置，这部分没有问题。

---

## 修复方案

### 1. 更新 GlobalSettings 接口

```typescript
// src/services/globalSettingsService.ts

export interface GlobalSettings {
  version: string
  exportedAt: string
  memoryConfig: ShortTermMemoryConfig
  worldBookEntries: WorldBookEntry[]
  textOptimizationEntries: TextOptimizationEntry[]
  customPrompts?: Record<string, string>
  // 🔥 新增字段
  tavernPresets?: LocalTavernPreset[] // 酒馆预设列表
  activeTavernPresetId?: string | null // 激活的预设ID
  // 注意：不导出 optimizedTextHistory，它应该随存档保存
}
```

### 2. 更新导出方法

```typescript
// 需要将方法改为异步，因为 IndexedDB 操作是异步的
public async exportAllSettings(): Promise<string> {
  // 获取酒馆预设
  let tavernPresets: LocalTavernPreset[] = [];
  let activeTavernPresetId: string | null = null;
  try {
    tavernPresets = await tavernPresetService.getAllPresets();
    activeTavernPresetId = await tavernPresetService.getActivePresetId();
  } catch (error) {
    console.warn('[GlobalSettingsService] 获取酒馆预设失败:', error);
  }

  const settings: GlobalSettings = {
    version: '2.0', // 升级版本号
    exportedAt: new Date().toISOString(),
    memoryConfig: promptPreviewService.getMemoryConfig(),
    worldBookEntries: promptPreviewService.getWorldBookEntries(),
    textOptimizationEntries: textOptimizationService.getEntries(),
    tavernPresets,
    activeTavernPresetId,
    // 注意：不导出 optimizedTextHistory，它应该随存档保存
  };

  // 收集自定义提示词
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
```

### 3. 更新导入方法

```typescript
public async importAllSettings(data: string, options?: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    memoryConfigImported: false,
    worldBookEntriesCount: 0,
    textOptimizationEntriesCount: 0,
    customPromptsCount: 0,
    tavernPresetsCount: 0,          // 新增
    errors: [],
  };

  try {
    const settings = JSON.parse(data) as GlobalSettings;

    // ... 现有导入逻辑 ...

    // 导入酒馆预设（新增）
    if (!options?.skipTavernPresets && settings.tavernPresets) {
      try {
        for (const preset of settings.tavernPresets) {
          await tavernPresetService.savePreset(preset);
          result.tavernPresetsCount++;
        }
        // 恢复激活状态
        if (settings.activeTavernPresetId) {
          await tavernPresetService.setActivePreset(settings.activeTavernPresetId);
        }
      } catch (error) {
        result.errors.push(`导入酒馆预设失败: ${error}`);
      }
    }

    // 注意：不导入 optimizedTextHistory，它应该随存档保存

  } catch (error) {
    result.success = false;
    result.errors.push(`解析JSON失败: ${error}`);
  }

  return result;
}
```

### 4. 更新下载方法

```typescript
public async downloadSettings(filename?: string): Promise<void> {
  const data = await this.exportAllSettings();  // 改为 await
  // ... 其余代码不变
}
```

### 5. 更新 UI 组件

在 [`GlobalSettingsManager.vue`](src/components/dashboard/prompt-management/GlobalSettingsManager.vue:163) 中：

```typescript
// 导出设置 - 改为异步
const exportSettings = async () => {
  await globalSettingsService.downloadSettings()
  toast.success('设置已导出')
}
```

导入选项对话框需要添加新选项：

```html
<label class="option-item">
  <input type="checkbox" v-model="importOptions.skipTavernPresets" />
  <span>跳过酒馆预设</span>
</label>
```

统计信息中添加：

```html
<div class="stat-card">
  <span class="stat-value">{{ stats.tavernPresetsCount }}</span>
  <span class="stat-label">酒馆预设</span>
</div>
```

---

## 实施步骤

### 第一步：更新服务层

1. 修改 [`globalSettingsService.ts`](src/services/globalSettingsService.ts)
   - 更新 `GlobalSettings` 接口
   - 更新 `ImportResult` 接口
   - 将 `exportAllSettings()` 改为异步方法
   - 更新 `importAllSettings()` 添加新字段处理
   - 更新 `downloadSettings()` 为异步
   - 导入 `tavernPresetService`

### 第二步：更新 UI 组件

1. 修改 [`GlobalSettingsManager.vue`](src/components/dashboard/prompt-management/GlobalSettingsManager.vue)
   - 更新 `exportSettings()` 为异步
   - 添加新的导入选项
   - 更新统计信息显示
   - 添加新的统计数据获取

### 第三步：测试

1. 测试导出功能
   - 验证酒馆预设是否正确导出
   - 验证激活状态是否正确保存

2. 测试导入功能
   - 验证酒馆预设是否正确导入
   - 验证激活状态是否正确恢复

3. 测试向后兼容性
   - 导入旧版本格式的设置文件

---

## 影响范围

- [`src/services/globalSettingsService.ts`](src/services/globalSettingsService.ts) - 核心修改
- [`src/components/dashboard/prompt-management/GlobalSettingsManager.vue`](src/components/dashboard/prompt-management/GlobalSettingsManager.vue) - UI 更新

## 向后兼容性

- 导入时检查版本号，对于版本 1.0 的文件跳过新字段
- 新字段都设为可选（`?`），确保旧文件可以正常导入

---

# 附加任务：优化正文历史迁移到存档

## 问题背景

当前优化正文历史存储在全局 localStorage 中（`text_optimization_history`），这导致：

- 不同存档共用同一份历史
- 切换存档后历史不匹配
- 可能导致AI生成风格不一致

## 迁移方案

### 1. 修改存储位置

将优化正文历史从 localStorage 迁移到存档数据中：

```typescript
// 在 saveData 中添加新字段
interface GameSaveData {
  // ... 现有字段 ...
  优化正文历史?: string[] // 新增：存档级别的优化历史
}
```

### 2. 修改 textOptimizationService

```typescript
class TextOptimizationService {
  private currentSaveId: string | null = null

  // 切换存档时调用
  switchSave(saveId: string, history: string[]): void {
    this.currentSaveId = saveId
    this.optimizedTextHistory = history
  }

  // 获取当前历史（供存档保存时使用）
  getCurrentHistory(): string[] {
    return [...this.optimizedTextHistory]
  }
}
```

### 3. 在存档加载/保存时同步

```typescript
// 加载存档时
const history = saveData.优化正文历史 || []
textOptimizationService.switchSave(saveId, history)

// 保存存档时
saveData.优化正文历史 = textOptimizationService.getCurrentHistory()
```

### 4. 迁移现有数据

首次运行时，检测并迁移旧数据：

```typescript
// 如果 localStorage 有历史数据且当前存档没有
if (localStorage.getItem('text_optimization_history') && !saveData.优化正文历史) {
  saveData.优化正文历史 = JSON.parse(localStorage.getItem('text_optimization_history'))
  localStorage.removeItem('text_optimization_history')
}
```

## 影响范围

- [`src/services/textOptimizationService.ts`](src/services/textOptimizationService.ts) - 修改存储逻辑
- [`src/stores/gameStateStore.ts`](src/stores/gameStateStore.ts) - 存档加载/保存时同步
- [`src/types/game.d.ts`](src/types/game.d.ts) - 添加类型定义
