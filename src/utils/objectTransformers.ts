import { Types } from 'mongoose'

function camelToSnake(str: string): string {
  if (str === 'id') return '_id'

  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

export function toMongoCaseKeys<TEntity>(obj: any): TEntity {
  if (Array.isArray(obj)) {
    return obj.map((v) => toMongoCaseKeys(v)) as any
  }

  if (
    obj !== null &&
    typeof obj === 'object' &&
    !(obj instanceof Date) &&
    !(obj instanceof Types.ObjectId)
  ) {
    return Object.keys(obj).reduce((acc, key) => {
      if (key.startsWith('_')) {
        acc[key] = toMongoCaseKeys(obj[key])
      } else {
        const snakeKey = camelToSnake(key)

        acc[snakeKey] = isSystemKey(key) ? obj[key] : toMongoCaseKeys(obj[key])
      }
      return acc
    }, {} as any)
  }

  return obj
}

export function toServerCaseKeys<TEntity>(obj: any): TEntity {
  if (Array.isArray(obj)) {
    return obj.map((v) => toServerCaseKeys(v)) as any
  }

  if (
    obj !== null &&
    typeof obj === 'object' &&
    !(obj instanceof Date) &&
    !(obj instanceof Types.ObjectId)
  ) {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = snakeToCamel(key)

      acc[camelKey] = isSystemKey(key) ? obj[key] : toServerCaseKeys(obj[key])

      return acc
    }, {} as any)
  }

  return obj
}

function isSystemKey(key: string): boolean {
  if (['__v', '_id', 'id', 'createdAt', 'updatedAt'].includes(key)) return true
  return false
}

function snakeToCamel(str: string): string {
  if (str === '_id') return 'id'
  if (str === '__v') return 'version'

  return str.replace(/([-_][a-z0-9])/gi, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '')
  })
}
