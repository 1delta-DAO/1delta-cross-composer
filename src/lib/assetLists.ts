import { SUPPORTED_CHAIN_IDS } from "./data/chainIds"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const getListUrl = (chainId: string) => `https://raw.githubusercontent.com/1delta-DAO/asset-lists/main/${chainId}.json`

async function fetchChains() {
  const dir = path.resolve(__dirname, "./data/assets")
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  await Promise.all(
    SUPPORTED_CHAIN_IDS.map(async (chainId) => {
      try {
        const url = getListUrl(chainId)
        console.log(`Fetching ${chainId} from ${url}`)
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch ${chainId}: ${response.statusText}`)
        }
        const data = await response.json()
        const filePath = path.join(dir, `${chainId}.json`)
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8")
      } catch (error) {
        console.error(`Error fetching ${chainId}:`, error)
      }
    }),
  )
  console.log("Done!")
}

fetchChains()
