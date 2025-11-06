import { IWorkspace } from '@entities/IWorkspace.ts'
import { IWorkspaceRaw } from '@entities/IWorkspaceRaw.ts'
import WorkspaceRepository from '@repositories/WorkspaceRepository.ts'
import { WorkspaceDTO } from '@/application/dtos/WorkspaceDTO.ts'
import mongoose, { ClientSession, Types } from 'mongoose'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { WorkspaceCriteria } from '@criterias/WorkspaceCriteria.ts'
import { IBaseService } from '@interfaces/IBaseService.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { toServerCaseKeys, toMongoCaseKeys } from '@utils/objectTransformers.ts'
import { WorkspaceEditDTO } from '@dtos/WorkspaceEditDTO.ts'
import { ReorderResultDTO } from '@dtos/ReorderResultDTO.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { BoardService } from '@application/services/BoardService.ts'

export class WorkspaceService
  implements IBaseService<IWorkspace, WorkspaceCriteria, WorkspaceDTO, WorkspaceEditDTO>
{
  protected repository: WorkspaceRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderService<IWorkspaceRaw>
  protected boardService: BoardService

  constructor(
    workspaceRepository: WorkspaceRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<IWorkspaceRaw>,
    boardService: BoardService
  ) {
    this.repository = workspaceRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.reorderService = reorderService
    this.boardService = boardService
  }

  public async create(
    data: WorkspaceDTO,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IWorkspace[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedWorkspaces: ReorderResultDTO<IWorkspaceRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const workspacePayload = await this.prepareWorkspaceCreationPayload(data, userId, session)

      /* CREATE */
      const newWorkspace = await this.repository.create(workspacePayload, session)

      /* REORDER */
      if (data.order !== undefined) {
        reorderedWorkspaces = await this.reorderService.reorder(
          'user_id',
          [newWorkspace],
          CollectionsEnum.WORKSPACES,
          userId,
          session
        )
      }

      /* LOG */
      let dependencies: Types.ObjectId[] = []

      reorderedWorkspaces.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesAfter: [newWorkspace],
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      if (reorderedWorkspaces.length > 0) {
        const reorderedEntities = reorderedWorkspaces.map((r) => r.updatedEntities).flat()
        return [
          toServerCaseKeys(newWorkspace),
          ...reorderedEntities.map((re) => toServerCaseKeys<IWorkspace>(re)),
        ]
      }

      return [toServerCaseKeys(newWorkspace)]
    } catch (error) {
      if (session && isNewSession) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session && isNewSession) {
        session.endSession()
      }
    }
  }

  public async createMany(
    data: WorkspaceDTO[],
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IWorkspace[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedWorkspaces: ReorderResultDTO<IWorkspaceRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

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
          CollectionsEnum.WORKSPACES,
          userId,
          session
        )
      }

      /* LOG */
      let dependencies: Types.ObjectId[] = []

      reorderedWorkspaces.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesAfter: newWorkspaces,
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      if (reorderedWorkspaces.length > 0) {
        const reorderedEntities = reorderedWorkspaces.map((r) => r.updatedEntities).flat()
        return [
          ...newWorkspaces.map((nb) => toServerCaseKeys<IWorkspace>(nb)),
          ...reorderedEntities.map((re) => toServerCaseKeys<IWorkspace>(re)),
        ]
      }

      return [...newWorkspaces.map((nb) => toServerCaseKeys<IWorkspace>(nb))]
    } catch (error) {
      if (session && isNewSession) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session && isNewSession) {
        session.endSession()
      }
    }
  }

  public async edit(
    data: WorkspaceEditDTO,
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IWorkspace[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedWorkspaces: ReorderResultDTO<IWorkspaceRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const workspacesToUpdate: IWorkspaceRaw[] = await this.repository.find(filter, session)

      if (workspacesToUpdate.length === 0)
        throw new NotFoundError('Пространства для редактирования не найдены.')

      const workspacePayload = await this.prepareWorkspaceEditPayload(
        data,
        workspacesToUpdate,
        userId
      )

      /* UPDATE */
      const newEntities = await this.repository.updateByFilter(filter, workspacePayload, session)

      /* REORDER */
      const workspacesToReorder = workspacesToUpdate.filter(
        (ws) => data.order !== undefined && ws.order !== data.order
      )
      if (workspacesToReorder.length > 0) {
        reorderedWorkspaces = await this.reorderService.reorder(
          'user_id',
          workspacesToReorder,
          CollectionsEnum.WORKSPACES,
          userId,
          session
        )
      }

      /* LOG */
      let dependencies: Types.ObjectId[] = []

      reorderedWorkspaces.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesBefore: workspacesToUpdate,
          entitiesAfter: newEntities,
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      if (reorderedWorkspaces.length > 0) {
        const reorderedEntities = reorderedWorkspaces.map((r) => r.updatedEntities).flat()
        return [
          ...newEntities.map((ne) => toServerCaseKeys<IWorkspace>(ne)),
          ...reorderedEntities.map((re) => toServerCaseKeys<IWorkspace>(re)),
        ]
      }

      return [...newEntities.map((ne) => toServerCaseKeys<IWorkspace>(ne))]
    } catch (error) {
      if (session && isNewSession) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session && isNewSession) {
        session.endSession()
      }
    }
  }

  public async delete(
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IWorkspace[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedWorkspaces: ReorderResultDTO<IWorkspaceRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

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
      reorderedWorkspaces = await this.reorderService.reorderByParentIds(
        [userId],
        CollectionsEnum.WORKSPACES,
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      const reorderedEntities = reorderedWorkspaces.map((r) => r.updatedEntities).flat()

      return [...reorderedEntities.map((re) => toServerCaseKeys<IWorkspace>(re))]
    } catch (error) {
      if (session && isNewSession) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session && isNewSession) {
        session.endSession()
      }
    }
  }

  public async archive(
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IWorkspace[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedWorkspaces: ReorderResultDTO<IWorkspaceRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const updatedWorkspaces = await this.repository.updateByFilter(
        filter,
        { is_deleted: true },
        session
      )

      if (updatedWorkspaces.length === 0)
        throw new NotFoundError('Пространства для архивации не найдены.')

      /* REORDER */
      reorderedWorkspaces = await this.reorderService.reorderByParentIds(
        [userId],
        CollectionsEnum.WORKSPACES,
        userId,
        session
      )

      const archiveBoardsResult = await this.boardService.archiveBoardsByWorkspaces(
        updatedWorkspaces.map((ws) => ws._id),
        userId,
        session
      )

      /* LOG */
      let dependencies: Types.ObjectId[] = archiveBoardsResult.logIds

      reorderedWorkspaces.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesBefore: updatedWorkspaces.map((ws) => ({ ...ws, is_deleted: false })),
          entitiesAfter: updatedWorkspaces,
          dependencies,
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      const reorderedEntities = reorderedWorkspaces.map((r) => r.updatedEntities).flat()

      return [
        ...updatedWorkspaces.map((ub) => toServerCaseKeys<IWorkspace>(ub)),
        ...reorderedEntities.map((re) => toServerCaseKeys<IWorkspace>(re)),
      ]
    } catch (error) {
      if (session && isNewSession) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session && isNewSession) {
        session.endSession()
      }
    }
  }

  public async recover(
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IWorkspace[]> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false
    let reorderedWorkspaces: ReorderResultDTO<IWorkspaceRaw>[] = []

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const updatedWorkspaces = await this.repository.updateByFilter(
        filter,
        { is_deleted: false },
        session
      )

      if (updatedWorkspaces.length === 0)
        throw new NotFoundError('Пространства для восстановления не найдены.')

      if (isNewSession) {
        await session.commitTransaction()
      }

      /* REORDER */
      reorderedWorkspaces = await this.reorderService.reorderByParentIds(
        [userId],
        CollectionsEnum.WORKSPACES,
        userId,
        session
      )

      const recoverBoardsResult = await this.boardService.recoverBoardsByWorkspaces(
        updatedWorkspaces.map((ws) => ws._id),
        userId,
        session
      )

      /* LOG */
      let dependencies: Types.ObjectId[] = recoverBoardsResult.logIds

      reorderedWorkspaces.forEach((r) => {
        if (r.log) dependencies.push(r.log.id)
      })

      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesBefore: updatedWorkspaces.map((ws) => ({ ...ws, is_deleted: false })),
          entitiesAfter: updatedWorkspaces,
          dependencies,
        },
        userId,
        session
      )

      const reorderedEntities = reorderedWorkspaces.map((r) => r.updatedEntities).flat()

      return [
        ...updatedWorkspaces.map((ub) => toServerCaseKeys<IWorkspace>(ub)),
        ...reorderedEntities.map((re) => toServerCaseKeys<IWorkspace>(re)),
      ]
    } catch (error) {
      if (session && isNewSession) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session && isNewSession) {
        session.endSession()
      }
    }
  }

  public async clone(criteria: WorkspaceCriteria, userId: Types.ObjectId): Promise<IWorkspace[]> {
    let session: ClientSession | null = null

    try {
      session = await mongoose.startSession()
      session.startTransaction()

      const filter = this.repository.buildFilter(criteria, userId)

      const workspacesToClone = await this.repository.find(
        filter,
        session,
        '+embeddings -createdAt -updatedAt'
      )

      const allWorkspacesCount = await this.getCount({}, userId, session)

      if (workspacesToClone.length === 0)
        throw new NotFoundError('Пространства для клонирования не найдены.')

      const transformedWorkspaces: Omit<IWorkspaceRaw, '_id'>[] = []

      for (const workspace of workspacesToClone) {
        let newOrder = allWorkspacesCount + 1

        const cleanWorkspace = {
          ...workspace,
          _id: undefined,
          order: newOrder,
        }

        transformedWorkspaces.push(cleanWorkspace)
      }

      const newWorkspaces = await this.repository.createMany(transformedWorkspaces, session)

      const workspaceIdsMap: Map<string, string> = new Map()
      workspacesToClone.forEach((sourceId, index) => {
        workspaceIdsMap.set(sourceId.toString(), newWorkspaces[index]._id.toString())
      })

      const cloneBoardsResult = await this.boardService.cloneBoardsByWorkspaces(
        workspaceIdsMap,
        userId,
        session
      )

      /* LOG */
      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesAfter: newWorkspaces,
          dependencies: cloneBoardsResult.logIds,
        },
        userId,
        session
      )

      await session.commitTransaction()

      return newWorkspaces.map((wb) => toServerCaseKeys<IWorkspace>(wb))
    } catch (error) {
      if (session) {
        session.abortTransaction()
      }

      throw error
    } finally {
      if (session) {
        session.endSession()
      }
    }
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

    if (data.order === undefined) {
      const allWorkspacesCount = await this.getCount({}, userId, session)
      workspacePayload.order = allWorkspacesCount + 1
    }

    return workspacePayload
  }

  private async prepareWorkspacesCreationPayload(
    data: WorkspaceDTO[],
    userId: Types.ObjectId,
    session?: ClientSession
  ) {
    const allWorkspacesCount = await this.getCount({}, userId, session)
    let newOrder = allWorkspacesCount + 1

    const workspaceNames = data.map((workspace) => workspace.name.trim())
    const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(
      workspaceNames
    )

    const workspacePayloads: Omit<IWorkspaceRaw, '_id'>[] = data.map((workspace, index) => {
      const payload = {
        ...toMongoCaseKeys<IWorkspaceRaw>(workspace),
        embeddings: embeddingsArray[index],
        user_id: userId,
      }

      if (workspace.order === undefined) {
        payload.order = newOrder
        newOrder += 1
      }

      return payload
    })

    return workspacePayloads
  }

  private async prepareWorkspaceEditPayload(
    data: WorkspaceEditDTO,
    workspacesToUpdate: IWorkspaceRaw[],
    userId: Types.ObjectId
  ) {
    const workspacePayload: Partial<IWorkspaceRaw> = {
      ...toMongoCaseKeys(data),
      user_id: userId,
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

    return workspacePayload
  }

  public async getById(id: string, userId: Types.ObjectId): Promise<IWorkspace | null> {
    const workspace = await this.repository.findByIdAndUser(id, userId)

    return toServerCaseKeys(workspace)
  }

  public async getCount(
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<number> {
    const filter = this.repository.buildFilter(criteria, userId)

    return this.repository.getCount(filter, session)
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
}
