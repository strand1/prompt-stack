# Prompt Stack

A lightweight, modern image generation prompt management tool. Store, organize, search, and reuse your AI image generation prompts with a clean, intuitive interface.

---

## ✨ Features

- **Simple & Focused** - Just prompts and tags. No unnecessary fields.
- **Full-text Search** - Search through prompt text and tags instantly.
- **Tag Organization** - Add custom tags to categorize your prompts.
- **One-Click Copy** - Copy any prompt to clipboard with a single click.
- **Random Shuffle** - Instantly shuffle the order of displayed prompts to discover new combinations.
- **Infinite Scroll** - Smooth lazy loading - all prompts on one page, no pagination.
- **Bulk Operations** - Select, delete, and manage multiple prompts.
- **Import/Export** - Backup your prompts as JSON or import from another instance.
- **Soft Delete** - Safely delete prompts with 30-day cleanup cycle.
- **Auto-Generated Titles** - Titles auto-fill from prompt text (editable).
- **Refactor Mode** - Duplicate a prompt and immediately start editing.
- **Responsive Design** - Works on desktop and mobile.
- **Keyboard Shortcuts** - Navigate efficiently with keyboard shortcuts.
- **Image Cards** - Attach images to prompts and display them as beautiful cards with hover overlays.
- **Dark Mode** - Toggle between light and dark themes (persisted automatically). Search bar glows black in night mode.
- **Usage Tracking** - Automatically tracks how many times each prompt is used.
- **Image Upload** - Upload and attach images directly from the create/edit modal.
- **AI Image Generation** - Generate images directly from prompts using ComfyUI integration (requires external ComfyUI server).
  - Uses **8 diffusion steps** for higher quality output
  - Random seed generated for each image to ensure variety
  - **Auto-save before generation** - Generate works immediately on new or refactored prompts
  - Queue multiple generations (no need to wait for previous to finish)
  - Remove images with auto-save to enable immediate generation

---

## 🚀 Quick Start

### Prerequisites

- Node.js 12+ (tested on 12.22.9)
- npm

### Installation

```bash
# Clone or extract the project
cd prompt-stack

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at: **http://localhost:11800**

---

## 📖 Usage

### Creating a Prompt

1. Click **"+ New Prompt"** button
2. Enter your prompt text in the "Prompt" field
   - The title auto-fills from the first 60 characters (editable)
3. Optionally add tags (comma-separated)
4. Click **Save**

### Managing Prompts

| Action | How to |
|--------|--------|
| **Copy to clipboard** | Click 📋 on any card (provides visual feedback on success) |
| **Edit** | Click ↔️ on any card (or click the card itself) |
| **Refactor / Duplicate** | Click ✏️ to copy and immediately edit |
| **Delete** | Click 🗑️ on any card (with confirmation) |

**Note:** The copy feature uses the modern Clipboard API with fallback support for all browsers and contexts.

### Searching & Filtering

- **Search box**: Type to search prompt text and tags (real-time)
- **Tag cloud**: Click any tag to filter by that tag
- **Sort**: Newest, Oldest, or Most Used
- **Include deleted**: Checkbox to show soft-deleted prompts

### Import & Export

- **Export**: Downloads all prompts as JSON
- **Import**: Upload a JSON file to add prompts (skips duplicates)
- **Cleanup**: Permanently delete prompts marked as deleted >30 days ago

### AI Image Generation

The app can generate images using a ComfyUI server:

1. **Set up ComfyUI**: Run a ComfyUI instance (default: `http://127.0.0.1:11820`)
2. **Configure the URL**: Set `COMFYUI_URL` environment variable if not using default
3. **Prepare the workflow**: The app uses `image_z_image_turbo-prompt.json` workflow template
   - Node 67: Prompt text input (auto-populated from your prompt)
   - Node 69: KSampler with **8 diffusion steps** (auto-random seed)
4. **Generate**: Click the "✨ Generate Image" button in any prompt modal
   - **New prompts**: Auto-saves first, then generates
   - **Existing prompts**: Generates immediately
   - The workflow is sent to ComfyUI
   - App polls for completion (up to 5 minutes)
   - Generated image downloads and attaches to the prompt
   - Image appears as a background card in the grid
   - **Multiple generations**: You can queue multiple prompts; they generate concurrently

**Smart features**:
- **Refactor clears image**: When you duplicate/refactor a prompt, the image is NOT copied, so you can generate a fresh variation immediately
- **Remove & regenerate**: Click "Remove Image" to delete the current image (auto-saves), then generate a new one right away
- **Auto-save before generate**: Works on unsaved prompts - no manual save needed

