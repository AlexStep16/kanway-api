import { tool } from '@langchain/core/tools'
import { SuccessToolResult } from './helpers/SuccessToolResult.js'
import { SelectSkillsDTOSchema } from '../dtos/SelectSkillsDTO.js'

export function initSkillerTools() {
  const selectSkills = tool(
    (data) => {
      return new SuccessToolResult(data.skills)
    },
    {
      name: 'select_skills',
      schema: SelectSkillsDTOSchema,
    },
  )

  return [selectSkills]
}
