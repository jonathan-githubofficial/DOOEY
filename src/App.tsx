// Temporary app root spanning L1 + L2 gates until unit 3.1 lands the router/guard.
//
// It renders BOTH:
//   - StatusSurface: unit 1.4's real auth + live-task-count boot surface (DOOEY / signed
//     out|in / tasks: N). Unit 1.5's @l1 smoke spec asserts this surface end to end
//     (boot, programmatic sign-in via the R11 storage seam, live SSE count, reload
//     persistence), so it MUST remain mounted for @l1 to stay green.
//   - Gallery: unit 2.3's L2-design E2E surface (every primitive + token + font + grain,
//     extended with unit 2.4's Icons section), asserted by e2e/gallery.spec.ts (@l2).
//
// L2-design-gate-fix: unit 2.3 had replaced StatusSurface OUTRIGHT with <Gallery/>, which
// dropped the @l1 surface and broke the @l1 smoke (the framework's gate rule requires all
// previously-green tags stay green). Rendering both restores @l1 while keeping the @l2
// surface. Both are worker-safe (each passed its own gate in isolation). Unit 3.1 replaces
// this whole body with a RouterProvider and moves Gallery behind a /gallery route.
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { pb } from '@/lib/pb'
import { useAuthStore } from '@/stores'
import { useCollectionLive } from '@/lib/useCollectionLive'
import { Gallery } from '@/pages/Gallery'

const queryClient = new QueryClient()

const INK = 'hsl(28 12% 14%)'

function StatusSurface() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const qc = useQueryClient()

  // Realtime refresh: re-run the count on any collection change. useCollectionLive only
  // subscribes while signed in, so this is inert on the signed-out boot screen.
  useCollectionLive('tasks', () => {
    void qc.invalidateQueries({ queryKey: ['tasks', 'count'] })
  })

  // Reads pb through react-query. Gated on auth so the signed-out boot screen makes no
  // request (a full sign-in + live-SSE proof is unit 1.5's @l1 spec).
  const { data: taskCount } = useQuery({
    queryKey: ['tasks', 'count'],
    queryFn: async () => (await pb.collection('tasks').getList(1, 1)).totalItems,
    enabled: isAuthenticated,
  })

  return (
    <view
      className='bg-paper'
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      <text
        id='app-root'
        className='text-ink font-display'
        style={{ color: INK, fontSize: '40px' }}
      >
        DOOEY
      </text>
      <text
        id='auth-status'
        className='text-ink'
        style={{ color: INK, fontSize: '16px' }}
      >
        {isAuthenticated ? 'signed in' : 'signed out'}
      </text>
      {isAuthenticated ? (
        <text
          id='task-count'
          className='text-ink'
          style={{ color: INK, fontSize: '16px' }}
        >
          {`tasks: ${taskCount ?? '...'}`}
        </text>
      ) : null}
    </view>
  )
}

export function App() {
  // Single wrapping <view>: ReactLynx's root mounts one root subtree, so two sibling
  // components at the very top would drop all but the first (verified: Gallery vanished
  // when rendered as a bare sibling). Gallery is placed FIRST so its primitives sit in the
  // initial viewport for @l2's toBeVisible() asserts; StatusSurface follows below the fold -
  // @l1 reads it via textContent (deepText / readById walk shadow roots), so its scroll
  // position does not matter.
  return (
    <QueryClientProvider client={queryClient}>
      <view>
        <Gallery />
        <StatusSurface />
      </view>
    </QueryClientProvider>
  )
}
