import { useState, useCallback } from 'react'
import { useClaimStore } from '@/stores/claimStore'

export function SynapseSearch() {
  const [input, setInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const { searchResults, searchSynapseByAddress, clearSearch, setNavigateToNode } = useClaimStore()

  const handleSearch = useCallback(() => {
    if (input.trim()) {
      const results = searchSynapseByAddress(input.trim())
      if (results.length > 0) {
        setNavigateToNode(results[0].id)
      }
    }
  }, [input, searchSynapseByAddress, setNavigateToNode])

  const handleClear = useCallback(() => {
    setInput('')
    clearSearch()
  }, [clearSearch])

  const handleResultClick = useCallback(
    (nodeId: string) => {
      setNavigateToNode(nodeId)
      setIsExpanded(false)
    },
    [setNavigateToNode]
  )

  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
      {/* Search Input */}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--background-secondary)]/90 backdrop-blur-sm px-3 py-2">
        <svg
          className="h-4 w-4 text-[var(--text-muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search wallet address..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setIsExpanded(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch()
            }
            if (e.key === 'Escape') {
              handleClear()
              setIsExpanded(false)
            }
          }}
          onFocus={() => setIsExpanded(true)}
          className="bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none w-48"
        />
        {input && (
          <button
            onClick={handleClear}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results */}
      {isExpanded && searchResults.length > 0 && (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background-secondary)]/95 backdrop-blur-sm max-h-60 overflow-y-auto">
          <div className="px-3 py-2 text-xs text-[var(--text-muted)] border-b border-[var(--card-border)]">
            {searchResults.length} synapse{searchResults.length !== 1 ? 's' : ''} found
          </div>
          {searchResults.slice(0, 10).map((node) => (
            <button
              key={node.id}
              onClick={() => handleResultClick(node.id)}
              className="w-full px-3 py-2 text-left hover:bg-[var(--brand-teal-1)]/10 transition-colors border-b border-[var(--card-border)] last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[var(--brand-teal-1)]" />
                <span className="text-sm font-mono text-[var(--text-primary)]">
                  {node.connectedBy}
                </span>
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5 capitalize">
                {node.region} region
              </div>
            </button>
          ))}
          {searchResults.length > 10 && (
            <div className="px-3 py-2 text-xs text-[var(--text-muted)] text-center">
              +{searchResults.length - 10} more results
            </div>
          )}
        </div>
      )}

      {/* No Results */}
      {isExpanded && input && searchResults.length === 0 && (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background-secondary)]/95 backdrop-blur-sm px-3 py-2">
          <span className="text-sm text-[var(--text-muted)]">No synapses found</span>
        </div>
      )}

      {/* Navigation Hint */}
      <div className="text-xs text-[var(--text-muted)] opacity-60">
        WASD or Arrow keys to navigate
      </div>
    </div>
  )
}
