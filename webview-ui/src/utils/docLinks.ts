/**
 * Utility for building Roo Code documentation links with UTM telemetry.
 *
 * @param path - The path after the docs root (no leading slash)
 * @param campaign - The UTM campaign context (e.g. "welcome", "provider_docs", "tips", "error_tooltip")
 * @returns The full docs URL with UTM parameters
 */
// kilocode_change start: point final legacy builds at the archived manual
const root = "https://github.com/Kilo-Org/kilocode-legacy/blob/main/docs/legacy-ides"

const routes: Record<string, string> = {
	"basic-usage/using-modes": "code-with-ai/agents/using-agents.md",
	"getting-started/connecting-api-provider": "getting-started/setup-authentication.md",
	"roo-code-cloud/login": "getting-started/setup-authentication.md",
	"features/slash-commands": "customize/workflows.md",
	"features/slash-commands/workflows": "customize/workflows.md",
	"features/shell-integration": "automate/extending/shell-integration.md",
	"troubleshooting/shell-integration": "automate/extending/shell-integration.md",
	"features/checkpoints": "code-with-ai/features/checkpoints.md",
	"features/browser-use": "code-with-ai/features/browser-use.md",
	"features/custom-instructions": "customize/custom-instructions.md",
	"advanced-usage/custom-instructions": "customize/custom-instructions.md",
	"features/footgun-prompting": "customize/footgun-prompting.md",
	"features/mcp/using-mcp-in-kilo-code": "automate/mcp/using-in-kilo-code.md",
	"features/experimental/voice-transcription": "code-with-ai/features/speech-to-text.md",
	"features/codebase-indexing": "customize/context/codebase-indexing.md",
	"features/skills": "customize/skills.md",
	"basic-usage/autocomplete": "code-with-ai/features/autocomplete.md",
	"advanced-usage/custom-rules": "customize/custom-rules.md",
	"jetbrains-troubleshooting": "getting-started/troubleshooting/jetbrains.md",
	"getting-started/faq/known-issues": "getting-started/faq/known-issues.md",
}

export function buildDocLink(path: string, _campaign: string): string {
	const clean = path.replace(/^\/+|\/+$/g, "")
	const index = clean.indexOf("#")
	const base = index === -1 ? clean : clean.slice(0, index)
	const hash = index === -1 ? "" : clean.slice(index + 1)
	const provider = base.match(/^providers\/(.+)$/)?.[1]
	const slug = provider === "openai-codex" ? "openai-chatgpt-plus-pro" : provider
	const file = slug ? `ai-providers/${slug}.md` : routes[base] || (base ? `${base}.md` : "README.md")
	const url = `${root}/${file}`
	return hash ? `${url}#${hash}` : url
}
// kilocode_change end
