/**
 * OrderComments.jsx
 * Display and edit internal notes for an order
 * v1.0.3 - Phase 5C: replaced all fetch() with apiFetch() for X-Admin-Token injection
 */

import { useState } from 'react'
import { API_URL } from '../config'
import { apiFetch } from '../api'

const OrderComments = ({ order, onUpdate }) => {
  const [notes, setNotes] = useState(order.notes || '')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshingSummary, setIsRefreshingSummary] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const patchRes = await apiFetch(`${API_URL}/orders/${order.order_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      })

      if (!patchRes.ok) {
        const errorText = await patchRes.text().catch(() => '')
        console.error('Failed to save notes. Status:', patchRes.status, errorText)
        throw new Error('Failed to save notes')
      }

      const summaryRes = await apiFetch(
        `${API_URL}/orders/${order.order_id}/generate-summary?force=true`,
        { method: 'POST' }
      )

      if (!summaryRes.ok) {
        const errorText = await summaryRes.text().catch(() => '')
        console.error('Failed to refresh AI summary. Status:', summaryRes.status, errorText)
        throw new Error('Failed to refresh AI summary')
      }

      setIsEditing(false)
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Failed to save notes or refresh summary:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefreshSummary = async () => {
    setIsRefreshingSummary(true)
    try {
      const summaryRes = await apiFetch(
        `${API_URL}/orders/${order.order_id}/generate-summary?force=true`,
        { method: 'POST' }
      )

      if (!summaryRes.ok) {
        const errorText = await summaryRes.text().catch(() => '')
        console.error('Failed to refresh AI summary. Status:', summaryRes.status, errorText)
        throw new Error('Failed to refresh AI summary')
      }

      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Failed to refresh summary:', err)
    } finally {
      setIsRefreshingSummary(false)
    }
  }

  return (
    <div className="order-comments">
      {order.comments && (
        <div className="comments-section">
          <h4>Customer Comments</h4>
          <p className="customer-comments">{order.comments}</p>
        </div>
      )}

      <div className="comments-section">
        <div className="section-header">
          <h4>Internal Notes</h4>
          {!isEditing && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setIsEditing(true)}
            >
              {notes ? 'Edit' : 'Add Note'}
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="notes-editor">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes... (e.g., 'Combine with order 5124', 'Customer called - rush order')"
              rows={4}
            />
            <div className="editor-actions">
              <button
                className="btn btn-sm btn-success"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setNotes(order.notes || '')
                  setIsEditing(false)
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          notes && <p className="internal-notes">{notes}</p>
        )}
      </div>

      <div className="comments-section">
        <div className="section-header">
          <h4>AI Summary</h4>
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleRefreshSummary}
            disabled={isRefreshingSummary}
          >
            {isRefreshingSummary ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        {order.ai_summary ? (
          <pre className="ai-summary">{order.ai_summary}</pre>
        ) : (
          <p className="no-summary">No AI summary yet. Click Refresh to generate.</p>
        )}
      </div>
    </div>
  )
}

export default OrderComments
