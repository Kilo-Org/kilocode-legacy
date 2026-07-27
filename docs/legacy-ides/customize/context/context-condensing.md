# Context Condensing

## Overview

When working on complex tasks, conversations with Kilo Code can grow long and consume a significant portion of the AI model's context window. **Context Condensing** is a feature that intelligently summarizes your conversation history, reducing token usage while preserving the essential information needed to continue your work effectively.

## The Problem: Context Window Limits

Every AI model has a maximum context window — a limit on how much text it can process at once. As your conversation grows with code snippets, file contents, and back-and-forth discussions, you may approach this limit. When this happens, you might experience:

- Slower responses as the model processes more tokens
- Higher API costs due to increased token usage
- Eventually hitting the context limit and being unable to continue

## The Solution: Intelligent Condensing

**Context Condensing** solves this problem by creating a concise summary of your conversation that captures:

- The original task or goal
- Key decisions made during the session
- Important code changes and their context
- Current progress and next steps

This summary replaces the detailed conversation history, freeing up context window space while maintaining continuity in your work.

## How Context Condensing Works

### Automatic Triggering

Kilo Code monitors your context usage and may suggest condensing when you approach the context window limit. You'll see a notification indicating that condensing is recommended.

### Manual Condensing

You can also trigger context condensing manually at any time using:

- **Chat Command**: Type `/condense` in the chat
- **Settings**: Access condensing options through the Context Condensing settings

### The Condensing Process

When condensing is triggered:

1. **Analysis**: Kilo Code analyzes the entire conversation history
2. **Summarization**: A summary is generated using the configured API, capturing essential context
3. **Replacement**: The detailed history is replaced with the condensed summary
4. **Continuation**: You can continue working with the freed-up context space

## Configuration Options

### API Configuration

Context Condensing uses an AI model to generate summaries. You can configure which API to use for condensing operations:

- Use the same API as your main coding assistant
- Configure a separate, potentially more cost-effective API for condensing

### Profile-Specific Settings

You can configure context condensing thresholds and behavior on a per-profile basis, allowing different settings for different projects or use cases.

## Troubleshooting

### Context Condensing Error

If you see a "Context Condensing Error" message:

- Check your API configuration and ensure it's valid
- Verify you have sufficient credits or API quota
- Try using a different API for condensing operations

### Summary Quality

If the condensed summary doesn't capture important details:

- Consider condensing earlier, before the conversation becomes too long
- Use clear, specific language when describing your tasks
- Important context can be reinforced after condensing by reminding Kilo Code of key details

## Best Practices

### When to Compact

- **Long sessions**: If you've been working for an extended period on a complex task
- **Before major transitions**: When switching to a different aspect of your project
- **When approaching limits**: Run `/compact` manually before hitting the automatic trigger if you want control over _when_ the summary is produced

### Tuning compaction triggers

Use `compaction.threshold_percent` when you want compaction to happen at a predictable share of the model window, such as `80` for earlier summaries on long tasks.

The reserved safety buffer still applies and can trigger compaction earlier than the percentage threshold.

On models that advertise a separate input limit, the `reserved` value is a trade-off:

- **Lower value** (e.g. `10000`) → compaction triggers later, you get more turns out of the raw window, but you risk a mid-turn context overflow if a single response is larger than the buffer.
- **Higher value** (e.g. `40000`) → compaction triggers earlier, fewer overflow errors, but shorter effective conversations between summaries.

The default of `~20K` is tuned to leave room for a full-size assistant response plus tool output. The setting has no effect on models with a single context window, which always reserve their full output cap instead.

### Maintaining Context Quality

- **Be specific in your initial task**: A clear task description helps create better summaries
- **Use AGENTS.md**: Combine with [AGENTS.md](../agents-md.md) for persistent project context that doesn't need to be compacted
- **Review the summary**: After compaction, the summary is visible in your chat history

## Related Features

- [AGENTS.md](../agents-md.md) - Persistent context storage across sessions
- [Large Projects](large-projects.md) - Managing context for large codebases
- [Codebase Indexing](codebase-indexing.md) - Efficient code search and retrieval
