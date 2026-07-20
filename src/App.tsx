// App root (unit 3.1): the router took over. It renders the TanStack RouterProvider on
// memory history (src/router.tsx) inside the QueryClientProvider L1 set up. The temporary L2
// gallery + L1 status surfaces moved to the public /gallery route (src/router.tsx); the real
// authed pages land in later layers behind the pathless `app` guard.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'

import { router } from '@/router'

const queryClient = new QueryClient()

export function App() {
  // StrictMode is intentionally absent: ReactLynx's entry (src/index.tsx) mounts via
  // `root.render` without it (L1 baseline), so 3.1 keeps that shape.
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
