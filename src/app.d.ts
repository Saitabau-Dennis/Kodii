import type { SessionPayload } from '$lib/server/auth'

declare global {
	namespace App {
		interface Locals {
			user: SessionPayload | null
			session: SessionPayload | null
		}
	}
}

export {}
