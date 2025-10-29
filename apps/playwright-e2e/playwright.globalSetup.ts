// kilocode_change - new file
import { downloadAndUnzipVSCode } from "./src/vscode-downloader.js"
import * as path from "path"
import * as fs from "fs"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default async () => {
	const workspaceRoot = path.resolve(__dirname, "../..")
	const vscodeTestDir = path.join(workspaceRoot, ".docker-cache", "vscode")

	await fs.promises.mkdir(vscodeTestDir, { recursive: true })

	console.log(`Using VS Code cache directory: ${vscodeTestDir}`)
	console.log("🚀 Downloading VS Code stable with fallback sources...")

	try {
		const vscodePath = await downloadAndUnzipVSCode({
			version: "stable",
			cachePath: vscodeTestDir,
		})

		// Store the VS Code executable path for tests to use
		process.env.VSCODE_EXECUTABLE_PATH = vscodePath
		console.log(`✅ VS Code executable path: ${vscodePath}`)

		// console.log("Downloading VS Code insiders...")
		// await downloadAndUnzipVSCode({ version: "insiders", cachePath: vscodeTestDir })

		console.log("🎉 VS Code downloads completed successfully!")
	} catch (error) {
		console.error("❌ Failed to download VS Code:", error instanceof Error ? error.message : String(error))

		// Try fallback to original downloader as last resort
		console.log("🔄 Attempting fallback to original downloader...")
		try {
			const { downloadAndUnzipVSCode: originalDownloader } = await import("@vscode/test-electron/out/download.js")
			const vscodePath = await originalDownloader({ version: "stable", cachePath: vscodeTestDir })

			process.env.VSCODE_EXECUTABLE_PATH = vscodePath
			console.log(`✅ Fallback successful. VS Code executable path: ${vscodePath}`)
		} catch (fallbackError) {
			console.error(
				"❌ Fallback also failed:",
				fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
			)
			throw new Error("All VS Code download methods failed. Please check your internet connection and try again.")
		}
	}
}
