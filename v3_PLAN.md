# Prompt Stack v3 - Design Spec

## Card Anatomy (Image Cards)

```
┌─────────────────────────────┐
│  [Tags]        [Actions]     │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │     IMAGE (variable   │  │
│  │     height based on   │  │
│  │     aspect ratio)     │  │
│  │                       │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ✓ 12 uses  • 2 days    │  │
│  └───────────────────────┘  │
│  [Hover: overlay with full │
│   prompt text at bottom]   │
└─────────────────────────────┘
```

### States:

1. **Default:**
   - Image visible (object-fit: cover to fill card width)
   - Tags at top-left (semi-transparent pill, white text)
   - Usage bar at bottom (semi-transparent bar, white text): "12 uses • 2 days ago"
   - Action buttons **always visible** at top-right: 📋 Copy, ↩️ Refactor, ✏️ Edit, 🗑️ Delete
   - No title overlay on images (clean visual)

2. **Hover:**
   - Optional: subtle dark overlay gradient
   - Full prompt text appears in overlay if space permits (otherwise keep minimal)
   - Or: no overlay change, just visual feedback (lift/shadow)

### Text Cards (no image):
- White background card
- Title at top (bold)
- Prompt text below (monospace/monospaced)
- Tags at bottom
- Same action buttons visible (no hover needed)
- Usage/date metadata

---

## Layout Behavior

- **Masonry:** Vertical packing via CSS columns (no JS calculation)
- **Column ordering:** Column-first (top-to-bottom per column) - acceptable, matches Pinterest
- **Gutters:** 16px between columns, cards margin-bottom: 16px
- **Responsive breakpoints:**
  - ≥1201px: 4 columns
  - 901-1200px: 3 columns
  - 601-900px: 2 columns
  - ≤600px: 1 column

### Image Sizing Strategy:

**Option A: `object-fit: cover` with fixed aspect ratio (16:9ish)**
- Pros: Uniform card heights, neat grid
- Cons: Crops images, loses full image context

**Option B: Variable height based on aspect ratio**
- Pros: Shows full images, better for portrait/landscape variety
- Cons: Card heights vary widely, potential for very tall cards

**Option C: Hybrid**
- Use `<img>` with `width: 100%, height: auto`
- CSS columns will naturally pack based on actual height
- Set `min-height: 200px` for consistency
- This v2 tried but had sizing issues

**Approach:** Support **multiple aspect ratios** (16:9, 2:3, 1:1, 3:2, 9:16).
- Use `<img>` tag with `width: 100%, height: auto`
- Images maintain their natural aspect ratio
- Cards naturally size to image height in CSS columns
- Set `min-height: 150px` for very short images
- This creates beautiful organic masonry layout with genuine variety
- Ensure `object-fit: contain` is not used - let images display at their natural ratio

---

## Interactive Features

### Card Click Behavior (Context-Sensitive Modals)

**Cards WITH images:**
- Click anywhere on card → opens **Image Viewer Modal** (full-screen, focused on image)
- Image displayed large (max-width/max-height constrained, centered)
- Edit panel on right/bottom for quick prompt edits
- Quick actions: copy, refactor, delete directly from this modal
- Barebones UI - image is the hero

**Cards WITHOUT images:**
- Click card → opens **Basic Prompt Modal** (smaller, centered)
- Shows title, prompt textarea, tags, image upload option
- Standard create/edit interface
- No large image to display, simpler layout

**Rationale:** Image cards should feel like viewing a gallery piece. Text cards feel like editing a prompt. Different contexts deserve different modals.

### Infinite Scroll:
- IntersectionObserver on sentinel element
- Load 30 items per batch
- Debounce to prevent rapid requests (min 500ms between loads)
- Show loading spinner at bottom during fetch

### Search:
- Debounced input (300ms delay)
- Real-time filter: as you type, grid updates
- Maintains current pagination or resets to page 1 on new search
- Clear button resets to all prompts

### Tag Cloud:
- Show all tags with usage count badge: `TagName (12)`
- Active tag highlighted (accent color)
- Click to toggle filter (multi-select possible)
- Click again to remove filter

### Random Shuffle:
- Button in header: 🎲 Random
- Fetches one random prompt (respects current filters)
- Shows in modal with prompt text, tags, image if available
- Copy button to copy prompt

### Keyboard Shortcuts:
- `Ctrl/Cmd + N` → Open create modal
- `/` → Focus search input
- `Esc` → Close active modal / clear search if no modal

---

## Color Palette

