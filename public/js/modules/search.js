/**
 * Search Module - Debounced search input with clear functionality
 */

import { store } from './store.js';
import { debounce } from '../utils.js';

/**
 * Search class manages search input and debounced updates
 */
export class Search {
  constructor(input, clearBtn, options = {}) {
    this.input = input;
    this.clearBtn = clearBtn;
    this.onSearch = options.onSearch || (() => {});

    this.debouncedSearch = debounce(this.handleSearch.bind(this), 300);

    this.setupEventListeners();
    this.updateClearButton();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.input.addEventListener('input', () => {
      this.debouncedSearch();
      this.updateClearButton();
    });

    this.clearBtn.addEventListener('click', () => {
      this.clear();
    });

    // Focus with keyboard shortcut (handled in main.js)
    this.input.addEventListener('keydown', (e) => {
      // Allow main.js to handle global shortcuts
    });
  }

  /**
   * Handle debounced search
   */
  handleSearch() {
    const query = this.input.value.trim();
    store.setField('filters.search', query);
    this.onSearch(query);
  }

  /**
   * Update clear button visibility
   */
  updateClearButton() {
    if (this.input.value.length > 0) {
      this.clearBtn.classList.add('visible');
    } else {
      this.clearBtn.classList.remove('visible');
    }
  }

  /**
   * Clear search input
   */
  clear() {
    this.input.value = '';
    this.updateClearButton();
    this.input.focus();
    store.setField('filters.search', '');
    this.onSearch('');
  }

  /**
   * Get current search value
   * @returns {string}
   */
  getValue() {
    return this.input.value.trim();
  }

  /**
   * Set search value programmatically
   * @param {string} value
   */
  setValue(value) {
    this.input.value = value;
    this.updateClearButton();
    this.handleSearch();
  }

  /**
   * Focus the search input
   */
  focus() {
    this.input.focus();
  }

  /**
   * Destroy search and cleanup listeners
   */
  destroy() {
    // Remove event listeners if needed
    this.input.value = '';
  }
}

export default Search;
