import { AgentInstructions } from '@application/ai/agent/agentInstructions.ts'
import { initializeDependencies } from '@infrastructure/di/initializeDependencies.ts'

const dependencies = initializeDependencies()

export function initializeAgentInstructions() {
  for (const instruction of AgentInstructions) {
    dependencies.services.agentInstructionService.save(instruction)
  }
}
