"use client";

import { useState, useEffect } from 'react';
import { RetroButton, RetroInput } from '@/components/ui/FormControls.jsx';
import StatusPanel from '@/components/ui/StatusPanel.jsx';

const LOCAL_STORAGE_KEY = 'kompare_user_gemini_key';

export default function ApiKeySettings() {
  const [apiKey, setApiKey] = useState('');
  const [savedKeyExists, setSavedKeyExists] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedKey) {
        setApiKey(savedKey);
        setSavedKeyExists(true);
      }
    }
  }, []);

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      const trimmed = apiKey.trim();
      if (trimmed) {
        localStorage.setItem(LOCAL_STORAGE_KEY, trimmed);
        setApiKey(trimmed);
        setSavedKeyExists(true);
      }
    }
  };

  const handleClear = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setApiKey('');
      setSavedKeyExists(false);
    }
  };

  return (
    <div className="api-key-settings-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.4' }}>
        If the server's shared Gemini API quota is exhausted, you can supply your own personal Gemini API key.
        Your key is stored strictly in your browser's local storage and is sent ephemerally in HTTPS request headers.
        It is never stored or logged on the server.
      </p>

      <RetroInput
        label="Gemini API Key"
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder={savedKeyExists ? '••••••••••••••••••••••••' : 'Enter your Gemini API key'}
        aria-label="Gemini API Key Input"
      />

      <div style={{ display: 'flex', gap: '8px' }}>
        <RetroButton onClick={handleSave} disabled={!apiKey.trim()}>
          Save Key
        </RetroButton>
        {savedKeyExists && (
          <RetroButton onClick={handleClear}>
            Clear Key
          </RetroButton>
        )}
      </div>

      <StatusPanel
        tone={savedKeyExists ? 'success' : 'idle'}
        title={savedKeyExists ? 'Using Personal API Key' : 'Using Server API Key'}
        message={
          savedKeyExists
            ? 'Your custom API key is active and will override the server key for all AI recommendations, audits, and advisor queries.'
            : 'Using the shared server API key for all AI-assisted recommendation and advisor flows.'
        }
      />
    </div>
  );
}
