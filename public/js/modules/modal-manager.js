/**
 * Modal Manager - Handles prompt modal and image viewer modal
 */

import { store, selectors } from './store.js';
import { api } from './api.js';
import { showToast } from '../utils.js';
import { escapeHtml } from '../utils.js';

/**
 * Modal Manager class
 */
export class ModalManager {
  constructor() {
    // Modal elements
    this.promptModal = document.getElementById('prompt-modal');
    this.imageViewerModal = document.getElementById('image-viewer-modal');

    // Form elements - Prompt Modal
    this.promptForm = document.getElementById('prompt-form');
    this.promptIdInput = document.getElementById('prompt-id');
    this.titleInput = document.getElementById('input-title');
    this.promptInput = document.getElementById('input-prompt');
    this.tagsInput = document.getElementById('input-tags');
    this.imageInput = document.getElementById('input-image');
    this.selectImageBtn = document.getElementById('btn-select-image');
    this.removeImageBtn = document.getElementById('btn-remove-image');
    this.generateImageBtn = document.getElementById('btn-generate-image');
    this.imagePreview = document.getElementById('image-preview');
    this.previewThumb = document.getElementById('preview-thumb');
    this.previewRemoveBtn = document.getElementById('btn-preview-remove');
    this.deleteBtn = document.getElementById('btn-delete');

    // Form elements - Image Viewer Modal
    this.viewerForm = document.getElementById('viewer-form');
    this.viewerPromptIdInput = document.getElementById('viewer-prompt-id');
    this.viewerTitleInput = document.getElementById('viewer-title');
    this.viewerPromptInput = document.getElementById('viewer-prompt');
    this.viewerTagsInput = document.getElementById('viewer-tags');
    this.viewerImageInput = document.getElementById('viewer-image-input');
    this.viewerSelectImageBtn = document.getElementById('btn-viewer-select-image');
    this.viewerRemoveImageBtn = document.getElementById('btn-viewer-remove-image');
    this.currentImageThumb = document.getElementById('current-image-thumb');
    this.viewerDeleteBtn = document.getElementById('btn-viewer-delete');

    // Close buttons
    this.modalCloseBtns = document.querySelectorAll('.modal-close');
    this.imageViewerCloseBtn = document.querySelector('.image-viewer-close');

    // State
    this.currentEditingId = null;
    this.currentViewerId = null;
    this.selectedImageFile = null;
    this.viewerSelectedImageFile = null;
    this.activeGenerations = new Map(); // promptId -> count

    this.bindEvents();

    // Subscribe to store updates to refresh button states
    this.storeUnsubscribe = store.subscribe(() => {
      if (this.currentEditingId) {
        this.updateGenerateButton(this.currentEditingId);
      }
    });
  }

