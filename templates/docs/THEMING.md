# Theming with next-themes

This project uses [next-themes](https://github.com/pacocoursey/next-themes) for dark/light mode support with Tailwind CSS.

## Configuration

The theme provider is configured in `src/app/_components/ThemeProvider.tsx`:

```typescript
<NextThemesProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  {children}
</NextThemesProvider>
```

| Option                      | Value    | Description                              |
| --------------------------- | -------- | ---------------------------------------- |
| `attribute`                 | `class`  | Adds `dark` class to `<html>` element    |
| `defaultTheme`              | `system` | Respects user's OS preference by default |
| `enableSystem`              | `true`   | Enables system theme detection           |
| `disableTransitionOnChange` | `true`   | Prevents flash during theme switch       |

## Using the Theme

### Getting and Setting the Theme

Use the `useTheme` hook in any client component:

```typescript
"use client";

import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      Toggle Theme
    </button>
  );
}
```

### Available Values

| Property        | Description                                        |
| --------------- | -------------------------------------------------- |
| `theme`         | Current theme (`"light"`, `"dark"`, or `"system"`) |
| `setTheme`      | Function to change the theme                       |
| `resolvedTheme` | Actual theme being used (`"light"` or `"dark"`)    |
| `themes`        | Array of available themes                          |

### Handling Hydration

The theme is not available on the server, so you need to handle the initial render:

```typescript
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // or a skeleton/placeholder
  }

  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? "Light" : "Dark"} Mode
    </button>
  );
}
```

## CSS Variables

Theme colors are defined in `src/styles/globals.css` using CSS variables:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  /* ... other variables */
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  /* ... other variables */
}
```

### Available CSS Variables

| Variable                   | Purpose                     |
| -------------------------- | --------------------------- |
| `--background`             | Page background color       |
| `--foreground`             | Default text color          |
| `--card`                   | Card background             |
| `--card-foreground`        | Card text color             |
| `--primary`                | Primary brand color         |
| `--primary-foreground`     | Text on primary color       |
| `--secondary`              | Secondary color             |
| `--secondary-foreground`   | Text on secondary color     |
| `--muted`                  | Muted/subtle backgrounds    |
| `--muted-foreground`       | Muted text color            |
| `--accent`                 | Accent color for highlights |
| `--accent-foreground`      | Text on accent color        |
| `--destructive`            | Error/danger color          |
| `--destructive-foreground` | Text on destructive color   |
| `--border`                 | Border color                |
| `--input`                  | Input field borders         |
| `--ring`                   | Focus ring color            |
| `--radius`                 | Default border radius       |

### Using CSS Variables

In your CSS or Tailwind classes:

```css
/* In CSS */
.my-element {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
}
```

```tsx
/* Inline styles */
<div style={{ backgroundColor: "hsl(var(--primary))" }}>Primary background</div>
```

## Using with Tailwind CSS

### Dark Mode Variants

Since `attribute="class"` is set, Tailwind's `dark:` variant works automatically:

```tsx
<div className="bg-white dark:bg-gray-900">
  <p className="text-gray-900 dark:text-gray-100">
    This text adapts to the theme
  </p>
</div>
```

### Custom Tailwind Theme Colors

You can extend Tailwind to use the CSS variables. Add to your Tailwind config:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... add more as needed
      },
    },
  },
};
```

Then use them directly:

```tsx
<div className="bg-background text-foreground">
  <button className="bg-primary text-primary-foreground">Click me</button>
</div>
```
