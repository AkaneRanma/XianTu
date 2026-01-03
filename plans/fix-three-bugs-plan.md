# 三个Bug修复计划

## 问题概述

用户反馈了三个问题：

1. **UI缝隙问题**：正文阅读最上方的时间栏UI与上面的短期记忆UI框有缝隙
2. **重新优化正文流式UI问题**：点击"重新优化正文"后，不会进入流式传输显示UI，且两个重Roll按钮一直处于禁用状态
3. **变量重Roll数据问题**：变量重Roll后不会替换当前的变量数据，AI生成了错误的英文key路径

---

## 问题1：UI缝隙问题

### 现象

短期记忆区域（蓝色区域）与时间栏（显示日期如"2026-01-04 01:53:33"）之间有明显的间隙。

### 根本原因

CSS样式问题，需要检查 [`MainGamePanel.vue`](src/components/dashboard/MainGamePanel.vue) 中短期记忆区域和主阅读区域的样式定义。

### 修复方案

1. 检查短期记忆区域容器的 `margin-bottom` 或 `padding-bottom`
2. 检查主阅读区域容器的 `margin-top` 或 `padding-top`
3. 调整相关CSS样式消除间隙

### 涉及文件

- [`src/components/dashboard/MainGamePanel.vue`](src/components/dashboard/MainGamePanel.vue) - CSS样式部分

---

## 问题2：重新优化正文流式UI问题

### 现象

- 点击"重新优化正文"按钮后，不会显示流式传输UI
- 两个重Roll按钮（变量重Roll和正文重Roll）一直处于禁用状态，无法再次点击

### 根本原因分析

#### A. 流式UI不显示

在 [`MainGamePanel.vue:86-113`](src/components/dashboard/MainGamePanel.vue:86) 中，流式内容显示的条件是：

```vue
v-else-if="isAIProcessing && splitStep1Completed && (splitStep1Text ||
textOptimizationStreamingContent)"
```

这要求 `isAIProcessing` 和 `splitStep1Completed` 都为 `true`。但在执行 `rerollTextOptimization()` 时：

- `isAIProcessing` 没有被设置为 `true`
- `splitStep1Completed` 的状态可能不正确

#### B. 按钮持续禁用

在 [`MainGamePanel.vue:26`](src/components/dashboard/MainGamePanel.vue:26) 中，按钮禁用条件是：

```vue
:disabled="isRerollingStep2 || isRerollingOptimization || splitStep2InProgress ||
textOptimizationInProgress || isAIProcessing"
```

问题在于 [`uiStore.startRerollOptimization()`](src/stores/uiStore.ts) 和 [`completeRerollOptimization()`](src/stores/uiStore.ts) 方法没有正确管理这些状态。

### 修复方案

#### 修复 [`src/stores/uiStore.ts`](src/stores/uiStore.ts)

1. **`startRerollOptimization()` 方法** - 确保设置所有必要的状态：

   ```typescript
   startRerollOptimization() {
     this.isRerollingOptimization = true;
     this.textOptimizationInProgress = true;
     this.textOptimizationStreamingContent = ''; // 清空之前的内容
   }
   ```

2. **`completeRerollOptimization()` 方法** - 确保重置所有状态：
   ```typescript
   completeRerollOptimization(optimizedText: string) {
     this.isRerollingOptimization = false;
     this.textOptimizationInProgress = false;
     this.optimizedText = optimizedText;
     // 不要在这里清空 textOptimizationStreamingContent，让UI继续显示
   }
   ```

#### 修复 [`src/components/dashboard/MainGamePanel.vue`](src/components/dashboard/MainGamePanel.vue)

3. **流式UI显示条件** - 添加对 reroll 优化的支持：

   ```vue
   v-else-if="(isAIProcessing && splitStep1Completed && (splitStep1Text ||
   textOptimizationStreamingContent)) || (isRerollingOptimization &&
   textOptimizationStreamingContent)"
   ```

   或者使用专门的 reroll 优化显示逻辑。

### 涉及文件

- [`src/stores/uiStore.ts`](src/stores/uiStore.ts) - 状态管理方法
- [`src/components/dashboard/MainGamePanel.vue`](src/components/dashboard/MainGamePanel.vue) - UI条件逻辑

---

## 问题3：变量重Roll数据问题

### 现象

变量重Roll后，AI返回的 `tavern_commands` 使用了错误的英文key路径：

```json
{
  "tavern_commands": [
    { "action": "set", "key": "character.reputation.qingniu_town", "value": 50 },
    { "action": "set", "key": "character.items.recommendation_jade", "value": "李员外的引荐玉佩" },
    { "action": "set", "key": "world.next_destination", "value": "云梦城" },
    { "action": "set", "key": "world.main_event", "value": "凌霄剑宗招新大典" }
  ]
}
```

正确的key路径应该是中文格式，如：

- `玩家角色状态.声望`
- `背包.物品`
- `游戏世界.下一目的地`

### 根本原因分析

在 [`AIBidirectionalSystem.ts:2024-2046`](src/utils/AIBidirectionalSystem.ts:2024) 的 `rerollStep2()` 方法中，使用了一个**极度简化的提示词**：

```typescript
const step2RulesPrompt = `
# 分步生成（第2步）规则

你正在执行分步生成的第2步。

