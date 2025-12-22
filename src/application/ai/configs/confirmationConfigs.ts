import { ToolCall } from '@langchain/core/messages'
import { AgentStateAnnotation } from '@application/ai/agents/AgentStateAnnotation.ts'
import { RunnableConfig } from '@langchain/core/runnables'
import { initializeDependencies } from '@infrastructure/di/initializeDependencies.ts'

const dependencies = initializeDependencies()

type ConfirmationContextMode = 'tool' | 'external'

interface ConfirmationContextConfig {
  title: string
  context: {
    mode: ConfirmationContextMode
    toolName?: string // если mode === 'tool'
    entityType?: 'task' | 'category' | 'board' | 'workspace' // если mode === 'external'
    externalFetch?: (params: {
      toolCall: ToolCall
      state: typeof AgentStateAnnotation.State
      config: RunnableConfig
    }) => Promise<any>
  }
  // (опционально) dependencies, другие поля
}
export const confirmationConfigs: Record<string, ConfirmationContextConfig> = {
  deleteTasks: {
    title: 'Будут удалены следующие задачи:',
    context: {
      mode: 'external',
      entityType: 'task',
      externalFetch: async ({ toolCall, config }) => {
        const ids: string[] = toolCall.args?.ids || []

        return dependencies.services.taskService.getAll({ ids }, config.configurable?.user?.id)
      },
    },
  },
  deleteCategories: {
    title: 'Будут удалены следующие категории:',
    context: {
      mode: 'external',
      entityType: 'category',
      externalFetch: async ({ toolCall, config }) => {
        const ids: string[] = toolCall.args?.ids || []

        return dependencies.services.categoryService.getAll({ ids }, config.configurable?.user?.id)
      },
    },
  },
  deleteBoards: {
    title: 'Будут удалены следующие доски:',
    context: {
      mode: 'external',
      entityType: 'board',
      externalFetch: async ({ toolCall, config }) => {
        const ids: string[] = toolCall.args?.ids || []

        return dependencies.services.boardService.getAll({ ids }, config.configurable?.user?.id)
      },
    },
  },
  deleteWorkspaces: {
    title: 'Будут удалены следующие пространства:',
    context: {
      mode: 'external',
      entityType: 'workspace',
      externalFetch: async ({ toolCall, config }) => {
        const ids: string[] = toolCall.args?.ids || []

        return dependencies.services.workspaceService.getAll({ ids }, config.configurable?.user?.id)
      },
    },
  },
}
