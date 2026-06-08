import { TASK_COLORS_TITLES } from '@/constants/TASK_COLORS.js'
import z from 'zod'
import { initializeDependencies } from '@/infrastructure/di/initializeDependencies.js'

const dependencies = initializeDependencies()

export const ColorScheme = z.object({
  value: z.enum(TASK_COLORS_TITLES).describe('The color name.'),
  tone: z.enum(['light', 'medium', 'dark']).describe('The tone/shade.'),
})

export const checkColumnId = async (columnId: string) => {
  const columns = await dependencies.services.columnService.getByCriteria({ id: columnId })

  if (columns.length === 0) {
    return false
  }

  return true
}

export const checkTaskId = async (taskId: string) => {
  const tasks = await dependencies.services.taskService.getByCriteria({ id: taskId })

  if (tasks.length === 0) {
    return false
  }

  return true
}

export const checkBoardId = async (boardId: string) => {
  const boards = await dependencies.services.boardService.getByCriteria({ id: boardId })

  if (boards.length === 0) {
    return false
  }

  return true
}

export const checkWorkspaceId = async (workspaceId: string) => {
  const workspaces = await dependencies.services.workspaceService.getByCriteria({ id: workspaceId })

  if (workspaces.length === 0) {
    return false
  }

  return true
}
