#!/usr/bin/env node
// kilocode_change - new file
/**
 * Batch Screenshot Flakiness Detector
 *
 * This script runs a specific Playwright test multiple times and compares
 * all generated screenshots to detect flakiness (visual differences between runs).
 *
 * Usage:
 *   node scripts/batch-screenshot-test.js --test tests/chat.test.ts --iterations 10
 *   node scripts/batch-screenshot-test.js --test tests/chat.test.ts --iterations 20 --threshold 0.1 --docker
 *
 * Options:
 *   --test <path>         Path to the test file (required)
 *   --iterations <n>      Number of times to run the test (default: 10)
 *   --threshold <n>       Pixel difference threshold 0-1 (default: 0.1, lower = more strict)
 *   --docker              Run tests in Docker (default: false, runs locally)
 *   --keep-screenshots    Keep all screenshots after comparison (default: false)
 */

import { execSync } from "child_process"
import fs from "fs-extra"
import * as path from "path"
import { fileURLToPath } from "url"
import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"
import chalk from "chalk"
import signale from "signale"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse command line arguments
function parseArgs() {
	const args = process.argv.slice(2)
	const config = {
		testFile: null,
		iterations: 10,
		threshold: 0.1,
		useDocker: false,
		keepScreenshots: false,
	}

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case "--test":
				config.testFile = args[++i]
				break
			case "--iterations":
				config.iterations = parseInt(args[++i], 10)
				break
			case "--threshold":
				config.threshold = parseFloat(args[++i])
				break
			case "--docker":
				config.useDocker = true
				break
			case "--keep-screenshots":
				config.keepScreenshots = true
				break
			case "--help":
				console.log(`
Batch Screenshot Flakiness Detector

Usage:
  node scripts/batch-screenshot-test.js --test <path> [options]

Options:
  --test <path>         Path to the test file (required)
  --iterations <n>      Number of times to run the test (default: 10)
  --threshold <n>       Pixel difference threshold 0-1 (default: 0.1)
  --docker              Run tests in Docker (default: false, runs locally)
  --keep-screenshots    Keep all screenshots after comparison
  --help               Show this help message

Examples:
  # Run locally with 10 iterations
  node scripts/batch-screenshot-test.js --test tests/chat.test.ts

  # Run in Docker with 20 iterations
  node scripts/batch-screenshot-test.js --test tests/chat.test.ts --iterations 20 --docker

  # Run with stricter comparison threshold
  node scripts/batch-screenshot-test.js --test tests/chat.test.ts --threshold 0.05
				`)
				process.exit(0)
		}
	}

	if (!config.testFile) {
		signale.error("--test argument is required")
		process.exit(1)
	}

	return config
}

// Run a single test iteration
async function runTestIteration(testFile, iteration, useDocker) {
	const testResultsDir = path.join(__dirname, "..", "test-results")

	// Clean test-results before each run to avoid conflicts
	if (fs.existsSync(testResultsDir)) {
		await fs.remove(testResultsDir)
	}

	const runMode = useDocker ? "Docker" : "Local"
	console.log(chalk.bold.cyan(`\n${"=".repeat(80)}`))
	console.log(chalk.bold.cyan(`Iteration ${iteration} - Running ${runMode} Playwright Test`))
	console.log(chalk.bold.cyan("=".repeat(80) + "\n"))

	try {
		const command = useDocker ? `node run-docker-playwright.js ${testFile}` : `npx playwright test ${testFile}`

		execSync(command, {
			cwd: path.join(__dirname, ".."),
			stdio: "inherit", // Pass through all output so we can see progress
			env: {
				...process.env,
				PLAYWRIGHT_VERBOSE_LOGS: "false",
			},
		})
		console.log(chalk.green(`\n✅ Iteration ${iteration} completed successfully\n`))
	} catch (error) {
		// Test might fail but we still want screenshots
		console.log(chalk.yellow(`\n⚠️  Iteration ${iteration} failed, but continuing...\n`))
	}

	// Find and copy screenshots from this iteration
	const screenshots = []
	if (fs.existsSync(testResultsDir)) {
		const files = await fs.readdir(testResultsDir, { recursive: true })
		for (const file of files) {
			if (file.endsWith(".png")) {
				screenshots.push(path.join(testResultsDir, file))
			}
		}
	}

	return screenshots
}

// Compare two PNG images using pixelmatch
function compareImages(img1Path, img2Path, threshold) {
	const img1 = PNG.sync.read(fs.readFileSync(img1Path))
	const img2 = PNG.sync.read(fs.readFileSync(img2Path))

	const { width, height } = img1

	// Ensure images are the same size
	if (width !== img2.width || height !== img2.height) {
		return {
			different: true,
			diffPixels: width * height,
			diffPercentage: 100,
			reason: "Different dimensions",
		}
	}

	const diff = new PNG({ width, height })
	const diffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold })

	const totalPixels = width * height
	const diffPercentage = (diffPixels / totalPixels) * 100

	return {
		different: diffPixels > 0,
		diffPixels,
		diffPercentage,
		diffImage: diff,
	}
}

