/**
 * 正文优化功能类型定义
 */

/**
 * 正文优化提示词条目
 * 类似酒馆世界书的格式
 */
export interface TextOptimizationEntry {
  /** 唯一ID */
  id: string;
  /** 条目名称 */
  name: string;
  /** 提示词内容 */
  content: string;
  /** 角色类型 */
  role: 'system' | 'user' | 'assistant';
  /** 是否启用 */
  enabled: boolean;
  /** 注入深度（数字越大越靠前） */
  depth: number;
  /** 触发模式 */
  triggerMode?: 'always' | 'keyword';
  /** 关键词触发（可选） */
  keywords?: string[];
  /** 排序顺序 */
  order?: number;
}

/**
 * 正文优化预设
 */
export interface TextOptimizationPreset {
  /** 预设ID */
  id: string;
  /** 预设名称 */
  name: string;
  /** 条目列表 */
  entries: TextOptimizationEntry[];
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
  /** 版本 */
  version?: string;
}

/**
 * 酒馆世界书导入格式
 */
export interface TavernWorldBookEntry {
  id?: string;
  uid?: number;
  name?: string;
  content?: string;
  comment?: string;
  constant?: boolean;
  selective?: boolean;
  selectiveLogic?: number;
  addMemo?: boolean;
  order?: number;
  position?: number;
  disable?: boolean;
  excludeRecursion?: boolean;
  preventRecursion?: boolean;
  delayUntilRecursion?: boolean;
  probability?: number;
  matchWholeWords?: boolean;
  useProbability?: boolean;
  depth?: number;
  group?: string;
  groupOverride?: boolean;
  groupWeight?: number;
  scanDepth?: number;
  caseSensitive?: boolean;
  automationId?: string;
  role?: number | string;
  vectorized?: boolean;
  displayIndex?: number;
  keys?: string[];
  keysecondary?: string[];
  extensions?: Record<string, any>;
}

export interface TavernWorldBookFormat {
  entries?: Record<string, TavernWorldBookEntry>;
  name?: string;
  description?: string;
  scanDepth?: number;
  tokenBudget?: number;
  recursive?: boolean;
  extensions?: Record<string, any>;
}

/**
 * 将酒馆世界书格式转换为内部格式
 */
export function convertTavernWorldBook(worldBook: TavernWorldBookFormat): TextOptimizationEntry[] {
  const entries: TextOptimizationEntry[] = [];

  if (!worldBook.entries) return entries;

  for (const [key, entry] of Object.entries(worldBook.entries)) {
    // 转换role：酒馆格式中 0=system, 1=user, 2=assistant
    let role: 'system' | 'user' | 'assistant' = 'system';
    if (typeof entry.role === 'number') {
      role = entry.role === 1 ? 'user' : entry.role === 2 ? 'assistant' : 'system';
    } else if (typeof entry.role === 'string') {
      role = entry.role as 'system' | 'user' | 'assistant';
    }

    entries.push({
      id: entry.id || entry.uid?.toString() || `entry_${key}`,
      name: entry.name || entry.comment || `Entry ${key}`,
      content: entry.content || '',
      role,
      enabled: !entry.disable,
      depth: entry.depth ?? 4,
      triggerMode: (entry.keys && entry.keys.length > 0) ? 'keyword' : 'always',
      keywords: entry.keys || [],
      order: entry.order ?? entry.displayIndex ?? 0,
    });
  }

  // 按order排序
  entries.sort((a, b) => (a.order || 0) - (b.order || 0));

  return entries;
}

/**
 * 将内部格式导出为酒馆世界书格式
 */
export function exportToTavernWorldBook(entries: TextOptimizationEntry[], name: string = '正文优化预设'): TavernWorldBookFormat {
  const worldBookEntries: Record<string, TavernWorldBookEntry> = {};

  entries.forEach((entry, index) => {
    // 转换role：内部格式转酒馆格式
    let roleNum = 0; // system
    if (entry.role === 'user') roleNum = 1;
    else if (entry.role === 'assistant') roleNum = 2;

    worldBookEntries[index.toString()] = {
      id: entry.id,
      uid: index,
      name: entry.name,
      content: entry.content,
      comment: entry.name,
      constant: entry.triggerMode === 'always',
      selective: entry.triggerMode === 'keyword',
      order: entry.order ?? index,
      position: 4, // 默认位置
      disable: !entry.enabled,
      depth: entry.depth,
      role: roleNum,
      keys: entry.keywords || [],
      displayIndex: index,
    };
  });

  return {
    entries: worldBookEntries,
    name,
    description: '由仙途正文优化功能导出',
    scanDepth: 100,
    tokenBudget: 2048,
    recursive: false,
  };
}

/**
 * 生成唯一ID
 */
export function generateEntryId(): string {
  return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 创建默认条目
 */
export function createDefaultEntry(): TextOptimizationEntry {
  return {
    id: generateEntryId(),
    name: '新条目',
    content: '',
    role: 'system',
    enabled: true,
    depth: 4,
    triggerMode: 'always',
    keywords: [],
    order: 0,
  };
}
