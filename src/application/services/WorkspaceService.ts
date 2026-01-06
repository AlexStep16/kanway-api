import { IWorkspace } from '@entities/IWorkspace.ts'
import { IWorkspaceRaw } from '@entities/IWorkspaceRaw.ts'
import WorkspaceRepository from '@repositories/WorkspaceRepository.ts'
import { WorkspaceDTO } from '@dtos/WorkspaceDTO.ts'
import mongoose, { ClientSession, FilterQuery, Types } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { WorkspaceCriteria } from '@criterias/WorkspaceCriteria.ts'
import { IBaseService } from '@interfaces/IBaseService.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { toServerCaseKeys, toMongoCaseKeys } from '@utils/objectTransformers.ts'
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
import { CategoryService } from './CategoryService.ts'
import { TaskService } from './TaskService.ts'

const MAX_RETRIES = 3

export class WorkspaceService
  implements
    IBaseService<
      IWorkspace,
      WorkspaceCriteria,
      WorkspaceDTO,
      WorkspaceEditDTO,
      ClonedWorkspacesResult,
      IWorkspacesWithChildrenResponse
    >
{
  protected repository: WorkspaceRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderService<IWorkspaceRaw>
  protected boardService: BoardService
  protected categoryService: CategoryService
  protected taskService: TaskService

  constructor(
    workspaceRepository: WorkspaceRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<IWorkspaceRaw>,
    boardService: BoardService,
    categoryService: CategoryService,
    taskService: TaskService
  ) {
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
    throw new Error(
      'Произошла ошибка при выполнении операции после максимального количества попыток.'
    )
  }

  private async _executeCreateTransaction(
    data: WorkspaceDTO,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    let reorderedWorkspaces: IWorkspaceRaw[] = []

    const finalEntitiesMap = new Map<string, IWorkspaceRaw>()
    const workspacePayload = await this.prepareWorkspaceCreationPayload(data, userId, session)

    /* CREATE */
    const newWorkspace = await this.repository.create(workspacePayload, session)

    /* REORDER */
    if (data.order !== undefined) {
      reorderedWorkspaces = await this.reorderService.reorder(
        'user_id',
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

    finalEntitiesMap.set(newWorkspace._id.toString(), newWorkspace)

    if (reorderedWorkspaces.length > 0) {
      reorderedWorkspaces.forEach((reorderedWorkspace) => {
        finalEntitiesMap.set(reorderedWorkspace._id.toString(), reorderedWorkspace)
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()).map((workspace) =>
        toServerCaseKeys<IWorkspace>(workspace)
      ),
      logId: log[0].id,
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
    let reorderedWorkspaces: IWorkspaceRaw[] = []

    const finalEntitiesMap = new Map<string, IWorkspaceRaw>()
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
        'user_id',
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
      finalEntitiesMap.set(newWorkspace._id.toString(), newWorkspace)
    })

    if (reorderedWorkspaces.length > 0) {
      reorderedWorkspaces.forEach((reorderedWorkspace) => {
        finalEntitiesMap.set(reorderedWorkspace._id.toString(), reorderedWorkspace)
      })
    }

    return {
      data: Array.from(finalEntitiesMap.values()).map((workspace) =>
        toServerCaseKeys<IWorkspace>(workspace)
      ),
      logId: log[0].id,
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
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IWorkspace[]>> {
    let reorderedWorkspaces: IWorkspaceRaw[] = []

    const filter = this.repository.buildFilter(criteria, userId)

    const finalEntitiesMap = new Map<string, IWorkspaceRaw>()
    const workspacesToUpdate: IWorkspaceRaw[] = await this.repository.find(filter, session)

    if (workspacesToUpdate.length === 0)
      throw new NotFoundError('Пространства для редактирования не найдены.')

    const workspacePayload = await this.prepareWorkspaceEditPayload(data, workspacesToUpdate)
    const workspacesBefore = projectProperties<IWorkspaceRaw>(workspacesToUpdate, workspacePayload)

    /* UPDATE */
    const newEntities = await this.repository.updateByFilter(filter, workspacePayload, session)
    const newEntity = newEntities[0]

    if (!newEntity) {
      return {
        data: [],
        logId: null,
      }
    }

    newEntities.forEach((newWorkspace) => {
      finalEntitiesMap.set(newWorkspace._id.toString(), newWorkspace)
    })

    // Update children parent references if name is changing
    if (data.name && workspacesToUpdate.length > 0) {
      const workspaceIdsToUpdate = workspacesToUpdate.map((b) => b._id)

      for (const workspace of workspacesToUpdate) {
        if (workspace.name !== data.name) {
          await this.boardService.updateBoardsWorkspaceName(
            workspaceIdsToUpdate,
            data.name,
            userId,
            session
          )

          await this.categoryService.updateCategoriesWorkspaceName(
            workspaceIdsToUpdate,
            data.name,
            userId,
            session
          )

          await this.taskService.updateTasksWorkspaceName(
            workspaceIdsToUpdate,
            data.name,
            userId,
            session
          )
        }
      }
    }

    /* REORDER */
    const workspacesToReorder = workspacesToUpdate.filter(
      (ws) => data.order !== undefined && ws.order !== data.order
    )
    if (workspacesToReorder.length > 0) {
      reorderedWorkspaces = await this.reorderService.reorder(
        'user_id',
        workspacesToReorder,
        userId,
        session
      )

      reorderedWorkspaces.forEach((reorderedWorkspace) => {
        finalEntitiesMap.set(reorderedWorkspace._id.toString(), reorderedWorkspace)
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
      data: finalEntities.map(toServerCaseKeys<IWorkspace>),
      logId: log[0].id,
    }
  }

  public async edit(
    data: WorkspaceEditDTO,
    criteria: WorkspaceCriteria,
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
    let reorderedWorkspaces: IWorkspaceRaw[] = []

    const finalEntitiesMap = new Map<string, IWorkspaceRaw>()
    const workspacesToUpdate: SingleUpdateDTO<Partial<IWorkspaceRaw>>[] = []
    const workspacesBefore: Partial<IWorkspaceRaw>[] = []
    const workspacesNameMap = new Map<
      string,
      {
        id: Types.ObjectId
        name: string
      }
    >()

    const workspaceIds = data.map((d) => d.id)

    const filter = this.repository.buildFilter({ ids: workspaceIds }, userId)

    const existingWorkspaces: IWorkspaceRaw[] = await this.repository.find(filter, session)

    if (existingWorkspaces.length === 0)
      throw new NotFoundError('Рабочие пространства для обновления не найдены.')

    for (const dto of data) {
      const workspace = existingWorkspaces.find((c) => c._id.toString() === dto.id)

      if (!workspace) continue

      const workspacePayload = await this.prepareWorkspaceEditPayload(dto, [workspace])
      workspacesBefore.push(projectProperties<IWorkspaceRaw>([workspace], workspacePayload)[0])

      workspacesToUpdate.push(workspacePayload)

      if (dto.order != null && workspace.order !== dto.order) {
        workspaceIdsToReorder.push(workspacePayload._id.toString())
      }

      // Update children parent references if name is changing
      if (dto.name && workspace.name !== dto.name) {
        workspacesNameMap.set(workspace._id.toString(), { id: workspace._id, name: dto.name })
      }
    }

    /* BULK UPDATE */
    const updatedWorkspaces = await this.repository.bulkUpdate(workspacesToUpdate, userId, session)

    updatedWorkspaces.forEach((updatedWorkspace) => {
      finalEntitiesMap.set(updatedWorkspace._id.toString(), updatedWorkspace)
    })

    if (workspacesNameMap.size > 0) {
      await this.boardService.bulkUpdateBoardsWorkspaceNameByMap(workspacesNameMap, userId, session)
      await this.categoryService.bulkUpdateCategoriesWorkspaceNameByMap(
        workspacesNameMap,
        userId,
        session
      )
      await this.taskService.bulkUpdateTasksWorkspaceNameByMap(workspacesNameMap, userId, session)
    }

    /* REORDER */
    if (workspaceIdsToReorder.length > 0) {
      const updatedWorkspacesToReorder = updatedWorkspaces.filter((uc) =>
        workspaceIdsToReorder.includes(uc._id.toString())
      )

      if (updatedWorkspacesToReorder.length > 0) {
        reorderedWorkspaces = await this.reorderService.reorder(
          'user_id',
          updatedWorkspacesToReorder,
          userId,
          session
        )

        reorderedWorkspaces.forEach((reorderedWorkspace) => {
          finalEntitiesMap.set(reorderedWorkspace._id.toString(), reorderedWorkspace)
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
      data: finalEntities.map(toServerCaseKeys<IWorkspace>),
      logId: log[0].id,
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
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IWorkspace[]> {
    let reorderedWorkspaces: IWorkspaceRaw[] = []

    const filter = this.repository.buildFilter(criteria, userId)

    const workspacesToDelete = await this.repository.find(filter, session)

    if (workspacesToDelete.length === 0)
      throw new NotFoundError('Пространства для удаления не найдены.')

    await this.repository.deleteMany(filter, session)

    await this.boardService.deleteBoardsByWorkspaces(
      workspacesToDelete.map((ws) => ws._id),
      userId,
      session
    )

    /* REORDER */
    reorderedWorkspaces = await this.reorderService.reorderByParentIds([userId], userId, session)

    return [...reorderedWorkspaces.map((rw) => toServerCaseKeys<IWorkspace>(rw))]
  }

  public async delete(
    criteria: WorkspaceCriteria,
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

  private async _executeArchiveTransaction(
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IWorkspacesWithChildrenResponse>> {
    let reorderedWorkspaces: IWorkspaceRaw[] = []

    const finalEntitiesMap = new Map<string, IWorkspaceRaw>()
    const filter = this.repository.buildFilter(criteria, userId)

    const updatedWorkspaces = await this.repository.updateByFilter(
      filter,
      { is_deleted: true, deleted_time: new Date() },
      session
    )

    if (updatedWorkspaces.length === 0)
      throw new NotFoundError('Пространства для архивации не найдены.')

    /* REORDER */
    reorderedWorkspaces = await this.reorderService.reorderByParentIds([userId], userId, session)

    const archiveBoardsResult = await this.boardService.archiveBoardsByWorkspaces(
      updatedWorkspaces.map((ws) => ws._id),
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.ARCHIVE,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesBefore: updatedWorkspaces.map((ws) => ({ ...ws, is_deleted: false })),
        entitiesAfter: updatedWorkspaces,
        dependencies: [],
      },
      userId,
      session
    )

    updatedWorkspaces.forEach((updatedWorkspace) => {
      finalEntitiesMap.set(updatedWorkspace._id.toString(), updatedWorkspace)
    })

    reorderedWorkspaces.forEach((reorderedWorkspace) => {
      finalEntitiesMap.set(reorderedWorkspace._id.toString(), reorderedWorkspace)
    })

    const finalObj = {
      workspaces: Array.from(finalEntitiesMap.values()).map((workspace) =>
        toServerCaseKeys<IWorkspace>(workspace)
      ),
      boards: archiveBoardsResult.boards,
      categories: archiveBoardsResult.categories,
      tasks: archiveBoardsResult.tasks,
    }

    return {
      data: finalObj,
      logId: log[0].id,
    }
  }

  public async archive(
    criteria: WorkspaceCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IWorkspacesWithChildrenResponse>> {
    const userId = user.id

    if (externalSession) {
      return this._executeArchiveTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeArchiveTransaction(criteria, userId, session)
      )
    }
  }

  private async _executeRecoverTransaction(
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<IWorkspacesWithChildrenResponse>> {
    let reorderedWorkspaces: IWorkspaceRaw[] = []

    const finalEntitiesMap = new Map<string, IWorkspaceRaw>()
    const filter = this.repository.buildFilter(criteria, userId)
    filter.is_deleted = true

    const workspacesToRecover = await this.repository.find(filter, session)

    if (workspacesToRecover.length === 0)
      throw new NotFoundError('Пространства для восстановления не найдены.')

    const updatedWorkspaces = await this.repository.updateByFilter(
      filter,
      { is_deleted: false, deleted_time: undefined },
      session
    )

    /* REORDER */
    reorderedWorkspaces = await this.reorderService.reorderByParentIds([userId], userId, session)

    const recoverBoardsResult = await this.boardService.recoverBoardsByWorkspaces(
      updatedWorkspaces.map((ws) => ws._id),
      userId,
      session
    )

    /* LOG */
    const log = await this.operationLogService.create(
      {
        operationType: OperationTypesEnum.RECOVER,
        collectionName: CollectionsEnum.WORKSPACES,
        entitiesBefore: updatedWorkspaces.map((ws) => ({ ...ws, is_deleted: false })),
        entitiesAfter: updatedWorkspaces,
        dependencies: [],
      },
      userId,
      session
    )

    updatedWorkspaces.forEach((updatedWorkspace) => {
      finalEntitiesMap.set(updatedWorkspace._id.toString(), updatedWorkspace)
    })

    reorderedWorkspaces.forEach((reorderedWorkspace) => {
      finalEntitiesMap.set(reorderedWorkspace._id.toString(), reorderedWorkspace)
    })

    const finalObj = {
      workspaces: Array.from(finalEntitiesMap.values()).map((workspace) =>
        toServerCaseKeys<IWorkspace>(workspace)
      ),
      boards: recoverBoardsResult.boards,
      categories: recoverBoardsResult.categories,
      tasks: recoverBoardsResult.tasks,
    }

    return {
      data: finalObj,
      logId: log[0].id,
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
    criteria: WorkspaceCriteria,
    user: IUser,
    externalSession?: ClientSession
  ): Promise<IResponseWithLog<IWorkspacesWithChildrenResponse>> {
    const userId = user.id

    if (externalSession) {
      return this._executeRecoverTransaction(criteria, userId, externalSession)
    } else {
      return await this._retryExecutor((session: ClientSession) =>
        this._executeRecoverTransaction(criteria, userId, session)
      )
    }
  }

  private async _executeCloneTransaction(
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<IResponseWithLog<ClonedWorkspacesResult>> {
    const filter = this.repository.buildFilter(criteria, userId)

    const workspacesToClone = await this.repository.find(
      filter,
      session,
      '+embeddings -createdAt -updatedAt'
    )

    let lastOrder = await this.getLastOrder('', userId, session)

    if (workspacesToClone.length === 0)
      throw new NotFoundError('Пространства для клонирования не найдены.')

    const transformedWorkspaces: Omit<IWorkspaceRaw, '_id'>[] = []

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
      workspaceIdsMap.set(workspace._id.toString(), {
        workspaceId: newWorkspaces[index]._id,
        workspaceName: newWorkspaces[index].name,
      })
    })

    const cloneBoardsResult = await this.boardService.cloneBoardsByWorkspaces(
      workspaceIdsMap,
      userId,
      session
    )

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

    const finalObj = {
      workspaces: newWorkspaces.map((wb) => toServerCaseKeys<IWorkspace>(wb)),
      boards: cloneBoardsResult.boards,
      categories: cloneBoardsResult.categories,
      tasks: cloneBoardsResult.tasks,
    }

    return {
      data: finalObj,
      logId: log[0].id,
    }
  }

  public async clone(
    criteria: WorkspaceCriteria,
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
          ...toServerCaseKeys<IWorkspace>(e),
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
    } else throw new Error(`Операция ${operationType} не поддерживается для отката.`)
  }

  private async prepareWorkspaceCreationPayload(
    data: WorkspaceDTO,
    userId: Types.ObjectId,
    session?: ClientSession
  ) {
    const workspaceName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(workspaceName)

    const workspacePayload: Omit<IWorkspaceRaw, '_id'> = {
      ...toMongoCaseKeys(data),
      embeddings,
      user_id: userId,
    }

    if (data.color && BASE_COLORS_MAP[data.color]) {
      workspacePayload.color_name = BASE_COLORS_MAP[data.color]
    }

    if (data.order === undefined) {
      const lastOrder = await this.getLastOrder('', userId, session)
      workspacePayload.order = lastOrder + 1
    }

    return workspacePayload
  }

  private async prepareWorkspacesCreationPayload(
    data: WorkspaceDTO[],
    userId: Types.ObjectId,
    session?: ClientSession
  ) {
    const lastOrder = await this.getLastOrder('', userId, session)
    let newOrder = lastOrder + 1

    const workspaceNames = data.map((workspace) => workspace.name.trim())
    const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(
      workspaceNames
    )

    const workspacePayloads: Omit<IWorkspaceRaw, '_id'>[] = data.map((dto, index) => {
      const payload = {
        ...toMongoCaseKeys<IWorkspaceRaw>(dto),
        embeddings: embeddingsArray[index],
        user_id: userId,
      }

      if (dto.color && BASE_COLORS_MAP[dto.color]) {
        payload.color_name = BASE_COLORS_MAP[dto.color]
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
    workspacesToUpdate: IWorkspaceRaw[]
  ) {
    const workspacePayload: SingleUpdateDTO<Partial<IWorkspaceRaw>> = {
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

  public async getById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IWorkspace | null> {
    const workspace = await this.repository.findByIdAndUser(id, userId, session)

    return toServerCaseKeys(workspace)
  }

  public async getCount(
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    const filter = this.repository.buildFilter(criteria, userId)

    return await this.repository.getCount(filter, session)
  }

  public async getLastOrder(
    _: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    const filter = this.repository.buildFilter({}, userId)

    const existingWorkspacesLite = await this.repository.find(filter, session, 'order')

    let currentMaxOrder = existingWorkspacesLite.reduce(
      (max, w) => (w.order > max ? w.order : max),
      0
    )

    return currentMaxOrder
  }

  public async getAll(
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IWorkspace[]> {
    const filter = this.repository.buildFilter(criteria, userId)
    const workspaces = await this.repository.find(filter, session)

    return workspaces.map((ws) => toServerCaseKeys(ws))
  }

  public async getByFilter(
    filter: FilterQuery<IWorkspaceRaw>,
    userId: Types.ObjectId,
    limit: number,
    session?: ClientSession
  ): Promise<IWorkspace[]> {
    const filterWithUser = { ...filter, user_id: userId }
    const workspaces = await this.repository.find(filterWithUser, session, null, limit)

    return workspaces.map((ws) => toServerCaseKeys(ws))
  }
}
