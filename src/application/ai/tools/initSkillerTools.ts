import { tool } from '@langchain/core/tools'
import { SuccessToolResult } from './helpers/SuccessToolResult.ts'
import { SelectSkillsDTOSchema } from '../dtos/SelectSkillsDTO.ts'

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
