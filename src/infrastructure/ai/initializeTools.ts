import { createTools } from '@application/ai/helpers/toolsHelper.ts'
import { initializeDependencies } from '@infrastructure/di/initializeDependencies.ts'

const dependencies = initializeDependencies()

export function initializeTools() {
  const tools = createTools(
    dependencies.adapters.taskToolAdapter,
    dependencies.adapters.boardToolAdapter,
    dependencies.adapters.categoryToolAdapter,
    dependencies.adapters.workspaceToolAdapter,
    dependencies.services.operationLogService
  )

  for (const tool of tools.allTools) {
    dependencies.services.toolService.save(tool)
  }
}
