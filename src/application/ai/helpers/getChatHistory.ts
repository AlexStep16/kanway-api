import { getLCMessageKind } from "./getLCMessageKind.ts";

interface GetChatHistoryData {
  return_summary?: boolean;
  turns?: number;
  all?: boolean;
  message_number?: number;
  message_range?: {
    start: number;
    end: number;
  };
}

function getRangeMessages(start: number, end: number, messages: any[]): any[] {
  const startMessages = getChatMessage(start, messages);
  if (!startMessages[0]) {
    return [];
  }
  const startIndex = messages.indexOf(startMessages[0]);

  if (startIndex < 0) {
    return [];
  }

  const endMessages = getChatMessage(end, messages);
  if (!endMessages[0]) {
    return [];
  }
  const endIndex = messages.indexOf(endMessages[endMessages.length - 1]);

  if (endIndex < 0) {
    return [];
  }

  return messages.slice(startIndex, endIndex + 1);
}

function getChatMessage(message_number: number, messages: any[]) {
  const filteredMessages = messages.filter(m => getLCMessageKind(m) === 'human' || getLCMessageKind(m) === 'ai');
  const relatedMessages: any[] = [];

  const message = filteredMessages[message_number - 1];

  if (message) {
    if (getLCMessageKind(message) === 'human') {
      let messageCounter = message_number;

      relatedMessages.push(message);

      while (messageCounter < messages.length) {
        const nextMessage = filteredMessages[messageCounter++];

        relatedMessages.push(nextMessage);

        if (nextMessage && getLCMessageKind(nextMessage) === 'ai') {
          return relatedMessages;
        }
      }

      return relatedMessages;
    }

    if (getLCMessageKind(message) === 'ai') {
      let messageCounter = message_number - 2;

      relatedMessages.push(message);

      while (messageCounter >= 0) {
        const nextMessage = filteredMessages[messageCounter--];

        relatedMessages.unshift(nextMessage);

        if (nextMessage && getLCMessageKind(nextMessage) === 'human') {
          return relatedMessages;
        }
      }

      return relatedMessages;
    }
  }

  return [];
}

function getChatTurns(turns: number, messages: any[]) {
  let turnsCounter = 0;
  let currentTurnAIMessages = 0;
  let currentTurnHumanMessages = 0;
  const newMessages: any[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    
    newMessages.push(m);

    if (getLCMessageKind(m) === 'human') {
      currentTurnHumanMessages++;
    } else if (getLCMessageKind(m) === 'ai') {
      currentTurnAIMessages++;
    }

    if (currentTurnHumanMessages === 1 && currentTurnAIMessages === 1) {
      turnsCounter++;

      currentTurnHumanMessages = 0;
      currentTurnAIMessages = 0;
    }

    if (turnsCounter === turns) {
      break;
    }
  }

  return newMessages;
}

export function getChatHistory(data: GetChatHistoryData, messages: any[]): string {
  let finalHistory = '';

  if (!messages || messages?.length === 0) {
    return finalHistory;
  }

  const { turns, all, message_number, message_range } = data;

  if (all) {
    return finalHistory;
  }

  if (turns && turns > 0) {
    const chatTurnsMessages = getChatTurns(turns, messages);

    finalHistory += `Последние ${turns} поворотов чата:\n`;

    chatTurnsMessages.forEach(m => {
      if (getLCMessageKind(m) === 'human') {
        finalHistory += `Пользователь: ${m.content}\n`;
      } else if (getLCMessageKind(m) === 'ai') {
        finalHistory += `Ассистент: ${m.content}\n`;
      }
    })
  }

  if (message_number && message_number > 0) {
    const chatMessagesSpecific = getChatMessage(message_number, messages);

    finalHistory += `Сообщение ${message_number}:\n`;

    chatMessagesSpecific.forEach(m => {
      if (getLCMessageKind(m) === 'human') {
        finalHistory += `Пользователь: ${m.content}\n`;
      } else if (getLCMessageKind(m) === 'ai') {
        finalHistory += `Ассистент: ${m.content}\n`;
      }
    });
  }

  if (message_range && message_range.start > 0 && message_range.end > 0 && message_range.start < message_range.end) {
    const rangeMessages = getRangeMessages(message_range.start, message_range.end, messages);

    finalHistory += `Сообщения с ${message_range.start} по ${message_range.end}:\n`;

    rangeMessages.forEach(m => {
      if (getLCMessageKind(m) === 'human') {
        finalHistory += `Пользователь: ${m.content}\n`;
      } else if (getLCMessageKind(m) === 'ai') {
        finalHistory += `Ассистент: ${m.content}\n`;
      }
    });
  }

  return finalHistory;
}