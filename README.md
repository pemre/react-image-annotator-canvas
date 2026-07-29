# react-image-annotator-canvas

**[Live Demo](https://pemre.github.io/react-image-annotator-canvas/)**

A small, dependency-free React component for drawing rectangular annotations on an image via an HTML canvas. Define your own categories — the library is intentionally not opinionated about what an annotation *means*.

> **Note:** This is a fork of [arun-k-y/react-image-annotator-canvas](https://github.com/arun-k-y/react-image-annotator-canvas). Changes and improvements are contributed back to the original repository where possible.

Use it for:

- Object labeling for ML pipelines
- Visual-diff / QA review tools
- Tagging regions of screenshots, manuscripts, blueprints, microscopy images
- Anywhere you need "draw a box on this picture and attach metadata"

## Install

```bash
npm install react-image-annotator-canvas
```

Peer deps: `react >= 17`, `react-dom >= 17`.

## Concepts

**Annotation** — one rectangle. Has `id`, `x`, `y`, `width`, `height`, and an optional `categoryId` that references a category.

**Category** — a user-defined label + color. The library doesn't know what your categories *mean*; you supply them.

**Three modes**, controlled independently via props:

| Prop              | Effect                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `drawingEnabled`  | Click-and-drag on empty area creates a new annotation in `activeCategoryId`.                    |
| `editingEnabled`  | Selected annotations show resize handles and a delete button. Their bodies can be dragged to move. |
| `selectionMode`   | `'single'` (default), `'multi'` (shift/cmd-click to add), or `'none'`.                          |

These are orthogonal — you can have `drawingEnabled` and `editingEnabled` both on at once. Or both off for a view-only image overlay.

## Usage

```tsx
import { useState } from 'react'
import {
  ImageAnnotator,
  type Annotation,
  type Category,
} from 'react-image-annotator-canvas'

const CATEGORIES: Category[] = [
  { id: 'cat',  label: 'Cat',  color: '#ef4444' },
  { id: 'dog',  label: 'Dog',  color: '#10b981' },
  { id: 'bird', label: 'Bird', color: '#a855f7' },
]

export function Labeler() {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState('cat')
  const [mode, setMode] = useState<'view' | 'edit' | 'draw'>('edit')

  return (
    <ImageAnnotator
      imageUrl="/photo.jpg"
      annotations={annotations}
      onChange={setAnnotations}
      categories={CATEGORIES}
      activeCategoryId={activeCategoryId}
      drawingEnabled={mode === 'draw'}
      editingEnabled={mode !== 'view'}
      showLabels
    />
  )
}
```

## Props

| Prop                | Type                                       | Default     | Description                                                                                |
| ------------------- | ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------ |
| `imageUrl`          | `string`                                   | —           | Source URL for the underlying image. The canvas is sized to the image's natural dimensions. |
| `annotations`       | `Annotation[]`                             | —           | Current annotations (controlled).                                                          |
| `onChange`          | `(annotations: Annotation[]) => void`      | —           | Fires for every change: draw, resize, move, select, delete.                                |
| `categories`        | `Category[]`                               | `[]`        | Category definitions referenced by `Annotation.categoryId`.                                |
| `activeCategoryId`  | `string`                                   | —           | Category id used for newly drawn annotations. Required when `drawingEnabled` is true.      |
| `drawingEnabled`    | `boolean`                                  | `false`     | Click-and-drag on empty area creates a new annotation.                                     |
| `editingEnabled`    | `boolean`                                  | `true`      | Selected annotations show handles + delete button; body is draggable to move.              |
| `selectionMode`     | `'single' \| 'multi' \| 'none'`            | `'single'`  | How selection works.                                                                       |
| `showLabels`        | `boolean`                                  | `false`     | Render the category label inside the top-left of each annotation.                          |
| `integerCoordinates`| `boolean`                                  | `false`     | Round all annotation coordinates (x, y, width, height) to integers before emitting via `onChange`. |
| `snapToEdges`       | `boolean`                                  | `false`     | When enabled, dragging or resizing a box snaps its edges to other annotation boxes and image borders within `snapThreshold` pixels. |
| `snapThreshold`     | `number`                                   | `8`         | Snapping distance in image pixels. Only effective when `snapToEdges` is `true`. |
| `onSelect`          | `(annotation: Annotation \| null) => void` | —           | Fires when an annotation is selected/clicked. `null` when the user clicks empty space.     |
| `theme`             | `AnnotatorTheme`                           | see source  | Override visual defaults (handle size, selection stroke, etc.).                            |

### Types

```ts
interface Annotation {
  id: string | number
  x: number
  y: number
  width: number
  height: number
  categoryId?: string
  label?: string          // overrides the category label on this annotation
  isSelected?: boolean    // transient UI flag — strip before persisting
  data?: unknown          // free-form payload; the library ignores it
}

interface Category {
  id: string
  label: string
  color: string           // any CSS color
  fillOpacity?: number    // 0–1, defaults to 0.35
}
```

Coordinates are in the image's natural pixel space, so values stay stable regardless of how the image is displayed.

## Interaction model

### Mouse / touch

The canvas listens to **Pointer Events** with `setPointerCapture`, so all the
interactions below work identically with a mouse, trackpad, stylus, or finger.

| Action                                            | Result                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| Click / tap an annotation                         | Selects it. With `selectionMode='single'`, clears other selections.     |
| Shift/Cmd/Ctrl-click an annotation (multi mode)   | Toggles its inclusion in the current selection.                         |
| Click empty space                                 | Clears the selection.                                                   |
| Click the red X on a selected annotation          | Deletes the annotation. Requires `editingEnabled`.                      |
| Drag a corner handle of a selected annotation     | Resizes from that corner. Requires `editingEnabled`.                    |
| Drag the body of a selected annotation            | Moves the annotation. Requires `editingEnabled`.                        |
| Click-and-drag on empty area                      | Draws a new annotation in `activeCategoryId`. Requires `drawingEnabled`. |

### Keyboard

The canvas is focusable (`tabIndex={0}`); click into it once and:

| Key                       | Result                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `Delete` / `Backspace`    | Deletes all selected annotations. Requires `editingEnabled`.                          |
| `Esc`                     | Clears the selection.                                                                 |
| Arrow keys                | Nudges the selected annotation(s) by 1 image-pixel. Requires `editingEnabled`.        |
| `Shift` + arrow keys      | Nudges by 10 image-pixels.                                                            |

### Snapping

When `snapToEdges` is enabled, dragging or resizing an annotation snaps its
edges to other annotation boxes and the image borders. Adjacent boxes
(snap to opposite edges) get a 1px offset so their borders touch without
overlapping. Aligned boxes (snap to same-type edges) stay flush. Dragging
or resizing beyond `snapThreshold` allows overlap — snapping is a magnetic
guide, not a hard constraint.

Multi-selected boxes move together as a group, and snapping applies to the
group's bounding box against non-selected boxes.

### Responsive sizing

The image is rendered with `max-width: 100%`, and a `ResizeObserver` keeps the
overlay canvas in sync with whatever size the layout gives the image. Annotation
coordinates are always stored in the image's **natural pixel space**, so the
values you persist are stable regardless of the rendered size or device DPI.

## Recipe: replicate the original "accepted / ignored" visual-diff workflow

The previous version of this library hardcoded `isAccepted` and `isIgnored` flags. You can recreate that with three categories:

```ts
const VISUAL_DIFF_CATEGORIES: Category[] = [
  { id: 'pending',  label: 'Pending',  color: '#fcdda6' },
  { id: 'accepted', label: 'Accepted', color: '#b3e8cd', fillOpacity: 0.7 },
  { id: 'ignored',  label: 'Ignored',  color: '#6464ff' },
]
```

Reassign an annotation between categories by editing `categoryId` in your state:

```ts
const accept = (id: string) =>
  setAnnotations((prev) =>
    prev.map((a) => (a.id === id ? { ...a, categoryId: 'accepted' } : a))
  )
```

## Run the demo

```bash
npm install
npm run example:install   # one-time
npm run example           # starts a Vite dev server at localhost:5173
```

The demo lives in [`example/`](./example) and imports the component directly from `../src` via a Vite alias, so any edit to the library hot-reloads in the browser.

## License

MIT
