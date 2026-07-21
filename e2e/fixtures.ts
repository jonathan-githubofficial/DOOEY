import { readFileSync } from 'node:fs'

import { test as base } from '@playwright/test'
import PocketBase from 'pocketbase'

import { CREDS_FILE, type E2ECreds } from './pb-env'

// Fixtures bound to the DISPOSABLE PocketBase (127.0.0.1:8091) seeded in global-setup.
// `pb` is a PocketBase SDK client already authenticated as the test app user, so specs can
// create records the signed-in app owns (owner = user id, matching the data-isolation rules).

interface E2EFixtures {
  creds: E2ECreds
  /** PocketBase SDK client, authenticated as the test app user. */
  pb: PocketBase
}

export const test = base.extend<E2EFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the fixtures arg
  creds: async ({}, use) => {
    const creds = JSON.parse(readFileSync(CREDS_FILE, 'utf8')) as E2ECreds
    await use(creds)
  },
  pb: async ({ creds }, use) => {
    const pb = new PocketBase(creds.pbUrl)
    // Realtime/auto-cancellation off: specs fire deliberate sequential requests.
    pb.autoCancellation(false)
    await pb.collection('users').authWithPassword(creds.user.email, creds.user.password)
    await use(pb)
    pb.authStore.clear()
  },
})

export { expect } from '@playwright/test'
