import { LangGraphRunnableConfig } from '@langchain/langgraph'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { FailedToolResult } from '../../FailedToolResult.ts'
import { SuccessToolResult } from '../../SuccessToolResult.ts'
import { TaskDTO } from '@/application/dtos/TaskDTO.ts'
import { Types } from 'mongoose'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { validateInputByScheme } from '@/utils/validateInputByScheme.ts'
import { getColorByNameAndTone } from '@/utils/getColorByNameAndTone.ts'
import { TaskCreateDTO, TaskCreateSchema } from '../../schemes/create/taskCreateSchema.ts'
import { getCompressedTasks } from '@/utils/getCompressedTasks.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { BaseToolAdapter } from '../BaseToolAdapter.ts'

export class TaskBaseToolAdapter extends BaseToolAdapter {
  public async searchRelevantTasks(
    dto: { namesToFind: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<string> {
    try {
      const { namesToFind } = dto
      const configurable = config.configurable as Configurable

      if (!namesToFind || namesToFind.length === 0) {
        return 'Task names required to find relevant tasks.'
      }

      const userId = configurable.user.id
      console.log(dto)
      console.log(userId)
      const tasks = await this.vectorSearchService.similaritySearchTasks(namesToFind, userId, 30)
      console.log(tasks)
      const populatedTasks = await this.taskService.getByCriteria({
        ids: tasks.map((t) => t.id.toString()),
      })

      const compressedTasks = getCompressedTasks(populatedTasks)

      if (compressedTasks.length === 0) {
        return 'No tasks found matching the provided filter.'
      } else if (compressedTasks.length > 20) {
        return `Found ${compressedTasks.length} tasks. Please refine your filter to narrow down the results.`
      }

      return JSON.stringify(compressedTasks)
    } catch (e) {
      Sentry.captureException(e)

      return `Error finding relevant tasks: ${(e as Error).message}`
    }
  }

  public async createTasks(
    dto: TaskCreateDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const tasks = dto.tasks

      if (!tasks || tasks.length === 0) {
        return new FailedToolResult('No tasks provided for creation.')
      }

      const errors: string[] = []

      const extendedTasks = await this._extendTaskCreateDTOWithContext(
        tasks,
        errors,
        user,
        configurable,
      )

      const validationSchemaMessages = validateInputByScheme(dto, TaskCreateSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in create Tasks schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const createResult = await this.taskService.createMany(extendedTasks, user)

      if (!createResult) {
        return new FailedToolResult('Tasks creation failed.')
      }

      if (createResult.data && createResult.data.length === 0) {
        return new FailedToolResult('No tasks were created.')
      } else if (!createResult.data) {
        return new FailedToolResult('Tasks creation failed.')
      }

      return new SuccessToolResult({
        data: createResult.data.map((task) => ({ id: task.id, name: task.name })),
        logId: createResult.logId,
        actions: {
          create: {
            tasks: createResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error creating tasks: ${(e as Error).message}`)
    }
  }

  public async cloneTasks(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No tasks provided for cloning.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while cloning tasks:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const cloneResult = await this.taskService.clone({ ids }, user)

      if (!cloneResult) {
        return new FailedToolResult('Tasks cloning failed.')
      }

      if (cloneResult.data && cloneResult.data.length === 0) {
        return new FailedToolResult('No tasks were cloned.')
      } else if (!cloneResult.data) {
        return new FailedToolResult('Tasks cloning failed.')
      }

      return new SuccessToolResult({
        data: cloneResult.data.map((task) => task.id),
        logId: cloneResult.logId,
        actions: {
          clone: {
            tasks: cloneResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error cloning tasks: ${(e as Error).message}`)
    }
  }

  public async archiveTasks(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids
    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No tasks provided for archiving.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while archiving tasks:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const archiveResult = await this.taskService.archive({ ids }, user)

      if (!archiveResult) {
        return new FailedToolResult('Tasks archiving failed.')
      }

      if (archiveResult.data && archiveResult.data.length === 0) {
        return new FailedToolResult('No tasks were archived.')
      } else if (!archiveResult.data) {
        return new FailedToolResult('Tasks archiving failed.')
      }

      return new SuccessToolResult({
        data: archiveResult.data.map((task) => task.id),
        logId: archiveResult.logId,
        actions: {
          archive: {
            tasks: archiveResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error archiving tasks: ${(e as Error).message}`)
    }
  }

  public async deleteTasks(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No tasks provided for deletion.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while deleting tasks:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const tasksToDelete = await this.taskService.getByCriteria({ ids }, user.id)

      await this.taskService.delete({ ids }, user)

      return new SuccessToolResult({
        data: tasksToDelete.map((task) => task.id),
        actions: {
          delete: {
            tasks: tasksToDelete,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error deleting tasks: ${(e as Error).message}`)
    }
  }

  public async recoverTasks(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No tasks provided for recovering.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while recovering tasks:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const recoverResult = await this.taskService.recover({ ids }, user)

      if (!recoverResult) {
        return new FailedToolResult('Tasks recovering failed.')
      }

      if (recoverResult.data && recoverResult.data.length === 0) {
        return new FailedToolResult('No tasks were recovered.')
      } else if (!recoverResult.data) {
        return new FailedToolResult('Tasks recovering failed.')
      }

      return new SuccessToolResult({
        data: recoverResult.data.map((task) => task.id),
        logId: recoverResult.logId,
        actions: {
          recover: {
            tasks: recoverResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error recovering tasks: ${(e as Error).message}`)
    }
  }

  private async _extendTaskCreateDTOWithContext(
    tasks: TaskCreateDTO['tasks'],
    errors: string[],
    user: IUser,
    configurable: Configurable,
  ): Promise<TaskDTO[]> {
    const extendedTasks: TaskDTO[] = []

    for (const task of tasks) {
      const workspaceId = task.workspaceId
        ? task.workspaceId
        : await this._resolveWorkspaceByName('Task', configurable, errors, user, task.workspaceName)
      if (!workspaceId) continue

      const boardId = task.boardId
        ? task.boardId
        : await this._resolveBoardByName(
            'Task',
            workspaceId,
            configurable,
            errors,
            user,
            task.boardName,
          )
      if (!boardId) continue

      const categoryId = task.categoryId
        ? task.categoryId
        : await this._resolveCategoryByName(
            'Task',
            workspaceId,
            boardId,
            configurable,
            errors,
            user,
            task.categoryName,
          )
      if (!categoryId) continue

      const taskExtended: TaskDTO = {
        name: task.name.trim(),
        categoryId: categoryId,
        description: task.description,
        dueDate: task.dueDate,
        tags: task.tags,
        isCompleted: task.isCompleted,
        order: task.order,
        boardId: boardId,
        workspaceId: workspaceId,
      }

      if (task.color) {
        const color = getColorByNameAndTone(task.color.color, task.color.tone || 'medium')

        taskExtended.color = color
      }

      if (task.dueDate) {
        if (task.dueTime) {
          const parsedDueTime = task.dueTime.split(':')

          taskExtended.dueHours = parseInt(parsedDueTime[0], 10)
          taskExtended.dueMinutes = parseInt(parsedDueTime[1], 10)

          delete (taskExtended as any).dueTime // Remove dueTime as it's now split into hours and minutes
        }
      }

      extendedTasks.push(taskExtended)
    }

    return extendedTasks
  }
}
