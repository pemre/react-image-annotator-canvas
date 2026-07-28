import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type {
  Annotation,
  AnnotatorTheme,
  Category,
  ImageAnnotatorProps,
} from './types'
import { DEFAULT_CLOSE_ICON } from './closeIcon'

type Id = string | number
type CornerName = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type EdgeName = 'top' | 'right' | 'bottom' | 'left'
type ResizeHandle = CornerName | EdgeName

interface Point {
  x: number
  y: number
}

interface Draft {
  startX: number
  startY: number
  x: number
  y: number
}

type Interaction =
  | { kind: 'draw'; draft: Draft }
  | { kind: 'resize'; boxId: Id; handle: ResizeHandle; original: Annotation }
  | {
      kind: 'move'
      boxId: Id
      startX: number
      startY: number
      originalX: number
      originalY: number
      started: boolean
      additive: boolean
      originallySelected: boolean
    }

type Press =
  | { kind: 'select'; boxId: Id; additive: boolean }
  | { kind: 'deselect' }

const DRAG_THRESHOLD = 4
const DEFAULT_HANDLE_SIZE = 12
const DELETE_BTN_SIZE = 30
const DELETE_BTN_OFFSET_X = 12
const DELETE_BTN_OFFSET_Y = -15

const FILLED_THEME: Required<AnnotatorTheme> = {
  selectionStroke: '#FFD700',
  selectionStrokeWidth: 4,
  draftFill: 'rgba(47, 109, 246, 0.18)',
  draftStroke: 'rgba(47, 109, 246, 0.9)',
  handleColor: '',
  handleSize: DEFAULT_HANDLE_SIZE,
  labelTextColor: '#ffffff',
  labelBackgroundOpacity: 1,
  fallbackColor: '#6b7280',
}

function getCanvasCoords(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  scaleX: number,
  scaleY: number
): Point {
  const rect = canvas.getBoundingClientRect()
  const displayX = clientX - rect.left
  const displayY = clientY - rect.top
  return {
    x: scaleX > 0 ? displayX / scaleX : displayX,
    y: scaleY > 0 ? displayY / scaleY : displayY,
  }
}

function normalizeRect(a: Annotation): Annotation {
  const x = a.width < 0 ? a.x + a.width : a.x
  const y = a.height < 0 ? a.y + a.height : a.y
  return { ...a, x, y, width: Math.abs(a.width), height: Math.abs(a.height) }
}

function isInside(box: { x: number; y: number; width: number; height: number }, p: Point) {
  return p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height
}

function hitCorner(
  box: Annotation,
  p: Point,
  scaleX: number,
  scaleY: number,
  size: number
): CornerName | null {
  const half = size / 2
  const dx = box.x * scaleX
  const dy = box.y * scaleY
  const dw = box.width * scaleX
  const dh = box.height * scaleY

  const px = p.x * scaleX
  const py = p.y * scaleY

  const corners: Array<{ name: CornerName; cx: number; cy: number }> = [
    { name: 'top-left', cx: dx, cy: dy },
    { name: 'top-right', cx: dx + dw, cy: dy },
    { name: 'bottom-left', cx: dx, cy: dy + dh },
    { name: 'bottom-right', cx: dx + dw, cy: dy + dh },
  ]
  const found = corners.find((c) => Math.abs(px - c.cx) <= half && Math.abs(py - c.cy) <= half)
  return found ? found.name : null
}

function hitEdge(
  box: Annotation,
  p: Point,
  scaleX: number,
  scaleY: number,
  size: number
): EdgeName | null {
  const half = size / 2
  const dx = box.x * scaleX
  const dy = box.y * scaleY
  const dw = box.width * scaleX
  const dh = box.height * scaleY

  const px = p.x * scaleX
  const py = p.y * scaleY

  const edges: Array<{ name: EdgeName; cx: number; cy: number }> = [
    { name: 'top', cx: dx + dw / 2, cy: dy },
    { name: 'right', cx: dx + dw, cy: dy + dh / 2 },
    { name: 'bottom', cx: dx + dw / 2, cy: dy + dh },
    { name: 'left', cx: dx, cy: dy + dh / 2 },
  ]
  const found = edges.find((edge) => Math.abs(px - edge.cx) <= half && Math.abs(py - edge.cy) <= half)
  return found ? found.name : null
}

