// kilocode_change - new file
import * as https from "https"
import * as http from "http"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { pipeline } from "stream/promises"
import { createWriteStream, createReadStream } from "fs"
import { createGunzip } from "zlib"
import * as tar from "tar"

export interface DownloadOptions {
	version?: string
	cachePath: string
	platform?: string
	arch?: string
}

export interface VSCodeRelease {
	url: string
	name: string
	version: string
	commit: string
}

/**
 * Custom VS Code downloader with multiple fallback sources
 * Implements strategies for handling update service outages
 */
export class VSCodeDownloader {
	private readonly platform: string
	private readonly arch: string

	constructor() {
		this.platform = this.getPlatform()
		this.arch = this.getArch()
	}

	/**
	 * Download VS Code with multiple fallback sources
	 */
	async downloadAndExtract(options: DownloadOptions): Promise<string> {
		const { version = "stable", cachePath } = options

		console.log(`🔍 Attempting to download VS Code ${version} for ${this.platform}-${this.arch}`)

		// Ensure cache directory exists
		await fs.promises.mkdir(cachePath, { recursive: true })

		// Check if already cached
		const cachedPath = await this.checkCache(cachePath, version)
		if (cachedPath) {
			console.log(`✅ Using cached VS Code: ${cachedPath}`)
			return cachedPath
		}

		const sources = await this.getDownloadSources(version)

		for (let i = 0; i < sources.length; i++) {
			const source = sources[i]
			console.log(`🔄 Trying source ${i + 1}/${sources.length}: ${source.name}`)

			try {
				const downloadPath = await this.downloadFromSource(source, cachePath)
				const extractedPath = await this.extractVSCode(downloadPath, cachePath, source.version)

				console.log(`✅ Successfully downloaded and extracted VS Code from ${source.name}`)
				return extractedPath
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				console.warn(`❌ Failed to download from ${source.name}:`, errorMessage)

				if (i === sources.length - 1) {
					throw new Error(`All download sources failed. Last error: ${errorMessage}`)
				}
			}
		}

		throw new Error("No download sources available")
	}

	/**
	 * Get ordered list of download sources with fallbacks
	 */
	private getDownloadSources(version: string): VSCodeRelease[] {
		const sources: VSCodeRelease[] = []

		// 1. Try to get official release info first (for commit hash)
		const officialUrl = this.getOfficialDownloadUrl(version)
		if (officialUrl) {
			sources.push({
				url: officialUrl,
				name: "Official VS Code Update Service",
				version,
				commit: "unknown", // Will be determined later
			})
		}

		// 2. Microsoft CDN direct links (multiple patterns)
		const cdnUrls = this.getCDNDownloadUrls(version)
		cdnUrls.forEach((cdnUrl, index) => {
			sources.push({
				url: cdnUrl.url,
				name: `Microsoft CDN ${index + 1}`,
				version,
				commit: cdnUrl.commit || "latest",
			})
		})

		// 3. VSCodium as fallback
		const vscodiumUrl = this.getVSCodiumDownloadUrl(version)
		if (vscodiumUrl) {
			sources.push({
				url: vscodiumUrl,
				name: "VSCodium (Open Source Build)",
				version,
				commit: "vscodium",
			})
		}

		return sources
	}

	/**
	 * Official VS Code download URL
	 */
	private getOfficialDownloadUrl(version: string): string | null {
		const platformMap = {
			"win32-x64": "win32-x64",
			"win32-arm64": "win32-arm64",
			"linux-x64": "linux-x64",
			"linux-arm64": "linux-arm64",
			"darwin-x64": "darwin",
			"darwin-arm64": "darwin-arm64",
		}

		const platformKey = `${this.platform}-${this.arch}` as keyof typeof platformMap
		const officialPlatform = platformMap[platformKey]

		if (!officialPlatform) return null

		const isInsiders = version === "insiders"
		const quality = isInsiders ? "insider" : "stable"

		// This is the URL that might be down, but we try it first
		return `https://update.code.visualstudio.com/latest/${officialPlatform}/${quality}`
	}

