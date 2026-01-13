import AgentInstructionModel from '@models/AgentInstructionModel.ts'
import { IAgentInstructionRaw } from '@entities/IAgentInstructionRaw.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IAgentInstruction } from '@entities/IAgentInstruction.ts'

export default class AgentInstructionRepository extends BaseRepository<
  IAgentInstructionRaw,
  IAgentInstruction
> {
  constructor() {
    super(AgentInstructionModel)
  }
}
