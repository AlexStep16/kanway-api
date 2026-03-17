import AgentSkillModel from '@models/AgentSkillModel.ts'
import { IAgentSkillRaw } from '@entities/IAgentSkillRaw.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IAgentSkill } from '@entities/IAgentSkill.ts'
import { IAgentSkillCriteria } from '../interfaces/criterias/IAgentSkillCriteria.ts'
import { FilterQuery, Types } from 'mongoose'

export default class AgentSkillRepository extends BaseRepository<IAgentSkillRaw, IAgentSkill> {
  constructor() {
    super(AgentSkillModel)
  }

  public buildFilter(
    criteria: IAgentSkillCriteria,
    userId: Types.ObjectId,
  ): FilterQuery<IAgentSkillRaw> {
    const filter: FilterQuery<IAgentSkillRaw> = { user_id: userId }

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    if (criteria.name) {
      filter.name = criteria.name
    } else if (criteria.names) {
      filter.name = { $in: criteria.names }
    }

    return filter
  }
}