### Light Mode:
- Background: `#f5f5f5` (off-white, comfortable)
- Card bg: `#ffffff`
- Text primary: `#1a1a1a`
- Text secondary: `#666666`
- Accent: `#3b82f6` (vibrant blue)
- Overlay: `rgba(0, 0, 0, 0.6)`

### Dark Mode:
- Background: `#0f0f0f` (true black, OLED-friendly)
- Card bg: `#1a1a1a`
- Text primary: `#f0f0f0`
- Text secondary: `#b0b0b0`
- Overlay: `rgba(0, 0, 0, 0.7)`

Auto-detects system preference on first visit, persists to localStorage.

---

## Mobile Considerations

- Header actions collapse into menu (or horizontal scroll)
- Modal takes full width, 90% height
- Images in cards: maintain 16:9 ratio, height auto
- Touch-friendly button targets: 44x44px minimum
- Reduced animations for `prefers-reduced-motion`

---

## Performance Optimizations

1. **Virtual scrolling?** Not needed - 1000s of prompts still fine with CSS columns
2. **Image lazy loading:** Use native `loading="lazy"` on `<img>` tags
3. **Card memoization:** Re-render only when data changes (state subscription)
4. **Debounced events:** Search input, infinite scroll trigger
5. **CSS containment:** `content-visibility: auto` for off-screen cards (experimental)
6. **Image optimization:** Serve thumbnails (backend could generate, but out of scope for v3)

---

## Accessibility

- All interactive elements: proper ARIA labels
- Keyboard navigation: Tab order logical, focus visible
- Color contrast: AA compliant (check with tools)
- Semantic HTML: `<article>` for cards, `<button>` for actions
- Screen reader announcements for dynamic content (toasts)
- Esc key closes modals
- Search input has clear label

---

## Browser Support

- Modern browsers: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- ES6+ JavaScript (target ES2017)
- CSS Grid, Flexbox, Custom Properties
- IntersectionObserver API
- Clipboard API (with fallback for older browsers)

Not supporting IE11.

---

## Development Workflow

1. **Setup:** Copy existing `server/` unchanged
2. **New frontend:** Build from scratch in `public/v3/` or replace gradually
3. **Testing:** Use existing API with curl, test each endpoint
4. **Migration:** Keep v2 as backup, switch when v3 ready
5. **Deploy:** Same static file serving, just replace HTML/CSS/JS

---

## Implementation Phases

### Phase 1: Setup & API Client (Day 1)
- Create modular JS structure
- Build API client with fetch wrapper
- Implement state store
- Wire up basic HTML structure

### Phase 2: Core Grid (Day 1-2)
- CSS column masonry implementation
- Card component (image + text variants)
- Infinite scroll with IntersectionObserver
- Basic search integration

### Phase 3: Interactivity (Day 2-3)
- Modal system (create/edit, image viewer)
- Action buttons (copy, edit, delete, refactor)
- Tag cloud with filtering
- Image upload + preview

### Phase 4: Polish (Day 3-4)
- Theme toggle with persistence
- Hover animations & transitions
- Loading states, error handling
- Toast notifications
- Keyboard shortcuts

### Phase 5: ComfyUI & Advanced (Day 4-5)
- Image generation integration
- Refactor mode implementation
- Random shuffle modal
- Bulk operations
- Final testing & bug fixes

---

## Success Metrics

- ✅ No console errors on load
- ✅ Masonry layout with 4/3/2/1 responsive columns
- ✅ Cards size properly (no overlapping, no gaps)
- ✅ All CRUD operations work
- ✅ Infinite scroll seamless
- ✅ Search debounced, fast response
- ✅ Dark mode persists
- ✅ Mobile responsive
- ✅ Code modular, each file <300 LOC
- ✅ Linting passes (ESLint optional)

---

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| CSS columns gaps | Test extensively, adjust margins/column-gap |
| Image height inconsistency | Enforce aspect ratio or use uniform crops |
| Infinite scroll glitches | Proper sentinel positioning, debounce |
| State management bugs | Use subscription pattern, immutable updates |
| Mobile touch issues | Test on real devices, ensure touch targets |
| Migration complexity | Keep v2 intact, deploy v3 as parallel, swap gradually |

---

## Questions for You

1. **Image aspect ratio**: Should we crop to uniform (e.g., 16:9) or show full natural aspect ratio?
2. **Action buttons**: On image cards, should they appear on hover (cleaner) or always visible?
3. **Card titles**: Show title overlay on image cards, or only in text cards?
4. **Usage/date bar**: Always visible at bottom, or only on hover?
5. **Column count at 1200px**: Keep 4 columns at exactly 1200px, or 4 only above 1200?
6. **Random button**: Current location in header? Any other placement ideas?

Please share your preferences on these!
