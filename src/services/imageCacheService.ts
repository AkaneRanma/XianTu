/**
 * 图片缓存服务
 * 使用 IndexedDB 存储生成的图片，避免重复生成
 */

import type { ImageCacheEntry, ImageCacheStats, CacheKeyParams } from '@/types/novelAI'

// ============ 常量定义 ============
const DB_NAME = 'NovelAIImageCache'
const DB_VERSION = 1
const STORE_NAME = 'images'

// 缓存限制
const MAX_CACHE_SIZE = 100 * 1024 * 1024  // 100MB
const MAX_ENTRIES = 200                     // 最多200张图
const EXPIRY_DAYS = 30                      // 30天过期

// ============ 工具函数 ============

/**
 * 生成 SHA-256 哈希
 */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 根据参数生成缓存键
 */
export async function generateCacheKey(params: CacheKeyParams): Promise<string> {
  // 只有当 seed 不为 0 时才将其纳入缓存键
  const keyData = {
    tags: params.tags,
    presetName: params.presetName,
    fixedPrompt: params.fixedPrompt,
    fixedPrompt_end: params.fixedPrompt_end,
    negativePrompt: params.negativePrompt,
    model: params.model,
    sampler: params.sampler,
    width: params.width,
    height: params.height,
    steps: params.steps,
    cfg: params.cfg,
    ...(params.seed !== 0 ? { seed: params.seed } : {})
  }

  const keyString = JSON.stringify(keyData)
  return await sha256(keyString)
}

// ============ 缓存服务类 ============

