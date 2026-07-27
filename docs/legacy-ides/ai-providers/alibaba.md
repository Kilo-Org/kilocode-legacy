# Using Alibaba Cloud With Kilo Code

Kilo Code supports Alibaba Cloud Model Studio (DashScope) through the native Alibaba AI SDK provider. Use it to run Qwen and other DashScope-hosted models directly from Kilo.

**Website:** [https://www.alibabacloud.com/product/modelstudio](https://www.alibabacloud.com/product/modelstudio)

## Getting an API Key

1. Sign in to Alibaba Cloud Model Studio or DashScope.
2. Open the API key section for your workspace.
3. Create a key and copy it immediately.
4. Store the key securely; do not commit it to your repository.

## Configuration in Kilo Code

Use the **OpenAI Compatible** provider if the legacy provider list does not include Alibaba Cloud. Set the base URL and API key from your DashScope account, then choose or enter a supported model ID.

## Tips and Notes

- **Native provider:** Kilo uses the native Alibaba AI SDK provider, not a generic compatibility shim, when you select the built-in Alibaba provider.
- **Cache controls:** Kilo forwards provider cache controls for compatible Alibaba/DashScope models, which can reduce repeated context cost where the model supports caching.
- **Regional catalogs:** Model availability varies by account, region, and gateway. Check the DashScope console for the exact model IDs available to your account.
- **Pricing and limits:** Refer to Alibaba Cloud Model Studio pricing and rate-limit documentation for current usage details.

## Troubleshooting

- **Authentication errors:** Verify `DASHSCOPE_API_KEY` is set in the same shell that launches Kilo, or stored in your Kilo provider config.
- **Model not found:** Confirm the model ID is available in your DashScope account and try the model picker to see Kilo's current catalog.
- **Region mismatch:** If your account uses the China-region catalog, try the `alibaba-cn/<model-id>` provider prefix.
