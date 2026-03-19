import { tool } from '@langchain/core/tools'
import { SuccessToolResult } from './helpers/SuccessToolResult.ts'
import { PassInstructionToCoderDTOSchema } from '../dtos/PassInstructionToCoderDTO.ts'
import z from 'zod'

export function initBrainTools() {
  const passInstructionToCoder = tool(
    (data) => {
      return new SuccessToolResult(data.instruction)
    },
    {
      name: 'pass_instruction_to_coder',
      schema: PassInstructionToCoderDTOSchema,
    },
  )

  const askUserClarification = tool(
    (data) => {
      return new SuccessToolResult(null, data)
    },
    {
      name: 'ask_user_clarification',
      schema: z.object({
        question: z.string().describe('The clarifying question to send back to the user.'),
      }),
    },
  )

  return [passInstructionToCoder, askUserClarification]
}
