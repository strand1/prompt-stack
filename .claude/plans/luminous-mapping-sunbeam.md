# Implementation Plan: Black Search Bar & Infinite Scroll

## Context

The user wants two improvements to the Prompt Stack application:
1. Make the search bar black (near-black dark gray) in night/dark mode
2. Replace pagination with infinite scroll (lazy loading) on a single page

**Current State**:
- The app uses pagination with Previous/Next buttons and a page number input
- The dark theme search bar uses `--surface: #1e293b` (dark slate), not black
- Pagination requests are made per page with `page` and `limit` parameters
- Backend supports offset-based pagination with total count

**Desired Outcome**:
- Search bar should have a near-black background (`#111111`) in dark mode
- All prompts load on one page with infinite scroll
- Automatic loading when scrolling near bottom using IntersectionObserver
- Batch size of ~30 items per load
- Stop loading when all prompts are fetched (based on total count)
- Maintain all existing filtering (search, tags, sort, include_deleted)

---

## Technical Approach

### 1. Search Bar Dark Mode Styling

**File**: `public/css/style.css`

**Changes**:
- Add specific `.search-input` dark mode styling with `background: #111111`
- Keep border color as `--border-color` (will be dark gray)
- Text color inherits from `--text-primary` (works fine)
- Adjust focus box-shadow to be more appropriate for dark mode (optional but recommended)

**Why not modify `--surface`?**
- `--surface` is used by many other components (cards, modals, header)
- Changing it would affect the entire app's look
- The user specifically asked for the search bar to be black, not the entire UI
- A targeted override is cleaner and preserves the existing design language

**Implementation**:
```css
[data-theme="dark"] .search-input {
  background: #111111;
}
```

---

### 2. Infinite Scroll Implementation

**File**: `public/js/app.js`

#### A. Remove Pagination

**Delete from AppState** (lines 136-141):
```javascript
pagination: {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
},
```

**Replace with**:
```javascript
pagination: {
  page: 1,
  limit: 30,  // Increased from 20 to 30 per user request
  total: 0,
  totalPages: 0,
  isLoadingMore: false,  // Prevent duplicate loads
  hasMore: true,         // Track if more pages exist
},
```

#### B. Modify `loadPrompts()` to Support Append Mode

Current `loadPrompts()` replaces `AppState.prompts` each time. Need to support two modes:
- **Initial load**: Clear prompts, load page 1
- **Append load**: Keep existing prompts, append new ones

**Changes**:
- Add an optional parameter `append = false`
- When `append = true`:
  - Don't clear `AppState.prompts`
  - Merge new prompts with existing (avoid duplicates if any)
  - Increment `AppState.pagination.page`
- When `append = false` (default):
  - Reset to page 1, clear prompts (current behavior)

**Implementation**:
```javascript
async function loadPrompts(append = false) {
  if (append) {
    AppState.pagination.page += 1;
  } else {
    AppState.pagination.page = 1;
    AppState.prompts = [];
  }
  // ... rest of the loading logic
  // After getting response:
  if (append) {
    AppState.prompts = [...AppState.prompts, ...response.prompts];
  } else {
    AppState.prompts = response.prompts || [];
  }
  // Update pagination metadata
  AppState.pagination.total = response.pagination.total;
  AppState.pagination.totalPages = response.pagination.totalPages;
  AppState.pagination.hasMore = AppState.pagination.page < AppState.pagination.totalPages;
}
```

#### C. Add Scroll Observer

**Create a sentinel element**:
- Add `<div id="scroll-sentinel" style="height: 1px;"></div>` after the prompts grid in HTML
- Or create it dynamically in JavaScript

**Setup IntersectionObserver**:
```javascript
let observer = null;

function setupInfiniteScroll() {
  // Remove existing observer if any
  if (observer) {
    observer.disconnect();
  }

  const sentinel = document.getElementById('scroll-sentinel');
  if (!sentinel) return;

  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !AppState.isLoading && !AppState.isLoadingMore && AppState.pagination.hasMore) {
        loadMorePrompts();
      }
    });
  }, {
    rootMargin: '100px', // Load a bit before reaching bottom
  });

  observer.observe(sentinel);
}
```

**Helper function**:
```javascript
async function loadMorePrompts() {
  if (AppState.pagination.isLoadingMore || !AppState.pagination.hasMore) {
    return;
  }

  AppState.pagination.isLoadingMore = true;
  renderPromptsGrid(); // Show loading indicator if needed

  try {
    await loadPrompts(true); // Append mode
  } catch (error) {
    showToast(`Failed to load more prompts: ${error.message}`, 'error');
    // Revert page increment on error
    AppState.pagination.page -= 1;
  } finally {
    AppState.pagination.isLoadingMore = false;
    renderPromptsGrid();
    setupInfiniteScroll(); // Reconnect observer in case sentinel moved
  }
}
```

