import { ITask } from '@/domain/entities/ITask.ts'
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
          _id: document[0].metadata._id,
        }

        tasks.push(task)
      }
    }

    return tasks.map(toServerCaseKeys<ITask>)
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
