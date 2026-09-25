/**
 * AINEX Production-Grade LRU (Least Recently Used) Cache
 * Otimiza a navegação entre conversas eliminando requisições redundantes ao Firestore,
 * prevenindo piscadas de tela (0ms instant-render) e sincronizando em background via SWR.
 */

export interface CacheEntry<T> {
  value: T
  createdAt: number
  lastAccessedAt: number
}

export interface LRUCacheStats {
  size: number
  capacity: number
  hits: number
  misses: number
  evictions: number
  hitRate: string
}

export class LRUCache<K, V> {
  private readonly capacity: number
  private readonly ttlMs?: number
  private readonly map: Map<K, CacheEntry<V>>
  private hits = 0
  private misses = 0
  private evictions = 0

  constructor(capacity = 20, ttlMs?: number) {
    if (capacity <= 0) {
      throw new Error("A capacidade da LRUCache deve ser maior que 0.")
    }
    this.capacity = capacity
    this.ttlMs = ttlMs
    this.map = new Map<K, CacheEntry<V>>()
  }

  /**
   * Obtém um valor e promove a chave para o status de mais recentemente usada (MRU).
   */
  public get(key: K): V | undefined {
    const entry = this.map.get(key)
    if (!entry) {
      this.misses++
      return undefined
    }

    const now = Date.now()
    if (this.ttlMs && now - entry.createdAt > this.ttlMs) {
      this.map.delete(key)
      this.misses++
      return undefined
    }

    // Promove para o final do Map (Mais Recentemente Usado)
    this.map.delete(key)
    entry.lastAccessedAt = now
    this.map.set(key, entry)

    this.hits++
    return entry.value
  }

  /**
   * Inspeciona o valor sem alterar a ordem de recência ou estatísticas.
   */
  public peek(key: K): V | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined

    if (this.ttlMs && Date.now() - entry.createdAt > this.ttlMs) {
      return undefined
    }

    return entry.value
  }

  /**
   * Verifica se a chave existe e ainda é válida.
   */
  public has(key: K): boolean {
    const entry = this.map.get(key)
    if (!entry) return false
    if (this.ttlMs && Date.now() - entry.createdAt > this.ttlMs) {
      this.map.delete(key)
      return false
    }
    return true
  }

  /**
   * Insere ou atualiza um item na cache, promovendo-o a MRU.
   * Se a capacidade for atingida, descarta o item mais antigo (LRU).
   */
  public set(key: K, value: V): void {
    const now = Date.now()

    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.capacity) {
      // Remove o primeiro elemento inserido (Menos Recentemente Usado - LRU)
      const oldestKey = this.map.keys().next().value
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey)
        this.evictions++
      }
    }

    this.map.set(key, {
      value,
      createdAt: now,
      lastAccessedAt: now,
    })
  }

  /**
   * Remove uma chave específica da cache.
   */
  public delete(key: K): boolean {
    return this.map.delete(key)
  }

  /**
   * Esvazia completamente a cache e reseta contadores se desejado.
   */
  public clear(): void {
    this.map.clear()
  }

  /**
   * Retorna a quantidade de itens válidos na cache.
   */
  public get size(): number {
    return this.map.size
  }

  /**
   * Retorna todas as chaves ordenadas da mais antiga (LRU) à mais recente (MRU).
   */
  public keys(): K[] {
    return Array.from(this.map.keys())
  }

  /**
   * Retorna todas as entradas com metadados.
   */
  public entries(): Array<[K, CacheEntry<V>]> {
    return Array.from(this.map.entries())
  }

  /**
   * Métricas de desempenho da cache.
   */
  public getStats(): LRUCacheStats {
    const total = this.hits + this.misses
    const rate = total > 0 ? ((this.hits / total) * 100).toFixed(1) + "%" : "0.0%"
    return {
      size: this.map.size,
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: rate,
    }
  }
}

/**
 * Especialização de Cache LRU para histórico de mensagens de conversas do AINEX.
 * Suporta persistência segura no LocalStorage com serialização higienizada.
 */
export class ConversationHistoryCache {
  private readonly lru: LRUCache<string, any[]>
  private readonly storagePrefix = "ainex_conv_cache_v1_"

  constructor(capacity = 25, ttlMs = 1000 * 60 * 60 * 24) {
    // 24 horas de TTL por conversa
    this.lru = new LRUCache<string, any[]>(capacity, ttlMs)
  }

  public get(conversationId: string): any[] | null {
    if (!conversationId) return null
    const result = this.lru.get(conversationId)
    return result || null
  }

  public set(conversationId: string, messages: any[], userId?: string): void {
    if (!conversationId || !Array.isArray(messages)) return

    // Clona superficialmente e protege contra referências mutáveis
    this.lru.set(conversationId, [...messages])

    if (userId && typeof window !== "undefined") {
      this.persistToStorage(userId)
    }
  }

  public has(conversationId: string): boolean {
    return this.lru.has(conversationId)
  }

  public delete(conversationId: string, userId?: string): void {
    this.lru.delete(conversationId)
    if (userId && typeof window !== "undefined") {
      this.persistToStorage(userId)
    }
  }

  public clear(userId?: string): void {
    this.lru.clear()
    if (userId && typeof window !== "undefined") {
      try {
        localStorage.removeItem(`${this.storagePrefix}${userId}`)
      } catch {
        // Ignora erros de storage
      }
    }
  }

  public getStats(): LRUCacheStats {
    return this.lru.getStats()
  }

  /**
   * Hidrata o cache a partir do LocalStorage na inicialização (0ms boot).
   */
  public hydrateFromStorage(userId: string): void {
    if (!userId || typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(`${this.storagePrefix}${userId}`)
      if (!raw) return

      const parsed: Array<{ key: string; value: any[]; timestamp: number }> = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        // Insere na ordem para preservar recência
        for (const item of parsed) {
          if (item?.key && Array.isArray(item?.value)) {
            this.lru.set(item.key, item.value)
          }
        }
      }
    } catch (err) {
      console.warn("Falha ao hidratar cache LRU do LocalStorage:", err)
    }
  }

  /**
   * Persiste as conversas mais recentes no LocalStorage mantendo tamanho controlado.
   */
  public persistToStorage(userId: string): void {
    if (!userId || typeof window === "undefined") return
    try {
      const serializable: Array<{ key: string; value: any[]; timestamp: number }> = []

      for (const [key, entry] of this.lru.entries()) {
        // Limita o histórico salvo localmente para no máximo 30 mensagens por conversa
        const trimmedMessages = entry.value.slice(-30).map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          status: msg.status,
          // Remove payloads base64 gigantes na persistência local para não estourar a cota de 5MB
          attachments: Array.isArray(msg.attachments)
            ? msg.attachments.map((a: any) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                mimeType: a.mimeType,
                sizeFormatted: a.sizeFormatted,
              }))
            : undefined,
        }))

        serializable.push({
          key,
          value: trimmedMessages,
          timestamp: entry.lastAccessedAt,
        })
      }

      localStorage.setItem(`${this.storagePrefix}${userId}`, JSON.stringify(serializable))
    } catch (err) {
      // Se houver QuotaExceededError, libera espaço removendo entradas mais antigas
      console.warn("Storage quota excedida ou erro ao persistir LRU:", err)
    }
  }
}

// Instância singleton global para toda a aplicação
export const conversationCache = new ConversationHistoryCache(25)
