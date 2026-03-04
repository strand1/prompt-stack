/**
 * Prompt Stack Frontend Application
 * Complete SPA for managing image generation prompts
 */

// ============================================================================
// Global State
// ============================================================================

let masonry = null;

// ============================================================================
// API Service
// ============================================================================

const API = {
  baseUrl: '/api',

  async fetch(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  },

  // Prompts
  async getPrompts(params = {}) {
    // Add cache buster to prevent browser caching
    params._cache = Date.now();
    // Filter out undefined, null, and empty string values
    const filteredParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        filteredParams[key] = value;
      }
    }
    const query = new URLSearchParams(filteredParams).toString();
    return this.fetch(`/prompts${query ? `?${query}` : ''}`);
  },

  async createPrompt(data) {
    return this.fetch('/prompts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePrompt(id, data) {
    return this.fetch(`/prompts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deletePrompt(id) {
    return this.fetch(`/prompts/${id}`, { method: 'DELETE' });
  },

  async incrementUsage(id) {
    return this.fetch(`/prompts/${id}/increment-usage`, { method: 'PATCH' });
  },

  async duplicatePrompt(id) {
    return this.fetch(`/prompts/${id}/duplicate`, { method: 'POST' });
  },

  async bulkDelete(ids) {
    return this.fetch('/prompts/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  async getRandomPrompt(params = {}) {
    // Filter out undefined, null, and empty string values
    const filteredParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        filteredParams[key] = value;
      }
    }
    const query = new URLSearchParams(filteredParams).toString();
    return this.fetch(`/prompts/random${query ? `?${query}` : ''}`);
  },

  // Tags
  async getTags(params = {}) {
    // Filter out undefined, null, and empty string values
    const filteredParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        filteredParams[key] = value;
      }
    }
    const query = new URLSearchParams(filteredParams).toString();
    return this.fetch(`/tags${query ? `?${query}` : ''}`);
  },

  // Import/Export
  async exportPrompts(params = {}) {
    // Filter out undefined, null, and empty string values
    const filteredParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        filteredParams[key] = value;
      }
    }
    const query = new URLSearchParams(filteredParams).toString();
    return this.fetch(`/export${query ? `?${query}` : ''}`);
  },

  async importPrompts(prompts) {
    return this.fetch('/import', {
      method: 'POST',
      body: JSON.stringify({ prompts }),
    });
  },

  async cleanup() {
    return this.fetch('/cleanup', { method: 'POST' });
  },
};

// ============================================================================
// Application State
// ============================================================================

const AppState = {
  prompts: [],
  allPrompts: [],
  tags: [],
  pagination: {
    page: 1,
    limit: 30,  // Increased from 20 for better infinite scroll experience
    total: 0,
    totalPages: 0,
    isLoadingMore: false,
    hasMore: true,
  },
  filters: {
    search: '',
    selectedTags: new Set(),
    sort: 'newest',
    include_deleted: false,
  },
  isLoading: false,
};

// ============================================================================
// DOM Elements
// ============================================================================

const DOM = {
  // Search & Filters
  searchInput: document.getElementById('search-input'),
  btnSearch: document.getElementById('btn-search'),
  btnClear: document.getElementById('btn-clear'),
  sortSelect: document.getElementById('sort-select'),
  includeDeleted: document.getElementById('include-deleted'),

  // Tags
  tagsCloud: document.getElementById('tags-cloud'),

  // Prompts Grid
  promptsGrid: document.getElementById('prompts-grid'),
  loading: document.getElementById('loading'),
  emptyState: document.getElementById('empty-state'),
  infiniteLoading: document.getElementById('infinite-loading'),
  scrollSentinel: document.getElementById('scroll-sentinel'),

  // Header Actions
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  btnRandom: document.getElementById('btn-random'),
  btnExport: document.getElementById('btn-export'),
  btnImport: document.getElementById('btn-import'),
  btnCleanup: document.getElementById('btn-cleanup'),
  btnCreate: document.getElementById('btn-create'),

  // Prompt Modal
  promptModal: document.getElementById('prompt-modal'),
  modalTitle: document.getElementById('modal-title'),
  promptForm: document.getElementById('prompt-form'),
  inputId: document.getElementById('prompt-id'),
  inputTitle: document.getElementById('input-title'),
  inputPrompt: document.getElementById('input-prompt'),
  inputTags: document.getElementById('input-tags'),
  inputImage: document.getElementById('input-image'),
  btnSelectImage: document.getElementById('btn-select-image'),
  btnRemoveImage: document.getElementById('btn-remove-image'),
  btnGenerateImage: document.getElementById('btn-generate-image'),
  imagePreviewContainer: document.getElementById('image-preview-container'),
  imagePreview: document.getElementById('image-preview'),
  imageName: document.getElementById('image-name'),
  btnDelete: document.getElementById('btn-delete'),

  // Toast
  toastContainer: document.getElementById('toast-container'),
};

// ============================================================================
// Utility Functions
// ============================================================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ============================================================================
// Image Aspect Ratio Detection
// ============================================================================

async function updateImageAspectRatios() {
  const imageCards = document.querySelectorAll('.prompt-card.has-image');
  const cardsToUpdate = [];

  // Collect all cards that need aspect ratio (don't have inline one yet)
  imageCards.forEach((card) => {
    if (!card.style.aspectRatio) {
      const filename = card.dataset.imageFilename;
      if (filename) {
        const imageUrl = `/images/${filename}`;
        cardsToUpdate.push({ card, imageUrl });
      }
    }
  });

  // Process each card - load image and set aspect ratio
  await Promise.all(
    cardsToUpdate.map(async ({ card, imageUrl }) => {
      try {
        const img = new Image();
        img.src = imageUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          // Timeout after 5 seconds to prevent hanging
          setTimeout(() => reject(new Error('Timeout')), 5000);
        });
        card.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
      } catch (error) {
        console.warn('Failed to load image for aspect ratio:', imageUrl, error);
        // Set a fallback aspect ratio (16:9) so the card still has some height
        card.style.aspectRatio = '16 / 9';
      }
    })
  );
}

function initMasonry() {
  const grid = document.getElementById('prompts-grid');
  if (!grid) {
    console.warn('Masonry: grid element not found');
    return;
  }

  console.log('initMasonry - grid width:', grid.clientWidth, 'offsetWidth:', grid.offsetWidth, 'Masonry available:', typeof Masonry !== 'undefined');

  // Destroy existing instance if any
  if (masonry) {
    console.log('Destroying previous Masonry instance');
    masonry.destroy();
    masonry = null;
  }

  // Fallback if Masonry library didn't load
  if (typeof Masonry === 'undefined') {
    console.warn('Masonry library not loaded - using CSS columns fallback');
    grid.style.columnCount = '3';
    grid.style.columnGap = '2px';
    return;
  }

  // Ensure grid takes full width
  grid.style.width = '100%';

  // Ensure grid-sizer exists for column width (4 columns via 25% width)
  let sizer = grid.querySelector('.grid-sizer');
  if (!sizer) {
    sizer = document.createElement('div');
    sizer.className = 'grid-sizer';
    sizer.style.cssText = 'position: absolute; visibility: hidden; width: 25%; height: 0; top: 0; left: 0;';
    grid.insertBefore(sizer, grid.firstChild);
  }

  // Initialize Masonry with sizer
  masonry = new Masonry(grid, {
    itemSelector: '.prompt-card',
    columnWidth: '.grid-sizer',
    gutter: 2,
    fitWidth: false,
    transitionDuration: '0.2s'
  });

  console.log('Masonry with sizer initialized, cols:', masonry.cols);
}

// ============================================================================
// Theme Management
// ============================================================================

const ThemeManager = {
  STORAGE_KEY: 'prompt-stack-theme',
  THEMES: ['light', 'dark'],

  getSavedTheme() {
    return localStorage.getItem(this.STORAGE_KEY);
  },

  setTheme(theme) {
    if (!this.THEMES.includes(theme)) {
      theme = 'light'; // default fallback
    }
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.updateToggleIcon(theme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    this.setTheme(next);
  },

  updateToggleIcon(theme) {
    if (DOM.btnThemeToggle) {
      DOM.btnThemeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  },

  init() {
    // Check for saved preference
    const saved = this.getSavedTheme();
    if (saved) {
      this.setTheme(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // Follow system preference if no saved pref
      this.setTheme('dark');
    } else {
      this.setTheme('light');
    }
  }
};

// ============================================================================
// Image Management
// ============================================================================

const ImageManager = {
  currentImage: null, // Currently associated image filename
  selectedFile: null, // Pending file for upload

  init() {
    if (DOM.btnSelectImage) {
      DOM.btnSelectImage.addEventListener('click', () => {
        DOM.inputImage.click();
      });
    }

    if (DOM.inputImage) {
      DOM.inputImage.addEventListener('change', (e) => {
        this.handleFileSelect(e.target.files[0]);
      });
    }

    if (DOM.btnRemoveImage) {
      DOM.btnRemoveImage.addEventListener('click', async () => {
        const confirmed = confirm('Remove the image from this prompt? This will automatically save the change.');
        if (confirmed) {
          await this.removeImage();
        }
      });
    }

    if (DOM.btnGenerateImage) {
      DOM.btnGenerateImage.addEventListener('click', () => {
        this.generateImage();
      });
    }
  },

  handleFileSelect(file) {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Invalid file type. Please select an image (jpeg, png, gif, webp).', 'error');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      showToast('File too large. Maximum size is 10MB.', 'error');
      return;
    }

    this.selectedFile = file;
    this.showPreview(file);
    this.updateRemoveButton(true);
  },

  showPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      DOM.imagePreview.src = e.target.result;
      DOM.imagePreviewContainer.style.display = 'flex';
      DOM.imageName.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    };
    reader.readAsDataURL(file);
  },

  clearImage() {
    this.selectedFile = null;
    this.currentImage = null;
    DOM.inputImage.value = '';
    DOM.imagePreviewContainer.style.display = 'none';
    DOM.imagePreview.src = '';
    DOM.imageName.textContent = '';
    this.updateRemoveButton(false);
    this.updateGenerateButton(true); // Show generate button when no image
  },

  updateRemoveButton(show) {
    DOM.btnRemoveImage.style.display = show ? 'inline-flex' : 'none';
  },

  updateGenerateButton(show) {
    DOM.btnGenerateImage.style.display = show ? 'inline-flex' : 'none';
  },

  async generateImage() {
    let promptId = DOM.inputId.value;

    // If no prompt ID, we need to save first (new prompt or refactor)
    if (!promptId) {
      // Validate required fields
      const title = DOM.inputTitle.value.trim() || DOM.inputPrompt.value.trim().substring(0, 60) + '...';
      const promptText = DOM.inputPrompt.value.trim();

      if (!title || !promptText) {
        showToast('Title and prompt are required before generating', 'error');
        return;
      }

      // Save the prompt first
      DOM.btnGenerateImage.disabled = true;
      DOM.btnGenerateImage.textContent = '⏳ Saving & Generating...';

      try {
        const data = {
          title,
          prompt: promptText,
          model_type: 'Other',
          tags: DOM.inputTags.value
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t),
          image: null
        };

        const result = await API.createPrompt(data);
        promptId = result.id;
        DOM.inputId.value = promptId; // Update hidden field

        showToast('Prompt saved! Generating image...', 'success');
      } catch (error) {
        showToast(`Failed to save prompt: ${error.message}`, 'error');
        return;
      } finally {
        DOM.btnGenerateImage.disabled = false;
        DOM.btnGenerateImage.textContent = '⏳ Generating...';
      }
    }

    // Disable button during generation
    DOM.btnGenerateImage.disabled = true;
    DOM.btnGenerateImage.textContent = '⏳ Generating...';

    try {
      const response = await fetch(`/api/prompts/${promptId}/generate-image`, {
        method: 'POST'
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate image');
      }

      // Only update the modal image if it's still showing the same prompt
      // (user may have closed modal and opened a different one)
      const currentPromptId = DOM.inputId.value;
      if (currentPromptId == promptId) {
        this.setCurrentImage(result.image);
      }

      showToast('Image generated successfully!', 'success');

      // Refresh the grid to show the new image card
      await refreshData();
    } catch (error) {
      showToast(`Failed to generate image: ${error.message}`, 'error');
    } finally {
      DOM.btnGenerateImage.disabled = false;
      DOM.btnGenerateImage.textContent = '✨ Generate Image';
    }
  },

  async uploadImage() {
    if (!this.selectedFile) {
      return this.currentImage; // Return existing if no new file
    }

    try {
      const formData = new FormData();
      formData.append('image', this.selectedFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const contentType = response.headers.get('content-type');

      if (!response.ok) {
        // Try to get detailed error message
        let errorMsg = `HTTP ${response.status}`;
        try {
          // Try JSON first
          const result = await response.json();
          errorMsg = result.error || errorMsg;
        } catch (e) {
          // Not JSON - show text snippet
          const text = await response.text();
          if (text) {
            const snippet = text.substring(0, 100).replace(/[<>]/g, ''); // Strip tags for readability
            errorMsg = `Server error: ${snippet}${text.length > 100 ? '...' : ''}`;
          }
        }
        throw new Error(errorMsg);
      }

      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        return result.filename;
      } else {
        throw new Error('Upload succeeded but server returned invalid format');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      showToast(`Failed to upload image: ${error.message}`, 'error');
      throw error;
    }
  },

  setCurrentImage(filename) {
    this.currentImage = filename;
    if (filename) {
      // Show preview of existing image
      DOM.imagePreview.src = `/images/${encodeURIComponent(filename)}`;
      DOM.imagePreviewContainer.style.display = 'flex';
      DOM.imageName.textContent = filename;
      this.updateRemoveButton(true);
      this.updateGenerateButton(false); // Hide generate button when image exists
    } else {
      this.clearImage();
    }
  },

  reset() {
    this.currentImage = null;
    this.selectedFile = null;
    this.clearImage();
  },

  async removeImage() {
    const promptId = DOM.inputId.value;
    if (!promptId) {
      showToast('No prompt selected', 'error');
      return;
    }

    try {
      // Call the existing savePrompt function to update the prompt with image: null
      // We need to call it with a synthetic event, so let's invoke the save logic directly
      showToast('Removing image...', 'info');

      const data = {
        title: DOM.inputTitle.value.trim(),
        prompt: DOM.inputPrompt.value.trim(),
        model_type: 'Other',
        tags: DOM.inputTags.value
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t),
        image: null // Explicitly set image to null
      };

      await API.updatePrompt(promptId, data);
      showToast('Image removed. You can now generate a new one.', 'success');

      // Update the UI to reflect removal
      this.currentImage = null;
      this.selectedFile = null;
      DOM.inputImage.value = '';
      DOM.imagePreviewContainer.style.display = 'none';
      DOM.imagePreview.src = '';
      DOM.imageName.textContent = '';
      this.updateRemoveButton(false);
      this.updateGenerateButton(true);

      // Refresh grid to update card
      await refreshData();
    } catch (error) {
      showToast(`Failed to remove image: ${error.message}`, 'error');
    }
  }
};

// ============================================================================
// Toast Notifications
// ============================================================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    ${escapeHtml(message)}
    <button class="toast-close">&times;</button>
  `;

  DOM.toastContainer.appendChild(toast);

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// ============================================================================
// Modal Management
// ============================================================================

function openModal(modal) {
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

function closeAllModals() {
  closeModal(DOM.promptModal);
}

// ============================================================================
// Usage Tracking
// ============================================================================

async function incrementUsage(id, btnElement = null) {
  try {
    await API.incrementUsage(id);
    // Update the usage count in the UI
    const card = btnElement
      ? btnElement.closest('.prompt-card')
      : document.querySelector(`.prompt-card[data-id="${id}"]`);

    if (card) {
      const usageSpan = card.querySelector('.prompt-usage span');
      if (usageSpan) {
        const currentCount = parseInt(usageSpan.textContent.replace(/[^0-9]/g, '')) || 0;
        const newCount = currentCount + 1;
        usageSpan.textContent = `📊 ${newCount} uses`;
      }
    }
  } catch (error) {
    console.error('Failed to increment usage:', error);
    // Silently fail - not critical
  }
}

// ============================================================================
// Prompt Rendering
// ============================================================================

function renderPromptCard(prompt) {
  const isDeleted = prompt.isDeleted;
  const hasImage = prompt.image && prompt.image.trim() !== '';

  const tagsHtml = (prompt.tags || [])
    .map(
      (tag) =>
        `<span class="prompt-tag">${escapeHtml(tag)}</span>`
    )
    .join('');

  const cardClass = `prompt-card ${isDeleted ? 'deleted' : ''} ${hasImage ? 'has-image' : ''}`;
  const backgroundStyle = hasImage
    ? `style="background-image: url('/images/${encodeURIComponent(prompt.image)}'); background-size: cover; background-position: center;" data-image-filename="${encodeURIComponent(prompt.image)}"`
    : '';

  return `
    <div class="${cardClass}" data-id="${prompt.id}" data-prompt="${prompt.prompt.replace(/"/g, '&quot;')}" ${backgroundStyle}>
      <div class="prompt-card-header">
        <h3 class="prompt-title">${escapeHtml(prompt.title)}</h3>
        <div class="prompt-card-actions">
          <button class="card-action-btn btn-copy" title="Copy prompt to clipboard">📋</button>
          <button class="card-action-btn btn-refactor" title="Refactor (copy & edit)">✏️</button>
          <button class="card-action-btn btn-edit" title="Edit">↔️</button>
          <button class="card-action-btn btn-delete-card" title="Delete">🗑️</button>
        </div>
      </div>

      <div class="prompt-prompt">${escapeHtml(prompt.prompt)}</div>

      ${tagsHtml ? `<div class="prompt-tags">${tagsHtml}</div>` : ''}

      <div class="prompt-meta">
        <div class="prompt-usage">
          <span>📊 ${prompt.usage_count || 0} uses</span>
        </div>
        <div class="prompt-date">
          Created: ${formatDate(prompt.created_at)}
        </div>
      </div>
    </div>
  `;
}

async function renderPromptsGrid() {
  try {
    // Handle main loading state (initial load)
    if (AppState.isLoading) {
      DOM.promptsGrid.innerHTML = '';
      DOM.loading.style.display = 'block';
      DOM.emptyState.style.display = 'none';
      DOM.infiniteLoading.style.display = 'none';
      return;
    }

    DOM.loading.style.display = 'none';

    // Show/hide infinite loading spinner
    if (AppState.pagination.isLoadingMore) {
      DOM.infiniteLoading.style.display = 'block';
    } else {
      DOM.infiniteLoading.style.display = 'none';
    }

    if (AppState.prompts.length === 0) {
      DOM.promptsGrid.innerHTML = '';
      DOM.emptyState.style.display = 'block';
      DOM.infiniteLoading.style.display = 'none';
      return;
    }

    DOM.emptyState.style.display = 'none';
    DOM.promptsGrid.innerHTML = AppState.prompts
      .map(renderPromptCard)
      .join('');

    // Add event listeners to card action buttons
    DOM.promptsGrid.querySelectorAll('.btn-edit').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const card = e.target.closest('.prompt-card');
        const id = parseInt(card.dataset.id);
        await incrementUsage(id);
        openEditModal(id);
      });
    });

  DOM.promptsGrid.querySelectorAll('.btn-refactor').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = e.target.closest('.prompt-card');
      const id = parseInt(card.dataset.id);
      // Increment usage before refactoring
      await incrementUsage(id);
      await refactorPrompt(id);
    });
  });

  DOM.promptsGrid.querySelectorAll('.btn-delete-card').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = e.target.closest('.prompt-card');
      const id = parseInt(card.dataset.id);
      await deletePromptWithConfirmation(id);
    });
  });

  DOM.promptsGrid.querySelectorAll('.btn-copy').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = e.target.closest('.prompt-card');
      const promptText = card.dataset.prompt;
      const promptId = parseInt(card.dataset.id);

      try {
        // Try modern Clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(promptText);
        } else {
          // Fallback for older browsers or non-secure contexts
          const textarea = document.createElement('textarea');
          textarea.value = promptText;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          const success = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (!success) {
            throw new Error('Fallback copy method failed');
          }
        }

        showToast('Copied to clipboard!', 'success');

        // Visual feedback
        const originalText = btn.textContent;
        btn.textContent = '✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove('copied');
        }, 1500);

        // Increment usage count
        await incrementUsage(promptId, btn);
      } catch (error) {
        showToast('Failed to copy to clipboard', 'error');
        console.error('Copy failed:', error);
      }
    });
  });

  // Click on card opens edit modal (but not on checkboxes/buttons)
  DOM.promptsGrid.querySelectorAll('.prompt-card').forEach((card) => {
    card.addEventListener('click', async (e) => {
      if (
        e.target.tagName !== 'INPUT' &&
        !e.target.closest('.card-action-btn') &&
        !e.target.closest('input[type="checkbox"]')
      ) {
        const id = parseInt(card.dataset.id);
        // Increment usage count when opening the prompt
        await incrementUsage(id);
        openEditModal(id);
      }
    });
  });

  // Update aspect ratios for image cards
  try {
    await updateImageAspectRatios();
  } catch (err) {
    console.warn('updateImageAspectRatios failed:', err);
  }

  // Wait for aspect ratios to be applied and heights computed
  await new Promise(resolve => requestAnimationFrame(resolve));

  // Initialize Masonry now that cards have proper heights
  initMasonry();

  // Reconnect infinite scroll observer after DOM update
  setupInfiniteScroll();
} catch (error) {
  console.error('renderPromptsGrid failed:', error);
  DOM.loading.style.display = 'none';
  DOM.emptyState.style.display = 'block';
}
}

