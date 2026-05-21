import { Types } from 'mongoose'

export async function executeCode(
  code: string,
  resolvedAmbiguities: Record<string, any>,
  userId: Types.ObjectId,
  jobId: string,
  payload: Record<string, any> = {},
) {
  const url = (process.env.PYTHON_SANDBOX_URL || 'http://localhost:8000') + '/execute'
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: code,
      resolved_ambiguities: resolvedAmbiguities,
      job_id: jobId,
      user_id: userId,
      payload: payload,
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  } else {
    return await response.json()
  }
}
