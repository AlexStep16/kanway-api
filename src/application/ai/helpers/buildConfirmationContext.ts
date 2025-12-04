import { ToolMessage } from "@langchain/core/messages";
import { AgentStateAnnotation } from "../../../AIModules/AgentStateAnnotation.ts";
import { confirmationConfigs } from "../../../AIModules/confirmationConfigs.ts";

export async function buildConfirmationContext(
  toolCall: any,
  state: typeof AgentStateAnnotation.State,
  config: any
) {
  const conf = confirmationConfigs[toolCall.name];
  if (!conf) return { tip: "", contextData: null };

  const { context } = conf;

  // 1. Контекст из предыдущего ToolMessage
  if (context.mode === 'tool') {
    const toolMsg = [...state.messages].reverse().find(
      m => m.constructor?.name === 'ToolMessage' && (m as any).name === context.toolName
    ) as ToolMessage | undefined;

    if (!toolMsg) {
      return {
        tip: conf.tip,
        contextData: { error: `Context tool '${context.toolName}' not found` }
      };
    }

    let parsed: any = toolMsg.content;
    
    try {
      parsed = JSON.parse((toolMsg.content as string));
    } catch {
      parsed = {};
    }
    return { tip: conf.tip, contextData: parsed };
  }

  // 2. Внешний контекст через контроллер
  if (context.mode === 'external') {
    if (!context.externalFetch) {
      return { tip: conf.tip, contextData: { error: 'External fetcher missing' } };
    }
    try {
      const data = await context.externalFetch({ toolCall, state, config });
      return { tip: conf.tip, contextData: data.result };
    } catch (e: any) {
      return {
        tip: conf.tip,
        contextData: { error: 'External fetch failed', message: String(e?.message || e) }
      };
    }
  }

  return { tip: conf.tip, contextData: null };
}