// Unit 1.4's auth + live-task-count boot surface (DOOEY / signed out|in / tasks: N), the
// @l1 smoke's success oracle (e2e/smoke.l1.spec.ts asserts boot, programmatic sign-in via
// the R11 storage seam, live SSE count, and reload persistence end to end). Extracted from
// the temporary app root by unit 3.1: it now rides the PUBLIC /gallery route alongside the
// L2 Gallery so it stays mounted (and @l1 stays green) once the app root becomes the router.
// It is route-independent - it only visualises pb.authStore state via useAuthStore - so
// serving it on a public route is sound. Replaced/retired once real product pages exist.
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { pb } from '@/lib/pb'
import { useAuthStore } from '@/stores'
import { useCollectionLive } from '@/lib/useCollectionLive'

const INK = 'hsl(28 12% 14%)'

export function StatusSurface() {
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
