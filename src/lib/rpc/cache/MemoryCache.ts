import { CacheInterface } from '.'

export class MemoryCache<T> implements CacheInterface<T> {
  private cache: Record<string, T> = {}

  get(key: string): T | undefined {
    return this.cache[key]
  }

  set(key: string, value: T): void {
    this.cache[key] = value
  }

  delete(key: string): void {
    delete this.cache[key]
  }

  clear(): void {
    this.cache = {}
  }

  getAll(): Record<string, T> {
    return { ...this.cache }
  }

  setAll(data: Record<string, T>): void {
    this.cache = { ...data }
  }
}