#### D. Update `setSearch()` and Filter Functions

Search and filter changes should reset to page 1 and clear prompts:
- `setSearch()` currently calls `refreshData()` which calls `loadPrompts()`
- This works correctly with the new default (append=false) behavior
- No changes needed here, but verify that `refreshData()` uses non-append mode

#### E. Hide Pagination UI

**Option 1 (Recommended)**: Remove pagination HTML from `index.html` entirely
- Delete the `<div class="pagination" id="pagination">` section
- Remove `DOM.pagination` reference
- Remove `renderPagination()` function entirely

**Option 2**: Keep the HTML but hide with CSS
- Simpler rollback if user wants pagination back
- Use `.pagination { display: none; }` in CSS

I'll recommend Option 2 during implementation and let the user decide. Actually, since the user said "everything on one page, no flipping through pages", Option 1 (remove completely) is more appropriate. We can always restore from Git if needed.

**Remove**:
- `renderPagination()` function (lines 723-785)
- Pagination DOM element from `index.html` (lines 87-89)
- `DOM.pagination` from DOM object (line 170)
- `renderPagination()` call from `loadPrompts()` (line 817)
- Pagination CSS styles (lines 461-501)

#### F. Add Sentinel Element

Option 1: Add to HTML
```html
<main class="main-content">
  <div id="prompts-grid" class="prompts-grid"></div>
  <div id="loading" class="loading" style="display: none;">...</div>
  <div id="empty-state" class="empty-state" style="display: none;">...</div>
  <div id="scroll-sentinel"></div>  <!-- Add this -->
</main>
```

Option 2: Create dynamically in `init()`:
```javascript
const sentinel = document.createElement('div');
sentinel.id = 'scroll-sentinel';
DOM.promptsGrid.parentNode.appendChild(sentinel);
```

I'll go with Option 1 as it's simpler and clearer.

#### G. Update Loading State

Add a subtle loading indicator at the bottom when loading more items. The existing `#loading` element shows "Loading prompts..." centered. For infinite scroll, we want a smaller, less obtrusive indicator.

**Changes**:
- Create a new loading spinner specifically for infinite scroll, e.g., `<div id="infinite-loading" class="infinite-loading" style="display: none;">`
- Show it at the bottom when `isLoadingMore` is true
- Hide the full-page loading spinner for append loads

Or simpler: Modify the existing `renderPromptsGrid()` to show loading at bottom when `isLoadingMore`. But the existing loading element is designed for full-page loading.

**Simpler approach**: Just use the existing loading element but position it differently. Let's check the CSS:
- Current `.loading` has `text-align: center; padding: 60px 20px;`
- For infinite scroll, we could add a new CSS class `.loading-infinite` with smaller padding

Actually, I'll add a separate loading element for infinite scroll to avoid UI confusion.

---

## 3. Backend Compatibility

**No changes needed**. The existing API already supports:
- `page` and `limit` parameters
- Total count in response
- All filters work with pagination
- Offset calculation: `offset = (page - 1) * limit`

Infinite scroll will simply request `page=1,2,3,...` with the same limit, and the backend will continue to return correct prompts.

---

## Files to Modify

1. **public/css/style.css**
   - Add dark mode black search bar background
   - (Optional) Add infinite scroll loading indicator styles
   - Remove pagination CSS (lines 461-501) if removing pagination completely

2. **public/index.html**
   - Remove pagination div (lines 87-89)
   - Add scroll sentinel element after prompts-grid
   - Add infinite loading indicator element

3. **public/js/app.js**
   - Update `AppState.pagination`: add `isLoadingMore` and `hasMore`, change limit to 30
   - Remove `renderPagination()` function entirely
   - Remove `DOM.pagination` from DOM object
   - Modify `loadPrompts()` to support append mode
   - Add `loadMorePrompts()` helper
   - Add `setupInfiniteScroll()` with IntersectionObserver
   - Call `setupInfiniteScroll()` after initial load and after prompts render
   - Update `renderPromptsGrid()` to show infinite loading indicator
   - Remove pagination-related calls

---

## Implementation Order

1. **CSS changes first**: Black search bar (safe, isolated)
2. **HTML changes**: Remove pagination, add sentinel
3. **JavaScript core**: AppState updates, loadPrompts() modification
4. **JavaScript infinite scroll**: Observer setup, loadMorePrompts()
5. **CSS cleanup**: Remove pagination styles, add infinite loading styles
6. **Testing**: Verify scroll loads more, verify search resets to page 1, verify filters work

