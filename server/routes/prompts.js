const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/connection');

console.log('[PromptsRouter] Router module loaded');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Workflow template cache for ComfyUI integration
let workflowTemplate = null;

function getWorkflowTemplate() {
  if (workflowTemplate) return workflowTemplate;

  try {
    const workflowPath = path.join(__dirname, '../../image_z_image_turbo-prompt.json');
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    workflowTemplate = JSON.parse(workflowContent);
    if (process.env.NODE_ENV === 'development') {
      console.log('[Workflow] Loaded ComfyUI workflow template');
    }
  } catch (error) {
    console.error('[Workflow] Failed to load ComfyUI workflow template:', error.message);
  }
  return workflowTemplate;
}

// Helper: Make HTTP request and return JSON
function httpRequest(url, method = 'GET', data = null, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {}
    };

    let body = null;
    if (data) {
      body = JSON.stringify(data);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = client.request(options, (res) => {
      let chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let result;
        try {
          result = JSON.parse(buffer.toString());
        } catch (e) {
          result = buffer.toString();
        }
        resolve({ status: res.statusCode, data: result });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout: ${url}`));
    });

    if (data) {
      req.write(body);
    }

    req.end();
  });
}

// Helper: Wait for ComfyUI generation to complete
async function waitForComfyUICompletion(promptId, baseUrl, timeout = 300000, pollInterval = 2000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const historyUrl = `${baseUrl}/history/${promptId}`;
    try {
      const { status, data } = await httpRequest(historyUrl, 'GET');

      if (status === 200 && data[promptId]) {
        const outputs = data[promptId].outputs || {};

        // Check SaveImage node (9) for images
        if (outputs['9'] && outputs['9'].images && outputs['9'].images.length > 0) {
          return outputs['9'].images.map(img => img.filename);
        }

        // Alternative: any node with images
        for (const nodeId in outputs) {
          if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
            return outputs[nodeId].images.map(img => img.filename);
          }
        }

        // Check for errors
        if (data[promptId].status && data[promptId].status.status_str === 'failed') {
          const errors = data[promptId].status.errors || [];
          throw new Error(errors.join(', ') || 'ComfyUI generation failed');
        }
      }
    } catch (error) {
      // Ignore errors and keep polling
      if (error.message.includes('Failed to fetch') || error.message.includes('timeout')) {
        // Continue polling
      } else {
        throw error;
      }
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Timeout waiting for ComfyUI generation');
}

// Helper to convert row to object
function rowToObject(row) {
  if (!row) return null;
  const obj = { ...row };
  if (obj.tags) {
    try {
      obj.tags = JSON.parse(obj.tags);
    } catch (e) {
      obj.tags = [];
    }
  }
  // Convert deleted_at to boolean isDeleted
  obj.isDeleted = obj.deleted_at !== null && obj.deleted_at !== undefined;
  // Remove negative_prompt - not needed
  delete obj.negative_prompt;
  return obj;
}

// GET /api/prompts - List all prompts with search, filter, pagination
router.get('/', (req, res, next) => {
  try {
    const db = getDatabase();
    const {
      search,
      tags,
      sort = 'newest',
      page = 1,
      limit = 20,
      include_deleted = false
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = 'SELECT * FROM prompts WHERE 1=1';
    const params = [];

    // Exclude deleted by default unless explicitly requested
    if (include_deleted !== 'true') {
      query += ' AND deleted_at IS NULL';
    }

    // Search in title, prompt, tags
    if (search) {
      query += ` AND (
        title LIKE ? OR
        prompt LIKE ? OR
        tags LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Filter by tags (comma-separated)
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      tagArray.forEach(tag => {
        query += ' AND tags LIKE ?';
        params.push(`%"${tag}"%`);
      });
    }

    // Sorting
    let orderBy = 'created_at DESC';
    if (sort === 'oldest') orderBy = 'created_at ASC';
    if (sort === 'most_used') orderBy = 'usage_count DESC';
    if (sort === 'title') orderBy = 'title ASC';
    if (sort === 'random') orderBy = 'RANDOM()';
    query += ` ORDER BY ${orderBy}`;

    // Count total
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countRow = db.prepare(countQuery).get(params);
    const total = countRow.total;

    // Pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    // Get results
    const prompts = db.prepare(query).all(params).map(rowToObject);

    const totalPages = Math.ceil(total / limit);
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Prompts] page=${page}, limit=${limit}, total=${total}, totalPages=${totalPages}, returned=${prompts.length}`);
    }

    res.json({ prompts, pagination });
  } catch (error) {
    next(error);
  }
});

// GET /api/prompts/random - Get random prompt
// MUST come BEFORE /:id route to avoid "random" being treated as an ID
router.get('/random', (req, res, next) => {
  try {
    const db = getDatabase();
    const { model_type, tags } = req.query;

    console.log('[Random] Query params:', { model_type, tags });

    let query = 'SELECT * FROM prompts WHERE deleted_at IS NULL';
    const params = [];

    if (model_type) {
      query += ' AND model_type = ?';
      params.push(model_type);
    }

    if (tags && tags !== '') {
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
      console.log('[Random] Tag array:', tagArray);
      tagArray.forEach(tag => {
        query += ' AND tags LIKE ?';
        params.push(`%"${tag}"%`);
      });
    } else {
      console.log('[Random] No tags filter applied');
    }

    query += ' ORDER BY RANDOM() LIMIT 1';

    console.log('[Random] Final SQL:', query);
    console.log('[Random] Params:', params);

    const stmt = db.prepare(query);
    const row = stmt.get(...params);

    console.log('[Random] Row result:', row ? row.id : 'NULL');

    if (!row) {
      return res.status(404).json({ error: 'No prompts found matching criteria' });
    }

    res.json(rowToObject(row));
  } catch (error) {
    console.error('[Random] Error:', error);
    next(error);
  }
});

// GET /api/prompts/:id - Get single prompt
router.get('/:id', (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const stmt = db.prepare('SELECT * FROM prompts WHERE id = ?');
    const row = stmt.get(id);

    if (!row) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json(rowToObject(row));
  } catch (error) {
    next(error);
  }
});

// POST /api/prompts - Create new prompt
router.post('/', (req, res, next) => {
  try {
    const db = getDatabase();
    const {
      title,
      prompt,
      tags = [],
      model_type = 'Other',
      description = '',
      image = null
    } = req.body;

    // Validate early before using prompt
    if (!title || !prompt) {
      return res.status(400).json({ error: 'Title and prompt are required' });
    }

    console.log('[CreatePrompt] Received:', { title, prompt: prompt.substring(0, 50) + '...', tags, model_type });

    const tagsStr = JSON.stringify(Array.isArray(tags) ? tags : []);
    const now = new Date().toISOString();

    try {
      const stmt = db.prepare(`
        INSERT INTO prompts (title, prompt, tags, model_type, description, image, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(title, prompt, tagsStr, model_type, description, image, now, now);
      console.log('[CreatePrompt] Run result:', result);

      // Get the inserted ID using last_insert_rowid() for reliability
      const idResult = db.prepare('SELECT last_insert_rowid() as id').get();
      const id = idResult.id;

      if (!id) {
        throw new Error('Failed to get inserted row ID');
      }

      console.log(`[CreatePrompt] Inserted row with id=${id}, changes=${result.changes}`);

      const responseObj = {
        id,
        title,
        prompt,
        tags: JSON.parse(tagsStr),
        model_type,
        description,
        image,
        created_at: now,
        updated_at: now,
        usage_count: 0,
        isDeleted: false
      };
      console.log('[CreatePrompt] Responding with:', responseObj);
      res.status(201).json(responseObj);
    } catch (insertError) {
      console.error('[CreatePrompt] Insert failed:', insertError);
      throw insertError;
    }
  } catch (error) {
    console.error('[CreatePrompt] Error:', error);
    next(error);
  }
});

