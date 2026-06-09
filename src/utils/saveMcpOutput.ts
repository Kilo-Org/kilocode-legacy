import * as fs from "fs/promises"
import * as path from "path"
import { randomUUID } from "crypto"

export interface SaveResult {
	filePath: string
	chars: number
	lines: number
}

/**
 * Save MCP output to .kilocode/sessions/ as a .txt file.
 * Returns the absolute path and metadata.
 */
export async function saveMcpOutput(
	cwd: string,
	serverName: string,
	toolName: string,
	textContent: string,
): Promise<SaveResult> {
	const cwdSafe = cwd || process.cwd()
	const date = new Date().toISOString().split("T")[0]
	const safeServer = serverName.replace(/[^a-zA-Z0-9_]/g, "_")
	const safeTool = toolName.replace(/[^a-zA-Z0-9_]/g, "_")
	const ts = Date.now()
	const suffix = randomUUID().slice(0, 8)

	const sessionDir = path.join(cwdSafe, ".kilocode", "sessions", date)
	await fs.mkdir(sessionDir, { recursive: true })

	const filePath = path.join(sessionDir, `${safeServer}_${safeTool}_${ts}_${suffix}.txt`)
	await fs.writeFile(filePath, textContent, "utf-8")

	return {
		filePath: path.resolve(filePath),
		chars: textContent.length,
		lines: textContent.split("\n").length,
	}
}