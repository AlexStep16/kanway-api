export function projectProperties<T extends Record<string, any>>(
  sourceArray: T[],
  targetObject: Record<string, any>,
): (Partial<T> & {
  id: string
})[] {
  const keysToKeep = Object.keys(targetObject).concat([
    'id',
    'column',
    'board',
    'workspace',
    'name',
    'dueDate',
    'dueHours',
    'dueMinutes',
  ])

  return sourceArray.map((sourceItem) => {
    const result: Partial<T> = {}

    for (const key of keysToKeep) {
      if (Object.prototype.hasOwnProperty.call(sourceItem, key)) {
        ;(result as any)[key] = sourceItem[key]
      }
    }

    return result as Partial<T> & { id: string }
  })
}
