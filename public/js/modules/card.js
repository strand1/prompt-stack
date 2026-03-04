/**
 * Card Component - Renders prompt cards for the grid
 * Supports both image cards and text-only cards
 */

import { Icons, createIconButton } from '../icons.js';
import { formatRelativeTime, escapeHtml, truncate } from '../utils.js';

/**
 * Create a card DOM element for a prompt
 * @param {object} prompt - Prompt data object
 * @param {Function} onCopy - Callback when copy button clicked
 * @param {Function} onRefactor - Callback when refactor button clicked
 * @param {Function} onCardClick - Callback when card body clicked
 * @param {Function} onEdit - Callback when edit button clicked
 * @param {Function} onDelete - Callback when delete button clicked
 * @returns {HTMLElement} Card element
 */
export function createCard(prompt, onCopy, onRefactor, onCardClick, onEdit, onDelete) {
  const card = document.createElement('article');
  card.className = 'prompt-card';
  card.dataset.id = prompt.id;

  // Determine card type
  const hasImage = prompt.image && typeof prompt.image === 'string' && prompt.image.length > 0;

  if (hasImage) {
    createImageCard(card, prompt, onCopy, onRefactor, onCardClick, onEdit, onDelete);
  } else {
    createTextCard(card, prompt, onCopy, onRefactor, onCardClick, onEdit, onDelete);
  }

  return card;
}

/**
 * Build image card (with large image background, hover overlay optional)
 */
function createImageCard(card, prompt, onCopy, onRefactor, onCardClick, onEdit, onDelete) {
  // Image
  const img = document.createElement('img');
  img.src = `/images/${prompt.image}`;
  img.alt = escapeHtml(prompt.title || 'Prompt image');
  img.className = 'card-image';
  img.loading = 'lazy'; // Native lazy loading
  card.appendChild(img);

  // Optional: subtle overlay gradient for text readability
  const overlay = document.createElement('div');
  overlay.className = 'card-hover-overlay';
  card.appendChild(overlay);

  // Hover overlay showing full prompt text
  const promptOverlay = document.createElement('div');
  promptOverlay.className = 'card-prompt-overlay';
  promptOverlay.textContent = prompt.prompt;
  card.appendChild(promptOverlay);

  // Tags (top-left) - limit to 3 tags, show +N more if needed
  if (prompt.tags && prompt.tags.length > 0) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'card-tags';
    const maxTags = 3;
    const tagsToShow = prompt.tags.slice(0, maxTags);
    const remainingCount = prompt.tags.length - maxTags;
    
    tagsToShow.forEach(tag => {
      const tagEl = document.createElement('span');
      tagEl.className = 'tag';
      tagEl.textContent = escapeHtml(tag);
      tagsContainer.appendChild(tagEl);
    });
    
    if (remainingCount > 0) {
      const moreTag = document.createElement('span');
      moreTag.className = 'tag tag-more';
      moreTag.textContent = `+${remainingCount}`;
      moreTag.title = prompt.tags.slice(maxTags).join(', ');
      tagsContainer.appendChild(moreTag);
    }
    
    card.appendChild(tagsContainer);
  }

  // Action buttons (top-right) - ALWAYS VISIBLE
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const copyBtn = createIconButton('copy', 'Copy prompt', 'action-copy');
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onCopy && onCopy(prompt);
  });

  const refactorBtn = createIconButton('refactor', 'Refactor (duplicate and edit)', 'action-refactor');
  refactorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onRefactor && onRefactor(prompt);
  });

  const editBtn = createIconButton('edit', 'Edit prompt', 'action-edit');
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onEdit && onEdit(prompt);
  });

  const deleteBtn = createIconButton('delete', 'Delete prompt', 'action-delete');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onDelete && onDelete(prompt);
  });

  actions.appendChild(copyBtn);
  actions.appendChild(refactorBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  card.appendChild(actions);

  // Usage bar (always visible at bottom)
  const usageBar = createUsageBar(prompt);
  card.appendChild(usageBar);

  // Card click (opens image viewer)
  card.addEventListener('click', (e) => {
    // Don't trigger if clicking on buttons
    if (e.target.closest('.card-actions')) return;
    onCardClick && onCardClick(prompt);
  });
}

