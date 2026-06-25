import { IWorkspace } from '@entities/IWorkspace.js'
import { IWorkspaceRaw } from '@entities/IWorkspaceRaw.js'
import WorkspaceRepository from '@repositories/WorkspaceRepository.js'
import { WorkspaceDTO } from '@dtos/WorkspaceDTO.js'
import mongoose, { ClientSession, Types } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.js'
import { IWorkspaceCriteria } from '@criterias/IWorkspaceCriteria.js'
import { OperationLogService } from '@application/services/OperationLogService.js'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.js'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.js'
import { WorkspaceEditDTO } from '@dtos/WorkspaceEditDTO.js'
import { NotFoundError } from '@errors/NotFound.js'
import { BoardService } from '@application/services/BoardService.js'
import { SingleUpdateDTO } from '../dtos/SingleUpdateDTO.js'
import { IUser } from '@entities/IUser.js'
import { projectProperties } from '@/utils/projectProperties.js'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'
import { IOperationLog } from '@/domain/entities/IOperationLog.js'
import { BASE_COLORS_MAP } from '@/constants/BASE_COLORS.js'
import { ColumnService } from '@application/services/ColumnService.js'
import { TaskService } from '@application/services/TaskService.js'
import { AppError } from '@/domain/errors/AppError.js'
import { LifecycleDTO } from '@dtos/LifecycleDTO.js'
import { BaseService } from '@application/services/BaseService.js'
import { IWorkspaceCreatePayload } from '@interfaces/IWorkspaceCreatePayload.js'
import { SafeUpdateData } from '@/infrastructure/types/SafeUpdateData.js'
import { LimitService } from './LimitService.js'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.js'
import { LexoRank } from 'lexorank'
import { WorkspaceMoveDTO } from '../dtos/WorkspaceMoveDTO.js'
import { WorkspaceMoveManyDTO } from '../dtos/WorkspaceMoveManyDTO.js'
import { WorkspaceReorderDTO } from '../dtos/WorkspaceReorderDTO.js'
import { WelcomeDTO } from '../dtos/WelcomeDTO.js'
import { UserService } from './UserService.js'

const MAX_RETRIES = 3

export class WorkspaceService extends BaseService<
  IWorkspaceRaw,
  IWorkspace,
  IWorkspaceCriteria,
  IWorkspace,
  IWorkspaceCreatePayload
