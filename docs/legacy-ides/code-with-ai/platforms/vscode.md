# Kilo Code for VS Code

This page documents the previous Kilo Code extension for VS Code.

## Installation

### Install directly

1. If you don't have VS Code installed, download it from [code.visualstudio.com](https://code.visualstudio.com/)
2. Then, you can click the button below to install Kilo Code directly from the VS Code Marketplace:

[![Install Kilo Code](https://raster.shields.io/badge/Install%20Kilo%20Code-F8F674?style=for-the-badge)](vscode:extension/kilocode.kilo-code)

### Install from VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS) to open Extensions
3. Search for "Kilo Code"
4. Click **Install**

### Install via Command Line

```bash
code --install-extension kilocode.kilo-code
```

### Verify Installation

After installation, you should see the Kilo Code icon (Kilo Code) in the Activity Bar on the left side of VS Code. Click it to open the Kilo Code panel.

## Key Features

- **Sidebar chat** — AI-powered chat panel in the VS Code activity bar
- **[Autocomplete](../features/autocomplete.md)** — Inline code completions as you type
- **[Code Actions](../features/code-actions.md)** — Explain, fix, and improve code from the editor context menu
- **[Agents](../agents/using-agents.md)** — Code, Ask, Architect, Debug, Orchestrator, and Review modes
- **[Custom Modes](../../customize/custom-modes.md)** — Define custom modes with `.kilocodemodes` YAML files
- **[MCP](https://kilo.ai/docs/automate/mcp/overview)** — Connect to MCP servers for extended capabilities
- **[Git Commit Generation](../features/git-commit-generation.md)** — AI-powered commit messages from the Source Control panel
- **[Context Mentions](../agents/context-mentions.md)** — Reference files, URLs, diagnostics, and git changes with `@`
- **[Checkpoints](../features/checkpoints.md)** — Git-based snapshots for undo/redo
