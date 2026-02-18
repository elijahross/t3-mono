mod cli;
mod commands;
mod scaffolding;
mod templates;
mod utils;

use anyhow::Result;
use clap::Parser;
use cli::Args;
use console::style;

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    if let Err(e) = run(args).await {
        eprintln!("{} {}", style("Error:").red().bold(), e);
        std::process::exit(1);
    }

    Ok(())
}

async fn run(args: Args) -> Result<()> {
    match args.command {
        Some(cli::Command::Add { extension }) => {
            commands::add::execute(&extension).await?;
        }
        None => {
            commands::create::execute(
                &args.name,
                args.ai,
                args.ui,
                args.restate,
                args.cmd,
                args.interactive,
                !args.no_git,
                args.auth,
            )
            .await?;
        }
    }

    Ok(())
}
