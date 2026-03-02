/**
 * AiConfigPanel.jsx
 * Floating AI configuration panel for sandbox.
 * Connie types natural language commands, Claude returns config changes.
 * 
 * Session 7 — Mar 2, 2026
 */

import { useState, useRef, useEffect } from 'react'

// Default status colors (must match StatusBar / index.css)
const DEFAULT_COLORS = {
  'needs_payment_link': '#e91e63',
  'awaiting_payment': '#ff9800',
  'needs_warehouse_order': '#2196f3',
  'awaiting_warehouse': '#9c27b0',
  'needs_bol': '#f44336',
  'awaiting_shipment': '#00bcd4',
  'complete': '#4caf50',
}

export default function AiConfigPanel({ apiUrl, onConfigChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const historyRef = useRef(null)

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Scroll history to bottom on new entries
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [history])

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return

    const userPrompt = prompt.trim()
    setPrompt('')
    setError('')
    setLoading(true)

    // Add user message to history
    setHistory(prev => [...prev, { role: 'user', text: userPrompt }])

    try {
      const res = await fetch(`${apiUrl}/ai/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Server error' }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }

      const data = await res.json()

      if (data.understood) {
        // Add AI response to history
        setHistory(prev => [...prev, {
          role: 'ai',
          text: `✅ ${data.description}`,
          changes: data.changes,
        }])
        // Apply changes
        if (onConfigChange) {
          onConfigChange(data.changes)
        }
      } else {
        setHistory(prev => [...prev, {
          role: 'ai',
          text: `❌ ${data.description}`,
        }])
      }
    } catch (err) {
      setError(err.message)
      setHistory(prev => [...prev, {
        role: 'ai',
        text: `⚠️ Error: ${err.message}`,
      }])
    }

    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const handleReset = () => {
    if (onConfigChange) {
      onConfigChange({
        statusColors: DEFAULT_COLORS,
        theme: 'light',
        headerColor: null,
        fontSize: null,
        accentColor: null,
        customCSS: null,
      })
    }
    setHistory(prev => [...prev, { role: 'ai', text: '🔄 Reset to default config' }])
  }

  // Floating toggle button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="AI Config"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: '24px',
          boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
      >
        🤖
      </button>
    )
  }

  // Expanded panel
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '380px',
      maxHeight: '500px',
      borderRadius: '16px',
      background: '#1a1a2e',
      color: '#e0e0e0',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🤖</span>
          <span style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>AI Config</span>
          <span style={{
            fontSize: '10px',
            background: 'rgba(255,255,255,0.2)',
            padding: '2px 8px',
            borderRadius: '10px',
            color: '#fff',
          }}>SANDBOX</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleReset}
            title="Reset to defaults"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >Reset</button>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >×</button>
        </div>
      </div>

      {/* History */}
      <div
        ref={historyRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          maxHeight: '320px',
          minHeight: '120px',
        }}
      >
        {history.length === 0 && (
          <div style={{ color: '#888', fontSize: '13px', lineHeight: 1.6, textAlign: 'center', padding: '20px 0' }}>
            <p style={{ margin: '0 0 8px' }}>Type what you want to change:</p>
            <p style={{ margin: '4px 0', color: '#667eea', fontStyle: 'italic' }}>"make awaiting payment pink"</p>
            <p style={{ margin: '4px 0', color: '#667eea', fontStyle: 'italic' }}>"switch to dark mode"</p>
            <p style={{ margin: '4px 0', color: '#667eea', fontStyle: 'italic' }}>"make the font bigger"</p>
            <p style={{ margin: '4px 0', color: '#667eea', fontStyle: 'italic' }}>"rename Need BOL to Get BOL"</p>
          </div>
        )}
        {history.map((entry, i) => (
          <div key={i} style={{
            marginBottom: '8px',
            padding: '8px 12px',
            borderRadius: '10px',
            background: entry.role === 'user' ? '#2a2a4a' : '#16213e',
            fontSize: '13px',
            lineHeight: 1.5,
            borderLeft: entry.role === 'ai' ? '3px solid #667eea' : 'none',
          }}>
            {entry.text}
          </div>
        ))}
        {loading && (
          <div style={{
            padding: '8px 12px',
            color: '#667eea',
            fontSize: '13px',
            fontStyle: 'italic',
          }}>
            Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #2a2a4a',
        display: 'flex',
        gap: '8px',
      }}>
        <input
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell me what to change..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid #2a2a4a',
            background: '#0f3460',
            color: '#e0e0e0',
            fontSize: '13px',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !prompt.trim()}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: 'none',
            background: loading ? '#444' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {loading ? '...' : 'Go'}
        </button>
      </div>
    </div>
  )
}
