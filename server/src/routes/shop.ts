/**
 * Shop API Routes - Masterplan 2026
 *
 * The shop allows players to purchase items using $AGENTIC tokens.
 * Items can be equipped to ships to provide various bonuses.
 */

import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { db } from '../db/index.js'
import { getUser, updateUser, getAgent } from '../db/index.js'
import { ITEM_DEFINITIONS, type ItemType } from '../config/gameConfig.js'
import {
  asyncHandler,
  sendError,
} from '../middleware/errorHandler.js'

const router = Router()

// Type for shop item response
interface ShopItemResponse {
  id: ItemType
  name: string
  description: string
  cost: number
  effectValue: number
  durationMinutes: number | null
  available: boolean
}

// Type for user item response
interface UserItemResponse {
  id: string
  itemType: ItemType
  name: string
  description: string
  effectValue: number
  durationMinutes: number | null
  purchasedAt: number
  equippedToShipId: string | null
  expiresAt: number | null
  isActive: boolean
}

/**
 * GET /api/shop/items
 * Get all available shop items
 */
router.get('/items', (req: Request, res: Response) => {
  try {
    const items: ShopItemResponse[] = Object.values(ITEM_DEFINITIONS).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      cost: item.cost,
      effectValue: item.effectValue,
      durationMinutes: item.durationMinutes,
      available: true,  // All items are always available for now
    }))

    res.json({ items })
  } catch (error) {
    console.error('Failed to get shop items:', error)
    res.status(500).json({ error: 'Failed to get shop items' })
  }
})

/**
 * POST /api/shop/purchase
 * Purchase an item from the shop
 */
router.post('/purchase', (req: Request, res: Response) => {
  try {
    const { userId, itemType, quantity } = req.body as {
      userId: string
      itemType: ItemType
      quantity?: number
    }

    if (!userId || !itemType) {
      return res.status(400).json({ error: 'userId and itemType are required' })
    }

    const itemDef = ITEM_DEFINITIONS[itemType]
    if (!itemDef) {
      return res.status(400).json({ error: `Invalid item type: ${itemType}` })
    }

    const user = getUser(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const purchaseQuantity = Math.max(1, quantity || 1)
    const totalCost = itemDef.cost * purchaseQuantity

    // Check if user has enough points (using points as $AGENTIC for now)
    if (user.points < totalCost) {
      return res.status(400).json({
        error: `Insufficient funds. Need ${totalCost} $AGENTIC, have ${user.points}`
      })
    }

    // Perform transaction
    const transaction = db.transaction(() => {
      // Deduct points from user
      updateUser({ id: userId, points: user.points - totalCost })

      // Create item instances for user (using user_purchases table per schema.sql)
      const purchasedItems: UserItemResponse[] = []
      const now = Date.now()

      const insertStmt = db.prepare(`
        INSERT INTO user_purchases (id, user_id, item_id, ship_id, purchased_at, expires_at, is_active)
        VALUES (?, ?, ?, NULL, ?, NULL, 0)
      `)

      for (let i = 0; i < purchaseQuantity; i++) {
        const purchaseId = uuid()
        insertStmt.run(purchaseId, userId, itemType, now)

        purchasedItems.push({
          id: purchaseId,
          itemType,
          name: itemDef.name,
          description: itemDef.description,
          effectValue: itemDef.effectValue,
          durationMinutes: itemDef.durationMinutes,
          purchasedAt: now,
          equippedToShipId: null,
          expiresAt: null,
          isActive: false,
        })
      }

      return purchasedItems
    })

    const purchasedItems = transaction()
    const updatedUser = getUser(userId)

    res.status(201).json({
      success: true,
      items: purchasedItems,
      totalCost,
      newBalance: updatedUser?.points || 0,
      message: `Purchased ${purchaseQuantity}x ${itemDef.name} for ${totalCost} $AGENTIC`
    })
  } catch (error) {
    console.error('Purchase failed:', error)
    res.status(500).json({ error: 'Failed to complete purchase' })
  }
})

/**
 * GET /api/users/:userId/items
 * Get all items owned by a user
 */
router.get('/users/:userId/items', (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const { equipped, active } = req.query

    const user = getUser(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Use user_purchases table per schema.sql
    let query = 'SELECT * FROM user_purchases WHERE user_id = ?'
    const params: any[] = [userId]

    // Optional filters
    if (equipped === 'true') {
      query += ' AND ship_id IS NOT NULL'
    } else if (equipped === 'false') {
      query += ' AND ship_id IS NULL'
    }

    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as any[]

    const now = Date.now()
    const items: UserItemResponse[] = rows.map(row => {
      const itemDef = ITEM_DEFINITIONS[row.item_id as ItemType]
      const isExpired = row.expires_at && row.expires_at < now

      return {
        id: row.id,
        itemType: row.item_id,
        name: itemDef?.name || row.item_id,
        description: itemDef?.description || '',
        effectValue: itemDef?.effectValue || 0,
        durationMinutes: itemDef?.durationMinutes || null,
        purchasedAt: row.purchased_at,
        equippedToShipId: row.ship_id,
        expiresAt: row.expires_at,
        isActive: row.is_active === 1 && !isExpired,
      }
    })

    // Filter by active status if requested
    let filteredItems = items
    if (active === 'true') {
      filteredItems = items.filter(item => item.isActive)
    } else if (active === 'false') {
      filteredItems = items.filter(item => !item.isActive)
    }

    res.json({
      items: filteredItems,
      counts: {
        total: items.length,
        equipped: items.filter(i => i.equippedToShipId).length,
        active: items.filter(i => i.isActive).length,
        available: items.filter(i => !i.equippedToShipId && !i.expiresAt).length,
      }
    })
  } catch (error) {
    console.error('Failed to get user items:', error)
    res.status(500).json({ error: 'Failed to get user items' })
  }
})

/**
 * POST /api/items/:id/activate
 * Activate an item (enables its effects)
 */
router.post('/items/:id/activate', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { shipId } = req.body as { shipId?: string }

  // Get the item purchase
  const item = db.prepare(`
    SELECT up.*, ish.name as item_name, ish.effect_type, ish.duration_minutes
    FROM user_purchases up
    LEFT JOIN item_shop ish ON up.item_id = ish.id
    WHERE up.id = ?
  `).get(id) as any

  if (!item) {
    sendError(res, 404, 'Item not found')
    return
  }

  // Check if already active
  if (item.is_active === 1) {
    sendError(res, 400, 'Item is already active')
    return
  }

  // Check if expired
  const now = Date.now()
  if (item.expires_at && item.expires_at < now) {
    sendError(res, 400, 'Item has expired')
    return
  }

  // If shipId provided, validate the ship exists and belongs to user
  if (shipId) {
    const ship = getAgent(shipId)
    if (!ship) {
      sendError(res, 404, 'Ship not found')
      return
    }
    if (ship.ownerId !== item.user_id) {
      sendError(res, 403, 'Ship does not belong to item owner')
      return
    }
  }

  // Calculate expiration if duration-based item
  let expiresAt = item.expires_at
  if (item.duration_minutes && !expiresAt) {
    expiresAt = now + (item.duration_minutes * 60 * 1000)
  }

  // Activate the item
  db.prepare(`
    UPDATE user_purchases
    SET is_active = 1, ship_id = ?, expires_at = ?
    WHERE id = ?
  `).run(shipId || item.ship_id, expiresAt, id)

  const itemDef = ITEM_DEFINITIONS[item.item_id as ItemType]

  res.json({
    success: true,
    item: {
      id: item.id,
      itemType: item.item_id,
      name: itemDef?.name || item.item_name || item.item_id,
      isActive: true,
      equippedToShipId: shipId || item.ship_id,
      expiresAt,
    },
    message: `${itemDef?.name || item.item_id} activated${shipId ? ` on ship` : ''}`
  })
}))

