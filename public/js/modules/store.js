/**
 * State Store - Centralized application state with pub/sub
 */

// Initial state structure
const initialState = {
  prompts: [],
  tags: [],
  pagination: {
    page: 1,
    limit: 30,
    total: 0,
    totalPages: 0,
    hasMore: true,
    isLoading: false,
  },
  filters: {
    search: '',
    selectedTags: new Set(),
    sort: 'newest',
    includeDeleted: false,
  },
  ui: {
    isLoading: false,
    editingId: null,
    activeModal: null,
    theme: 'light',
  },
  // Track image generation per prompt: { [promptId]: { count: number, current: boolean } }
  generationQueue: {},
};

class Store {
  constructor() {
    this.state = this.deepClone(initialState);
    this.subscribers = [];
  }

  /**
   * Get current state (readonly copy)
   * @returns {object} State snapshot
   */
  getState() {
    return this.deepClone(this.state);
  }

  /**
   * Update state and notify subscribers
   * @param {object} partial - Partial state to merge
   * @param {string} path - Dot notation path (e.g., 'filters.search')
   */
  setState(partial, path = '') {
    if (path) {
      // Update nested property
      const keys = path.split('.');
      let target = this.state;
      for (let i = 0; i < keys.length - 1; i++) {
        target = target[keys[i]];
      }
      const lastKey = keys[keys.length - 1];
      if (partial instanceof Set) {
        target[lastKey] = new Set(partial);
      } else {
        target[lastKey] = partial;
      }
    } else {
      // Merge top-level
      this.state = { ...this.state, ...partial };
    }

    this.notify();
  }

  /**
   * Update a single field
   * @param {string} path - Dot notation path
   * @param {any} value - New value
   */
  setField(path, value) {
    const keys = path.split('.');
    const newState = { ...this.state };
    let target = newState;

    for (let i = 0; i < keys.length - 1; i++) {
      target[keys[i]] = { ...target[keys[i]] };
      target = target[keys[i]];
    }

    target[keys[keys.length - 1]] = value;
    this.state = newState;
    this.notify();
  }

  /**
   * Batch update multiple fields
   * @param {object} updates - Object with paths as keys
   */
  batchUpdate(updates) {
    const newState = this.deepClone(this.state);
    Object.entries(updates).forEach(([path, value]) => {
      const keys = path.split('.');
      let target = newState;
      for (let i = 0; i < keys.length - 1; i++) {
        target = target[keys[i]];
      }
      target[keys[keys.length - 1]] = value;
    });
    this.state = newState;
    this.notify();
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Called on each change with new state
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all subscribers
   */
  notify() {
    const snapshot = this.deepClone(this.state);
    this.subscribers.forEach(cb => cb(snapshot));
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.state = this.deepClone(initialState);
    this.notify();
  }

  /**
   * Deep clone helper
   * @param {any} obj - Object to clone
   * @returns {any} Deep clone
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Set) return new Set([...obj]);
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));

    const cloned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

// Singleton instance
export const store = new Store();

// Selector helpers (memoization not needed for this scale)
export const selectors = {
  getAllPrompts: (state) => state.prompts,
  getTags: (state) => state.tags,
  getPagination: (state) => state.pagination,
  getFilters: (state) => state.filters,
  getTheme: (state) => state.ui.theme,
  isLoading: (state) => state.ui.isLoading || state.pagination.isLoading,
};

export default store;
