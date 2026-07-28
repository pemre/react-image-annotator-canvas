export interface Annotation {
  /** Stable identifier. */
  id: string | number
  /** Top-left X in image pixels. */
  x: number
  /** Top-left Y in image pixels. */
  y: number
  /** Width in image pixels. */
  width: number
  /** Height in image pixels. */
  height: number
  /** Optional reference to a Category. Drives fill/stroke colors and the label. */
  categoryId?: string
  /** Optional override label rendered on the box. Falls back to the category's label. */
  label?: string
  /** Transient UI flag — set when the user selects the box. Strip before persisting if you don't want to round-trip it. */
  isSelected?: boolean
  /** Free-form data the consumer can hang off each annotation. The library ignores it. */
  data?: unknown
}

export interface Category {
  /** Stable identifier referenced by `Annotation.categoryId`. */
  id: string
  /** Human-readable label rendered on annotations (when `showLabels` is on). */
  label: string
  /** Any CSS color. Used for stroke and (with `fillOpacity`) for fill. */
  color: string
  /** Fill opacity 0–1. Defaults to 0.35. */
  fillOpacity?: number
}

export interface AnnotatorTheme {
  /** Stroke around a selected annotation. */
  selectionStroke?: string
  /** Stroke width for selection highlight. */
  selectionStrokeWidth?: number
  /** Fill color for the in-progress draw rectangle. */
  draftFill?: string
  /** Stroke color for the in-progress draw rectangle. */
  draftStroke?: string
  /** Color of the resize-corner handles. Defaults to the annotation's category color. */
  handleColor?: string
  /** Size of corner handles in image pixels. */
  handleSize?: number
  /** Color/text style of the label badge. */
  labelTextColor?: string
  /** Background opacity of the label badge. Defaults to 1. */
  labelBackgroundOpacity?: number
  /** Default annotation color when categoryId is missing or unknown. */
  fallbackColor?: string
}

export type SelectionMode = 'single' | 'multi' | 'none'

export interface ImageAnnotatorProps {
  /** Image source URL. The canvas is sized to the image's natural dimensions. */
  imageUrl: string

  /** Current annotations (controlled). */
  annotations: Annotation[]
  /** Called whenever annotations change: draw / resize / move / delete / select. */
  onChange: (annotations: Annotation[]) => void

  /** Category definitions referenced by `Annotation.categoryId`. */
  categories?: Category[]
  /** Category id used for newly drawn annotations. Required when `drawingEnabled` is true. */
  activeCategoryId?: string

  /**
   * When true, click-and-drag on empty area creates a new annotation in
   * `activeCategoryId`. Mouse-down on an existing annotation never starts a draw.
   */
  drawingEnabled?: boolean
  /**
   * When true, selected annotations show resize handles and a delete button, and
   * can be dragged by their body to move. When false the canvas is read-only
   * except for selection.
   */
  editingEnabled?: boolean

  /** Selection behavior. Defaults to 'single'. Pass 'none' to disable selection entirely. */
  selectionMode?: SelectionMode

  /** Render the category label inside the top-left of each annotation. */
  showLabels?: boolean

  /** Fires whenever a single annotation is selected/clicked. `null` when the user clicks empty space. */
  onSelect?: (annotation: Annotation | null) => void

  /** Override visual defaults. */
  theme?: AnnotatorTheme

  /**
   * When true, all annotation coordinates (x, y, width, height) are rounded to
   * integers before being emitted via `onChange`. Affects draw, move, resize, and
   * keyboard-nudge. Default: false (preserve current float behaviour).
   */
  integerCoordinates?: boolean
}
