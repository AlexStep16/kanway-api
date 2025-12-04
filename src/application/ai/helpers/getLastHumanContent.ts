import { getLCMessageKind } from "./getLCMessageKind.ts";

export function getLastHumanContent(messages: any[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (getLCMessageKind(m) === 'human') {
      return m.kwargs?.content;
    }
  }
  return undefined;
}