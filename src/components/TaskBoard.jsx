/**
 * TaskBoard.jsx — Gmail-sweep task board (William 2026-07-25)
 *
 * Renders GET /tasks: everything that needs a human, grouped, each row with
 * a note box — type a disposition (e.g. "for S118998 I sent an email asking
 * if they saw the last one") and Save; the task moves to HANDLED. Below,
 * DONE RECENTLY shows what the robots already did (order_events, 3 days).
 * Read-only against Gmail; notes are the only write.
 */

import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config'
import { apiFetch } from '../api'

const TYPE_LABELS = [
  ['robot-flag',       'Robot flags — needs a human'],
  ['unread-customer',  'Customer emails (unread)'],
  ['unread-supplier',  'Supplier emails (unread)'],
  ['draft-waiting',    'Drafts waiting for review / send'],
  ['unpaid-order',     'Unpaid orders'],
  ['supplier-action',  'Supplier order actions'],
  ['shipment-watch',   'Shipments riding the poller'],
  ['unread-website',   'Website notifications (unread)'],
  ['unread-payment',   'Payment notifications (unread)'],
  ['unread-other',     'Other unread email'],
]

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d) ? s : d.toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function TaskBoard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drafts, setDrafts] = useState({})     // task_key -> note text being typed
  const [savingKey, setSavingKey] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`${API_URL}/tasks?z=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const saveNote = async (taskKey, note) => {
    setSavingKey(taskKey)
    try {
      const res = await apiFetch(`${API_URL}/tasks/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_key: taskKey, note }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
      setDrafts(d => { const n = { ...d }; delete n[taskKey]; return n })
    } catch (e) {
      alert(`Note save failed: ${e}`)
    } finally {
      setSavingKey(null)
    }
  }

  if (loading && !data) return <div className="empty">Sweeping Gmail + the order board...</div>
  if (error) return (
    <div className="empty">
      Task board failed: {error}{' '}
      <button className="btn btn-sm" onClick={load}>Retry</button>
    </div>
  )

  const todo = data?.todo || []
  const handled = data?.handled || []
  const events = data?.done_events || []
  const groups = TYPE_LABELS
    .map(([key, label]) => [key, label, todo.filter(t => t.type === key)])
    .filter(([, , items]) => items.length > 0)

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>NEEDS YOU — {todo.length} task{todo.length === 1 ? '' : 's'}</h2>
        <button className="btn btn-sm" onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
        <span style={{ color: 'var(--muted, #888)', fontSize: '12px' }}>swept {fmtDate(data?.generated_at)}</span>
      </div>

      {data?.errors && (
        <div className="empty" style={{ color: '#d97706', marginBottom: '10px' }}>
          Some sweeps failed: {Object.keys(data.errors).join(', ')} (board is partial)
        </div>
      )}

      {groups.length === 0 && <div className="empty">Nothing needs you right now.</div>}

      {groups.map(([key, label, items]) => (
        <div key={key} style={{ marginBottom: '22px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '14px' }}>{label} ({items.length})</h3>
          <table className="orders-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Detail</th>
                <th>Order</th>
                <th>Date</th>
                <th style={{ width: '34%' }}>Your note (saving marks it handled)</th>
              </tr>
            </thead>
            <tbody>
              {items.map(t => (
                <tr key={t.task_key}>
                  <td style={{ maxWidth: '320px' }}>{t.title}</td>
                  <td style={{ maxWidth: '260px' }}>{t.detail || '—'}</td>
                  <td>{t.order_id ? <span className="order-id">#{t.order_id}</span> : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.date)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        value={drafts[t.task_key] ?? ''}
                        placeholder="what you did / decided"
                        onChange={e => setDrafts(d => ({ ...d, [t.task_key]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter' && (drafts[t.task_key] || '').trim()) saveNote(t.task_key, drafts[t.task_key].trim()) }}
                        style={{ flex: 1, padding: '4px 8px' }}
                      />
                      <button
                        className="btn btn-sm"
                        disabled={savingKey === t.task_key || !(drafts[t.task_key] || '').trim()}
                        onClick={() => saveNote(t.task_key, drafts[t.task_key].trim())}
                      >
                        {savingKey === t.task_key ? '...' : 'Save'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {handled.length > 0 && (
        <div style={{ marginBottom: '22px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '14px' }}>HANDLED — your notes ({handled.length})</h3>
          <table className="orders-table">
            <thead>
              <tr><th>Task</th><th>Order</th><th>Your note</th><th>Noted</th><th></th></tr>
            </thead>
            <tbody>
              {handled.map(t => (
                <tr key={t.task_key} style={{ opacity: 0.75 }}>
                  <td style={{ maxWidth: '340px' }}>{t.title}</td>
                  <td>{t.order_id ? <span className="order-id">#{t.order_id}</span> : '—'}</td>
                  <td style={{ maxWidth: '340px' }}>{t.note}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.note_at)}</td>
                  <td>
                    <button className="btn btn-sm" disabled={savingKey === t.task_key}
                      onClick={() => saveNote(t.task_key, '')}>Reopen</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h3 style={{ margin: '0 0 6px', fontSize: '14px' }}>DONE RECENTLY — robot activity, last 3 days ({events.length})</h3>
        {events.length === 0 ? (
          <div className="empty">No recorded events in the last 3 days.</div>
        ) : (
          <table className="orders-table">
            <thead>
              <tr><th>Order</th><th>Event</th><th>Source</th><th>When</th></tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i}>
                  <td><span className="order-id">#{e.order_id}</span></td>
                  <td>{e.event_type}</td>
                  <td>{e.source || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
