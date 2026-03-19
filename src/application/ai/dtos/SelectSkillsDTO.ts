import { z } from 'zod'

export const SelectSkillsDTOSchema = z.object({
  skills: z
    .array(z.string())
    .describe('An array of the required main skills the user wants to perform.'),
})

export type SelectSkillsDTO = z.infer<typeof SelectSkillsDTOSchema>
