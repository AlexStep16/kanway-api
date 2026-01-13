import { IWorkspace } from '@entities/IWorkspace.ts'
import { IWorkspaceRaw } from '@entities/IWorkspaceRaw.ts'
import WorkspaceRepository from '@repositories/WorkspaceRepository.ts'
import { WorkspaceDTO } from '@dtos/WorkspaceDTO.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { IWorkspaceCriteria } from '@criterias/IWorkspaceCriteria.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { toMongoCaseKeys } from '@utils/objectTransformers.ts'
import { WorkspaceEditDTO } from '@dtos/WorkspaceEditDTO.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { BoardService } from '@application/services/BoardService.ts'
import { ClonedWorkspacesResult } from '@dtos/ClonedWorkspacesResult.ts'
import { SingleUpdateDTO } from '../dtos/SingleUpdateDTO.ts'
import { IUser } from '@entities/IUser.ts'
import { IWorkspacesWithChildrenResponse } from '@/application/interfaces/IWorkspacesWithChildrenResponse.ts'
import { projectProperties } from '@/utils/projectProperties.ts'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { IOperationLog } from '@/domain/entities/IOperationLog.ts'
import { IUndoResponse } from '../interfaces/IUndoResponse.ts'
import { BASE_COLORS, BASE_COLORS_MAP } from '@/constants/BASE_COLORS.ts'
import chroma from 'chroma-js'
import { CategoryService } from '@application/services/CategoryService.ts'
import { TaskService } from '@application/services/TaskService.ts'
import { AppError } from '@/domain/errors/AppError.ts'
import { LifecycleDTO } from '@dtos/LifecycleDTO.ts'
import { BaseService } from '@application/services/BaseService.ts'

const MAX_RETRIES = 3

export class WorkspaceService extends BaseService<IWorkspaceRaw, IWorkspace, IWorkspaceCriteria> {
  protected repository: WorkspaceRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderService<IWorkspace, IWorkspaceRaw>
  protected boardService: BoardService
  protected categoryService: CategoryService
  protected taskService: TaskService

  constructor(
    workspaceRepository: WorkspaceRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<IWorkspace, IWorkspaceRaw>,
    boardService: BoardService,
    categoryService: CategoryService,
    taskService: TaskService
  ) {
    super(workspaceRepository)

    this.repository = workspaceRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.reorderService = reorderService
    this.boardService = boardService
    this.categoryService = categoryService
    this.taskService = taskService
  }

