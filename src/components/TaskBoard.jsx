/**
 * TaskBoard.jsx — Task Board v2 (William's "v2 build", 2026-07-26)
 *
 * ONE tab, TWO boards stacked (William's layout ruling):
 *   ORDER TASKS — everything order-flavored
 *   OTHER TASKS — other mail, no-reply watch, manual tasks (+ Add-a-task),
 *                 Plaud recorder summaries (+ paste box)
 * Reads the MATERIALIZED board (GET /tasks — instant). Sweep now button
 * re-materializes on demand; the sync cycle re-sweeps automatically.
 *
 * Note box: saving marks the task HANDLED; on order-linked tasks the robot
 * parses safe intents ("invoice sent", "paid", "picked up") and runs the
 * matching checkpoint — anything it did shows in the green banner.
 * Email rows: Read / Archive / Delete. Delete is TWO clicks (William's
 * double-confirm ruling) and goes to Gmail Trash (30-day failsafe).
 */

import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config'
import { apiFetch } from '../api'

const ACTION_OPTIONS = [
  ['', 'Mark order…'],
  ['payment_link_sent', 'Invoice / payment link sent'],
  ['payment_received',  'Payment received'],
  ['is_complete',       'Picked up / delivered / complete'],
]

const TYPE_LABELS = [
  ['follow-up',       'Follow-ups (yours)'],
  ['robot-flag',      'Robot flags — needs a human'],
  ['unread-customer', 'Customer emails (unread)'],
  ['unread-supplier', 'Supplier emails (unread)'],
  ['unread-payment',  'Payment notifications (unread)'],
  ['unread-website',  'Website notifications (unread)'],
  ['draft-waiting',   'Drafts waiting for review / send'],
  ['unpaid-order',    'Unpaid orders'],
  ['supplier-action', 'Supplier order actions'],
  ['shipment-watch',  'Shipments riding the poller'],
  ['no-reply',        'No answer yet — our email, 2+ business days'],
  ['manual',          'Your tasks'],
  ['plaud',           'Recorder summaries'],
  ['unread-other',    'Other unread email'],
]

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d) ? s : d.toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function TaskBoard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sweeping, setSweeping] = useState(false)
  const [error, setError] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [picks, setPicks] = useState({})           // task_key -> dropdown action
  const [fuOpen, setFuOpen] = useState(null)       // order_id with follow-up box open
  const [fuText, setFuText] = useState({})
  const [fuDue, setFuDue] = useState({})
  const [busyKey, setBusyKey] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)   // task_key pending 2nd yes
  const [banner, setBanner] = useState(null)
  const [newTask, setNewTask] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [plaudOpen, setPlaudOpen] = useState(false)
  const [plaudTitle, setPlaudTitle] = useState('')
  const [plaudText, setPlaudText] = useState('')
  const [plaudView, setPlaudView] = useState(null)           // {title, body}

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await apiFetch(`${API_URL}/tasks?z=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const flash = (msg) => { setBanner(msg); setTimeout(() => setBanner(null), 7000) }

  const sweepNow = async () => {
    setSweeping(true)
    try { await apiFetch(`${API_URL}/tasks/sweep`, { method: 'POST' }); await load() }
    catch (e) { alert(`Sweep failed: ${e}`) } finally { setSweeping(false) }
  }

  const saveNote = async (taskKey, note) => {
    setBusyKey(taskKey)
    try {
      const res = await apiFetch(`${API_URL}/tasks/note`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_key: taskKey, note }),
      })
      const d = await res.json()
      if (d.status !== 'ok') throw new Error(d.message || `HTTP ${res.status}`)
      await load()
      setDrafts(x => { const n = { ...x }; delete n[taskKey]; return n })
    } catch (e) { alert(`Note failed: ${e}`) } finally { setBusyKey(null) }
  }

  const fireAction = async (taskKey) => {
    const action = picks[taskKey]
    if (!action) return
    setBusyKey(taskKey)
    try {
      const res = await apiFetch(`${API_URL}/tasks/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_key: taskKey, action }),
      })
      const d = await res.json()
      if (d.status !== 'ok') throw new Error(d.message || 'failed')
      flash(`Order #${d.order_id}: ${d.label} ✓`)
      setPicks(x => { const n = { ...x }; delete n[taskKey]; return n })
      await load()
    } catch (e) { alert(`Action failed: ${e}`) } finally { setBusyKey(null) }
  }

  const markDone = async (taskKey) => {
    setBusyKey(taskKey)
    try {
      await apiFetch(`${API_URL}/tasks/done`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_key: taskKey }),
      })
      await load()
    } finally { setBusyKey(null) }
  }

  const changeDue = async (taskKey, due) => {
    if (!due) return
    await apiFetch(`${API_URL}/tasks/due`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_key: taskKey, due_date: due }),
    })
    await load()
  }

  const addFollowUp = async (orderId) => {
    const text = (fuText[orderId] || '').trim()
    if (!text) return
    const res = await apiFetch(`${API_URL}/tasks/manual`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, order_id: orderId, due_date: fuDue[orderId] || 'tomorrow' }),
    })
    const d = await res.json()
    if (d.status === 'ok') {
      setFuOpen(null)
      setFuText(x => { const n = { ...x }; delete n[orderId]; return n })
      flash(`Follow-up added on #${orderId}${d.due_date ? ` — ${d.due_date}` : ''}`)
      await load()
    } else alert(d.message || 'follow-up failed')
  }

  const emailAction = async (taskKey, action) => {
    if (action === 'trash' && confirmDelete !== taskKey) {
      setConfirmDelete(taskKey)
      setTimeout(() => setConfirmDelete(k => (k === taskKey ? null : k)), 6000)
      return
    }
    setConfirmDelete(null); setBusyKey(taskKey)
    try {
      const res = await apiFetch(`${API_URL}/tasks/email-action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_key: taskKey, action }),
      })
      const d = await res.json()
      if (d.status !== 'ok') throw new Error(d.message || 'failed')
      flash(action === 'trash' ? 'Moved to Gmail Trash (recoverable 30 days)' : `Marked ${action}`)
      await load()
    } catch (e) { alert(`${action} failed: ${e}`) } finally { setBusyKey(null) }
  }

  const addManual = async () => {
    if (!newTask.trim()) return
    const res = await apiFetch(`${API_URL}/tasks/manual`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newTask.trim(), due_date: newTaskDue || null }),
    })
    if ((await res.json()).status === 'ok') { setNewTask(''); setNewTaskDue(''); await load() }
  }

  const addPlaud = async () => {
    if (!plaudText.trim()) return
    const res = await apiFetch(`${API_URL}/tasks/plaud`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: plaudTitle.trim(), text: plaudText }),
    })
    if ((await res.json()).status === 'ok') {
      setPlaudTitle(''); setPlaudText(''); setPlaudOpen(false); await load()
    }
  }

  const openPlaud = async (taskKey) => {
    const pid = taskKey.split(':')[1]
    const res = await apiFetch(`${API_URL}/tasks/plaud/${pid}`)
    const d = await res.json()
    if (d.status === 'ok') setPlaudView(d)
  }

  if (loading && !data) return <div className="empty">Loading the board...</div>
  if (error) return <div className="empty">Board failed: {error} <button className="btn btn-sm" onClick={load}>Retry</button></div>

  const renderRows = (items) => (
    <tbody>
      {items.map(t => (
        <tr key={t.task_key}>
          <td style={{ maxWidth: '300px' }}>
            {t.type === 'plaud'
              ? <a href="#" onClick={e => { e.preventDefault(); openPlaud(t.task_key) }}>{t.title}</a>
              : t.title}
          </td>
          <td style={{ maxWidth: '240px' }}>{t.detail || '—'}{t.due_date ? ` · due ${t.due_date}` : ''}</td>
          <td>{t.order_id ? <span className="order-id">#{t.order_id}</span> : '—'}</td>
          <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.date_str)}</td>
          <td>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
              {(t.type === 'manual' || t.type === 'follow-up') ? (
                <>
                  <button className="btn btn-sm" disabled={busyKey === t.task_key}
                    style={{ background: 'rgba(5,150,105,0.12)', color: '#059669', fontWeight: 700 }}
                    onClick={() => markDone(t.task_key)}>Done</button>
                  <input type="date" defaultValue={t.due_date || ''} title="change follow-up date"
                    onChange={e => changeDue(t.task_key, e.target.value)} style={{ padding: '3px' }} />
                </>
              ) : (
                <>
                  <input type="text" value={drafts[t.task_key] ?? ''} placeholder="note (never triggers anything)"
                    onChange={e => setDrafts(x => ({ ...x, [t.task_key]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && (drafts[t.task_key] || '').trim()) saveNote(t.task_key, drafts[t.task_key].trim()) }}
                    style={{ flex: 1, minWidth: '130px', padding: '4px 8px' }} />
                  <button className="btn btn-sm" disabled={busyKey === t.task_key || !(drafts[t.task_key] || '').trim()}
                    onClick={() => saveNote(t.task_key, drafts[t.task_key].trim())}>Save</button>
                </>
              )}
              {t.order_id && t.type !== 'manual' && t.type !== 'follow-up' && (
                <>
                  <select value={picks[t.task_key] || ''}
                    onChange={e => setPicks(x => ({ ...x, [t.task_key]: e.target.value }))}
                    style={{ padding: '4px' }}>
                    {ACTION_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <button className="btn btn-sm" disabled={busyKey === t.task_key || !picks[t.task_key]}
                    onClick={() => fireAction(t.task_key)}>Apply</button>
                  <button className="btn btn-sm" title="add a follow-up task on this order"
                    onClick={() => setFuOpen(o => (o === t.order_id ? null : t.order_id))}>+ Follow-up</button>
                </>
              )}
              {t.gmail_id && t.type.startsWith('unread') && (
                <>
                  <button className="btn btn-sm" disabled={busyKey === t.task_key}
                    onClick={() => emailAction(t.task_key, 'read')}>Read</button>
                  <button className="btn btn-sm" disabled={busyKey === t.task_key}
                    onClick={() => emailAction(t.task_key, 'archive')}>Archive</button>
                  <button className="btn btn-sm" disabled={busyKey === t.task_key}
                    style={confirmDelete === t.task_key ? { background: '#DC2626', color: '#fff', fontWeight: 700 } : { color: '#DC2626' }}
                    onClick={() => emailAction(t.task_key, 'trash')}>
                    {confirmDelete === t.task_key ? 'Sure? DELETE!' : 'Delete'}
                  </button>
                </>
              )}
            </div>
            {fuOpen && t.order_id === fuOpen && t.type !== 'manual' && t.type !== 'follow-up' && (
              <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                <input type="text" value={fuText[t.order_id] ?? ''} placeholder={`follow-up on #${t.order_id} — e.g. call them`}
                  onChange={e => setFuText(x => ({ ...x, [t.order_id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addFollowUp(t.order_id) }}
                  style={{ flex: 1, minWidth: '180px', padding: '4px 8px' }} />
                <input type="date" value={fuDue[t.order_id] ?? ''} onChange={e => setFuDue(x => ({ ...x, [t.order_id]: e.target.value }))}
                  style={{ padding: '3px' }} title="defaults to tomorrow" />
                <button className="btn btn-sm" onClick={() => addFollowUp(t.order_id)}
                  disabled={!(fuText[t.order_id] || '').trim()}>Add</button>
              </div>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  )

  const renderBoard = (items) => {
    const groups = TYPE_LABELS.map(([k, label]) => [k, label, items.filter(t => t.type === k)])
      .filter(([, , v]) => v.length > 0)
    if (groups.length === 0) return <div className="empty">Nothing here right now.</div>
    return groups.map(([k, label, v]) => (
      <div key={k} style={{ marginBottom: '18px' }}>
        <h4 style={{ margin: '0 0 6px', fontSize: '13px' }}>{label} ({v.length})</h4>
        <table className="orders-table">
          <thead><tr><th>Task</th><th>Detail</th><th>Order</th><th>Date</th>
            <th style={{ width: '38%' }}>Your note / actions</th></tr></thead>
          {renderRows(v)}
        </table>
      </div>
    ))
  }

  const orderTasks = data?.order_tasks || []
  const otherTasks = data?.other_tasks || []

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
        <button className="btn btn-sm" onClick={sweepNow} disabled={sweeping}>{sweeping ? 'Sweeping…' : 'Sweep now'}</button>
        <span style={{ color: 'var(--muted, #888)', fontSize: '12px' }}>last sweep {fmtDate(data?.last_sweep)}</span>
      </div>
      {banner && (
        <div style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid #059669', color: '#059669', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', fontWeight: 600 }}>
          {banner}
        </div>
      )}

      <h2 style={{ margin: '4px 0 10px', fontSize: '18px' }}>ORDER TASKS — {orderTasks.length}</h2>
      {renderBoard(orderTasks)}

      <h2 style={{ margin: '26px 0 10px', fontSize: '18px' }}>OTHER TASKS — {otherTasks.length}</h2>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <input type="text" value={newTask} placeholder="Add a task — e.g. Called Eddie, he said ship Tuesday"
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addManual() }}
          style={{ flex: 1, minWidth: '260px', padding: '6px 10px' }} />
        <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} style={{ padding: '5px' }} title="optional follow-up date" />
        <button className="btn btn-sm" onClick={addManual} disabled={!newTask.trim()}>Add task</button>
        <button className="btn btn-sm" onClick={() => setPlaudOpen(o => !o)}>{plaudOpen ? 'Close recorder box' : 'Paste recorder summary'}</button>
      </div>
      {plaudOpen && (
        <div style={{ border: '1px solid var(--border, #ddd)', borderRadius: '6px', padding: '10px', marginBottom: '14px' }}>
          <input type="text" value={plaudTitle} placeholder="Summary title (e.g. Call with Eddie 7/26)"
            onChange={e => setPlaudTitle(e.target.value)} style={{ width: '100%', padding: '6px 10px', marginBottom: '6px' }} />
          <textarea value={plaudText} placeholder="Paste the Plaud summary text here"
            onChange={e => setPlaudText(e.target.value)} rows={6} style={{ width: '100%', padding: '8px' }} />
          <button className="btn btn-sm" onClick={addPlaud} disabled={!plaudText.trim()} style={{ marginTop: '6px' }}>Save summary</button>
        </div>
      )}
      {renderBoard(otherTasks)}

      {(data?.handled || []).length > 0 && (
        <div style={{ marginTop: '26px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '14px' }}>HANDLED — your notes ({data.handled.length})</h3>
          <table className="orders-table">
            <thead><tr><th>Task</th><th>Order</th><th>Your note</th><th>Noted</th><th></th></tr></thead>
            <tbody>
              {data.handled.map(t => (
                <tr key={t.task_key} style={{ opacity: 0.75 }}>
                  <td style={{ maxWidth: '320px' }}>{t.title}</td>
                  <td>{t.order_id ? <span className="order-id">#{t.order_id}</span> : '—'}</td>
                  <td style={{ maxWidth: '320px' }}>{t.note}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.note_at)}</td>
                  <td><button className="btn btn-sm" disabled={busyKey === t.task_key}
                    onClick={() => saveNote(t.task_key, '')}>Reopen</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '26px' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '14px' }}>DONE RECENTLY — robot activity, last 3 days ({(data?.done_events || []).length})</h3>
        {(data?.done_events || []).length === 0 ? <div className="empty">No recorded events.</div> : (
          <table className="orders-table">
            <thead><tr><th>Order</th><th>Event</th><th>Source</th><th>When</th></tr></thead>
            <tbody>
              {data.done_events.map((e, i) => (
                <tr key={i}><td><span className="order-id">#{e.order_id}</span></td>
                  <td>{e.event_type}</td><td>{e.source || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.at)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {plaudView && (
        <div onClick={() => setPlaudView(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--card, #fff)', borderRadius: '8px', padding: '20px', maxWidth: '720px', width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>{plaudView.title}</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '13px' }}>{plaudView.body}</pre>
            <button className="btn btn-sm" onClick={() => setPlaudView(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