	/**
	 * Microsoft CDN direct download URLs (bypassing update service)
	 */
	private getCDNDownloadUrls(version: string): Array<{ url: string; commit?: string }> {
		const urls: Array<{ url: string; commit?: string }> = []

		// Known recent commits - you'd ideally get these from GitHub releases
		const recentCommits = [
			"863d2581ecda6849923a2118d93a088b0745d9d6", // Recent stable
			"f1e16e1e6214d7c44d078b1f0607b2388f29d729", // Another recent
			"latest", // Fallback
		]

		const platformMap = {
			"win32-x64": "VSCodeSetup-x64-{version}.exe",
			"win32-arm64": "VSCodeSetup-arm64-{version}.exe",
			"linux-x64": "vscode-server-linux-x64.tar.gz",
			"linux-arm64": "vscode-server-linux-arm64.tar.gz",
			"darwin-x64": "VSCode-darwin-universal.zip",
			"darwin-arm64": "VSCode-darwin-universal.zip",
		}

		const platformKey = `${this.platform}-${this.arch}` as keyof typeof platformMap
		const filename = platformMap[platformKey]

		if (!filename) return urls

		// Try different CDN patterns
		recentCommits.forEach((commit) => {
			// Primary CDN pattern
			urls.push({
				url: `https://vscode.download.prss.microsoft.com/dbazure/download/stable/${commit}/${filename.replace("{version}", version)}`,
				commit,
			})

			// Alternative CDN pattern
			urls.push({
				url: `https://az764295.vo.msecnd.net/stable/${commit}/${filename.replace("{version}", version)}`,
				commit,
			})
		})

		return urls
	}

	/**
	 * VSCodium download URL as final fallback
	 */
	private getVSCodiumDownloadUrl(version: string): string | null {
		// VSCodium GitHub releases
		const platformMap = {
			"win32-x64": "VSCodium-win32-x64-{version}.zip",
			"win32-arm64": "VSCodium-win32-arm64-{version}.zip",
			"linux-x64": "VSCodium-linux-x64-{version}.tar.gz",
			"linux-arm64": "VSCodium-linux-arm64-{version}.tar.gz",
			"darwin-x64": "VSCodium-darwin-universal-{version}.zip",
			"darwin-arm64": "VSCodium-darwin-universal-{version}.zip",
		}

		const platformKey = `${this.platform}-${this.arch}` as keyof typeof platformMap
		const filename = platformMap[platformKey]

		if (!filename) return null

		// Use latest release if version is "stable"
		const versionTag = version === "stable" ? "latest" : version

		return `https://github.com/VSCodium/vscodium/releases/${versionTag}/download/${filename.replace("{version}", versionTag)}`
	}

	/**
	 * Download from a specific source
	 */
	private async downloadFromSource(source: VSCodeRelease, cachePath: string): Promise<string> {
		const filename = path.basename(new URL(source.url).pathname)
		const downloadPath = path.join(cachePath, `${source.commit}-${filename}`)

		// Skip download if file already exists and is valid
		if (fs.existsSync(downloadPath)) {
			const stats = await fs.promises.stat(downloadPath)
			if (stats.size > 1024 * 1024) {
				// At least 1MB
				console.log(`📦 Reusing existing download: ${downloadPath}`)
				return downloadPath
			}
		}

		console.log(`📥 Downloading from: ${source.url}`)

		await this.downloadFile(source.url, downloadPath)

		// Verify download
		const stats = await fs.promises.stat(downloadPath)
		if (stats.size < 1024 * 1024) {
			throw new Error(`Downloaded file too small: ${stats.size} bytes`)
		}

		return downloadPath
	}