## 输出格式：
\`\`\`json
{
  "mid_term_memory": "简洁的记忆总结（1-2句话）",
  "tavern_commands": [
    {"action": "set", "key": "变量路径", "value": "值"}
  ],
  "action_options": ["选项1", "选项2", "选项3"]
}
\`\`\`
...
`.trim()
```

这个提示词**完全缺少了关键的 `dataDefinitions`（数据定义）**，导致AI不知道应该使用什么样的key路径格式。

相比之下，正常的 `processPlayerAction()` 中的 [`buildSplitSystemPrompt(2)`](src/utils/AIBidirectionalSystem.ts:339) 方法包含了完整的提示词组合：

```typescript
const [
  coreOutputRulesPrompt,
  businessRulesPrompt,
  dataDefinitionsPrompt,
  textFormatsPrompt,
  worldStandardsPrompt,
] = await Promise.all([
  getPrompt('coreOutputRules'),
  getPrompt('businessRules'),
  getPrompt('dataDefinitions'), // ← 关键！包含完整的中文key路径定义
  getPrompt('textFormatRules'),
  getPrompt('worldStandards'),
])
```

### 修复方案

重写 [`rerollStep2()`](src/utils/AIBidirectionalSystem.ts:2990) 方法，使用与 `processPlayerAction()` 中 `buildSplitSystemPrompt(2)` 相同的完整提示词构建逻辑：

```typescript
public async rerollStep2(): Promise<any> {
  const uiStore = useUIStore();
  const gameStateStore = useGameStateStore();
  const characterStore = useCharacterStore();
  const { aiService } = await import('@/services/aiService');

  // ... 检查逻辑保持不变 ...

  try {
    const tavernHelper = getTavernHelper();
    const tavernEnv = !!tavernHelper;

    // 🔥 使用与 processPlayerAction 相同的完整提示词构建
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

    // 处理 NSFW 内容过滤
    const sanitizedDataDefinitionsPrompt = tavernEnv
      ? dataDefinitionsPrompt
      : stripNsfwContent(dataDefinitionsPrompt);

    // 获取当前游戏状态
    const saveData = gameStateStore.toSaveData();
    const stateForAI = cloneDeep(saveData);
    // 移除不需要的字段
    if (stateForAI.记忆) {
      delete stateForAI.记忆.短期记忆;
      delete stateForAI.记忆.隐式中期记忆;
    }
    if (stateForAI.叙事历史) delete stateForAI.叙事历史;
    const stateJsonString = JSON.stringify(stateForAI);

    // 构建核心状态速览
    const coreStatusSummary = this._buildCoreStatusSummary(stateForAI);

    // 组装完整的系统提示词
    const sections: string[] = [
      stepRulesPrompt,
      coreOutputRulesPrompt,
      businessRulesPrompt,
      sanitizedDataDefinitionsPrompt,
      textFormatsPrompt,
      worldStandardsPrompt
    ];

    // 如果启用行动选项，添加相关提示词
    if (uiStore.enableActionOptions) {
      const actionOptionsPrompt = await getPrompt('actionOptions');
      sections.push(actionOptionsPrompt);
    }

    const assembledPrompt = sections.join('\n\n---\n\n');
    const systemPrompt = `
${assembledPrompt}

${coreStatusSummary}

# 游戏状态（JSON）
${stateJsonString}
`.trim();

    // ... 其余调用AI和处理响应的逻辑 ...
  }
}
```

### 涉及文件

- [`src/utils/AIBidirectionalSystem.ts`](src/utils/AIBidirectionalSystem.ts) - `rerollStep2()` 方法

---

## 修复优先级

| 优先级 | 问题                  | 复杂度 | 预估改动范围                  |
| ------ | --------------------- | ------ | ----------------------------- |
| 高     | 问题3：变量重Roll数据 | 中     | AIBidirectionalSystem.ts      |
| 高     | 问题2：重Roll按钮禁用 | 低     | uiStore.ts, MainGamePanel.vue |
| 中     | 问题2：流式UI不显示   | 低     | MainGamePanel.vue             |
| 低     | 问题1：UI缝隙         | 低     | MainGamePanel.vue CSS         |

---

## 实施步骤

### 步骤1：修复变量重Roll数据问题（问题3）

1. 在 `AIBidirectionalSystem.ts` 中重写 `rerollStep2()` 方法
2. 复用 `buildSplitSystemPrompt(2)` 的逻辑或将其提取为可复用的方法
3. 确保包含完整的 `dataDefinitions` 提示词

### 步骤2：修复重Roll状态管理（问题2-按钮禁用）

1. 检查并修复 `uiStore.ts` 中的 `startRerollOptimization()` 方法
2. 确保 `completeRerollOptimization()` 正确重置所有状态
3. 添加错误处理确保即使失败也能重置状态

### 步骤3：修复流式UI显示（问题2-流式UI）

1. 修改 `MainGamePanel.vue` 中的流式内容显示条件
2. 添加对 reroll 优化模式的支持

### 步骤4：修复UI缝隙（问题1）

1. 检查短期记忆区域和主内容区域的CSS样式
2. 调整 margin/padding 消除间隙

---

## 测试验证

### 问题1测试

- [ ] 检查短期记忆区域和时间栏之间无缝隙

### 问题2测试

- [ ] 点击"重新优化正文"按钮后显示流式内容
- [ ] 优化完成后两个重Roll按钮恢复可点击状态
- [ ] 优化失败时按钮也能恢复可点击状态

### 问题3测试

- [ ] 变量重Roll后生成正确的中文key路径
- [ ] 游戏状态正确更新
- [ ] 状态变更面板显示正确的变更记录
