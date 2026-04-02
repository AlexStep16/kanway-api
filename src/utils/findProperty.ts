export function findProperty<T = any>(
  obj: any,
  targetKey: string,
  visited: Set<any> = new Set(),
): T | undefined {
  if (typeof obj !== 'object' || obj === null) {
    return undefined
  }

  if (visited.has(obj)) {
    return undefined
  }
  visited.add(obj)

  if (Object.prototype.hasOwnProperty.call(obj, targetKey)) {
    return obj[targetKey] as T
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const result = findProperty<T>(obj[key], targetKey, visited)

      if (result !== undefined) {
        return result
      }
    }
  }

  return undefined
}
