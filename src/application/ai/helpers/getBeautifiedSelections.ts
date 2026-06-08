import { ISelection } from '@/domain/entities/ISelection.js'

export function getBeautifiedSelections(activeSelections: ISelection[]) {
  return (
    activeSelections
      .map(
        (selection) =>
          `- (ID: ${selection.id}) ${selection.entityType.toUpperCase()} selection with ${selection.count} items (Sample: ${JSON.stringify(selection.sample)}))`,
      )
      .join('\n') || 'No active selections'
  )
}