// ============================================================================
// Tags & Models Rendering
// ============================================================================

function renderTagsCloud() {
  DOM.tagsCloud.innerHTML = AppState.tags
    .map(
      (tag) => `
      <button class="tag-pill ${AppState.filters.selectedTags.has(tag.name) ? 'active' : ''}" data-tag="${escapeHtml(tag.name)}">
        ${escapeHtml(tag.name)}
        <span class="tag-count">(${tag.count})</span>
      </button>
    `
    )
    .join('');
}

// Model filtering removed - model_type is set to default 'Other'

// ============================================================================
// Infinite Scroll
// ============================================================================

let scrollObserver = null;

function setupInfiniteScroll() {
  // Disconnect existing observer if any
  if (scrollObserver) {
    scrollObserver.disconnect();
  }

  const sentinel = DOM.scrollSentinel;
  if (!sentinel) {
    console.error('[InfiniteScroll] Sentinel element not found!');
    return;
  }

  // IMPORTANT: Clear any previous inline display:none (from when hasMore was false)
  sentinel.style.display = '';

  // Don't set up observer if no more pages to load
  if (!AppState.pagination.hasMore) {
    sentinel.style.display = 'none';
    return;
  }

  // Ensure sentinel has non-zero dimensions (force if needed)
  const computedStyle = window.getComputedStyle(sentinel);
  const height = sentinel.offsetHeight;

  // If sentinel still has zero height, force a minimum
  if (height <= 0) {
    sentinel.style.minHeight = '1px';
    sentinel.style.height = '1px';
    
  }

  // Don't set up observer if no more pages to load
  if (!AppState.pagination.hasMore) {
    sentinel.style.display = 'none';
    return;
  }

  scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting &&
          !AppState.isLoading &&
          !AppState.pagination.isLoadingMore &&
          AppState.pagination.hasMore) {
        loadMorePrompts();
      }
    });
  }, {
    root: null, // viewport
    rootMargin: '200px', // Start loading a bit before hitting bottom
    threshold: 0.1,
  });

  scrollObserver.observe(sentinel);
}

