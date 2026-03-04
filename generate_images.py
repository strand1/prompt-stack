#!/usr/bin/env python3
"""
Image Generator for Prompt Stack
Generates images for prompts that don't have them using ComfyUI API.

Process:
1. Load ComfyUI workflow template from image_z_image_turbo-prompt.json
2. Query database for prompts without images
3. For each prompt:
   - Update workflow with prompt text
   - Submit to ComfyUI server
   - Wait for generation
   - Download generated image
   - Save to /images directory
   - Update database with image filename
"""

import json
import sqlite3
import time
import urllib.request
import urllib.error
import os
import sys
from pathlib import Path

# Configuration
COMFYUI_URL = "http://127.0.0.1:11820"
DATABASE_PATH = "./prompts.db"
IMAGES_DIR = "./images"
WORKFLOW_TEMPLATE = "image_z_image_turbo-prompt.json"
BATCH_DELAY = 2  # Delay between generations in seconds

def ensure_images_dir():
    """Ensure images directory exists."""
    Path(IMAGES_DIR).mkdir(exist_ok=True)
    print(f"[Setup] Images directory: {IMAGES_DIR}")

def load_workflow_template():
    """Load the ComfyUI workflow template."""
    with open(WORKFLOW_TEMPLATE, 'r') as f:
        workflow = json.load(f)
    print(f"[Setup] Loaded workflow template from {WORKFLOW_TEMPLATE}")
    return workflow

def get_prompts_without_images(limit=None, specific_id=None):
    """
    Query database for prompts that don't have images.
    Only fetches non-deleted prompts (deleted_at IS NULL).
    Args:
        limit: Optional max number of prompts to return
        specific_id: Optional specific prompt ID to fetch
    """
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if specific_id:
        cursor.execute("""
            SELECT id, title, prompt
            FROM prompts
            WHERE id = ? AND (image IS NULL OR image = '') AND deleted_at IS NULL
        """, (specific_id,))
        rows = cursor.fetchall()
    else:
        query = """
            SELECT id, title, prompt
            FROM prompts
            WHERE (image IS NULL OR image = '') AND deleted_at IS NULL
            ORDER BY id
        """
        if limit:
            query += " LIMIT ?"
            cursor.execute(query, (limit,))
        else:
            cursor.execute(query)
        rows = cursor.fetchall()

    conn.close()

    prompts = [dict(row) for row in rows]
    if specific_id:
        print(f"[Setup] Fetching specific prompt ID {specific_id}")
    else:
        print(f"[Setup] Found {len(prompts)} prompts without images")
    return prompts

def queue_prompt(workflow):
    """Submit workflow to ComfyUI and get prompt_id."""
    p = {"prompt": workflow}
    data = json.dumps(p).encode('utf-8')
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=data,
        headers={'Content-Type': 'application/json'}
    )

    try:
        response = urllib.request.urlopen(req, timeout=30)
        result = json.loads(response.read())
        return result.get('prompt_id')
    except urllib.error.HTTPError as e:
        print(f"[Error] HTTP {e.code}: {e.read().decode()}")
        return None
    except Exception as e:
        print(f"[Error] Failed to queue prompt: {e}")
        return None

def check_completion(prompt_id, timeout=300, poll_interval=2):
    """
    Poll ComfyUI history endpoint to check if generation is complete.
    Returns tuple (completed, output_filenames)
    """
    start_time = time.time()

    while time.time() - start_time < timeout:
        try:
            url = f"{COMFYUI_URL}/history/{prompt_id}"
            req = urllib.request.Request(url)
            response = urllib.request.urlopen(req, timeout=10)
            result = json.loads(response.read())

            if prompt_id in result:
                history = result[prompt_id]

                if 'outputs' in history:
                    # Check if generation is complete
                    outputs = history['outputs']

                    # Look for images from the SaveImage node (node 9)
                    if '9' in outputs:
                        images = outputs['9'].get('images', [])
                        if images:
                            filenames = [img['filename'] for img in images]
                            return True, filenames

                    # Alternative: check any output with images
                    for node_id, output in outputs.items():
                        if 'images' in output and output['images']:
                            filenames = [img['filename'] for img in output['images']]
                            return True, filenames

                # Check for errors
                if 'status' in history:
                    status = history['status']
                    if status.get('status_str') == 'failed':
                        error_msg = status.get('errors', ['Unknown error'])[0]
                        print(f"[Error] Generation failed: {error_msg}")
                        return False, None

        except urllib.error.HTTPError as e:
            if e.code == 404:
                # Prompt not found yet, keep polling
                pass
            else:
                print(f"[Error] HTTP {e.code} while checking: {e.read().decode()}")
        except Exception as e:
            print(f"[Warning] Error checking status: {e}")

        time.sleep(poll_interval)

    print(f"[Error] Timeout after {timeout}s waiting for prompt {prompt_id}")
    return False, None

def download_image(filename, local_name):
    """
    Download image from ComfyUI and save locally.
    Returns local filepath if successful, None otherwise.
    """
    try:
        # ComfyUI serves images via /view endpoint
        url = f"{COMFYUI_URL}/view?filename={filename}"
        req = urllib.request.Request(url)

        response = urllib.request.urlopen(req, timeout=30)

        # Save to local file
        local_path = os.path.join(IMAGES_DIR, local_name)
        with open(local_path, 'wb') as f:
            f.write(response.read())

        print(f"  ✓ Downloaded: {filename} → {local_name}")
        return local_name
    except Exception as e:
        print(f"  ✗ Failed to download {filename}: {e}")
        return None

