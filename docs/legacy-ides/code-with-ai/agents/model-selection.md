# Model Selection Guide

Here's the honest truth about AI model recommendations: by the time I write them down, they're probably already outdated. New models drop every few weeks, existing ones get updated, prices shift, and yesterday's champion becomes today's budget option.

Instead of maintaining a static list that's perpetually behind, we built something better — a real-time leaderboard showing which models Kilo Code users are actually having success with right now.

## Check the Live Models List

**[👉 See what's working today at kilo.ai/models](https://kilo.ai/models)**

This isn't benchmarks from some lab. It's real usage data from developers like you, updated continuously. You'll see which models people are choosing for different tasks, what's delivering results, and how the landscape is shifting in real-time.

## General Guidance

While the specifics change constantly, some principles stay consistent:

### How to Select and Switch Models

- Use the **model dropdown** in the chat panel to select a model for each conversation.
- Configure **API profiles** in Settings to group provider + model combinations and switch between them quickly.
- Models are **sticky per mode** — each mode (Code, Architect, Debug, etc.) remembers the last model you selected.

**For complex coding tasks**: Premium models (Claude Sonnet/Opus, GPT-5 class, Gemini Pro) typically handle nuanced requirements, large refactors, and architectural decisions better.

**For everyday coding**: Mid-tier models often provide the best balance of speed, cost, and quality. They're fast enough to keep your flow state intact and capable enough for most tasks.

**For budget-conscious work**: Newer efficient models keep surprising us with price-to-performance ratios. DeepSeek, Qwen, and similar models can handle more than you'd expect. See the [free and budget picks](#free-and-budget-model-picks) below.

**For local/private work**: Ollama and LM Studio let you run models locally. The tradeoff is usually speed and capability for privacy and zero API costs.

**Using an unlisted model?** Providers such as Ollama, LM Studio, and OpenAI Compatible accept a model ID directly in the API Provider settings.

## Free and Budget Model Picks

Free model availability changes as providers adjust promotional periods. Check [kilo.ai/models](https://kilo.ai/models) for the current list, then select the corresponding provider and model in an API profile.

## Context Windows Matter

One thing that doesn't change: context window size matters for your workflow.

- **Small projects** (scripts, components): 32-64K tokens works fine
- **Standard applications**: 128K tokens handles most multi-file context
- **Large codebases**: 256K+ tokens helps with cross-system understanding
- **Massive systems**: 1M+ token models exist but effectiveness degrades at the extremes

Check [our provider docs](../../ai-providers/README.md) for specific context limits on each model.

> **Tip:** > **Be thoughtful about Max Tokens settings for thinking models.** Every token you allocate to output takes away from space available to store conversation history. Consider only using high `Max Tokens` / `Max Thinking Tokens` settings with modes like Architect and Debug, and keeping Code mode at 16k max tokens or less.

> **Tip:** > **Recover from context limit errors:** If you hit the `input length and max tokens exceed context limit` error, you can recover by deleting a message, rolling back to a previous checkpoint, or switching over to a model with a long context window like Gemini for a message.

## Models During Delegation

Each mode has **Sticky Models**. Switching from one mode to another (for example, Code to Architect) uses the API profile last selected for the destination mode. This means you can assign different models to different modes:

- **Architect:** a reasoning-heavy model (Gemini Pro, Claude Opus)
- **Code:** a fast coding model (Claude Sonnet, GPT-4.1)
- **Debug:** a cost-efficient model (Gemini Flash, DeepSeek)

The API profile selection is remembered per mode across sessions and also applies when a task delegates work to another mode.

## Stay Current

The AI model space moves fast. Bookmark [kilo.ai/models](https://kilo.ai/models) and check back when you're evaluating options. What's best today might not be best next month — and that's actually exciting.