function applyResize(
  original: Annotation,
  handle: ResizeHandle,
  p: Point,
  naturalSize: { width: number; height: number } | null,
  minSize = 5
): Annotation {
  let px = p.x
  let py = p.y
  if (naturalSize) {
    px = Math.max(0, Math.min(naturalSize.width, px))
    py = Math.max(0, Math.min(naturalSize.height, py))
  }

  const right = original.x + original.width
  const bottom = original.y + original.height
  let { x, y, width, height } = original
  switch (handle) {
    case 'top-left':
      x = Math.min(px, right - minSize)
      y = Math.min(py, bottom - minSize)
      width = right - x
      height = bottom - y
      break
    case 'top-right':
      y = Math.min(py, bottom - minSize)
      width = Math.max(minSize, px - original.x)
      height = bottom - y
      break
    case 'bottom-left':
      x = Math.min(px, right - minSize)
      width = right - x
      height = Math.max(minSize, py - original.y)
      break
    case 'bottom-right':
      width = Math.max(minSize, px - original.x)
      height = Math.max(minSize, py - original.y)
      break
    case 'top':
      y = Math.min(py, bottom - minSize)
      height = bottom - y
      break
    case 'bottom':
      height = Math.max(minSize, py - original.y)
      break
    case 'left':
      x = Math.min(px, right - minSize)
      width = right - x
      break
    case 'right':
      width = Math.max(minSize, px - original.x)
      break
  }
  return normalizeRect({ ...original, x, y, width, height })
}

function buildCategoryIndex(categories: Category[] | undefined): Map<string, Category> {
  const map = new Map<string, Category>()
  if (categories) for (const c of categories) map.set(c.id, c)
  return map
}