async function loadMorePrompts() {
  if (AppState.pagination.isLoadingMore || !AppState.pagination.hasMore) {
    return;
  }
  await loadPrompts(true); // Append mode, load next page
}

// ============================================================================
// Data Loading
// ============================================================================

async function loadPrompts(append = false) {
  // Determine which page to load: next page for append, page 1 for fresh
  const pageToLoad = append ? AppState.pagination.page + 1 : 1;

  if (append) {
    AppState.pagination.isLoadingMore = true;
  } else {
    AppState.isLoading = true;
    AppState.prompts = []; // Clear existing prompts for fresh load
  }

  renderPromptsGrid();

  try {
    const response = await API.getPrompts({
      search: AppState.filters.search || undefined,
      sort: AppState.filters.sort,
      page: pageToLoad,
      limit: AppState.pagination.limit,
      include_deleted: AppState.filters.include_deleted,
      tags: AppState.filters.selectedTags.size > 0
        ? Array.from(AppState.filters.selectedTags).join(',')
        : undefined,
    });

    // Update prompts: either append or replace
    if (append) {
      AppState.prompts = [...AppState.prompts, ...(response.prompts || [])];
    } else {
      AppState.prompts = response.prompts || [];
      AppState.allPrompts = response.prompts || [];
    }

    // Update pagination metadata and current page
    AppState.pagination.page = pageToLoad;
    AppState.pagination.total = (response.pagination && response.pagination.total) || 0;
    AppState.pagination.totalPages = (response.pagination && response.pagination.totalPages) || 0;
    AppState.pagination.hasMore = AppState.pagination.page < AppState.pagination.totalPages;

    // Reset loading states
    AppState.isLoading = false;
    AppState.pagination.isLoadingMore = false;

    renderPromptsGrid();
  } catch (error) {
    // Reset loading states
    if (!append) {
      AppState.isLoading = false;
    } else {
      AppState.pagination.isLoadingMore = false;
    }
    renderPromptsGrid();
    showToast(`Failed to load prompts: ${error.message}`, 'error');
  }
}

