import { IBoard } from '@/domain/entities/IBoard.js'
import { IColumn } from '@/domain/entities/IColumn.js'
import { ITask } from '@/domain/entities/ITask.js'
import { Document } from '@langchain/core/documents'
import { IWorkspace } from '@/domain/entities/IWorkspace.js'
import { toServerCaseKeys } from '@/utils/objectTransformers.js'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.js'
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb'
import { MongoClient } from 'mongodb'
import { Types } from 'mongoose'

export class VectorSearchService {
  protected embeddingService: EmbeddingService
  protected mongoClient: MongoClient

  constructor(embeddingService: EmbeddingService, mongoClient: MongoClient) {
    this.embeddingService = embeddingService
    this.mongoClient = mongoClient
  }

  private async _executeSearch<T>(params: {
    collectionName: string
    indexName: string
    query: string[]
    count: number
    filter?: any
    textKey?: string

    mapResult: (doc: Document) => any
  }): Promise<T[]> {
    const { collectionName, indexName, query, count, filter, mapResult, textKey = 'name' } = params

    const collection = this.mongoClient.db(process.env.DATABASE_NAME).collection(collectionName)

    const vectorstore = new MongoDBAtlasVectorSearch(this.embeddingService.getEmbeddingModel(), {
      collection,
      indexName,
      textKey,
      embeddingKey: 'embeddings',
    })

    const emb = await this.embeddingService.getEmbeddingsForMultipleTexts(
      query.map((q) => q.trim().toLowerCase()),
    )

    const searchOptions: any = {}
    if (filter) searchOptions.preFilter = filter

    const result = await Promise.all(
      emb.map((e) => vectorstore.similaritySearchVectorWithScore(e, count, searchOptions)),
    )

    const documents = result.flat()

    const results: any[] = []
    const maxScore = documents.length > 0 ? documents[0][1] : 0

    for (const [doc, score] of documents) {
      if ((score > maxScore - 0.2 && score > 0.42) || score > 0.52) {
        const mappedItem = mapResult(doc)
        results.push(mappedItem)
      }

      /** More precise filtering
      if (score > maxScore - 0.07 && score > 0.82) {
        const mappedItem = mapResult(doc)
        results.push(mappedItem)
      } */
    }

    return results.map(toServerCaseKeys<T>)
  }

  public async similaritySearchTasks(
    query: string[],
    userId: Types.ObjectId,
    count: number,
    boardId?: Types.ObjectId,
    ids?: Array<Types.ObjectId>,
  ): Promise<ITask[]> {
    const filter: any = { user_id: { $eq: userId }, is_deleted: { $eq: false } }
    if (ids?.length) filter._id = { $in: ids }
    if (boardId) filter.board = { $eq: boardId }

    // Вызываем универсальный метод
    return this._executeSearch<ITask>({
      collectionName: 'tasks',
      indexName: process.env.TASKS_INDEX_NAME!,
      query,
      count,
      filter,
      mapResult: (doc) => ({
        ...doc.metadata,
        name: doc.pageContent,
      }),
    })
  }

  public async similaritySearchColumns(
    query: string[],
    userId: Types.ObjectId,
    count: number,
    boardId?: Types.ObjectId,
    ids?: Array<Types.ObjectId>,
  ): Promise<IColumn[]> {
    const filter: any = { user_id: { $eq: userId }, is_deleted: { $eq: false } }
    if (ids?.length) filter._id = { $in: ids }
    if (boardId) filter.board = { $eq: boardId }

    // Вызываем универсальный метод
    return this._executeSearch<IColumn>({
      collectionName: 'columns',
      indexName: process.env.COLUMNS_INDEX_NAME!,
      query,
      count,
      filter,
      mapResult: (doc) => ({
        ...doc.metadata,
        name: doc.pageContent,
      }),
    })
  }

  public async similaritySearchBoards(
    query: string[],
    userId: Types.ObjectId,
    count: number,
    workspaceId?: Types.ObjectId,
    ids?: Array<Types.ObjectId>,
  ): Promise<IBoard[]> {
    const filter: any = { user_id: { $eq: userId }, is_deleted: { $eq: false } }
    if (ids?.length) filter._id = { $in: ids }
    if (workspaceId) filter.workspace = { $eq: workspaceId }

    // Вызываем универсальный метод
    return this._executeSearch<IBoard>({
      collectionName: 'boards',
      indexName: process.env.BOARDS_INDEX_NAME!,
      query,
      count,
      filter,
      mapResult: (doc) => ({
        ...doc.metadata,
        name: doc.pageContent,
      }),
    })
  }

  public async similaritySearchWorkspaces(
    query: string[],
    userId: Types.ObjectId,
    count: number,
    ids?: Array<Types.ObjectId>,
  ): Promise<IWorkspace[]> {
    const filter: any = { user_id: { $eq: userId }, is_deleted: { $eq: false } }
    if (ids?.length) filter._id = { $in: ids }

    // Вызываем универсальный метод
    return this._executeSearch<IWorkspace>({
      collectionName: 'workspaces',
      indexName: process.env.WORKSPACES_INDEX_NAME!,
      query,
      count,
      filter,
      mapResult: (doc) => ({
        ...doc.metadata,
        name: doc.pageContent,
      }),
    })
  }

  public async similaritySearchTools(steps: Array<{ description: string }>): Promise<Array<any>> {
    const collection = this.mongoClient.db(process.env.DATABASE_NAME).collection('tools')

    const vectorstore = new MongoDBAtlasVectorSearch(this.embeddingService.getEmbeddingModel(), {
      collection,
      indexName: process.env.TOOLS_INDEX_NAME,
      textKey: 'description',
      embeddingKey: 'embeddings',
    })

    const accDocuments: [Document<Record<string, any>>, number][] = []

    const descriptionsEmbeddings = await this.embeddingService.getEmbeddingsForMultipleTexts(
      steps.map((step) => step.description.trim().toLowerCase()),
    )

    for (const queryEmbedding of descriptionsEmbeddings) {
      const documents = await vectorstore.similaritySearchVectorWithScore(queryEmbedding, 3)

      accDocuments.push(...documents)
    }

    const tools = []

    for (const [doc] of accDocuments) {
      const tool = {
        name: doc.metadata.name,
        description: doc.pageContent,
      }

      tools.push(tool)
    }

    return tools
  }
}
