import { Configurable } from '@/application/ai/interfaces/Configurable.js'
import TaskRepository from '@/application/repositories/TaskRepository.js'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { ClientSession, Types } from 'mongoose'
import { SuccessToolResult } from '../tools/helpers/SuccessToolResult.js'
import { SearchTasksDTO } from '../tools/schemes/searchTasksScheme.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { FilterToMongoQueryService } from './FilterToMongoQueryService.js'
import { SelectionService } from './SelectionService.js'
import { UpdateTasksDTO } from '../tools/schemes/UpdateTasksScheme.js'
import { ITask } from '@/domain/entities/ITask.js'

export class TaskToolsExecutorService {
  constructor(
    private taskRepository: TaskRepository,

    private filterToMongoQueryService: FilterToMongoQueryService,
    private selectionService: SelectionService,
  ) {}

  public async searchTasks(
    payload: SearchTasksDTO,
    config: RunnableConfig,
    session?: ClientSession,
  ) {
    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Ищу задачи',
      },
      config,
    )

    const configurable = config.configurable as Configurable

    const mongoQuery = this.filterToMongoQueryService.prepare(
      payload,
      configurable.timezone,
      configurable.user.id,
    )

    if (Object.keys(mongoQuery).length === 0) return new SuccessToolResult([])

    const tasks = await this.taskRepository.findByFilter(mongoQuery, session)
    const tasksSample = tasks.slice(0, 5).map((task) => ({
      id: task.id,
      name: task.name,
      dueDate: task.dueDate,
    }))
    const selection = await this.selectionService.addSelection(
      'task',
      tasks.map((t) => t.id.toString()),
      mongoQuery,
      tasksSample,
      configurable.user.id.toString(),
    )

    return new SuccessToolResult(selection, {
      selections: [selection],
    })
  }

  public async updateTasks(
    payload: UpdateTasksDTO,
    config: RunnableConfig,
    session?: ClientSession,
  ) {
    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Обновляю задачи',
      },
      config,
    )

    let taskIds: string[] = []

    if (!payload.task_id && !payload.selection_id) {
      throw new Error('Either task_id or selection_id must be provided')
    }

    if (payload.selection_id) {
      const selection = await this.selectionService.getSelection(payload.selection_id)

      if (!selection) {
        throw new Error('Selection not found')
      }

      taskIds = selection.entityIds
    }

    if (payload.task_id) {
      taskIds = [payload.task_id]
    }

    if (taskIds.length === 0) {
      throw new Error('No tasks to update')
    }
  }
}
