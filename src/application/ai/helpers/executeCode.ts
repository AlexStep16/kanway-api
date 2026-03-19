import { Types } from 'mongoose'

export async function executeCode(
  code: string,
  resolvedAmbiguities: Record<string, any>,
  userId: Types.ObjectId,
  inheritableMetadata: Record<string, any>,
) {
  const response = await fetch('http://localhost:8000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: code,
      resolved_ambiguities: resolvedAmbiguities,
      user_id: userId,
      config: {
        callbacks: {
          inheritableMetadata,
        },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  } else {
    return await response.json()
  }
}
