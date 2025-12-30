import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { toServerCaseKeys } from '@utils/objectTransformers.ts'
import AgentInstructionRepository from '@repositories/AgentInstructionRepository.ts'
import { AgentInstructionDTO } from '@dtos/AgentInstructionDTO.ts'
import { IAgentInstructionRaw } from '@/domain/entities/IAgentInstructionRaw.ts'
import { IAgentInstruction } from '@/domain/entities/IAgentInstruction.ts'
import { BaseService } from '@application/services/BaseService.ts'

export class AgentInstructionService {
  protected repository: AgentInstructionRepository
  protected embeddingService: EmbeddingService
  protected baseService: BaseService

  constructor(
    agentInstructionRepository: AgentInstructionRepository,
    embeddingService: EmbeddingService,
    baseService: BaseService
  ) {
    this.repository = agentInstructionRepository
    this.embeddingService = embeddingService
    this.baseService = baseService
  }

  private async _embedAndCreateExamples(dto: AgentInstructionDTO): Promise<IAgentInstruction[]> {
    const results: IAgentInstructionRaw[] = []

    const examplesEmbeddings = await this.embeddingService.getEmbeddingsForMultipleTexts(
      dto.examples
    )

    for (let i = 0; i < dto.examples.length; i++) {
      const result = await this.repository.create({
        topic: dto.topic,
        rule: dto.rule,
        embeddings: examplesEmbeddings[i],
        example: dto.examples[i],
        suggested_tools: dto.suggestedTools,
      })

      results.push(result)
    }

    return results.map((item) => toServerCaseKeys<IAgentInstruction>(item))
  }

  public async save(dto: AgentInstructionDTO): Promise<IAgentInstruction[] | null> {
    const existingAgentInstructions = await this.repository.find({})
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