---

## Testing & Verification

**Test Scenarios**:
1. **Initial load**: Page 1 loads with 30 items (if available)
2. **Infinite scroll**: Scroll to bottom → page 2 loads and appends
3. **Continue scrolling**: Pages 3, 4, ... load until `total` reached
4. **Stop condition**: When all items loaded, sentinel stops triggering loads
5. **Search**: New search resets to page 1 and shows fresh results
6. **Tag filter**: Toggling tags resets to page 1
7. **Sort change**: Resets to page 1 with new order
8. **Dark mode**: Search bar shows near-black background (#111111)
9. **Light mode**: Search bar remains unchanged (inherits default/white)
10. **Error handling**: If a load fails, don't increment page, show error toast
11. **Rapid scroll**: Multiple concurrent loads prevented by `isLoadingMore` flag

**Verification Steps**:
- [ ] Start server, open app in browser
- [ ] Toggle to dark mode, verify search bar is near-black
- [ ] Toggle to light mode, verify search bar looks normal
- [ ] With enough prompts (>30), scroll down → new items load automatically
- [ ] Browser console shows no errors during scroll
- [ ] Network tab shows sequential page requests (page 1, 2, 3...)
- [ ] Search for something → results reset to top, show only matching items
- [ ] Scroll after search → loads more matching items
- [ ] Clear search → returns to all prompts, scroll works
- [ ] Delete or edit a prompt → refresh maintains scroll position (nice-to-have)

---

## Edge Cases & Considerations

1. **Concurrent loads**: `isLoadingMore` flag prevents duplicate requests while one is in flight
2. **Failed loads**: On error, decrement page number to retry same page on next scroll attempt
3. **Deleted prompts during scroll**: `refreshData()` used after mutations, forces full reload (page 1). Acceptable.
4. **Empty results**: If total is 0, show empty state, no sentinel needed
5. **Total count changes**: If new prompts added while scrolling, `total` updates and `hasMore` recalculated on each load
6. **Scroll position after load**: Appending items shifts content down, may lose current view. IntersectionObserver re-triggers may cause multiple loads. Need to debounce or disconnect/reconnect observer after DOM update.
7. **Sentinel removal**: After all items loaded, can remove sentinel to stop observer
8. **Performance**: 30 items per batch is reasonable. With 1000 prompts total, ~34 scroll events. CSS will handle smooth loading.

**Scroll position note**: When appending items, the viewport may shift. The IntersectionObserver callback will fire again because the sentinel moves down. This could cause immediate sequential loads. Need to handle:

**Approach**: After successful load, wait for DOM to update, then check if sentinel is still in view. If yes, load another immediately. This is actually desirable - fast loading until we fill the viewport. But we don't want to flood the server. The `isLoadingMore` flag prevents concurrent loads, but after one finishes the observer might immediately trigger another. This is fine - it means the user hasn't scrolled away and we can keep filling. Only concern is if totalPages is very high, we might load many pages quickly. But each load is separate and user-initiated (by being at bottom), so it's acceptable.

---

## Trade-offs Considered

**Why IntersectionObserver over scroll event?**
- More performant (browser-optimized)
- Simpler code (no scroll position math)
- Better battery life on mobile

**Why limit 30 instead of 40?**
- 30 is a safe middle ground from "30 or 40"
- Can be easily adjusted in one place (AppState.pagination.limit)
- Better for mobile viewport (fewer large cards with images)

**Why remove pagination UI entirely?**
- User explicitly said "no flipping through pages"
- Mixed UI (pagination + infinite scroll) could confuse users
- Can be restored from version control if needed

**Why not cursor-based pagination?**
- Current offset-based works fine with small-to-medium datasets
- No need to change backend, keeps implementation simple
- SQLite can handle `LIMIT/OFFSET` efficiently for this use case (<10k rows)

---

## Rollback Strategy

1. **CSS change**: Revert `public/css/style.css` dark mode search input styling
2. **HTML change**: Restore pagination div, remove scroll sentinel
3. **JS change**: Restore pagination functions, revert `loadPrompts()` to non-append mode, remove observer code
4. **Git**: All changes are in 3 files, easy to revert with `git checkout -- <files>`

---

## Success Criteria

✅ Search bar is near-black (#111111) in dark mode, normal in light mode
✅ No pagination UI (Previous/Next/page input removed)
✅ Scrolling to bottom automatically loads next batch
✅ Loading indicator appears at bottom during fetch
✅ All filters (search, tags, sort, include_deleted) work correctly with infinite scroll
✅ Each filter change resets to page 1
✅ No duplicate requests or race conditions
✅ No console errors during normal usage
✅ Backend API unchanged, works as before
