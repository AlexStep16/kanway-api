import { ITool } from '@domain/entities/ITool.ts'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { toServerCaseKeys } from '@utils/objectTransformers.ts'
import { ToolDTO } from '@dtos/ToolDTO.ts'
import ToolRepository from '@repositories/ToolRepository.ts'

export class ToolService {
  protected repository: ToolRepository
  protected embeddingService: EmbeddingService

  constructor(toolRepository: ToolRepository, embeddingService: EmbeddingService) {
    this.repository = toolRepository
    this.embeddingService = embeddingService
  }

  public async save(dto: ToolDTO): Promise<ITool | null> {
    const existingTools = await this.repository.find({})
    const existingTool = existingTools.find((tool) => tool.name === dto.name)

    if (existingTool) {
      if (existingTool.description !== dto.description) {
        const descriptionEmbedding = await this.embeddingService.getEmbeddings(dto.description)

        const updateResult = await this.repository.updateByFilter(
          { _id: existingTool._id },
          { ...existingTool, ...dto, embeddings: descriptionEmbedding }
        )

        return toServerCaseKeys<ITool>(updateResult)
      }

      return null
    } else {
      const descriptionEmbedding = await this.embeddingService.getEmbeddings(dto.description)

      const createResult = await this.repository.create({
        ...dto,
        embeddings: descriptionEmbedding,
      })

      return toServerCaseKeys<ITool>(createResult)
    }
  }
}