  /**
   * Bind all event listeners
   */
  bindEvents() {
    // Prompt Modal - form submit
    this.promptForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePromptSubmit();
    });

    // Prompt Modal - image selection
    this.selectImageBtn.addEventListener('click', () => {
      this.imageInput.click();
    });
    this.imageInput.addEventListener('change', (e) => {
      this.handleImageSelect(e.target.files[0], this.previewThumb, this.imagePreview);
    });
    this.previewRemoveBtn.addEventListener('click', () => {
      this.clearSelectedImage();
    });
    this.removeImageBtn.addEventListener('click', () => {
      this.clearSelectedImage();
    });

    // Prompt Modal - generate image
    this.generateImageBtn.addEventListener('click', () => {
      this.handleGenerateImage();
    });

    // Prompt Modal - delete
    this.deleteBtn.addEventListener('click', () => {
      this.handleDelete(this.currentEditingId);
    });

    // Prompt Modal - cancel
    this.promptForm.querySelector('.modal-cancel').addEventListener('click', () => {
      this.closePromptModal();
    });

    // Image Viewer Modal - form submit
    this.viewerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleViewerSubmit();
    });

    // Image Viewer Modal - image selection
    this.viewerSelectImageBtn.addEventListener('click', () => {
      this.viewerImageInput.click();
    });
    this.viewerImageInput.addEventListener('change', (e) => {
      this.handleImageSelect(e.target.files[0], this.currentImageThumb, null, true);
    });
    this.viewerRemoveImageBtn.addEventListener('click', () => {
      this.clearViewerImage();
    });

    // Image Viewer Modal - delete
    this.viewerDeleteBtn.addEventListener('click', () => {
      this.handleDelete(this.currentViewerId);
    });

    // Image Viewer Modal - cancel
    this.viewerForm.querySelector('.editor-cancel').addEventListener('click', () => {
      this.closeImageViewer();
    });

    // Close buttons
    this.modalCloseBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllModals();
      });
    });
    this.imageViewerCloseBtn.addEventListener('click', () => {
      this.closeImageViewer();
    });

    // Overlay click to close
    this.promptModal.querySelector('.modal-overlay').addEventListener('click', () => {
      this.closePromptModal();
    });
    this.imageViewerModal.querySelector('.modal-overlay').addEventListener('click', () => {
      this.closeImageViewer();
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.promptModal.hidden) {
          this.closePromptModal();
        }
        if (!this.imageViewerModal.hidden) {
          this.closeImageViewer();
        }
      }
    });
  }

  /**
   * Open prompt modal for create/edit
   * @param {string|null} editingId - Prompt ID or null for new
   * @param {object|null} existingData - Pre-fill data for edit/create
   */
  openPromptModal(editingId = null, existingData = null) {
    this.closeImageViewer();
    this.currentEditingId = editingId;
    this.selectedImageFile = null;

    // Reset form
    this.promptForm.reset();
    this.clearSelectedImage();
    this.imagePreview.hidden = true;

    // Show/hide delete button
    if (editingId) {
      this.deleteBtn.hidden = false;
      this.promptForm.dataset.mode = 'edit';
      // Load prompt data
      this.loadPromptData(editingId);
    } else {
      this.deleteBtn.hidden = true;
      this.promptForm.dataset.mode = 'create';
      // Pre-fill from existing data (e.g., refactor)
      if (existingData) {
        this.titleInput.value = existingData.title || '';
        this.promptInput.value = existingData.prompt || '';
        this.tagsInput.value = (existingData.tags || []).join(', ');
      }
    }

    this.promptModal.hidden = false;
    this.promptModal.classList.add('is-visible');
    this.promptModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Focus first field
    if (editingId) {
      this.titleInput.focus();
      // Update generate button based on queue state
      this.updateGenerateButton(editingId);
    } else {
      this.promptInput.focus();
      this.generateImageBtn.textContent = '✨ Generate Image';
      this.generateImageBtn.disabled = false;
    }
  }

  /**
   * Load prompt data into form for editing
   * @param {string} id
   */
  async loadPromptData(id) {
    try {
      const prompt = await api.getPrompt(id);
      if (prompt) {
        this.titleInput.value = prompt.title || '';
        this.promptInput.value = prompt.prompt || '';
        this.tagsInput.value = (prompt.tags || []).join(', ');

        // If has image, show preview
        if (prompt.image) {
          this.previewThumb.src = `/images/${prompt.image}`;
          this.imagePreview.hidden = false;
          this.removeImageBtn.hidden = false;
        }
      }
    } catch (error) {
      showToast('Failed to load prompt data', 'error');
      this.closePromptModal();
    }
  }

  /**
   * Close prompt modal
   */
  closePromptModal() {
    this.promptModal.hidden = true;
    this.promptModal.classList.remove('is-visible');
    this.promptModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.currentEditingId = null;
    this.selectedImageFile = null;
  }

  /**
   * Open image viewer modal for card with image
   * @param {object} prompt - Prompt data
   */
  openImageViewer(prompt) {
    this.closePromptModal();
    this.currentViewerId = prompt.id;
    this.viewerSelectedImageFile = null;

    // Populate form
    this.viewerPromptIdInput.value = prompt.id;
    this.viewerTitleInput.value = prompt.title || '';
    this.viewerPromptInput.value = prompt.prompt || '';
    this.viewerTagsInput.value = (prompt.tags || []).join(', ');

    // Show current image
    if (prompt.image) {
      this.currentImageThumb.src = `/images/${prompt.image}`;
      this.viewerRemoveImageBtn.hidden = false;
    } else {
      this.currentImageThumb.src = '';
      this.viewerRemoveImageBtn.hidden = true;
    }

    // Large image in viewer
    const viewerImg = document.getElementById('viewer-image');
    if (prompt.image) {
      viewerImg.src = `/images/${prompt.image}`;
    }

    this.imageViewerModal.hidden = false;
    this.imageViewerModal.classList.add('is-visible');
    this.imageViewerModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close image viewer modal
   */
  closeImageViewer() {
    this.imageViewerModal.hidden = true;
    this.imageViewerModal.classList.remove('is-visible');
    this.imageViewerModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.currentViewerId = null;
    this.viewerSelectedImageFile = null;
  }

  /**
   * Close all modals
   */
  closeAllModals() {
    this.closePromptModal();
    this.closeImageViewer();
  }

  /**
   * Handle image file selection
   * @param {File} file
   * @param {HTMLImageElement} previewImg
   * @param {HTMLElement} previewContainer
   * @param {boolean} isViewer
   */
  handleImageSelect(file, previewImg, previewContainer, isViewer = false) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      if (previewContainer) {
        previewContainer.hidden = false;
      }

      if (isViewer) {
        this.viewerSelectedImageFile = file;
        this.viewerRemoveImageBtn.hidden = false;
      } else {
        this.selectedImageFile = file;
        this.removeImageBtn.hidden = false;
      }
    };
    reader.readAsDataURL(file);
  }

  /**
   * Clear selected image in prompt modal
   */
  clearSelectedImage() {
    this.selectedImageFile = null;
    this.previewThumb.src = '';
    this.imagePreview.hidden = true;
    this.imageInput.value = '';
    this.removeImageBtn.hidden = true;
  }

  /**
   * Clear selected image in viewer modal
   */
  clearViewerImage() {
    this.viewerSelectedImageFile = null;
    this.currentImageThumb.src = '';
    this.viewerImageInput.value = '';
    this.viewerRemoveImageBtn.hidden = true;
  }

  /**
   * Handle prompt modal form submit
   */
  async handlePromptSubmit() {
    const title = this.titleInput.value.trim() || this.generateAutoTitle(this.promptInput.value);
    const promptText = this.promptInput.value.trim();
    const tags = this.tagsInput.value
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (!promptText) {
      showToast('Prompt is required', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('prompt', promptText);
    formData.append('tags', JSON.stringify(tags));

    if (this.selectedImageFile) {
      formData.append('image', this.selectedImageFile);
    }

    try {
      if (this.currentEditingId) {
        // Update existing
        await api.updatePrompt(this.currentEditingId, formData);
        showToast('Prompt updated successfully', 'success');
      } else {
        // Create new
        await api.createPrompt(formData);
        showToast('Prompt created successfully', 'success');
      }

      store.batchUpdate({
        'ui.isLoading': false,
      });
      this.closePromptModal();
    } catch (error) {
      showToast(error.message || 'Failed to save prompt', 'error');
    }
  }

  /**
   * Handle image viewer modal form submit
   */
  async handleViewerSubmit() {
    const title = this.viewerTitleInput.value.trim() || this.generateAutoTitle(this.viewerPromptInput.value);
    const promptText = this.viewerPromptInput.value.trim();
    const tags = this.viewerTagsInput.value
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (!promptText) {
      showToast('Prompt is required', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('prompt', promptText);
    formData.append('tags', JSON.stringify(tags));

    if (this.viewerSelectedImageFile) {
      formData.append('image', this.viewerSelectedImageFile);
    }

    try {
      await api.updatePrompt(this.currentViewerId, formData);
      showToast('Prompt updated successfully', 'success');
      this.closeImageViewer();
    } catch (error) {
      showToast(error.message || 'Failed to save prompt', 'error');
    }
  }

  /**
   * Generate auto-title from prompt text
   * @param {string} promptText
   * @returns {string}
   */
  generateAutoTitle(promptText) {
    if (!promptText) return 'Untitled';
    const words = promptText.trim().split(/\s+/).slice(0, 8);
    return words.join(' ') + (promptText.split(/\s+/).length > 8 ? '...' : '');
  }

  /**
   * Handle image generation (with queue support)
   */
  async handleGenerateImage() {
    if (!this.promptInput.value.trim()) {
      showToast('Enter a prompt first', 'error');
      return;
    }

    const promptId = this.currentEditingId;

    // Check current queue state for this prompt
    const queueState = store.getState().generationQueue[promptId] || { count: 0, current: false };
    const isCurrentlyGenerating = queueState.current;

    if (isCurrentlyGenerating) {
      // Already generating, add to queue
      const newCount = queueState.count + 1;
      store.setField(`generationQueue.${promptId}.count`, newCount);
      showToast(`Added to queue (position ${newCount})`, 'success');
      this.updateGenerateButton(promptId);
      return;
    }

    // Start generation
    this.startGeneration(promptId);
  }

  /**
   * Start image generation for a prompt
   * @param {string} promptId
   */
  async startGeneration(promptId) {
    // Mark as generating
    store.setField(`generationQueue.${promptId}`, { current: true, count: 0 });
    this.updateGenerateButton(promptId);

    try {
      const result = await api.generateImage(promptId);
      if (result && result.image) {
        showToast('Image generated successfully', 'success');

        // Update the prompt in store to reflect new image
        const state = store.getState();
        const prompt = state.prompts.find(p => p.id === promptId);
        if (prompt) {
          // Update the card's image
          grid.updateCard(promptId, { ...prompt, image: result.image });
        }

        // If this modal is still open for this prompt, update preview
        if (this.currentEditingId === promptId) {
          this.previewThumb.src = `/images/${result.image}`;
          this.imagePreview.hidden = false;
          this.removeImageBtn.hidden = false;
        }

        // If image viewer modal is open for this prompt, update its image too
        if (this.currentViewerId === promptId) {
          const viewerImg = document.getElementById('viewer-image');
          if (viewerImg) {
            viewerImg.src = `/images/${result.image}`;
          }
          if (this.currentImageThumb) {
            this.currentImageThumb.src = `/images/${result.image}`;
          }
          if (this.viewerRemoveImageBtn) {
            this.viewerRemoveImageBtn.hidden = false;
          }
        }
      }
    } catch (error) {
      showToast(error.message || 'Failed to generate image', 'error');
    } finally {
      // Clear current generation
      const queueState = store.getState().generationQueue[promptId] || { count: 0, current: false };
      const remainingQueue = queueState.count;

      if (remainingQueue > 0) {
        // There are queued generations, start next one
        store.setField(`generationQueue.${promptId}.count`, remainingQueue - 1);
        store.setField(`generationQueue.${promptId}.current`, true);
        // Recursively start next (but don't await, let it chain)
        setTimeout(() => this.startGeneration(promptId), 0);
      } else {
        // No more queued, clear state
        const newQueue = { ...store.getState().generationQueue };
        delete newQueue[promptId];
        store.setField('generationQueue', newQueue);
      }

      this.updateGenerateButton(promptId);
    }
  }

  /**
   * Update generate button text based on queue state
   * @param {string} promptId
   */
  updateGenerateButton(promptId) {
    if (this.currentEditingId !== promptId) return; // Not this modal

    const queueState = store.getState().generationQueue[promptId];
    if (queueState && queueState.current) {
      const queueCount = queueState.count;
      this.generateImageBtn.textContent = queueCount > 0
        ? `➕ Add to Queue (+${queueCount} queued)`
        : 'Generating...';
      this.generateImageBtn.disabled = false; // Allow queuing more
    } else {
      this.generateImageBtn.textContent = '✨ Generate Image';
      this.generateImageBtn.disabled = false;
    }
  }

  /**
   * Handle delete prompt
   * @param {string} id
   */
  async handleDelete(id) {
    if (!confirm('Are you sure you want to delete this prompt?')) {
      return;
    }

    try {
      await api.deletePrompt(id);
      showToast('Prompt deleted', 'success');
      this.closeAllModals();
      // Store will be updated by grid refresh on next fetch
    } catch (error) {
      showToast(error.message || 'Failed to delete prompt', 'error');
    }
  }

  /**
   * Destroy modal manager and cleanup
   */
  destroy() {
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
    }
    this.closeAllModals();
  }
}

export default ModalManager;
