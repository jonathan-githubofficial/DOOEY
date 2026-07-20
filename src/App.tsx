// Temporary app root for layer L2-design (unit 2.3). Renders the primitives Gallery, this
// layer's E2E surface (e2e/gallery.spec.ts, tagged @l2). This replaces the unit-1.4 boot/
// status surface (auth + live task count via react-query) that unit 1.5's @l1 smoke spec
// exercises; that content is not reachable from this root while the Gallery occupies it.
// Unit 3.1 replaces this body with a RouterProvider and moves Gallery behind a /gallery
// route, restoring signed-in app content (StatusSurface's concerns) behind the guard - see
// this unit's result note for the deliberate, temporary @l1 regression that follows.
import { Gallery } from '@/pages/Gallery'

export function App() {
  return <Gallery />
}
