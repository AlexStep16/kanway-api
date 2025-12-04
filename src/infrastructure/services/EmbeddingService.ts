import { OpenAIEmbeddings } from '@langchain/openai'

const embeddingModel = new OpenAIEmbeddings({ model: 'text-embedding-3-large' })

export class EmbeddingService {
  public async getEmbeddings(text: string): Promise<number[]> {
    const embeddings = await embeddingModel.embedQuery(text)

    return embeddings
  }

  public async getEmbeddingsForMultipleTexts(texts: string[]): Promise<number[][]> {
    const embeddings = await embeddingModel.embedDocuments(texts)
    return embeddings
  }

  public getEmbeddingModel(): OpenAIEmbeddings {
    return embeddingModel
  }
}
