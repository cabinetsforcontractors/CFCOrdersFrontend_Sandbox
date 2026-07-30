/**
 * TaskBoard.jsx — QUEUE BOARD v3 (Phase B, William-approved design 2026-07-30)
 *
 * RULINGS BAKED IN:
 *   - RUNDOWN IS GONE ("this is really useless it can go away").
 *   - MONEY STRIP: one line at the top (landed 24h · awaiting · 90-day freight).
 *   - THE QUEUE: one list, OLDEST FIRST — the thing that's waited longest is
 *     the thing you deal with first. Cards, not grouped tables.
 *   - REPLY COMPOSER on every email card: type a rough intent, hit
 *     "Write & Preview" — popup shows the email chain + the draft (the
 *     William way), you edit if needed, SEND fires it into the real thread.
 *     Preview stays mandatory for now ("as it learns we will turn that off").
 *   - ROBOT-SETTLED TRACE: "Robot settle" button runs the auto-settler live;
 *     anything it closed shows "robot settled this because X".
 *
 * Everything else that worked stays: notes, Mark order…, follow-ups,
 * Read/Archive/Delete (2-click), add-a-task, Plaud box, archive, done events.
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

const TYPE_BADGES = {
  'follow-up':       ['FOLLOW-UP', '#7C3AED'],
  'robot-flag':      ['ROBOT FLAG', '#DC2626'],
  'unread-customer': ['CUSTOMER', '#1D4ED8'],
  'unread-supplier': ['SUPPLIER', '#B45309'],
  'unread-payment':  ['PAYMENT', '#059669'],
  'unread-website':  ['WEBSITE', '#0E7490'],
  'draft-waiting':   ['DRAFT WAITING', '#9333EA'],
  'unpaid-order':    ['UNPAID', '#DC2626'],
  'supplier-action': ['SUPPLIER ACTION', '#B45309'],
  'shipment-watch':  ['SHIPMENT', '#0E7490'],
  'no-reply':        ['NO REPLY 2d+', '#DC2626'],
  'manual':          ['YOUR TASK', '#374151'],
  'plaud':           ['RECORDER', '#374151'],
  'unread-other':    ['OTHER MAIL', '#6B7280'],
}

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d) ? s : d.toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function ageDays(s) {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d)) return null
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  return days
}

function ageLabel(s) {
  const d = ageDays(s)
  if (d === null) return ''
  if (d <= 0) return 'today'
  if (d === 1) return '1 day'
  return `${d} days`
}

export default function TaskBoard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sweeping, setSweeping] = useState(false)
  const [error, setError] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [picks, setPicks] = useState({})
  const [fuOpen, setFuOpen] = useState(null)
  const [fuText, setFuText] = useState({})
  const [fuDue, setFuDue] = useState({})
  const [busyKey, setBusyKey] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [banner, setBanner] = useState(null)
  const [newTask, setNewTask] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [plaudOpen, setPlaudOpen] = useState(false)
  const [plaudTitle, setPlaudTitle] = useState('')
  const [plaudText, setPlaudText] = useState('')
  const [plaudView, setPlaudView] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const [archive, setArchive] = useState(null)

  // money strip + robot settle
  const [strip, setStrip] = useState(null)
  const [settling, setSettling] = useState(false)

  // reply composer
  const [intents, setIntents] = useState({})        // task_key -> intent text
  const [composeBusy, setComposeBusy] = useState(null)
  const [preview, setPreview] = useState(null)      // {task, to, subject, draft_body, chain, message_id}
  const [sendBusy, setSendBusy] = useState(false)
  const [chainOpen, setChainOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await apiFetch(`${API_URL}/tasks?z=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
    try {
      const ms = await apiFetch(`${API_URL}/queue/money-strip?z=${Date.now()}`)
      if (ms.ok) setStrip(await ms.json())
    } catch { /* strip is decoration — board still works */ }
  }, [])

  const loadArchive = async () => {
    if (showArchive) { setShowArchive(false); return }
    setShowArchive(true)
    try {
      const r = await apiFetch(`${API_URL}/tasks/archive`)
      if (r.ok) setArchive((await r.json()).archive || [])
    } catch { setArchive([]) }
  }

  // Sweep-on-open (William 2026-07-29): board reflects what he just did in Gmail.
  useEffect(() => {
    let alive = true
    load().then(async () => {
      if (!alive) return
      setSweeping(true)
      try {
        await apiFetch(`${API_URL}/tasks/sweep`, { method: 'POST' })
        if (alive) await load()
      } catch { /* board still shows last sweep */ }
      finally { if (alive) setSweeping(false) }
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flash = (msg) => { setBanner(msg); setTimeout(() => setBanner(null), 9000) }

  const sweepNow = async () => {
    setSweeping(true)
    try { await apiFetch(`${API_URL}/tasks/sweep`, { method: 'POST' }); await load() }
    catch (e) { alert(`Sweep failed: ${e}`) } finally { setSweeping(false) }
  }

  const robotSettle = async () => {
    setSettling(true)
    try {
      const res = await apiFetch(`${API_URL}/auto-settle/run`, { method: 'POST' })
      const d = await res.json()
      const done = d.settled || []
      flash(done.length === 0
        ? 'Robot settle: nothing it could safely close.'
        : `Robot settled ${done.length}: ${done.map(s => `${s.title || s.task_key} (${s.reason})`).join(' · ')}`)
      await load()
    } catch (e) { alert(`Robot settle failed: ${e}`) } finally { setSettling(false) }
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

  // ---- THE COMPOSER ----
  const writePreview = async (t) => {
    const intent = (intents[t.task_key] || '').trim()
    if (!intent || !t.gmail_id) return
    setComposeBusy(t.task_key)
    try {
      const res = await apiFetch(`${API_URL}/reply/compose`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: t.gmail_id, intent, order_id: t.order_id || null }),
      })
      const d = await res.json()
      if (d.status !== 'ok') throw new Error(d.message || `HTTP ${res.status}`)
      setChainOpen(false)
      setPreview({ task: t, ...d })
    } catch (e) { alert(`Compose failed: ${e}`) } finally { setComposeBusy(null) }
  }

  const sendPreview = async () => {
    if (!preview || !(preview.draft_body || '').trim()) return
    setSendBusy(true)
    try {
      const res = await apiFetch(`${API_URL}/reply/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: preview.message_id,
          body: preview.draft_body,
          subject: preview.subject || '',
        }),
      })
      const d = await res.json()
      if (d.status !== 'ok') throw new Error(d.message || 'send failed')
      flash(d.redirected
        ? `Sent — SAFETY REDIRECT: landed in your inbox, not ${d.original_to} (allowlist closed)`
        : `Sent to ${d.to} ✓`)
      setIntents(x => { const n = { ...x }; delete n[preview.task.task_key]; return n })
      setPreview(null)
      await load()
    } catch (e) { alert(`Send failed: ${e}`) } finally { setSendBusy(false) }
  }

  if (loading && !data) return <div className="empty">Loading the queue...</div>
  if (error) return <div className="empty">Queue failed: {error} <button className="btn btn-sm" onClick={load}>Retry</button></div>

  // THE QUEUE: everything actionable, one list, OLDEST FIRST.
  const queue = [...(data?.order_tasks || []), ...(data?.other_tasks || [])]
    .sort((a, b) => {
      const da = new Date(a.date_str || 0).getTime() || 0
      const db = new Date(b.date_str || 0).getTime() || 0
      return da - db
    })

  const renderCard = (t) => {
    const [badge, color] = TYPE_BADGES[t.type] || [t.type.toUpperCase(), '#6B7280']
    const days = ageDays(t.date_str)
    const isEmail = !!t.gmail_id && t.type.startsWith('unread')
    const canMark = t.order_id && t.type !== 'manual' && t.type !== 'follow-up'
    return (
      <div key={t.task_key} style={{
        border: '1px solid var(--border, #ddd)', borderRadius: '8px',
        padding: '10px 14px', marginBottom: '10px',
        borderLeft: `4px solid ${color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color, letterSpacing: '0.5px' }}>{badge}</span>
          {t.order_id && <span className="order-id">#{t.order_id}</span>}
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            {t.type === 'plaud'
              ? <a href="#" onClick={e => { e.preventDefault(); openPlaud(t.task_key) }}>{t.title}</a>
              : t.title}
          </span>
          <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontSize: '12px', color: days >= 2 ? '#DC2626' : 'var(--muted, #888)', fontWeight: days >= 2 ? 700 : 400 }}>
            {fmtDate(t.date_str)} · waiting {ageLabel(t.date_str)}
          </span>
        </div>
        {(t.detail || t.due_date) && (
          <div style={{ fontSize: '13px', color: 'var(--muted, #666)', margin: '4px 0 0' }}>
            {t.detail || ''}{t.due_date ? ` · due ${t.due_date}` : ''}
          </div>
        )}

        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
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
                style={{ flex: 1, minWidth: '120px', padding: '4px 8px' }} />
              <button className="btn btn-sm" disabled={busyKey === t.task_key || !(drafts[t.task_key] || '').trim()}
                onClick={() => saveNote(t.task_key, drafts[t.task_key].trim())}>Save</button>
            </>
          )}
          {canMark && (
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
          {isEmail && (
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

        {isEmail && (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' }}>
            <input type="text" value={intents[t.task_key] ?? ''}
              placeholder='tell the robot what to say — e.g. "the quote is approved, ship it UPS"'
              onChange={e => setIntents(x => ({ ...x, [t.task_key]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && (intents[t.task_key] || '').trim()) writePreview(t) }}
              style={{ flex: 1, minWidth: '220px', padding: '5px 8px' }} />
            <button className="btn btn-sm" disabled={composeBusy === t.task_key || !(intents[t.task_key] || '').trim()}
              style={{ background: 'rgba(29,78,216,0.12)', color: '#1D4ED8', fontWeight: 700 }}
              onClick={() => writePreview(t)}>
              {composeBusy === t.task_key ? 'Writing…' : '✍ Write & Preview'}
            </button>
          </div>
        )}

        {fuOpen && t.order_id === fuOpen && canMark && (
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
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 0' }}>
      {/* MONEY STRIP — one line, always on top (William: "keep that one line") */}
      {strip && (
        <div style={{ fontSize: '14px', fontWeight: 600, padding: '8px 14px', marginBottom: '12px',
          border: '1px solid var(--border, #ddd)', borderRadius: '8px', background: 'rgba(5,150,105,0.06)' }}>
          💰 Landed today ${Number(strip.landed_24h || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({strip.landed_count || 0})
          {' · '}Awaiting ${Number(strip.awaiting_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} across {strip.awaiting_count || 0} orders
          {' · '}90-day freight net ${Number(strip.freight_net_90d || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>THE QUEUE — {queue.length} waiting, oldest first</h2>
        <button className="btn btn-sm" onClick={sweepNow} disabled={sweeping}>{sweeping ? 'Sweeping…' : 'Sweep now'}</button>
        <button className="btn btn-sm" onClick={robotSettle} disabled={settling}
          title="the robot closes what it can prove is already handled — and tells you why">
          {settling ? 'Settling…' : '🤖 Robot settle'}</button>
        <span style={{ color: 'var(--muted, #888)', fontSize: '12px' }}>last sweep {fmtDate(data?.last_sweep)}</span>
      </div>

      {banner && (
        <div style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid #059669', color: '#059669', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', fontWeight: 600 }}>
          {banner}
        </div>
      )}

      {queue.length === 0
        ? <div className="empty">Queue is empty. Nothing is waiting on you.</div>
        : queue.map(renderCard)}

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', margin: '20px 0 12px' }}>
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

      {(data?.handled || []).length > 0 && (
        <div style={{ marginTop: '26px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '14px' }}>HANDLED ({data.handled.length})</h3>
          <table className="orders-table">
            <thead><tr><th>Task</th><th>Order</th><th>How it settled</th><th>When</th><th></th></tr></thead>
            <tbody>
              {data.handled.map(t => {
                const robo = (t.note || '').includes('[robot settled:')
                return (
                  <tr key={t.task_key} style={{ opacity: 0.8 }}>
                    <td style={{ maxWidth: '320px' }}>{t.title}</td>
                    <td>{t.order_id ? <span className="order-id">#{t.order_id}</span> : '—'}</td>
                    <td style={{ maxWidth: '320px' }}>
                      {robo && <span style={{ fontSize: '10px', fontWeight: 800, color: '#0E7490', marginRight: '6px' }}>🤖 ROBOT</span>}
                      {t.note}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.note_at)}</td>
                    <td><button className="btn btn-sm" disabled={busyKey === t.task_key}
                      onClick={() => saveNote(t.task_key, '')}>Reopen</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <button className="btn btn-sm" onClick={loadArchive}>
          {showArchive ? 'Hide archive' : 'View archive'}
        </button>
        {showArchive && (
          <div style={{ marginTop: '8px' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '14px' }}>
              ARCHIVE — completed tasks, kept 3 months ({(archive || []).length})
            </h3>
            {archive === null ? <div className="empty">Loading…</div> : (
              <table className="orders-table">
                <thead><tr><th>Task</th><th>Order</th><th>Outcome</th><th>When</th></tr></thead>
                <tbody>
                  {archive.map(t => (
                    <tr key={t.task_key} style={{ opacity: 0.7 }}>
                      <td style={{ maxWidth: '340px' }}>{t.title}</td>
                      <td>{t.order_id ? <span className="order-id">#{t.order_id}</span> : '—'}</td>
                      <td style={{ maxWidth: '300px' }}>{t.note || (t.status === 'gone' ? '(source resolved itself)' : '')}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

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

      {/* THE PREVIEW POPUP — chain + editable draft + SEND */}
      {preview && (
        <div onClick={() => !sendBusy && setPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--card, #fff)', borderRadius: '10px', padding: '20px', maxWidth: '760px', width: '92%', maxHeight: '86vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 4px' }}>✍ Preview before it fires</h3>
            <div style={{ fontSize: '13px', color: 'var(--muted, #666)', marginBottom: '10px' }}>
              To <strong>{preview.to}</strong> · {preview.subject}
              {preview.order_id && <> · order <span className="order-id">#{preview.order_id}</span></>}
              {preview.supplier && <> · {preview.supplier}</>}
            </div>

            <button className="btn btn-sm" onClick={() => setChainOpen(o => !o)} style={{ marginBottom: '8px' }}>
              {chainOpen ? 'Hide the chain' : `Show the chain (${(preview.chain || []).length} emails)`}
            </button>
            {chainOpen && (
              <div style={{ border: '1px solid var(--border, #ddd)', borderRadius: '6px', padding: '10px', marginBottom: '10px', maxHeight: '220px', overflow: 'auto' }}>
                {(preview.chain || []).map((c, i) => (
                  <div key={i} style={{ marginBottom: '8px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 700 }}>{c.from} <span style={{ color: 'var(--muted, #888)', fontWeight: 400 }}>· {c.date}</span></div>
                    <div style={{ color: 'var(--muted, #666)', whiteSpace: 'pre-wrap' }}>{c.snippet}</div>
                  </div>
                ))}
              </div>
            )}

            <textarea value={preview.draft_body}
              onChange={e => setPreview(p => ({ ...p, draft_body: e.target.value }))}
              rows={14} style={{ width: '100%', padding: '10px', fontSize: '14px', fontFamily: 'inherit', lineHeight: 1.5 }} />

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
              <button className="btn btn-sm" disabled={sendBusy || !(preview.draft_body || '').trim()}
                style={{ background: '#059669', color: '#fff', fontWeight: 800, padding: '8px 18px', fontSize: '14px' }}
                onClick={sendPreview}>{sendBusy ? 'Sending…' : '🔥 SEND'}</button>
              <button className="btn btn-sm" disabled={sendBusy} onClick={() => setPreview(null)}>Cancel</button>
              <span style={{ fontSize: '12px', color: 'var(--muted, #888)' }}>
                edits here go out exactly as written · it replies inside the real thread
              </span>
            </div>
          </div>
        </div>
      )}

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
