function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

export function toMongoCaseKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((v) => toMongoCaseKeys(v))
  }

  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      if (key.startsWith('_')) {
        acc[key] = toMongoCaseKeys(obj[key])
      } else {
        const snakeKey = camelToSnake(key)

        acc[snakeKey] = toMongoCaseKeys(obj[key])
      }
      return acc
    }, {} as any)
  }

  if (obj === 'id') return '_id'

  return obj
}

export function toServerCaseKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((v) => toServerCaseKeys(v))
  }

  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = snakeToCamel(key)

      acc[camelKey] = toServerCaseKeys(obj[key])

      return acc
    }, {} as any)
  }

  if (obj === '_id') return 'id'

  return obj
}

function snakeToCamel(str: string): string {
  return str.replace(/([-_][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '')
  })
}
