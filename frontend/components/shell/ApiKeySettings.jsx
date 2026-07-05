"use client";

import { useState, useEffect } from 'react';
import { RetroButton, RetroInput } from '@/components/ui/FormControls.jsx';
import StatusPanel from '@/components/ui/StatusPanel.jsx';
import { request } from '@/lib/api.js';

const KEY_GEMINI = 'kompare_user_gemini_key';
const KEY_LMSTUDIO = 'kompare_user_lmstudio_url';
const KEY_QDRANT_URL = 'kompare_user_qdrant_url';
const KEY_QDRANT_KEY = 'kompare_user_qdrant_key';

export default function ApiKeySettings() {
  const [geminiKey, setGeminiKey] = useState('');
  const [lmstudioUrl, setLmstudioUrl] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectedModel, setDetectedModel] = useState(null);
  const [detectError, setDetectError] = useState(null);

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
      setDetectedModel(null);
      setDetectError(null);

      setSavedExists({
        gemini: false,
        lmstudio: false,
      });
    }
  };

  const handleDetect = async () => {
    const url = lmstudioUrl.trim() || (typeof window !== 'undefined' && localStorage.getItem(KEY_LMSTUDIO)) || '';
    if (!url) {
      setDetectError('Enter an LM Studio URL first.');
      setDetectedModel(null);
      return;
    }

    setDetecting(true);
    setDetectError(null);
    setDetectedModel(null);

    try {
      const data = await request('/api/lm-studio/detect', {
        method: 'GET',
        headers: { 'X-LMStudio-Base-Url': url },
      });

      if (data.connected && data.active_model) {
        setDetectedModel({
          name: data.active_model,
          count: data.model_count,
          models: data.models,
        });
      } else if (data.connected && data.model_count === 0) {
        setDetectError('LM Studio is running but no model is loaded. Please load a model first.');
      } else {
        setDetectError(data.error || 'Could not connect to LM Studio.');
      }
    } catch (e) {
      setDetectError(e.message || 'Failed to detect model.');
    } finally {
      setDetecting(false);
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
          For local dev, use <code>http://127.0.0.1:1234</code> directly.
        </p>
        <RetroInput
          label="LM Studio URL"
          type="text"
          value={lmstudioUrl}
          onChange={(e) => { setLmstudioUrl(e.target.value); setDetectedModel(null); setDetectError(null); }}
          placeholder={savedExists.lmstudio ? 'using saved LM Studio URL' : 'e.g. http://127.0.0.1:1234'}
          aria-label="LM Studio URL Input"
        />
        <RetroButton onClick={handleDetect} disabled={detecting}>
          {detecting ? 'Detecting...' : 'Detect Model'}
        </RetroButton>

        {detectedModel && (
          <div style={{
            padding: '8px 10px',
            background: '#e8f5e9',
            border: '2px inset #c8e6c9',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}>
            <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>
              ✓ Connected — {detectedModel.count} model{detectedModel.count > 1 ? 's' : ''} loaded
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#1b5e20' }}>
              Active: {detectedModel.name}
            </div>
            {detectedModel.count > 1 && (
              <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>
                All loaded: {detectedModel.models.map(m => m.id).join(', ')}
              </div>
            )}
          </div>
        )}

        {detectError && (
          <div style={{
            padding: '8px 10px',
            background: '#fbe9e7',
            border: '2px inset #ffccbc',
            fontSize: '12px',
            color: '#bf360c',
          }}>
            ✗ {detectError}
          </div>
        )}
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
