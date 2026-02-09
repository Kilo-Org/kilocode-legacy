import OpenAI from "openai"

import { type ModelInfo, NATIVE_TOOL_DEFAULTS } from "@roo-code/types"

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

const DEFAULT_HEADERS = {
	...BASE_HEADERS,
	Accept: "application/json",
	"Content-Type": "application/json",
}

export class OcaHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private baseURL: string
	private readonly toolCallIdentityById = new Map<string, { id: string; name: string }>()

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.baseURL = process.env.OCA_API_BASE ?? DEFAULT_OCA_BASE_URL
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

		if (prefersResponses && typeof (client as any).responses?.create === "function") {
			// -- Responses API logic, inspired by openai-responses.ts --
			const formattedInput = this.formatFullConversation(systemPrompt, messages)
			const requestBody = this.buildResponsesRequestBody(
				modelId,
				modelInfo,
				formattedInput,
				systemPrompt,
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
								call_id: block.tool_use_id,
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
								call_id: block.id,
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
		modelInfo: any,
		formattedInput: any[],
		systemPrompt: string,
		metadata?: ApiHandlerCreateMessageMetadata,
	): any {
		interface ResponsesRequestBody {
			model: string
			input: Array<{ role: "user" | "assistant"; content: any[] } | { type: string; content: string }>
			stream: boolean
			reasoning?: { summary?: "auto" }
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
			...(this.options.enableResponsesReasoningSummary ? { reasoning: { summary: "auto" as const } } : {}),
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

		return body
	}

	// -- Responses API: Event processor (yield openai-responses style output chunks) --
	private async *processResponsesEvent(event: any, modelInfo: any): AsyncIterable<any> {
		const eventType = event?.type

		if (
			eventType === "response.text.delta" ||
			eventType === "response.output_text.delta" ||
			eventType === "response.output_text" ||
			eventType === "response.text"
		) {
			const text = event.delta || event.text || event?.content?.[0]?.text
			if (text) {
				yield { type: "text", text }
			}
			return
		}

		if (
			eventType === "response.reasoning.delta" ||
			eventType === "response.reasoning_text.delta" ||
			eventType === "response.reasoning_summary.delta" ||
			eventType === "response.reasoning_summary_text.delta"
		) {
			const text = event.delta || event.text
			if (text) {
				yield { type: "reasoning", text }
			}
			return
		}

		if (eventType === "response.output_item.added" || eventType === "response.output_item.done") {
			const item = event.item
			if (item?.type === "function_call") {
				if (item.call_id && item.name) {
					this.toolCallIdentityById.set(item.call_id, { id: item.call_id, name: item.name })
				}

				if (eventType === "response.output_item.done") {
					const args = typeof item.arguments === "string" ? item.arguments : undefined
					if (item.call_id && item.name && args) {
						yield {
							type: "tool_call",
							id: item.call_id,
							name: item.name,
							arguments: args,
						}
					}
				}
			}
			return
		}

		if (
			eventType === "response.tool_call_arguments.delta" ||
			eventType === "response.function_call_arguments.delta"
		) {
			const callId = event.call_id
			const cachedIdentity = callId ? this.toolCallIdentityById.get(callId) : undefined
			const resolvedId = event.call_id || cachedIdentity?.id
			const resolvedName = event.name || cachedIdentity?.name
			if (!resolvedId || !resolvedName) {
				return
			}
			yield {
				type: "tool_call_partial",
				index: 0,
				id: resolvedId,
				name: resolvedName,
				arguments: event.delta,
			}
			return
		}

		if (
			eventType === "response.tool_call_arguments.done" ||
			eventType === "response.function_call_arguments.done"
		) {
			if (event.call_id) {
				yield { type: "tool_call_end", id: event.call_id }
			}
			return
		}

		if (eventType === "response.completed" || eventType === "response.done") {
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
	}

	async completePrompt(prompt: string): Promise<string> {
		const client = await this.getClient()
		try {
			const resp = await client.chat.completions.create({
				model: this.options.apiModelId || "auto",
				messages: [{ role: "user", content: prompt }],
			} as any)
			return (resp as any).choices?.[0]?.message?.content || ""
		} catch (err: any) {
			throw this.decorateErrorWithOpcRequestId(err, handleOpenAIError(err, "Oracle Code Assist"))
		}
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
		}
		const info: ModelInfo = {
			...NATIVE_TOOL_DEFAULTS,
			...baseInfo,
		}

		return { id, info }
	}
}
