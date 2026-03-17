import { PendingToolCall } from '../agent/AgentStateAnnotation.ts'

export abstract class AbstractToolExecutor {
  protected toolRegistry: Record<
    string,
    (id: string, args: any, userId: string, config: Record<string, any>) => Promise<any>
  > = {}

  public getRegisteredToolNames(): string[] {
    return Object.keys(this.toolRegistry)
  }

  public async executeTool(toolCall: PendingToolCall, userId: string, config: Record<string, any>) {
    const toolFunc = this.toolRegistry[toolCall.name]

    if (!toolFunc) {
      throw new Error(
        `Tool execution failed: Tool '${toolCall.name}' is not registered in this executor.`,
      )
    }

    return await toolFunc(toolCall.id, toolCall.args, userId, config)
  }
}
