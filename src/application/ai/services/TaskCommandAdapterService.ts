import { TaskService } from '@application/services/TaskService.ts'
import { EditTasksDTO } from '@application/ai/tools/toolSchemes.ts'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { ITask } from '@entities/ITask.ts'
import { TaskEditDTO } from '@dtos/TaskEditDTO.ts'
import dayjs from 'dayjs'
import { BaseService } from '@application/services/BaseService.ts'
import { AISemanticService } from '@application/services/AISemanticService.ts'
import { IUser } from '@domain/entities/IUser.ts'

export class TaskCommandAdapterService {
  protected taskService: TaskService
  protected baseService: BaseService
  protected aiSemanticService: AISemanticService

  constructor(
    taskService: TaskService,
    baseService: BaseService,
    aiSemanticService: AISemanticService
  ) {
    this.taskService = taskService
    this.baseService = baseService
    this.aiSemanticService = aiSemanticService
  }

  private _getCollectedTaskDateTime(task: ITask, timezone: string): string {
    let collectedTaskDateTime = ''

    if (task.dueDate) {
      collectedTaskDateTime = `${task.dueDate}T${task.dueHours}:${task.dueMinutes}`
    } else collectedTaskDateTime = dayjs().tz(timezone).toISOString()

    return collectedTaskDateTime
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
      }

      if (typeof changes.order !== 'undefined') {
        if (typeof changes.order === 'string') updatedTask.order = parseInt(changes.order, 10)
        else if (typeof changes.order === 'number') updatedTask.order = changes.order
      }

      if (typeof changes.color !== 'undefined') {
        if (typeof changes.color === 'string') {
          const nearestColor = this.taskService.getNearestColor(changes.color)

          if (nearestColor) updatedTask.color = nearestColor
          else updatedTask.color = '#3b82f6'
        } else {
          updatedTask.color = null
        }
      }

      if (typeof changes.isCompleted !== 'undefined') {
        updatedTask.isCompleted = Boolean(changes.isCompleted)
      }

      if (typeof changes.tags !== 'undefined') {
        const valueTyped = changes.tags as EditTasksDTO['changes']['tags']

        if (valueTyped) {
          if (typeof valueTyped.set !== 'undefined') updatedTask.tags = valueTyped.set
          if (typeof valueTyped.add !== 'undefined')
            updatedTask.tags = [...new Set([...(updatedTask.tags || []), ...valueTyped.add])]
          if (typeof valueTyped.remove !== 'undefined')
            updatedTask.tags = (updatedTask.tags || []).filter(
              (tag) => !valueTyped.remove!.includes(String(tag))
            )
        } else {
          if (valueTyped === null) updatedTask.tags = []
        }
      }

      if (typeof changes.dueDate !== 'undefined') {
        if (changes.dueDate === null) {
          updatedTask.dueDate = null
        } else {
          const valueTyped = changes.dueDate as EditTasksDTO['changes']['dueDate']

          if (valueTyped) {
            if (typeof valueTyped.set !== 'undefined') {
              if (valueTyped.set.split('Z').length > 0) {
                updatedTask.dueDate = valueTyped.set.split('Z')[0]
              } else {
                updatedTask.dueDate = valueTyped.set
              }

              const utcDueDate = dayjs.tz(updatedTask.dueDate, timezone)

              updatedTask.dueHours = utcDueDate.hour()
              updatedTask.dueMinutes = utcDueDate.minute()
            }

            if (typeof valueTyped.shift_duration !== 'undefined') {
              const collectedTaskDateTime = this._getCollectedTaskDateTime(task, timezone)

              const duration = dayjs.duration(valueTyped.shift_duration)
              const shiftedDate = dayjs.utc(collectedTaskDateTime).add(duration).tz(timezone)

              updatedTask.dueDate = shiftedDate.format('YYYY-MM-DD')
              updatedTask.dueHours = shiftedDate.hour()
              updatedTask.dueMinutes = shiftedDate.minute()
            }
          }
        }
      }

      if (typeof changes.dueTime !== 'undefined') {
        if (changes.dueTime === null) {
          updatedTask.dueHours = null
          updatedTask.dueMinutes = null
        } else {
          const valueTyped = changes.dueTime as EditTasksDTO['changes']['dueTime']

          if (valueTyped) {
            if (typeof valueTyped.set !== 'undefined') {
              const [hours, minutes] = valueTyped.set.split(':').map(Number)

              updatedTask.dueHours = hours
              updatedTask.dueMinutes = minutes
            }
          }
        }
      }

      tasksToUpdate.push(updatedTask)
    }

    if (typeof changes.name !== 'undefined') {
      let updatedNames: { id: string; name: string }[] = []

      if (changes.name.set) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingTasks,
          String(changes.name.set),
          'set'
        )
      } else if (changes.name.append) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingTasks,
          String(changes.name.append),
          'append'
        )
      } else if (changes.name.prepend) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingTasks,
          String(changes.name.prepend),
          'prepend'
        )
      } else if (changes.name.replace_part) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingTasks,
          String(changes.name.replace_part.replace_with),
          'replace',
          String(changes.name.replace_part.find)
        )
      }

      for (const updatedTask of tasksToUpdate) {
        const updatedNameData = updatedNames.find((data) => data.id === updatedTask.id.toString())

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
      let updatedDescriptions: { id: string; description: string }[] = []

      if (changes.description.set) {
        updatedDescriptions = await this.aiSemanticService.buildDescriptionsForEntities(
          existingTasks,
          String(changes.description.set),
          'set'
        )
      } else if (changes.description.append) {
        updatedDescriptions = await this.aiSemanticService.buildDescriptionsForEntities(
          existingTasks,
          String(changes.description.append),
          'append'
        )
      } else if (changes.description.prepend) {
        updatedDescriptions = await this.aiSemanticService.buildDescriptionsForEntities(
          existingTasks,
          String(changes.description.prepend),
          'prepend'
        )
      } else if (changes.description.replace_part) {
        updatedDescriptions = await this.aiSemanticService.buildDescriptionsForEntities(
          existingTasks,
          String(changes.description.replace_part.replace_with),
          'replace',
          String(changes.description.replace_part.find)
        )
      }

      for (const updatedTask of tasksToUpdate) {
        const updatedDescriptionData = updatedDescriptions.find(
          (data) => data.id === updatedTask.id.toString()
        )

        if (updatedDescriptionData) {
          updatedTask.description = updatedDescriptionData.description
        }
      }
    }

    return await this.taskService.editMany(tasksToUpdate, user, session)
  }
}
