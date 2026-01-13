export function projectProperties<T extends Record<string, any>>(
  sourceArray: T[],
  targetObject: Record<string, any>
): Partial<T>[] {
  const keysToKeep = Object.keys(targetObject)

  return sourceArray.map((sourceItem) => {
    const result: Partial<T> = {}

    for (const key of keysToKeep) {
      if (Object.prototype.hasOwnProperty.call(sourceItem, key)) {
        ;(result as any)[key] = sourceItem[key]
      }
    }

    return result as Partial<T>
  })
}
