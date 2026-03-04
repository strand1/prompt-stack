require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database/connection');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const promptsRouter = require('./routes/prompts');
const tagsRouter = require('./routes/tags');
const importExportRouter = require('./routes/importExport');
const uploadRouter = require('./routes/upload');

// Cleanup old deleted prompts function
function scheduleCleanup() {
  const interval = 24 * 60 * 60 * 1000; // Every 24 hours

  setInterval(async () => {
    try {
      const { getDatabase } = require('./database/connection');
      const db = getDatabase();
      const days = parseInt(process.env.CLEANUP_DAYS) || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoff = cutoffDate.toISOString();

      const stmt = db.prepare('DELETE FROM prompts WHERE deleted_at IS NOT NULL AND deleted_at < ?');
      stmt.run(cutoff);
      const deleted = stmt.changes;

      if (deleted > 0) {
        console.log(`[Cleanup] Removed ${deleted} old deleted prompts`);
      }
    } catch (error) {
      console.error('[Cleanup] Error:', error.message);
    }
  }, interval);

  console.log('[Cleanup] Scheduled daily cleanup of deleted prompts older than 30 days');
}

const app = express();
const PORT = process.env.PORT || 11800;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase JSON body limit

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve images and uploads
app.use('/images', express.static(path.join(__dirname, '../images')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/prompts', promptsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api', importExportRouter); // /api/export, /api/import, /api/cleanup
app.use('/api/upload', uploadRouter);

// Error handler
app.use(errorHandler);

// Start server
async function start() {
  try {
    await initDatabase();
    console.log('Database initialized');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      scheduleCleanup();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
