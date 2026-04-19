// @ts-ignore - africastalking package does not ship TypeScript declarations
import AfricasTalking from 'africastalking'
import { AT_API_KEY, AT_SHORTCODE, AT_USERNAME } from '$env/static/private'
import { normalizePhone } from '$lib/server/auth'

export interface SendSMSInput {
  to: string
  message: string
  refId?: string
}

const at = AfricasTalking({
  apiKey: AT_API_KEY,
  username: AT_USERNAME,
})

const sms = at.SMS

/**
 * Sends an SMS to a single phone number via Africa's Talking.
 * Existing call signature is preserved for compatibility.
 */
export async function sendSMS(
  input: SendSMSInput,
): Promise<{ success: boolean; error?: string; providerMessageId?: string }> {
  const phone = normalizePhone(input.to)

  try {
    const result = await sms.send({
      to: [phone],
      message: input.message,
      from: AT_SHORTCODE,
    })

    const recipient = result.SMSMessageData?.Recipients?.[0]

    if (recipient?.status === 'Success') {
      const providerMessageId =
        (recipient as { messageId?: string; id?: string })?.messageId ??
        (recipient as { messageId?: string; id?: string })?.id
      return { success: true, providerMessageId }
    }

    const error = recipient?.status ?? 'Unknown error'
    throw new Error(error)
  } catch (error) {
    console.error('[KODII] SMS send failed:', error)
    throw new Error(error instanceof Error ? error.message : 'SMS send failed')
  }
}

/**
 * Sends an SMS to multiple phone numbers at once via Africa's Talking.
 */
export async function sendBulkSMS(
  phones: string[],
  message: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await sms.send({
      to: phones.map((phone) => normalizePhone(phone)),
      message,
      from: AT_SHORTCODE,
    })
    return { success: true }
  } catch (error) {
    console.error('[KODII] Bulk SMS send failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bulk SMS send failed',
    }
  }
}
