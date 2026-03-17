import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import AgentSkillRepository from '@repositories/AgentSkillRepository.ts'
import { AgentSkillDTO } from '@dtos/AgentSkillDTO.ts'
import { IAgentSkill } from '@/domain/entities/IAgentSkill.ts'
import { BaseService } from './BaseService.ts'
import { IAgentSkillRaw } from '@/domain/entities/IAgentSkillRaw.ts'
import { IAgentSkillCriteria } from '../interfaces/criterias/IAgentSkillCriteria.ts'

export class AgentSkillService extends BaseService<
  IAgentSkillRaw,
  IAgentSkill,
  IAgentSkillCriteria
> {
  protected repository: AgentSkillRepository
  protected embeddingService: EmbeddingService

  constructor(agentSkillRepository: AgentSkillRepository, embeddingService: EmbeddingService) {
    super(agentSkillRepository)

    this.repository = agentSkillRepository
    this.embeddingService = embeddingService
  }

  public async save(dto: AgentSkillDTO): Promise<IAgentSkill | null> {
    const existingAgentSkills = await this.repository.findByCriteria({})
    const existingAgentSkill = existingAgentSkills.find((skill) => skill.name === dto.name)

    if (existingAgentSkill) {
      if (
        existingAgentSkill.description !== dto.description ||
        existingAgentSkill.rule !== dto.rule ||
        JSON.stringify(existingAgentSkill.suggestedTools) !== JSON.stringify(dto.suggestedTools)
      ) {
        await this.repository.deleteMany({ name: dto.name })
      } else return null
    }

    const descriptionEmbeddings = await this.embeddingService.getEmbeddings(dto.description)

    return await this.repository.create({
      name: dto.name,
      rule: dto.rule,
      embeddings: descriptionEmbeddings,
      description: dto.description,
      suggestedTools: dto.suggestedTools,
    })
  }
}
