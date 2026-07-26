# Boards

Free-form mood boards: sticky notes, text, links, photos, stickers, doodles and sections on a
pannable, zoomable sheet of paper, with a freehand ink layer over the whole thing.

This is the port of the frozen web app's boards feature, minus folders, rebuilt so it holds 60fps
under a finger. Read [../../docs/design-system.md](../../docs/design-system.md) first; everything
here obeys it.

---

## The one rule that shaped everything

**Nothing on the canvas waits for anything.** Not for the network, not for React, not for a dialog
asking what you meant. Every design decision below falls out of that.

---

## Layers

Bottom to top, in [components/BoardCanvas.tsx](../src/features/boards/components/BoardCanvas.tsx):

| Layer | What | Why there |
|---|---|---|
| Paper | `colors.paper` + `<Grain />` | The page |
| Ink | Skia `<Canvas>` ([InkLayer.tsx](../src/features/boards/components/InkLayer.tsx)) | Dot grid, every committed stroke, and the live one. GPU. Takes no touches. |
| Backdrop | A full-viewport `View` with the pan and tap gestures | One finger on the paper moves the paper |
| Pieces | A viewport-sized `View`; each `CanvasItem` places itself | See "The board has no edges" |
| Capture | A sheet that exists only in draw mode | While the pen is up nothing can be picked up by accident |
| Chrome | Header, inspector, tool shelf | Screen space, never scaled |

### The board has no edges

There is no sheet of paper. The obvious way to build a pannable canvas is one big transformed
view holding every piece, and that is how this started — but a container big enough for an endless
board cannot exist, and **React Native on Android will not deliver a touch to a child that sits
outside its parent's bounds**, so growing the container just moves the wall and then breaks touch
when you reach it.

So each piece lays out at the viewport's origin and carries itself to where it belongs with a
transform built from the viewport's shared values. Every piece stays inside the parent's box as far
as hit-testing is concerned, no matter where on the board it lives, and nothing constrains where you
can pan. The dot grid is a shader that repeats forever
([InkLayer.tsx](../src/features/boards/components/InkLayer.tsx)), so it costs one draw call however
far you travel, negative coordinates included. The dots come in two sizes, a heavier one every
fifth cell: a perfectly even field tells you nothing, because every frame of a pan looks like the
last, and the coarser rhythm is what lets you read how far you have moved and how far out you are.

The price is that panning updates one transform per piece instead of one for the whole board. For
the tens of pieces a mood board holds that is nothing; a board with many hundreds would want
culling of off-screen items, which is not built.

Each piece is two nested views: the outer places and scales it in screen space (origin at its
top-left), the inner rotates it and does the pickup dip (origin at its centre, which is the only
place a rotation looks right).

### Why Skia, and only here

Ink is the one layer that has to keep up with a hand moving at speed. The live stroke is built from
a shared value inside a worklet, so a point reaches the screen without crossing to JavaScript. The
old web app rebuilt an SVG path in React state per pointer event; that is the difference between
ink and a slideshow.

Everything else stays a React Native view on purpose. Notes get a real `TextInput`, photos get a
real `Image`, and every piece inherits the Style page's palette, grain, radius and shadow for free.
Rebuilding all of that inside Skia would be a large new surface for hardcoded values to hide in,
which is the one thing the design system will not have.

On the web, Skia is CanvasKit compiled to WebAssembly.
[InkCanvas.web.tsx](../src/features/boards/components/InkCanvas.web.tsx) loads it lazily, so the
450 kB of JS and 3.2 MB (gzipped) of wasm are paid for by opening a board rather than by opening
the app.

**Getting the wasm to load takes two things, and one of them is easy to miss.**

1. The file has to *exist* somewhere servable. `postinstall` runs
   [scripts/copy-canvaskit.mjs](../scripts/copy-canvaskit.mjs), which copies it out of
   `node_modules` into `public/` — served at the root in dev, included in the export. It is
   gitignored: 8 MB of somebody else's build output does not belong in the repo.
2. CanvasKit has to be *told* to look there. Left alone it resolves the wasm against
   `document.currentScript.src`, which is the lazily loaded chunk, so it asks for
   `/_expo/static/js/web/canvaskit.wasm`. Metro answers every unknown path with `index.html`, and
   WebAssembly reports the doctype it was handed as a corrupt magic word:

       CompileError: expected magic word 00 61 73 6d, found 3c 21 44 4f

   `3c 21 44 4f` is `<!DO`. The `locateFile` option in
   [InkCanvas.web.tsx](../src/features/boards/components/InkCanvas.web.tsx) pins the lookup to the
   root and is what makes it find a module instead of a page.

**If the board page dies on a WebAssembly CompileError**, check both: `curl` the URL it actually
requested (the `text/html` content-type gives it away immediately), and confirm
`mobile/public/canvaskit.wasm` exists — if not, run `npm install` in `mobile/`.

---

## State: three owners, no overlap

| What | Owner |
|---|---|
| Loading a board, the wall of boards, doodle packs | TanStack Query ([api.ts](../src/features/boards/api.ts), [packs.ts](../src/features/boards/packs.ts)) |
| The board you are editing, plus its undo history | `useCanvasStore` ([store.ts](../src/features/boards/store.ts)) |
| Selection, edit target, active tool, loaded ink | React state in `BoardCanvas` |

