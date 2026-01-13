/**
 * Wagmi Configuration
 *
 * Configuration for wallet connection using wagmi/core.
 */

import { createConfig, http } from '@wagmi/core'
import { mainnet, polygon, arbitrum } from '@wagmi/core/chains'
import { injected } from '@wagmi/connectors'

export const wagmiConfig = createConfig({
  chains: [mainnet, polygon, arbitrum],
  connectors: [
    injected(),
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
  },
})

// Re-export chains for use elsewhere
export { mainnet, polygon, arbitrum }
