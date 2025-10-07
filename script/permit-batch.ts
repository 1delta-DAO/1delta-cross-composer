import {
    createPublicClient,
    createWalletClient,
    http,
    parseUnits,
    encodeFunctionData,
    keccak256,
    toHex,
    type Address,
    type Hash,
    type Hex,
    type PublicClient,
    type WalletClient,
    PrivateKeyAccount,
    type TypedData,
} from "viem"
import { moonbeam } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { ERC20_ABI, CALL_PERMIT_ABI, BATCH_ABI, CALLER_ABI } from "./abi"
import dotenv from "dotenv"

dotenv.config()

const BATCH_PRECOMPILE: Address = "0x0000000000000000000000000000000000000808"
const CALL_PERMIT_PRECOMPILE: Address = "0x000000000000000000000000000000000000080a"
const xcUSDT: Address = "0xFFFFFFfFea09FB06d082fd1275CD48b191cbCD1d"

interface PermitBatchConfig {
    rpcUrl: string
    privateKey: string
    senderPrivateKey: string
    contract?: Address
}

class PermitBatch {
    private readonly walletClient: WalletClient
    private readonly account: PrivateKeyAccount
    private readonly config: PermitBatchConfig

    public readonly publicClient: PublicClient
    public readonly accountAddress: Address

    private DOMAIN_SEPARATOR: Hex | undefined

    constructor(config: PermitBatchConfig) {
        this.config = config
        this.account = privateKeyToAccount(config.privateKey as Hex)
        this.accountAddress = this.account.address

        this.publicClient = createPublicClient({
            chain: moonbeam,
            transport: http(config.rpcUrl),
        })

        this.walletClient = createWalletClient({
            chain: moonbeam,
            transport: http(config.rpcUrl),
        })
    }

    async getPermitNonce(owner: Address): Promise<bigint> {
        return await this.publicClient.readContract({
            address: CALL_PERMIT_PRECOMPILE,
            abi: CALL_PERMIT_ABI,
            functionName: "nonces",
            args: [owner],
        })
    }

    async getDomainSeparator(): Promise<Hex> {
        if (this.DOMAIN_SEPARATOR) {
            return this.DOMAIN_SEPARATOR
        }

        this.DOMAIN_SEPARATOR = await this.publicClient.readContract({
            address: CALL_PERMIT_PRECOMPILE,
            abi: CALL_PERMIT_ABI,
            functionName: "DOMAIN_SEPARATOR",
        })

        return this.DOMAIN_SEPARATOR
    }

    async createPermitSignature(
        from: Address,
        to: Address,
        value: bigint,
        data: Hex,
        gasLimit: bigint,
        deadline: bigint,
        nonce: bigint
    ): Promise<{ v: number; r: Hex; s: Hex }> {
        const typedData = {
            domain: {
                name: "Call Permit Precompile",
                version: "1",
                chainId: moonbeam.id,
                verifyingContract: CALL_PERMIT_PRECOMPILE,
            },
            types: {
                CallPermit: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "data", type: "bytes" },
                    { name: "gaslimit", type: "uint64" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                ],
            },
            primaryType: "CallPermit" as const,
            message: {
                from,
                to,
                value,
                data,
                gaslimit: gasLimit,
                nonce,
                deadline,
            },
        }

        const signature = await this.walletClient.signTypedData({
            account: this.account,
            domain: typedData.domain,
            types: typedData.types,
            primaryType: typedData.primaryType,
            message: typedData.message,
        })

        const sig = signature.slice(2)
        const r = `0x${sig.slice(0, 64)}` as Hex
        const s = `0x${sig.slice(64, 128)}` as Hex
        const v = parseInt(sig.slice(128, 130), 16)

