
<template>
  <div v-if="open" class="overlay" @click.self="close">
    <div class="modal" @click.stop>
      <div class="header">
        <div class="title">
          <h3>API 配置中心</h3>
          <p class="subtitle">配置正文生成、变量生成、正文优化的独立API</p>
        </div>
        <button class="icon-btn" @click="close" aria-label="关闭">×</button>
      </div>

      <div class="body">
        <!-- Tab 切换 -->
        <div class="tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'text' }"
            @click="activeTab = 'text'"
          >
            <span class="tab-icon">📝</span>
            <span class="tab-label">正文生成</span>
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'variable' }"
            @click="activeTab = 'variable'"
          >
            <span class="tab-icon">📊</span>
            <span class="tab-label">变量生成</span>
            <span v-if="draftConfig.step2API?.enabled" class="tab-badge">独立</span>
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'optimization' }"
            @click="activeTab = 'optimization'"
          >
            <span class="tab-icon">✨</span>
            <span class="tab-label">正文优化</span>
            <span v-if="draftConfig.textOptimizationAPI?.enabled" class="tab-badge">独立</span>
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'novelai' }"
            @click="activeTab = 'novelai'"
          >
            <span class="tab-icon">🎨</span>
            <span class="tab-label">图像生成</span>
            <span v-if="novelAIConfig.enabled" class="tab-badge">已启用</span>
          </button>
        </div>

        <!-- Tab 内容 -->
        <div class="tab-content">
          <!-- 正文生成配置 -->
          <div v-if="activeTab === 'text'" class="config-section">
            <div class="section-hint">
              <span class="hint-icon">💡</span>
              <span>主API配置，用于生成正文内容</span>
            </div>

            <div class="config-row">
              <label class="config-label">API提供商</label>
              <select v-model="draftConfig.customAPI!.provider" class="config-select" @change="onProviderChange('text')">
                <option value="openai">OpenAI</option>
                <option value="claude">Claude</option>
                <option value="gemini">Gemini</option>
                <option value="deepseek">DeepSeek</option>
                <option value="custom">自定义(OpenAI兼容)</option>
              </select>
            </div>

            <div class="config-row">
              <label class="config-label">API地址</label>
              <input
                v-model="draftConfig.customAPI!.url"
                class="config-input"
                :placeholder="getDefaultUrl('text')"
              />
            </div>

            <div class="config-row">
              <label class="config-label">API密钥</label>
              <input
                v-model="draftConfig.customAPI!.apiKey"
                type="password"
                class="config-input"
                placeholder="sk-..."
              />
            </div>

            <div class="config-row">
              <label class="config-label">模型名称</label>
              <div class="config-row-inline">
                <select v-model="draftConfig.customAPI!.model" class="config-select">
                  <option v-for="model in textModels" :key="model" :value="model">{{ model }}</option>
                </select>
                <button class="btn-icon" @click="fetchModels('text')" :disabled="fetchingTextModels">
                  <span :class="{ 'spin': fetchingTextModels }">🔄</span>
                </button>
              </div>
            </div>

            <div class="config-row">
              <label class="config-label">温度 ({{ draftConfig.customAPI!.temperature }})</label>
              <input
                type="range"
                v-model.number="draftConfig.customAPI!.temperature"
                min="0" max="2" step="0.1"
                class="config-range"
              />
            </div>

            <div class="config-row">
              <label class="config-label">最大Token数</label>
              <input
                v-model.number="draftConfig.customAPI!.maxTokens"
                type="number"
                class="config-input"
                placeholder="16000"
                min="100" max="128000"
              />
            </div>

            <!-- 高级采样参数 -->
            <div class="config-group-title">高级采样参数</div>

            <div class="config-row">
              <label class="config-label">Top P ({{ draftConfig.customAPI!.topP?.toFixed(2) ?? '0.98' }})</label>
              <input
                type="range"
                v-model.number="draftConfig.customAPI!.topP"
                min="0" max="1" step="0.01"
                class="config-range"
              />
            </div>

            <div class="config-row">
              <label class="config-label">Top K</label>
              <input
                v-model.number="draftConfig.customAPI!.topK"
                type="number"
                class="config-input config-input-short"
                placeholder="500"
                min="0" max="10000"
              />
            </div>

            <div class="config-row">
              <label class="config-label">Frequency Penalty ({{ draftConfig.customAPI!.frequencyPenalty?.toFixed(1) ?? '0' }})</label>
              <input
                type="range"
                v-model.number="draftConfig.customAPI!.frequencyPenalty"
                min="-2" max="2" step="0.1"
                class="config-range"
              />
            </div>

            <div class="config-row">
              <label class="config-label">Presence Penalty ({{ draftConfig.customAPI!.presencePenalty?.toFixed(1) ?? '0' }})</label>
              <input
                type="range"
                v-model.number="draftConfig.customAPI!.presencePenalty"
                min="-2" max="2" step="0.1"
                class="config-range"
              />
            </div>

            <div class="config-row">
              <button class="btn-test" @click="testAPI('text')" :disabled="testingText">
                {{ testingText ? '测试中...' : '🧪 测试连接' }}
              </button>
              <span v-if="testResults.text === 'success'" class="test-result success">✓ 成功</span>
              <span v-else-if="testResults.text === 'fail'" class="test-result fail">✗ 失败</span>
            </div>
          </div>

          <!-- 变量生成配置 -->
          <div v-if="activeTab === 'variable'" class="config-section">
            <div class="section-hint">
              <span class="hint-icon">💡</span>
              <span>分步生成第2步（结构化数据）的独立API配置</span>
            </div>

            <div class="config-row">
              <label class="config-label">启用独立配置</label>
              <label class="switch">
                <input type="checkbox" v-model="draftConfig.step2API!.enabled" />
                <span class="slider"></span>
              </label>
            </div>

            <template v-if="draftConfig.step2API?.enabled">
              <div class="config-row">
                <label class="config-label">API提供商</label>
                <select v-model="draftConfig.step2API!.provider" class="config-select" @change="onProviderChange('variable')">
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                  <option value="gemini">Gemini</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="custom">自定义(OpenAI兼容)</option>
                </select>
              </div>

              <div class="config-row">
                <label class="config-label">API地址</label>
                <input
                  v-model="draftConfig.step2API!.url"
                  class="config-input"
                  :placeholder="getDefaultUrl('variable')"
                />
              </div>

              <div class="config-row">
                <label class="config-label">API密钥</label>
                <input
                  v-model="draftConfig.step2API!.apiKey"
                  type="password"
                  class="config-input"
                  placeholder="留空使用主API密钥"
                />
              </div>

              <div class="config-row">
                <label class="config-label">模型名称</label>
                <div class="config-row-inline">
                  <select v-model="draftConfig.step2API!.model" class="config-select">
                    <option v-for="model in variableModels" :key="model" :value="model">{{ model }}</option>
                  </select>
                  <button class="btn-icon" @click="fetchModels('variable')" :disabled="fetchingVariableModels">
                    <span :class="{ 'spin': fetchingVariableModels }">🔄</span>
                  </button>
                </div>
              </div>

              <div class="config-row">
                <label class="config-label">温度 ({{ draftConfig.step2API!.temperature }})</label>
                <input
                  type="range"
                  v-model.number="draftConfig.step2API!.temperature"
                  min="0" max="2" step="0.1"
                  class="config-range"
                />
              </div>

              <div class="config-row">
                <label class="config-label">最大Token数</label>
                <input
                  v-model.number="draftConfig.step2API!.maxTokens"
                  type="number"
                  class="config-input"
                  placeholder="4000"
                  min="100" max="32000"
                />
              </div>

              <div class="config-row">
                <button class="btn-test" @click="testAPI('variable')" :disabled="testingVariable">
                  {{ testingVariable ? '测试中...' : '🧪 测试连接' }}
                </button>
                <span v-if="testResults.variable === 'success'" class="test-result success">✓ 成功</span>
                <span v-else-if="testResults.variable === 'fail'" class="test-result fail">✗ 失败</span>
              </div>
            </template>

            <div v-else class="disabled-hint">
              启用后可为变量生成配置独立的API，适合使用更快更便宜的模型
            </div>
          </div>

          <!-- 正文优化配置 -->
          <div v-if="activeTab === 'optimization'" class="config-section">
            <div class="section-hint">
              <span class="hint-icon">💡</span>
              <span>正文生成后进行优化处理的API配置（与变量生成并行）</span>
            </div>

            <div class="config-row">
              <label class="config-label">启用正文优化</label>
              <label class="switch">
                <input type="checkbox" v-model="draftConfig.textOptimizationAPI!.enabled" />
                <span class="slider"></span>
              </label>
            </div>

            <template v-if="draftConfig.textOptimizationAPI?.enabled">
              <div class="config-row">
                <label class="config-label">API提供商</label>
                <select v-model="draftConfig.textOptimizationAPI!.provider" class="config-select" @change="onProviderChange('optimization')">
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                  <option value="gemini">Gemini</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="custom">自定义(OpenAI兼容)</option>
                </select>
              </div>

              <div class="config-row">
                <label class="config-label">API地址</label>
                <input
                  v-model="draftConfig.textOptimizationAPI!.url"
                  class="config-input"
                  :placeholder="getDefaultUrl('optimization')"
                />
              </div>

              <div class="config-row">
                <label class="config-label">API密钥</label>
                <input
                  v-model="draftConfig.textOptimizationAPI!.apiKey"
                  type="password"
                  class="config-input"
                  placeholder="留空使用主API密钥"
                />
              </div>

              <div class="config-row">
                <label class="config-label">模型名称</label>
                <div class="config-row-inline">
                  <select v-model="draftConfig.textOptimizationAPI!.model" class="config-select">
                    <option v-for="model in optimizationModels" :key="model" :value="model">{{ model }}</option>
                  </select>
                  <button class="btn-icon" @click="fetchModels('optimization')" :disabled="fetchingOptimizationModels">
                    <span :class="{ 'spin': fetchingOptimizationModels }">🔄</span>
                  </button>
                </div>
              </div>

              <div class="config-row">
                <label class="config-label">温度 ({{ draftConfig.textOptimizationAPI!.temperature }})</label>
                <input
                  type="range"
                  v-model.number="draftConfig.textOptimizationAPI!.temperature"
                  min="0" max="2" step="0.1"
                  class="config-range"
                />
              </div>

              <div class="config-row">
                <label class="config-label">最大Token数</label>
                <input
                  v-model.number="draftConfig.textOptimizationAPI!.maxTokens"
                  type="number"
                  class="config-input"
                  placeholder="8000"
                  min="100" max="32000"
                />
              </div>

              <div class="config-row">
                <button class="btn-test" @click="testAPI('optimization')" :disabled="testingOptimization">
                  {{ testingOptimization ? '测试中...' : '🧪 测试连接' }}
                </button>
                <span v-if="testResults.optimization === 'success'" class="test-result success">✓ 成功</span>
                <span v-else-if="testResults.optimization === 'fail'" class="test-result fail">✗ 失败</span>
              </div>
            </template>

            <div v-else class="disabled-hint">
              启用后可对AI生成的正文进行优化处理，支持流式输出
            </div>
          </div>

          <!-- Novel AI 图像生成配置 -->
          <div v-if="activeTab === 'novelai'" class="config-section">
            <div class="section-hint">
              <span class="hint-icon">💡</span>
              <span>配置 Novel AI 文生图功能，支持在正文中生成图片</span>
            </div>

            <div class="config-row">
              <label class="config-label">启用图像生成</label>
              <label class="switch">
                <input type="checkbox" v-model="novelAIConfig.enabled" />
                <span class="slider"></span>
              </label>
            </div>

            <template v-if="novelAIConfig.enabled">
              <!-- 模型与接口 -->
              <div class="config-group-title">模型与接口</div>

              <div class="config-row">
                <label class="config-label">API Key</label>
                <input
                  v-model="novelAIConfig.apiKey"
                  type="password"
                  class="config-input"
                  placeholder="pst-..."
                />
              </div>

              <div class="config-row">
                <label class="config-label">站点</label>
                <select v-model="novelAIConfig.site" class="config-select">
                  <option value="official">官网 (api.novelai.net)</option>
                  <option value="custom">自定义</option>
                </select>
              </div>

              <div v-if="novelAIConfig.site === 'custom'" class="config-row">
                <label class="config-label">自定义URL</label>
                <input
                  v-model="novelAIConfig.customUrl"
                  class="config-input"
                  placeholder="https://your-api-url.com"
                />
              </div>

              <div class="config-row">
                <label class="config-label">模型</label>
                <select v-model="novelAIConfig.model" class="config-select">
                  <option v-for="model in novelAIModels" :key="model.value" :value="model.value">
                    {{ model.label }}
                  </option>
                </select>
              </div>

              <!-- 采样与算法 -->
              <div class="config-group-title">采样与算法</div>

              <div class="config-row">
                <label class="config-label">采样方法</label>
                <select v-model="novelAIConfig.sampler" class="config-select">
                  <option v-for="sampler in novelAISamplers" :key="sampler.value" :value="sampler.value">
                    {{ sampler.label }}
                  </option>
                </select>
              </div>

              <div class="config-row">
                <label class="config-label">噪点表</label>
                <select v-model="novelAIConfig.noiseSchedule" class="config-select">
                  <option v-for="schedule in novelAINoiseSchedules" :key="schedule.value" :value="schedule.value">
                    {{ schedule.label }}
                  </option>
                </select>
              </div>

              <div class="config-row">
                <label class="config-label">提示词引导 ({{ novelAIConfig.promptGuidance.toFixed(1) }})</label>
                <input
                  type="range"
                  v-model.number="novelAIConfig.promptGuidance"
                  min="0" max="10" step="0.1"
                  class="config-range"
                />
              </div>

              <div class="config-row">
                <label class="config-label">多样性 (SMEA)</label>
                <label class="switch">
                  <input type="checkbox" v-model="novelAIConfig.variety" />
                  <span class="slider"></span>
                </label>
              </div>

              <div class="config-row">
                <label class="config-label">AI 默认角色位置</label>
                <label class="switch">
                  <input type="checkbox" v-model="novelAIConfig.aiDefaultPosition" />
                  <span class="slider"></span>
                </label>
                <span class="config-hint-inline">开启后 AI 将自动调整角色位置</span>
              </div>

              <!-- 尺寸与比例 -->
              <div class="config-group-title">尺寸与比例</div>

              <div class="config-row">
                <label class="config-label">预设尺寸</label>
                <select v-model="novelAIConfig.sizePreset" class="config-select" @change="onSizePresetChange">
                  <option v-for="preset in novelAISizePresets" :key="preset.value" :value="preset.value">
                    {{ preset.label }}
                  </option>
                </select>
              </div>

              <div class="config-row">
                <label class="config-label">宽度</label>
                <input
                  v-model.number="novelAIConfig.width"
                  type="number"
                  class="config-input config-input-short"
                  min="64" max="2048" step="64"
                  :disabled="novelAIConfig.sizePreset !== 'custom'"
                />
              </div>

              <div class="config-row">
                <label class="config-label">高度</label>
                <input
                  v-model.number="novelAIConfig.height"
                  type="number"
                  class="config-input config-input-short"
                  min="64" max="2048" step="64"
                  :disabled="novelAIConfig.sizePreset !== 'custom'"
                />
              </div>

              <!-- 渲染控制 -->
              <div class="config-group-title">渲染控制</div>

              <div class="config-row">
                <label class="config-label">生成步数 ({{ novelAIConfig.steps }})</label>
                <input
                  type="range"
                  v-model.number="novelAIConfig.steps"
                  min="1" max="50" step="1"
                  class="config-range"
                />
              </div>

              <div class="config-row">
                <label class="config-label">种子</label>
                <input
                  v-model.number="novelAIConfig.seed"
                  type="number"
                  class="config-input config-input-short"
                  min="0"
                  placeholder="0 = 随机"
                />
              </div>

              <!-- 标记设置 -->
              <div class="config-group-title">标记设置</div>

              <div class="config-row">
                <label class="config-label">开始标记</label>
                <input
                  v-model="novelAIConfig.startMarker"
                  class="config-input config-input-short"
                  placeholder="image###"
                />
              </div>

              <div class="config-row">
                <label class="config-label">结束标记</label>
                <input
                  v-model="novelAIConfig.endMarker"
                  class="config-input config-input-short"
                  placeholder="###"
                />
              </div>

              <div class="config-row">
                <label class="config-label">自动生成</label>
                <label class="switch">
                  <input type="checkbox" v-model="novelAIConfig.autoGenerate" />
                  <span class="slider"></span>
                </label>
                <span class="config-hint-inline">检测到标记时自动生成图片</span>
              </div>

              <!-- 提示词预设 -->
              <div class="config-group-title">提示词预设</div>

              <div class="config-row">
                <label class="config-label">当前预设</label>
                <div class="config-row-inline">
                  <select v-model="novelAIConfig.currentPreset" class="config-select">
                    <option value="">无预设</option>
                    <option v-for="preset in novelAIPresets" :key="preset.name" :value="preset.name">
                      {{ preset.name }}
                    </option>
                  </select>
                  <button class="btn-icon" @click="showPresetModal = true" title="管理预设">
                    ⚙️
                  </button>
                </div>
              </div>

              <!-- 测试连接 -->
              <div class="config-row">
                <button class="btn-test" @click="testNovelAIConnection" :disabled="testingNovelAI">
                  {{ testingNovelAI ? '测试中...' : '🧪 测试连接' }}
                </button>
                <span v-if="testResults.novelai === 'success'" class="test-result success">✓ 成功</span>
                <span v-else-if="testResults.novelai === 'fail'" class="test-result fail">✗ 失败</span>
              </div>

              <!-- 缓存管理 -->
              <div class="config-group-title">缓存管理</div>

              <div class="cache-stats">
                <div class="cache-stat-item">
                  <span class="cache-stat-label">已缓存图片</span>
                  <span class="cache-stat-value">{{ cacheStats.totalEntries }} 张</span>
                </div>
                <div class="cache-stat-item">
                  <span class="cache-stat-label">缓存大小</span>
                  <span class="cache-stat-value">{{ formatCacheSize(cacheStats.totalSize) }} / 100 MB</span>
                </div>
                <div v-if="cacheStats.oldestEntry" class="cache-stat-item">
                  <span class="cache-stat-label">最早缓存</span>
                  <span class="cache-stat-value">{{ formatDate(cacheStats.oldestEntry) }}</span>
                </div>
              </div>

              <div class="config-row">
                <button class="btn-secondary-small" @click="cleanExpiredCache">
                  清理过期缓存
                </button>
                <button class="btn-danger-small" @click="clearAllCache">
                  清空所有缓存
                </button>
              </div>
            </template>

            <div v-else class="disabled-hint">
              启用后可使用 Novel AI 在正文中生成图片，支持标记触发和缓存
            </div>
          </div>
        </div>
      </div>

      <div class="footer">
        <button class="btn btn-secondary" @click="close">取消</button>
        <button class="btn btn-primary" @click="save">保存</button>
      </div>
    </div>

    <!-- Novel AI 预设管理弹窗 -->
    <NovelAIPresetModal
      :open="showPresetModal"
      @close="showPresetModal = false"
      @update="onPresetUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted } from 'vue';