**Requirements**:
- ComfyUI must be running and accessible
- Workflow file must exist at `server/image_z_image_turbo-prompt.json`
- The workflow should use standard ComfyUI node IDs as expected by the code

### Random Shuffle

Click the **🎲 Random** button to instantly shuffle the order of all currently displayed prompts. This helps you discover prompts in a new context and see your collection from a different perspective. The shuffle respects all current filters (search, tags, sort). Cards snap into their new positions with a smooth layout.

### Infinite Scroll

Instead of pagination, the app uses lazy loading - prompts load automatically as you scroll down. This gives you a seamless, single-page experience with all your prompts visible in one continuous grid. The app fetches 30 prompts per batch and continues loading until all are displayed.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | Create new prompt |
| `/` | Focus search box |
| `Esc` | Close modal |

---

## 🗄️ Data Model

Each prompt stores:
- `title` - Auto-generated from prompt (editable)
- `prompt` - The actual prompt text
- `tags` - Array of tag strings for organization
- `image` - Filename of associated image (uploaded or generated, stored in `/images` directory)
- `usage_count` - How many times the prompt has been used (copy, edit, refactor)
- `created_at` / `updated_at` - Timestamps
- `deleted_at` - Null if not deleted (soft delete)

**Notes:**
- `model_type` is no longer used (set to "Other" automatically)
- `description` field is deprecated

## 🖼️ Image Cards

Prompts with attached images are displayed as **cards with image backgrounds**:

- Image fills the card with a 16:9 aspect ratio (similar to video thumbnails)
- Title is hidden to emphasize the visual
- On hover: the prompt text appears as a semi-transparent overlay at the bottom
- Tags and metadata appear as overlays with blur effects
- Click anywhere on the card to open the full edit modal

Image cards work best with 1280x720 or similar 16:9 ratio images. The images are automatically resized and cropped to fit using `object-fit: cover`.

## 🌓 Dark Mode

Toggle dark mode with the 🌙/☀️ button in the header. Your preference is saved to localStorage and persists across sessions. On first visit, the app respects your system's color scheme preference.

## 📊 Usage Tracking

The usage count (shown as "X uses" on each card) automatically increments when you:

- Copy a prompt (📋)
- Click a card to open it
- Click the edit button (↔️)
- Click the refactor button (✏️)

This helps you identify your most-used prompts at a glance.

---

## 🔌 API Endpoints

All endpoints under `/api/`

### Prompts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/prompts` | List prompts (search, filter, paginate) |
| `GET` | `/api/prompts/:id` | Get single prompt |
| `POST` | `/api/prompts` | Create prompt |
| `PUT` | `/api/prompts/:id` | Update prompt |
| `DELETE` | `/api/prompts/:id` | Soft delete |
| `PATCH` | `/api/prompts/:id/increment-usage` | Increment usage count |
| `POST` | `/api/prompts/:id/duplicate` | Duplicate prompt |
| `POST` | `/api/prompts/bulk-delete` | Bulk delete (body: `{ids: []}`) |
| `GET` | `/api/prompts/random` | Get random prompt |
| `POST` | `/api/prompts/:id/generate-image` | Generate image using ComfyUI (requires `COMFYUI_URL` env var) |

**Query parameters for `/api/prompts`:**
- `search` - Text search across prompt and tags
- `page` - Page number (default: 1) - used by frontend for infinite scroll
- `limit` - Items per page (default: 20) - frontend uses 30 for batch loading
- `sort` - `newest` (default), `oldest`, `most_used`
- `include_deleted` - `true` or `false` (default)
- `tags` - Comma-separated tag filter

**Note on Pagination**: The frontend UI uses infinite scroll (auto-loading) instead of traditional pagination buttons, but the backend pagination parameters remain for API compatibility and to enable lazy loading.

### Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tags` | List all tags with usage counts |

### Import/Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/export` | Export all prompts as JSON |
| `POST` | `/api/import` | Import prompts (body: `{prompts: []}`) |
| `POST` | `/api/cleanup` | Delete old deleted prompts (>30 days) |

### Uploads

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload an image (multipart/form-data, field name: `image`) |

---

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **SQLite (better-sqlite3)** - Database
- **WAL mode** - Write-Ahead Logging for concurrency

### Frontend
- **Vanilla JavaScript (ES5)** - No frameworks, maximum compatibility
- **CSS3** - Modern styling with CSS variables
- **HTML5** - Semantic markup
- **Fetch API** - RESTful communication

### Architecture
- Single-page application (SPA)
- REST API with comprehensive error handling
- Server-side static file serving
- Soft delete with scheduled cleanup

