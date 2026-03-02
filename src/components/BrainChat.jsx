/**
 * BrainChat.jsx - Brain AI Chat Panel for CFC Orders
 * v1.0.0 - Collapsible chat that sends requests to the Brain backend
 *
 * Floating purple button in bottom-right opens a chat panel.
 * Sends to Brain /ask endpoint with "orders" domain.
 * Token is entered once and stored in component state.
 */

import { useState, useRef, useEffect } from 'react'

const BRAIN_URL = 'https://brain-backend-6uhk.onrender.com'

export default function BrainChat() {
  const [isOpen, setIsOpen] = useState(false)
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

  // --- Floating button (closed state) ---
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: '20px', right: '20px',
          width: '56px', height: '56px', borderRadius: '50%',
          backgroundColor: '#7c3aed', color: 'white', border: 'none',
          cursor: 'pointer', fontSize: '24px',
          boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
          zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}
        title="Open Brain Chat"
      >{'\u{1F9E0}'}</button>
    )
  }

  // --- Chat panel (open state) ---
  return (
    <div style={{
      position: 'fixed', bottom: '20px', right: '20px',
      width: '380px', maxWidth: 'calc(100vw - 40px)',
      height: '500px', maxHeight: 'calc(100vh - 100px)',
      backgroundColor: '#1a1a2e', borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      display: 'flex', flexDirection: 'column',
      zIndex: 9999, overflow: 'hidden',
      border: '1px solid rgba(124,58,237,0.25)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', backgroundColor: '#7c3aed', color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{'\u{1F9E0}'}</span>
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Brain Chat</span>
          <span style={{ fontSize: '11px', opacity: 0.8 }}>Orders</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setMessages([])}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
              borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px' }}
          >Clear</button>
          <button onClick={() => setIsOpen(false)}
            style={{ background: 'none', border: 'none', color: 'white',
              cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: '1' }}
          >{'\u00D7'}</button>
        </div>
      </div>

      {/* Token setup (only shown if no token set yet) */}
      {!token && (
        <div style={{ padding: '16px', backgroundColor: '#16213e', borderBottom: '1px solid #333' }}>
          <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>
            Enter your Brain admin token to connect:
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="password" value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="Admin token..."
              style={{ flex: 1, padding: '8px', backgroundColor: '#0f3460',
                border: '1px solid #444', borderRadius: '6px', color: 'white', fontSize: '13px' }}
              onKeyDown={e => e.key === 'Enter' && saveToken()}
            />
            <button onClick={saveToken}
              style={{ padding: '8px 12px', backgroundColor: '#7c3aed', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
            >Save</button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px',
        display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ color: '#666', textAlign: 'center', marginTop: '40px',
            fontSize: '13px', lineHeight: '1.8' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>{'\u{1F9E0}'}</div>
            Ask the Brain anything about orders.<br/>
            <span style={{ color: '#7c3aed' }}>"Check status on order 5353"</span><br/>
            <span style={{ color: '#7c3aed' }}>"What orders need payment links?"</span><br/>
            <span style={{ color: '#7c3aed' }}>"Check pricing for Shaker Ivory B15"</span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%'
          }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              backgroundColor: msg.role === 'user' ? '#7c3aed' :
                               msg.role === 'error' ? '#dc3545' : '#16213e',
              color: 'white', fontSize: '13px', lineHeight: '1.5',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word'
            }}>{msg.content}</div>
            {msg.model && (
              <div style={{ fontSize: '10px', color: '#666', marginTop: '4px', paddingLeft: '4px' }}>
                {msg.model} - {msg.confidence}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ alignSelf: 'flex-start', padding: '10px 14px',
            borderRadius: '12px 12px 12px 4px', backgroundColor: '#16213e',
            color: '#7c3aed', fontSize: '13px' }}>
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: '12px', borderTop: '1px solid #333', backgroundColor: '#16213e' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input ref={inputRef} type="text" value={input}
            onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={token ? "Ask the Brain..." : "Set token first..."}
            disabled={!token || loading}
            style={{ flex: 1, padding: '10px 14px', backgroundColor: '#0f3460',
              border: '1px solid #444', borderRadius: '8px', color: 'white',
              fontSize: '13px', outline: 'none' }}
          />
          <button onClick={sendMessage}
            disabled={!token || loading || !input.trim()}
            style={{
              padding: '10px 16px',
              backgroundColor: (!token || loading || !input.trim()) ? '#444' : '#7c3aed',
              color: 'white', border: 'none', borderRadius: '8px',
              cursor: (!token || loading || !input.trim()) ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 'bold'
            }}
          >{'\u25B6'}</button>
        </div>
      </div>
    </div>
  )
}