import { aiService, API_PROVIDER_PRESETS, type AIConfig, type APIProvider } from '@/services/aiService';
import { textOptimizationService } from '@/services/textOptimizationService';
import { novelAIService } from '@/services/novelAIService';
import { imageCacheService } from '@/services/imageCacheService';
import { toast } from '@/utils/toast';
import NovelAIPresetModal from '@/components/common/NovelAIPresetModal.vue';
import type { NovelAIConfig, NovelAIPromptPreset, ImageCacheStats } from '@/types/novelAI';
import {
  NOVELAI_MODELS,
  NOVELAI_SAMPLERS,
  NOVELAI_NOISE_SCHEDULES,
  NOVELAI_SIZE_PRESETS,
  DEFAULT_NOVELAI_CONFIG
} from '@/types/novelAI';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', config: AIConfig): void;
}>();

// 当前激活的Tab
const activeTab = ref<'text' | 'variable' | 'optimization' | 'novelai'>('text');

// 草稿配置
const draftConfig = reactive<AIConfig>({
  mode: 'custom',
  streaming: true,
  customAPI: {
    provider: 'openai',
    url: '',
    apiKey: '',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 16000,
    topP: 0.98,
    topK: 500,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  step2API: {
    enabled: false,
    provider: 'openai',
    url: '',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 4000,
  },
  textOptimizationAPI: {
    enabled: false,
    provider: 'openai',
    url: '',
    apiKey: '',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 8000,
  },
});

// 模型列表
const textModels = ref<string[]>(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']);
const variableModels = ref<string[]>(['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']);
const optimizationModels = ref<string[]>(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']);

// 加载状态
const fetchingTextModels = ref(false);
const fetchingVariableModels = ref(false);
const fetchingOptimizationModels = ref(false);

// 测试状态
const testingText = ref(false);
const testingVariable = ref(false);
const testingOptimization = ref(false);
const testingNovelAI = ref(false);
const testResults = reactive<{ text: string; variable: string; optimization: string; novelai: string }>({
  text: '',
  variable: '',
  optimization: '',
  novelai: '',
});

// Novel AI 配置
const novelAIConfig = reactive<NovelAIConfig>({ ...DEFAULT_NOVELAI_CONFIG });
const novelAIPresets = ref<NovelAIPromptPreset[]>([]);
const showPresetModal = ref(false);

// Novel AI 选项
const novelAIModels = NOVELAI_MODELS;
const novelAISamplers = NOVELAI_SAMPLERS;
const novelAINoiseSchedules = NOVELAI_NOISE_SCHEDULES;
const novelAISizePresets = NOVELAI_SIZE_PRESETS;

// 缓存统计
const cacheStats = reactive<ImageCacheStats>({
  totalEntries: 0,
  totalSize: 0,
  oldestEntry: null
});

// 监听弹窗打开，加载配置
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    const config = aiService.getConfig();
    Object.assign(draftConfig, JSON.parse(JSON.stringify(config)));

    // 确保所有配置对象存在
    if (!draftConfig.customAPI) {
      draftConfig.customAPI = {
        provider: 'openai',
        url: '',
        apiKey: '',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 16000,
        topP: 0.98,
        topK: 500,
        frequencyPenalty: 0,
        presencePenalty: 0,
      };
    } else {
      // 确保新增字段有默认值
      if (draftConfig.customAPI.topP === undefined) draftConfig.customAPI.topP = 0.98;
      if (draftConfig.customAPI.topK === undefined) draftConfig.customAPI.topK = 500;
      if (draftConfig.customAPI.frequencyPenalty === undefined) draftConfig.customAPI.frequencyPenalty = 0;
      if (draftConfig.customAPI.presencePenalty === undefined) draftConfig.customAPI.presencePenalty = 0;
    }
    if (!draftConfig.step2API) {
      draftConfig.step2API = {
        enabled: false,
        provider: 'openai',
        url: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 4000,
      };
    }
    if (!draftConfig.textOptimizationAPI) {
      draftConfig.textOptimizationAPI = {
        enabled: false,
        provider: 'openai',
        url: '',
        apiKey: '',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 8000,
      };
    }

    // 🔥 同步 textOptimizationService 的启用状态到配置中
    // 确保 UI 显示的状态与实际服务状态一致
    if (draftConfig.textOptimizationAPI) {
      draftConfig.textOptimizationAPI.enabled = textOptimizationService.isEnabled();
    }

    // 加载 Novel AI 配置
    const naiConfig = novelAIService.getConfig();
    Object.assign(novelAIConfig, naiConfig);
    novelAIPresets.value = novelAIService.getPresets();

    // 加载缓存统计
    await loadCacheStats();

    // 重置测试结果
    testResults.text = '';
    testResults.variable = '';
    testResults.optimization = '';
    testResults.novelai = '';

    // 加载保存的模型列表
    loadSavedModels();
  }
}, { immediate: true });

