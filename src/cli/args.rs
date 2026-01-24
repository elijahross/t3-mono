use clap::{Parser, Subcommand};

/// CLI tool to scaffold T3 stack apps with Better Auth and optional extensions
#[derive(Parser, Debug)]
#[command(name = "t3-mono")]
#[command(author = "Elijah Ross")]
#[command(version)]
#[command(about = "Scaffold T3 stack apps with Better Auth, optional AI agents, UI components, and Restate workflows")]
#[command(long_about = r#"
Create a new T3 stack monorepo with Better Auth pre-configured.

Examples:
  # Basic usage
  npx t3-mono my-app

  # With AI agents (LangChain)
  npx t3-mono my-app --ai

  # With UI components
  npx t3-mono my-app --ui

  # With Restate durable workflows
  npx t3-mono my-app --restate

  # With all extensions
  npx t3-mono my-app --ai --ui --restate

  # Add to existing project
  npx t3-mono add ai
  npx t3-mono add ui
  npx t3-mono add restate
"#)]
pub struct Args {
    /// Name of the project to create
    #[arg(default_value = ".")]
    pub name: String,

    /// Include LangChain AI agents framework
    #[arg(long, short = 'a')]
    pub ai: bool,

    /// Include UI component library
    #[arg(long, short = 'u')]
    pub ui: bool,

    /// Include Restate durable workflow services
    #[arg(long, short = 'r')]
    pub restate: bool,

    /// Run in interactive mode with prompts
    #[arg(long, short = 'i')]
    pub interactive: bool,

    /// Skip git initialization
    #[arg(long)]
    pub no_git: bool,

    #[command(subcommand)]
    pub command: Option<Command>,
}

#[derive(Subcommand, Debug)]
pub enum Command {
    /// Add an extension to an existing project
    Add {
        /// Extension to add: 'ai', 'ui', or 'restate'
        #[arg(value_parser = ["ai", "ui", "restate"])]
        extension: String,
    },
}
