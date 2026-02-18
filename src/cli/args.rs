use clap::{Parser, Subcommand, ValueEnum};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, ValueEnum)]
pub enum AuthProvider {
    #[default]
    #[value(name = "better-auth")]
    BetterAuth,
    #[value(name = "next-auth")]
    NextAuth,
}

/// CLI tool to scaffold T3 stack apps with authentication and optional extensions
#[derive(Parser, Debug)]
#[command(name = "t3-mono")]
#[command(author = "Elijah Ross")]
#[command(version)]
#[command(about = "Scaffold T3 stack apps with authentication (Better Auth or NextAuth), optional AI agents, UI components, and Restate workflows")]
#[command(long_about = r#"
Create a new T3 stack monorepo with authentication pre-configured.

Examples:
  # Basic usage (uses Better Auth by default)
  npx t3-mono my-app

  # With NextAuth instead
  npx t3-mono my-app --auth=next-auth

  # With AI agents (LangChain)
  npx t3-mono my-app --ai

  # With UI components
  npx t3-mono my-app --ui

  # With Restate durable workflows
  npx t3-mono my-app --restate

  # With CommandIsland AI layer
  npx t3-mono my-app --cmd

  # With all extensions
  npx t3-mono my-app --ai --ui --restate --cmd

  # Interactive mode (prompts for auth and extensions)
  npx t3-mono my-app -i

  # Add to existing project
  npx t3-mono add ai
  npx t3-mono add ui
  npx t3-mono add restate
  npx t3-mono add cmd
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

    /// Include CommandIsland AI layer (chat, tables, docs, split-view)
    #[arg(long, short = 'c')]
    pub cmd: bool,

    /// Run in interactive mode with prompts
    #[arg(long, short = 'i')]
    pub interactive: bool,

    /// Skip git initialization
    #[arg(long)]
    pub no_git: bool,

    /// Authentication provider (better-auth or next-auth)
    #[arg(long, value_enum, default_value_t = AuthProvider::BetterAuth)]
    pub auth: AuthProvider,

    #[command(subcommand)]
    pub command: Option<Command>,
}

#[derive(Subcommand, Debug)]
pub enum Command {
    /// Add an extension to an existing project
    Add {
        /// Extension to add: 'ai', 'ui', 'restate', or 'cmd'
        #[arg(value_parser = ["ai", "ui", "restate", "cmd"])]
        extension: String,
    },
}
