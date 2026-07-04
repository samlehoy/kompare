"use client";

import { useState, useEffect } from 'react';
import { RetroButton, RetroInput } from '@/components/ui/FormControls.jsx';
import StatusPanel from '@/components/ui/StatusPanel.jsx';

const KEY_GEMINI = 'kompare_user_gemini_key';
const KEY_LMSTUDIO = 'kompare_user_lmstudio_url';
const KEY_QDRANT_URL = 'kompare_user_qdrant_url';
const KEY_QDRANT_KEY = 'kompare_user_qdrant_key';

export default function ApiKeySettings() {
  const [geminiKey, setGeminiKey] = useState('');
  const [lmstudioUrl, setLmstudioUrl] = useState('');

  const [savedExists, setSavedExists] = useState({
    gemini: false,
    lmstudio: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const g = localStorage.getItem(KEY_GEMINI) || '';
      const l = localStorage.getItem(KEY_LMSTUDIO) || '';

      setGeminiKey(g);
      setLmstudioUrl(l);

      setSavedExists({
        gemini: !!g,
        lmstudio: !!l,
      });
    }
  }, []);

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      const g = geminiKey.trim();
      const l = lmstudioUrl.trim();

      if (g) localStorage.setItem(KEY_GEMINI, g);
      else localStorage.removeItem(KEY_GEMINI);

      if (l) localStorage.setItem(KEY_LMSTUDIO, l);
      else localStorage.removeItem(KEY_LMSTUDIO);

      setSavedExists({
        gemini: !!g,
        lmstudio: !!l,
      });
    }
  };

  const handleClear = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(KEY_GEMINI);
      localStorage.removeItem(KEY_LMSTUDIO);
      localStorage.removeItem(KEY_QDRANT_URL);
      localStorage.removeItem(KEY_QDRANT_KEY);

      setGeminiKey('');
      setLmstudioUrl('');

      setSavedExists({
        gemini: false,
        lmstudio: false,
      });
    }
  };

  const hasAnySaved = savedExists.gemini || savedExists.lmstudio;

  return (
    <div className="api-key-settings-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '550px', overflowY: 'auto' }}>
      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.4' }}>
        Configure custom endpoints and API keys strictly saved in your browser local storage.
        If provided, they are sent ephemerally in HTTPS request headers to override server settings.
      </p>

      <fieldset style={{ border: '2px solid #dfdfdf', padding: '12px', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <legend style={{ padding: '0 4px', fontSize: '12px', fontWeight: 'bold' }}>Gemini Cloud Settings</legend>
        <RetroInput
          label="Gemini API Key"
          type="password"
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
          placeholder={savedExists.gemini ? '••••••••••••••••••••••••' : 'Enter your Gemini API key'}
          aria-label="Gemini API Key Input"
        />
      </fieldset>

      <fieldset style={{ border: '2px solid #dfdfdf', padding: '12px', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <legend style={{ padding: '0 4px', fontSize: '12px', fontWeight: 'bold' }}>Local AI Tunnelling (LM Studio)</legend>
        <p style={{ margin: 0, fontSize: '11px', color: '#555' }}>
          Expose your local port via <code>ngrok http 1234</code>, then paste the tunnel URL below.
        </p>
        <RetroInput
          label="LM Studio URL"
          type="text"
          value={lmstudioUrl}
          onChange={(e) => setLmstudioUrl(e.target.value)}
          placeholder={savedExists.lmstudio ? 'using saved LM Studio URL' : 'e.g. https://xxxx.ngrok-free.app/v1'}
          aria-label="LM Studio URL Input"
        />
      </fieldset>

      <div style={{ display: 'flex', gap: '8px' }}>
        <RetroButton onClick={handleSave}>
          Save Settings
        </RetroButton>
        {hasAnySaved && (
          <RetroButton onClick={handleClear}>
            Clear All
          </RetroButton>
        )}
      </div>

      <StatusPanel
        tone={hasAnySaved ? 'success' : 'idle'}
        title={hasAnySaved ? 'Custom Config Active' : 'Default Server Config Active'}
        message={
          hasAnySaved
            ? 'Your custom endpoints/keys are active and will override server configurations for the corresponding providers.'
            : 'Using the shared server configurations for all Gemini, LM Studio, and Qdrant requests.'
        }
      />
    </div>
  );
}
