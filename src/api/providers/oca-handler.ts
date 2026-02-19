import OpenAI from "openai"

import {
	type ModelInfo,
	NATIVE_TOOL_DEFAULTS,
	OPENAI_NATIVE_DEFAULT_TEMPERATURE,
	ReasoningEffortExtended,
	VerbosityLevel,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"
import { OcaTokenManager } from "./oca/OcaTokenManager"
import { DEFAULT_OCA_BASE_URL } from "./oca/utils/constants"
import { handleOpenAIError } from "./utils/openai-error-handler"
import { getOcaClientInfo } from "./oca/utils/getOcaClientInfo"

import { DEFAULT_HEADERS as BASE_HEADERS } from "./constants"
import { getModelsFromCache } from "./fetchers/modelCache"
import { verifyFinishReason } from "./kilocode/verifyFinishReason"
import { normalizeObjectAdditionalPropertiesFalse } from "./kilocode/openai-strict-schema"
import { isMcpTool } from "../../utils/mcp-name"
import { sanitizeOpenAiCallId } from "../../utils/tool-id"
import { getModelParams } from "../transform/model-params"

const DEFAULT_HEADERS = {
	...BASE_HEADERS,
	Accept: "application/json",
	"Content-Type": "application/json",
}

export class OcaHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private baseURL: string
	private lastResponseId: string | undefined
	// Complete response output array (includes reasoning items with encrypted_content)
	private lastResponseOutput: any[] | undefined
	/**
	 * Some Responses streams emit tool-call argument deltas without stable call id/name.
	 * Track the last observed tool identity from output_item events so we can still
	 * emit `tool_call_partial` chunks (tool-call-only streams).
	 */
	private pendingToolCallId: string | undefined
	private pendingToolCallName: string | undefined

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.baseURL = process.env.OCA_API_BASE ?? DEFAULT_OCA_BASE_URL
		if (this.options.enableResponsesReasoningSummary === undefined) {
			this.options.enableResponsesReasoningSummary = true
		}
	}

	private async getClient(): Promise<OpenAI> {
		return this.getClientWithBase(this.baseURL)
	}

	private async getClientWithBase(baseURL: string): Promise<OpenAI> {
		const token = await OcaTokenManager.getValid()
		if (!token?.access_token) {
			throw new Error("Please sign in with Oracle SSO at Settings > Providers > Oracle Code Assist.")
		}

		const { client, clientVersion, clientIde, clientIdeVersion } = getOcaClientInfo()

		return new OpenAI({
			apiKey: token.access_token,
			baseURL,
			defaultHeaders: {
				...DEFAULT_HEADERS,
				client: client,
				"client-version": clientVersion,
				"client-ide": clientIde,
				"client-ide-version": clientIdeVersion,
			},
		})
	}

	private decorateErrorWithOpcRequestId(error: any, processedError: any) {
		const opcRequestId =
			typeof error?.headers?.get === "function" ? (error.headers.get("opc-request-id") as string | null) : null

		if (opcRequestId && processedError && typeof processedError === "object" && "message" in processedError) {
			;(processedError as any).message = `${(processedError as any).message} opc-request-id: ${opcRequestId}`
		}
		return processedError
	}

	override async *createMessage(
		systemPrompt: string,
		messages: any[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const client = await this.getClient()
		const { info: modelInfo, id: modelId } = this.getModel()

		// Branch between Responses API and Chat/Completions API
		const prefersResponses =
			modelInfo.apiType === "responses" ||
			(modelInfo.supportedApiTypes &&
				Array.isArray(modelInfo.supportedApiTypes) &&
				modelInfo.supportedApiTypes.includes("RESPONSES"))

		if (prefersResponses) {
			// -- Responses API logic, inspired by openai-native.ts --
			this.lastResponseId = undefined
			this.lastResponseOutput = undefined
			this.pendingToolCallId = undefined
			this.pendingToolCallName = undefined
			const reasoningEffort = this.getReasoningEffort(modelInfo)

			const formattedInput = this.formatFullConversation(systemPrompt, messages)
			const requestBody = this.buildResponsesRequestBody(
				modelId,
				modelInfo,
				formattedInput,
				systemPrompt,
				reasoningEffort,
				metadata,
			)
			try {
				const stream = (await (client as any).responses.create(requestBody, {
					signal: undefined,
				})) as AsyncIterable<any>
				for await (const event of stream) {
					for await (const chunk of this.processResponsesEvent(event, modelInfo)) {
						yield chunk
					}
				}
			} catch (err) {
				throw handleOpenAIError(err, "Oracle Code Assist (Responses API)")
			}
			return
		}

		// --- Existing Chat/Completions API logic ---
		const supportsNativeTools = modelInfo.supportsNativeTools ?? false
		const useNativeTools =
			supportsNativeTools &&
			metadata?.tools &&
			metadata.tools.length > 0 &&
			metadata?.toolProtocol !== "xml" &&
			metadata?.tool_choice !== "none"

		const requestedToolChoice = metadata?.tool_choice
		const finalToolChoice =
			useNativeTools && (!requestedToolChoice || requestedToolChoice === "auto")
				? "required"
				: requestedToolChoice

		const request: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: this.options.apiModelId || "auto",
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			...(modelInfo.maxTokens ? { max_tokens: modelInfo.maxTokens } : {}),
			temperature: this.options.modelTemperature ?? 0,
			stream: true as const,
			stream_options: { include_usage: true },
			...(useNativeTools && { tools: this.convertToolsForOpenAI(metadata!.tools) }),
			...(finalToolChoice && { tool_choice: finalToolChoice }),
			...(useNativeTools && { parallel_tool_calls: metadata?.parallelToolCalls ?? false }),
		}

		let stream
		try {
			stream = await client.chat.completions.create(request)
		} catch (err: any) {
			throw this.decorateErrorWithOpcRequestId(err, handleOpenAIError(err, "Oracle Code Assist"))
		}

		const activeToolCallIds = new Set<string>()

		for await (const chunk of stream) {
			verifyFinishReason(chunk.choices?.[0] as any)
			const choice = (chunk.choices?.[0] as any) || {}
			const delta = choice?.delta
			const finishReason = choice?.finish_reason

			if (delta?.content) {
				yield { type: "text", text: delta.content }
			}
			if (delta?.tool_calls) {
				for (const toolCall of delta.tool_calls) {
					if (toolCall.id) {
						activeToolCallIds.add(toolCall.id)
					}
					yield {
						type: "tool_call_partial",
						index: toolCall.index,
						id: toolCall.id,
						name: toolCall.function?.name,
						arguments: toolCall.function?.arguments,
					}
				}
			}
			{
				const reasoningText = (
					"reasoning_content" in (delta || {}) && typeof (delta as any).reasoning_content === "string"
						? (delta as any).reasoning_content
						: "reasoning" in (delta || {}) && typeof (delta as any).reasoning === "string"
							? (delta as any).reasoning
							: undefined
				) as string | undefined
				if (reasoningText) {
					yield { type: "reasoning", text: reasoningText }
				}
			}
			if (finishReason === "tool_calls" && activeToolCallIds.size > 0) {
				for (const id of activeToolCallIds) {
					yield { type: "tool_call_end", id }
				}
				activeToolCallIds.clear()
			}

			if (chunk.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
				}
			}
		}
		if (activeToolCallIds.size > 0) {
			for (const id of activeToolCallIds) {
				yield { type: "tool_call_end", id }
			}
			activeToolCallIds.clear()
		}
	}

	// -- Responses API: Conversation formatting --
	// Updated to include "tool_result" and "tool_use" logic like openai-responses.ts
	private formatFullConversation(systemPrompt: string, messages: any[]): any[] {
		const input: any[] = []
		for (const m of messages) {
			if (m.type === "reasoning") {
				input.push(m)
				continue
			}
			if (m.role === "user") {
				const content: any[] = []
				const toolResults: any[] = []
				if (typeof m.content === "string") {
					content.push({ type: "input_text", text: m.content })
				} else if (Array.isArray(m.content)) {
					for (const block of m.content) {
						if (block.type === "text") {
							content.push({ type: "input_text", text: block.text })
						} else if (block.type === "image") {
							const imageUrl =
								block.source.type === "base64"
									? `data:${block.source.media_type};base64,${block.source.data}`
									: block.source.url
							content.push({ type: "input_image", image_url: imageUrl })
						} else if (block.type === "tool_result") {
							const result =
								typeof block.content === "string"
									? block.content
									: block.content?.map((c: any) => (c.type === "text" ? c.text : "")).join("") || ""
							toolResults.push({
								type: "function_call_output",
								call_id: sanitizeOpenAiCallId(block.tool_use_id),
								output: result,
							})
						}
					}
				}
				if (content.length > 0) {
					input.push({ role: "user", content })
				}
				if (toolResults.length > 0) {
					input.push(...toolResults)
				}
			} else if (m.role === "assistant") {
				const content: any[] = []
				const toolCalls: any[] = []
				if (typeof m.content === "string") {
					content.push({ type: "output_text", text: m.content })
				} else if (Array.isArray(m.content)) {
					for (const block of m.content) {
						if (block.type === "text") {
							content.push({ type: "output_text", text: block.text })
						} else if (block.type === "tool_use") {
							toolCalls.push({
								type: "function_call",
								call_id: sanitizeOpenAiCallId(block.id),
								name: block.name,
								arguments: JSON.stringify(block.input),
							})
						}
					}
				}
				if (content.length > 0) {
					input.push({ role: "assistant", content })
				}
				if (toolCalls.length > 0) {
					input.push(...toolCalls)
				}
			}
		}
		return input
	}

	// -- Responses API: Request body builder --
	private buildResponsesRequestBody(
		modelId: string,
		modelInfo: ModelInfo,
		formattedInput: any[],
		systemPrompt: string,
		reasoningEffort: ReasoningEffortExtended | undefined,
		metadata?: ApiHandlerCreateMessageMetadata,
	): any {
		interface ResponsesRequestBody {
			model: string
			input: Array<{ role: "user" | "assistant"; content: any[] } | { type: string; content: string }>
			stream: boolean
			reasoning?: { summary?: "auto" }
			text?: { verbosity: VerbosityLevel }
			temperature?: number
			max_output_tokens?: number
			store?: boolean
			instructions?: string
			include?: string[]
			tools?: Array<{
				type: "function"
				name: string
				description?: string
				parameters?: any
				strict?: boolean
			}>
			tool_choice?: any
			parallel_tool_calls?: boolean
		}

		const body: ResponsesRequestBody = {
			model: modelId,
			input: formattedInput,
			stream: true,
			store: false,
			instructions: systemPrompt,
			...(reasoningEffort ? { include: ["reasoning.encrypted_content"] } : {}),
			...(reasoningEffort
				? {
						reasoning: {
							...(reasoningEffort ? { effort: reasoningEffort } : {}),
							...(this.options.enableResponsesReasoningSummary ? { summary: "auto" as const } : {}),
						},
					}
				: {}),
			...(modelInfo.supportsTemperature !== false &&
				typeof this.options.modelTemperature === "number" && {
					temperature: this.options.modelTemperature,
				}),
			...(modelInfo.maxTokens && this.options.includeMaxTokens ? { max_output_tokens: modelInfo.maxTokens } : {}),
			...(metadata?.tools && {
				tools: metadata.tools
					.filter((tool) => tool.type === "function")
					.map((tool) => {
						const isMcp = isMcpTool(tool.function.name)
						return {
							type: "function",
							name: tool.function.name,
							description: tool.function.description,
							parameters: isMcp
								? normalizeObjectAdditionalPropertiesFalse(tool.function.parameters)
								: this.convertToolSchemaForOpenAI(tool.function.parameters),
							strict: !isMcp,
						}
					}),
			}),
			...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
		}

		if (metadata?.toolProtocol === "native") {
			body.parallel_tool_calls = metadata.parallelToolCalls ?? false
		}

		// body.text = {verbosity: "medium"}

		return body
	}

	// -- Responses API: Event processor (yield openai-responses style output chunks) --
	private async *processResponsesEvent(event: any, modelInfo: any): AsyncIterable<any> {
		// Capture complete output array (includes reasoning items with encrypted_content)
		if (event?.response?.output && Array.isArray(event.response.output)) {
			this.lastResponseOutput = event.response.output
		}
		// Capture top-level response id
		if (event?.response?.id) {
			this.lastResponseId = event.response.id as string
		}

		// Handle known streaming text deltas
		if (event?.type === "response.text.delta" || event?.type === "response.output_text.delta") {
			if (event?.delta) {
				yield { type: "text", text: event.delta }
			}
			return
		}

		// Handle reasoning deltas (including summary variants)
		if (
			event?.type === "response.reasoning.delta" ||
			event?.type === "response.reasoning_text.delta" ||
			event?.type === "response.reasoning_summary.delta" ||
			event?.type === "response.reasoning_summary_text.delta"
		) {
			if (event?.delta) {
				yield { type: "reasoning", text: event.delta }
			}
			return
		}

		// Handle refusal deltas
		if (event?.type === "response.refusal.delta") {
			if (event?.delta) {
				yield { type: "text", text: `[Refusal] ${event.delta}` }
			}
			return
		}

		// Handle tool/function call deltas - emit as partial chunks
		if (
			event?.type === "response.tool_call_arguments.delta" ||
			event?.type === "response.function_call_arguments.delta"
		) {
			// Some streams omit stable identity on delta events; fall back to the
			// most recently observed tool identity from output_item events.
			const callId = event.call_id || event.tool_call_id || event.id || this.pendingToolCallId || undefined
			const name = event.name || event.function_name || this.pendingToolCallName || undefined
			const args = event.delta || event.arguments

			// Avoid emitting incomplete tool_call_partial chunks; the downstream
			// NativeToolCallParser needs a name to start a call.
			if (typeof name === "string" && name.length > 0 && typeof callId === "string" && callId.length > 0) {
				yield {
					type: "tool_call_partial",
					index: event.index ?? 0,
					id: callId,
					name,
					arguments: args,
				}
			}
			return
		}

		// Handle tool/function call completion events
		if (
			event?.type === "response.tool_call_arguments.done" ||
			event?.type === "response.function_call_arguments.done"
		) {
			// Tool call complete - no action needed, NativeToolCallParser handles completion
			return
		}

		// Handle output item additions/completions (SDK or Responses API alternative format)
		if (event?.type === "response.output_item.added" || event?.type === "response.output_item.done") {
			const item = event?.item
			if (item) {
				// Capture tool identity so subsequent argument deltas can be attributed.
				if (item.type === "function_call" || item.type === "tool_call") {
					const callId = item.call_id || item.tool_call_id || item.id
					const name = item.name || item.function?.name || item.function_name
					if (typeof callId === "string" && callId.length > 0) {
						this.pendingToolCallId = callId
						this.pendingToolCallName = typeof name === "string" ? name : undefined
					}
				}

				if (item.type === "text" && item.text) {
					yield { type: "text", text: item.text }
				} else if (item.type === "reasoning" && item.text) {
					yield { type: "reasoning", text: item.text }
				} else if (item.type === "message" && Array.isArray(item.content)) {
					for (const content of item.content) {
						// Some implementations send 'text'; others send 'output_text'
						if ((content?.type === "text" || content?.type === "output_text") && content?.text) {
							yield { type: "text", text: content.text }
						}
					}
				} else if (
					(item.type === "function_call" || item.type === "tool_call") &&
					event.type === "response.output_item.done" // Only handle done events for tool calls to ensure arguments are complete
				) {
					// Handle complete tool/function call item
					// Emit as tool_call for backward compatibility with non-streaming tool handling
					const callId = item.call_id || item.tool_call_id || item.id
					if (callId) {
						const args = item.arguments || item.function?.arguments || item.function_arguments
						yield {
							type: "tool_call",
							id: callId,
							name: item.name || item.function?.name || item.function_name || "",
							arguments: typeof args === "string" ? args : "{}",
						}
					}
				}
			}
			return
		}

		if (event?.type === "response.done" || event?.type === "response.completed") {
			const usage = event.response?.usage
			if (usage) {
				yield {
					type: "usage",
					inputTokens: usage.input_tokens ?? usage.prompt_tokens ?? 0,
					outputTokens: usage.output_tokens ?? usage.completion_tokens ?? 0,
				}
			}
			return
		}

		// Fallbacks for older formats or unexpected objects
		if (event?.choices?.[0]?.delta?.content) {
			yield { type: "text", text: event.choices[0].delta.content }
			return
		}

		if (event?.usage) {
			yield {
				type: "usage",
				inputTokens: event.usage.input_tokens ?? event.usage.prompt_tokens ?? 0,
				outputTokens: event.usage.output_tokens ?? event.usage.completion_tokens ?? 0,
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const client = await this.getClient()
		const { id, info } = this.getModel()
		try {
			if (info.apiType === "CHAT_COMPLETIONS") {
				const resp = await client.chat.completions.create({
					model: this.options.apiModelId || "auto",
					messages: [{ role: "user", content: prompt }],
				} as any)
				return (resp as any).choices?.[0]?.message?.content || ""
			} else {
				// Resolve reasoning effort for models that support it
				const reasoningEffort = this.getReasoningEffort(info)

				// Build request body for Responses API
				const requestBody: any = {
					model: id,
					input: [
						{
							role: "user",
							content: [{ type: "input_text", text: prompt }],
						},
					],
					stream: false, // Non-streaming for completePrompt
					store: false, // Don't store prompt completions
					// Only include encrypted reasoning content when reasoning effort is set
					...(reasoningEffort ? { include: ["reasoning.encrypted_content"] } : {}),
				}

				// Add reasoning if supported
				if (reasoningEffort) {
					requestBody.reasoning = {
						effort: reasoningEffort,
						...(this.options.enableResponsesReasoningSummary ? { summary: "auto" as const } : {}),
					}
				}

				// Only include temperature if the model supports it
				if (info.supportsTemperature !== false) {
					requestBody.temperature = this.options.modelTemperature ?? OPENAI_NATIVE_DEFAULT_TEMPERATURE
				}

				// Include max_output_tokens if available
				if (info.maxTokens) {
					requestBody.max_output_tokens = info.maxTokens
				}

				// Enable extended prompt cache retention for eligible models
				const promptCacheRetention = this.getPromptCacheRetention(info)
				if (promptCacheRetention) {
					requestBody.prompt_cache_retention = promptCacheRetention
				}

				// Make the non-streaming request
				const response = await (client as any).responses.create(requestBody)

				// Extract text from the response
				if (response?.output && Array.isArray(response.output)) {
					for (const outputItem of response.output) {
						if (outputItem.type === "message" && outputItem.content) {
							for (const content of outputItem.content) {
								if (content.type === "output_text" && content.text) {
									return content.text
								}
							}
						}
					}
				}

				// Fallback: check for direct text in response
				if (response?.text) {
					return response.text
				}

				return ""
			}
		} catch (err: any) {
			throw this.decorateErrorWithOpcRequestId(err, handleOpenAIError(err, "Oracle Code Assist"))
		}
	}

	/**
	 * Returns the appropriate prompt cache retention policy for the given model, if any.
	 *
	 * The policy is driven by ModelInfo.promptCacheRetention so that model-specific details
	 * live in the shared types layer rather than this provider. When set to "24h" and the
	 * model supports prompt caching, extended prompt cache retention is requested.
	 */
	private getPromptCacheRetention(modelInfo: ModelInfo): "24h" | undefined {
		if (!modelInfo.supportsPromptCache) return undefined

		if (modelInfo.promptCacheRetention === "24h") {
			return "24h"
		}

		return undefined
	}

	private getReasoningEffort(modelInfo: ModelInfo): ReasoningEffortExtended | undefined {
		// Single source of truth: user setting overrides, else model default (from types).
		const selected = (this.options.reasoningEffort as any) ?? (modelInfo.reasoningEffort as any)
		return selected && selected !== "disable" ? (selected as any) : undefined
	}

	override getModel() {
		const id = this.options.apiModelId || "auto"
		const cached = getModelsFromCache("oca")
		const selected = id !== "auto" ? cached?.[id] : undefined

		const baseInfo: ModelInfo = {
			maxTokens: this.options.modelMaxTokens ?? selected?.maxTokens ?? 4096,
			contextWindow: selected?.contextWindow ?? 128000,
			supportsImages: selected?.supportsImages ?? true,
			supportsPromptCache: selected?.supportsPromptCache ?? false,
			inputPrice: selected?.inputPrice ?? 0,
			outputPrice: selected?.outputPrice ?? 0,
			cacheWritesPrice: selected?.cacheWritesPrice,
			cacheReadsPrice: selected?.cacheReadsPrice,
			description: selected?.description,
			banner: selected?.banner,
			supportedApiTypes: selected?.supportedApiTypes,
			apiType: selected?.apiType,
			supportsReasoningEffort: selected?.supportsReasoningEffort,
			reasoningEffort: selected?.reasoningEffort,
		}
		const info: ModelInfo = {
			...NATIVE_TOOL_DEFAULTS,
			...baseInfo,
		}

		return { id, info }
	}
}
