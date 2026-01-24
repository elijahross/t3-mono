use anyhow::{Context, Result};
use git2::Repository;
use std::fs;
use std::path::Path;

/// Create the project directory structure
pub fn create_project_dir(name: &str) -> Result<()> {
    let project_path = Path::new(name);

    if name != "." {
        fs::create_dir_all(project_path)
            .with_context(|| format!("Failed to create directory: {}", name))?;
    }

    // Create standard directories
    let dirs = [
        "src/app/api/trpc/[trpc]",
        "src/app/api/auth/[...all]",
        "src/server/api",
        "src/lib",
        "src/components",
        "prisma",
        "public",
    ];

    for dir in dirs {
        fs::create_dir_all(project_path.join(dir))
            .with_context(|| format!("Failed to create directory: {}", dir))?;
    }

    Ok(())
}

/// Initialize a git repository
pub fn init_git(name: &str) -> Result<()> {
    let project_path = Path::new(name);
    Repository::init(project_path).context("Failed to initialize git repository")?;

    // Create .gitignore
    let gitignore = r#"# Dependencies
node_modules/
.pnpm-store/

# Build outputs
.next/
out/
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Prisma
prisma/*.db
prisma/*.db-journal

# TypeScript
*.tsbuildinfo

# Testing
coverage/
.nyc_output/
"#;

    fs::write(project_path.join(".gitignore"), gitignore)?;

    Ok(())
}

/// Write a file to the project directory
pub fn write_file(project_path: &str, relative_path: &str, content: &str) -> Result<()> {
    let full_path = Path::new(project_path).join(relative_path);

    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(&full_path, content)
        .with_context(|| format!("Failed to write file: {}", relative_path))?;

    Ok(())
}

/// Create directory if it doesn't exist
pub fn ensure_dir(path: &Path) -> Result<()> {
    if !path.exists() {
        fs::create_dir_all(path)?;
    }
    Ok(())
}

/// Get the cache directory for remote templates
pub fn get_cache_dir() -> Result<std::path::PathBuf> {
    let cache_dir = dirs::cache_dir()
        .context("Could not determine cache directory")?
        .join("create-monorepo");

    ensure_dir(&cache_dir)?;

    Ok(cache_dir)
}
