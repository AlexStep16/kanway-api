import { IWorkspace } from '@entities/IWorkspace.ts'
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

export class WorkspaceService implements IBaseService<IWorkspace, WorkspaceCriteria, WorkspaceDTO> {
  protected repository: WorkspaceRepository
  protected embeddingService: EmbeddingService
  protected operationLogService: OperationLogService
  protected reorderService: ReorderService<IWorkspace>

  constructor(
    workspaceRepository: WorkspaceRepository,
    embeddingService: EmbeddingService,
    operationLogService: OperationLogService,
    reorderService: ReorderService<IWorkspace>
  ) {
    this.repository = workspaceRepository
    this.embeddingService = embeddingService
    this.operationLogService = operationLogService
    this.reorderService = reorderService
  }

  public async create(
    data: WorkspaceDTO,
    userId: Types.ObjectId,
    externalSession?: ClientSession
  ): Promise<IWorkspace> {
    let session: ClientSession | null = externalSession || null
    let isNewSession = false

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const workspacePayload = await this.prepareWorkspaceCreationPayload(data, userId)

      /* CREATE */
      const newWorkspace = await this.repository.create(workspacePayload, session)

      /* REORDER */
      if (newWorkspace.order !== undefined) {
        await this.reorderService.reorder(userId.toString(), [newWorkspace], userId, session)
      }

      /* LOG */
      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesAfter: [newWorkspace],
          dependencies: [],
        },
        userId,
        session
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      return newWorkspace
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

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const workspacesPayload = await this.prepareWorkspacesCreationPayload(data, userId)

      /* CREATE */
      const newWorkspaces = await this.repository.createMany(workspacesPayload, session)

      /* REORDER */
      const isReorderNeeded = newWorkspaces.some((ws) => ws.order !== undefined)
      if (isReorderNeeded) {
        await this.reorderService.reorder(userId.toString(), newWorkspaces, userId, session)
      }

      /* LOG */
      await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.CREATE,
          collectionName: CollectionsEnum.WORKSPACES,
          entitiesAfter: newWorkspaces,
          dependencies: [],
        },
        userId
      )

      if (isNewSession) {
        await session.commitTransaction()
      }

      return newWorkspaces
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

    try {
      if (!session) {
        session = await mongoose.startSession()
        session.startTransaction()
        isNewSession = true
      }

      const filter = this.repository.buildFilter(criteria, userId)

      const workspacesToUpdate: IWorkspace[] = await this.repository.find(filter, session)

      const workspacePayload = await this.prepareWorkspaceEditPayload(
        data,
        workspacesToUpdate,
        userId
      )

      const newEntities = await this.repository.updateByFilter(filter, workspacePayload, session)

      if (isNewSession) {
        await session.commitTransaction()
      }

      return newEntities
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

  private async prepareWorkspaceCreationPayload(data: WorkspaceDTO, userId: Types.ObjectId) {
    const allWorkspacesCount = await this.getCount({}, userId)
    let newOrder = allWorkspacesCount + 1

    const workspaceName = data.name.trim()

    const embeddings = await this.embeddingService.getEmbeddings(workspaceName)

    const workspacePayload: Partial<IWorkspace> = {
      ...toMongoCaseKeys(data),
      order: newOrder,
      embeddings,
      user_id: userId,
    }

    return workspacePayload
  }

  private async prepareWorkspacesCreationPayload(data: WorkspaceDTO[], userId: Types.ObjectId) {
    const allWorkspacesCount = await this.getCount({}, userId)
    let newOrder = allWorkspacesCount + 1

    const workspaceNames = data.map((workspace) => workspace.name.trim())
    const embeddingsArray = await this.embeddingService.getEmbeddingsForMultipleTexts(
      workspaceNames
    )

    const workspacePayloads: Partial<IWorkspace>[] = data.map((workspace, index) => ({
      ...toMongoCaseKeys(workspace),
      order: newOrder++,
      embeddings: embeddingsArray[index],
      user_id: userId,
    }))

    return workspacePayloads
  }

  private async prepareWorkspaceEditPayload(
    data: WorkspaceEditDTO,
    workspacesToUpdate: IWorkspace[],
    userId: Types.ObjectId
  ) {
    const workspacePayload: Partial<IWorkspace> = {
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

  public async getCount(criteria: WorkspaceCriteria, userId: Types.ObjectId): Promise<number> {
    const filter = this.repository.buildFilter(criteria, userId)

    return this.repository.getCount(filter)
  }

  public async getAll(criteria: WorkspaceCriteria, userId: Types.ObjectId): Promise<IWorkspace[]> {
    const filter = this.repository.buildFilter(criteria, userId)
    const workspaces = await this.repository.find(filter)

    return workspaces.map((ws) => toServerCaseKeys(ws))
  }
}
