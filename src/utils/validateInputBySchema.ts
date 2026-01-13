import { ZodType } from 'zod'

export function validateInputBySchema(input: any, schema: ZodType<any>): string[] {
  const result = schema.safeParse(input)
  const messages: string[] = []

  if (!result.success) {
    result.error.issues.forEach((err) => {
      messages.push(`Field "${err.path.join('.')}" - ${err.message}`)
    })
  }

  return messages
}
