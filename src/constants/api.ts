/**
 * API and WebSocket URL constants
 *
 * Centralizes environment variable access for API endpoints.
 * Previously duplicated across 7 stores.
 */

export const API_URL = import.meta.env.VITE_API_URL ?? ''
export const WS_URL = import.meta.env.VITE_WS_URL ?? ''
