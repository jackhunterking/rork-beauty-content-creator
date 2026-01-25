# Shape Layer Analysis - Templated.io API

## Template: 3b87af82-cc76-4824-afdd-fbd65efd06d0

### Problem Summary
Background layers with `background-*` prefix are rendering as squares instead of their actual SVG shapes (circles, ellipses, rounded rectangles).

### Root Cause
The `LayeredCanvas.tsx` component checks `layer.border_radius` property for shape styling, but Templated.io stores shape geometry ONLY in the `html` property as SVG, NOT in `border_radius`.

---

## Key Background Layers

### 1. `background-round` (ELLIPSE/CIRCLE)
```json
{
  "layer": "background-round",
  "type": "shape",
  "fill": "#e5e5e5",
  "border_radius": null,  // ← Always null!
  "html": "<svg width=\"124px\" height=\"124px\" viewbox=\"0 0 124 124\">
    <ellipse fill=\"#e5e5e5\" cx=\"62\" cy=\"62\" rx=\"62\" ry=\"62\"></ellipse>
  </svg>"
}
```
**SVG Element Type**: `<ellipse>` (perfect circle where rx=ry=62)

### 2. `background-after-label` (ROUNDED RECT)
```json
{
  "layer": "background-after-label",
  "type": "shape",
  "fill": "rgb(228, 226, 221)",
  "border_radius": null,
  "html": "<svg width=\"462px\" height=\"125px\" viewbox=\"0 0 462 125\">
    <rect fill=\"...\" rx=\"51\" ry=\"51\" width=\"459\" height=\"122\"></rect>
  </svg>"
}
```
**SVG Element Type**: `<rect>` with `rx="51"` `ry="51"` (rounded corners)

### 3. `background-before-label` (ROUNDED RECT)
Same as above - rounded rectangle with rx/ry attributes.

---

## Solution

For `background-*` layers, the rendering code must:

1. **Detect SVG element type** from `layer.html`:
   - `<ellipse>` → Render as SVG Ellipse
   - `<circle>` → Render as SVG Circle  
   - `<rect>` with `rx/ry` → Extract border radius from SVG, render as View with borderRadius
   - `<rect>` without `rx/ry` → Plain rectangle (current behavior)

2. **Extract attributes from SVG HTML**:
   - For ellipse: `cx`, `cy`, `rx`, `ry`
   - For rect: `rx`, `ry` (border radius)
   - For both: `fill`, `stroke`, `stroke-width`

3. **Apply user's background color** while preserving the shape geometry

---

## API Response Summary

| Layer | Element Type | Has rx/ry? | border_radius | Current Render | Should Render |
|-------|--------------|------------|---------------|----------------|---------------|
| background-round | `<ellipse>` | rx=62, ry=62 | null | Square View | SVG Ellipse |
| background-after-label | `<rect>` | rx=51, ry=51 | null | Square View | Rounded View (r=51) |
| background-before-label | `<rect>` | rx=51, ry=51 | null | Square View | Rounded View (r=51) |