Server state is TanStack Query everywhere else in the app and it still owns *loading*. It cannot
own the canvas: an editor needs a document it can undo, and every edit has to land before the
network is consulted, not after. So the canvas hydrates the document once on open, edits locally,
and `useBoardAutosave` flushes it back 700ms after you stop. Saves never overlap; a write that
starts while another is in flight is deferred until it lands, so a burst of edits cannot deliver
itself out of order. Leaving the screen or backgrounding the app is a hard deadline.

**Undo is one entry per gesture**, never per frame. A whole drag, a whole resize, a whole typing
session is one step. Continuous edits that have no natural end (rubbing out ink) open with
`beginGesture()` and close with `endGesture()`.

---

## Gestures

The model, and every gesture follows from it:

> **One finger on a piece moves that piece. One finger on the paper moves the paper. Two fingers
> always move and scale the paper.**

- **No press-and-wait before a drag.** The waiting was the friction. A piece's own pan is
  `maxPointers(1)`, so a second finger hands the gesture cleanly to the canvas pinch instead of
  fighting it.
- **Tap selects, tapping again opens for typing.** Two steps, so a finger landing on a note never
  eats a drag. Until then the `TextInput` is inert.
- Every gesture runs on the UI thread and touches React exactly **once**, on release. Drag, rotate
  and resize are transforms or animated boxes.
- Handles counter-scale by `1/zoom` so they stay thumb-sized at any zoom.
- **Frame content** (the header, and automatically when a board opens) is the answer to "where did
  my board go". On an endless canvas it is not a convenience: there are no edges to bump into and
  no minimap, so without it a board you panned away from is genuinely lost. It never magnifies past
  1×, because framing a board with one note on it should show you the note.

### Resize has two modes

`scalesWhole()` in [CanvasItem.tsx](../src/features/boards/components/CanvasItem.tsx) decides:

- **Photo, doodle, sticker, text** preview as a transform. Correct by definition — text scales its
  type with its box, which is how a headline gets made. Selection chrome carries the same growth so
  it traces the box you can see.
- **Note and section** animate real width (and height), so the words reflow live inside them.

---

## Tools, and the friction each one had to lose

Every tool is a physical object on a shelf, not an icon
([ToolGlyphs.tsx](../src/features/boards/components/ToolGlyphs.tsx)). **Tap** it and the thing lands
in the middle of the view, already selected and, if it takes words, already asking for them.
**Drag** it out and it lands where you let go.

| Tool | The friction | What it does instead |
|---|---|---|
| Note, text | A modal to type into | The words are typed on the piece, on the canvas, where they will live |
| Link | Same | The piece becomes its own two-field form in place |
| Photo | The web asked for frame and crop *before* you could see the picture | It lands immediately from the local file and uploads behind you; frame and crop are on the inspector, next to the photo |
| Sticker, doodle | Needs a choice first | A palette attached to the shelf, every swatch itself tappable **and** draggable |
| Section | Its body would swallow every empty tap | Grabbed by its header alone; the room inside stays room you can pan through |
| Pen | Undo could not reach a stroke five strokes back | Draw mode brings its own row: inks and a real eraser |

Reaching for any other tool **puts the pen down** (`leavePen` in
[ToolShelf.tsx](../src/features/boards/components/ToolShelf.tsx)). A toggle cannot do this, which is
why `onDraw` takes a boolean: leaving draw mode on would keep the ink row up and, worse, leave the
drawing sheet over the board, so the piece you just placed could not be touched.

Text carries its own `align` (left, centre, right) alongside font, weight and size, all of them on
the inspector bar.

**Per-object controls became one inspector bar.** The web hung colour swatches and font pickers off
each object. On a phone that fails twice: the object is under your hand, and a piece near the
bottom pushes its own controls off screen. A fixed bar above the shelf is reachable by the same
thumb every time. Delete lives there too, rather than as a small cross on a rotated sticker.

**Deleting a piece does not ask.** Undo is in the header, and asking twice about something that
cheap is the friction, not the safety.

**The keyboard never covers what you are typing.** On `keyboardDidShow` the paper slides up just
far enough, and slides back after.

---

## Data

`moodboards` in PocketBase, owner-scoped. `items` and `doodle` are JSON blobs;
`photos` is a multi-file field. Doodle packs are a separate owner-scoped collection so a drawing
made on one board can be stamped on every board.

A removed photo **keeps** its uploaded file. Deleting it would make undo a liar: the piece would
come back pointing at nothing. Files go when the board does.

### Folders are gone

The web had a `group` item kind and a `parent` field that hid pieces inside it. Both are removed
from the model. Sections cover the same need without hiding anything: they group by position, so
nothing is filed anywhere and there is nothing to undo if you change your mind.

---

## Known limits

- `heightOf()` is a reserved box, not a measurement. Notes report a fixed minimum, so the rotate
  centre and the resize handle drift slightly on a tall multi-line note mid-gesture. Both snap
  correct on release.
- No multi-select, no snapping guides, no z-order control. Deliberately out of v1.
- Every piece stays mounted regardless of where the viewport is. Fine at mood-board sizes; a very
  large board would want off-screen culling.
- Stacking is array order; sections always sit behind.
