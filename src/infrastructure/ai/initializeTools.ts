import { createTools } from '@application/ai/helpers/toolsHelper.ts'
import { initializeDependencies } from '@infrastructure/di/initializeDependencies.ts'

const dependencies = initializeDependencies()

export async function initializeTools() {
  console.log('Initializing tools...')

  const tools = createTools(
    dependencies.adapters.baseToolAdapter,
    dependencies.adapters.taskBaseToolAdapter,
    dependencies.adapters.taskEditToolAdapter,
    dependencies.adapters.boardBaseToolAdapter,
    dependencies.adapters.boardEditToolAdapter,
    dependencies.adapters.categoryBaseToolAdapter,
    dependencies.adapters.categoryEditToolAdapter,
    dependencies.adapters.workspaceBaseToolAdapter,
    dependencies.adapters.workspaceEditToolAdapter,
  )

  for (const tool of tools.allTools) {
    await dependencies.services.toolService.save(tool)
  }

  console.log('Tools initialized')
}
