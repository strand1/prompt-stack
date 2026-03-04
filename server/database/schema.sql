-- Create prompts table
CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  tags TEXT, -- JSON array as string
  model_type TEXT DEFAULT 'SDXL', -- SDXL, Flux, DALL-E, Midjourney, etc.
  description TEXT,
  image TEXT, -- Filename of associated image (relative to /images or /uploads)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  usage_count INTEGER DEFAULT 0,
  deleted_at DATETIME -- NULL = active, timestamp = soft deleted
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_prompts_deleted ON prompts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_prompts_model_type ON prompts(model_type);
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at);
