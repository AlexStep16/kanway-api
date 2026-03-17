import { ZodType } from 'zod'

export function validateInputByScheme(input: any, scheme: ZodType<any>): string[] {
  const result = scheme.safeParse(input)
  const messages: string[] = []

  if (!result.success) {
    result.error.issues.forEach((err) => {
      messages.push(`Field "${err.path.join('.')}" - ${err.message}`)
    })
  }

  return messages
}
