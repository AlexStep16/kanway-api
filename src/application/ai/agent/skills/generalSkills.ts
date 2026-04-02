import { AgentSkill } from '../../interfaces/AgentSkill.ts'

export const UndoOperationSkill: AgentSkill = {
  name: 'UndoOperation',
  description: 'Skill for undoing a previously performed operation.',
  content: `
    ### SKILL: UndoOperation

    This skill allows you to undo a previously performed operation. You will be provided with a 'log_id' that corresponds to the operation you want to undo. Use this 'log_id' to call the 'undo_operation' tool.

    #### USAGE STRATEGY & RULES:
    - Tool to Use: You MUST use the 'undo_operation' tool to perform the undo action. This tool is specifically designed for this purpose and will ensure that the operation is properly reverted.
    - Log ID: The 'log_id' you receive will be a string that uniquely identifies the operation you want to undo. Make sure to pass this exact 'log_id' to the 'undo_operation' tool.
  `,
  relatedTools: ['undo_operation'],
  relatedEntities: [],
}
