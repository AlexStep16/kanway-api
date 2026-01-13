import { TaskService } from '@application/services/TaskService.ts'
import { EditTasksDTO } from '@application/ai/tools/toolSchemes.ts'
import { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { ITask } from '@entities/ITask.ts'
import { TaskEditDTO } from '@dtos/TaskEditDTO.ts'
import dayjs from 'dayjs'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { AISemanticService } from '@application/services/AISemanticService.ts'
import { IUser } from '@domain/entities/IUser.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import { NotFoundError } from '@/domain/errors/NotFound.ts'

export class TaskCommandAdapterService {
  protected taskService: TaskService
  protected categoryService: CategoryService
  protected vectorSearchService: VectorSearchService
  protected aiSemanticService: AISemanticService

  constructor(
    taskService: TaskService,
    categoryService: CategoryService,
    vectorSearchService: VectorSearchService,
    aiSemanticService: AISemanticService
  ) {
    this.taskService = taskService
    this.categoryService = categoryService
    this.vectorSearchService = vectorSearchService
    this.aiSemanticService = aiSemanticService
  }

  private _getCollectedTaskDateTime(task: ITask, timezone: string): dayjs.Dayjs {
    const dateStr = task.dueDate || dayjs.utc().format('YYYY-MM-DD')
    const h = task.dueHours ?? 0
    const m = task.dueMinutes ?? 0

    // Сначала собираем UTC, потом переводим в локальное
    return dayjs
      .utc(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
      .tz(timezone)
  }

  public async translateAndExecute(
    taskIds: string[],
    changes: EditTasksDTO['changes'],
    timezone: string,
    user: IUser,
    session?: ClientSession,
    threadId?: string
  ): Promise<IResponseWithLog<ITask[]>> {
    const tasksToUpdate: TaskEditDTO[] = []

    const existingTasks = await this.taskService.getAll({ ids: taskIds }, user.id, session)

    for (const task of existingTasks) {
      const updatedTask = {
        id: task.id.toString(),
        threadId: threadId,
      } as TaskEditDTO

      if (typeof changes.categoryId !== 'undefined' && typeof changes.categoryId === 'string') {
        updatedTask.categoryId = changes.categoryId

        const category = await this.categoryService.getById(changes.categoryId, user.id, session)

        if (!category) {
          throw new NotFoundError(`Category with id ${changes.categoryId} not found`)
        }
      }

      if (typeof changes.order !== 'undefined') {
        if (typeof changes.order === 'string') updatedTask.order = parseInt(changes.order, 10)
        else if (typeof changes.order === 'number') updatedTask.order = changes.order
      }

      if (typeof changes.color !== 'undefined') {
        if (typeof changes.color === 'string') {
          updatedTask.color = this.taskService.getNearestColor(changes.color)
        } else {
          updatedTask.color = null
        }
      }

      if (typeof changes.isCompleted !== 'undefined') {
        updatedTask.isCompleted = Boolean(changes.isCompleted)
      }

      if (typeof changes.tags !== 'undefined') {
        const valueTyped = changes.tags

        if (valueTyped === null) updatedTask.tags = []
        else {
          if (typeof valueTyped.set !== 'undefined') updatedTask.tags = valueTyped.set
          if (typeof valueTyped.add !== 'undefined')
            updatedTask.tags = [...new Set([...(updatedTask.tags || []), ...valueTyped.add])]
          if (typeof valueTyped.remove !== 'undefined')
            updatedTask.tags = (updatedTask.tags || []).filter(
              (tag) => !valueTyped.remove!.includes(String(tag))
            )
        }
      }

      if (typeof changes.dueDate !== 'undefined') {
        if (changes.dueDate === null) {
          updatedTask.dueDate = null
          updatedTask.dueHours = null
          updatedTask.dueMinutes = null
        } else {
          const valueTyped = changes.dueDate

          if (valueTyped.set) {
            updatedTask.dueDate = dayjs
              .tz(valueTyped.set.split('T')[0].split('Z')[0], timezone)
              .format('YYYY-MM-DD')
          }

          if (valueTyped.shift) {
            const baseDate = this._getCollectedTaskDateTime(task, timezone)
            const shiftedDate = baseDate.add(valueTyped.shift.value, valueTyped.shift.unit)

            updatedTask.dueDate = shiftedDate.format('YYYY-MM-DD')
            updatedTask.dueHours = shiftedDate.hour()
            updatedTask.dueMinutes = shiftedDate.minute()
          }
        }
      }

      if (typeof changes.dueTime !== 'undefined') {
        if (changes.dueTime === null) {
          updatedTask.dueHours = null
          updatedTask.dueMinutes = null
        } else {
          const valueTyped = changes.dueTime

          if (valueTyped.set) {
            const [hours, minutes] = valueTyped.set.split(':').map(Number)
            updatedTask.dueHours = hours
            updatedTask.dueMinutes = minutes

            if (!updatedTask.dueDate) {
              updatedTask.dueDate = dayjs().tz(timezone).format('YYYY-MM-DD')
            }
          }

          if (valueTyped.shift) {
            const baseDate = this._getCollectedTaskDateTime(task, timezone)
            const shiftedDate = baseDate.add(valueTyped.shift.value, valueTyped.shift.unit)

            updatedTask.dueDate = shiftedDate.format('YYYY-MM-DD')
            updatedTask.dueHours = shiftedDate.hour()
            updatedTask.dueMinutes = shiftedDate.minute()
          }
        }
      }

      tasksToUpdate.push(updatedTask)
    }

    if (typeof changes.name !== 'undefined') {
      let updatedNames: { id: Types.ObjectId; name: string }[] = []

      if (changes.name.set) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingTasks,
          String(changes.name.set),
          'set'
        )
      }
      if (changes.name.append) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          updatedNames.length > 0 ? updatedNames : existingTasks,
          String(changes.name.append),
          'append'
        )
      }
      if (changes.name.prepend) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          updatedNames.length > 0 ? updatedNames : existingTasks,
          String(changes.name.prepend),
          'prepend'
        )
      }
      if (changes.name.replace_part) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          updatedNames.length > 0 ? updatedNames : existingTasks,
          String(changes.name.replace_part.replace_with),
          'replace',
          String(changes.name.replace_part.find)
        )
      }

      for (const updatedTask of tasksToUpdate) {
        const updatedNameData = updatedNames.find((data) => data.id.equals(updatedTask.id))

        if (updatedNameData) {
          updatedTask.name = updatedNameData.name
        }
      }
    }

    if (changes.description === null) {
      for (const task of tasksToUpdate) {
        task.description = null
      }
    } else if (typeof changes.description !== 'undefined') {
      let updatedDescriptions: { id: Types.ObjectId; description: string }[] = []

      if (changes.description.set) {
        updatedDescriptions = await this.aiSemanticService.buildDescriptionsForEntities(
          existingTasks,
          String(changes.description.set),
          'set'
        )
      }
      if (changes.description.append) {
        updatedDescriptions = await this.aiSemanticService.buildDescriptionsForEntities(
          updatedDescriptions.length > 0 ? updatedDescriptions : existingTasks,
          String(changes.description.append),
          'append'
        )
      }
      if (changes.description.prepend) {
        updatedDescriptions = await this.aiSemanticService.buildDescriptionsForEntities(
          updatedDescriptions.length > 0 ? updatedDescriptions : existingTasks,
          String(changes.description.prepend),
          'prepend'
        )
      }
      if (changes.description.replace_part) {
        updatedDescriptions = await this.aiSemanticService.buildDescriptionsForEntities(
          updatedDescriptions.length > 0 ? updatedDescriptions : existingTasks,
          String(changes.description.replace_part.replace_with),
          'replace',
          String(changes.description.replace_part.find)
        )
      }

      for (const updatedTask of tasksToUpdate) {
        const updatedDescriptionData = updatedDescriptions.find((data) =>
          data.id.equals(updatedTask.id)
        )

        if (updatedDescriptionData) {
          updatedTask.description = updatedDescriptionData.description
        }
      }
    }

    return await this.taskService.editMany(tasksToUpdate, user, session)
  }
}
