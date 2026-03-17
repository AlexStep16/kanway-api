import * as BaseSkills from '@/application/ai/agent/skills/baseSkills.ts'
import * as BoardSkills from '@/application/ai/agent/skills/boardSkills.ts'
import * as CategorySkills from '@/application/ai/agent/skills/categorySkills.ts'
import * as TaskSkills from '@/application/ai/agent/skills/taskSkills.ts'
import * as WorkspaceSkills from '@/application/ai/agent/skills/workspaceSkills.ts'
import { initializeDependencies } from '@infrastructure/di/initializeDependencies.ts'

const dependencies = initializeDependencies()

export async function initializeAgentSkills() {
  console.log('Initializing agent skills...')

  for (const skill of Object.values(BaseSkills)) {
    await dependencies.services.agentSkillService.save(skill)
  }
  for (const skill of Object.values(TaskSkills)) {
    await dependencies.services.agentSkillService.save(skill)
  }
  for (const skill of Object.values(CategorySkills)) {
    await dependencies.services.agentSkillService.save(skill)
  }
  for (const skill of Object.values(BoardSkills)) {
    await dependencies.services.agentSkillService.save(skill)
  }
  for (const skill of Object.values(WorkspaceSkills)) {
    await dependencies.services.agentSkillService.save(skill)
  }

  console.log('Agent skills initialized')
}
