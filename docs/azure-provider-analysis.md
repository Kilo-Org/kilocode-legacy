# Azure Provider Support Analysis

This document summarizes how Azure is supported as an AI/LLM provider in Kilo Code.

## Overview

Azure is **fully supported** but not as a standalone provider. Instead, Azure support is integrated
into the **OpenAI-compatible provider** infrastructure. Two distinct Azure service types are supported:

1. **Azure OpenAI** (`*.openai.azure.com`) — Uses the `AzureOpenAI` SDK client
2. **Azure AI Inference** (`*.services.ai.azure.com`) — Uses the standard `OpenAI` client with a
   custom path (`/models/chat/completions`)

## Provider Implementations

| File                                    | Role                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/api/providers/openai.ts`           | Primary Azure integration — detects Azure endpoints by URL or `openAiUseAzure` flag |
| `src/api/providers/openai-responses.ts` | Azure support for the OpenAI Responses API (Azure AI Inference unsupported)         |
| `src/api/providers/deepseek.ts`         | DeepSeek via Azure AI Inference Service                                             |
| `src/api/providers/anthropic.ts`        | Supports Azure deployment names via `anthropicDeploymentName`                       |
| `src/api/providers/sap-ai-core.ts`      | Uses SAP's `AzureOpenAiChatClient` SDK                                              |

### Detection Logic (from `openai.ts`)

```typescript
const isAzureAiInference = baseUrl.includes("services.ai.azure.com")
const isAzureOpenAi = urlHost === "azure.com" || urlHost.endsWith(".azure.com") || options.openAiUseAzure
```

- If the base URL contains `*.services.ai.azure.com` → **Azure AI Inference** mode
- If the URL host ends with `.azure.com`, or `openAiUseAzure` is `true` → **Azure OpenAI** mode
- Otherwise → standard OpenAI-compatible mode

### Client Initialization

- **Azure OpenAI**: Creates an `AzureOpenAI` client (from the `openai` npm package) with
  `apiVersion` from `azureApiVersion` setting or default (`2024-08-01-preview`).
- **Azure AI Inference**: Creates a standard `OpenAI` client with an `api-version` query parameter
  and uses the `/models/chat/completions` path override.

## Configuration

Configuration fields are defined in `packages/types/src/provider-settings.ts`:

| Setting                   | Type      | Description                                              |
| ------------------------- | --------- | -------------------------------------------------------- |
| `openAiUseAzure`          | `boolean` | Explicitly enables Azure OpenAI mode                     |
| `azureApiVersion`         | `string`  | Overrides the default API version (`2024-08-01-preview`) |
| `openAiBaseUrl`           | `string`  | Azure endpoint URL (auto-detected by host pattern)       |
| `openAiApiKey`            | `string`  | API key for authentication                               |
| `anthropicDeploymentName` | `string`  | Azure deployment name for the Anthropic provider         |

These are also mirrored in `packages/core-schemas/src/config/provider.ts` for the agent runtime.

## UI Configuration

Two settings components expose Azure options:

1. **`webview-ui/src/components/settings/providers/OpenAICompatible.tsx`**
    - "Use Azure" checkbox (`openAiUseAzure`)
    - "Set Azure API version" text field (`azureApiVersion`)

2. **`webview-ui/src/components/settings/providers/Anthropic.tsx`**
    - "Use Azure deployment name" checkbox
    - Deployment name text input (`anthropicDeploymentName`)

All Azure UI labels are internationalized across 23 locales.

## Models

There is **no dedicated Azure model list**. Azure OpenAI supports whatever models are deployed in
the user's Azure resource. Users specify their deployment via:

- The base URL (which includes the deployment name in the path for Azure OpenAI)
- The model ID field
- The Azure AI Inference service routes via `/models/chat/completions`

## Autocomplete Service

The autocomplete subsystem (forked from ContinueDev) has its own Azure integration:

- **`src/services/autocomplete/continuedev/core/llm/openai-adapters/apis/Azure.ts`** — Dedicated
  `AzureApi` class extending `OpenAIApi`
- Supports three API types: `azure-openai`, `azure-foundry`, `azure`
- Requires `deployment` and `apiVersion` in env config
- Handles Azure-specific quirks (empty content parts, content filtering chunks)

## Embeddings / Code Index

`src/services/code-index/embedders/openai-compatible.ts` handles Azure OpenAI embedding endpoints:

- Detects Azure deployment URLs (`/deployments/{name}/embeddings`)
- Sends both `api-key` and `Authorization` headers for compatibility
- Supports direct fetch mode for Azure endpoints with query parameters

## Test Coverage

10+ test files cover Azure functionality:

| Test File                                                               | Coverage                                     |
| ----------------------------------------------------------------------- | -------------------------------------------- |
| `src/api/providers/__tests__/openai.spec.ts`                            | Azure AI Inference streaming/non-streaming   |
| `src/api/providers/__tests__/openai-timeout.spec.ts`                    | Azure OpenAI and Azure AI Inference timeouts |
| `src/api/providers/__tests__/openai-responses.spec.ts`                  | Responses API Azure endpoint handling        |
| `src/api/providers/__tests__/deepseek.spec.ts`                          | DeepSeek Azure path handling                 |
| `src/api/providers/__tests__/anthropic.spec.ts`                         | Azure deployment name usage                  |
| `src/api/providers/__tests__/sap-ai-core.spec.ts`                       | SAP `AzureOpenAiChatClient` integration      |
| `src/services/code-index/embedders/__tests__/openai-compatible.spec.ts` | Azure embedding URL detection                |
| `webview-ui/src/components/settings/__tests__/ApiOptions.spec.tsx`      | Azure deployment UI rendering                |
| `webview-ui/src/utils/__tests__/validate.spec.ts`                       | Azure URL validation                         |

## Architecture Summary

```
User Configuration
    ├── openAiBaseUrl (Azure endpoint)
    ├── openAiApiKey
    ├── openAiUseAzure (explicit flag)
    └── azureApiVersion (optional override)
         │
         ▼
    URL Detection Logic
    ├── *.services.ai.azure.com → Azure AI Inference
    │   └── OpenAI client + /models/chat/completions path
    └── *.azure.com OR openAiUseAzure → Azure OpenAI
        └── AzureOpenAI client + apiVersion
```
