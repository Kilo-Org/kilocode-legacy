# Batch Screenshot Flakiness Detector

Detects screenshot flakiness by running Playwright tests multiple times and comparing results pixel-by-pixel.

## Quick Start

```bash
# Install dependencies
cd apps/playwright-e2e && pnpm install

# Run test 10 times locally (fast)
node scripts/batch-screenshot-test.js --test tests/chat.test.ts

# Run in Docker (matches CI, recommended for final verification)
node scripts/batch-screenshot-test.js --test tests/chat.test.ts --docker
```

## Options

| Option               | Description                       | Default |
| -------------------- | --------------------------------- | ------- |
| `--test <path>`      | Path to test file (required)      | -       |
| `--iterations <n>`   | Number of test runs               | 10      |
| `--threshold <n>`    | Pixel difference threshold (0-1)  | 0.1     |
| `--docker`           | Run in Docker (matches CI)        | false   |
| `--keep-screenshots` | Keep screenshots after comparison | false   |

## Output

Results saved to `screenshots/batch-<timestamp>/`:

```
✅ CONSISTENT - All iterations matched
❌ FLAKY - 3 out of 9 comparisons showed differences
   • Iteration 4: 0.0234% different (156 pixels)
     Diff: screenshots/batch-*/diffs/screenshot-iter4-diff.png
```

## Workflow

```bash
# 1. Quick local test (5 iterations)
node scripts/batch-screenshot-test.js --test tests/chat.test.ts --iterations 5

# 2. Thorough Docker test before committing (20 iterations)
node scripts/batch-screenshot-test.js --test tests/chat.test.ts --iterations 20 --docker

# 3. Check diff images if flakes detected
ls screenshots/batch-*/diffs/
```

## Tips

- **Local mode**: Fast iteration during development
- **Docker mode**: Final verification before committing (matches CI)
- **Start with 5-10 iterations** for quick feedback
- **Use 20-30 iterations** for confidence before merging
- **Increase threshold** (e.g., `--threshold 0.2`) if getting false positives from anti-aliasing
- **Check diff images** (red pixels show differences) to understand what's changing
