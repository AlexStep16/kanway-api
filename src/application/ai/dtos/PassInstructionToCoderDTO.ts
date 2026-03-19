import { z } from 'zod'

export const PassInstructionToCoderDTOSchema = z.object({
  instruction: z.string('Instruction must be a string').min(1, 'Instruction cannot be empty'),
})

export type PassInstructionToCoderDTO = z.infer<typeof PassInstructionToCoderDTOSchema>
