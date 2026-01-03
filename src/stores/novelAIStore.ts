/**
 * Novel AI Store
 * 管理 Novel AI 图像生成的全局状态
 * 提供配置和预设的响应式访问
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { novelAIService } from '@/services/novelAIService';
import { imageCacheService } from '@/services/imageCacheService';
import type {
  NovelAIConfig,
  NovelAIPromptPreset,
  ImageCacheStats
} from '@/types/novelAI';
import { DEFAULT_NOVELAI_CONFIG } from '@/types/novelAI';

export const useNovelAIStore = defineStore('novelAI', () => {
  // ==================== 状态 ====================

  // 配置状态（响应式）
  const config = ref<NovelAIConfig>(novelAIService.getConfig());

  // 预设状态（响应式）- 使用数组
  const presets = ref<NovelAIPromptPreset[]>(novelAIService.getPresets());

  // 当前选中的预设名称
  const selectedPresetName = ref<string | null>(null);

  // 全局生成状态
  const isGenerating = ref(false);
  const activeGenerations = ref<Set<string>>(new Set());

  // 图片状态存储（持久化，不随组件卸载丢失）
  interface ImageState {
    loading: boolean;
    imageData: string | null;
    error: string | null;
  }
  const imageStates = ref<Record<string, ImageState>>({});

  // 缓存统计
  const cacheStats = ref<ImageCacheStats | null>(null);

  // ==================== 计算属性 ====================

  // 是否已配置 API Key
  const isConfigured = computed(() => !!config.value.apiKey);

  // 是否启用（已配置且有有效设置）
  const isEnabled = computed(() =>
    isConfigured.value && config.value.width > 0 && config.value.height > 0
  );

  // 当前选中的预设
  const selectedPreset = computed(() =>
    selectedPresetName.value
      ? presets.value.find(p => p.name === selectedPresetName.value) || null
      : null
  );

  // 预设列表（预设名称）
  const presetList = computed(() => presets.value.map(p => p.name));

  // 是否有任何正在进行的生成
  const hasActiveGenerations = computed(() => activeGenerations.value.size > 0);

  // 获取完整的正面提示词（包括预设的固定提示词）
  const getFullPositivePrompt = computed(() => {
    return (customTags: string) => {
      const preset = selectedPreset.value;
      let prompt = '';

      // 前置固定提示词
      if (preset?.fixedPrompt) {
        prompt += preset.fixedPrompt;
        if (!prompt.endsWith(',') && !prompt.endsWith('\n')) {
          prompt += ', ';
        }
      }

      // 用户自定义标签
      prompt += customTags;

      // 后置固定提示词
      if (preset?.fixedPrompt_end) {
        if (!prompt.endsWith(',') && !prompt.endsWith('\n')) {
          prompt += ', ';
        }
        prompt += preset.fixedPrompt_end;
      }

      return prompt.trim();
    };
  });

  // 获取负面提示词（优先使用预设的）
  const getNegativePrompt = computed(() => {
    return () => {
      const preset = selectedPreset.value;
      if (preset?.negativePrompt) {
        return preset.negativePrompt;
      }
      // 使用默认负面提示词
      return 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry';
    };
  });

  // ==================== 方法 ====================

  /**
   * 刷新配置（从 service 重新加载）
   */
  function refreshConfig() {
    config.value = novelAIService.getConfig();
    console.log('[novelAIStore] 配置已刷新');
  }

  /**
   * 保存配置
   */
  function saveConfig(newConfig: Partial<NovelAIConfig>) {
    const mergedConfig = { ...config.value, ...newConfig };
    novelAIService.saveConfig(mergedConfig);
    config.value = mergedConfig;
    console.log('[novelAIStore] 配置已保存');
  }

  /**
   * 重置配置为默认值
   */
  function resetConfig() {
    novelAIService.saveConfig(DEFAULT_NOVELAI_CONFIG);
    config.value = DEFAULT_NOVELAI_CONFIG;
    console.log('[novelAIStore] 配置已重置为默认值');
  }

  /**
   * 刷新预设（从 service 重新加载）
   */
  function refreshPresets() {
    presets.value = novelAIService.getPresets();
    console.log('[novelAIStore] 预设已刷新');
  }

  /**
   * 保存预设
   */
  function savePreset(preset: NovelAIPromptPreset) {
    novelAIService.savePreset(preset);
    refreshPresets();
    console.log('[novelAIStore] 预设已保存:', preset.name);
  }

  /**
   * 删除预设
   */
  function deletePreset(name: string) {
    novelAIService.deletePreset(name);
    if (selectedPresetName.value === name) {
      selectedPresetName.value = null;
    }
    refreshPresets();
    console.log('[novelAIStore] 预设已删除:', name);
  }

  /**
   * 选择预设
   */
  function selectPreset(name: string | null) {
    if (name && presets.value.some(p => p.name === name)) {
      selectedPresetName.value = name;
      console.log('[novelAIStore] 已选择预设:', name);
    } else {
      selectedPresetName.value = null;
      console.log('[novelAIStore] 已取消选择预设');
    }
  }

  /**
   * 获取图片状态
   */
  function getImageState(id: string): ImageState | null {
    return imageStates.value[id] || null;
  }

  /**
   * 设置图片状态
   */
  function setImageState(id: string, state: ImageState) {
    imageStates.value[id] = state;
  }

  /**
   * 清除图片状态
   */
  function clearImageState(id: string) {
    delete imageStates.value[id];
  }

  /**
   * 清除所有图片状态
   */
  function clearAllImageStates() {
    imageStates.value = {};
  }

  /**
   * 开始生成（注册生成任务）
   */
  function startGeneration(markerId: string) {
    activeGenerations.value.add(markerId);
    isGenerating.value = true;
    // 设置加载状态
    imageStates.value[markerId] = {
      loading: true,
      imageData: null,
      error: null
    };
    console.log('[novelAIStore] 开始生成:', markerId);
  }

  /**
   * 完成生成（注销生成任务）
   */
  function completeGeneration(markerId: string, success: boolean, data?: string, error?: string) {
    activeGenerations.value.delete(markerId);
    if (activeGenerations.value.size === 0) {
      isGenerating.value = false;
    }
    // 更新状态
    imageStates.value[markerId] = {
      loading: false,
      imageData: success ? (data || null) : null,
      error: success ? null : (error || '生成失败')
    };
    console.log('[novelAIStore] 完成生成:', markerId, success ? '成功' : '失败');
  }

  /**
   * 取消所有生成
   */
  function cancelAllGenerations() {
    activeGenerations.value.clear();
    isGenerating.value = false;
    console.log('[novelAIStore] 已取消所有生成');
  }

  /**
   * 刷新缓存统计
   */
  async function refreshCacheStats() {
    try {
      cacheStats.value = await imageCacheService.getStats();
      console.log('[novelAIStore] 缓存统计已刷新:', cacheStats.value);
    } catch (error) {
      console.error('[novelAIStore] 刷新缓存统计失败:', error);
    }
  }

  /**
   * 清除缓存
   */
  async function clearCache() {
    try {
      await imageCacheService.clearAll();
      await refreshCacheStats();
      console.log('[novelAIStore] 缓存已清除');
    } catch (error) {
      console.error('[novelAIStore] 清除缓存失败:', error);
      throw error;
    }
  }

  /**
   * 测试 API 连接
   */
  async function testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await novelAIService.testConnection();
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '连接测试失败'
      };
    }
  }

  /**
   * 导入预设（从文件内容）
   */
  function importPresets(jsonContent: string, mode: 'merge' | 'replace' = 'merge'): {
    success: boolean;
    imported: number;
    message: string
  } {
    try {
      const importedPresets = novelAIService.importPresets(jsonContent, mode);
      refreshPresets();
      return {
        success: true,
        imported: importedPresets.length,
        message: `成功导入 ${importedPresets.length} 个预设`
      };
    } catch (error) {
      return {
        success: false,
        imported: 0,
        message: error instanceof Error ? error.message : '导入失败'
      };
    }
  }

  /**
   * 导出预设（返回 JSON 字符串）
   */
  function exportPresets(): string {
    return novelAIService.exportPresets();
  }

  /**
   * 初始化 store（加载配置和预设）
   */
  async function initialize() {
    refreshConfig();
    refreshPresets();
    await refreshCacheStats();

    // 如果有预设，默认选中第一个
    if (presets.value.length > 0 && !selectedPresetName.value) {
      selectedPresetName.value = presets.value[0].name;
    }

    console.log('[novelAIStore] 初始化完成');
  }

  // ==================== 返回 ====================

  return {
    // 状态
    config,
    presets,
    selectedPresetName,
    isGenerating,
    activeGenerations,
    imageStates,
    cacheStats,

    // 计算属性
    isConfigured,
    isEnabled,
    selectedPreset,
    presetList,
    hasActiveGenerations,
    getFullPositivePrompt,
    getNegativePrompt,

    // 配置方法
    refreshConfig,
    saveConfig,
    resetConfig,

    // 预设方法
    refreshPresets,
    savePreset,
    deletePreset,
    selectPreset,
    importPresets,
    exportPresets,

    // 图片状态方法
    getImageState,
    setImageState,
    clearImageState,
    clearAllImageStates,

    // 生成状态方法
    startGeneration,
    completeGeneration,
    cancelAllGenerations,

    // 缓存方法
    refreshCacheStats,
    clearCache,

    // 工具方法
    testConnection,
    initialize,
  };
});