> {
  protected repository: WorkspaceRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected boardService: BoardService
  protected columnService: ColumnService
  protected taskService: TaskService
  protected limitService: LimitService
  protected userService: UserService

  constructor(
    workspaceRepository: WorkspaceRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    boardService: BoardService,
    columnService: ColumnService,
    taskService: TaskService,
    limitService: LimitService,
    userService: UserService,
  ) {
    super(workspaceRepository)

    this.repository = workspaceRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.boardService = boardService
    this.columnService = columnService
    this.taskService = taskService
    this.limitService = limitService
    this.userService = userService
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
      500,
    )
  }

  private async _executeCreateTransaction(
    data: WorkspaceDTO,
    user: IUser,
    session: ClientSession,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    /** LIMITS CHECK */
    await this.limitService.checkWorkspacesLimit(user, 1, session)

    const workspacePayload = await this.prepareWorkspaceCreationPayload(data, user.id, session)

    /* CREATE */
    const newWorkspace = await this.repository.create(workspacePayload, session)

    const sideEffects: Promise<any>[] = []

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesAfter: [newWorkspace],
        dependencies: [],
      },
      user.id,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    return {
      data: [newWorkspace],
      logId: log.id,
    }
  }

  public async create(
    data: WorkspaceDTO,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    if (externalSession) {
      return this._executeCreateTransaction(data, user, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateTransaction(data, user, session),
      )
    }
  }

  private async _executeCreateManyTransaction(
    data: WorkspaceDTO[],
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    /** LIMITS CHECK */
    await this.limitService.checkWorkspacesLimit(user, data.length, session)

    const workspacesPayload = await this.prepareWorkspacesCreationPayload(
      data,
      user.id,
      session,
      isDryRun,
    )

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesAfter: workspacesPayload,
          dependencies: [],
          status: OperationLogStatusesEnum.PENDING,
        },
        user.id,
        session,
      )

      return {
        data: [],
        logId: log.id,
      }
    }

    /* CREATE */
    const newWorkspaces = await this.repository.createMany(workspacesPayload, session)

    const sideEffects: Promise<any>[] = []

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CREATE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesAfter: newWorkspaces,
        dependencies: [],
      },
      user.id,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    return {
      data: newWorkspaces,
      logId: log.id,
    }
  }

  public async createMany(
    data: WorkspaceDTO[],
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    if (externalSession) {
      return this._executeCreateManyTransaction(data, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCreateManyTransaction(data, user, session, isDryRun),
      )
    }
  }

  private async _executeEditTransaction(
    data: Omit<WorkspaceEditDTO, 'id'>,
    criteria: IWorkspaceCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const workspacesToUpdate: IWorkspace[] = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

    if (workspacesToUpdate.length === 0)
      throw new NotFoundError('Рабочие пространства для редактирования не найдены.')

    const workspacePayload = await this.prepareWorkspaceEditPayload(data, workspacesToUpdate)
    const workspacesBefore = projectProperties<IWorkspace>(workspacesToUpdate, workspacePayload)

    /* UPDATE */
    const updateManyResult = await this.repository.updateManyByCriteria(
      criteria,
      workspacePayload,
      session,
      userId,
    )

    if (updateManyResult.modifiedCount === 0)
      throw new AppError('Не удалось обновить рабочие пространства.', 500)

    const updatedWorkspaces = await this.repository.findByCriteria<IWorkspace>(
      criteria,
      session,
      undefined,
      userId,
    )

    const sideEffects: Promise<any>[] = []

    /* LOG */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesBefore: workspacesBefore,
        entitiesAfter: projectProperties<IWorkspace>(updatedWorkspaces, workspacePayload),
        dependencies: [],
      },
      userId,
      session,
    )

    sideEffects.push(logPromise)

    await Promise.all(sideEffects)

    const log = await logPromise

    return {
      data: updatedWorkspaces,
      logId: log.id,
    }
  }

  public async edit(
    data: Omit<WorkspaceEditDTO, 'id'>,
    criteria: IWorkspaceCriteria,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditTransaction(data, criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditTransaction(data, criteria, userId, session),
      )
    }
  }

  private async _executeEditManyTransaction(
    data: WorkspaceEditDTO[],
    userId: Types.ObjectId,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const workspaceIds = data.map((d) => d.id)

    const existingWorkspaces = await this.repository.findByCriteria(
      { ids: workspaceIds },
      session,
      undefined,
      userId,
    )

    if (existingWorkspaces.length === 0) {
      throw new NotFoundError('Рабочие пространства для обновления не найдены.')
    }

    const existingMap = new Map(existingWorkspaces.map((w) => [w.id.toString(), w]))

    const workspacePayloads: SingleUpdateDTO<SafeUpdateData<IWorkspace>>[] = []
    const workspacesBefore: (Partial<IWorkspace> & { id: Types.ObjectId })[] = []

    for (const dto of data) {
      const workspace = existingMap.get(dto.id)
      if (!workspace) continue

      const workspacePayload = await this.prepareWorkspaceEditManyPayload(
        dto,
        [workspace],
        isDryRun,
      )

      const workspaceBefore = projectProperties<IWorkspace>([workspace], workspacePayload)[0]

      workspacesBefore.push(workspaceBefore)
      workspacePayloads.push(workspacePayload)
    }

    if (isDryRun) {
      const workspacesAfter = workspacesBefore.map((w) => {
        const payload = workspacePayloads.find((p) => p.id.toString() === w.id.toString())

        if (!payload) return w

        return {
          ...w,
          ...payload,
        }
      })

      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesBefore: workspacesBefore,
          entitiesAfter: workspacesAfter,
          dependencies: [],
          status: OperationLogStatusesEnum.PENDING,
        },
        userId,
        session,
      )

      return {
        data: [],
        logId: log.id,
      }
    }

    const updatedWorkspacesResult = await this.repository.bulkUpdate(
      workspacePayloads,
      userId,
      session,
    )

    if (!updatedWorkspacesResult || updatedWorkspacesResult.modifiedCount === 0) {
      throw new AppError('Не удалось обновить рабочие пространства.', 500)
    }

    const updatedWorkspaces = await this.repository.findByCriteria(
      { ids: workspacePayloads.map((p) => p.id.toString()) },
      session,
      undefined,
      userId,
    )

    const sideEffects: Promise<any>[] = []

    const projectedUpdatedWorkspaces = updatedWorkspaces.map(
      (w) =>
        projectProperties<IWorkspace>(
          [w],
          workspacePayloads.find((p) => p.id.toString() === w.id.toString())!,
        )[0],
    )

    /** LOGGING */
    const logPromise = this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesBefore: workspacesBefore,
        entitiesAfter: projectedUpdatedWorkspaces,
        dependencies: [],
      },
      userId,
      session,
    )
    sideEffects.push(logPromise)

    /** FINALIZATION */
    await Promise.all(sideEffects)
    const log = await logPromise

    return {
      data: updatedWorkspaces,
      logId: log.id,
    }
  }

  public async editMany(
    data: WorkspaceEditDTO[],
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const userId = user.id

    if (externalSession) {
      return this._executeEditManyTransaction(data, userId, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeEditManyTransaction(data, userId, session, isDryRun),
      )
    }
  }

  private async _executeDeleteTransaction(
    criteria: IWorkspaceCriteria,
    userId: Types.ObjectId,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<null>> {
    const workspaces = await this.getByCriteria({}, userId, session)
    const workspacesToDelete = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      userId,
    )

    if (workspacesToDelete.length === 0) {
      throw new NotFoundError('Рабочие пространства для удаления не найдены.')
    }
    if (
      workspaces.length === 1 &&
      workspacesToDelete.some((ws) => ws.id.toString() === workspaces[0].id.toString())
    ) {
      throw new AppError('Вы не можете удалить единственное рабочее пространство.', 400)
    }

    const status = isDryRun ? OperationLogStatusesEnum.PENDING : OperationLogStatusesEnum.SUCCESS

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.DELETE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesBefore: workspacesToDelete,
        dependencies: [],
        status: status,
      },
      userId,
      session,
    )

    if (isDryRun) {
      return {
        data: null,
        logId: log.id,
      }
    }

    await this.repository.deleteMany(criteria, userId, session)

    const workspacesCriteria = { workspaceIds: workspacesToDelete.map((ws) => ws.id.toString()) }

    await Promise.all([
      this.taskService.deleteTasksByCriteria(workspacesCriteria, userId),
      this.columnService.deleteColumnsByCriteria(workspacesCriteria, userId),
      this.boardService.deleteBoardsByCriteria(workspacesCriteria, userId),
    ])

    return {
      data: null,
      logId: log.id,
    }
  }

  public async delete(
    criteria: IWorkspaceCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<null>> {
    const userId = user.id

    if (externalSession) {
      return this._executeDeleteTransaction(criteria, userId, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeDeleteTransaction(criteria, userId, session, isDryRun),
      )
    }
  }

  private async _executeLifecycleTransaction(
    criteria: IWorkspaceCriteria,
    isRecover: boolean,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
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
    const workspaces = await this.getByCriteria({}, user.id, session)
    const workspacesToProcess = await this.repository.findByCriteria(
      criteria,
      session,
      undefined,
      user.id,
    )

    const workspacesCriteria = { workspaceIds: workspacesToProcess.map((ws) => ws.id.toString()) }

    if (workspacesToProcess.length === 0) throw new NotFoundError('Пространства не найдены.')

    if (isRecover) {
      await this.limitService.checkWorkspacesLimit(user, workspacesToProcess.length, session)
    }

    if (
      !isRecover &&
      workspaces.length === 1 &&
      workspacesToProcess.some((ws) => ws.id.toString() === workspaces[0].id.toString())
    ) {
      throw new AppError('Вы не можете архивировать единственное рабочее пространство.', 400)
    }

    const status = isDryRun ? OperationLogStatusesEnum.PENDING : OperationLogStatusesEnum.SUCCESS

    const entitiesBefore = projectProperties<IWorkspace>(workspacesToProcess, data)
    const entitiesAfter = entitiesBefore.map((w) => ({ ...w, ...data }))

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: isRecover ? OperationTypesEnum.RECOVER : OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesBefore: entitiesBefore,
        entitiesAfter: entitiesAfter,
        status,
        dependencies: [],
      },
      user.id,
      session,
    )

    if (isDryRun) {
      return {
        data: [],
        logId: log.id,
      }
    }

    await Promise.all([
      /* PROCESS CHILDREN */
      this.taskService.updateLifecycleTasksByCriteria(
        workspacesCriteria,
        childrenData,
        user.id,
        session,
      ),
      this.columnService.updateLifecycleColumnsByCriteria(
        workspacesCriteria,
        childrenData,
        user.id,
        session,
      ),
      this.boardService.updateLifecycleBoardsByCriteria(
        workspacesCriteria,
        childrenData,
        user.id,
        session,
      ),

      /* PROCESS WORKSPACES */
      this.repository.updateManyByCriteria(criteria, data, session, user.id),
    ])

    const sideEffects: Promise<any>[] = []

    await Promise.all(sideEffects)

    const updatedWorkspacesPopulated = await this.getByCriteria(
      { ids: entitiesAfter.map((w) => w.id.toString()) },
      user.id,
      session,
    )

    return {
      data: updatedWorkspacesPopulated,
      logId: log.id,
    }
  }

  public async archive(
    criteria: IWorkspaceCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, false, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, false, user, session, isDryRun),
      )
    }
  }

  public async recover(
    criteria: IWorkspaceCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    if (externalSession) {
      return this._executeLifecycleTransaction(criteria, true, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeLifecycleTransaction(criteria, true, user, session, isDryRun),
      )
    }
  }

  private async _getLastRank(userId: Types.ObjectId, session?: ClientSession): Promise<LexoRank> {
    const lastWorkspaces = await this.repository.findByCriteria(
      {},
      session,
      {
        sort: { rank: -1 },
        limit: 1,
      },
      userId,
    )
    const lastWorkspace = lastWorkspaces[0]

    if (!lastWorkspace) {
      return LexoRank.middle()
    }

    return LexoRank.parse(lastWorkspace.rank)
  }

  private async _executeCloneTransaction(
    criteria: IWorkspaceCriteria,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
    tempIds: string[] = [],
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const dependencies: Types.ObjectId[] = []

    const workspacesToClone = await this.repository.findByCriteria(
      criteria,
      session,
      {
        projection: isDryRun ? '-createdAt -updatedAt' : '+embeddings -createdAt -updatedAt',
      },
      user.id,
    )

    if (workspacesToClone.length === 0)
      throw new NotFoundError('Пространства для клонирования не найдены.')

    /** LIMITS CHECK */
    await this.limitService.checkWorkspacesLimit(user, workspacesToClone.length, session)

    let lastRank = await this._getLastRank(user.id, session)

    const transformedWorkspaces: IWorkspaceCreatePayload[] = []

    for (let i = 0; i < workspacesToClone.length; i++) {
      const workspace = workspacesToClone[i]
      const id = tempIds[i] || undefined
      const newRank = lastRank.genNext()

      const cleanWorkspace = {
        ...workspace,
        id: isDryRun ? workspace.id.toString() : id,
        rank: newRank.toString(),
      }

      lastRank = newRank

      transformedWorkspaces.push(cleanWorkspace)
    }

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CLONE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesAfter: transformedWorkspaces,
          dependencies: [],
          status: OperationLogStatusesEnum.PENDING,
        },
        user.id,
        session,
      )

      return {
        data: [],
        logId: log.id,
      }
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
      user.id,
      session,
    )

    if (cloneBoardsResult.logId) dependencies.push(cloneBoardsResult.logId)

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.CLONE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesAfter: newWorkspaces,
        dependencies,
      },
      user.id,
      session,
    )

    return {
      data: newWorkspaces,
      logId: log.id,
    }
  }

  public async clone(
    criteria: IWorkspaceCriteria,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
    tempIds: string[] = [],
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    if (externalSession) {
      return this._executeCloneTransaction(criteria, user, externalSession, isDryRun, tempIds)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeCloneTransaction(criteria, user, session, isDryRun, tempIds),
      )
    }
  }

  public async move(
    dto: WorkspaceMoveDTO,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    if (externalSession) {
      return this._executeMoveTransaction(dto, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeMoveTransaction(dto, user, session, isDryRun),
      )
    }
  }

  private async _executeMoveTransaction(
    dto: WorkspaceMoveDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const { beforeId, afterId, id } = dto

    const workspaceIds = [id, beforeId, afterId].filter(Boolean) as string[]
    const workspaces = await this.repository.findByCriteria(
      { ids: workspaceIds },
      session,
      undefined,
      user.id,
    )

    const workspace = workspaces.find((t) => t.id.toString() === id)
    const beforeWorkspace = beforeId ? workspaces.find((t) => t.id.toString() === beforeId) : null
    const afterWorkspace = afterId ? workspaces.find((t) => t.id.toString() === afterId) : null

    if (!workspace) throw new NotFoundError('Рабочее пространство не найдено.')

    let newRank: LexoRank

    if (beforeWorkspace && afterWorkspace) {
      newRank = LexoRank.parse(beforeWorkspace.rank).between(LexoRank.parse(afterWorkspace.rank))
    } else if (beforeWorkspace) {
      newRank = LexoRank.parse(beforeWorkspace.rank).genPrev()
    } else if (afterWorkspace) {
      newRank = LexoRank.parse(afterWorkspace.rank).genNext()
    } else newRank = LexoRank.middle()

    const updateData: SafeUpdateData<IWorkspace> = {
      rank: newRank.toString(),
    }

    const workspacesBefore = projectProperties<IWorkspace>([workspace], updateData)
    const workspacesAfter = workspacesBefore.map((t) => ({
      ...t,
      ...updateData,
    }))

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesBefore: workspacesBefore,
          entitiesAfter: workspacesAfter,
          dependencies: [],
          status: OperationLogStatusesEnum.PENDING,
        },
        user.id,
        session,
      )

      return {
        data: [],
        logId: log.id,
      }
    }

    await this.repository.updateManyByCriteria({ id }, updateData, session, user.id)

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesBefore: workspacesBefore,
        entitiesAfter: workspacesAfter,
        dependencies: [],
        status: OperationLogStatusesEnum.SUCCESS,
      },
      user.id,
      session,
    )

    const updatedWorkspaces = await this.getByCriteria({ id }, user.id, session)

    return {
      data: updatedWorkspaces,
      logId: log.id,
    }
  }

  public async moveMany(
    dto: WorkspaceMoveManyDTO,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    if (externalSession) {
      return this._executeMoveManyTransaction(dto, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeMoveManyTransaction(dto, user, session, isDryRun),
      )
    }
  }

  private async _executeMoveManyTransaction(
    dto: WorkspaceMoveManyDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const { ids, beforeWorkspaceId, afterWorkspaceId, toStart, toEnd } = dto

    const uniqueWorkspaceIds = [...new Set(ids)]
    if (uniqueWorkspaceIds.length === 0) {
      throw new NotFoundError('Рабочие пространства не найдены.')
    }

    if (toStart && toEnd) {
      throw new AppError(
        'Нельзя переместить рабочие пространства одновременно в начало и в конец.',
        400,
      )
    }

    if ((toStart || toEnd) && (beforeWorkspaceId || afterWorkspaceId)) {
      throw new AppError(
        'Нельзя одновременно использовать beforeWorkspaceId/afterWorkspaceId и toStart/toEnd.',
        400,
      )
    }

    if (beforeWorkspaceId && uniqueWorkspaceIds.includes(beforeWorkspaceId)) {
      throw new AppError(
        'beforeWorkspaceId не может быть среди перемещаемых рабочих пространств.',
        400,
      )
    }

    if (afterWorkspaceId && uniqueWorkspaceIds.includes(afterWorkspaceId)) {
      throw new AppError(
        'afterWorkspaceId не может быть среди перемещаемых рабочих пространств.',
        400,
      )
    }

    const relatedWorkspaceIds = [
      ...new Set([...uniqueWorkspaceIds, beforeWorkspaceId, afterWorkspaceId].filter(Boolean)),
    ]
    const workspaces = await this.repository.findByCriteria(
      { ids: relatedWorkspaceIds as string[] },
      session,
      undefined,
      user.id,
    )

    const workspacesToMove = workspaces
      .filter((workspace) => uniqueWorkspaceIds.includes(workspace.id.toString()))
      .sort((a, b) => a.rank.localeCompare(b.rank))

    if (workspacesToMove.length !== uniqueWorkspaceIds.length) {
      throw new NotFoundError('Рабочие пространства не найдены.')
    }

    const beforeWorkspace = beforeWorkspaceId
      ? workspaces.find((w) => w.id.toString() === beforeWorkspaceId)
      : null
    const afterWorkspace = afterWorkspaceId
      ? workspaces.find((w) => w.id.toString() === afterWorkspaceId)
      : null

    if (beforeWorkspaceId && !beforeWorkspace) {
      throw new NotFoundError('Опорное рабочее пространство beforeWorkspaceId не найдено.')
    }

    if (afterWorkspaceId && !afterWorkspace) {
      throw new NotFoundError('Опорное рабочее пространство afterWorkspaceId не найдено.')
    }

    let newRanks: string[] = []

    if (toStart) {
      const firstWorkspaces = await this.repository.findByCriteria(
        {},
        session,
        { sort: { rank: 1 }, limit: 1 },
        user.id,
      )

      if (firstWorkspaces.length > 0) {
        const generatedRanks: string[] = []
        let rankCursor = LexoRank.parse(firstWorkspaces[0].rank)

        for (let i = 0; i < workspacesToMove.length; i++) {
          rankCursor = rankCursor.genPrev()
          generatedRanks.push(rankCursor.toString())
        }

        newRanks = generatedRanks.reverse()
      } else {
        let rankCursor = LexoRank.middle()
        for (let i = 0; i < workspacesToMove.length; i++) {
          rankCursor = rankCursor.genNext()
          newRanks.push(rankCursor.toString())
        }
      }
    } else if (beforeWorkspace && afterWorkspace) {
      let left = LexoRank.parse(beforeWorkspace.rank)
      const right = LexoRank.parse(afterWorkspace.rank)

      for (let i = 0; i < workspacesToMove.length; i++) {
        left = left.between(right)
        newRanks.push(left.toString())
      }
    } else if (beforeWorkspace) {
      const generatedRanks: string[] = []
      let rankCursor = LexoRank.parse(beforeWorkspace.rank)

      for (let i = 0; i < workspacesToMove.length; i++) {
        rankCursor = rankCursor.genPrev()
        generatedRanks.push(rankCursor.toString())
      }

      newRanks = generatedRanks.reverse()
    } else if (afterWorkspace) {
      let rankCursor = LexoRank.parse(afterWorkspace.rank)

      for (let i = 0; i < workspacesToMove.length; i++) {
        rankCursor = rankCursor.genNext()
        newRanks.push(rankCursor.toString())
      }
    } else {
      const lastWorkspaces = await this.repository.findByCriteria(
        {},
        session,
        { sort: { rank: -1 }, limit: 1 },
        user.id,
      )

      let rankCursor = lastWorkspaces.length
        ? LexoRank.parse(lastWorkspaces[0].rank)
        : LexoRank.middle()

      for (let i = 0; i < workspacesToMove.length; i++) {
        rankCursor = rankCursor.genNext()
        newRanks.push(rankCursor.toString())
      }
    }

    const updatesWithMetadata = workspacesToMove.map((workspace, index) => ({
      workspace,
      updateData: {
        id: workspace.id,
        rank: newRanks[index],
      } as SingleUpdateDTO<SafeUpdateData<IWorkspace>>,
    }))

    const entitiesBefore = updatesWithMetadata.map(
      ({ workspace, updateData }) => projectProperties<IWorkspace>([workspace], updateData)[0],
    )
    const entitiesAfter = entitiesBefore.map((beforeEntity, index) => ({
      ...beforeEntity,
      ...updatesWithMetadata[index].updateData,
    }))

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesBefore,
          entitiesAfter,
          dependencies: [],
          status: OperationLogStatusesEnum.PENDING,
        },
        user.id,
        session,
      )

      return {
        data: [],
        logId: log.id,
      }
    }

    const updateResult = await this.repository.bulkUpdate(
      updatesWithMetadata.map(({ updateData }) => updateData),
      user.id,
      session,
    )

    if (!updateResult || updateResult.modifiedCount === 0) {
      throw new AppError('Не удалось переместить рабочие пространства.', 500)
    }

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesBefore,
        entitiesAfter,
        dependencies: [],
        status: OperationLogStatusesEnum.SUCCESS,
      },
      user.id,
      session,
    )

    const updatedWorkspaces = await this.getByCriteria(
      { ids: workspacesToMove.map((w) => w.id.toString()) },
      user.id,
      session,
    )

    return {
      data: updatedWorkspaces,
      logId: log.id,
    }
  }

  public async reorder(
    dto: WorkspaceReorderDTO,
    user: IUser,
    externalSession?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    if (externalSession) {
      return this._executeReorderTransaction(dto, user, externalSession, isDryRun)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeReorderTransaction(dto, user, session, isDryRun),
      )
    }
  }

  private async _executeReorderTransaction(
    dto: WorkspaceReorderDTO,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    const { ids } = dto

    const workspaces = await this.repository.findByCriteria({ ids }, session, undefined, user.id)

    if (workspaces.length !== ids.length) {
      throw new NotFoundError('Рабочие пространства не найдены.')
    }

    const bulkUpdates: SingleUpdateDTO<SafeUpdateData<IWorkspace>>[] = []
    let currentRank = LexoRank.middle()

    const workspacesMap = new Map(workspaces.map((w) => [w.id.toString(), w]))

    ids.forEach((workspaceId, index) => {
      bulkUpdates.push({
        id: new Types.ObjectId(workspaceId),
        rank: currentRank.toString(),
      })

      if (index < ids.length - 1) {
        currentRank = currentRank.genNext()
      }
    })

    const updatesWithMetadata = bulkUpdates.map((updateData) => {
      const workspace = workspacesMap.get(updateData.id.toString())!
      return { workspace, updateData }
    })

    const entitiesBefore = updatesWithMetadata.map(
      ({ workspace, updateData }) => projectProperties<IWorkspace>([workspace], updateData)[0],
    )
    const entitiesAfter = entitiesBefore.map((beforeEntity, index) => ({
      ...beforeEntity,
      ...updatesWithMetadata[index].updateData,
    }))

    if (isDryRun) {
      const log = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesBefore,
          entitiesAfter,
          dependencies: [],
          status: OperationLogStatusesEnum.PENDING,
        },
        user.id,
        session,
      )

      return {
        data: [],
        logId: log.id,
      }
    }

    const updateResult = await this.repository.bulkUpdate(bulkUpdates, user.id, session)

    if (!updateResult || updateResult.modifiedCount === 0) {
      throw new AppError('Не удалось переупорядочить рабочие пространства.', 500)
    }

    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.UPDATE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesBefore,
        entitiesAfter,
        dependencies: [],
        status: OperationLogStatusesEnum.SUCCESS,
      },
      user.id,
      session,
    )

    const updatedWorkspaces = await this.getByCriteria({ ids }, user.id, session)

    return {
      data: updatedWorkspaces,
      logId: log.id,
    }
  }

  public async revert(
    log: IOperationLog,
    user: IUser,
    session: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IResponseWithLog<any>> {
    const { operationType } = log

    const before = log.entitiesBefore as (Partial<IWorkspace> & { id: Types.ObjectId })[]
    const after = log.entitiesAfter as (Partial<IWorkspace> & { id: Types.ObjectId })[]

    const idsBefore = before?.map((e) => e.id?.toString()) || []
    const idsAfter = after?.map((e) => e.id?.toString()) || []

    switch (operationType) {
      case OperationTypesEnum.CREATE:
      case OperationTypesEnum.CLONE: {
        return await this.delete({ ids: idsAfter }, user, session, isDryRun)
      }

      case OperationTypesEnum.UPDATE: {
        const payload = before.map((e) => ({
          ...e,
          id: e.id?.toString(),
        }))

        return await this.editMany(payload, user, session, isDryRun)
      }

      case OperationTypesEnum.ARCHIVE: {
        return await this.recover({ ids: idsBefore }, user, session, isDryRun)
      }

      case OperationTypesEnum.RECOVER: {
        return await this.archive({ ids: idsBefore }, user, session, isDryRun)
      }

      default:
        throw new AppError(`Операция ${operationType} не поддерживается для отката.`, 400)
    }
  }

  private async prepareWorkspaceCreationPayload(
    data: WorkspaceDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<IWorkspaceCreatePayload> {
    const workspaceName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(workspaceName)

    const lastRank = await this._getLastRank(userId, session)

    const workspacePayload: IWorkspaceCreatePayload = {
      name: workspaceName,
      isFavorite: data.isFavorite || false,
      rank: lastRank.toString(),
      color: data.color,
      colorName: '',
      embeddings,
      userId,
    }

    if (data.color && BASE_COLORS_MAP[data.color]) {
      workspacePayload.colorName = BASE_COLORS_MAP[data.color].name
    }

    return workspacePayload
  }

  private async prepareWorkspacesCreationPayload(
    data: WorkspaceDTO[],
    userId: Types.ObjectId,
    session?: ClientSession,
    isDryRun: boolean = false,
  ): Promise<IWorkspaceCreatePayload[]> {
    let lastRank = await this._getLastRank(userId, session)

    const embeddingsMap: { [key: string]: number[] } = {}

    if (!isDryRun) {
      const workspaceNames = Array.from(new Set(data.map((workspace) => workspace.name.trim())))
      const embeddingsArray =
        await this.embeddingService.getEmbeddingsForMultipleTexts(workspaceNames)
      workspaceNames.forEach((name, index) => {
        embeddingsMap[name] = embeddingsArray[index]
      })
    }

    const workspacePayloads: IWorkspaceCreatePayload[] = data.map((dto) => {
      const newRank = lastRank.genNext()

      const payload = {
        id: dto.id,
        name: dto.name.trim(),
        rank: newRank.toString(),
        color: dto.color,
        colorName: '',
        isFavorite: dto.isFavorite || false,
        embeddings: embeddingsMap[dto.name.trim()],
        userId,
      }

      lastRank = newRank

      if (dto.color && BASE_COLORS_MAP[dto.color]) {
        payload.colorName = BASE_COLORS_MAP[dto.color].name
      }

      return payload
    })

    return workspacePayloads
  }

  private async _prepareMainEditFields(
    data: Omit<WorkspaceEditDTO, 'id'>,
    workspacePayload: SafeUpdateData<IWorkspace>,
    workspacesToUpdate: IWorkspace[],
    isDryRun: boolean = false,
  ) {
    if (!isDryRun && data.name && workspacesToUpdate.length > 0) {
      const needEmbeddingsUpdate = workspacesToUpdate.some(
        (ws) => data.name && ws.name.trim() !== data.name.trim(),
      )

      const workspaceName = data.name.trim()

      if (needEmbeddingsUpdate) {
        const embeddings = await this.embeddingService.getEmbeddings(workspaceName)

        workspacePayload.embeddings = embeddings
      }
    }
  }

  private async prepareWorkspaceEditPayload(
    data: Omit<WorkspaceEditDTO, 'id'>,
    workspacesToUpdate: IWorkspace[],
  ): Promise<SafeUpdateData<IWorkspace>> {
    const workspacePayload: SafeUpdateData<IWorkspace> = {
      ...data,
    }

    await this._prepareMainEditFields(data, workspacePayload, workspacesToUpdate)

    return workspacePayload
  }

  private async prepareWorkspaceEditManyPayload(
    data: WorkspaceEditDTO,
    workspacesToUpdate: IWorkspace[],
    isDryRun: boolean = false,
  ): Promise<SingleUpdateDTO<SafeUpdateData<IWorkspace>>> {
    const { id, ...rest } = data

    const workspacePayload: SingleUpdateDTO<SafeUpdateData<IWorkspace>> = {
      ...rest,

      id: new Types.ObjectId(id),
    }

    await this._prepareMainEditFields(rest, workspacePayload, workspacesToUpdate, isDryRun)

    return workspacePayload
  }

  public async welcome(payload: WelcomeDTO, user: IUser): Promise<IWorkspace> {
    const session = await mongoose.startSession()

    session.startTransaction()

    const { workspaceName, workspaceColor, username } = payload

    try {
      const newWorkspaceResult = await this.create(
        {
          name: workspaceName,
          color: workspaceColor,
        },
        user,
        session,
      )

      await this.userService.edit(
        {
          username,
        },
        { id: user.id.toString() },
        user,
        session,
      )

      const newWorkspace = newWorkspaceResult.data[0]

      session.commitTransaction()

      return newWorkspace
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }
}
