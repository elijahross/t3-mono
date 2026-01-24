use anyhow::{Context, Result};
use reqwest::Client;
use std::path::Path;
use tokio::fs;

use crate::utils::fs::get_cache_dir;

const RAW_CONTENT_BASE: &str = "https://raw.githubusercontent.com/elijahross/boilerplate_moduls/main";

/// Fetch a directory from the GitHub repository
/// Uses direct raw URL fetching for reliability (avoids API rate limits)
pub async fn fetch_directory(remote_path: &str, local_path: &Path) -> Result<()> {
    let client = Client::new();

    // Always use direct fetching approach for known file structures
    // This avoids GitHub API rate limits
    fetch_known_files(&client, remote_path, local_path).await
}

/// Fetch known files when API rate limit is hit
async fn fetch_known_files(client: &Client, remote_path: &str, local_path: &Path) -> Result<()> {
    fs::create_dir_all(local_path).await?;

    // Define known file patterns based on the path
    let files: Vec<&str> = if remote_path.starts_with("agents/core") {
        vec![
            "providers/index.ts",
            "logging/index.ts",
            "chunking/index.ts",
            "embedding/index.ts",
            "index.ts",
        ]
    } else if remote_path == "ui" {
        // UI components - fetch all known components
        vec![
            "globals.css",
            "accordion.tsx",
            "alert.tsx",
            "alert-dialog.tsx",
            "aspect-ratio.tsx",
            "badge.tsx",
            "breadcrumb.tsx",
            "button.tsx",
            "calendar.tsx",
            "card.tsx",
            "chart.tsx",
            "checkbox.tsx",
            "collapsible.tsx",
            "context-menu.tsx",
            "dialog.tsx",
            "dropdown-menu.tsx",
            "empty.tsx",
            "hover-card.tsx",
            "input.tsx",
            "kbd.tsx",
            "label.tsx",
            "pagination.tsx",
            "popover.tsx",
            "progress.tsx",
            "radio-group.tsx",
            "select.tsx",
            "separator.tsx",
            "sheet.tsx",
            "skeleton.tsx",
            "slider.tsx",
            "slot.tsx",
            "sonner.tsx",
            "spinner.tsx",
            "switch.tsx",
            "table.tsx",
            "tabs.tsx",
            "textarea.tsx",
            "toggle.tsx",
            "toggle-group.tsx",
            "tooltip.tsx",
        ]
    } else {
        vec![]
    };

    for file in files {
        let url = format!("{}/{}/{}", RAW_CONTENT_BASE, remote_path, file);
        let file_path = local_path.join(file);

        // Create parent directory if needed
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        match client
            .get(&url)
            .header("User-Agent", "create-monorepo")
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                let content = response.text().await?;
                fs::write(&file_path, content).await?;
            }
            _ => {
                // File doesn't exist, skip
            }
        }
    }

    Ok(())
}

/// Fetch a single file from the GitHub repository
pub async fn fetch_file(remote_path: &str) -> Result<String> {
    let client = Client::new();
    let url = format!("{}/{}", RAW_CONTENT_BASE, remote_path);

    let content = client
        .get(&url)
        .header("User-Agent", "create-monorepo")
        .send()
        .await
        .context("Failed to fetch file from GitHub")?
        .text()
        .await
        .context("Failed to read file content")?;

    Ok(content)
}

/// Get cached or fetch remote templates
pub async fn get_or_fetch_directory(remote_path: &str, local_dest: &Path, use_cache: bool) -> Result<()> {
    if use_cache {
        let cache_dir = get_cache_dir()?;
        let cached_path = cache_dir.join(remote_path);

        if cached_path.exists() {
            // Copy from cache
            copy_dir_recursive(&cached_path, local_dest).await?;
            return Ok(());
        }

        // Fetch and cache
        fetch_directory(remote_path, &cached_path).await?;
        copy_dir_recursive(&cached_path, local_dest).await?;
    } else {
        fetch_directory(remote_path, local_dest).await?;
    }

    Ok(())
}

async fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<()> {
    fs::create_dir_all(dest).await?;

    let mut entries = fs::read_dir(src).await?;
    while let Some(entry) = entries.next_entry().await? {
        let file_type = entry.file_type().await?;
        let dest_path = dest.join(entry.file_name());

        if file_type.is_dir() {
            Box::pin(copy_dir_recursive(&entry.path(), &dest_path)).await?;
        } else {
            fs::copy(entry.path(), dest_path).await?;
        }
    }

    Ok(())
}
