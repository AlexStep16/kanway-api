import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'

export const routeHumanApprovalOutput = (state: typeof AgentStateAnnotation.State) => {
  // Если валидация Zod провалилась (флаг выставлен в узле HumanApproval)
  // Возвращаем агенту сообщения об ошибках для самоисправления
  if (state.validation_failed) {
    return 'retry'
  }

  // Если всё ок (или пользователь подтвердил) -> Выполняем
  return 'execute'
}
