/**
 * Prompt Stack v3 - Main Entry Point
 * Wires together all modules and handles application lifecycle
 */

import { store, selectors } from './modules/store.js';
import { api } from './modules/api.js';
import { Grid } from './modules/grid.js';
import { TagCloud } from './modules/tags.js';
import { Search } from './modules/search.js';
import { ModalManager } from './modules/modal-manager.js';
import { copyToClipboard, showToast, generateUUID } from './utils.js';

// ======================
// DOM Elements
// ======================
const elements = {
  grid: document.getElementById('prompts-grid'),
  tagsCloud: document.getElementById('tags-cloud'),
  searchInput: document.getElementById('search-input'),
  searchClear: document.getElementById('btn-search-clear'),
  sortSelect: document.getElementById('sort-select'),
  includeDeleted: document.getElementById('include-deleted'),
  scrollSentinel: document.getElementById('scroll-sentinel'),
  loadingInitial: document.getElementById('loading-initial'),
  loadingMore: document.getElementById('loading-more'),
  emptyState: document.getElementById('empty-state'),
  // Header buttons
  themeToggle: document.getElementById('btn-theme-toggle'),
  randomBtn: document.getElementById('btn-random'),
  exportBtn: document.getElementById('btn-export'),
  importBtn: document.getElementById('btn-import'),
  cleanupBtn: document.getElementById('btn-cleanup'),
  createBtn: document.getElementById('btn-create'),
  // Modals
  promptModal: document.getElementById('prompt-modal'),
  imageViewerModal: document.getElementById('image-viewer-modal'),
  randomModal: document.getElementById('random-modal'),
  // Random modal elements
  randomResult: document.getElementById('random-result'),
  randomLoading: document.getElementById('random-loading'),
  randomTitle: document.getElementById('random-title'),
  randomPrompt: document.getElementById('random-prompt'),
  randomImage: document.getElementById('random-image'),
  randomTags: document.getElementById('random-tags'),
  randomCopyBtn: document.getElementById('btn-random-copy'),
  randomRefactorBtn: document.getElementById('btn-random-refactor'),
};

// ======================
// Module Instances
// ======================
let grid;
let tagCloud;
let search;
let modalManager;

// ======================
// Initialization
// ======================
function init() {
  // Initialize theme
  initTheme();

  // Initialize modules
  grid = new Grid(elements.grid, {
    onLoadMore: loadMorePrompts,
    onCardClick: openCardModal,
    onCopy: copyPrompt,
    onRefactor: refactorPrompt,
    onEdit: editPrompt,
    onDelete: deletePrompt,
  });

  search = new Search(elements.searchInput, elements.searchClear, {
    onSearch: handleSearch,
  });

  tagCloud = new TagCloud(elements.tagsCloud, {
    onTagToggle: toggleTagFilter,
  });

  modalManager = new ModalManager();

  // Setup event listeners
  setupEventListeners();

  // Load initial data
  loadInitialPrompts();
  loadTags();

  // Subscribe to store updates
  store.subscribe(handleStoreUpdate);
}

