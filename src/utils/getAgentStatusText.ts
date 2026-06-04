import { AgentsEnum } from '@/enums/AgentsEnum.js'

export function getAgentStatusText(agent: AgentsEnum) {
  switch (agent) {
    case AgentsEnum.ORCHESTRATOR:
      return 'Анализирую запрос'
    case AgentsEnum.TASK_MANAGER:
      return 'Работаю с задачами'
    case AgentsEnum.CATEGORY_MANAGER:
      return 'Работаю с категориями'
    case AgentsEnum.BOARD_MANAGER:
      return 'Работаю с досками'
    case AgentsEnum.WORKSPACE_MANAGER:
      return 'Работаю с рабочими пространствами'
    default:
      return 'Unknown agent status.'
  }
}
