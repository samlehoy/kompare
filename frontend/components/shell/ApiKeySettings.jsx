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
  const [qdrantUrl, setQdrantUrl] = useState('');
  const [qdrantKey, setQdrantKey] = useState('');

  const [savedExists, setSavedExists] = useState({
    gemini: false,
    lmstudio: false,
    qdrantUrl: false,
    qdrantKey: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const g = localStorage.getItem(KEY_GEMINI) || '';
      const l = localStorage.getItem(KEY_LMSTUDIO) || '';
      const qu = localStorage.getItem(KEY_QDRANT_URL) || '';
      const qk = localStorage.getItem(KEY_QDRANT_KEY) || '';

      setGeminiKey(g);
      setLmstudioUrl(l);
      setQdrantUrl(qu);
      setQdrantKey(qk);

      setSavedExists({
        gemini: !!g,
        lmstudio: !!l,
        qdrantUrl: !!qu,
        qdrantKey: !!qk,
      });
    }
  }, []);

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      const g = geminiKey.trim();
      const l = lmstudioUrl.trim();
      const qu = qdrantUrl.trim();
      const qk = qdrantKey.trim();

      if (g) localStorage.setItem(KEY_GEMINI, g);
      else localStorage.removeItem(KEY_GEMINI);

      if (l) localStorage.setItem(KEY_LMSTUDIO, l);
      else localStorage.removeItem(KEY_LMSTUDIO);

      if (qu) localStorage.setItem(KEY_QDRANT_URL, qu);
      else localStorage.removeItem(KEY_QDRANT_URL);

      if (qk) localStorage.setItem(KEY_QDRANT_KEY, qk);
      else localStorage.removeItem(KEY_QDRANT_KEY);

      setSavedExists({
        gemini: !!g,
        lmstudio: !!l,
        qdrantUrl: !!qu,
        qdrantKey: !!qk,
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
      setQdrantUrl('');
      setQdrantKey('');

      setSavedExists({
        gemini: false,
        lmstudio: false,
        qdrantUrl: false,
        qdrantKey: false,
      });
    }
  };

  const hasAnySaved = savedExists.gemini || savedExists.lmstudio || savedExists.qdrantUrl || savedExists.qdrantKey;

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
        <legend style={{ padding: '0 4px', fontSize: '12px', fontWeight: 'bold' }}>Local AI Tunnelling (LM Studio & Qdrant)</legend>
        <p style={{ margin: 0, fontSize: '11px', color: '#555' }}>
          Expose your local ports via <code>ngrok http 1234</code> and <code>ngrok http 6333</code>, then paste the tunnel URLs below.
        </p>
        <RetroInput
          label="LM Studio URL"
          type="text"
          value={lmstudioUrl}
          onChange={(e) => setLmstudioUrl(e.target.value)}
          placeholder={savedExists.lmstudio ? 'using saved LM Studio URL' : 'e.g. https://xxxx.ngrok-free.app/v1'}
          aria-label="LM Studio URL Input"
        />
        <RetroInput
          label="Qdrant URL"
          type="text"
          value={qdrantUrl}
          onChange={(e) => setQdrantUrl(e.target.value)}
          placeholder={savedExists.qdrantUrl ? 'using saved Qdrant URL' : 'e.g. https://yyyy.ngrok-free.app'}
          aria-label="Qdrant URL Input"
        />
        <RetroInput
          label="Qdrant API Key"
          type="password"
          value={qdrantKey}
          onChange={(e) => setQdrantKey(e.target.value)}
          placeholder={savedExists.qdrantKey ? '••••••••••••••••' : 'Optional (if local token auth enabled)'}
          aria-label="Qdrant API Key Input"
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
