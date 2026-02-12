use anyhow::Result;
use std::path::Path;

use crate::templates::embedded;
use crate::utils::fs::write_file;

/// Scaffold UI component library
pub async fn scaffold(project_path: &str) -> Result<()> {
    let project = Path::new(project_path);

    // Create UI components directory
    let ui_path = project.join("src/components/ui");
    tokio::fs::create_dir_all(&ui_path).await?;

    // Copy embedded UI templates
    embedded::copy_embedded_dir("ui/", &ui_path).await?;

    // Update globals.css with theme config
    update_globals_css(project_path).await?;

    // Create component index file
    write_file(project_path, "src/components/ui/index.ts", UI_INDEX)?;

    // Create utils directory with hooks (only included with UI)
    let utils_path = project.join("src/utils");
    tokio::fs::create_dir_all(&utils_path).await?;
    write_file(project_path, "src/utils/use-mobile.ts", USE_MOBILE_HOOK)?;

    Ok(())
}

async fn update_globals_css(project_path: &str) -> Result<()> {
    let globals_path = Path::new(project_path).join("src/app/globals.css");

    // Write the full globals.css with theming
    tokio::fs::write(&globals_path, GLOBALS_CSS_THEMED).await?;

    Ok(())
}

// ============================================================================
// Embedded Templates
// ============================================================================

const UI_INDEX: &str = r#"// UI Components - Re-exports
export * from "./accordion";
export * from "./alert";
export * from "./alert-dialog";
export * from "./aspect-ratio";
export * from "./badge";
export * from "./breadcrumb";
export * from "./button";
export * from "./calendar";
export * from "./card";
export * from "./chart";
export * from "./checkbox";
export * from "./collapsible";
export * from "./context-menu";
export * from "./dialog";
export * from "./dropdown-menu";
export * from "./empty";
export * from "./hover-card";
export * from "./input";
export * from "./kbd";
export * from "./label";
export * from "./pagination";
export * from "./popover";
export * from "./progress";
export * from "./radio-group";
export * from "./select";
export * from "./separator";
export * from "./sheet";
export * from "./skeleton";
export * from "./slider";
export * from "./slot";
export * from "./sonner";
export * from "./spinner";
export * from "./switch";
export * from "./table";
export * from "./tabs";
export * from "./textarea";
export * from "./toggle";
export * from "./toggle-group";
export * from "./tooltip";
"#;

const USE_MOBILE_HOOK: &str = r#"import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
"#;

const GLOBALS_CSS_THEMED: &str = r#"@import "tailwindcss";

@theme inline {
  /* Light mode colors */
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(14.08% 0.004 285.82);
  --color-card: oklch(100% 0 0);
  --color-card-foreground: oklch(14.08% 0.004 285.82);
  --color-popover: oklch(100% 0 0);
  --color-popover-foreground: oklch(14.08% 0.004 285.82);
  --color-primary: oklch(20.47% 0.006 285.88);
  --color-primary-foreground: oklch(98.51% 0 0);
  --color-secondary: oklch(96.76% 0.001 286.38);
  --color-secondary-foreground: oklch(20.47% 0.006 285.88);
  --color-muted: oklch(96.76% 0.001 286.38);
  --color-muted-foreground: oklch(55.19% 0.014 285.94);
  --color-accent: oklch(96.76% 0.001 286.38);
  --color-accent-foreground: oklch(20.47% 0.006 285.88);
  --color-destructive: oklch(57.71% 0.215 27.33);
  --color-destructive-foreground: oklch(98.51% 0 0);
  --color-border: oklch(91.97% 0.004 286.32);
  --color-input: oklch(91.97% 0.004 286.32);
  --color-ring: oklch(70.9% 0.015 286.07);

  /* Chart colors */
  --color-chart-1: oklch(64.62% 0.175 250.63);
  --color-chart-2: oklch(60% 0.118 184);
  --color-chart-3: oklch(39.8% 0.094 257.29);
  --color-chart-4: oklch(76.81% 0.108 82.07);
  --color-chart-5: oklch(64.85% 0.194 16.17);

  /* Radius scale */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  --radius-3xl: 1.5rem;
  --radius-4xl: 2rem;

  /* Sidebar */
  --color-sidebar: oklch(98.51% 0 0);
  --color-sidebar-foreground: oklch(14.08% 0.004 285.82);
  --color-sidebar-primary: oklch(20.47% 0.006 285.88);
  --color-sidebar-primary-foreground: oklch(98.51% 0 0);
  --color-sidebar-accent: oklch(96.76% 0.001 286.38);
  --color-sidebar-accent-foreground: oklch(20.47% 0.006 285.88);
  --color-sidebar-border: oklch(91.97% 0.004 286.32);
  --color-sidebar-ring: oklch(70.9% 0.015 286.07);
}

.dark {
  --color-background: oklch(14.08% 0.004 285.82);
  --color-foreground: oklch(98.51% 0 0);
  --color-card: oklch(14.08% 0.004 285.82);
  --color-card-foreground: oklch(98.51% 0 0);
  --color-popover: oklch(14.08% 0.004 285.82);
  --color-popover-foreground: oklch(98.51% 0 0);
  --color-primary: oklch(98.51% 0 0);
  --color-primary-foreground: oklch(20.47% 0.006 285.88);
  --color-secondary: oklch(26.98% 0.006 285.89);
  --color-secondary-foreground: oklch(98.51% 0 0);
  --color-muted: oklch(26.98% 0.006 285.89);
  --color-muted-foreground: oklch(70.9% 0.015 286.07);
  --color-accent: oklch(26.98% 0.006 285.89);
  --color-accent-foreground: oklch(98.51% 0 0);
  --color-destructive: oklch(57.71% 0.215 27.33);
  --color-destructive-foreground: oklch(98.51% 0 0);
  --color-border: oklch(26.98% 0.006 285.89);
  --color-input: oklch(26.98% 0.006 285.89);
  --color-ring: oklch(83.84% 0.011 285.99);
  --color-chart-1: oklch(70% 0.203 256.15);
  --color-chart-2: oklch(65% 0.134 182);
  --color-chart-3: oklch(98.51% 0 0);
  --color-chart-4: oklch(80.26% 0.117 80.1);
  --color-chart-5: oklch(70.02% 0.198 13.96);
  --color-sidebar: oklch(14.08% 0.004 285.82);
  --color-sidebar-foreground: oklch(98.51% 0 0);
  --color-sidebar-primary: oklch(70% 0.203 256.15);
  --color-sidebar-primary-foreground: oklch(98.51% 0 0);
  --color-sidebar-accent: oklch(26.98% 0.006 285.89);
  --color-sidebar-accent-foreground: oklch(98.51% 0 0);
  --color-sidebar-border: oklch(26.98% 0.006 285.89);
  --color-sidebar-ring: oklch(83.84% 0.011 285.99);
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
  }
}
"#;
