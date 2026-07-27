# Using ChatGPT Subscriptions With Kilo Code

If you already pay for ChatGPT Plus or Pro, you can use that subscription to run OpenAI's top coding models directly inside Kilo Code — with no extra API charges beyond your subscription.

## Why use your ChatGPT subscription?

- **Flat-rate access to OpenAI models:** Your subscription covers usage without pay-as-you-go API costs.
- **OAuth login — no API keys:** Click "Sign in to OpenAI Codex," authenticate in your browser, and you're done.
- **Full agentic workflows:** Generate, refactor, debug, edit files, and run terminal commands inside Kilo Code.
- **Multiple AI modes:** Switch between Code, Plan, Debug, and Ask modes for different tasks.

## Setup

1. Open Kilo Code settings (click the gear icon gear icon in the Kilo Code panel).
2. In **API Provider**, select **OpenAI – ChatGPT Plus/Pro**.
3. Click **Sign in to OpenAI Codex**.
4. Finish the sign-in flow in your browser.
5. Back in Kilo Code settings, pick a model from the dropdown.
6. Save.

## Tips and Notes

- **Subscription Required:** You need an active ChatGPT Plus or Pro subscription. This provider won't work with free ChatGPT accounts. [Codex is included](https://developers.openai.com/codex/pricing/) in ChatGPT Plus, Pro, Business, Edu, and Enterprise plans. See [OpenAI's ChatGPT plans](https://chatgpt.com/pricing/) for more information.
- **No API Costs:** Usage through this provider counts against your ChatGPT subscription, not separately billed API usage.
- **Authentication Errors:** If you receive a CSRF or other error when completing OAuth authentication, ensure you do not have another application already listening on port 1455. You can check on Linux and Mac by using `lsof -i :1455`.
- **Sign Out:** Use the **Disconnect** button in provider settings.
- **Switching providers:** You can switch to Claude, Gemini, or local models at any time — this provider is optional.

## Limitations

- **Codex catalog models only.** This provider only exposes the models listed in Kilo Code's Codex model catalog. It does not give access to every model available through the OpenAI API.
- **OAuth tokens can't be exported with settings.** Tokens are stored in VS Code SecretStorage, which isn't included in Kilo Code's settings export.

## FAQ

**Do I need a separate API key?**
No — just sign in with OAuth using your ChatGPT subscription.

**Which ChatGPT plans include Codex access?**
ChatGPT Plus, Pro, Business, Edu, and Enterprise. Free accounts are not supported.

**How is usage billed?**
Usage counts against your ChatGPT subscription limits — there are no separate API charges.

**Can I still switch to other AI providers?**
Yes. Use OpenAI when it fits and switch to Claude, Gemini, or any local model at any time.