/**
 * Build text-only card (no image, simplified layout)
 */
function createTextCard(card, prompt, onCopy, onRefactor, onCardClick, onEdit, onDelete) {
  card.classList.add('card-no-image');

  // Title
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = prompt.title || truncate(prompt.prompt, 60);
  card.appendChild(title);

  // Prompt text (shortened for card view)
  const promptText = document.createElement('div');
  promptText.className = 'card-prompt-text';
  promptText.textContent = truncate(prompt.prompt, 200);
  card.appendChild(promptText);

  // Spacer to push meta to bottom
  const spacer = document.createElement('div');
  spacer.style.flex = '1 1 auto';
  card.appendChild(spacer);

  // Action buttons (top-right for text cards too)
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  actions.style.position = 'absolute';
  actions.style.top = 'var(--space-sm)';
  actions.style.right = 'var(--space-sm)';

  const copyBtn = createIconButton('copy', 'Copy prompt', 'action-copy');
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onCopy && onCopy(prompt);
  });

  const refactorBtn = createIconButton('refactor', 'Refactor (duplicate and edit)', 'action-refactor');
  refactorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onRefactor && onRefactor(prompt);
  });

  const editBtn = createIconButton('edit', 'Edit prompt', 'action-edit');
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onEdit && onEdit(prompt);
  });

  const deleteBtn = createIconButton('delete', 'Delete prompt', 'action-delete');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onDelete && onDelete(prompt);
  });

  actions.appendChild(copyBtn);
  actions.appendChild(refactorBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  card.appendChild(actions);

  // Tags (below text) - limit to 3 tags, show +N more if needed
  if (prompt.tags && prompt.tags.length > 0) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'card-tags';
    tagsContainer.style.position = 'static'; // Not absolute
    const maxTags = 3;
    const tagsToShow = prompt.tags.slice(0, maxTags);
    const remainingCount = prompt.tags.length - maxTags;
    
    tagsToShow.forEach(tag => {
      const tagEl = document.createElement('span');
      tagEl.className = 'tag';
      tagEl.textContent = escapeHtml(tag);
      tagsContainer.appendChild(tagEl);
    });
    
    if (remainingCount > 0) {
      const moreTag = document.createElement('span');
      moreTag.className = 'tag tag-more';
      moreTag.textContent = `+${remainingCount}`;
      moreTag.title = prompt.tags.slice(maxTags).join(', ');
      tagsContainer.appendChild(moreTag);
    }
    
    card.appendChild(tagsContainer);
  }

  // Usage bar (bottom)
  const usageBar = createUsageBar(prompt);
  card.appendChild(usageBar);

  // Card click (opens simple prompt modal)
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-actions')) return;
    onCardClick && onCardClick(prompt);
  });
}

/**
 * Create the bottom usage bar
 * @param {object} prompt
 * @returns {HTMLElement}
 */
function createUsageBar(prompt) {
  const bar = document.createElement('div');
  bar.className = 'card-usage-bar';

  const usageCount = document.createElement('span');
  usageCount.className = 'card-usage-count';
  usageCount.textContent = `${prompt.usage_count || 0} use${prompt.usage_count !== 1 ? 's' : ''}`;

  const date = document.createElement('span');
  date.className = 'card-date';
  date.textContent = formatRelativeTime(prompt.updated_at || prompt.created_at);

  bar.appendChild(usageCount);
  bar.appendChild(date);

  return bar;
}

/**
 * Update card with new data (for live updates)
 * @param {HTMLElement} card
 * @param {object} prompt
 */
export function updateCardData(card, prompt) {
  // Find and update usage/date
  const usageBar = card.querySelector('.card-usage-bar');
  if (usageBar) {
    const usageCount = usageBar.querySelector('.card-usage-count');
    const dateEl = usageBar.querySelector('.card-date');
    if (usageCount) usageCount.textContent = `${prompt.usage_count || 0} uses`;
    if (dateEl) dateEl.textContent = formatRelativeTime(prompt.updated_at || prompt.created_at);
  }

  // ID must match
  card.dataset.id = prompt.id;
}

export default { createCard, updateCardData };