class ImageCacheService {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    // 避免重复初始化
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('[ImageCache] 数据库打开失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('[ImageCache] 数据库已打开')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建对象存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })

          // 创建索引
          store.createIndex('createdAt', 'createdAt', { unique: false })
          store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false })
          store.createIndex('size', 'size', { unique: false })

          console.log('[ImageCache] 数据库结构已创建')
        }
      }
    })

    return this.initPromise
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureDB(): Promise<IDBDatabase> {
    await this.init()
    if (!this.db) {
      throw new Error('[ImageCache] 数据库未初始化')
    }
    return this.db
  }

  /**
   * 获取缓存
   */
  async get(cacheKey: string): Promise<ImageCacheEntry | null> {
    const db = await this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(cacheKey)

      request.onerror = () => {
        console.error('[ImageCache] 获取缓存失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const entry = request.result as ImageCacheEntry | undefined

        if (entry) {
          // 检查是否过期
          const expiryTime = EXPIRY_DAYS * 24 * 60 * 60 * 1000
          if (Date.now() - entry.createdAt > expiryTime) {
            // 已过期，删除并返回 null
            store.delete(cacheKey)
            console.log('[ImageCache] 缓存已过期:', cacheKey.substring(0, 8))
            resolve(null)
            return
          }

          // 更新最后访问时间
          entry.lastAccessedAt = Date.now()
          store.put(entry)

          console.log('[ImageCache] 缓存命中:', cacheKey.substring(0, 8))
          resolve(entry)
        } else {
          resolve(null)
        }
      }
    })
  }

  /**
   * 存储缓存
   */
  async set(entry: ImageCacheEntry): Promise<void> {
    const db = await this.ensureDB()

    // 先检查是否需要清理
    await this.ensureCapacity(entry.size)

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(entry)

      request.onerror = () => {
        console.error('[ImageCache] 存储缓存失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log('[ImageCache] 缓存已存储:', entry.id.substring(0, 8), `(${(entry.size / 1024).toFixed(1)}KB)`)
        resolve()
      }
    })
  }

  /**
   * 删除单个缓存
   */
  async delete(cacheKey: string): Promise<void> {
    const db = await this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(cacheKey)

      request.onerror = () => {
        console.error('[ImageCache] 删除缓存失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log('[ImageCache] 缓存已删除:', cacheKey.substring(0, 8))
        resolve()
      }
    })
  }

  /**
   * 确保有足够容量存储新条目
   */
  private async ensureCapacity(newEntrySize: number): Promise<void> {
    const stats = await this.getStats()

    // 检查条目数量
    if (stats.totalEntries >= MAX_ENTRIES) {
      console.log('[ImageCache] 条目数量超限，执行 LRU 清理')
      await this.cleanLRU(1) // 至少删除1个
    }

    // 检查总大小
    if (stats.totalSize + newEntrySize > MAX_CACHE_SIZE) {
      console.log('[ImageCache] 缓存大小超限，执行 LRU 清理')
      const targetSize = MAX_CACHE_SIZE - newEntrySize - (10 * 1024 * 1024) // 留10MB余量
      await this.cleanToSize(targetSize)
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanExpired(): Promise<number> {
    const db = await this.ensureDB()
    const expiryTime = Date.now() - (EXPIRY_DAYS * 24 * 60 * 60 * 1000)

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('createdAt')
      const range = IDBKeyRange.upperBound(expiryTime)
      const request = index.openCursor(range)

      let deletedCount = 0

      request.onerror = () => {
        console.error('[ImageCache] 清理过期缓存失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          console.log(`[ImageCache] 已清理 ${deletedCount} 个过期缓存`)
          resolve(deletedCount)
        }
      }
    })
  }

  /**
   * 基于 LRU 策略清理指定数量的条目
   */
  async cleanLRU(count: number): Promise<number> {
    const db = await this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('lastAccessedAt')
      const request = index.openCursor()

      let deletedCount = 0

      request.onerror = () => {
        console.error('[ImageCache] LRU 清理失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor && deletedCount < count) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          console.log(`[ImageCache] LRU 清理了 ${deletedCount} 个条目`)
          resolve(deletedCount)
        }
      }
    })
  }

  /**
   * 清理到指定大小以下
   */
  private async cleanToSize(targetSize: number): Promise<number> {
    const db = await this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('lastAccessedAt')

      // 先获取当前总大小
      let currentSize = 0
      let deletedCount = 0

      const countRequest = store.getAll()

      countRequest.onsuccess = () => {
        const entries = countRequest.result as ImageCacheEntry[]
        currentSize = entries.reduce((sum, e) => sum + e.size, 0)

        if (currentSize <= targetSize) {
          resolve(0)
          return
        }

        // 按最后访问时间排序，删除最旧的
        entries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

        const toDelete: string[] = []
        let sizeToFree = currentSize - targetSize

        for (const entry of entries) {
          if (sizeToFree <= 0) break
          toDelete.push(entry.id)
          sizeToFree -= entry.size
        }

        // 执行删除
        const deleteTransaction = db.transaction(STORE_NAME, 'readwrite')
        const deleteStore = deleteTransaction.objectStore(STORE_NAME)

        for (const id of toDelete) {
          deleteStore.delete(id)
          deletedCount++
        }

        deleteTransaction.oncomplete = () => {
          console.log(`[ImageCache] 清理到目标大小，删除了 ${deletedCount} 个条目`)
          resolve(deletedCount)
        }

        deleteTransaction.onerror = () => {
          reject(deleteTransaction.error)
        }
      }

      countRequest.onerror = () => {
        reject(countRequest.error)
      }
    })
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<ImageCacheStats> {
    const db = await this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onerror = () => {
        console.error('[ImageCache] 获取统计失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const entries = request.result as ImageCacheEntry[]

        const totalEntries = entries.length
        const totalSize = entries.reduce((sum, e) => sum + e.size, 0)

        let oldestEntry: Date | null = null
        if (entries.length > 0) {
          const oldest = entries.reduce((min, e) =>
            e.createdAt < min.createdAt ? e : min
          , entries[0])
          oldestEntry = new Date(oldest.createdAt)
        }

        resolve({
          totalEntries,
          totalSize,
          oldestEntry
        })
      }
    })
  }

  /**
   * 获取所有缓存条目
   */
  async getAllEntries(): Promise<ImageCacheEntry[]> {
    const db = await this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onerror = () => {
        console.error('[ImageCache] 获取所有缓存条目失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const entries = request.result as ImageCacheEntry[]
        // 按创建时间倒序排列，最新的在前面
        entries.sort((a, b) => b.createdAt - a.createdAt)
        console.log(`[ImageCache] 获取到 ${entries.length} 个缓存条目`)
        resolve(entries)
      }
    })
  }

  /**
   * 清空所有缓存
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onerror = () => {
        console.error('[ImageCache] 清空缓存失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log('[ImageCache] 所有缓存已清空')
        resolve()
      }
    })
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
      console.log('[ImageCache] 数据库已关闭')
    }
  }
}

// 导出单例
export const imageCacheService = new ImageCacheService()
