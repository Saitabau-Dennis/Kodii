import { env } from '$env/dynamic/private'
import { normalizePhone } from '$lib/server/auth'

export interface SendSMSInput {
  to: string
  message: string
  refId?: string
}

interface TiaraResponse {
  status?: string
  statusCode?: string
  desc?: string
  msgId?: string
  [key: string]: unknown
}

/**
 * Sends an SMS using the Tiara Connect API.
 */
export async function sendSMS(input: SendSMSInput): Promise<TiaraResponse> {
  if (!env.TIARA_ENDPOINT) {
    throw new Error('TIARA_ENDPOINT is not set')
  }

  if (!env.TIARA_API_KEY) {
    throw new Error('TIARA_API_KEY is not set')
  }

  if (!env.TIARA_SENDER_ID) {
    throw new Error('TIARA_SENDER_ID is not set')
  }

  const payload: Record<string, string> = {
    from: env.TIARA_SENDER_ID,
    to: normalizePhone(input.to),
    message: input.message,
  }

  if (input.refId) {
    payload.refId = input.refId
  }

  const response = await fetch(env.TIARA_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TIARA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`SMS sending failed: ${response.status} ${response.statusText} ${text}`)
  }

  try {
    return JSON.parse(text) as TiaraResponse
  } catch {
    return { status: 'SUCCESS', desc: text }
  }
}
