import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { toServerCaseKeys } from '@utils/objectTransformers.ts'
import AgentInstructionRepository from '@repositories/AgentInstructionRepository.ts'
import { AgentInstructionDTO } from '@dtos/AgentInstructionDTO.ts'
import { IAgentInstruction } from '@/domain/entities/IAgentInstruction.ts'

export class AgentInstructionService {
  protected repository: AgentInstructionRepository
  protected embeddingService: EmbeddingService

  constructor(
    agentInstructionRepository: AgentInstructionRepository,
    embeddingService: EmbeddingService
  ) {
    this.repository = agentInstructionRepository
    this.embeddingService = embeddingService
  }

  private async _embedAndCreateExamples(dto: AgentInstructionDTO): Promise<IAgentInstruction[]> {
    const results: IAgentInstruction[] = []

    const examplesEmbeddings = await this.embeddingService.getEmbeddingsForMultipleTexts(
      dto.examples
    )

    for (let i = 0; i < dto.examples.length; i++) {
      const result = await this.repository.create({
        topic: dto.topic,
        rule: dto.rule,
        embeddings: examplesEmbeddings[i],
        example: dto.examples[i],
        suggestedTools: dto.suggestedTools,
      })

      results.push(result)
    }

    return results.map((item) => toServerCaseKeys<IAgentInstruction>(item))
  }

  public async save(dto: AgentInstructionDTO): Promise<IAgentInstruction[] | null> {
    const existingAgentInstructions = await this.repository.findByCriteria({})
    const existingAgentInstruction = existingAgentInstructions.find(
      (instruction) => instruction.topic === dto.topic
    )

    if (existingAgentInstruction) {
      if (existingAgentInstruction.rule !== dto.rule) {
        await this.repository.deleteMany({ topic: dto.topic })
      }

      return null
    }

    return await this._embedAndCreateExamples(dto)
  }
}
