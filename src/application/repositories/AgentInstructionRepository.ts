import AgentInstructionModel from '@models/AgentInstructionModel.ts'
import { IAgentInstructionRaw } from '@entities/IAgentInstructionRaw.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'

export default class AgentInstructionRepository extends BaseRepository<
  IAgentInstructionRaw,
  typeof AgentInstructionModel
> {
  constructor() {
    super(AgentInstructionModel)
  }
}