        return { v, r, s }
    }

    createBatchData(targets: Address[], values: bigint[], callData: Hex[], gasLimits: bigint[]): Hex {
        return encodeFunctionData({
            abi: BATCH_ABI,
            functionName: "batchAll",
            args: [targets, values, callData, gasLimits],
        })
    }

    async executePermitBatch(from: Address, targets: Address[], values: bigint[], callData: Hex[], gasLimits: bigint[]): Promise<Hash> {
        const nonce = await this.getPermitNonce(from)
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)

        const batchData = this.createBatchData(targets, values, callData, gasLimits)

        const gasLimit = 800000n
        const { v, r, s } = await this.createPermitSignature(from, BATCH_PRECOMPILE, 0n, batchData, gasLimit, deadline, nonce)

        let hash: Hash
        if (this.config.contract) {
            hash = await this.walletClient.writeContract({
                account: privateKeyToAccount(this.config.senderPrivateKey as Hex),
                chain: moonbeam,
                address: this.config.contract,
                abi: CALLER_ABI,
                functionName: "permitCall",
                args: [from, BATCH_PRECOMPILE, 0n, batchData, gasLimit, deadline, v, r, s],
            })
        } else {
            hash = await this.walletClient.writeContract({
                account: privateKeyToAccount(this.config.senderPrivateKey as Hex),
                chain: moonbeam,
                address: CALL_PERMIT_PRECOMPILE,
                abi: CALL_PERMIT_ABI,
                functionName: "dispatch",
                args: [from, BATCH_PRECOMPILE, 0n, batchData, gasLimit, deadline, v, r, s],
            })
        }
        return hash ?? "0x"
    }

    async runTest(): Promise<void> {
        console.log("Test batchPermit")

        try {
            const user1 = this.account.address
            const user2 = process.env.TEST_ADDR1 as Address
            const user3 = process.env.TEST_ADDR2 as Address

            const targets: Address[] = [xcUSDT, xcUSDT]

            const values: bigint[] = [0n, 0n]
            const amount = parseUnits("0.1", 6)

            const callData: Hex[] = [
                encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [user3, amount],
                }),
                encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: "transfer",
                    args: [user2, amount],
                }),
            ]

            const gasLimits: bigint[] = [100000n, 100000n]

            const txHash = await this.executePermitBatch(user1, targets, values, callData, gasLimits)

            console.log(`permit batch hash: ${txHash}`)

            const receipt = await this.publicClient.waitForTransactionReceipt({
                hash: txHash,
            })

            console.log("Tx confirmed")
            console.log(`Gas used: ${receipt.gasUsed}`)
        } catch (error) {
            console.error("Test failed:", error)
            throw error
        }
    }

    async checkBalances(addresses: Address[]): Promise<void> {
        console.log("\nToken Balances:")
        for (const address of addresses) {
            const balance = await this.publicClient.readContract({
                address: xcUSDT,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [address],
            })
            console.log(`${address}: ${formatUnits(balance, 6)} xcUSDT`)
        }
    }
}

function formatUnits(value: bigint, decimals: number): string {
    return (Number(value) / Math.pow(10, decimals)).toFixed(6)
}

async function main() {
    const args = process.argv.slice(2)

    let config: PermitBatchConfig | null = null

    if (args[0] === "--m") {
        config = {
            rpcUrl: process.env.MOONBEAM_RPC_URL || "https://moonbeam.drpc.org",
            privateKey: process.env.PRIVATE_KEY || "",
            senderPrivateKey: process.env.SENDER_PRIVATE_KEY || "",
            contract: args[1] as Address,
        }
    } else {
        config = {
            rpcUrl: process.env.MOONBEAM_RPC_URL || "https://moonbeam.drpc.org",
            privateKey: process.env.PRIVATE_KEY || "",
            senderPrivateKey: process.env.SENDER_PRIVATE_KEY || "",
        }
    }

    if (!config.privateKey || !config.senderPrivateKey) {
        console.error("No private key is set in .env file")
        process.exit(1)
    }

    const script = new PermitBatch(config)

    try {
        await script.runTest()

        const addresses = [process.env.TEST_ADDR1 as Address, process.env.TEST_ADDR2 as Address, script.accountAddress]
        await script.checkBalances(addresses)
    } catch (error) {
        console.error("Script execution failed:", error)
        process.exit(1)
    }
}

main()
    .then(() => {
        console.log("Script execution completed")
        process.exit(0)
    })
    .catch(console.error)

export { PermitBatch as PermitBatchScript }
