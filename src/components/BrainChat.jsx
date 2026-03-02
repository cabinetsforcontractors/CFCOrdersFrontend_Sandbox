/**
 * BrainChat.jsx - Brain AI Chat Panel for CFC Orders
 * v2.0.0 - Header-triggered panel (no floating button)
 *
 * Props:
 *   isOpen: boolean - controlled by parent (App.jsx header button)
 *   onClose: function - called to close panel
 *
 * Sends to Brain /ask endpoint with "orders" domain.
 * Token entered once and stored in component state.
 */

import { useState, useRef, useEffect } from 'react'

const BRAIN_URL = 'https://brain-backend-6uhk.onrender.com'

export default function BrainChat({ isOpen, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [token, setToken] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus()
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const saveToken = () => setToken(tokenInput)

  const sendMessage = async () => {
    if (!input.trim() || loading || !token) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))

      const res = await fetch(BRAIN_URL + '/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          domain: 'orders',
          task_type: 'auto',
          message: userMsg,
          conversation_history: history,
          attachments: []
        })
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(res.status + ': ' + errText)
      }

      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        model: data.model_used,
        confidence: data.confidence
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'error',
        content: 'Error: ' + err.message
      }])
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', top: '56px', right: '0',
      width: '400px', maxWidth: 'calc(100vw - 20px)',
      bottom: '0',
      backgroundColor: 'var(--bg-raised)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      zIndex: 200, overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{'\u{1F9E0}'}</span>
          <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text)' }}>Brain Chat</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Orders</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setMessages([])}
            style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              color: 'var(--text-dim)', borderRadius: '5px', padding: '3px 10px',
              cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit'
            }}
          >Clear</button>
          <button onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-dim)',
              cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: '1'
            }}
          >{'\u00D7'}</button>
        </div>
      </div>

      {/* Token setup */}
      {!token && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '12px', marginBottom: '8px' }}>
            Enter your Brain admin token to connect:
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="password" value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="Admin token..."
              style={{
                flex: 1, padding: '8px 10px', backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border)', borderRadius: '6px',
                color: 'var(--text)', fontSize: '13px', fontFamily: 'inherit', outline: 'none'
              }}
              onKeyDown={e => e.key === 'Enter' && saveToken()}
            />
            <button onClick={saveToken}
              style={{
                padding: '8px 14px', backgroundColor: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                fontFamily: 'inherit', fontWeight: '500'
              }}
            >Save</button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '14px',
        display: 'flex', flexDirection: 'column', gap: '10px'
      }}>
        {messages.length === 0 && (
          <div style={{
            color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px',
            fontSize: '13px', lineHeight: '1.8'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>{'\u{1F9E0}'}</div>
            Ask the Brain anything about orders.<br />
            <span style={{ color: 'var(--accent)' }}>"Check status on order 5353"</span><br />
            <span style={{ color: 'var(--accent)' }}>"What orders need payment links?"</span><br />
            <span style={{ color: 'var(--accent)' }}>"Check pricing for Shaker Ivory B15"</span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%'
          }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              backgroundColor: msg.role === 'user' ? 'var(--accent)' :
                               msg.role === 'error' ? 'var(--danger)' : 'var(--bg-card)',
              color: msg.role === 'user' || msg.role === 'error' ? '#fff' : 'var(--text)',
              fontSize: '13px', lineHeight: '1.5',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none'
            }}>{msg.content}</div>
            {msg.model && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '4px' }}>
                {msg.model} &middot; {msg.confidence}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{
            alignSelf: 'flex-start', padding: '10px 14px',
            borderRadius: '12px 12px 12px 4px', backgroundColor: 'var(--bg-card)',
            color: 'var(--accent)', fontSize: '13px',
            border: '1px solid var(--border)'
          }}>
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 14px', borderTop: '1px solid var(--border)',
        background: 'var(--bg-card)'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input ref={inputRef} type="text" value={input}
            onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={token ? "Ask the Brain..." : "Set token first..."}
            disabled={!token || loading}
            style={{
              flex: 1, padding: '10px 14px', backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border)', borderRadius: '8px',
              color: 'var(--text)', fontSize: '13px', fontFamily: 'inherit', outline: 'none'
            }}
          />
          <button onClick={sendMessage}
            disabled={!token || loading || !input.trim()}
            style={{
              padding: '10px 16px',
              backgroundColor: (!token || loading || !input.trim()) ? 'var(--bg-hover)' : 'var(--accent)',
              color: (!token || loading || !input.trim()) ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: '8px',
              cursor: (!token || loading || !input.trim()) ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 'bold'
            }}
          >{'\u25B6'}</button>
        </div>
      </div>
    </div>
  )
}
