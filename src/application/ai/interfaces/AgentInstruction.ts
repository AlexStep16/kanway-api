export interface AgentInstruction {
  topic: string
  examples: string[]
  rule: string
  suggestedTools: string[]
}
