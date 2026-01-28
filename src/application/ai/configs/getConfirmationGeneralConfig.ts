import { ConfirmationContextConfig } from '@/application/ai/interfaces/ConfirmationContextConfig.ts'
import { ContextExternalFetchService } from '@application/ai/services/ContextExternalFetchService.ts'

export function getConfirmationGeneralConfig(
  contextExternalFetchService: ContextExternalFetchService,
): Record<string, ConfirmationContextConfig> {
  return {
    createTasks: {
      title: 'Будут созданы следующие задачи:',
      context: {
        mode: 'external',
        entityType: 'task',
        externalFetch: contextExternalFetchService.createTasks.bind(contextExternalFetchService),
      },
    },
    createCategories: {
      title: 'Будут созданы следующие категории:',
      context: {
        mode: 'external',
        entityType: 'category',
        externalFetch: contextExternalFetchService.createCategories.bind(
          contextExternalFetchService,
        ),
      },
    },
    createBoards: {
      title: 'Будут созданы следующие доски:',
      context: {
        mode: 'external',
        entityType: 'board',
        externalFetch: contextExternalFetchService.createBoards.bind(contextExternalFetchService),
      },
    },
    createWorkspaces: {
      title: 'Будут созданы следующие пространства:',
      context: {
        mode: 'external',
        entityType: 'workspace',
        externalFetch: contextExternalFetchService.createWorkspaces.bind(
          contextExternalFetchService,
        ),
      },
    },
    editTasks: {
      title: 'Следующим задачам будут присвоены значения:',
      context: {
        mode: 'external',
        entityType: 'task',
        externalFetch: contextExternalFetchService.editTasks.bind(contextExternalFetchService),
      },
    },
    editCategories: {
      title: 'Следующим категориям будут присвоены значения:',
      context: {
        mode: 'external',
        entityType: 'category',
        externalFetch: contextExternalFetchService.editCategories.bind(contextExternalFetchService),
      },
    },
    editBoards: {
      title: 'Следующим доскам будут присвоены значения:',
      context: {
        mode: 'external',
        entityType: 'board',
        externalFetch: contextExternalFetchService.editBoards.bind(contextExternalFetchService),
      },
    },
    editWorkspaces: {
      title: 'Следующим пространствам будут присвоены значения:',
      context: {
        mode: 'external',
        entityType: 'workspace',
        externalFetch: contextExternalFetchService.editWorkspaces.bind(contextExternalFetchService),
      },
    },

    archiveTasks: {
      title: 'Следующие задачи будут заархивированы:',
      context: {
        mode: 'external',
        entityType: 'task',
        externalFetch: contextExternalFetchService.getByArgsIdsTasks.bind(
          contextExternalFetchService,
        ),
      },
    },
    archiveCategories: {
      title: 'Следующие категории будут заархивированы:',
      context: {
        mode: 'external',
        entityType: 'category',
        externalFetch: contextExternalFetchService.getByArgsIdsCategories.bind(
          contextExternalFetchService,
        ),
      },
    },
    archiveBoards: {
      title: 'Следующие доски будут заархивированы:',
      context: {
        mode: 'external',
        entityType: 'board',
        externalFetch: contextExternalFetchService.getByArgsIdsBoards.bind(
          contextExternalFetchService,
        ),
      },
    },
    archiveWorkspaces: {
      title: 'Следующие пространства будут заархивированы:',
      context: {
        mode: 'external',
        entityType: 'workspace',
        externalFetch: contextExternalFetchService.getByArgsIdsWorkspaces.bind(
          contextExternalFetchService,
        ),
      },
    },

    cloneTasks: {
      title: 'Следующие задачи будут склонированы:',
      context: {
        mode: 'external',
        entityType: 'task',
        externalFetch: contextExternalFetchService.getByArgsIdsTasks.bind(
          contextExternalFetchService,
        ),
      },
    },
    cloneCategories: {
      title: 'Следующие категории будут склонированы:',
      context: {
        mode: 'external',
        entityType: 'category',
        externalFetch: contextExternalFetchService.getByArgsIdsCategories.bind(
          contextExternalFetchService,
        ),
      },
    },
    cloneBoards: {
      title: 'Следующие доски будут склонированы:',
      context: {
        mode: 'external',
        entityType: 'board',
        externalFetch: contextExternalFetchService.getByArgsIdsBoards.bind(
          contextExternalFetchService,
        ),
      },
    },
    cloneWorkspaces: {
      title: 'Следующие пространства будут склонированы:',
      context: {
        mode: 'external',
        entityType: 'workspace',
        externalFetch: contextExternalFetchService.getByArgsIdsWorkspaces.bind(
          contextExternalFetchService,
        ),
      },
    },

    recoverTasks: {
      title: 'Следующие задачи будут восстановлены:',
      context: {
        mode: 'external',
        entityType: 'task',
        externalFetch: contextExternalFetchService.getByArgsIdsTasks.bind(
          contextExternalFetchService,
        ),
      },
    },
    recoverCategories: {
      title: 'Следующие категории будут восстановлены:',
      context: {
        mode: 'external',
        entityType: 'category',
        externalFetch: contextExternalFetchService.getByArgsIdsCategories.bind(
          contextExternalFetchService,
        ),
      },
    },
    recoverBoards: {
      title: 'Следующие доски будут восстановлены:',
      context: {
        mode: 'external',
        entityType: 'board',
        externalFetch: contextExternalFetchService.getByArgsIdsBoards.bind(
          contextExternalFetchService,
        ),
      },
    },
    recoverWorkspaces: {
      title: 'Следующие пространства будут восстановлены:',
      context: {
        mode: 'external',
        entityType: 'workspace',
        externalFetch: contextExternalFetchService.getByArgsIdsWorkspaces.bind(
          contextExternalFetchService,
        ),
      },
    },
  }
}