// 加载保存的模型列表
function loadSavedModels() {
  try {
    const savedText = localStorage.getItem('ai_available_models');
    if (savedText) {
      textModels.value = JSON.parse(savedText);
    }
    const savedVariable = localStorage.getItem('ai_step2_available_models');
    if (savedVariable) {
      variableModels.value = JSON.parse(savedVariable);
    }
    const savedOptimization = localStorage.getItem('ai_optimization_available_models');
    if (savedOptimization) {
      optimizationModels.value = JSON.parse(savedOptimization);
    }
  } catch (e) {
    console.warn('加载模型列表失败:', e);
  }
}

// 获取默认URL
function getDefaultUrl(type: 'text' | 'variable' | 'optimization'): string {
  let provider: APIProvider = 'openai';
  if (type === 'text') {
    provider = draftConfig.customAPI?.provider || 'openai';
  } else if (type === 'variable') {
    provider = draftConfig.step2API?.provider || 'openai';
  } else {
    provider = draftConfig.textOptimizationAPI?.provider || 'openai';
  }
  return API_PROVIDER_PRESETS[provider]?.url || 'https://api.openai.com';
}

// 提供商切换处理
function onProviderChange(type: 'text' | 'variable' | 'optimization') {
  const presets = API_PROVIDER_PRESETS;

  if (type === 'text' && draftConfig.customAPI) {
    const preset = presets[draftConfig.customAPI.provider];
    if (preset && draftConfig.customAPI.provider !== 'custom') {
      draftConfig.customAPI.url = preset.url;
      draftConfig.customAPI.model = preset.defaultModel;
      textModels.value = [preset.defaultModel];
    }
  } else if (type === 'variable' && draftConfig.step2API) {
    const preset = presets[draftConfig.step2API.provider];
    if (preset && draftConfig.step2API.provider !== 'custom') {
      draftConfig.step2API.url = preset.url;
      draftConfig.step2API.model = preset.defaultModel;
      variableModels.value = [preset.defaultModel];
    }
  } else if (type === 'optimization' && draftConfig.textOptimizationAPI) {
    const preset = presets[draftConfig.textOptimizationAPI.provider];
    if (preset && draftConfig.textOptimizationAPI.provider !== 'custom') {
      draftConfig.textOptimizationAPI.url = preset.url;
      draftConfig.textOptimizationAPI.model = preset.defaultModel;
      optimizationModels.value = [preset.defaultModel];
    }
  }
}

