export type NoticeWithMeta = {
  id: string
  title: string | null
  message: string
  targetType: 'all_tenants' | 'property' | 'unit' | 'tenant'
  targetId: string | null
  targetDescription: string
  sentBy: string
  sentAt: Date
  deliveryStatus: string | null
  replyCount: number
  unreadReplyCount: number
}

export type NoticeReply = {
  id: string
  noticeId: string | null
  tenantId: string | null
  tenantName: string | null
  fromPhone: string
  message: string
  receivedAt: Date
  isRead: boolean
}
