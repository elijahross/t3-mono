use anyhow::Result;
use console::style;
use dialoguer::MultiSelect;
use indicatif::{ProgressBar, ProgressStyle};
use std::path::Path;
use std::time::Duration;

use crate::scaffolding::{ai, better_auth, restate, t3, ui};
use crate::utils::fs;

pub async fn execute(
    name: &str,
    include_ai: bool,
    include_ui: bool,
    include_restate: bool,
    interactive: bool,
    init_git: bool,
) -> Result<()> {
    let (ai_enabled, ui_enabled, restate_enabled) = if interactive {
        prompt_extensions(include_ai, include_ui, include_restate)?
    } else {
        (include_ai, include_ui, include_restate)
    };

    let project_path = Path::new(name);

    // Check if directory exists and is not empty
    if project_path.exists() && name != "." {
        let is_empty = project_path.read_dir()?.next().is_none();
        if !is_empty {
            anyhow::bail!("Directory '{}' already exists and is not empty", name);
        }
    }

    println!();
    println!(
        "  {} {} {}",
        style("Creating").cyan().bold(),
        style(name).white().bold(),
        style("with T3 Stack + Better Auth").dim()
    );

    if ai_enabled {
        println!("  {} LangChain AI agents", style("+").green().bold());
    }
    if ui_enabled {
        println!("  {} UI component library", style("+").green().bold());
    }
    if restate_enabled {
        println!("  {} Restate durable workflows", style("+").green().bold());
    }
    println!();

    // Create progress bar
    let pb = create_progress_bar();

    // Step 1: Create directory structure
    pb.set_message("Creating project structure...");
    fs::create_project_dir(name)?;
    pb.inc(1);

    // Step 2: Scaffold T3 base
    pb.set_message("Setting up T3 stack...");
    t3::scaffold(name).await?;
    pb.inc(1);

    // Step 3: Add Better Auth
    pb.set_message("Configuring Better Auth...");
    better_auth::scaffold(name).await?;
    pb.inc(1);

    // Step 4: Add AI if enabled
    if ai_enabled {
        pb.set_message("Adding AI agents framework...");
        ai::scaffold(name).await?;
        pb.inc(1);
    }

    // Step 5: Add UI if enabled
    if ui_enabled {
        pb.set_message("Adding UI components...");
        ui::scaffold(name).await?;
        pb.inc(1);
    }

    // Step 6: Add Restate if enabled
    if restate_enabled {
        pb.set_message("Adding Restate workflows...");
        restate::scaffold(name).await?;
        pb.inc(1);
    }

    // Step 7: Initialize git
    if init_git {
        pb.set_message("Initializing git repository...");
        fs::init_git(name)?;
        pb.inc(1);
    }

    // Step 8: Final package.json assembly
    pb.set_message("Finalizing package.json...");
    t3::finalize_package_json(name, ai_enabled, ui_enabled)?;
    pb.inc(1);

    pb.finish_and_clear();

    // Print success message
    print_success(name, ai_enabled, ui_enabled, restate_enabled);

    Ok(())
}

fn prompt_extensions(default_ai: bool, default_ui: bool, default_restate: bool) -> Result<(bool, bool, bool)> {
    let extensions = vec!["AI Agents (LangChain)", "UI Components", "Restate Workflows"];
    let defaults = vec![default_ai, default_ui, default_restate];

    let selections = MultiSelect::new()
        .with_prompt("Select extensions to include")
        .items(&extensions)
        .defaults(&defaults)
        .interact()?;

    let ai = selections.contains(&0);
    let ui = selections.contains(&1);
    let restate = selections.contains(&2);

    Ok((ai, ui, restate))
}

fn create_progress_bar() -> ProgressBar {
    let pb = ProgressBar::new(8);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("  {spinner:.green} {msg}")
            .unwrap()
            .tick_chars("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"),
    );
    pb.enable_steady_tick(Duration::from_millis(80));
    pb
}

fn print_success(name: &str, ai_enabled: bool, ui_enabled: bool, restate_enabled: bool) {
    println!();
    println!("  {} Project created successfully!", style("✓").green().bold());
    println!();
    println!("  Next steps:");
    println!();

    if name != "." {
        println!("    {} {}", style("cd").cyan(), name);
    }
    println!("    {} {}", style("npm").cyan(), "install");
    println!("    {} {}", style("npx").cyan(), "prisma db push");
    println!("    {} {}", style("npm").cyan(), "run dev");

    if restate_enabled {
        println!();
        println!("  For Restate:");
        println!("    {} {}", style("cd").cyan(), "restate && docker-compose up -d");
        println!("    {} {}", style("cd").cyan(), "services && npm install && npm run dev");
    }
    println!();

    if ai_enabled || ui_enabled || restate_enabled {
        println!("  Included extensions:");
        if ai_enabled {
            println!("    {} AI agents in {}", style("•").dim(), style("src/ai/").yellow());
        }
        if ui_enabled {
            println!("    {} UI components in {}", style("•").dim(), style("src/components/ui/").yellow());
        }
        if restate_enabled {
            println!("    {} Restate workflows in {}", style("•").dim(), style("restate/").yellow());
        }
        println!();
    }

    println!(
        "  {} {}",
        style("Docs:").dim(),
        style("https://github.com/elijahross/boilerplate_moduls").underlined()
    );
    println!();
}
