import {
	checkKilocodeBalance,
	checkKilocodeBalanceCached,
	resetBalanceCache,
	BALANCE_CACHE_TTL_MS,
} from "./kilocode-utils"

describe("checkKilocodeBalance", () => {
	const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbnYiOiJwcm9kdWN0aW9uIn0.test"
	const mockOrgId = "org-123"

	beforeEach(() => {
		global.fetch = vi.fn()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should return true when balance is positive", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ balance: 100 }),
		} as Response)

		const result = await checkKilocodeBalance(mockToken)
		expect(result).toBe(true)
		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.kilo.ai/api/profile/balance",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: `Bearer ${mockToken}`,
				}),
			}),
		)
	})

	it("should return false when balance is zero", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ balance: 0 }),
		} as Response)

		const result = await checkKilocodeBalance(mockToken)
		expect(result).toBe(false)
	})

	it("should return false when balance is negative", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ balance: -10 }),
		} as Response)

		const result = await checkKilocodeBalance(mockToken)
		expect(result).toBe(false)
	})

	it("should include organization ID in headers when provided", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ balance: 100 }),
		} as Response)

		const result = await checkKilocodeBalance(mockToken, mockOrgId)
		expect(result).toBe(true)
		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.kilo.ai/api/profile/balance",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: `Bearer ${mockToken}`,
					"X-KiloCode-OrganizationId": mockOrgId,
				}),
			}),
		)
	})

	it("should not include organization ID in headers when not provided", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ balance: 100 }),
		} as Response)

		await checkKilocodeBalance(mockToken)

		const fetchCall = vi.mocked(global.fetch).mock.calls[0]
		expect(fetchCall).toBeDefined()
		const headers = (fetchCall![1] as RequestInit)?.headers as Record<string, string>

		expect(headers).toHaveProperty("Authorization")
		expect(headers).not.toHaveProperty("X-KiloCode-OrganizationId")
	})

	it("should return false when API request fails", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce({
			ok: false,
		} as Response)

		const result = await checkKilocodeBalance(mockToken)
		expect(result).toBe(false)
	})

	it("should return false when fetch throws an error", async () => {
		vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"))

		const result = await checkKilocodeBalance(mockToken)
		expect(result).toBe(false)
	})

	it("should handle missing balance field in response", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({}),
		} as Response)

		const result = await checkKilocodeBalance(mockToken)
		expect(result).toBe(false)
	})
})

describe("checkKilocodeBalanceCached", () => {
	const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbnYiOiJwcm9kdWN0aW9uIn0.test"
	const mockOrgId = "org-123"

	beforeEach(() => {
		global.fetch = vi.fn()
		resetBalanceCache()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	it("should call the API on first invocation", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ balance: 100 }),
		} as Response)

		const result = await checkKilocodeBalanceCached(mockToken)
		expect(result).toBe(true)
		expect(global.fetch).toHaveBeenCalledTimes(1)
	})

	it("should return cached result on subsequent calls within TTL", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ balance: 100 }),
		} as Response)

		const result1 = await checkKilocodeBalanceCached(mockToken)
		const result2 = await checkKilocodeBalanceCached(mockToken)
		const result3 = await checkKilocodeBalanceCached(mockToken)

		expect(result1).toBe(true)
		expect(result2).toBe(true)
		expect(result3).toBe(true)
		expect(global.fetch).toHaveBeenCalledTimes(1)
	})

	it("should re-fetch after TTL expires", async () => {
		vi.mocked(global.fetch)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ balance: 100 }),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ balance: 0 }),
			} as Response)

		const result1 = await checkKilocodeBalanceCached(mockToken)
		expect(result1).toBe(true)
		expect(global.fetch).toHaveBeenCalledTimes(1)

		// Advance time past the TTL
		vi.advanceTimersByTime(BALANCE_CACHE_TTL_MS + 1)

		const result2 = await checkKilocodeBalanceCached(mockToken)
		expect(result2).toBe(false)
		expect(global.fetch).toHaveBeenCalledTimes(2)
	})

	it("should invalidate cache when token changes", async () => {
		const otherToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbnYiOiJwcm9kdWN0aW9uIn0.other"

		vi.mocked(global.fetch)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ balance: 100 }),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ balance: 0 }),
			} as Response)

		const result1 = await checkKilocodeBalanceCached(mockToken)
		expect(result1).toBe(true)

		// Different token should bypass cache
		const result2 = await checkKilocodeBalanceCached(otherToken)
		expect(result2).toBe(false)
		expect(global.fetch).toHaveBeenCalledTimes(2)
	})

	it("should invalidate cache when organization ID changes", async () => {
		vi.mocked(global.fetch)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ balance: 100 }),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ balance: 50 }),
			} as Response)

		const result1 = await checkKilocodeBalanceCached(mockToken)
		expect(result1).toBe(true)

		// Different org ID should bypass cache
		const result2 = await checkKilocodeBalanceCached(mockToken, mockOrgId)
		expect(result2).toBe(true)
		expect(global.fetch).toHaveBeenCalledTimes(2)
	})

	it("should cache false results too", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ balance: 0 }),
		} as Response)

		const result1 = await checkKilocodeBalanceCached(mockToken)
		const result2 = await checkKilocodeBalanceCached(mockToken)

		expect(result1).toBe(false)
		expect(result2).toBe(false)
		expect(global.fetch).toHaveBeenCalledTimes(1)
	})

	it("should not use cache within TTL window but not yet expired", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ balance: 100 }),
		} as Response)

		await checkKilocodeBalanceCached(mockToken)

		// Advance time but not past TTL
		vi.advanceTimersByTime(BALANCE_CACHE_TTL_MS - 1000)

		const result = await checkKilocodeBalanceCached(mockToken)
		expect(result).toBe(true)
		expect(global.fetch).toHaveBeenCalledTimes(1)
	})
})
