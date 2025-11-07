"use client"
import { CacheInterface } from '.'

export class StorageCache<T> implements CacheInterface<T> {
  private cacheKey: string

  constructor(cacheKey: string) {
    this.cacheKey = cacheKey
  }

  get(key: string): T | undefined {
    try {
      const stored = localStorage.getItem(this.cacheKey)
      const data = stored ? JSON.parse(stored) : {}
      return data[key]
    } catch {
      return undefined
    }
  }

  set(key: string, value: T): void {
    try {
      const stored = localStorage.getItem(this.cacheKey)
      const data = stored ? JSON.parse(stored) : {}
      data[key] = value
      localStorage.setItem(this.cacheKey, JSON.stringify(data))
    } catch {
      console.warn(`Can't store to local storage`)
    }
  }

  delete(key: string): void {
    try {
      const stored = localStorage.getItem(this.cacheKey)
      const data = stored ? JSON.parse(stored) : {}
      delete data[key]
      localStorage.setItem(this.cacheKey, JSON.stringify(data))
    } catch {
      console.warn(`Can't delete from local storage`)
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.cacheKey)
    } catch {
      console.warn(`Can't clear from local storage`)
    }
  }

  getAll(): Record<string, T> {
    try {
      const stored = localStorage.getItem(this.cacheKey)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  setAll(data: Record<string, T>): void {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(data))
    } catch {
      console.warn(`Can't set all in local storage`)
    }
  }
}
