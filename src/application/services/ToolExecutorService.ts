import { BaseMessageLike, ToolMessage } from '@langchain/core/messages'

export class ToolExecutorService {
  private _validateToolArgs(functionName: string) {
    if (!toolsByName[functionName]) {
      return new ToolMessage({
        content: `Инструмент с именем "${functionName}" не найден.`,
        name: toolCall.name,
        tool_call_id: toolCall.id,
      })
    }
  }

  public oldExecuteTools(toolCall: any, relevantToolNames: string[], messages: BaseMessageLike[]) {
    const functionName = toolCall.name

    this._validateToolArgs(functionName)

    const functionSchema: {
      safeParse: (args: any) => { success: boolean; error?: any }
    } = functionSchemaMap.get(functionName)

    if (functionSchema) {
      const validationResult = functionSchema.safeParse(toolCall.args)

      if (!validationResult.success) {
        return new ToolMessage({
          content: `Ошибка валидации аргументов: ${validationResult.error.issues
            .map((issue: any) => `${issue.path.join('.')} - ${issue.message}`)
            .join('; ')}`,
          tool_call_id: toolCall.id,
          name: toolCall.name,
        })
      }
    }

    const tool: any = toolsByName[toolCall.name]

    if (tool.name === 'getChatHistory') {
      if (toolCall.args.return_summary === true)
        return getChatHistorySummaryHelper(messages, toolCall.id)
      return getChatHistoryWrapper(messages)
    }

    if (tool.name === 'getRelevantTools') {
      const { relevantNames } = await reActToolsRetrieve(toolCall.args.steps)

      relevantToolNames.push(...(relevantNames || []))

      return new ToolMessage({
        content: `Я нашел инструменты.`,
        tool_call_id: toolCall.id,
      })
    }

    const observation: IToolResult = await tool.invoke(toolCall.args)

    if (toolsWithOperationLogsByName[functionName]) {
      const operationLogs: HydratedDocument<IOperationLog>[] = []
      const observationTyped = observation.result as IModificationResult<any>

      if (observationTyped && observationTyped.operation_logs) {
        if (observationTyped.operation_logs.operationLog) {
          operationLogs.push(observationTyped.operation_logs.operationLog)
        }
        if (observationTyped.operation_logs.dependencies) {
          operationLogs.push(...observationTyped.operation_logs.dependencies)
        }
      }

      await dispatchCustomEvent('modifications', {
        operation_logs: operationLogs,
      })

      if (observationTyped.result !== undefined) {
        if (Array.isArray(observationTyped.result)) {
          const reducedEntities = observationTyped.result.map((item) => {
            const reduced: any = {}

            if (item._id) reduced._id = item._id
            if (item.name) reduced.name = item.name
            if (item.category_id) reduced.category_id = item.category_id
            if (item.board_id) reduced.board_id = item.board_id
            if (item.workspace_id) reduced.workspace_id = item.workspace_id
            if (item.due_date) reduced.due_date = item.due_date
            if (item.is_completed !== undefined) reduced.is_completed = item.is_completed
            if (item.is_deleted !== undefined) reduced.is_archived = item.is_archived
            if (item.color) reduced.color = item.color
            if (item.order !== undefined) reduced.order = item.order
            if (item.description) reduced.description = item.description

            return reduced
          })

          return new ToolMessage({
            content: JSON.stringify(reducedEntities),
            tool_call_id: toolCall.id,
            name: toolCall.name,
          })
        } else {
          return new ToolMessage({
            content: JSON.stringify(observationTyped.result || observationTyped),
            tool_call_id: toolCall.id,
            name: toolCall.name,
          })
        }
      } else {
        return new ToolMessage({
          content: JSON.stringify(observation),
          tool_call_id: toolCall.id,
          name: toolCall.name,
        })
      }
    }

    return new ToolMessage({
      content: JSON.stringify(observation),
      tool_call_id: toolCall.id,
      name: toolCall.name,
    })
  }

  public async executeTool(toolCall, relevantToolNames, messages): Promise<ToolMessage> {
    // 1. ВАЛИДАЦИЯ ВХОДА (отдельный приватный метод)
    // const validationResult = this._validateToolArgs(toolCall);

    // 2. СПЕЦИАЛЬНЫЕ ОБРАБОТЧИКИ (getChatHistory, getRelevantTools)
    // Это можно вынести в отдельные приватные методы, чтобы очистить if/else
    if (toolCall.name === 'getChatHistory') return this._handleChatHistory(toolCall, messages)
    if (toolCall.name === 'getRelevantTools')
      return this._handleRelevantTools(toolCall, relevantToolNames)

    // 3. ВЫПОЛНЕНИЕ КОДА ИНСТРУМЕНТА
    const observation = await tool.invoke(toolCall.args)

    // 4. ЛОГИРОВАНИЕ АУДИТА (отдельный приватный метод)
    // const logEvent = this._processOperationLogs(toolCall, observation);

    // 5. ФОРМАТИРОВАНИЕ ОТВЕТА (отдельный приватный метод)
    return this._formatObservation(toolCall, observation)
  }
}
