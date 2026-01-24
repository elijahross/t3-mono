use anyhow::{Context, Result};
use console::style;
use std::path::Path;

use crate::scaffolding::{ai, restate, ui};

pub async fn execute(extension: &str) -> Result<()> {
    // Check if we're in a valid project directory
    let package_json = Path::new("package.json");
    if !package_json.exists() {
        anyhow::bail!(
            "No package.json found. Run this command from the root of your project."
        );
    }

    println!();
    println!(
        "  {} {} extension...",
        style("Adding").cyan().bold(),
        style(extension).white().bold()
    );
    println!();

    match extension {
        "ai" => {
            ai::scaffold(".").await?;
            update_package_json_ai()?;
            println!(
                "  {} AI agents added to {}",
                style("✓").green().bold(),
                style("src/components/ai/").yellow()
            );
        }
        "ui" => {
            ui::scaffold(".").await?;
            update_package_json_ui()?;
            println!(
                "  {} UI components added to {}",
                style("✓").green().bold(),
                style("src/components/ui/").yellow()
            );
        }
        "restate" => {
            restate::scaffold(".").await?;
            println!(
                "  {} Restate workflows added to {}",
                style("✓").green().bold(),
                style("restate/").yellow()
            );
            println!();
            println!("  To start Restate:");
            println!("    {} {}", style("cd").cyan(), "restate && docker-compose up -d");
            println!("    {} {}", style("cd").cyan(), "services && npm install && npm run dev");
        }
        _ => {
            anyhow::bail!("Unknown extension: {}. Use 'ai', 'ui', or 'restate'.", extension);
        }
    }

    println!();
    if extension != "restate" {
        println!("  Run {} to install new dependencies", style("npm install").cyan());
        println!();
    }

    Ok(())
}

fn update_package_json_ai() -> Result<()> {
    let package_json_path = Path::new("package.json");
    let content = std::fs::read_to_string(package_json_path)?;
    let mut pkg: serde_json::Value = serde_json::from_str(&content)?;

    let deps = pkg["dependencies"]
        .as_object_mut()
        .context("Invalid package.json: missing dependencies")?;

    // Add AI dependencies
    let ai_deps = [
        ("@langchain/anthropic", "^0.3.11"),
        ("@langchain/core", "^0.3.28"),
        ("@langchain/openai", "^0.3.18"),
        ("langchain", "^0.3.7"),
        ("zod", "^4.3.5"),
        ("winston", "^3.17.0"),
        ("pg", "^8.16.0"),
    ];

    for (name, version) in ai_deps {
        if !deps.contains_key(name) {
            deps.insert(name.to_string(), serde_json::Value::String(version.to_string()));
        }
    }

    let content = serde_json::to_string_pretty(&pkg)?;
    std::fs::write(package_json_path, content)?;

    Ok(())
}

fn update_package_json_ui() -> Result<()> {
    let package_json_path = Path::new("package.json");
    let content = std::fs::read_to_string(package_json_path)?;
    let mut pkg: serde_json::Value = serde_json::from_str(&content)?;

    let deps = pkg["dependencies"]
        .as_object_mut()
        .context("Invalid package.json: missing dependencies")?;

    // Add UI dependencies
    let ui_deps = [
        ("@floating-ui/react", "^0.27.16"),
        ("class-variance-authority", "^0.7.1"),
        ("clsx", "^2.1.1"),
        ("date-fns", "^4.1.0"),
        ("lucide-react", "^0.562.0"),
        ("react-day-picker", "^9.13.0"),
        ("recharts", "^2.15.4"),
        ("sonner", "^2.0.7"),
        ("tailwind-merge", "^3.4.0"),
    ];

    for (name, version) in ui_deps {
        if !deps.contains_key(name) {
            deps.insert(name.to_string(), serde_json::Value::String(version.to_string()));
        }
    }

    let content = serde_json::to_string_pretty(&pkg)?;
    std::fs::write(package_json_path, content)?;

    Ok(())
}