	/**
	 * Download a file with progress
	 */
	private async downloadFile(url: string, outputPath: string): Promise<void> {
		const client = url.startsWith("https:") ? https : http

		return new Promise((resolve, reject) => {
			const request = client.get(url, (response) => {
				if (response.statusCode === 302 || response.statusCode === 301) {
					// Handle redirect
					const redirectUrl = response.headers.location
					if (redirectUrl) {
						this.downloadFile(redirectUrl, outputPath).then(resolve).catch(reject)
						return
					}
				}

				if (response.statusCode !== 200) {
					reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
					return
				}

				const fileStream = createWriteStream(outputPath)
				const contentLength = parseInt(response.headers["content-length"] || "0")
				let downloaded = 0

				response.on("data", (chunk) => {
					downloaded += chunk.length
					if (contentLength > 0) {
						const percent = Math.round((downloaded / contentLength) * 100)
						process.stdout.write(`\r📥 Progress: ${percent}% (${Math.round(downloaded / 1024 / 1024)}MB)`)
					}
				})

				response.pipe(fileStream)

				fileStream.on("finish", () => {
					console.log("\n✅ Download completed")
					resolve()
				})

				fileStream.on("error", reject)
			})

			request.on("error", reject)
			request.setTimeout(300000) // 5 minute timeout
		})
	}

	/**
	 * Extract VS Code archive
	 */
	private async extractVSCode(downloadPath: string, cachePath: string, version: string): Promise<string> {
		const extractPath = path.join(cachePath, `vscode-${version}-${this.platform}-${this.arch}`)

		// Clean existing extraction
		if (fs.existsSync(extractPath)) {
			await fs.promises.rm(extractPath, { recursive: true })
		}

		await fs.promises.mkdir(extractPath, { recursive: true })

		console.log(`📦 Extracting to: ${extractPath}`)

		if (downloadPath.endsWith(".tar.gz")) {
			await this.extractTarGz(downloadPath, extractPath)
		} else if (downloadPath.endsWith(".zip")) {
			await this.extractZip(downloadPath, extractPath)
		} else {
			throw new Error(`Unsupported archive format: ${downloadPath}`)
		}

		// Find the VS Code executable
		const executablePath = await this.findVSCodeExecutable(extractPath)

		return executablePath
	}

	/**
	 * Extract tar.gz files
	 */
	private async extractTarGz(archivePath: string, extractPath: string): Promise<void> {
		const readStream = createReadStream(archivePath)
		const gunzipStream = createGunzip()

		await pipeline(readStream, gunzipStream, tar.extract({ cwd: extractPath, strip: 1 }))
	}

	/**
	 * Extract zip files (basic implementation - you might want to use a proper zip library)
	 */
	private async extractZip(archivePath: string, extractPath: string): Promise<void> {
		// For now, throw an error and suggest using tar.gz for Linux
		// In a production system, you'd use a proper zip extraction library
		throw new Error(
			"ZIP extraction not implemented. Consider using Linux builds (.tar.gz) or implement proper ZIP handling.",
		)
	}

	/**
	 * Find VS Code executable in extracted directory
	 */
	private async findVSCodeExecutable(extractPath: string): Promise<string> {
		const possiblePaths = [
			path.join(extractPath, "code"),
			path.join(extractPath, "bin", "code"),
			path.join(extractPath, "VSCode.app", "Contents", "MacOS", "Electron"),
			path.join(extractPath, "Code.exe"),
			path.join(extractPath, "bin", "code-server"),
		]

		for (const possiblePath of possiblePaths) {
			if (fs.existsSync(possiblePath)) {
				// Make executable on Unix systems
				if (this.platform !== "win32") {
					await fs.promises.chmod(possiblePath, 0o755)
				}
				return possiblePath
			}
		}

		// Fallback: look for any executable file
		const files = await this.findExecutables(extractPath)
		if (files.length > 0) {
			return files[0]
		}

		throw new Error(`Could not find VS Code executable in ${extractPath}`)
	}

