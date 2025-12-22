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
import { ZodType } from 'zod'

export class BaseService {
  protected embeddingService: EmbeddingService
  protected mongoClient: MongoClient

  constructor(embeddingService: EmbeddingService, mongoClient: MongoClient) {
    this.embeddingService = embeddingService
    this.mongoClient = mongoClient
  }

  public async similaritySearchTasks(
    query: string,
    userId: Types.ObjectId,
    count: number,
    category_ids?: Array<Types.ObjectId>
  ): Promise<ITask[]> {
    const collection = this.mongoClient.db(process.env.DATABASE_NAME).collection('tasks')

    const vectorstore = new MongoDBAtlasVectorSearch(this.embeddingService.getEmbeddingModel(), {
      collection,
      indexName: process.env.TASKS_INDEX_NAME,
      textKey: 'name',
      embeddingKey: 'embeddings',
    })

    const preFilter: any = {
      user_id: {
        $eq: userId,
      },
      is_deleted: {
        $eq: false,
      },
    }

    if (category_ids && category_ids.length > 0)
      preFilter.category_id = {
        $in: category_ids,
      }

    const emb = await this.embeddingService.getEmbeddings(query.trim().toLowerCase())
    const documents = await vectorstore.similaritySearchVectorWithScore(emb, count, {
      preFilter,
    })

    const tasks = []

    const maxScore = documents.length > 0 ? documents[0][1] : 0

    for (const document of documents) {
      if ((document[1] > maxScore - 0.2 && document[1] > 0.42) || document[1] > 0.52) {
        const task = {
          name: document[0].pageContent,
          order: document[0].metadata.order,
          color: document[0].metadata.color,
          color_name: document[0].metadata.color_name,
          due_date: document[0].metadata.due_date,
          tags: document[0].metadata.tags,
          is_completed: document[0].metadata.is_completed,
          category_id: document[0].metadata.category_id,
          category_name: document[0].metadata.category_name,
          board_id: document[0].metadata.board_id,
          board_name: document[0].metadata.board_name,
          workspace_id: document[0].metadata.workspace_id,
          workspace_name: document[0].metadata.workspace_name,
          _id: document[0].metadata._id,
        }

        tasks.push(task)
      }
    }

    return tasks.map(toServerCaseKeys<ITask>)
  }

  public async similaritySearchCategories(
    query: string,
    userId: Types.ObjectId,
    count: number,
    board_ids?: Array<Types.ObjectId>
  ): Promise<ICategory[]> {
    const collection = this.mongoClient.db(process.env.DATABASE_NAME).collection('categories')

    const vectorstore = new MongoDBAtlasVectorSearch(this.embeddingService.getEmbeddingModel(), {
      collection,
      indexName: process.env.CATEGORIES_INDEX_NAME,
      textKey: 'name',
      embeddingKey: 'embeddings',
    })

    const preFilter: any = {
      is_deleted: {
        $eq: false,
      },
      user_id: {
        $eq: userId,
      },
    }

    if (board_ids && board_ids.length > 0) {
      preFilter.board_id = {
        $in: board_ids,
      }
    }

    const emb = await this.embeddingService.getEmbeddings(query.trim().toLowerCase())
    const documents = await vectorstore.similaritySearchVectorWithScore(emb, count, {
      preFilter,
    })

    const categories = []

    const maxScore = documents.length > 0 ? documents[0][1] : 0

    for (const document of documents) {
      if ((document[1] > maxScore - 0.2 && document[1] > 0.42) || document[1] > 0.52) {
        const category = {
          name: document[0].pageContent,
          workspace_id: document[0].metadata.workspace_id,
          workspace_name: document[0].metadata.workspace_name,
          board_id: document[0].metadata.board_id,
          board_name: document[0].metadata.board_name,
          order: document[0].metadata.order,
          _id: document[0].metadata._id,
        }

        categories.push(category)
      }
    }

    return categories.map(toServerCaseKeys<ICategory>)
  }

  public async similaritySearchBoards(
    query: string,
    userId: Types.ObjectId,
    count: number,
    workspace_ids?: Array<Types.ObjectId>
  ): Promise<IBoard[]> {
    const collection = this.mongoClient.db(process.env.DATABASE_NAME).collection('boards')

    const vectorstore = new MongoDBAtlasVectorSearch(this.embeddingService.getEmbeddingModel(), {
      collection,
      indexName: process.env.BOARDS_INDEX_NAME,
      textKey: 'name',
      embeddingKey: 'embeddings',
    })

    const preFilter: any = {
      user_id: {
        $eq: userId,
      },
      is_deleted: {
        $eq: false,
      },
    }

    if (workspace_ids && workspace_ids.length > 0) {
      preFilter.workspace_id = {
        $in: workspace_ids,
      }
    }

    const emb = await this.embeddingService.getEmbeddings(query.trim().toLowerCase())
    const documents = await vectorstore.similaritySearchVectorWithScore(emb, count, {
      preFilter,
    })

    const boards = []

    const maxScore = documents.length > 0 ? documents[0][1] : 0

    for (const document of documents) {
      if ((document[1] > maxScore - 0.2 && document[1] > 0.42) || document[1] > 0.52) {
        const board = {
          name: document[0].pageContent,
          workspace_id: document[0].metadata.workspace_id,
          workspace_name: document[0].metadata.workspace_name,
          order: document[0].metadata.order,
          _id: document[0].metadata._id,
        }

        boards.push(board)
      }
    }

    return boards.map(toServerCaseKeys<IBoard>)
  }

  public async similaritySearchWorkspaces(
    query: string,
    userId: Types.ObjectId,
    count: number
  ): Promise<IWorkspace[]> {
    const collection = this.mongoClient.db(process.env.DATABASE_NAME).collection('workspaces')

    const vectorstore = new MongoDBAtlasVectorSearch(this.embeddingService.getEmbeddingModel(), {
      collection,
      indexName: process.env.WORKSPACES_INDEX_NAME,
      textKey: 'name',
      embeddingKey: 'embeddings',
    })

    const preFilter: any = {
      user_id: {
        $eq: userId,
      },
      is_deleted: {
        $eq: false,
      },
    }

    const emb = await this.embeddingService.getEmbeddings(query.trim().toLowerCase())
    const documents = await vectorstore.similaritySearchVectorWithScore(emb, count, {
      preFilter,
    })

    const workspaces = []

    const maxScore = documents.length > 0 ? documents[0][1] : 0

    for (const document of documents) {
      if ((document[1] > maxScore - 0.2 && document[1] > 0.42) || document[1] > 0.52) {
        const workspace = {
          name: document[0].pageContent,
          order: document[0].metadata.order,
          _id: document[0].metadata._id,
        }

        workspaces.push(workspace)
      }
    }

    return workspaces.map(toServerCaseKeys<IWorkspace>)
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

    for (const document of accDocuments) {
      const tool = {
        name: document[0].metadata.name,
        description: document[0].pageContent,
      }

      tools.push(tool)
    }

    return tools
  }

  public validateInputBySchema(input: any, schema: ZodType<any>): string[] {
    const result = schema.safeParse(input)
    const messages: string[] = []

    if (!result.success) {
      result.error.issues.forEach((err) => {
        messages.push(`Field "${err.path.join('.')}" - ${err.message}`)
      })
    }

    return messages
  }
}
