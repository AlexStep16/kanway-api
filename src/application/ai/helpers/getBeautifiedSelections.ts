import { ISelection } from '@/domain/entities/ISelection.js'

export function getBeautifiedSelections(activeSelections: ISelection[]) {
  return (
    activeSelections
      .map((selection) => {
        const lightSample = selection.sample.map((item) => {
          const { id, name, isCompleted, isDeleted } = item
          return { id, name, isCompleted, isDeleted }
        })

        return `Id: ${selection.id}
        Type: ${selection.entityType.toUpperCase()}
        Items count: ${selection.count}
        Filter used: ${JSON.stringify(selection.humanReadableFilters)}
        Sample: ${JSON.stringify(lightSample)}`
      })
      .join('\n') || 'No active selections'
  )
}
