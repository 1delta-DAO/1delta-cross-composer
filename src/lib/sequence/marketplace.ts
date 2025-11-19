import { OLDERFALL_ARMORS_ADDRESS, SEQUENCE_MARKETPLACE_API_URL, SEQUENCE_PROJECT_ACCESS_KEY } from "./market"

export type OlderfallListing = {
    orderId: string
    tokenId: string
    tokenContract: string
    currency: string
    pricePerToken: string
    priceDecimals: number
    isListing: boolean
    isERC1155: boolean
    name?: string
    image?: string
}

export async function fetchOlderfallListings(signal?: AbortSignal): Promise<OlderfallListing[]> {
    if (!SEQUENCE_MARKETPLACE_API_URL || !SEQUENCE_PROJECT_ACCESS_KEY) {
        return []
    }

    const url = `${SEQUENCE_MARKETPLACE_API_URL}/rpc/Marketplace/ListCollectibles`

    const pageSize = 50
    let page = 1
    const listings: OlderfallListing[] = []

    for (;;) {
        const body: any = {
            contractAddress: OLDERFALL_ARMORS_ADDRESS,
            chainId: "137",
            page: {
                page,
                pageSize,
            },
            side: "listing",
            filter: {
                includeEmpty: true,
                searchText: "",
                properties: [],
                prices: [],
            },
        }

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Access-Key": SEQUENCE_PROJECT_ACCESS_KEY,
            },
            body: JSON.stringify(body),
            signal,
        })

        if (!res.ok) {
            break
        }

        const data = await res.json()
        const raw = (data && (data.collectibles || data.items || data.result || [])) as any[]

        if (!raw || raw.length === 0) {
            break
        }

        for (const o of raw) {
            const meta = o.metadata || {}
            const listing = o.listing || o.order || {}

            const tokenId = String(o.tokenId ?? o.token_id ?? meta.tokenId ?? listing.tokenId ?? "")

            const tokenContract = String(o.contractAddress ?? o.tokenContract ?? listing.collectionContractAddress ?? OLDERFALL_ARMORS_ADDRESS)

            const orderId = String(listing.orderId ?? "")

            const currency = String(listing.priceCurrencyAddress ?? listing.currency ?? listing.currencyAddress ?? "")

            const pricePerToken = String(listing.priceAmountNet ?? listing.priceAmount ?? listing.price ?? "")
            const priceDecimals = typeof listing.priceDecimals === "number" ? listing.priceDecimals : 18

            const name = meta.name ?? o.name
            const image = meta.image || o.image || (meta.properties && meta.properties.image) || undefined

            if (!tokenId || !orderId) {
                continue
            }

            listings.push({
                orderId,
                tokenId,
                tokenContract,
                currency,
                pricePerToken,
                priceDecimals,
                isListing: true,
                isERC1155: false,
                name,
                image,
            })
        }

        if (raw.length < pageSize) {
            break
        }

        page += 1
    }

    return listings
}

export type SequenceBuyStep = {
    id?: string
    to: string
    data: string
    value?: string | null
}

export async function generateOlderfallBuySteps(args: {
    chainId: string
    buyer: string
    orderId: string
    tokenId: string
    quantity: string
    signal?: AbortSignal
}): Promise<SequenceBuyStep[]> {
    if (!SEQUENCE_MARKETPLACE_API_URL || !SEQUENCE_PROJECT_ACCESS_KEY) {
        return []
    }

    const url = `${SEQUENCE_MARKETPLACE_API_URL}/rpc/Marketplace/GenerateBuyTransaction`

    const body: any = {
        chainId: args.chainId,
        collectionAddress: OLDERFALL_ARMORS_ADDRESS,
        buyer: args.buyer,
        marketplace: "sequence_marketplace_v2",
        ordersData: [
            {
                orderId: args.orderId,
                quantity: args.quantity,
                tokenId: args.tokenId,
            },
        ],
        additionalFees: [],
        walletType: "unknown",
    }

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Access-Key": SEQUENCE_PROJECT_ACCESS_KEY,
        },
        body: JSON.stringify(body),
        signal: args.signal,
    })

    if (!res.ok) {
        return []
    }

    const data = await res.json()
    const steps = (data && (data.steps || [])) as any[]

    return steps
        .filter((s) => s && typeof s.to === "string" && typeof s.data === "string")
        .map((s) => ({
            id: s.id,
            to: s.to,
            data: s.data,
            value: s.value ?? null,
        }))
}