	/**
	 * Find executable files recursively
	 */
	private async findExecutables(dir: string): Promise<string[]> {
		const executables: string[] = []
		const entries = await fs.promises.readdir(dir, { withFileTypes: true })

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name)

			if (entry.isDirectory()) {
				const subExecutables = await this.findExecutables(fullPath)
				executables.push(...subExecutables)
			} else if (entry.isFile()) {
				const stats = await fs.promises.stat(fullPath)
				// Check if file is executable
				if (stats.mode & 0o111) {
					executables.push(fullPath)
				}
			}
		}

		return executables
	}

	/**
	 * Check if VS Code is already cached
	 */
	private async checkCache(cachePath: string, version: string): Promise<string | null> {
		const cachePattern = `vscode-${version}-${this.platform}-${this.arch}`

		try {
			const entries = await fs.promises.readdir(cachePath)
			const cachedDir = entries.find((entry) => entry.startsWith(cachePattern))

			if (cachedDir) {
				const cachedPath = path.join(cachePath, cachedDir)
				const executable = await this.findVSCodeExecutable(cachedPath)
				return executable
			}
		} catch (error) {
			// Cache directory doesn't exist or other error
		}

		return null
	}

	/**
	 * Get current platform
	 */
	private getPlatform(): string {
		switch (os.platform()) {
			case "win32":
				return "win32"
			case "darwin":
				return "darwin"
			case "linux":
				return "linux"
			default:
				return "linux"
		}
	}

	/**
	 * Get current architecture
	 */
	private getArch(): string {
		switch (os.arch()) {
			case "x64":
				return "x64"
			case "arm64":
				return "arm64"
			case "arm":
				return "arm64"
			default:
				return "x64"
		}
	}

	/**
	 * Get the latest VS Code commit hash from GitHub API
	 */
	private async getLatestVSCodeCommit(version: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const url =
				version === "insiders"
					? "https://api.github.com/repos/microsoft/vscode/commits/main"
					: "https://api.github.com/repos/microsoft/vscode/releases/latest"

			const request = https.get(
				url,
				{
					headers: {
						"User-Agent": "VSCode-Downloader/1.0",
					},
				},
				(response) => {
					if (response.statusCode !== 200) {
						reject(new Error(`GitHub API returned ${response.statusCode}`))
						return
					}

					let data = ""
					response.on("data", (chunk) => (data += chunk))
					response.on("end", () => {
						try {
							const json = JSON.parse(data)
							const commit = version === "insiders" ? json.sha : json.tag_name
							resolve(commit)
						} catch (error) {
							reject(new Error("Failed to parse GitHub API response"))
						}
					})
				},
			)

			request.on("error", reject)
			request.setTimeout(10000) // 10 second timeout
		})
	}

	/**
	 * Get the latest VSCodium version from GitHub releases
	 */
	private async getLatestVSCodiumVersion(): Promise<string> {
		return new Promise((resolve, reject) => {
			const url = "https://api.github.com/repos/VSCodium/vscodium/releases/latest"

			const request = https.get(
				url,
				{
					headers: {
						"User-Agent": "VSCode-Downloader/1.0",
					},
				},
				(response) => {
					if (response.statusCode !== 200) {
						reject(new Error(`GitHub API returned ${response.statusCode}`))
						return
					}

					let data = ""
					response.on("data", (chunk) => (data += chunk))
					response.on("end", () => {
						try {
							const json = JSON.parse(data)
							resolve(json.tag_name)
						} catch (error) {
							reject(new Error("Failed to parse GitHub API response"))
						}
					})
				},
			)

			request.on("error", reject)
			request.setTimeout(10000) // 10 second timeout
		})
	}
}

/**
 * Main export function compatible with @vscode/test-electron API
 */
export async function downloadAndUnzipVSCode(options: DownloadOptions): Promise<string> {
	const downloader = new VSCodeDownloader()
	return await downloader.downloadAndExtract(options)
}
