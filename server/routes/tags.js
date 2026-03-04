const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/connection');

// GET /api/tags - List all tags with usage counts
router.get('/', (req, res, next) => {
  try {
    const db = getDatabase();
    const { include_deleted = false } = req.query;

    let query = `
      SELECT tags FROM prompts
      WHERE deleted_at IS NULL
    `;

    if (include_deleted === 'true') {
      query = `SELECT tags FROM prompts`;
    }

    const rows = db.prepare(query).all();
    const tagCounts = {};

    rows.forEach(row => {
      if (row.tags) {
        try {
          const tags = JSON.parse(row.tags);
          tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        } catch (e) {
          // Skip invalid JSON
        }
      }
    });

    // Convert to array sorted by count
    const tagsArray = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json(tagsArray);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
