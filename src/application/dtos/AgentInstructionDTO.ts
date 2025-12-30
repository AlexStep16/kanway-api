export interface AgentInstructionDTO {
  topic: string
  examples: string[]
  rule: string
  suggestedTools: string[]
}
