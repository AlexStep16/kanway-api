import { z } from 'zod'

export const ExecutePlanDTOSchema = z
  .object({
    plan: z
      .array(z.string())
      .describe(
        'The list of instructions for the coder to execute. Each item should be a clear, concise instruction.',
      ),
    payload: z
      .looseObject({})
      .describe(
        'MANDATORY: ALL technical values (IDs, titles, dates, names) MUST be here. ' +
          'The Python Executor will CRASH if this object is empty. ' +
          "Example: {'target_id': '69b...', 'new_name': 'Work'}",
      )
      .optional(),
  })
  .describe(
    'ONE-STEP RULE: For 95% of requests (Creation, Updates, Metadata Moves), this array MUST contain exactly ONE string. ' +
      "Combine 'Create Categories', 'Create Tasks', and 'Render' into a single technical instruction. " +
      "Multiple steps are allowed ONLY if a 'semantic_search' review is required between actions.",
  )

export type ExecutePlanDTO = z.infer<typeof ExecutePlanDTOSchema>