def update_prompt_image(prompt_id, image_filename):
    """Update the database record with the image filename."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE prompts SET image = ?, updated_at = ? WHERE id = ?",
        (image_filename, time.strftime('%Y-%m-%d %H:%M:%S'), prompt_id)
    )
    conn.commit()
    conn.close()
    print(f"  ✓ Updated database: prompt ID {prompt_id} → {image_filename}")

def generate_image_for_prompt(prompt_data, workflow_template):
    """Generate an image for a single prompt."""
    prompt_id = prompt_data['id']
    prompt_text = prompt_data['prompt']

    print(f"\n[{prompt_id}] {prompt_data['title'][:50]}...")

    # Clone workflow and update prompt text
    workflow = json.loads(json.dumps(workflow_template))
    workflow['67']['inputs']['text'] = prompt_text

    # Queue the prompt
    comfyui_prompt_id = queue_prompt(workflow)
    if not comfyui_prompt_id:
        print(f"[{prompt_id}] ✗ Failed to queue prompt")
        return False

    print(f"[{prompt_id}] Queued (ID: {comfyui_prompt_id})")

    # Wait for completion
    completed, filenames = check_completion(comfyui_prompt_id)
    if not completed or not filenames:
        print(f"[{prompt_id}] ✗ Generation failed or no output")
        return False

    print(f"[{prompt_id}] Generated: {', '.join(filenames)}")

    # Download the first image
    filename = filenames[0]
    # Generate local filename: img-{prompt_id}-{timestamp}.{ext}
    ext = os.path.splitext(filename)[1]
    local_name = f"img-{prompt_id}-{int(time.time())}{ext}"

    saved_filename = download_image(filename, local_name)
    if not saved_filename:
        print(f"[{prompt_id}] ✗ Failed to download image")
        return False

    # Update database
    update_prompt_image(prompt_id, saved_filename)
    print(f"[{prompt_id}] ✓ Complete!")

    return True

def main():
    """Main execution."""
    import argparse

    parser = argparse.ArgumentParser(description='Generate images for prompts using ComfyUI')
    parser.add_argument('--test', action='store_true',
                        help='Test mode: only generate for one prompt')
    parser.add_argument('--prompt-id', type=int,
                        help='Generate image for a specific prompt ID')
    parser.add_argument('--limit', type=int,
                        help='Limit number of prompts to process')
    args = parser.parse_args()

    print("=" * 60)
    print("Prompt Stack - Image Generator")
    print("=" * 60)

    # Verify ComfyUI is accessible
    try:
        req = urllib.request.Request(f"{COMFYUI_URL}/queue")
        urllib.request.urlopen(req, timeout=5)
        print(f"[✓] Connected to ComfyUI at {COMFYUI_URL}")
    except Exception as e:
        print(f"[✗] Cannot connect to ComfyUI at {COMFYUI_URL}: {e}")
        print("    Make sure ComfyUI is running with --port 11820")
        print(f"    and the workflow file exists: {WORKFLOW_TEMPLATE}")
        sys.exit(1)

    # Setup
    ensure_images_dir()
    workflow = load_workflow_template()

    # Determine which prompts to process
    if args.prompt_id:
        prompts = get_prompts_without_images(specific_id=args.prompt_id)
        if not prompts:
            print(f"[Info] Prompt ID {args.prompt_id} already has an image or doesn't exist.")
            return
    elif args.test:
        prompts = get_prompts_without_images(limit=1)
        if not prompts:
            print("[Info] No prompts need images. All done!")
            return
        print("[Test Mode] Only processing 1 prompt")
    elif args.limit:
        prompts = get_prompts_without_images(limit=args.limit)
        if not prompts:
            print("[Info] No prompts need images. All done!")
            return
        print(f"[Limited] Processing up to {args.limit} prompts")
    else:
        prompts = get_prompts_without_images()
        if not prompts:
            print("[Info] No prompts need images. All done!")
            return

    # Confirm before proceeding if many prompts
    if len(prompts) > 1:
        response = input(f"\nProceed with {len(prompts)} prompts? (y/n): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return

    print(f"\n[Start] Generating {len(prompts)} image(s)...")
    print("-" * 60)

    # Process each prompt
    success_count = 0
    fail_count = 0

    for i, prompt in enumerate(prompts, 1):
        print(f"\n[{i}/{len(prompts)}]")
        try:
            if generate_image_for_prompt(prompt, workflow):
                success_count += 1
            else:
                fail_count += 1
        except Exception as e:
            print(f"[{prompt['id']}] ✗ Unexpected error: {e}")
            fail_count += 1

        # Delay between requests
        if i < len(prompts):
            time.sleep(BATCH_DELAY)

    # Summary
    print("\n" + "=" * 60)
    print(f"[Summary]")
    print(f"  Total:  {len(prompts)}")
    print(f"  Success: {success_count}")
    print(f"  Failed:  {fail_count}")
    print("=" * 60)

if __name__ == "__main__":
    main()
