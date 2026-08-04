import { getKiloBaseUriFromToken, AUTOCOMPLETE_PROVIDER_MODELS, AutocompleteProviderKey } from "@roo-code/types"

export { AUTOCOMPLETE_PROVIDER_MODELS }
export type { AutocompleteProviderKey }

/**
 * TTL for the balance cache in milliseconds (5 minutes).
 * Balance is only checked at most once per TTL period to avoid
 * excessive API calls on the hot autocomplete path.
 */
export const BALANCE_CACHE_TTL_MS = 5 * 60 * 1000

/** Cached balance state shared across calls */
let balanceCache: {
	/** The result of the last balance check */
	hasBalance: boolean
	/** Timestamp when the cached value was set */
	timestamp: number
	/** Cache key (token + orgId) to invalidate when credentials change */
	key: string
} | null = null

/**
 * Reset the balance cache. Exported for testing.
 */
export function resetBalanceCache(): void {
	balanceCache = null
}

/**
 * Check if the Kilocode account has a positive balance
 * @param kilocodeToken - The Kilocode JWT token
 * @param kilocodeOrganizationId - Optional organization ID to include in headers
 * @returns Promise<boolean> - True if balance > 0, false otherwise
 */
export async function checkKilocodeBalance(kilocodeToken: string, kilocodeOrganizationId?: string): Promise<boolean> {
	try {
		const baseUrl = getKiloBaseUriFromToken(kilocodeToken)

		const headers: Record<string, string> = {
			Authorization: `Bearer ${kilocodeToken}`,
		}

		if (kilocodeOrganizationId) {
			headers["X-KiloCode-OrganizationId"] = kilocodeOrganizationId
		}

		const response = await fetch(`${baseUrl}/api/profile/balance`, {
			headers,
		})

		if (!response.ok) {
			return false
		}

		const data = await response.json()
		const balance = data.balance ?? 0
		return balance > 0
	} catch (error) {
		console.error("Error checking kilocode balance:", error)
		return false
	}
}

/**
 * Cached wrapper around checkKilocodeBalance that only hits the API
 * at most once per BALANCE_CACHE_TTL_MS (5 minutes). Returns the cached
 * result when available and not expired.
 *
 * The cache is keyed by token + organizationId so it automatically
 * invalidates when credentials change.
 *
 * @param kilocodeToken - The Kilocode JWT token
 * @param kilocodeOrganizationId - Optional organization ID to include in headers
 * @returns Promise<boolean> - True if balance > 0, false otherwise
 */
export async function checkKilocodeBalanceCached(
	kilocodeToken: string,
	kilocodeOrganizationId?: string,
): Promise<boolean> {
	const cacheKey = `${kilocodeToken}:${kilocodeOrganizationId ?? ""}`
	const now = Date.now()

	if (balanceCache && balanceCache.key === cacheKey && now - balanceCache.timestamp < BALANCE_CACHE_TTL_MS) {
		return balanceCache.hasBalance
	}

	const hasBalance = await checkKilocodeBalance(kilocodeToken, kilocodeOrganizationId)

	balanceCache = {
		hasBalance,
		timestamp: now,
		key: cacheKey,
	}

	return hasBalance
}
