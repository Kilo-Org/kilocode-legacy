# Orchestrator Mode

Orchestrator mode breaks a complex request into subtasks and delegates each subtask to another mode.

## Delegating work

Orchestrator uses two dedicated tools:

1. [`new_task`](../../automate/tools/new-task.md) creates a subtask, passes context through the `message` parameter, and selects a mode such as Code, Architect, or Debug.
2. [`attempt_completion`](../../automate/tools/attempt-completion.md) signals that a subtask is complete and returns its result to the parent task.

[Watch the Orchestrator Mode video](https://www.youtube.com/watch?v=20MmJNeOODo)