async function loadTags() {
  try {
    AppState.tags = await API.getTags({
      include_deleted: AppState.filters.include_deleted,
    });
    renderTagsCloud();
  } catch (error) {
    console.error('Failed to load tags:', error);
  }
}

async function refreshData() {
  await Promise.all([loadPrompts(), loadTags()]);
}

// ============================================================================
// Filtering & Navigation
// ============================================================================

function setSearch(query) {
  AppState.filters.search = query;
  AppState.pagination.page = 1;
  refreshData();
}

function setSort(sort) {
  AppState.filters.sort = sort;
  refreshData();
}

function toggleTag(tag) {
  if (AppState.filters.selectedTags.has(tag)) {
    AppState.filters.selectedTags.delete(tag);
  } else {
    AppState.filters.selectedTags.add(tag);
  }
  AppState.pagination.page = 1;
  refreshData();
}

// ============================================================================
// Prompt CRUD Operations
// ============================================================================

function openCreateModal() {
  DOM.modalTitle.textContent = 'Create Prompt';
  DOM.inputId.value = '';
  DOM.promptForm.reset();
  DOM.btnDelete.style.display = 'none';
  ImageManager.reset();
  openModal(DOM.promptModal);
}

function openEditModal(idOrPrompt) {
  let prompt;
  if (typeof idOrPrompt === 'object') {
    prompt = idOrPrompt;
  } else {
    const id = idOrPrompt;
    prompt = AppState.prompts.find((p) => p.id === id) ||
             (AppState.allPrompts && AppState.allPrompts.find((p) => p.id === id));
  }

  if (!prompt) {
    console.error('Prompt not found for edit modal');
    showToast('Prompt not found', 'error');
    return;
  }

  DOM.modalTitle.textContent = 'Edit Prompt';
  DOM.inputId.value = prompt.id;
  DOM.inputTitle.value = prompt.title;
  DOM.inputPrompt.value = prompt.prompt;
  DOM.inputTags.value = (prompt.tags || []).join(', ');

  // Set existing image if present
  ImageManager.setCurrentImage(prompt.image || null);

  // Reset generate button state (in case it was disabled from a previous generation)
  DOM.btnGenerateImage.disabled = false;
  DOM.btnGenerateImage.textContent = '✨ Generate Image';

  // Only show delete button for non-deleted prompts
  DOM.btnDelete.style.display = prompt.isDeleted ? 'none' : 'block';

  openModal(DOM.promptModal);
}

