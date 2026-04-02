import { z } from 'zod'

export const ExecutePlanDTOSchema = z.object({
  plan: z
    .array(z.string())
    .describe(
      'The list of instructions for the coder to execute. Each item should be a clear, concise instruction.',
    ),
})

export type ExecutePlanDTO = z.infer<typeof ExecutePlanDTOSchema>
