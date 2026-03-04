/**
 * Grid Manager - Handles card rendering and infinite scroll
 */

import { createCard, updateCardData } from './card.js';

/**
 * Grid class manages the prompts grid container
 */
export class Grid {
  constructor(container, options = {}) {
    this.container = container;
    this.onLoadMore = options.onLoadMore || (() => {});
    this.onCardClick = options.onCardClick || (() => {});
    this.onCopy = options.onCopy || (() => {});
    this.onRefactor = options.onRefactor || (() => {});
    this.onEdit = options.onEdit || (() => {});
    this.onDelete = options.onDelete || (() => {});

    this.visibleCards = new Map(); // id -> element
    this.observer = null;

    this.setupIntersectionObserver();
  }

  /**
   * Setup IntersectionObserver for infinite scroll
   */
  setupIntersectionObserver() {
    const sentinel = document.getElementById('scroll-sentinel');
    if (!sentinel) {
      console.warn('[Grid] Sentinel not found');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        console.log('[IntersectionObserver] entries:', entries);
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            console.log('[IntersectionObserver] sentinel intersecting - trigger loadMore');
            this.triggerLoadMore();
          }
        });
      },
      {
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    this.observer.observe(sentinel);
    console.log('[Grid] Observer set up on sentinel');
  }

  /**
   * Trigger load more callback (debounced externally)
   */
  triggerLoadMore() {
    this.onLoadMore();
  }

  /**
   * Clear all cards from grid
   */
  clear() {
    this.container.innerHTML = '';
    this.visibleCards.clear();
  }

  /**
   * Append new cards to grid
   * @param {Array} prompts - Prompt data objects
   */
  appendCards(prompts) {
    const fragment = document.createDocumentFragment();

    prompts.forEach(prompt => {
      if (this.visibleCards.has(prompt.id)) return; // Skip duplicates

      const card = createCard(
        prompt,
        this.onCopy.bind(this, prompt),
        this.onRefactor.bind(this, prompt),
        this.onCardClick.bind(this, prompt),
        this.onEdit.bind(this, prompt),
        this.onDelete.bind(this, prompt)
      );

      this.visibleCards.set(prompt.id, card);
      fragment.appendChild(card);
    });

    this.container.appendChild(fragment);
  }

  /**
   * Replace all cards with new set
   * @param {Array} prompts - Prompt data objects
   */
  setCards(prompts) {
    this.clear();
    this.appendCards(prompts);
  }

  /**
   * Update a single card's data
   * @param {string} id - Prompt ID
   * @param {object} prompt - Updated prompt data
   */
  updateCard(id, prompt) {
    const card = this.visibleCards.get(id);
    if (card) {
      // Replace entire card to reflect all changes (image, text, etc.)
      const newCard = createCard(
        prompt,
        this.onCopy.bind(this, prompt),
        this.onRefactor.bind(this, prompt),
        this.onCardClick.bind(this, prompt),
        this.onEdit.bind(this, prompt),
        this.onDelete.bind(this, prompt)
      );
      card.replaceWith(newCard);
      this.visibleCards.set(id, newCard);
    }
  }

  /**
   * Remove a card from grid
   * @param {string} id - Prompt ID
   */
  removeCard(id) {
    const card = this.visibleCards.get(id);
    if (card) {
      card.remove();
      this.visibleCards.delete(id);
    }
  }

  /**
   * Show/hide loading state
   * @param {boolean} isLoading
   */
  setLoading(isLoading) {
    const loadingEl = document.getElementById('loading-more');
    if (loadingEl) {
      loadingEl.hidden = !isLoading;
    }
  }

  /**
   * Show/hide empty state
   * @param {boolean} isEmpty
   */
  setEmpty(isEmpty) {
    const emptyEl = document.getElementById('empty-state');
    if (emptyEl) {
      emptyEl.hidden = !isEmpty;
    }
  }

  /**
   * Show/hide initial loading state
   * @param {boolean} isLoading
   */
  setInitialLoading(isLoading) {
    const loadingEl = document.getElementById('loading-initial');
    if (loadingEl) {
      loadingEl.hidden = !isLoading;
    }
  }

  /**
   * Destroy grid and cleanup observers
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.clear();
  }
}

export default Grid;
