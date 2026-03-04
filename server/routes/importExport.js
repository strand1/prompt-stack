const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/connection');

// GET /api/export - Export all prompts as JSON
router.get('/export', (req, res, next) => {
  try {
    const db = getDatabase();
    const { include_deleted = false } = req.query;

    let query = 'SELECT * FROM prompts';
    if (include_deleted !== 'true') {
      query += ' WHERE deleted_at IS NULL';
    }

    const rows = db.prepare(query).all();
    const prompts = [];

    rows.forEach(row => {
      if (row.tags) {
        try {
          row.tags = JSON.parse(row.tags);
        } catch (e) {
          row.tags = [];
        }
      }
      delete row.deleted_at; // Don't export deleted flag
      delete row.isDeleted;
      delete row.negative_prompt; // Not used
      prompts.push(row);
    });

    res.json(prompts);
  } catch (error) {
    next(error);
  }
});

// POST /api/import - Import prompts from JSON
router.post('/import', (req, res, next) => {
  try {
    const db = getDatabase();
    const { prompts } = req.body;

    if (!Array.isArray(prompts)) {
      return res.status(400).json({ error: 'prompts must be an array' });
    }

    let imported = 0;
    const now = new Date().toISOString();

    prompts.forEach(prompt => {
      if (!prompt.title || !prompt.prompt) {
        return; // Skip invalid prompts
      }

      const tagsStr = Array.isArray(prompt.tags)
        ? JSON.stringify(prompt.tags)
        : JSON.stringify([]);

      const stmt = db.prepare(`
        INSERT INTO prompts (title, prompt, tags, model_type, description, image, created_at, updated_at, usage_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        prompt.title,
        prompt.prompt,
        tagsStr,
        prompt.model_type || 'Other',
        prompt.description || '',
        prompt.image || null,
        prompt.created_at || now,
        prompt.updated_at || now,
        prompt.usage_count || 0
      );
      imported++;
    });


    res.json({ success: true, imported });
  } catch (error) {
    next(error);
  }
});

// POST /api/cleanup - Permanently delete ALL soft-deleted prompts
router.post('/cleanup', (req, res, next) => {
  try {
    const db = getDatabase();
    // Delete all prompts that have been soft-deleted (deleted_at IS NOT NULL)
    const stmt = db.prepare('DELETE FROM prompts WHERE deleted_at IS NOT NULL');
    stmt.run();
    const deleted = stmt.changes;

    res.json({ success: true, deleted });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
