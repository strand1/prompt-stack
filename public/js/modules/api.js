/**
 * API Client - RESTful communication with backend
 */

const API_BASE = '/api';

export const api = {
  /**
   * Generic fetch wrapper
   * @param {string} endpoint - API endpoint
   * @param {object} options - fetch options
   * @returns {Promise<any>} Response data
   */
  async fetch(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
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

    // 204 No Content returns empty response
    if (response.status === 204) return null;

    return response.json();
  },

  // ======================
  // Prompts
  // ======================

  /**
   * Fetch prompts with filters
   * @param {object} params - Query parameters
   * @returns {Promise<{prompts: array, total: number, page: number, totalPages: number}>}
   */
  async getPrompts(params = {}) {
    // Add cache buster to prevent caching
    params._t = Date.now();
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '').map(([k, v]) => [k, v])
    ).toString();
    return this.fetch(`/prompts${query ? `?${query}` : ''}`);
  },

  async createPrompt(data) {
    return this.fetch('/prompts', {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  },

  async updatePrompt(id, data) {
    return this.fetch(`/prompts/${id}`, {
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data),
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

  async getRandomPrompt(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '').map(([k, v]) => [k, v])
    ).toString();
    return this.fetch(`/prompts/random${query ? `?${query}` : ''}`);
  },

  /**
   * Get single prompt by ID
   * @param {string|number} id
   * @returns {Promise<object>} Prompt object
   */
  async getPrompt(id) {
    return this.fetch(`/prompts/${id}`);
  },

  async generateImage(id) {
    return this.fetch(`/prompts/${id}/generate-image`, { method: 'POST' });
  },

  // ======================
  // Tags
  // ======================

  async getTags(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '').map(([k, v]) => [k, v])
    ).toString();
    return this.fetch(`/tags${query ? `?${query}` : ''}`);
  },

  // ======================
  // Import/Export
  // ======================

  async exportPrompts() {
    return this.fetch('/export');
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

  // ======================
  // Upload
  // ======================

  async uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }
};

export default api;
