import { useState, useMemo } from 'react'
import {
  ImageAnnotator,
  type Annotation,
  type Category,
  type SelectionMode,
} from 'react-image-annotator-canvas'
import { DEMO_IMAGE } from './demoImage'

const INITIAL_CATEGORIES: Category[] = [
  { id: 'card', label: 'Card', color: '#2f6df6', fillOpacity: 0.15 },
  { id: 'button', label: 'Button', color: '#ef4444', fillOpacity: 0.5 },
  { id: 'text', label: 'Text', color: '#10b981', fillOpacity: 0.3 },
  { id: 'icon', label: 'Icon', color: '#a855f7', fillOpacity: 0.2 },
]

const INITIAL_ANNOTATIONS: Annotation[] = [
  { id: 'a', x: 60, y: 100, width: 280, height: 140, categoryId: 'card' },
  { id: 'b', x: 380, y: 100, width: 360, height: 140, categoryId: 'card' },
  { id: 'c', x: 80, y: 200, width: 90, height: 26, categoryId: 'button', label: 'Primary CTA' },
  { id: 'd', x: 80, y: 125, width: 160, height: 14, categoryId: 'text', data: 'Heading 1' },
]


export function App() {
  const [annotations, setAnnotations] = useState<Annotation[]>(INITIAL_ANNOTATIONS)
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES)
  const [activeCategoryId, setActiveCategoryId] = useState<string>(INITIAL_CATEGORIES[0]!.id)
  
  const [isLocked, setIsLocked] = useState(false)

  // Selection & Drawing Modes
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single')
  const [showLabels, setShowLabels] = useState(true)
  const [integerCoordinates, setIntegerCoordinates] = useState(false)
  const [snapToEdges, setSnapToEdges] = useState(false)
  const [snapThreshold, setSnapThreshold] = useState(8)
  
  // Theme Overrides
  const [selectionStroke, setSelectionStroke] = useState('#ff007f') // Hot Pink
  const [selectionStrokeWidth, setSelectionStrokeWidth] = useState(4)
  const [draftFill, setDraftFill] = useState('rgba(99, 102, 241, 0.15)')
  const [draftStroke, setDraftStroke] = useState('#6366f1')
  const [handleSize, setHandleSize] = useState(12)
  const [handleColor, setHandleColor] = useState('')
  const [labelTextColor, setLabelTextColor] = useState('#ffffff')
  const [labelBackgroundOpacity, setLabelBackgroundOpacity] = useState(0.85)
  const [fallbackColor, setFallbackColor] = useState('#6b7280')

  // Events Log State
  const [eventLogs, setEventLogs] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)

  const handleAnnotationsChange = (next: Annotation[]) => {
    setAnnotations(next)
    setDirty(true)
  }

  // Derived Selection State
  const selectedAnnotations = useMemo(() => {
    return annotations.filter((a) => a.isSelected)
  }, [annotations])

  const mainSelected = selectedAnnotations[0] ?? null

  const reset = () => {
    setAnnotations(INITIAL_ANNOTATIONS)
    setCategories(INITIAL_CATEGORIES)
    setActiveCategoryId(INITIAL_CATEGORIES[0]!.id)
    setEventLogs([])
    setDirty(false)
  }

  const changeSelectedCategory = (categoryId: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.isSelected ? { ...a, categoryId } : a))
    )
    setDirty(true)
  }

  const updateSelectedAnnotation = (updates: Partial<Annotation>) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.isSelected ? { ...a, ...updates } : a))
    )
    setDirty(true)
  }

  const deleteSelected = () => {
    setAnnotations((prev) => prev.filter((a) => !a.isSelected))
    setDirty(true)
  }

  // Handle category property modification dynamically
  const updateCategory = (id: string, updates: Partial<Category>) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    )
    setDirty(true)
  }

  // Event listener callback logging selection changes
  const handleSelect = (ann: Annotation | null) => {
    const time = new Date().toLocaleTimeString([], { hour12: false })
    const msg = ann
      ? `[${time}] Selection Changed: ID "${ann.id}" (Category: ${ann.categoryId ?? 'none'})`
      : `[${time}] Selection Cleared (null)`
    setEventLogs((prev) => [msg, ...prev].slice(0, 10))
  }

  const themeConfig = useMemo(() => {
    return {
      selectionStroke,
      selectionStrokeWidth,
      draftFill,
      draftStroke,
      handleSize,
      handleColor: handleColor || undefined,
      labelTextColor,
      labelBackgroundOpacity,
      fallbackColor,
    }
  }, [
    selectionStroke,
    selectionStrokeWidth,
    draftFill,
    draftStroke,
    handleSize,
    handleColor,
    labelTextColor,
    labelBackgroundOpacity,
    fallbackColor,
  ])

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>react-image-annotator-canvas</h1>
          <p className="subtitle">
            Demonstrating core canvas rendering, pointer-event touch support, theme customizations, dynamic category configurations, and live selection feeds.
          </p>
        </div>
        <div className="header-actions">
          <button
            className={`lock-toggle ${isLocked ? 'locked' : 'unlocked'}`}
            onClick={() => setIsLocked(!isLocked)}
          >
            {isLocked ? '🔒 Lock Active (Read Only)' : '🔓 Unlock Active (Draw/Edit)'}
          </button>
          <button onClick={reset} className="btn-secondary">
            Reset Demo
          </button>
          {dirty && !isLocked && (
            <button className="primary" onClick={() => setDirty(false)}>
              Save State
            </button>
          )}
        </div>
      </header>

      <div className="layout">
        <div className="main-content">
          <div className="hint-banner">
            {isLocked ? (
              <span><strong>🔒 Read-Only Mode:</strong> Click boxes to inspect attributes or check the selection events console. Structural changes are disabled.</span>
            ) : (
              <span><strong>🔓 Interactive Mode:</strong> Drag empty area to draw. Drag body to move, corners to resize. Delete/Backspace key deletes selection, Esc deselects.</span>
            )}
          </div>

          <div className="canvas-container">
            <ImageAnnotator
              imageUrl={DEMO_IMAGE}
              annotations={annotations}
              onChange={handleAnnotationsChange}
              categories={categories}
              activeCategoryId={activeCategoryId}
              drawingEnabled={!isLocked}
              editingEnabled={!isLocked}
              selectionMode={selectionMode}
              showLabels={showLabels}
              integerCoordinates={integerCoordinates}
              snapToEdges={snapToEdges}
              snapThreshold={snapThreshold}
              theme={themeConfig}
              onSelect={handleSelect}
            />
          </div>

          <div className="status-footer">
            <span className="badge">Total Boxes: {annotations.length}</span>
            <span className="badge">Selected: {selectedAnnotations.length}</span>
            {dirty && <span className="badge dirty">Unsaved Changes</span>}
          </div>

          {/* State Viewer */}
          <section className="sidebar-section">
            <h2>📜 State Viewer (Live JSON)</h2>
            <pre className="json-pre" style={{ maxHeight: '300px' }}>
              {JSON.stringify(annotations, null, 2)}
            </pre>
          </section>
        </div>

        <aside className="sidebar">


          {/* Section 2: Library Behavior Configuration */}
          <section className="sidebar-section">
            <h2>⚙️ Interaction Settings</h2>
            
            <div className="form-group">
              <label>Selection Mode (selectionMode)</label>
              <div className="radio-group">
                {(['single', 'multi', 'none'] as SelectionMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`btn-toggle ${selectionMode === mode ? 'active' : ''}`}
                    onClick={() => setSelectionMode(mode)}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Active Drawing Category</label>
              <div className="cat-grid">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    className={`cat-btn ${activeCategoryId === c.id ? 'active' : ''}`}
                    style={{ '--border-color': c.color } as React.CSSProperties}
                    disabled={isLocked}
                    onClick={() => setActiveCategoryId(c.id)}
                  >
                    <span className="swatch" style={{ background: c.color }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                />
                Show Labels Overlay (showLabels)
              </label>
            </div>

            <div className="form-group row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={integerCoordinates}
                  onChange={(e) => setIntegerCoordinates(e.target.checked)}
                />
                Integer Coordinates (integerCoordinates)
              </label>
            </div>

            <div className="form-group row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={snapToEdges}
                  onChange={(e) => setSnapToEdges(e.target.checked)}
                />
                Snap to Edges (snapToEdges)
              </label>
            </div>

            <div className="form-group">
              <label>Snap Threshold: {snapThreshold}px</label>
              <input
                type="range"
                min="1"
                max="50"
                value={snapThreshold}
                disabled={!snapToEdges}
                onChange={(e) => setSnapThreshold(parseInt(e.target.value))}
              />
            </div>

          </section>

          {/* Section 3: Dynamic Category Palette Editor */}
          <section className="sidebar-section">
            <h2>🏷️ Dynamic Category Palette</h2>
            <div className="category-editor-list">
              {categories.map((c) => (
                <div key={c.id} className="category-item-editor">
                  <div className="cat-header-label">
                    <span className="swatch-indicator" style={{ background: c.color }} />
                    <strong>{c.label}</strong>
                  </div>
                  <div className="cat-inputs-row">
                    <div className="cat-input-item">
                      <label>Color</label>
                      <input
                        type="color"
                        value={c.color}
                        onChange={(e) => updateCategory(c.id, { color: e.target.value })}
                      />
                    </div>
                    <div className="cat-input-item">
                      <label>Fill Opacity: {(c.fillOpacity ?? 0.35).toFixed(2)}</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={c.fillOpacity ?? 0.35}
                        onChange={(e) => updateCategory(c.id, { fillOpacity: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Canvas Theme Parameters */}
          <section className="sidebar-section">
            <h2>🎨 Theme Customizer (theme)</h2>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Selection Border</label>
                <input
                  type="color"
                  value={selectionStroke}
                  onChange={(e) => setSelectionStroke(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Fallback Color</label>
                <input
                  type="color"
                  value={fallbackColor}
                  onChange={(e) => setFallbackColor(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Draft Stroke</label>
                <input
                  type="color"
                  value={draftStroke}
                  onChange={(e) => setDraftStroke(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Draft Fill</label>
                <input
                  type="text"
                  placeholder="rgba value..."
                  value={draftFill}
                  onChange={(e) => setDraftFill(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Label Text Color</label>
                <input
                  type="color"
                  value={labelTextColor}
                  onChange={(e) => setLabelTextColor(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Label Opacity: {labelBackgroundOpacity.toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={labelBackgroundOpacity}
                  onChange={(e) => setLabelBackgroundOpacity(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Selection Width: {selectionStrokeWidth}px</label>
              <input
                type="range"
                min="1"
                max="10"
                value={selectionStrokeWidth}
                onChange={(e) => setSelectionStrokeWidth(parseInt(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label>Handle Size: {handleSize}px</label>
              <input
                type="range"
                min="6"
                max="24"
                value={handleSize}
                onChange={(e) => setHandleSize(parseInt(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label>Handle Color override (Hex)</label>
              <input
                type="text"
                placeholder="e.g. #ffffff (blank for default)"
                value={handleColor}
                onChange={(e) => setHandleColor(e.target.value)}
              />
            </div>
          </section>

          {/* Section 5: Selection Inspector */}
          <section className="sidebar-section highlight">
            <h2>📦 Selection Inspector</h2>
            {selectedAnnotations.length > 0 ? (
              <div className="selection-details">
                {selectedAnnotations.length === 1 && mainSelected ? (
                  <>
                    <div className="form-group">
                      <label>Box ID</label>
                      <code className="code-id">{mainSelected.id}</code>
                    </div>

                    <div className="form-group">
                      <label>Coordinates (Image Pixels)</label>
                      <div className="coords-grid">
                        <span>X: <strong>{Math.round(mainSelected.x)}</strong></span>
                        <span>Y: <strong>{Math.round(mainSelected.y)}</strong></span>
                        <span>W: <strong>{Math.round(mainSelected.width)}</strong></span>
                        <span>H: <strong>{Math.round(mainSelected.height)}</strong></span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Custom Label Override (label)</label>
                      <input
                        type="text"
                        placeholder="Overrides category label..."
                        value={mainSelected.label ?? ''}
                        disabled={isLocked}
                        onChange={(e) =>
                          updateSelectedAnnotation({ label: e.target.value || undefined })
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>Custom Data Payload (data)</label>
                      <input
                        type="text"
                        placeholder="Tag details / custom metadata..."
                        value={typeof mainSelected.data === 'string' ? mainSelected.data : ''}
                        disabled={isLocked}
                        onChange={(e) =>
                          updateSelectedAnnotation({ data: e.target.value || undefined })
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="bulk-selection">
                    <p className="bulk-desc">📦 <strong>{selectedAnnotations.length}</strong> annotations selected</p>
                  </div>
                )}

                <div className="form-group">
                  <label>{!isLocked ? 'Reassign Category' : 'Selected Categories'}</label>
                  <div className="cat-grid">
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        className={`cat-btn ${
                          selectedAnnotations.every((a) => a.categoryId === c.id) ? 'active' : ''
                        }`}
                        style={{ '--border-color': c.color } as React.CSSProperties}
                        disabled={isLocked}
                        onClick={() => changeSelectedCategory(c.id)}
                      >
                        <span className="swatch" style={{ background: c.color }} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!isLocked && (
                  <button className="btn-danger w-full mt-sm" onClick={deleteSelected}>
                    🗑️ Delete Selected
                  </button>
                )}
              </div>
            ) : (
              <p className="muted">Select an annotation on the image to inspect, style, or reassign its data payload.</p>
            )}
          </section>

          {/* Live selection event logging feed */}
          <section className="sidebar-section event-logs-section">
            <h2>📡 Live Select Events Feed</h2>
            <div className="logs-feed" style={{ maxHeight: '180px' }}>
              {eventLogs.length > 0 ? (
                eventLogs.map((log, idx) => (
                  <div key={idx} className="log-line">{log}</div>
                ))
              ) : (
                <div className="log-line empty">Select boxes on the canvas to trigger real-time selection logs...</div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