  private async _retryExecutor<T>(executor: (session: ClientSession) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const session = await mongoose.startSession()
      session.startTransaction()
      try {
        const result = await executor(session)

        await session.commitTransaction()

        return result
      } catch (error: any) {
        await session.abortTransaction()

        if (error.code === 112 && attempt < MAX_RETRIES) {
          console.warn(`Конфликт записи в базу данных ${attempt}. Повторная попытка...`)

          await new Promise((resolve) => setTimeout(resolve, 50 * attempt))
          continue
        }

        throw error
      } finally {
        session.endSession()
      }
    }
    throw new AppError(
      'Произошла ошибка при выполнении операции после максимального количества попыток.',
      500
    )
  }

  private async _executeCreateTransaction(
    data: WorkspaceDTO,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    let reorderedWorkspaces: IWorkspace[] = []

    const finalEntitiesMap = new Map<string, IWorkspace>()
    const workspacePayload = await this.prepareWorkspaceCreationPayload(data, userId, session)

    /* CREATE */
    const newWorkspace = await this.repository.create(workspacePayload, session)

    /* REORDER */
    if (data.order !== undefined) {
      reorderedWorkspaces = await this.reorderService.reorder(
        'userId',
        [newWorkspace],
        userId,
        session
      )
    }

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesAfter: [newWorkspace],
        dependencies: [],
      },
      userId,
      session
    )

    finalEntitiesMap.set(newWorkspace.id.toString(), newWorkspace)

    if (reorderedWorkspaces.length > 0) {
      reorderedWorkspaces.forEach((reorderedWorkspace) => {
        finalEntitiesMap.set(reorderedWorkspace.id.toString(), reorderedWorkspace)
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()),
      logId: log.id,
    }
  }

  public async create(
    data: WorkspaceDTO,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCreateTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, userId, session)
      )
    }
  }

  private async _executeCreateManyTransaction(
    data: WorkspaceDTO[],
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    let reorderedWorkspaces: IWorkspace[] = []

    const finalEntitiesMap = new Map<string, IWorkspace>()
    const workspacesPayload = await this.prepareWorkspacesCreationPayload(data, userId, session)

    /* CREATE */
    const newWorkspaces = await this.repository.createMany(workspacesPayload, session)

    /* REORDER */
    const isReorderNeeded = data.some((ws) => ws.order !== undefined)

    if (isReorderNeeded) {
      const workspacesToReorder = newWorkspaces.filter((_, index) => {
        return data[index].order !== undefined
      })

      reorderedWorkspaces = await this.reorderService.reorder(
        'userId',
        workspacesToReorder,
        userId,
        session
      )
    }

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesAfter: newWorkspaces,
        dependencies: [],
      },
      userId,
      session
    )

    newWorkspaces.forEach((newWorkspace) => {
      finalEntitiesMap.set(newWorkspace.id.toString(), newWorkspace)
    })

    if (reorderedWorkspaces.length > 0) {
      reorderedWorkspaces.forEach((reorderedWorkspace) => {
        finalEntitiesMap.set(reorderedWorkspace.id.toString(), reorderedWorkspace)
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()),
      logId: log.id,
    }
  }

  public async createMany(
    data: WorkspaceDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCreateManyTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, userId, session)
      )
    }
  }

  private async _executeEditTransaction(
    data: WorkspaceEditDTO,
    criteria: IWorkspaceCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    let reorderedWorkspaces: IWorkspace[] = []

    const finalEntitiesMap = new Map<string, IWorkspace>()
    const workspacesToUpdate: IWorkspace[] = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId
    )

    if (workspacesToUpdate.length === 0)
      throw new NotFoundError('Пространства для редактирования не найдены.')

    const workspacePayload = await this.prepareWorkspaceEditPayload(data, workspacesToUpdate)
    const workspacesBefore = projectProperties<IWorkspace>(workspacesToUpdate, workspacePayload)

    /* UPDATE */
    const newEntities = await this.repository.updateManyByCriteria(
      criteria,
      workspacePayload,
      session,
      userId
    )
    const newEntity = newEntities[0]

    if (!newEntity) {
      return {
        data: [],
        logId: null,
      }
    }

    newEntities.forEach((newWorkspace) => {
      finalEntitiesMap.set(newWorkspace.id.toString(), newWorkspace)
    })

    /* REORDER */
    const workspacesToReorder = workspacesToUpdate.filter(
      (ws) => data.order !== undefined && ws.order !== data.order
    )
    if (workspacesToReorder.length > 0) {
      reorderedWorkspaces = await this.reorderService.reorder(
        'userId',
        workspacesToReorder,
        userId,
        session
      )

      reorderedWorkspaces.forEach((reorderedWorkspace) => {
        finalEntitiesMap.set(reorderedWorkspace.id.toString(), reorderedWorkspace)
      })
    }

    const finalEntities = Array.from(finalEntitiesMap.values())

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesBefore: workspacesBefore,
        entitiesAfter: finalEntities,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      data: finalEntities,
      logId: log.id,
    }
  }

  public async edit(
    data: WorkspaceEditDTO,
    criteria: IWorkspaceCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditTransaction(data, criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, userId, session)
      )
    }
  }

  private async _executeEditManyTransaction(
    data: WorkspaceEditDTO[],
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    let workspaceIdsToReorder: string[] = []
    let reorderedWorkspaces: IWorkspace[] = []

    const finalEntitiesMap = new Map<string, IWorkspace>()
    const workspacesToUpdate: SingleUpdateDTO<Partial<IWorkspace>>[] = []
    const workspacesBefore: Partial<IWorkspace>[] = []

    const workspaceIds = data.map((d) => d.id)

    const existingWorkspaces: IWorkspace[] = await this.repository.findByCriteria(
      { ids: workspaceIds },
      session,
      undefined,
      userId
    )

    if (existingWorkspaces.length === 0)
      throw new NotFoundError('Рабочие пространства для обновления не найдены.')

    for (const dto of data) {
      const workspace = existingWorkspaces.find((c) => c.id.toString() === dto.id)

      if (!workspace) continue

      const workspacePayload = await this.prepareWorkspaceEditPayload(dto, [workspace])
      workspacesBefore.push(projectProperties<IWorkspace>([workspace], workspacePayload)[0])

      workspacesToUpdate.push(workspacePayload)

      if (dto.order != null && workspace.order !== dto.order) {
        workspaceIdsToReorder.push(workspacePayload._id.toString())
      }
    }

    /* BULK UPDATE */
    const updatedWorkspaces = await this.repository.bulkUpdate(workspacesToUpdate, userId, session)

    updatedWorkspaces.forEach((updatedWorkspace) => {
      finalEntitiesMap.set(updatedWorkspace.id.toString(), updatedWorkspace)
    })

    /* REORDER */
    if (workspaceIdsToReorder.length > 0) {
      const updatedWorkspacesToReorder = updatedWorkspaces.filter((uc) =>
        workspaceIdsToReorder.includes(uc.id.toString())
      )

      if (updatedWorkspacesToReorder.length > 0) {
        reorderedWorkspaces = await this.reorderService.reorder(
          'userId',
          updatedWorkspacesToReorder,
          userId,
          session
        )

        reorderedWorkspaces.forEach((reorderedWorkspace) => {
          finalEntitiesMap.set(reorderedWorkspace.id.toString(), reorderedWorkspace)
        })
      }
    }

    const finalEntities = Array.from(finalEntitiesMap.values())

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesBefore: workspacesBefore,
        entitiesAfter: finalEntities,
        dependencies: [],
      },
      userId,
      session
    )

    return {
      data: finalEntities,
      logId: log.id,
    }
  }

  public async editMany(
    data: WorkspaceEditDTO[],
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditManyTransaction(data, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session)
      )
    }
  }

  private async _executeDeleteTransaction(
    criteria: IWorkspaceCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IWorkspace[]> {
    let reorderedWorkspaces: IWorkspace[] = []

    const workspacesToDelete = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId
    )
    const workspacesFilter = { workspaceIds: workspacesToDelete.map((ws) => ws.id.toString()) }

    if (workspacesToDelete.length === 0)
      throw new NotFoundError('Пространства для удаления не найдены.')

    await Promise.all([
      /* DELETE CHILDREN */
      this.taskService.deleteTasksByFilter(workspacesFilter, userId),
      this.categoryService.deleteCategoriesByFilter(workspacesFilter, userId),
      this.boardService.deleteBoardsByFilter(workspacesFilter, userId),

      /* DELETE WORKSPACES */
      this.repository.deleteMany(criteria, userId, session),
    ])

    /* REORDER */
    reorderedWorkspaces = await this.reorderService.reorderByParentIds(
      [userId],
      'userId',
      userId,
      session
    )

    return [...reorderedWorkspaces]
  }

  public async delete(
    criteria: IWorkspaceCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IWorkspace[]> {
    const userId = user.id

    if (externalSession) {
      return this._executeDeleteTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeDeleteTransaction(criteria, userId, session)
      )
    }
  }

  private async _executeLifecycleTransaction(
    criteria: IWorkspaceCriteria,
    isRecover: boolean,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IWorkspacesWithChildrenResponse>> {
    let reorderedWorkspaces: IWorkspace[] = []

    const finalEntitiesMap = new Map<string, IWorkspace>()
    const deleteData: LifecycleDTO = {
      isDeleted: true,
      isDeletedExternal: false,
      deletedTime: new Date(),
    }
    const recoverData: LifecycleDTO = {
      isDeleted: false,
      isDeletedExternal: false,
      deletedTime: null,
    }
    const data = isRecover ? recoverData : deleteData
    const childrenData = { ...data, isDeletedExternal: isRecover ? false : true }
    const workspacesToProcess = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId
    )

    const workspacesCriteria = { workspaceIds: workspacesToProcess.map((ws) => ws.id.toString()) }

    if (workspacesToProcess.length === 0) throw new NotFoundError('Пространства не найдены.')

    const result = await Promise.all([
      /* PROCESS CHILDREN */
      this.taskService.updateTasksByFilter(workspacesCriteria, childrenData, userId, session),
      this.categoryService.updateCategoriesByFilter(
        workspacesCriteria,
        childrenData,
        userId,
        session
      ),
      this.boardService.updateBoardsByFilter(workspacesCriteria, childrenData, userId, session),

      /* PROCESS WORKSPACES */
      this.repository.updateManyByCriteria(criteria, data, session, userId),
    ])

    result[3].forEach((updatedWorkspace) => {
      finalEntitiesMap.set(updatedWorkspace.id.toString(), updatedWorkspace)
    })

    /* REORDER */
    reorderedWorkspaces = await this.reorderService.reorderByParentIds(
      [userId],
      'userId',
      userId,
      session
    )

    reorderedWorkspaces.forEach((reorderedWorkspace) => {
      finalEntitiesMap.set(reorderedWorkspace.id.toString(), reorderedWorkspace)
    })

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesBefore: workspacesToProcess,
        entitiesAfter: result[3],
        dependencies: [],
      },
      userId,
      session
    )

    const finalObj = {
      workspaces: Array.from(finalEntitiesMap.values()),
      tasks: result[0],
      categories: result[1],
      boards: result[2],
    }

    return {
      data: finalObj,
      logId: log.id,
    }
  }

  public async archive(
    criteria: IWorkspaceCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IWorkspacesWithChildrenResponse>> {
    const userId = user.id

    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, false, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, false, userId, session)
      )
    }
  }

  public getNearestColor(hexColor: string) {
    let closestColor: (typeof BASE_COLORS)[number] | (typeof BASE_COLORS)[number] = BASE_COLORS[3]
    let minDistance = Infinity

    for (const colorValue in BASE_COLORS_MAP) {
      const distance = chroma.distance(hexColor, colorValue)

      if (distance < minDistance) {
        minDistance = distance
        closestColor = colorValue as (typeof BASE_COLORS)[number]
      }
    }

    return closestColor
  }

  public async recover(
    criteria: IWorkspaceCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IWorkspacesWithChildrenResponse>> {
    const userId = user.id

    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, true, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, true, userId, session)
      )
    }
  }

  private async _executeCloneTransaction(
    criteria: IWorkspaceCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ClonedWorkspacesResult>> {
    const dependencies: Types.ObjectId[] = []

    const workspacesToClone = await this.repository.findByCriteria(
      criteria,
      session,
      {
        projection: '+embeddings -createdAt -updatedAt',
      },
      userId
    )

    let lastOrderGroupped = await this.repository.getLastOrderGroupedByParents(
      [userId],
      'user_id',
      userId,
      session
    )
    let lastOrder = lastOrderGroupped.length > 0 ? lastOrderGroupped[0].lastOrder : 0

    if (workspacesToClone.length === 0)
      throw new NotFoundError('Пространства для клонирования не найдены.')

    const transformedWorkspaces: Omit<IWorkspace, 'id'>[] = []

    for (const workspace of workspacesToClone) {
      const cleanWorkspace = {
        ...workspace,
        _id: undefined,
        order: ++lastOrder,
      }

      transformedWorkspaces.push(cleanWorkspace)
    }

    const newWorkspaces = await this.repository.createMany(transformedWorkspaces, session)

    const workspaceIdsMap: Map<
      string,
      {
        workspaceId: Types.ObjectId
        workspaceName: string
      }
    > = new Map()

    workspacesToClone.forEach((workspace, index) => {
      workspaceIdsMap.set(workspace.id.toString(), {
        workspaceId: newWorkspaces[index].id,
        workspaceName: newWorkspaces[index].name,
      })
    })

    const cloneBoardsResult = await this.boardService.cloneBoardsByWorkspaces(
      workspaceIdsMap,
      userId,
      session
    )

    if (cloneBoardsResult.logId) dependencies.push(cloneBoardsResult.logId)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesAfter: newWorkspaces,
        dependencies,
      },
      userId,
      session
    )

    const finalObj = {
      workspaces: newWorkspaces,
      boards: cloneBoardsResult.data.boards,
      categories: cloneBoardsResult.data.categories,
      tasks: cloneBoardsResult.data.tasks,
    }

    return {
      data: finalObj,
      logId: log.id,
    }
  }

  public async clone(
    criteria: IWorkspaceCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<ClonedWorkspacesResult>> {
    const userId = user.id

    if (externalSession) {
      return this._executeCloneTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCloneTransaction(criteria, userId, session)
      )
    }
  }

  public async revert(
    log: IOperationLog,
    user: IUser,
    session: ClientSession
  ): Promise<IUndoResponse<Partial<IWorkspacesWithChildrenResponse>>> {
    const entitiesBefore = log.entitiesBefore as (Partial<IWorkspace> & { id: Types.ObjectId })[]
    const entitiesAfter = log.entitiesAfter as IWorkspace[]

    const boardBeforeIds = entitiesBefore.map((e) => e.id.toString())
    const boardAfterIds = entitiesAfter.map((e) => e.id.toString())
    const operationType = log.operationType

    if (operationType === OperationTypesEnum.CREATE) {
      await this.delete({ ids: boardAfterIds }, user, session)

      return {
        delete: { workspaces: entitiesAfter },
      }
    } else if (operationType === OperationTypesEnum.UPDATE) {
      const entitiesBeforeToEditSchema = entitiesBefore.map((e) => {
        return {
          ...e,
          id: e.id.toString(),
        }
      })

      const editResult = await this.editMany(entitiesBeforeToEditSchema, user, session)

      return {
        update: { workspaces: editResult.data },
      }
    } else if (operationType === OperationTypesEnum.ARCHIVE) {
      const recoverResult = await this.recover({ ids: boardBeforeIds }, user, session)

      return {
        update: { workspaces: recoverResult.data.workspaces },
      }
    } else if (operationType === OperationTypesEnum.RECOVER) {
      const archiveResult = await this.archive({ ids: boardBeforeIds }, user, session)

      return {
        update: archiveResult.data,
      }
    } else throw new AppError(`Операция ${operationType} не поддерживается для отката.`, 400)
  }

  private async prepareWorkspaceCreationPayload(
    data: WorkspaceDTO,
    userId: Types.ObjectId,
    session?: ClientSession
  ) {
    const workspaceName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(workspaceName)

    const workspacePayload: Omit<IWorkspace, 'id'> = {
      ...toMongoCaseKeys(data),
      embeddings,
      userId,
    }

    if (data.color && BASE_COLORS_MAP[data.color]) {
      workspacePayload.colorName = BASE_COLORS_MAP[data.color]
    }

    if (data.order === undefined) {
      const lastOrderGroupped = await this.repository.getLastOrderGroupedByParents(
        [userId],
        'user_id',
        userId,
        session
      )
      workspacePayload.order = lastOrderGroupped.length > 0 ? lastOrderGroupped[0].lastOrder + 1 : 1
    }

    return workspacePayload
  }

  private async prepareWorkspacesCreationPayload(
    data: WorkspaceDTO[],
    userId: Types.ObjectId,
    session?: ClientSession
  ) {
    const lastOrderGroupped = await this.repository.getLastOrderGroupedByParents(
      [userId],
      'user_id',
      userId,
      session
    )
    let lastOrder = lastOrderGroupped.length > 0 ? lastOrderGroupped[0].lastOrder : 0
    let newOrder = lastOrder + 1

    const workspaceNames = data.map((workspace) => workspace.name.trim())
    const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(
      workspaceNames
    )

    const workspacePayloads: Omit<IWorkspace, 'id'>[] = data.map((dto, index) => {
      const payload = {
        ...toMongoCaseKeys<IWorkspace>(dto),
        embeddings: embeddingsArray[index],
        user_id: userId,
      }

      if (dto.color && BASE_COLORS_MAP[dto.color]) {
        payload.colorName = BASE_COLORS_MAP[dto.color]
      }

      if (dto.order === undefined) {
        payload.order = newOrder
        newOrder += 1
      }

      return payload
    })

    return workspacePayloads
  }

  private async prepareWorkspaceEditPayload(
    data: WorkspaceEditDTO,
    workspacesToUpdate: IWorkspace[]
  ) {
    const workspacePayload: SingleUpdateDTO<Partial<IWorkspace>> = {
      ...toMongoCaseKeys(data),
    }

    if (data.name && workspacesToUpdate.length > 0) {
      const needEmbeddingsUpdate = workspacesToUpdate.some(
        (ws) => data.name && ws.name.trim() !== data.name.trim()
      )

      const workspaceName = data.name.trim()

      if (needEmbeddingsUpdate) {
        const embeddings = await this.embeddingService.getEmbeddings(workspaceName)

        workspacePayload.embeddings = embeddings
      }
    }

    if (typeof data.order === 'number') {
      workspacePayload.order = data.order
    } else if (typeof data.order === 'string') {
      workspacePayload.order = parseInt(data.order, 10)
    }

    return workspacePayload
  }

  public async updateCounters(
    ids: Types.ObjectId[],
    delta: 1 | -1,
    field: keyof IWorkspaceRaw,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    return await this.repository.increase(
      { ids: ids.map((id) => id.toString()) },
      delta,
      field,
      userId,
      session
    )
  }

  public async updateCountersBulk(
    updates: { ids: Types.ObjectId[]; delta: number; field: string }[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    return await this.repository.increaseBulk(updates, userId, session)
  }
}
