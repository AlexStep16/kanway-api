import { ClientSession } from 'mongoose'
import { DispatchPayload } from './ToolDispatcherService.ts'

export abstract class AbstractToolExecutor {
  protected toolRegistry: Record<
    string,
    (payload: DispatchPayload, session?: ClientSession) => Promise<any>
  > = {}

  public getRegisteredToolNames(): string[] {
    return Object.keys(this.toolRegistry)
  }

  public async executeTool(payload: DispatchPayload, session?: ClientSession) {
    const toolFunc = this.toolRegistry[payload.toolCall.name]

    if (!toolFunc) {
      throw new Error(
        `Tool execution failed: Tool '${payload.toolCall.name}' is not registered in this executor.`,
      )
    }

    return await toolFunc(payload, session)
  }
}
