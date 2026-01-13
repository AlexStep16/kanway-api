import { IBoard } from '@/domain/entities/IBoard.ts'
import { ICategory } from '@/domain/entities/ICategory.ts'
import { ITask } from '@/domain/entities/ITask.ts'
import { Document } from '@langchain/core/documents'
import { IWorkspace } from '@/domain/entities/IWorkspace.ts'
import { toServerCaseKeys } from '@/utils/objectTransformers.ts'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb'
import { MongoClient } from 'mongodb'
import { Types } from 'mongoose'
import { IAgentInstruction } from '@/domain/entities/IAgentInstruction.ts'

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
    query: string
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

    const emb = await this.embeddingService.getEmbeddings(query.trim().toLowerCase())

    const searchOptions: any = {}
    if (filter) searchOptions.preFilter = filter

    const documents = await vectorstore.similaritySearchVectorWithScore(emb, count, searchOptions)

    const results: any[] = []
    const maxScore = documents.length > 0 ? documents[0][1] : 0

    for (const [doc, score] of documents) {
      if ((score > maxScore - 0.2 && score > 0.42) || score > 0.52) {
        const mappedItem = mapResult(doc)
        results.push(mappedItem)
      }
    }

    return results.map(toServerCaseKeys<T>)
  }

  public async similaritySearchTasks(
    query: string,
    userId: Types.ObjectId,
    count: number,
    categoryIds?: Array<Types.ObjectId>
  ): Promise<ITask[]> {
    const filter: any = { user_id: { $eq: userId }, is_deleted: { $eq: false } }
    if (categoryIds?.length) filter.category = { $in: categoryIds }

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

  public async similaritySearchCategories(
    query: string,
    userId: Types.ObjectId,
    count: number,
    boardIds?: Array<Types.ObjectId>
  ): Promise<ICategory[]> {
    const filter: any = { user_id: { $eq: userId }, is_deleted: { $eq: false } }
    if (boardIds?.length) filter.board = { $in: boardIds }

    // Вызываем универсальный метод
    return this._executeSearch<ICategory>({
      collectionName: 'categories',
      indexName: process.env.CATEGORIES_INDEX_NAME!,
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
    query: string,
    userId: Types.ObjectId,
    count: number,
    workspaceIds?: Array<Types.ObjectId>
  ): Promise<IBoard[]> {
    const filter: any = { user_id: { $eq: userId }, is_deleted: { $eq: false } }
    if (workspaceIds?.length) filter.workspace = { $in: workspaceIds }

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
    query: string,
    userId: Types.ObjectId,
    count: number
  ): Promise<IWorkspace[]> {
    const filter: any = { user_id: { $eq: userId }, is_deleted: { $eq: false } }

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
      steps.map((step) => step.description.trim().toLowerCase())
    )

    for (const queryEmbedding of descriptionsEmbeddings) {
      const documents = await vectorstore.similaritySearchVectorWithScore(queryEmbedding, 3)

      accDocuments.push(...documents)
    }

    const tools = []

    for (const [doc, _] of accDocuments) {
      const tool = {
        name: doc.metadata.name,
        description: doc.pageContent,
      }

      tools.push(tool)
    }

    return tools
  }

  public async similaritySearchAgentInstructions(
    query: string,
    topK: number = 2
  ): Promise<Array<IAgentInstruction>> {
    const collection = this.mongoClient
      .db(process.env.DATABASE_NAME)
      .collection('agentinstructions')

    const vectorstore = new MongoDBAtlasVectorSearch(this.embeddingService.getEmbeddingModel(), {
      collection,
      indexName: process.env.AGENT_INSTRUCTIONS_INDEX_NAME,
      textKey: 'example',
      embeddingKey: 'embeddings',
    })

    const queryEmbedding = await this.embeddingService.getEmbeddings(query.trim().toLowerCase())
    const documents = await vectorstore.similaritySearchVectorWithScore(queryEmbedding, topK)

    const agentInstructions = []

    for (const [doc, _] of documents) {
      const agentInstruction = {
        ...doc.metadata,
        example: doc.pageContent,
      }

      agentInstructions.push(toServerCaseKeys<IAgentInstruction>(agentInstruction))
    }

    return agentInstructions
  }
}