export const ImageAnnotator: React.FC<ImageAnnotatorProps> = ({
  imageUrl,
  annotations,
  onChange,
  categories,
  activeCategoryId,
  drawingEnabled = false,
  editingEnabled = true,
  selectionMode = 'single',
  showLabels = false,
  onSelect,
  theme,
  integerCoordinates = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const pressRef = useRef<Press | null>(null)
  const pressStartRef = useRef<Point | null>(null)

  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)

  const palette = useMemo<Required<AnnotatorTheme>>(
    () => ({ ...FILLED_THEME, ...(theme ?? {}) }),
    [theme]
  )
  const categoryIndex = useMemo(() => buildCategoryIndex(categories), [categories])

  const commitChange = useCallback(
    (next: Annotation[]) => {
      onChange(next)
    },
    [onChange]
  )

  const roundIfNeeded = useCallback(
    (n: number): number => (integerCoordinates ? Math.round(n) : n),
    [integerCoordinates]
  )

  const selectionEnabled = selectionMode !== 'none'

  // Measure initial size and hook up ResizeObserver
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const rect = wrapper.getBoundingClientRect()
    setDisplaySize({ width: rect.width, height: rect.height })

    // Defensively handle cached images on mount
    const img = wrapper.querySelector('img')
    if (img && img.complete && img.naturalWidth > 0) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    }

    const observer = new ResizeObserver(() => {
      if (wrapperRef.current) {
        const nextRect = wrapperRef.current.getBoundingClientRect()
        setDisplaySize({ width: nextRect.width, height: nextRect.height })
      }
    })
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [])

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      setDisplaySize({ width: rect.width, height: rect.height })
    }
  }

  const scaleX = useMemo(() => {
    return naturalSize && displaySize ? displaySize.width / naturalSize.width : 1
  }, [naturalSize, displaySize])

  const scaleY = useMemo(() => {
    return naturalSize && displaySize ? displaySize.height / naturalSize.height : 1
  }, [naturalSize, displaySize])

  // ─── Rendering ────────────────────────────────────────────────────────────

  const renderAll = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !displaySize || !naturalSize) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.scale(dpr, dpr)

    annotations.forEach((ann) => {
      const cat = ann.categoryId ? categoryIndex.get(ann.categoryId) : undefined
      const color = cat?.color ?? palette.fallbackColor
      const fillOpacity = cat?.fillOpacity ?? 0.35

      const dx = ann.x * scaleX
      const dy = ann.y * scaleY
      const dw = ann.width * scaleX
      const dh = ann.height * scaleY

      // Fill
      ctx.save()
      ctx.globalAlpha = fillOpacity
      ctx.fillStyle = color
      ctx.fillRect(dx, dy, dw, dh)
      ctx.restore()

      // Stroke
      ctx.lineWidth = 2
      ctx.strokeStyle = color
      ctx.strokeRect(dx, dy, dw, dh)

      // Label
      if (showLabels) {
        const label = ann.label ?? cat?.label
        if (label) {
          ctx.save()
          ctx.font =
            '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          const padX = 6
          const padY = 4
          const metrics = ctx.measureText(label)
          const textW = metrics.width
          const textH = 14
          ctx.globalAlpha = palette.labelBackgroundOpacity
          ctx.fillStyle = color
          ctx.fillRect(dx, dy, textW + padX * 2, textH + padY)
          ctx.globalAlpha = 1
          ctx.fillStyle = palette.labelTextColor
          ctx.textBaseline = 'top'
          ctx.fillText(label, dx + padX, dy + padY / 2 + 1)
          ctx.restore()
        }
      }

      // Selected highlight / handles
      if (ann.isSelected && selectionEnabled) {
        ctx.lineWidth = palette.selectionStrokeWidth
        ctx.strokeStyle = palette.selectionStroke
        ctx.strokeRect(dx, dy, dw, dh)

        if (editingEnabled) {
          const handleColor = palette.handleColor || color
          const hs = palette.handleSize
          ctx.fillStyle = handleColor
          const handles: Point[] = [
            { x: dx - hs / 2, y: dy - hs / 2 },
            { x: dx + dw - hs / 2, y: dy - hs / 2 },
            { x: dx - hs / 2, y: dy + dh - hs / 2 },
            { x: dx + dw - hs / 2, y: dy + dh - hs / 2 },
            { x: dx + dw / 2 - hs / 2, y: dy - hs / 2 },
            { x: dx + dw - hs / 2, y: dy + dh / 2 - hs / 2 },
            { x: dx + dw / 2 - hs / 2, y: dy + dh - hs / 2 },
            { x: dx - hs / 2, y: dy + dh / 2 - hs / 2 },
          ]
          handles.forEach((handle) => ctx.fillRect(handle.x, handle.y, hs, hs))
        }
      }
    })

    // In-progress draw rect
    if (interaction?.kind === 'draw') {
      const d = interaction.draft
      const startX = d.startX * scaleX
      const startY = d.startY * scaleY
      const currentX = d.x * scaleX
      const currentY = d.y * scaleY

      const x = Math.min(startX, currentX)
      const y = Math.min(startY, currentY)
      const w = Math.abs(currentX - startX)
      const h = Math.abs(currentY - startY)

      ctx.lineWidth = 2
      ctx.fillStyle = palette.draftFill
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = palette.draftStroke
      ctx.strokeRect(x, y, w, h)
    }

    ctx.restore()
  }, [
    annotations,
    interaction,
    categoryIndex,
    palette,
    selectionEnabled,
    editingEnabled,
    showLabels,
    displaySize,
    naturalSize,
    scaleX,
    scaleY,
  ])

  // Size backing store to display dimensions
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !displaySize) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = displaySize.width * dpr
    canvas.height = displaySize.height * dpr
    renderAll()
  }, [displaySize, renderAll])

  useEffect(() => {
    renderAll()
  }, [renderAll])

  // ─── Selection helpers ───────────────────────────────────────────────────

  const setSelection = useCallback(
    (id: Id | null, additive: boolean, toggleIfSelected = false) => {
      if (!selectionEnabled) return
      let nextSelected: Id | null = null
      const next = annotations.map((a) => {
        if (selectionMode === 'multi' && additive) {
          if (a.id === id) {
            const isSel = toggleIfSelected ? !a.isSelected : true
            if (isSel) nextSelected = a.id
            return { ...a, isSelected: isSel }
          }
          return a
        }
        // single mode OR multi non-additive: exclusive selection
        if (id === null) return a.isSelected ? { ...a, isSelected: false } : a
        if (a.id === id) {
          nextSelected = a.id
          return a.isSelected ? a : { ...a, isSelected: true }
        }
        return a.isSelected ? { ...a, isSelected: false } : a
      })
      onChange(next)
      if (onSelect) {
        const sel = nextSelected !== null ? next.find((a) => a.id === nextSelected) ?? null : null
        onSelect(sel)
      }
    },
    [annotations, onChange, onSelect, selectionEnabled, selectionMode]
  )

  // ─── Pointer handlers ────────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    canvas.focus()

    const p = getCanvasCoords(canvas, e.clientX, e.clientY, scaleX, scaleY)
    pressStartRef.current = p

    // 1. Corner handle on a selected annotation → resize
    if (editingEnabled && selectionEnabled) {
      const cornerHit = annotations
        .filter((a) => a.isSelected)
        .map((a) => ({ a, handle: hitCorner(a, p, scaleX, scaleY, palette.handleSize) }))
        .find((x) => x.handle !== null)
      if (cornerHit && cornerHit.handle) {
        setInteraction({
          kind: 'resize',
          boxId: cornerHit.a.id,
          handle: cornerHit.handle,
          original: cornerHit.a,
        })
        return
      }

      const edgeHit = annotations
        .filter((a) => a.isSelected)
        .map((a) => ({ a, handle: hitEdge(a, p, scaleX, scaleY, palette.handleSize) }))
        .find((x) => x.handle !== null)
      if (edgeHit && edgeHit.handle) {
        setInteraction({
          kind: 'resize',
          boxId: edgeHit.a.id,
          handle: edgeHit.handle,
          original: edgeHit.a,
        })
        return
      }
    }

    // 2. Body of any annotation: top-most (last drawn) wins
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i]
      if (!a) continue
      if (isInside(a, p)) {
        const additive = selectionMode === 'multi' && (e.shiftKey || e.metaKey || e.ctrlKey)
        if (a.isSelected) {
          if (editingEnabled) {
            setInteraction({
              kind: 'move',
              boxId: a.id,
              startX: p.x,
              startY: p.y,
              originalX: a.x,
              originalY: a.y,
              started: false,
              additive,
              originallySelected: true,
            })
          } else {
            pressRef.current = { kind: 'select', boxId: a.id, additive }
          }
          return
        } else {
          if (selectionEnabled) {
            setSelection(a.id, additive, false)
          }
          if (editingEnabled) {
            setInteraction({
              kind: 'move',
              boxId: a.id,
              startX: p.x,
              startY: p.y,
              originalX: a.x,
              originalY: a.y,
              started: false,
              additive,
              originallySelected: false,
            })
          }
          return
        }
      }
    }

    // 3. Empty area
    if (drawingEnabled && activeCategoryId !== undefined) {
      setInteraction({
        kind: 'draw',
        draft: { startX: p.x, startY: p.y, x: p.x, y: p.y },
      })
      return
    }
    pressRef.current = { kind: 'deselect' }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const p = getCanvasCoords(canvas, e.clientX, e.clientY, scaleX, scaleY)

    if (!interaction) {
      // Hover effects
      if (editingEnabled && selectionEnabled) {
        const selectedAnnotations = annotations.filter((a) => a.isSelected)
        const cornerHit = selectedAnnotations
          .map((a) => hitCorner(a, p, scaleX, scaleY, palette.handleSize))
          .find((handle) => handle !== null)

        if (cornerHit) {
          canvas.style.cursor =
            cornerHit === 'top-left' || cornerHit === 'bottom-right' ? 'nwse-resize' : 'nesw-resize'
          return
        }

        const edgeHit = selectedAnnotations
          .map((a) => hitEdge(a, p, scaleX, scaleY, palette.handleSize))
          .find((handle) => handle !== null)

        if (edgeHit) {
          canvas.style.cursor = edgeHit === 'top' || edgeHit === 'bottom' ? 'ns-resize' : 'ew-resize'
          return
        }
      }

      const insideHit = annotations.find((a) => isInside(a, p))
      if (insideHit) {
        if (editingEnabled && insideHit.isSelected) {
          canvas.style.cursor = 'move'
        } else if (selectionEnabled) {
          canvas.style.cursor = 'pointer'
        }
        return
      }

      canvas.style.cursor = drawingEnabled ? 'crosshair' : 'default'
      return
    }

    canvas.style.cursor = 'crosshair'

    if (interaction.kind === 'draw') {
      let px = p.x
      let py = p.y
      if (naturalSize) {
        px = Math.max(0, Math.min(naturalSize.width, px))
        py = Math.max(0, Math.min(naturalSize.height, py))
      }
      setInteraction({
        kind: 'draw',
        draft: { ...interaction.draft, x: px, y: py },
      })
      return
    }

    if (interaction.kind === 'resize') {
      const updated = applyResize(interaction.original, interaction.handle, p, naturalSize)
      const rounded = { ...updated, x: roundIfNeeded(updated.x), y: roundIfNeeded(updated.y), width: roundIfNeeded(updated.width), height: roundIfNeeded(updated.height) }
      const next = annotations.map((a) => (a.id === interaction.boxId ? { ...rounded, isSelected: a.isSelected } : a))
      commitChange(next)
      return
    }

    if (interaction.kind === 'move') {
      const dx = p.x - interaction.startX
      const dy = p.y - interaction.startY
      if (!interaction.started && Math.hypot(dx, dy) < DRAG_THRESHOLD) return

      let targetX = interaction.originalX + dx
      let targetY = interaction.originalY + dy

      if (naturalSize) {
        const box = annotations.find((a) => a.id === interaction.boxId)
        if (box) {
          targetX = Math.max(0, Math.min(naturalSize.width - box.width, targetX))
          targetY = Math.max(0, Math.min(naturalSize.height - box.height, targetY))
        }
      }

      const next = annotations.map((a) =>
        a.id === interaction.boxId ? { ...a, x: roundIfNeeded(targetX), y: roundIfNeeded(targetY) } : a
      )
      setInteraction({ ...interaction, started: true })
      commitChange(next)
    }
  }

  const finalize = useCallback(
    (pointerId?: number) => {
      const canvas = canvasRef.current
      if (canvas) {
        canvas.style.cursor = 'default'
        if (pointerId !== undefined) {
          try {
            canvas.releasePointerCapture(pointerId)
          } catch (e) {
            // safe catch
          }
        }
      }

      if (interaction?.kind === 'draw') {
        const d = interaction.draft
        const x = Math.min(d.startX, d.x)
        const y = Math.min(d.startY, d.y)
        const w = Math.abs(d.x - d.startX)
        const h = Math.abs(d.y - d.startY)
        if (w >= 5 && h >= 5 && activeCategoryId !== undefined) {
          const newAnn: Annotation = {
            id:
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            x: roundIfNeeded(x),
            y: roundIfNeeded(y),
            width: roundIfNeeded(w),
            height: roundIfNeeded(h),
            categoryId: activeCategoryId,
            isSelected: false,
          }
          commitChange([...annotations, newAnn])
        }
        setInteraction(null)
        pressRef.current = null
        pressStartRef.current = null
        return
      }

      if (interaction?.kind === 'move') {
        if (!interaction.started) {
          if (interaction.originallySelected) {
            setSelection(interaction.boxId, interaction.additive, true)
          }
        }
        setInteraction(null)
        pressRef.current = null
        pressStartRef.current = null
        return
      }

      if (interaction?.kind === 'resize') {
        setInteraction(null)
        pressRef.current = null
        pressStartRef.current = null
        return
      }

      const press = pressRef.current
      if (press) {
        if (press.kind === 'select') {
          setSelection(press.boxId, press.additive, true)
        } else if (press.kind === 'deselect') {
          setSelection(null, false)
        }
      }
      pressRef.current = null
      pressStartRef.current = null
    },
    [interaction, annotations, activeCategoryId, commitChange, setSelection]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const selected = annotations.filter((a) => a.isSelected)
    if (selected.length === 0) return

    const isDelete = e.key === 'Delete' || e.key === 'Backspace'
    const isEscape = e.key === 'Escape'
    const isArrow = e.key.startsWith('Arrow')

    if (isDelete && editingEnabled) {
      e.preventDefault()
      const idsToDelete = new Set(selected.map((a) => a.id))
      commitChange(annotations.filter((a) => !idsToDelete.has(a.id)))
      if (onSelect) onSelect(null)
    } else if (isEscape && selectionEnabled) {
      e.preventDefault()
      setSelection(null, false)
    } else if (isArrow && editingEnabled) {
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      let dx = 0
      let dy = 0
      if (e.key === 'ArrowLeft') dx = -step
      if (e.key === 'ArrowRight') dx = step
      if (e.key === 'ArrowUp') dy = -step
      if (e.key === 'ArrowDown') dy = step

      const next = annotations.map((a) => {
        if (!a.isSelected) return a
        let targetX = a.x + dx
        let targetY = a.y + dy
        if (naturalSize) {
          targetX = Math.max(0, Math.min(naturalSize.width - a.width, targetX))
          targetY = Math.max(0, Math.min(naturalSize.height - a.height, targetY))
        }
        return { ...a, x: roundIfNeeded(targetX), y: roundIfNeeded(targetY) }
      })
      commitChange(next)
    }
  }

  // Document-level pointerup
  useEffect(() => {
    const onUp = (e: PointerEvent) => finalize(e.pointerId)
    document.addEventListener('pointerup', onUp)
    return () => document.removeEventListener('pointerup', onUp)
  }, [finalize])

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width: 'fit-content',
        height: 'fit-content',
        display: 'inline-flex',
      }}
    >
      <img
        src={imageUrl}
        alt="Annotation target"
        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        draggable={false}
        onLoad={handleImageLoad}
      />
      <canvas
        ref={canvasRef}
        tabIndex={0}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: drawingEnabled ? 'crosshair' : 'default',
          touchAction: 'none',
          outline: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
      />

      {editingEnabled && selectionEnabled && annotations.map((ann) => {
        if (!ann.isSelected) return null
        const dx = ann.x * scaleX
        const dy = ann.y * scaleY
        const dw = ann.width * scaleX

        const left = dx + dw + DELETE_BTN_OFFSET_X
        const top = dy + DELETE_BTN_OFFSET_Y

        return (
          <button
            key={`del-${ann.id}`}
            onClick={(e) => {
              e.stopPropagation()
              commitChange(annotations.filter((a) => a.id !== ann.id))
              if (onSelect) onSelect(null)
            }}
            style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              width: `${DELETE_BTN_SIZE}px`,
              height: `${DELETE_BTN_SIZE}px`,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
            title="Delete annotation"
          >
            <img
              src={DEFAULT_CLOSE_ICON}
              alt="Delete"
              style={{
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