// ======================
// Theme Management
// ======================
function initTheme() {
  const savedTheme = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(savedTheme);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  elements.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

// ======================
// Data Loading
// ======================
let isLoading = false;
let currentPage = 1;

async function loadInitialPrompts() {
  console.log('[loadInitialPrompts] start');
  isLoading = true;
  elements.loadingInitial.hidden = false;
  elements.loadingMore.hidden = true;
  elements.emptyState.hidden = true;

  try {
    const data = await fetchPrompts(1);
    console.log('[loadInitialPrompts] loaded', data.prompts.length, 'prompts, totalPages:', data.totalPages);
    grid.setCards(data.prompts);
    currentPage = 1;

    if (data.prompts.length === 0) {
      elements.emptyState.hidden = false;
    } else {
      elements.emptyState.hidden = true;
    }
  } catch (error) {
    console.error('[loadInitialPrompts] error:', error);
    showToast(error.message || 'Failed to load prompts', 'error');
    elements.emptyState.hidden = false;
  } finally {
    isLoading = false;
    elements.loadingInitial.hidden = true;
    console.log('[loadInitialPrompts] end');
  }
}

async function loadMorePrompts() {
  console.log('[loadMorePrompts] called, currentPage:', currentPage);
  if (isLoading) {
    console.log('[loadMorePrompts] already loading, skipping');
    return;
  }

  const state = store.getState();
  if (!state.pagination.hasMore) {
    console.log('[loadMorePrompts] hasMore is false, skipping');
    return;
  }

  isLoading = true;
  grid.setLoading(true);

  try {
    const nextPage = currentPage + 1;
    console.log('[loadMorePrompts] fetching page', nextPage);
    const { prompts, hasMore } = await fetchPrompts(nextPage);

    console.log('[loadMorePrompts] got', prompts.length, 'prompts, hasMore:', hasMore);

    if (prompts.length > 0) {
      grid.appendCards(prompts);
      currentPage = nextPage;
      console.log('[loadMorePrompts] updated currentPage to', currentPage);
    } else {
      console.log('[loadMorePrompts] no prompts returned, stopping');
      store.setField('pagination.hasMore', false);
      grid.observer?.disconnect();
      return;
    }

    if (!hasMore) {
      console.log('[loadMorePrompts] hasMore false, disconnecting observer');
      store.setField('pagination.hasMore', false);
      grid.observer?.disconnect();
    }
  } catch (error) {
    console.error('[loadMorePrompts] failed:', error);
  } finally {
    isLoading = false;
    grid.setLoading(false);
    console.log('[loadMorePrompts] finished');
  }
}

async function fetchPrompts(page) {
  const state = store.getState();
  const params = {
    page,
    limit: state.pagination.limit,
    search: state.filters.search || undefined,
    tags: state.filters.selectedTags.size > 0
      ? Array.from(state.filters.selectedTags).join(',')
      : undefined,
    sort: state.filters.sort,
    include_deleted: state.filters.includeDeleted || undefined,
  };

  console.log('[fetchPrompts] page:', page, 'params:', params);

  const response = await api.getPrompts(params);
  console.log('[fetchPrompts] response:', response);

  // API returns {prompts, pagination: {page, limit, total, totalPages}}
  const { prompts = [], pagination = {} } = response;

  // Defensive: extract pagination fields with fallbacks
  const respPage = pagination.page ?? page;
  const total = pagination.total ?? 0;
  let totalPages = pagination.totalPages;

  // Compute totalPages if missing or invalid
  if (totalPages === undefined || totalPages === null || isNaN(totalPages)) {
    totalPages = Math.ceil(total / (state.pagination.limit || 30));
  }

  // Determine hasMore: prefer pagination.page < totalPages, fallback to length check
  let hasMore = respPage < totalPages;
  if (hasMore === false && prompts.length === state.pagination.limit) {
    // If server said no more but we got a full page, assume there might be more
    hasMore = true;
  }

  console.log('[fetchPrompts] pagination:', { page: respPage, total, totalPages, hasMore });

  // Update store
  store.batchUpdate({
    'pagination.page': respPage,
    'pagination.total': total,
    'pagination.totalPages': totalPages,
    'pagination.hasMore': hasMore,
    'pagination.isLoading': false,
  });

  return { prompts, hasMore };
}

async function loadTags() {
  try {
    const data = await api.getTags();
    store.setState({ tags: data.tags || [] });
  } catch (error) {
    console.error('Failed to load tags:', error);
  }
}

// ======================
// Event Handlers
// ======================
function handleStoreUpdate(state) {
  // Update sort select if changed externally
  if (state.filters.sort !== elements.sortSelect.value) {
    elements.sortSelect.value = state.filters.sort;
  }

  // Update include deleted checkbox
  if (state.filters.includeDeleted !== elements.includeDeleted.checked) {
    elements.includeDeleted.checked = state.filters.includeDeleted;
  }
}

function handleSearch(query) {
  // Reset pagination and reload
  currentPage = 1;
  grid.clear();
  loadInitialPrompts();
}

function toggleTagFilter(tagName) {
  const state = store.getState();
  const selectedTags = new Set(state.filters.selectedTags);

  if (selectedTags.has(tagName)) {
    selectedTags.delete(tagName);
  } else {
    selectedTags.add(tagName);
  }

  // Update only the changed fields to preserve other filters
  store.setField('filters.selectedTags', selectedTags);
  store.setField('pagination.page', 1);
  store.setField('pagination.hasMore', true);

  // Reload prompts
  grid.clear();
  currentPage = 1;
  loadInitialPrompts();
}

function handleSortChange(e) {
  store.setField('filters.sort', e.target.value);
  grid.clear();
  currentPage = 1;
  loadInitialPrompts();
}

function handleIncludeDeletedChange(e) {
  store.setField('filters.includeDeleted', e.target.checked);
  grid.clear();
  currentPage = 1;
  loadInitialPrompts();
}

async function copyPrompt(prompt) {
  try {
    await copyToClipboard(prompt.prompt);
    showToast('Prompt copied to clipboard', 'success');

    // Increment usage
    try {
      await api.incrementUsage(prompt.id);
      // Update card usage count
      grid.updateCard(prompt.id, { ...prompt, usage_count: (prompt.usage_count || 0) + 1 });
    } catch (e) {
      // Non-critical
    }
  } catch (error) {
    showToast('Failed to copy', 'error');
  }
}

function refactorPrompt(prompt) {
  modalManager.openPromptModal(null, {
    title: prompt.title || '',
    prompt: prompt.prompt,
    tags: prompt.tags || [],
    image: prompt.image || null,
  });
}

function openCardModal(prompt) {
  if (prompt.image && typeof prompt.image === 'string' && prompt.image.length > 0) {
    modalManager.openImageViewer(prompt);
  } else {
    modalManager.openPromptModal(prompt.id);
  }
}

function editPrompt(prompt) {
  // Same as clicking the card - open appropriate modal for editing
  openCardModal(prompt);
}

async function deletePrompt(prompt) {
  // Use modal manager's delete handler which shows confirmation
  await modalManager.handleDelete(prompt.id);
}

async function handleRandom() {
  elements.randomResult.hidden = true;
  elements.randomLoading.hidden = false;

  try {
    const state = store.getState();
    const params = {
      search: state.filters.search || undefined,
      tags: state.filters.selectedTags.size > 0
        ? Array.from(state.filters.selectedTags).join(',')
        : undefined,
    };

    const prompt = await api.getRandomPrompt(params);

    // Populate random modal
    elements.randomTitle.textContent = prompt.title || 'Untitled';
    elements.randomPrompt.textContent = prompt.prompt;

    // Tags
    elements.randomTags.innerHTML = '';
    if (prompt.tags && prompt.tags.length > 0) {
      prompt.tags.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.textContent = escapeHtml(tag);
        elements.randomTags.appendChild(tagEl);
      });
    }

    // Image
    if (prompt.image) {
      elements.randomImage.hidden = false;
      elements.randomImage.querySelector('img').src = `/images/${prompt.image}`;
    } else {
      elements.randomImage.hidden = true;
    }

    // Store current random prompt ID for actions
    elements.randomModal.dataset.promptId = prompt.id;

    elements.randomLoading.hidden = true;
    elements.randomResult.hidden = false;

    // Show modal
    elements.randomModal.hidden = false;
    elements.randomModal.classList.add('is-visible');

  } catch (error) {
    showToast(error.message || 'Failed to fetch random prompt', 'error');
    elements.randomLoading.hidden = true;
  }
}

