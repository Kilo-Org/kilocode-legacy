# Legacy IDE File Locations

## VS Code

The legacy VS Code extension uses VS Code's `globalStorageUri` under the extension identifier `kilocode.kilo-code`.

| OS      | Default base path                                                           |
| ------- | --------------------------------------------------------------------------- |
| Linux   | `~/.config/Code/User/globalStorage/kilocode.kilo-code/`                     |
| macOS   | `~/Library/Application Support/Code/User/globalStorage/kilocode.kilo-code/` |
| Windows | `%APPDATA%\Code\User\globalStorage\kilocode.kilo-code\`                     |

VS Code variants and remote extension hosts use their corresponding user-data directory. The extension setting `kilo-code.customStoragePath` can override the storage base.

## JetBrains

The legacy JetBrains wrapper stores extension-host data in these locations:

| Path                                                      | Purpose                              |
| --------------------------------------------------------- | ------------------------------------ |
| `~/.kilocode/globalStorage/`                              | Shared extension state and task data |
| `~/.kilocode/workspaceStorage/`                           | Per-workspace extension state        |
| `~/.kilocode/secrets.json`                                | Stored provider credentials          |
| `kilocode-extension-storage.xml` in the IDE configuration | JetBrains persistent plugin settings |
| `~/.kilocode-shell-integrations/`                         | Generated shell-integration scripts  |

## Project files

| Path                      | Purpose                      |
| ------------------------- | ---------------------------- |
| `.kilocode/rules/`        | Project rules                |
| `.kilocode/rules-<mode>/` | Mode-specific rules          |
| `.kilocode/workflows/`    | Workflows and slash commands |
| `.kilocode/mcp.json`      | Project MCP configuration    |
| `.kilocode/skills/`       | Project skills               |
| `.kilocodemodes`          | Custom mode definitions      |
| `.kilocodeignore`         | Excluded paths               |