/**
 * POST /api/items/:id/deactivate
 * Deactivate an item (disables its effects)
 */
router.post('/items/:id/deactivate', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  // Get the item purchase
  const item = db.prepare(`
    SELECT up.*, ish.name as item_name
    FROM user_purchases up
    LEFT JOIN item_shop ish ON up.item_id = ish.id
    WHERE up.id = ?
  `).get(id) as any

  if (!item) {
    sendError(res, 404, 'Item not found')
    return
  }

  // Check if already inactive
  if (item.is_active === 0) {
    sendError(res, 400, 'Item is already inactive')
    return
  }

  // Deactivate the item (keep ship_id for reference, clear expires_at for reuse)
  db.prepare(`
    UPDATE user_purchases
    SET is_active = 0
    WHERE id = ?
  `).run(id)

  const itemDef = ITEM_DEFINITIONS[item.item_id as ItemType]

  res.json({
    success: true,
    item: {
      id: item.id,
      itemType: item.item_id,
      name: itemDef?.name || item.item_name || item.item_id,
      isActive: false,
      equippedToShipId: item.ship_id,
    },
    message: `${itemDef?.name || item.item_id} deactivated`
  })
}))

/**
 * GET /api/items/:id
 * Get a specific item by ID
 */
router.get('/items/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params

  const item = db.prepare(`
    SELECT up.*, ish.name as item_name, ish.description as item_description,
           ish.effect_type, ish.effect_value, ish.duration_minutes
    FROM user_purchases up
    LEFT JOIN item_shop ish ON up.item_id = ish.id
    WHERE up.id = ?
  `).get(id) as any

  if (!item) {
    sendError(res, 404, 'Item not found')
    return
  }

  const itemDef = ITEM_DEFINITIONS[item.item_id as ItemType]
  const now = Date.now()
  const isExpired = item.expires_at && item.expires_at < now

  res.json({
    item: {
      id: item.id,
      itemType: item.item_id,
      name: itemDef?.name || item.item_name || item.item_id,
      description: itemDef?.description || item.item_description || '',
      effectValue: itemDef?.effectValue || item.effect_value || 0,
      durationMinutes: itemDef?.durationMinutes || item.duration_minutes || null,
      purchasedAt: item.purchased_at,
      equippedToShipId: item.ship_id,
      expiresAt: item.expires_at,
      isActive: item.is_active === 1 && !isExpired,
      isExpired,
    }
  })
}))

export default router
