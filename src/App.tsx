// Boot/status surface for unit 1.4. It renders the app's REAL auth + data state (not a
// "coming soon" stub) so unit 1.5 can assert the PocketBase seam is live; unit 3.1
// replaces this body with a RouterProvider. Lynx <text> does not inherit CSS, so colour
// and size are set explicitly on every <text>.
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { pb } from '@/lib/pb'
import { useAuthStore } from '@/stores'
import { useCollectionLive } from '@/lib/useCollectionLive'

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
  return (
    <QueryClientProvider client={queryClient}>
      <StatusSurface />
    </QueryClientProvider>
  )
}
