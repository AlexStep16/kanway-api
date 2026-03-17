import { TaskService } from '@application/services/TaskService.ts'
import { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { TaskEditDTO } from '@dtos/TaskEditDTO.ts'
import dayjs from 'dayjs'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { AISemanticService } from '@application/services/AISemanticService.ts'
import { IUser } from '@domain/entities/IUser.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import { ITaskPopulated } from '@/application/interfaces/ITaskPopulated.ts'
import {
  DateModificationDTO,
  TagsModificationDTO,
  TimeModificationDTO,
  StringModificationDTO,
} from '../tools/schemes/baseSchemes.ts'
import { getColorByNameAndTone } from '@/utils/getColorByNameAndTone.ts'
import { NotFoundError } from '@/domain/errors/NotFound.ts'
import { EditTasksColorDTO } from '../tools/schemes/update/taskEditSchemes.ts'

export class TaskCommandAdapterService {
  protected taskService: TaskService
  protected categoryService: CategoryService
  protected vectorSearchService: VectorSearchService
  protected aiSemanticService: AISemanticService

  constructor(
    taskService: TaskService,
    categoryService: CategoryService,
    vectorSearchService: VectorSearchService,
    aiSemanticService: AISemanticService,
  ) {
    this.taskService = taskService
    this.categoryService = categoryService
    this.vectorSearchService = vectorSearchService
    this.aiSemanticService = aiSemanticService
  }

  private _getCollectedTaskDateTime(task: ITaskPopulated, timezone: string): dayjs.Dayjs {
    const dateStr = task.dueDate || dayjs.utc().format('YYYY-MM-DD')
    const h = task.dueHours ?? 0
    const m = task.dueMinutes ?? 0

    return dayjs
      .utc(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
      .tz(timezone)
  }

  private _getTransformedTasksForStringModification(
    tasks: ITaskPopulated[],
    field: 'name' | 'description',
  ): { id: Types.ObjectId; text: string }[] {
    return tasks.map((task) => ({
      id: task.id,
      text: task[field] || '',
    }))
  }

  public async translateEditStringAndExecute(
    taskIds: string[],
    dto: StringModificationDTO | null,
    field: 'name' | 'description',
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (typeof dto === 'undefined') {
      return {
        data: [],
        logId: null,
      }
    }

    const tasksToUpdate: TaskEditDTO[] = []

    const existingTasks = await this.taskService.getByCriteria({ ids: taskIds }, user.id, session)
    const transformedTasks = this._getTransformedTasksForStringModification(existingTasks, field)

    let updatedTexts: { id: Types.ObjectId; text: string | null }[] = []

    if (dto === null) {
      updatedTexts = transformedTasks.map((task) => ({
        id: task.id,
        text: null,
      }))
    } else if (dto.set) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        transformedTasks,
        String(dto.set),
        'set',
      )
    } else if (dto.append) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        updatedTexts.length > 0 ? updatedTexts : transformedTasks,
        String(dto.append),
        'append',
      )
    } else if (dto.prepend) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        updatedTexts.length > 0 ? updatedTexts : transformedTasks,
        String(dto.prepend),
        'prepend',
      )
    } else if (dto.replace_part) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        updatedTexts.length > 0 ? updatedTexts : transformedTasks,
        String(dto.replace_part.replace_with),
        'replace',
        String(dto.replace_part.find),
      )
    }

    tasksToUpdate.push(
      ...updatedTexts.map((data) => ({ id: data.id.toString(), [field]: data.text })),
    )

    for (const updatedTask of tasksToUpdate) {
      const updatedTextData = updatedTexts.find((data) => data.id.equals(updatedTask.id))

      if (updatedTextData) {
        if (field !== 'name') updatedTask[field] = updatedTextData.text
        else updatedTask.name = 'Без названия'
      }
    }

    return await this.taskService.editMany(tasksToUpdate, user, session)
  }

  public async translateEditDateAndExecute(
    taskIds: string[],
    dto: DateModificationDTO | null,
    timezone: string,
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (typeof dto === 'undefined' || (dto && Object.keys(dto).length === 0)) {
      return {
        data: [],
        logId: null,
      }
    }

    const tasksToUpdate: TaskEditDTO[] = []

    const existingTasks = await this.taskService.getByCriteria({ ids: taskIds }, user.id, session)

    for (const task of existingTasks) {
      const updatedTask = {
        id: task.id.toString(),
      } as TaskEditDTO

      if (dto === null) {
        updatedTask.dueDate = null
        updatedTask.dueHours = null
        updatedTask.dueMinutes = null
      } else {
        if (dto.set) {
          updatedTask.dueDate = dayjs
            .tz(dto.set.split('T')[0].split('Z')[0], timezone)
            .format('YYYY-MM-DD')
        }

        if (dto.shift) {
          const baseDate = this._getCollectedTaskDateTime(task, timezone)
          const shiftedDate = baseDate.add(dto.shift.value, dto.shift.unit)

          updatedTask.dueDate = shiftedDate.format('YYYY-MM-DD')
          updatedTask.dueHours = shiftedDate.hour()
          updatedTask.dueMinutes = shiftedDate.minute()
        }
      }

      tasksToUpdate.push(updatedTask)
    }

    return await this.taskService.editMany(tasksToUpdate, user, session)
  }

  public async translateEditTimeAndExecute(
    taskIds: string[],
    dto: TimeModificationDTO | null,
    timezone: string,
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (typeof dto === 'undefined' || (dto && Object.keys(dto).length === 0)) {
      return {
        data: [],
        logId: null,
      }
    }

    const tasksToUpdate: TaskEditDTO[] = []

    const existingTasks = await this.taskService.getByCriteria({ ids: taskIds }, user.id, session)

    for (const task of existingTasks) {
      const updatedTask = {
        id: task.id.toString(),
      } as TaskEditDTO

      if (dto === null) {
        updatedTask.dueHours = null
        updatedTask.dueMinutes = null
      } else {
        if (dto.set) {
          const [hours, minutes] = dto.set.split(':').map(Number)
          updatedTask.dueHours = hours
          updatedTask.dueMinutes = minutes

          if (!updatedTask.dueDate) {
            updatedTask.dueDate = dayjs().tz(timezone).format('YYYY-MM-DD')
          }
        }

        if (dto.shift) {
          const baseDate = this._getCollectedTaskDateTime(task, timezone)
          const shiftedDate = baseDate.add(dto.shift.value, dto.shift.unit)

          updatedTask.dueDate = shiftedDate.format('YYYY-MM-DD')
          updatedTask.dueHours = shiftedDate.hour()
          updatedTask.dueMinutes = shiftedDate.minute()
        }
      }

      tasksToUpdate.push(updatedTask)
    }

    return await this.taskService.editMany(tasksToUpdate, user, session)
  }

  public async translateEditArrayAndExecute(
    taskIds: string[],
    dto: TagsModificationDTO | null,
    field: 'tags',
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (typeof dto === 'undefined' || (dto && Object.keys(dto).length === 0)) {
      return {
        data: [],
        logId: null,
      }
    }

    const tasksToUpdate: TaskEditDTO[] = []

    const existingTasks = await this.taskService.getByCriteria({ ids: taskIds }, user.id, session)

    for (const task of existingTasks) {
      const updatedTask = {
        id: task.id.toString(),
      } as TaskEditDTO

      if (dto === null) updatedTask[field] = []
      else {
        if (typeof dto.set !== 'undefined') updatedTask[field] = dto.set
        if (typeof dto.add !== 'undefined')
          updatedTask[field] = [...new Set([...(task[field] || []), ...dto.add])]
        if (typeof dto.remove !== 'undefined')
          updatedTask[field] = (task[field] || []).filter(
            (tag) => !dto.remove!.includes(String(tag)),
          )
      }

      tasksToUpdate.push(updatedTask)
    }

    return await this.taskService.editMany(tasksToUpdate, user, session)
  }

  public async translateEditColorAndExecute(
    taskIds: string[],
    dto: EditTasksColorDTO['update'] | null,
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (typeof dto === 'undefined' || (dto && Object.keys(dto).length === 0)) {
      return {
        data: [],
        logId: null,
      }
    }

    const updateDTO: Omit<TaskEditDTO, 'id'> = {}

    if (dto === null) updateDTO.color = null
    else {
      updateDTO.color = getColorByNameAndTone(dto.color, dto.tone || 'medium')
    }

    return await this.taskService.edit(updateDTO, { ids: taskIds }, user, session)
  }

  public async translateEditCategoryAndExecute(
    taskIds: string[],
    categoryId: string,
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<ITaskPopulated[]>> {
    if (!categoryId) {
      return {
        data: [],
        logId: null,
      }
    }

    const tasksToUpdate: TaskEditDTO[] = []

    const existingTasks = await this.taskService.getByCriteria({ ids: taskIds }, user.id, session)

    for (const task of existingTasks) {
      const updatedTask = {
        id: task.id.toString(),
      } as TaskEditDTO

      updatedTask.categoryId = categoryId

      const categoryCount = await this.categoryService.getCount(
        { id: categoryId },
        user.id,
        session,
      )

      if (categoryCount === 0) {
        throw new NotFoundError(`Category with id ${categoryId} not found`)
      }

      tasksToUpdate.push(updatedTask)
    }

    return await this.taskService.editMany(tasksToUpdate, user, session)
  }
}