---

## 📁 Project Structure

```
prompt-stack/
├── server/
│   ├── index.js           # Express server entry point
│   ├── database/
│   │   ├── connection.js  # DB connection & init
│   │   └── schema.sql     # Database schema
│   ├── routes/
│   │   ├── prompts.js     # Prompt CRUD & operations (includes ComfyUI integration)
│   │   ├── tags.js        # Tag endpoints
│   │   ├── upload.js      # Image upload endpoint
│   │   └── importExport.js # Import/export/cleanup
│   ├── middleware/
│   │   └── errorHandler.js # Error handling middleware
│   └── image_z_image_turbo-prompt.json # ComfyUI workflow template for image generation
├── public/
│   ├── index.html         # Main HTML
│   ├── css/
│   │   └── style.css      # All styles
│   └── js/
│       └── app.js         # Frontend application
├── images/                # Uploaded image files (auto-created dir)
├── uploads/               # (deprecated, use /images)
├── prompts.db             # SQLite database (auto-created)
├── package.json
└── README.md
```

---

## 🧪 Testing

### Basic API Test

```bash
# List prompts (initially empty)
curl http://localhost:11800/api/prompts

# Create a prompt
curl -X POST http://localhost:11800/api/prompts \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","prompt":"A beautiful sunset over mountains"}'

# Get random prompt
curl http://localhost:11800/api/prompts/random
```

### Import Sample Data

```bash
curl -X POST http://localhost:11800/api/import \
  -H "Content-Type: application/json" \
  -d @prompts.json
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 11800 | Server port |
| `DATABASE_PATH` | `./prompts.db` | SQLite database location |
| `CLEANUP_DAYS` | 30 | Days before permanently deleting soft-deleted prompts |
| `COMFYUI_URL` | `http://127.0.0.1:11820` | ComfyUI server URL for image generation |

### Database

On first run, the `schema.sql` file automatically creates the `prompts` table with appropriate indexes.

The database is initialized with WAL (Write-Ahead Logging) mode for better performance and concurrency.

### Upgrading Existing Database

If you're upgrading from an earlier version that lacks the `image` column:

```bash
sqlite3 prompts.db "ALTER TABLE prompts ADD COLUMN image TEXT;"
```

This adds support for image attachments on prompts. The images themselves are stored in the `/images` directory (not in the database).

---

## 🎨 Design Decisions

### Why No Model Field?

The application now focuses purely on prompt text. The `model_type` field is still present in the database for backward compatibility but is automatically set to "Other". This simplifies the UX and encourages prompt reusability across different AI image generators.

### Auto-Generated Titles

Titles are auto-filled from the first 60 characters of the prompt when you type. This eliminates the need to think of a separate title while still allowing manual override.

### Soft Delete with Cleanup

Prompts are soft-deleted (marked with `deleted_at` timestamp). A daily cleanup runs (via `setInterval`) and permanently removes deleted prompts older than 30 days. This prevents accidental data loss while maintaining database hygiene.

### Vanilla JS Frontend

No frameworks means:
- ✅ Faster load times
- ✅ No build step required
- ✅ Works in all browsers (ES5 compatible)
- ✅ Easy to understand and modify
- ✅ No dependency bloat

---

## 🐛 Troubleshooting

### "disk I/O error" on startup

This indicates a corrupted SQLite database. Fix:

```bash
rm prompts.db-wal prompts.db-shm  # Remove WAL files
npm start
```

### Port already in use

```bash
# Kill existing node processes
pkill -f "node server/index.js"
npm start
```

### Prompts not showing in UI

1. Hard refresh browser: `Ctrl+Shift+R` (or `Cmd+Shift+R`)
2. Check browser console for errors (F12)
3. Verify API returns data: `curl http://localhost:11800/api/prompts`

### JavaScript syntax errors

Make sure you're not loading an old cached version. Clear browser cache or use incognito mode.

### ComfyUI connection issues

**Error: "Failed to generate image" or timeout**

1. Verify ComfyUI is running: Visit `http://127.0.0.1:11820` in your browser
2. Check the `COMFYUI_URL` environment variable matches your ComfyUI instance
3. Ensure the workflow file `server/image_z_image_turbo-prompt.json` exists and is valid
4. Check that ComfyUI's output directory is writable (images are saved there before download)
5. Check server logs for detailed error messages
6. Ensure ComfyUI is not blocked by CORS (the app uses server-side proxy, so CORS shouldn't be an issue)

---


## 📜 License

MIT

---

## 🙏 Acknowledgments

Built with ❤️ for prompt engineers and AI artists.