async function savePrompt(e) {
  e.preventDefault();

  const id = DOM.inputId.value;
  const title = DOM.inputTitle.value.trim() || DOM.inputPrompt.value.trim().substring(0, 60) + '...';
  const promptText = DOM.inputPrompt.value.trim();

  if (!title || !promptText) {
    showToast('Title and prompt are required', 'error');
    return;
  }

  try {
    // Upload image if a new one is selected
    let imageFilename = ImageManager.currentImage;
    if (ImageManager.selectedFile) {
      try {
        imageFilename = await ImageManager.uploadImage();
        ImageManager.currentImage = imageFilename; // Update current image after successful upload
      } catch (error) {
        // Upload already showed error toast, abort save
        return;
      }
    }

    const data = {
      title: title,
      prompt: promptText,
      model_type: 'Other',
      tags: DOM.inputTags.value
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t),
      image: imageFilename || null
    };

    if (id) {
      await API.updatePrompt(id, data);
      showToast('Prompt updated successfully', 'success');
    } else {
      await API.createPrompt(data);
      showToast('Prompt created successfully', 'success');
    }

    closeModal(DOM.promptModal);
    await refreshData();
  } catch (error) {
    showToast(`Failed to save prompt: ${error.message}`, 'error');
  }
}

async function deleteCurrentPrompt() {
  const id = DOM.inputId.value;
  if (!id) return;

  if (!confirm('Are you sure you want to delete this prompt? This can be undone.')) {
    return;
  }

  try {
    await API.deletePrompt(id);
    showToast('Prompt deleted', 'success');
    closeModal(DOM.promptModal);
    await refreshData();
  } catch (error) {
    showToast(`Failed to delete prompt: ${error.message}`, 'error');
  }
}

