use rust_embed::Embed;
use std::path::Path;
use anyhow::Result;
use tokio::fs;

#[derive(Embed)]
#[folder = "templates/"]
pub struct Templates;

/// Get an embedded template file
pub fn get_template(path: &str) -> Option<String> {
    Templates::get(path).map(|f| String::from_utf8_lossy(&f.data).to_string())
}

/// List all files in an embedded directory
pub fn list_templates(prefix: &str) -> Vec<String> {
    Templates::iter()
        .filter(|p| p.starts_with(prefix))
        .map(|p| p.to_string())
        .collect()
}

/// Copy embedded templates to a destination directory
pub async fn copy_embedded_dir(embedded_prefix: &str, dest_path: &Path) -> Result<()> {
    let files = list_templates(embedded_prefix);

    for file_path in files {
        if let Some(content) = get_template(&file_path) {
            // Remove the prefix to get the relative path
            let relative_path = file_path.strip_prefix(embedded_prefix)
                .unwrap_or(&file_path)
                .trim_start_matches('/');

            let dest_file = dest_path.join(relative_path);

            // Create parent directories
            if let Some(parent) = dest_file.parent() {
                fs::create_dir_all(parent).await?;
            }

            fs::write(&dest_file, content).await?;
        }
    }

    Ok(())
}