// 获取模型列表
async function fetchModels(type: 'text' | 'variable' | 'optimization') {
  let url = '';
  let apiKey = '';

  if (type === 'text') {
    fetchingTextModels.value = true;
    url = draftConfig.customAPI?.url || getDefaultUrl('text');
    apiKey = draftConfig.customAPI?.apiKey || '';
  } else if (type === 'variable') {
    fetchingVariableModels.value = true;
    url = draftConfig.step2API?.url || getDefaultUrl('variable');
    apiKey = draftConfig.step2API?.apiKey || draftConfig.customAPI?.apiKey || '';
  } else {
    fetchingOptimizationModels.value = true;
    url = draftConfig.textOptimizationAPI?.url || getDefaultUrl('optimization');
    apiKey = draftConfig.textOptimizationAPI?.apiKey || draftConfig.customAPI?.apiKey || '';
  }

  try {
    if (!url || !apiKey) {
      throw new Error('请先配置API地址和密钥');
    }

    const modelsUrl = url.replace(/\/v1\/?$/, '').replace(/\/+$/, '') + '/v1/models';
    const response = await fetch(modelsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`获取模型失败: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data?.map((m: any) => m.id) || [];

    if (models.length > 0) {
      if (type === 'text') {
        textModels.value = models;
        localStorage.setItem('ai_available_models', JSON.stringify(models));
      } else if (type === 'variable') {
        variableModels.value = models;
        localStorage.setItem('ai_step2_available_models', JSON.stringify(models));
      } else {
        optimizationModels.value = models;
        localStorage.setItem('ai_optimization_available_models', JSON.stringify(models));
      }
      toast.success(`成功获取 ${models.length} 个模型`);
    } else {
      toast.warning('未获取到模型列表');
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '获取模型失败');
  } finally {
    fetchingTextModels.value = false;
    fetchingVariableModels.value = false;
    fetchingOptimizationModels.value = false;
  }
}

// 测试API连接
async function testAPI(type: 'text' | 'variable' | 'optimization') {
  const testToken = '仙途本-连通测试-OK';

  if (type === 'text') testingText.value = true;
  else if (type === 'variable') testingVariable.value = true;
  else testingOptimization.value = true;

  testResults[type] = '';

  try {
    // 临时保存配置
    const originalConfig = aiService.getConfig();
    aiService.saveConfig(draftConfig);

    const prompt = `你正在进行AI API连通性测试。请仅输出以下字符串：${testToken}`;

    let response: string;
    if (type === 'text') {
      response = await aiService.generate({
        user_input: prompt,
        should_stream: false,
        generation_id: `api_test_${Date.now()}`,
      });
    } else if (type === 'variable') {
      response = await aiService.generateWithStep2Config({
        user_input: prompt,
        should_stream: false,
        generation_id: `api_test_${Date.now()}`,
      });
    } else {
      response = await aiService.generateWithTextOptimizationConfig({
        user_input: prompt,
        should_stream: false,
        generation_id: `api_test_${Date.now()}`,
      });
    }

    // 恢复原配置
    aiService.saveConfig(originalConfig);

    const normalized = response.toLowerCase().replace(/[\s\-_]/g, '');
    if (normalized.includes(testToken.toLowerCase().replace(/[\s\-_]/g, ''))) {
      testResults[type] = 'success';
      toast.success(`${type === 'text' ? '正文' : type === 'variable' ? '变量' : '优化'}API测试成功`);
    } else {
      throw new Error('未检测到预期响应');
    }
  } catch (error) {
    testResults[type] = 'fail';
    toast.error(`API测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    testingText.value = false;
    testingVariable.value = false;
    testingOptimization.value = false;
  }
}

// Novel AI 尺寸预设变更
function onSizePresetChange() {
  const preset = NOVELAI_SIZE_PRESETS.find(p => p.value === novelAIConfig.sizePreset);
  if (preset && preset.value !== 'custom') {
    novelAIConfig.width = preset.width;
    novelAIConfig.height = preset.height;
  }
}

// 测试 Novel AI 连接
async function testNovelAIConnection() {
  testingNovelAI.value = true;
  testResults.novelai = '';

  try {
    // 临时保存配置
    novelAIService.saveConfig(novelAIConfig);

    const result = await novelAIService.testConnection();

    if (result.success) {
      testResults.novelai = 'success';
      toast.success('Novel AI 连接测试成功');
    } else {
      testResults.novelai = 'fail';
      toast.error(`Novel AI 测试失败: ${result.message}`);
    }
  } catch (error) {
    testResults.novelai = 'fail';
    toast.error(`Novel AI 测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    testingNovelAI.value = false;
  }
}

// 加载缓存统计
async function loadCacheStats() {
  try {
    const stats = await imageCacheService.getStats();
    cacheStats.totalEntries = stats.totalEntries;
    cacheStats.totalSize = stats.totalSize;
    cacheStats.oldestEntry = stats.oldestEntry;
  } catch (e) {
    console.warn('加载缓存统计失败:', e);
  }
}

// 清理过期缓存
async function cleanExpiredCache() {
  try {
    const count = await imageCacheService.cleanExpired();
    await loadCacheStats();
    toast.success(`已清理 ${count} 个过期缓存`);
  } catch (e) {
    toast.error('清理缓存失败');
  }
}

// 清空所有缓存
async function clearAllCache() {
  if (!confirm('确定要清空所有图片缓存吗？此操作不可恢复。')) {
    return;
  }

  try {
    await imageCacheService.clearAll();
    await loadCacheStats();
    toast.success('已清空所有缓存');
  } catch (e) {
    toast.error('清空缓存失败');
  }
}

// 格式化缓存大小
function formatCacheSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 格式化日期
function formatDate(date: Date | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('zh-CN');
}

// 预设更新回调
function onPresetUpdate() {
  novelAIPresets.value = novelAIService.getPresets();
}

// 关闭弹窗
function close() {
  emit('close');
}

// 保存配置
function save() {
  aiService.saveConfig(draftConfig);

  // 🔥 同步正文优化启用状态到 textOptimizationService
  // 确保 APIConfigModal 中的开关与 textOptimizationService 的启用状态一致
  if (draftConfig.textOptimizationAPI) {
    textOptimizationService.setEnabled(draftConfig.textOptimizationAPI.enabled);
    console.log('[API配置] 同步正文优化启用状态:', draftConfig.textOptimizationAPI.enabled);
  }

  // 保存 Novel AI 配置
  novelAIService.saveConfig(novelAIConfig);
  console.log('[API配置] Novel AI 配置已保存:', novelAIConfig.enabled);

  emit('save', draftConfig);
  emit('close');
  toast.success('API配置已保存');
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 2000;
}

.modal {
  width: min(800px, 100%);
  max-height: 85vh;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(15, 23, 42, 0.95);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.55);
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.title h3 {
  margin: 0;
  font-size: 1.2rem;
}

.subtitle {
  margin: 0.35rem 0 0;
  color: rgba(148, 163, 184, 0.95);
  font-size: 0.9rem;
}

.icon-btn {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1.25rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: rgba(148, 163, 184, 0.9);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #e2e8f0;
}

.tab-btn.active {
  color: #60a5fa;
  border-bottom-color: #60a5fa;
}

.tab-icon {
  font-size: 1.1rem;
}

.tab-label {
  font-size: 0.95rem;
  font-weight: 500;
}

.tab-badge {
  font-size: 0.7rem;
  padding: 2px 6px;
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border-radius: 4px;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  color: #93c5fd;
  font-size: 0.9rem;
}

.hint-icon {
  font-size: 1rem;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.config-row-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.config-label {
  width: 120px;
  color: rgba(148, 163, 184, 0.95);
  font-size: 0.9rem;
  flex-shrink: 0;
}

.config-input {
  flex: 1;
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
  font-size: 0.9rem;
}

.config-input:focus {
  outline: none;
  border-color: #60a5fa;
}

.config-select {
  flex: 1;
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
  font-size: 0.9rem;
  cursor: pointer;
}

.config-select:focus {
  outline: none;
  border-color: #60a5fa;
}

.config-range {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
}

.btn-icon {
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.btn-icon:hover {
  background: rgba(51, 65, 85, 0.75);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.btn-test {
  padding: 0.6rem 1rem;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.1);
  color: #93c5fd;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-test:hover {
  background: rgba(59, 130, 246, 0.2);
}

.btn-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-result {
  font-size: 0.9rem;
  font-weight: 500;
}

.test-result.success {
  color: #4ade80;
}

.test-result.fail {
  color: #f87171;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(100, 116, 139, 0.5);
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #3b82f6;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.disabled-hint {
  padding: 1.5rem;
  text-align: center;
  color: rgba(148, 163, 184, 0.7);
  font-size: 0.9rem;
  background: rgba(30, 41, 59, 0.3);
  border-radius: 8px;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn {
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
}

.btn-secondary:hover {
  background: rgba(51, 65, 85, 0.75);
}

.btn-primary {
  border: none;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.config-group-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #60a5fa;
  margin-top: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(96, 165, 250, 0.2);
}

.config-input-short {
  max-width: 150px;
}

.config-hint-inline {
  font-size: 0.8rem;
  color: rgba(148, 163, 184, 0.7);
  margin-left: 0.5rem;
}

.cache-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(30, 41, 59, 0.5);
  border-radius: 8px;
  margin-bottom: 0.5rem;
}

.cache-stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cache-stat-label {
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.7);
}

.cache-stat-value {
  font-size: 0.9rem;
  color: #e2e8f0;
  font-weight: 500;
}

.btn-secondary-small {
  padding: 0.4rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.55);
  color: #e2e8f0;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-secondary-small:hover {
  background: rgba(51, 65, 85, 0.75);
}

.btn-danger-small {
  padding: 0.4rem 0.75rem;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-danger-small:hover {
  background: rgba(239, 68, 68, 0.2);
}

@media (max-width: 640px) {
  .config-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .config-label {
    width: 100%;
  }

  .config-input,
  .config-select {
    width: 100%;
  }

  .config-input-short {
    max-width: 100%;
  }

  .tabs {
    overflow-x: auto;
  }

  .tab-btn {
    white-space: nowrap;
  }

  .cache-stats {
    flex-direction: column;
  }
}
</style>
