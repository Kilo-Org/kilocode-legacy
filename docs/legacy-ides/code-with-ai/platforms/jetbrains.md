# Kilo Code for JetBrains

The legacy JetBrains plugin runs the same Kilo extension host and webview used by the legacy VS Code extension. These notes cover the platform-specific wrapper behavior; the rest of this manual applies to both IDE families.

## Runtime and interface

- The Kilo Code tool window renders the shared interface through JCEF.
- The plugin uses a bundled Node.js runtime when available and otherwise falls back to Node.js 20.6.0 or newer on `PATH`.
- Browser authentication returns through `jetbrains://idea/ai.kilocode.jetbrains.auth`. JetBrains Toolbox registers this callback; without Toolbox, configure provider API keys manually.
- The plugin ID is `ai.kilocode.jetbrains` and its Marketplace listing is [Kilo Code](https://plugins.jetbrains.com/plugin/28350-kilo-code).

See [Installation](../../getting-started/installing.md) and [JetBrains troubleshooting](../../getting-started/troubleshooting/jetbrains.md).

## Editor actions

Select code and open the **Kilo Code** editor context menu to:

- Add the selection to chat context
- Explain code in the current task
- Fix logic in the current task
- Improve code in the current task

The plugin passes the selected text, file path, and line range to the shared Kilo runtime.

## Autocomplete

JetBrains inline completion is supported. A native `InlineCompletionProvider` sends the current document, caret position, and language to the shared Autocomplete service and renders accepted suggestions as JetBrains inline text. Configure the provider and model through Kilo Code settings just as you would for the shared extension runtime.

## Git commit messages

The commit dialog includes **Generate Commit Message** through JetBrains' VCS message action group. It analyzes the staged changes and writes the generated message into the native commit UI.

## Terminal integration

The JetBrains wrapper customizes local terminals and bridges command lifecycle events to the extension host. It reports command text, output, exit status, and working-directory changes so the shared `execute_command` behavior can observe native JetBrains terminals. Shell-integration scripts are stored under `~/.kilocode-shell-integrations/`.

## Storage

JetBrains-specific storage paths, including extension state, secrets, and IDE persistence, are listed in [Legacy IDE File Locations](../../getting-started/file-locations.md).