// PUT /api/prompts/:id - Update prompt
router.put('/:id', (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const {
      title,
      prompt,
      tags,
      model_type,
      description,
      image
    } = req.body;

    // Check if prompt exists
    const checkStmt = db.prepare('SELECT * FROM prompts WHERE id = ?');
    const existing = checkStmt.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const tagsStr = tags ? JSON.stringify(Array.isArray(tags) ? tags : []) : existing.tags;
    const now = new Date().toISOString();

    // If image is being removed (explicitly set to null/empty), delete the old file
    const IMAGES_DIR = path.join(__dirname, '../../images');
    if ((image === null || image === '') && existing.image) {
      try {
        const oldImagePath = path.join(IMAGES_DIR, existing.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log(`[UpdatePrompt] Deleted old image: ${existing.image}`);
        }
      } catch (fileError) {
        console.error(`[UpdatePrompt] Failed to delete old image ${existing.image}:`, fileError);
        // Continue with update even if file deletion fails
      }
    }

    const stmt = db.prepare(`
      UPDATE prompts
      SET title = ?, prompt = ?, tags = ?,
          model_type = ?, description = ?, image = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      title || existing.title,
      prompt || existing.prompt,
      tagsStr,
      model_type || existing.model_type,
      description !== undefined ? description : existing.description,
      image !== undefined ? image : (existing.image || null),
      now,
      id
    );

    // Get updated prompt
    const updatedStmt = db.prepare('SELECT * FROM prompts WHERE id = ?');
    const updated = rowToObject(updatedStmt.get(id));

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/prompts/:id/increment-usage - Increment usage count
router.patch('/:id/increment-usage', (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const stmt = db.prepare('UPDATE prompts SET usage_count = usage_count + 1 WHERE id = ?');
    stmt.run(id);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/prompts/:id - Soft delete prompt
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE prompts SET deleted_at = ? WHERE id = ?');
    stmt.run(now, id);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/prompts/:id/duplicate - Duplicate prompt
router.post('/:id/duplicate', (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Get original prompt
    const selectStmt = db.prepare('SELECT * FROM prompts WHERE id = ?');
    const original = selectStmt.get(id);

    if (!original) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const now = new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT INTO prompts (title, prompt, tags, model_type, description, image, created_at, updated_at, usage_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    insertStmt.run(
      `Copy of ${original.title}`,
      original.prompt,
      original.tags,
      original.model_type,
      original.description,
      null, // Don't copy image - user can generate a fresh one
      now,
      now
    );
    const newId = insertStmt.lastInsertRowid;

    // Get the new prompt
    const newStmt = db.prepare('SELECT * FROM prompts WHERE id = ?');
    const newPrompt = rowToObject(newStmt.get(newId));

    res.status(201).json(newPrompt);
  } catch (error) {
    next(error);
  }
});

// POST /api/prompts/bulk-delete - Delete multiple prompts
router.post('/bulk-delete', (req, res, next) => {
  try {
    const db = getDatabase();
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`UPDATE prompts SET deleted_at = ? WHERE id IN (${placeholders})`);
    stmt.run(now, ...ids);

    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    next(error);
  }
});

// POST /api/prompts/:id/generate-image - Generate image for prompt using ComfyUI
router.post('/:id/generate-image', async (req, res, next) => {
  const promptId = req.params.id;
  const db = getDatabase();

  // Check if prompt exists
  const checkStmt = db.prepare('SELECT * FROM prompts WHERE id = ? AND deleted_at IS NULL');
  const prompt = checkStmt.get(promptId);

  console.log(`[GenerateImage] Received promptId=${promptId}, query result:`, prompt ? { id: prompt.id, deleted_at: prompt.deleted_at } : 'NOT FOUND');

  if (!prompt) {
    return res.status(404).json({ error: 'Prompt not found or is deleted' });
  }

  const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:11820';
  const IMAGES_DIR = path.join(__dirname, '../../images');

  try {
    // Ensure images directory exists
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }

    // Load workflow template (cached)
    const template = getWorkflowTemplate();
    if (!template) {
      return res.status(500).json({
        success: false,
        error: 'ComfyUI workflow template not available. Check server logs.'
      });
    }
    // Deep clone to avoid mutating the cached template
    const workflow = JSON.parse(JSON.stringify(template));

    // Update prompt text (node 67) and randomize seed
    workflow['67']['inputs']['text'] = prompt.prompt;
    workflow['69']['inputs']['seed'] = Math.floor(Math.random() * 999999999999999);

    // Queue the prompt to ComfyUI
    const queueUrl = `${COMFYUI_URL}/prompt`;
    const { status: queueStatus, data: queueData } = await httpRequest(queueUrl, 'POST', { prompt: workflow });

    if (queueStatus !== 200) {
      throw new Error(`ComfyUI queue failed: ${queueStatus} - ${JSON.stringify(queueData)}`);
    }

    const comfyPromptId = queueData.prompt_id;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[GenerateImage] Queued prompt ${promptId}, ComfyUI ID: ${comfyPromptId}`);
    }

    // Poll for completion
    const outputFilenames = await waitForComfyUICompletion(comfyPromptId, COMFYUI_URL, 300000, 2000);
    const remoteFilename = outputFilenames[0];

    // Download the image
    const ext = path.extname(remoteFilename);
    const localFilename = `img-${promptId}-${Date.now()}${ext}`;
    const localPath = path.join(IMAGES_DIR, localFilename);

    const viewUrl = `${COMFYUI_URL}/view?filename=${encodeURIComponent(remoteFilename)}`;
    await downloadImage(viewUrl, localPath);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[GenerateImage] Saved image: ${localFilename}`);
    }

    // Update database with image filename
    const now = new Date().toISOString();
    const updateStmt = db.prepare('UPDATE prompts SET image = ?, updated_at = ? WHERE id = ?');
    updateStmt.run(localFilename, now, promptId);

    res.json({
      success: true,
      image: localFilename,
      message: 'Image generated successfully'
    });
  } catch (error) {
    console.error(`[GenerateImage] Error for prompt ${promptId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate image'
    });
  }
});

// Helper: Download binary image file
async function downloadImage(url, destination) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.get(url, (response) => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        fs.writeFile(destination, buffer, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Download timeout: ${url}`));
    });
  });
}

module.exports = router;
