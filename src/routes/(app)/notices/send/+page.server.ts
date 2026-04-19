import { fail } from '@sveltejs/kit'
import type { Actions, ServerLoad } from '@sveltejs/kit'
import { requireAuth } from '$lib/server/auth'
import { getNoticeSendContext, logNoticeActivity, sendNotice } from '$lib/services/notices'

export const load: ServerLoad = async (event) => {
  const session = await requireAuth(event)
  const context = await getNoticeSendContext(session.userId)

  return {
    properties: context.properties,
    unitsByProperty: context.unitsByProperty,
    tenants: context.tenants,
    canSendAllTenants: context.canSendAllTenants,
    user: session,
  }
}

export const actions: Actions = {
  sendNotice: async (event) => {
    const session = await requireAuth(event)
    const form = await event.request.formData()

    const title = form.get('title')?.toString().trim() ?? ''
    const message = form.get('message')?.toString().trim() ?? ''
    const targetType = form.get('targetType')?.toString().trim() ?? form.get('target_type')?.toString().trim() ?? ''
    const targetIds = form
      .getAll('targetIds')
      .map((value: FormDataEntryValue) => value.toString().trim())
      .filter((value: string) => value.length > 0)

    const errors: Record<string, string> = {}
    if (!message || message.length < 10) errors.message = 'Message must be at least 10 characters'
    if (message.length > 160) errors.message = 'Message must not exceed 160 characters'
    if (targetType !== 'all_tenants' && targetType !== 'property' && targetType !== 'unit' && targetType !== 'tenant') {
      errors.targetType = 'Target type is required'
    }
    if (targetType !== 'all_tenants' && targetIds.length === 0) {
      errors.targetIds = 'Select at least one recipient'
    }
    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    const safeTargetType = targetType as 'all_tenants' | 'property' | 'unit' | 'tenant'

    const context = await getNoticeSendContext(session.userId)
    if (safeTargetType === 'all_tenants' && !context.canSendAllTenants) {
      return fail(403, { message: 'Caretakers cannot send notices to all tenants' })
    }

    try {
      const result = await sendNotice(
        {
          title: title || null,
          message,
          targetType: safeTargetType,
          targetIds,
        },
        session.userId,
      )

      await logNoticeActivity(session.userId, 'notice_sent', null, {
        targetType: safeTargetType,
        recipientCount: result.sentCount,
      })

      return {
        success: true,
        sentCount: result.sentCount,
      }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Unable to send notice',
      })
    }
  },
}
