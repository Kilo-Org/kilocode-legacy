---
"kilo-code": patch
---

Add __save_to_file parameter to MCP tool/resource calls

When the AI sets `__save_to_file: true` on an MCP tool or resource call,
the response is saved to `.kilocode/sessions/` as a `.txt` file and a file
reference enters the conversation instead of the full output. The AI can
then use `read_file` or `search_files` to retrieve specific parts later.