// Main execution
async function main() {
	const config = parseArgs()

	signale.start(`Starting batch screenshot test`)
	signale.info(`Test file: ${config.testFile}`)
	signale.info(`Iterations: ${config.iterations}`)
	signale.info(`Threshold: ${config.threshold}`)
	signale.info(`Run mode: ${config.useDocker ? "Docker" : "Local"}`)

	const batchDir = path.join(__dirname, "..", "screenshots", `batch-${Date.now()}`)
	await fs.ensureDir(batchDir)

	// Store screenshots from each iteration
	const allScreenshots = new Map() // screenshotName -> [paths]

	// Run test multiple times
	for (let i = 1; i <= config.iterations; i++) {
		const screenshots = await runTestIteration(config.testFile, i, config.useDocker)

		// Organize screenshots by name
		for (const screenshotPath of screenshots) {
			const filename = path.basename(screenshotPath)
			const iterationDir = path.join(batchDir, `iteration-${i}`)
			await fs.ensureDir(iterationDir)

			const destPath = path.join(iterationDir, filename)
			await fs.copy(screenshotPath, destPath)

			if (!allScreenshots.has(filename)) {
				allScreenshots.set(filename, [])
			}
			allScreenshots.get(filename).push(destPath)
		}
	}

	signale.success(`Completed ${config.iterations} test iterations`)
	signale.info(`Screenshots saved to: ${batchDir}`)

	// Compare all screenshots
	console.log("\n" + chalk.bold.cyan("=".repeat(80)))
	console.log(chalk.bold.cyan("Screenshot Comparison Results"))
	console.log(chalk.bold.cyan("=".repeat(80)) + "\n")

	const flakeReport = []

	for (const [screenshotName, paths] of allScreenshots.entries()) {
		console.log(chalk.bold.white(`\n📸 ${screenshotName}`))
		console.log(chalk.gray(`   Found ${paths.length} instances across iterations\n`))

		if (paths.length < 2) {
			console.log(chalk.yellow("   ⚠️  Only one instance found, skipping comparison"))
			continue
		}

		// Compare each screenshot with the first one (baseline)
		const baseline = paths[0]
		const differences = []
		let hasFlakes = false

		for (let i = 1; i < paths.length; i++) {
			const comparison = compareImages(baseline, paths[i], config.threshold)

			if (comparison.different) {
				hasFlakes = true
				differences.push({
					iteration: i + 1,
					...comparison,
				})
			}
		}

		if (hasFlakes) {
			console.log(chalk.red.bold("   ❌ FLAKY SCREENSHOT DETECTED!"))
			console.log(
				chalk.red(`   ${differences.length} out of ${paths.length - 1} comparisons showed differences\n`),
			)

			// Show details of differences
			for (const diff of differences) {
				console.log(
					chalk.red(
						`   • Iteration ${diff.iteration}: ${diff.diffPercentage.toFixed(4)}% different (${diff.diffPixels} pixels)`,
					),
				)

				// Save diff image
				if (diff.diffImage) {
					const diffDir = path.join(batchDir, "diffs")
					await fs.ensureDir(diffDir)
					const diffPath = path.join(
						diffDir,
						`${screenshotName.replace(".png", "")}-iter${diff.iteration}-diff.png`,
					)
					await fs.writeFile(diffPath, PNG.sync.write(diff.diffImage))
					console.log(chalk.gray(`     Diff image: ${path.relative(process.cwd(), diffPath)}`))
				}
			}

			flakeReport.push({
				screenshot: screenshotName,
				totalComparisons: paths.length - 1,
				flakeCount: differences.length,
				flakeRate: (differences.length / (paths.length - 1)) * 100,
				maxDiffPercentage: Math.max(...differences.map((d) => d.diffPercentage)),
			})
		} else {
			console.log(chalk.green.bold("   ✅ CONSISTENT - No differences detected"))
			console.log(chalk.green(`   All ${paths.length - 1} comparisons matched the baseline\n`))
		}
	}

	// Final summary
	console.log("\n" + chalk.bold.cyan("=".repeat(80)))
	console.log(chalk.bold.cyan("Summary"))
	console.log(chalk.bold.cyan("=".repeat(80)) + "\n")

	if (flakeReport.length === 0) {
		console.log(chalk.green.bold("🎉 SUCCESS! No flaky screenshots detected."))
		console.log(chalk.green(`All screenshots were consistent across ${config.iterations} iterations.\n`))
	} else {
		console.log(chalk.red.bold(`⚠️  FLAKINESS DETECTED in ${flakeReport.length} screenshot(s):\n`))

		for (const flake of flakeReport) {
			console.log(chalk.red(`• ${flake.screenshot}`))
			console.log(
				chalk.gray(
					`  Flake rate: ${flake.flakeRate.toFixed(1)}% (${flake.flakeCount}/${flake.totalComparisons} comparisons)`,
				),
			)
			console.log(chalk.gray(`  Max difference: ${flake.maxDiffPercentage.toFixed(4)}%\n`))
		}
	}

	console.log(chalk.cyan(`Results saved to: ${path.relative(process.cwd(), batchDir)}\n`))

	// Cleanup
	if (!config.keepScreenshots) {
		signale.info("Cleaning up test-results directory...")
		const testResultsDir = path.join(__dirname, "..", "test-results")
		if (fs.existsSync(testResultsDir)) {
			await fs.remove(testResultsDir)
		}
	}

	// Exit with error code if flakes detected
	process.exit(flakeReport.length > 0 ? 1 : 0)
}

main().catch((error) => {
	signale.error("Script failed:", error)
	process.exit(1)
})
