import { ConfirmationContextConfig } from '@/application/ai/interfaces/ConfirmationContextConfig.ts'
import { ContextExternalFetchService } from '@application/ai/services/ContextExternalFetchService.ts'

export function getConfirmationDestructiveConfig(
  contextExternalFetchService: ContextExternalFetchService
): Record<string, ConfirmationContextConfig> {
  return {
    deleteTasks: {
      title: 'Будут удалены следующие задачи:',
      context: {
        mode: 'external',
        entityType: 'task',
        externalFetch: contextExternalFetchService.getByArgsIdsTasks.bind(
          contextExternalFetchService
        ),
      },
    },
    deleteCategories: {
      title: 'Будут удалены следующие категории:',
      context: {
        mode: 'external',
        entityType: 'category',
        externalFetch: contextExternalFetchService.getByArgsIdsCategories.bind(
          contextExternalFetchService
        ),
      },
    },
    deleteBoards: {
      title: 'Будут удалены следующие доски:',
      context: {
        mode: 'external',
        entityType: 'board',
        externalFetch: contextExternalFetchService.getByArgsIdsBoards.bind(
          contextExternalFetchService
        ),
      },
    },
    deleteWorkspaces: {
      title: 'Будут удалены следующие пространства:',
      context: {
        mode: 'external',
        entityType: 'workspace',
        externalFetch: contextExternalFetchService.getByArgsIdsWorkspaces.bind(
          contextExternalFetchService
        ),
      },
    },
  }
}
