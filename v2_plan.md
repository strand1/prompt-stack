# Prompt Stack v2 Frontend Redesign Plan

## Current State Assessment

**What we have:**
- Fully functional backend (Express.js + SQLite)
- All core features working: prompts CRUD, tags, search, sort, import/export, cleanup, theme toggle
- Existing frontend uses vanilla JS with custom CSS (no framework)

**What happened in recent changes:**
- Attempted to integrate Masonry.js for Pinterest-style masonry layout
- Added dynamic aspect-ratio detection to preserve image proportions
- Encountered complexity with:
  - Duplicate initialization patterns
  - Grid-sizer element conflicts
  - Width calculation issues causing layout problems
  - Multiple conflicting approaches (CSS columns vs JS Masonry)
  - Syntax errors from incomplete code refactoring

**Decision:** Start fresh with a clean, simpler approach.

---

## Redesign Goals

**Visual Style:** Match PromptHero aesthetic
- Clean, content-first design
- Light mode as default, dark mode as variant
- Masonry/grid layout with variable card heights
- Minimal chrome, focus on images
- Cards with:
  - Image background
  - Hover overlay showing full prompt text
  - Top-left corner: tags (pill shape)
  - Top-right corner: action buttons (copy, edit, refactor, delete) **on hover**
  - Bottom bar: usage count and created date (visible, not on hover)

**Layout:**
- True masonry (Pinterest style) - items pack vertically with no gaps
- Responsive: 4-5 columns on desktop, 3 on tablet, 2 on mobile
- ~2-4px tight gutters between cards
- Cards should be substantial size (not tiny)

**Keep Existing Functionality:**
- All buttons in header: Theme toggle, Random, Export, Import, Cleanup, +New Prompt
- Search bar + filters (sort dropdown, include deleted checkbox, tag cloud)
- Infinite scroll pagination
- All modals (create/edit, random prompt)
- Clipboard copy with visual feedback
- All existing keyboard shortcuts/accessibility

---

## Technical Approach

**Simplest viable solution for masonry:**

### Option A: CSS-only Masonry (Recommended)
Use `column-count` CSS property. This is the simplest:
```css
.prompts-grid {
  column-count: 4;
  column-gap: 4px;
}
.prompt-card {
  break-inside: avoid;
  margin-bottom: 8px;
}
```
**Pros:**
- Zero JavaScript dependencies
- Simple, reliable, works in all modern browsers
- Column-first ordering (like Pinterest) which is actually desirable
- No complex sizing calculations

**Cons:**
- Column-first ordering (top-to-bottom in each column)
- Cannot reorder items (but we don't need to)
- Transition animations more limited

**Note:** Earlier we avoided column-count because user wanted row-first ordering. But Pinterest itself uses column-first! It's the standard for image galleries. We should embrace it.

### Option B: Masonry.js (if we need more control)
- Single initialization point
- Use `.grid-sizer` with CSS width percentage
- Call `masonry.appended()` for infinite scroll
- Keep it simple with proven pattern

---

## Implementation Plan

### Phase 1: Clean Slate
1. Reset CSS to remove all the experimental changes
2. Keep only the good foundation:
   - CSS variables for theming
   - Card base styles (border, radius, padding)
   - Header, controls, modal styles
3. Remove all Masonry/JS layout code from app.js

### Phase 2: Implement Masonry
**Using Option A (CSS columns):**
1. Add `.prompts-grid` withresponsive column-count (4/3/2/1)
2. Ensure `.prompt-card` has `break-inside: avoid`
3. Handle image cards: let them size naturally (no fixed aspect-ratio, let image dictate height via background-size: cover with natural dimensions)
4. Adjust card internals for cleaner look:
   - Title on image (overlay at top)
   - Prompt text on hover overlay with gradient
   - Tags at top with semi-transparent background
   - Usage + date at bottom (visible or hover)
   - Action buttons: only on hover, positioned top-right or bottom-right

**Using Option B (Masonry.js):**
1. Add Masonry via CDN
2. Single `initMasonry()` called after initial load and infinite scroll appends
3. Use `.grid-sizer` with CSS width: 25% (4 columns)
4. On infinite scroll: `masonry.appended(newCards)` and `masonry.layout()`
5. No manual columnWidth calculations

### Phase 3: Responsive Images
- For image cards: Instead of fixed aspect-ratio, let card height be determined by the implicit aspect ratio of the background image
- **Solution:** Use a trick - set `padding-top` based on aspect ratio OR use `<img>` tag instead of background-image
- **Simpler:** Use actual `<img>` element inside card, with `width: 100%`, `height: auto`, and let card height expand naturally. This lets Masonry measure actual height easily.

### Phase 4: Polish
- Refine spacing (gutters, padding)
- Ensure hover states are snappy
- Dark mode adjustments (overlay opacity)
- Add subtle transitions
- Test on various screen sizes

---

## Questions to Resolve

1. **Should action buttons (copy/edit/delete) be always visible on image cards or only on hover?**
   - PromptHero: hidden, appear on hover
   - Suggestion: on hover for cleaner look

2. **Where should usage count + date be displayed?**
   - Option: Always visible at bottom of image (semi-transparent bar)
   - Option: Only on hover
   - Suggestion: Always visible at bottom for quick info

3. **Should card title be visible on images?**
   - Currently: hidden on images, only shown on text cards
   - Suggestion: Show title as overlay at top-left on images (with text shadow for readability)

4. **Image sizing approach?**
   - `<img>` tag: simpler, natural height, good for Masonry
   - `background-image`: harder to get natural height without JS
   - Recommendation: switch to `<img>` for true masonry without JS aspect-ratio detection

---

## Next Steps

1. Get user confirmation on approach (CSS columns vs Masonry.js)
2. Get answers to the 4 questions above
3. Clean slate: backup current code, start fresh CSS/JS
4. Implement layout first (masonry)
5. Add cards with `<img>` approach
6. Polish and test
7. Deploy

---

## Risk Mitigation

- Keep a backup of current working version (git commit or manual copy)
- Implement changes incrementally, test after each phase
- Use feature flags if needed to toggle between layouts during dev
- Console.log extensively to debug Masonry/item sizing
