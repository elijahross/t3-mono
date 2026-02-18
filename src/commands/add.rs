use anyhow::{Context, Result};
use console::style;
use std::path::Path;

use crate::scaffolding::{ai, cmd, restate, ui};

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
        "cmd" => {
            cmd::scaffold(".").await?;
            update_package_json_cmd()?;
            println!(
                "  {} CommandIsland AI layer added",
                style("✓").green().bold(),
            );
            println!();
            println!("  Post-install steps:");
            println!("    1. Review {} for pgvector config and new models", style("prisma/schema.prisma").yellow());
            println!("    2. Run {} to apply schema changes", style("npx prisma migrate dev --name add_commandisland").cyan());
            println!("    3. Set env vars: {}", style("ANTHROPIC_API_KEY, AWS_S3_BUCKET_NAME, AWS_REGION").yellow());
        }
        _ => {
            anyhow::bail!("Unknown extension: {}. Use 'ai', 'ui', 'restate', or 'cmd'.", extension);
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
        ("@langchain/anthropic", "^1.3.18"),
        ("@langchain/core", "^1.1.26"),
        ("@langchain/openai", "^1.2.8"),
        ("langchain", "^1.2.25"),
        ("zod", "^4.3.6"),
        ("winston", "^3.19.0"),
        ("pg", "^8.18.0"),
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
        ("@floating-ui/react", "^0.27.18"),
        ("class-variance-authority", "^0.7.1"),
        ("clsx", "^2.1.1"),
        ("date-fns", "^4.1.0"),
        ("lucide-react", "^0.574.0"),
        ("react-day-picker", "^9.13.2"),
        ("recharts", "^2.15.4"),
        ("sonner", "^2.0.7"),
        ("tailwind-merge", "^3.4.1"),
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

fn update_package_json_cmd() -> Result<()> {
    let package_json_path = Path::new("package.json");
    let content = std::fs::read_to_string(package_json_path)?;
    let mut pkg: serde_json::Value = serde_json::from_str(&content)?;

    let deps = pkg["dependencies"]
        .as_object_mut()
        .context("Invalid package.json: missing dependencies")?;

    let cmd_deps = [
        // LangChain
        ("@langchain/anthropic", "^1.3.18"),
        ("@langchain/cohere", "^1.0.2"),
        ("@langchain/core", "^1.1.26"),
        ("@langchain/google-genai", "^2.1.19"),
        ("@langchain/mistralai", "^1.0.4"),
        ("@langchain/ollama", "^1.2.3"),
        ("@langchain/openai", "^1.2.8"),
        ("@langchain/textsplitters", "^1.0.1"),
        ("langchain", "^1.2.25"),
        // Backend
        ("winston", "^3.19.0"),
        ("pg", "^8.18.0"),
        ("server-only", "^0.0.1"),
        // Frontend
        ("react-markdown", "^10.1.0"),
        ("remark-gfm", "^4.0.1"),
        ("@floating-ui/react", "^0.27.18"),
        ("sonner", "^2.0.7"),
        ("class-variance-authority", "^0.7.1"),
        ("date-fns", "^4.1.0"),
        // DocGen
        ("pdfmake", "^0.3.4"),
        ("exceljs", "^4.4.0"),
        ("pptxgenjs", "^4.0.1"),
        // AWS
        ("@aws-sdk/client-s3", "^3.993.0"),
        ("@aws-sdk/s3-request-presigner", "^3.993.0"),
    ];

    for (name, version) in cmd_deps {
        if !deps.contains_key(name) {
            deps.insert(name.to_string(), serde_json::Value::String(version.to_string()));
        }
    }

    // Add dev dependencies
    if let Some(dev_deps) = pkg["devDependencies"].as_object_mut() {
        let cmd_dev_deps = [
            ("@types/pdfmake", "^0.3.1"),
            ("@types/pg", "^8.16.0"),
        ];
        for (name, version) in cmd_dev_deps {
            if !dev_deps.contains_key(name) {
                dev_deps.insert(name.to_string(), serde_json::Value::String(version.to_string()));
            }
        }
    }

    let content = serde_json::to_string_pretty(&pkg)?;
    std::fs::write(package_json_path, content)?;

    Ok(())
}
