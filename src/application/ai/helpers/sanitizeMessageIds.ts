import { BaseMessage } from '@langchain/core/messages'

export function sanitizeMessageIds(messages: BaseMessage[]): void {
  messages.forEach((msg, index) => {
    // Проверяем: пустой ли ID, или содержит ли он запрещенные символы (например, пробелы, двоеточия и т.д.)
    console.log('Original message ID:', msg.id)
    if (!msg.id || msg.id.trim() === '' || !/^[a-zA-Z0-9_-]+$/.test(msg.id)) {
      const typeStr = msg._getType() || 'msg'
      // Генерируем UUID без запрещенных символов
      const uniquePart = crypto.randomUUID().replace(/-/g, '_')

      // Устанавливаем валидный ID
      msg.id = `${typeStr}_${index}_${uniquePart}`
    }
  })
}
