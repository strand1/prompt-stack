/**
 * Tag Cloud Module - Displays and filters by tags
 */

import { store } from './store.js';
import { escapeHtml } from '../utils.js';

/**
 * Tag Cloud class manages tag display and filtering
 */
export class TagCloud {
  constructor(container, options = {}) {
    this.container = container;
    this.onTagToggle = options.onTagToggle || (() => {});

    // Subscribe to store updates
    this.unsubscribe = store.subscribe(() => {
      this.render();
    });
  }

  /**
   * Render tag cloud from store state
   */
  render() {
    const state = store.getState();
    const tags = state.tags;
    const selectedTags = state.filters.selectedTags;

    this.container.innerHTML = '';

    tags.forEach(tag => {
      const tagEl = document.createElement('button');
      tagEl.className = 'tag';
      if (selectedTags.has(tag.name)) {
        tagEl.classList.add('active');
      }

      // Display: "Name (count)"
      tagEl.textContent = `${escapeHtml(tag.name)} (${tag.count})`;
      tagEl.dataset.tagName = tag.name;
      tagEl.type = 'button';
      tagEl.setAttribute('aria-pressed', selectedTags.has(tag.name));

      tagEl.addEventListener('click', () => {
        this.onTagToggle(tag.name);
      });

      this.container.appendChild(tagEl);
    });
  }

  /**
   * Destroy tag cloud and cleanup subscription
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.container.innerHTML = '';
  }
}

export default TagCloud;