function randomCopy() {
  const promptId = elements.randomModal.dataset.promptId;
  const promptText = elements.randomPrompt.textContent;
  copyToClipboard(promptText).then(success => {
    if (success) {
      showToast('Copied to clipboard', 'success');
    }
  });
}

function randomRefactor() {
  const promptId = elements.randomModal.dataset.promptId;
  const prompt = {
    title: elements.randomTitle.textContent,
    prompt: elements.randomPrompt.textContent,
    tags: Array.from(elements.randomTags.querySelectorAll('.tag')).map(t => t.textContent),
  };
  elements.randomModal.hidden = true;
  elements.randomModal.classList.remove('is-visible');
  modalManager.openPromptModal(null, prompt);
}

// ======================
// Import/Export/Cleanup
// ======================
async function handleExport() {
  try {
    const result = await api.exportPrompts();
    if (result && result.prompts) {
      const blob = new Blob([JSON.stringify(result.prompts, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prompts-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${result.prompts.length} prompts`, 'success');
    }
  } catch (error) {
    showToast(error.message || 'Export failed', 'error');
  }
}

async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const prompts = JSON.parse(text);

      if (!Array.isArray(prompts)) {
        throw new Error('Invalid format');
      }

      if (!confirm(`Import ${prompts.length} prompts? This will add to your collection.`)) {
        return;
      }

      const result = await api.importPrompts(prompts);
      showToast(`Imported ${result.imported} prompts`, 'success');
      loadInitialPrompts(); // Refresh grid
    } catch (error) {
      showToast('Invalid JSON file or format', 'error');
    }
  };
  input.click();
}

async function handleCleanup() {
  if (!confirm('Delete all deleted prompts permanently? This cannot be undone.')) {
    return;
  }

  try {
    await api.cleanup();
    showToast('Cleanup completed', 'success');
  } catch (error) {
    showToast(error.message || 'Cleanup failed', 'error');
  }
}

// ======================
// Event Listener Setup
// ======================
function setupEventListeners() {
  // Theme toggle
  elements.themeToggle.addEventListener('click', toggleTheme);

  // Random
  elements.randomBtn.addEventListener('click', handleRandom);
  elements.randomCopyBtn.addEventListener('click', randomCopy);
  elements.randomRefactorBtn.addEventListener('click', randomRefactor);

  // Random modal close
  document.querySelectorAll('#random-modal .modal-close, #random-modal .modal-overlay').forEach(el => {
    el.addEventListener('click', () => {
      elements.randomModal.hidden = true;
      elements.randomModal.classList.remove('is-visible');
    });
  });

  // Export/Import/Cleanup
  elements.exportBtn.addEventListener('click', handleExport);
  elements.importBtn.addEventListener('click', handleImport);
  elements.cleanupBtn.addEventListener('click', handleCleanup);

  // Create button
  elements.createBtn.addEventListener('click', () => {
    modalManager.openPromptModal();
  });

  // Sort
  elements.sortSelect.addEventListener('change', handleSortChange);

  // Include deleted
  elements.includeDeleted.addEventListener('change', handleIncludeDeletedChange);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

function handleKeyboard(e) {
  // Ctrl/Cmd + N: New prompt
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    modalManager.openPromptModal();
    return;
  }

  // /: Focus search
  if (e.key === '/' && !isInputFocused()) {
    e.preventDefault();
    search.focus();
    return;
  }

  // Escape: Close modals
  if (e.key === 'Escape') {
    if (!elements.randomModal.hidden) {
      elements.randomModal.hidden = true;
      elements.randomModal.classList.remove('is-visible');
    }
  }
}

function isInputFocused() {
  const active = document.activeElement;
  return ['INPUT', 'TEXTAREA'].includes(active.tagName);
}

// ======================
// Start Application
// ======================
document.addEventListener('DOMContentLoaded', init);
