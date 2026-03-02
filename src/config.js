/**
 * config.js - Application Configuration
 * Single source of truth for API URL and app settings
 * v5.11.0 - Added environment toggle + Brain integration
 */

// API Configuration
// Change this to switch environments
export const API_URL = 'https://cfcorderbackend-sandbox.onrender.com'
// Production: 'https://cfc-backend-b83s.onrender.com'
// Sandbox:    'https://cfcorderbackend-sandbox.onrender.com'

// App password
export const APP_PASSWORD = 'cfc2025'

// Environment indicator
// true = sandbox, false = production
export const IS_SANDBOX = true

// Link to the other environment (shown as a button in header)
// When IS_SANDBOX=true, this points to production frontend
// When IS_SANDBOX=false, this points to sandbox frontend
export const OTHER_ENV_URL = IS_SANDBOX
  ? 'https://cfcordersfrontend.vercel.app'
  : 'https://cfcordersfrontend-sandbox.vercel.app'

export const OTHER_ENV_LABEL = IS_SANDBOX ? 'Live' : 'Sandbox'
