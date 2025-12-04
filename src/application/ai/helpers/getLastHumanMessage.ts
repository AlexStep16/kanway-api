import { getLCMessageKind } from "./getLCMessageKind.ts";

export default function getLastHumanMessage(messages: any[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (getLCMessageKind(m) === 'human') {
      return m;
    }
  }

  return null;
}