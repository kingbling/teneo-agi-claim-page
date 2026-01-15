/**
 * Wagmi Configuration
 *
 * Configuration for wallet connection using wagmi/core.
 */

import { createConfig, http } from '@wagmi/core'
import { mainnet } from '@wagmi/core/chains'
import { injected } from '@wagmi/connectors'

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [
    injected(),
  ],
  transports: {
    [mainnet.id]: http(),
  },
})
