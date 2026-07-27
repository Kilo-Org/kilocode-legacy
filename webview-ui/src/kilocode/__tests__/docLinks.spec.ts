import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { buildDocLink } from "@/utils/docLinks"

const root = "https://github.com/Kilo-Org/kilocode-legacy/blob/main/docs/legacy-ides"
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const archive = path.join(repo, "docs/legacy-ides")

describe("buildDocLink", () => {
	it("maps the documentation root to the archive index", () => {
		expect(buildDocLink("", "welcome")).toBe(`${root}/README.md`)
	})

	it("maps provider routes to provider Markdown files", () => {
		expect(buildDocLink("providers/anthropic", "provider_docs")).toBe(`${root}/ai-providers/anthropic.md`)
		expect(buildDocLink("providers/openai-codex", "provider_docs")).toBe(
			`${root}/ai-providers/openai-chatgpt-plus-pro.md`,
		)
	})

	it("maps historical aliases to their archive pages", () => {
		expect(buildDocLink("/basic-usage/using-modes", "tips")).toBe(`${root}/code-with-ai/agents/using-agents.md`)
		expect(buildDocLink("troubleshooting/shell-integration/", "error_tooltip")).toBe(
			`${root}/automate/extending/shell-integration.md`,
		)
	})

	it("preserves fragments after route mapping", () => {
		expect(buildDocLink("features/shell-integration#terminal-output-limit", "terminal_settings")).toBe(
			`${root}/automate/extending/shell-integration.md#terminal-output-limit`,
		)
	})

	it("maps tested links to files in the archive", () => {
		const links = [
			buildDocLink("", "welcome"),
			buildDocLink("providers/anthropic", "provider_docs"),
			buildDocLink("providers/openai-codex", "provider_docs"),
			buildDocLink("basic-usage/using-modes", "tips"),
			buildDocLink("troubleshooting/shell-integration", "error_tooltip"),
		]

		for (const link of links) {
			const file = link.replace(`${root}/`, "").split("#", 1)[0]
			expect(fs.existsSync(path.join(archive, file)), link).toBe(true)
		}
	})
})

describe("legacy documentation archive", () => {
	it("contains every unique manifest destination", () => {
		const manifest = JSON.parse(
			fs.readFileSync(path.join(archive, "migration-manifest.json"), "utf8"),
		) as Array<{ destination: string }>
		const destinations = manifest.map((entry) => entry.destination)

		expect(new Set(destinations).size).toBe(destinations.length)
		for (const destination of destinations) {
			expect(fs.existsSync(path.join(repo, destination)), destination).toBe(true)
		}
	})

	it("has no broken relative Markdown links or images", () => {
		const manifest = JSON.parse(
			fs.readFileSync(path.join(archive, "migration-manifest.json"), "utf8"),
		) as Array<{ destination: string }>
		const files = [
			path.join(archive, "README.md"),
			path.join(archive, "ai-providers/README.md"),
			...manifest.map((entry) => path.join(repo, entry.destination)),
		]
		const missing: string[] = []

		for (const file of files) {
			const content = fs.readFileSync(file, "utf8")
			for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
				const link = match[1].split("#", 1)[0]
				if (!link || /^(?:https?:|mailto:)/.test(link)) continue
				const target = path.resolve(path.dirname(file), decodeURIComponent(link))
				if (!fs.existsSync(target)) missing.push(`${path.relative(repo, file)} -> ${link}`)
			}
		}

		expect(missing).toEqual([])
	})
})
