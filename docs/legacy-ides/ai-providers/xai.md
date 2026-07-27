# Using xAI (Grok) With Kilo Code

xAI is the company behind Grok, a large language model known for its conversational abilities and large context window. Grok models are designed to provide helpful, informative, and contextually relevant responses.

**Website:** [https://x.ai/](https://x.ai/)

Kilo Code supports two ways to connect xAI:

- **SuperGrok or X Premium subscription (OAuth):** If you subscribe to SuperGrok or X Premium, you can sign in with OAuth — no separate API key or pay-as-you-go charges required.
- **API key:** For pay-as-you-go access via the xAI API.

---

## Option 1: SuperGrok or X Premium Subscription (OAuth)

If you have an active [SuperGrok or X Premium subscription](https://x.ai/grok), you can authenticate with xAI using OAuth and use Grok models directly without needing a separate API key.

### Why use SuperGrok or X Premium?

- **No API billing:** Usage counts against your subscription, not a pay-per-token API account.
- **OAuth login — no API keys:** Sign in through your browser and Kilo Code handles token management automatically.
- **Automatic token refresh:** Kilo Code refreshes your access token in the background so long-running sessions stay authenticated.

### Setup with SuperGrok / X Premium

1. Open Kilo Code settings (click the gear icon gear icon in the Kilo Code panel).
2. In **API Provider**, select **xAI**.
3. Click **Sign in with xAI (SuperGrok / X Premium)**.
4. Complete the authorization flow in your browser.
5. Back in Kilo Code settings, select your desired Grok model.
6. Save.

### Tips for SuperGrok and X Premium

- **Subscription required:** You need an active SuperGrok or X Premium subscription. This option will not work with a free xAI account.
- **Sign out:** Use the **Disconnect** button in provider settings.

---

## Option 2: API Key

If you prefer pay-as-you-go access or do not have a SuperGrok or X Premium subscription, you can use an xAI API key.

### Getting an API Key

1. **Sign Up/Sign In:** Go to the [xAI Console](https://console.x.ai/). Create an account or sign in.
2. **Navigate to API Keys:** Go to the API keys section in your dashboard.
3. **Create a Key:** Click to create a new API key. Give your key a descriptive name (e.g., "Kilo Code").
4. **Copy the Key:** **Important:** Copy the API key _immediately_. You will not be able to see it again. Store it securely.

### Configuration with API Key

1.  **Open Kilo Code Settings:** Click the gear icon (gear icon) in the Kilo Code panel.
2.  **Select Provider:** Choose "xAI" from the "API Provider" dropdown.
3.  **Enter API Key:** Paste your xAI API key into the "xAI API Key" field.
4.  **Select Model:** Choose your desired Grok model from the "Model" dropdown.

---

## Reasoning Capabilities

Some models feature specialized reasoning capabilities, allowing them to "think before responding" - particularly useful for complex problem-solving tasks.

### Controlling Reasoning Effort

When using reasoning-enabled models, you can control how hard the model thinks with the `reasoning_effort` parameter:

- `low`: Minimal thinking time, using fewer tokens for quick responses
- `high`: Maximum thinking time, leveraging more tokens for complex problems

Choose `low` for simple queries that should complete quickly, and `high` for harder problems where response latency is less important.

### Key Features

- **Step-by-Step Problem Solving**: The model thinks through problems methodically before delivering an answer
- **Math & Quantitative Strength**: Excels at numerical challenges and logic puzzles
- **Reasoning Trace Access**: The model's thinking process is available via the `reasoning_content` field in the response completion object

## Tips and Notes

- **Context Window:** Most Grok models feature large context windows (up to 131K tokens), allowing you to include substantial amounts of code and context in your prompts.
- **Vision Capabilities:** Select vision-enabled models (`grok-2-vision-latest`, `grok-2-vision`, etc.) when you need to process or analyze images.
- **Pricing:** API key pricing varies by model, with input costs ranging from $0.3 to $5.0 per million tokens and output costs from $0.5 to $25.0 per million tokens. Refer to the xAI documentation for the most current pricing information.
- **Performance Tradeoffs:** "Fast" variants typically offer quicker response times but may have higher costs, while "mini" variants are more economical but may have reduced capabilities.