async function deletePromptWithConfirmation(id) {
  if (!confirm('Are you sure you want to delete this prompt? This can be undone.')) {
    return;
  }

  try {
    await API.deletePrompt(id);
    showToast('Prompt deleted', 'success');
    await refreshData();
  } catch (error) {
    showToast(`Failed to delete prompt: ${error.message}`, 'error');
  }
}

async function refactorPrompt(id) {
  try {
    const duplicated = await API.duplicatePrompt(id);
    showToast('Prompt duplicated for refactoring', 'success');
    openEditModal(duplicated);
    await refreshData();
  } catch (error) {
    showToast(`Failed to duplicate prompt: ${error.message}`, 'error');
  }
}

// ============================================================================
// Random Prompt (Shuffle)
// ============================================================================

/**
 * Shuffle array in-place using Fisher-Yates algorithm
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function loadRandomPrompt() {
  // If we have prompts loaded, shuffle them in place
  if (AppState.prompts.length === 0) {
    showToast('No prompts to shuffle. Load some prompts first.', 'error');
    return;
  }

  // Shuffle the current array
  shuffleArray(AppState.prompts);

  // Re-render the grid with shuffled order
  renderPromptsGrid();

  showToast('Shuffled prompt order!', 'success');
}

// ============================================================================
// Import / Export
// ============================================================================

async function exportPrompts() {
  try {
    const data = await API.exportPrompts({
      include_deleted: AppState.filters.include_deleted,
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Exported ${data.length} prompts`, 'success');
  } catch (error) {
    showToast(`Failed to export: ${error.message}`, 'error');
  }
}

async function importPrompts() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error('Invalid format: expected an array of prompts');
      }

      if (!confirm(`Import ${data.length} prompt(s)? Duplicates will be skipped.`)) {
        return;
      }

      const result = await API.importPrompts(data);
      showToast(`Successfully imported ${result.imported} prompts`, 'success');
      await refreshData();
    } catch (error) {
      showToast(`Failed to import: ${error.message}`, 'error');
    }

    input.value = '';
  };

  input.click();
}

async function runCleanup() {
  if (!confirm('Permanently delete all prompts marked as deleted for more than 30 days? This cannot be undone.')) {
    return;
  }

  try {
    const result = await API.cleanup();
    showToast(`Cleaned up ${result.deleted} old deleted prompts`, 'success');
    await refreshData();
  } catch (error) {
    showToast(`Cleanup failed: ${error.message}`, 'error');
  }
}

// ============================================================================
// Event Setup
// ============================================================================

function setupEventListeners() {
  // Search controls
  DOM.searchInput.addEventListener('input', debounce((e) => {
    setSearch(e.target.value);
  }, 300));

  DOM.btnSearch.addEventListener('click', () => setSearch(DOM.searchInput.value));
  DOM.btnClear.addEventListener('click', () => {
    DOM.searchInput.value = '';
    setSearch('');
  });

  // Filters
  DOM.sortSelect.addEventListener('change', (e) => setSort(e.target.value));
  DOM.includeDeleted.addEventListener('change', (e) => {
    AppState.filters.include_deleted = e.target.checked;
    refreshData();
  });

  // Tags cloud (event delegation)
  DOM.tagsCloud.addEventListener('click', (e) => {
    const tagBtn = e.target.closest('.tag-pill');
    if (tagBtn) {
      const tag = tagBtn.dataset.tag;
      toggleTag(tag);
    }
  });

  // Header actions
  DOM.btnThemeToggle.addEventListener('click', () => ThemeManager.toggleTheme());
  DOM.btnRandom.addEventListener('click', loadRandomPrompt);
  DOM.btnExport.addEventListener('click', exportPrompts);
  DOM.btnImport.addEventListener('click', importPrompts);
  DOM.btnCleanup.addEventListener('click', runCleanup);
  DOM.btnCreate.addEventListener('click', openCreateModal);

  // Image management
  ImageManager.init();

  // Modal
  DOM.promptForm.addEventListener('submit', savePrompt);
  DOM.btnDelete.addEventListener('click', deleteCurrentPrompt);

  // Auto-generate title from prompt if title is empty
  DOM.inputPrompt.addEventListener('input', () => {
    if (!DOM.inputTitle.value.trim()) {
      const promptText = DOM.inputPrompt.value.trim();
      if (promptText) {
        const autoTitle = promptText.length > 60
          ? promptText.substring(0, 60) + '...'
          : promptText;
        DOM.inputTitle.value = autoTitle;
      }
    }
  });

  DOM.promptModal.querySelector('.modal-overlay').addEventListener('click', () => {
    closeModal(DOM.promptModal);
  });
  DOM.promptModal.querySelector('.modal-cancel').addEventListener('click', () => {
    closeModal(DOM.promptModal);
  });
  DOM.promptModal.querySelector('.modal-close').addEventListener('click', () => {
    closeModal(DOM.promptModal);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      const activeElement = document.activeElement;
      if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        DOM.searchInput.focus();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openCreateModal();
    }
  });
}

// ============================================================================
// Application Initialization
// ============================================================================

async function init() {
  try {
    // Initialize theme first
    ThemeManager.init();
    showToast('Loading prompts...', 'info');
    await refreshData();
    showToast(`Loaded ${AppState.pagination.total} prompts`, 'success');
  } catch (error) {
    showToast(`Failed to initialize: ${error.message}`, 'error');
  }
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  init();
});
