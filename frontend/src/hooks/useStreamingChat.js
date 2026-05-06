import { useCallback, useRef, useState } from 'react';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../lib/tokenStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Streams AI responses via SSE using fetch (not EventSource) so we can
 * send Authorization headers.
 *
 * Returns:
 *   streamedContent  — accumulated text tokens so far
 *   streamMetadata   — metadata object once stream completes
 *   isStreaming      — true while tokens are arriving
 *   error            — string if something went wrong
 *   sendMessage(question, conversationId, language) — starts the stream
 *   reset()          — clears state
 */
export default function useStreamingChat() {
  const [streamedContent, setStreamedContent] = useState('');
  const [streamMetadata,  setStreamMetadata]  = useState(null);
  const [isStreaming,     setIsStreaming]      = useState(false);
  const [error,           setError]           = useState('');
  const abortRef = useRef(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStreamedContent('');
    setStreamMetadata(null);
    setIsStreaming(false);
    setError('');
  }, []);

  const getFreshAccessToken = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return '';

    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return '';

    const payload = await response.json();
    const nextAccess = payload?.data?.token || '';
    const nextRefresh = payload?.data?.refreshToken || '';

    if (nextAccess) setAccessToken(nextAccess);
    if (nextRefresh) setRefreshToken(nextRefresh);

    return nextAccess;
  }, []);

  const openStream = useCallback((url, token, signal) => fetch(url, {
    signal,
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'text/event-stream',
    },
  }), []);

  const sendMessage = useCallback(async (question, conversationId = '', language = 'en') => {
    reset();
    abortRef.current = new AbortController();
    setIsStreaming(true);

    let token = getAccessToken() || await getFreshAccessToken();
    const params = new URLSearchParams({ question, language });
    if (conversationId) params.set('conversation_id', conversationId);
    const streamUrl = `${BASE_URL}/chat/stream?${params.toString()}`;

    try {
      let response = await openStream(streamUrl, token, abortRef.current.signal);

      if (response.status === 401) {
        const body = await response.clone().json().catch(() => ({}));
        if (body.error === 'TOKEN_EXPIRED') {
          token = await getFreshAccessToken();
          response = await openStream(streamUrl, token, abortRef.current.signal);
        }
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let finalMeta = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            try {
              const payload = JSON.parse(raw);
              if (currentEvent === 'token') {
                setStreamedContent((prev) => prev + (payload.text || ''));
              } else if (currentEvent === 'metadata') {
                finalMeta = payload;
                setStreamMetadata(payload);
              } else if (currentEvent === 'error') {
                setError(payload.message || 'Stream error');
              }
            } catch {
              // non-JSON line — ignore
            }
            currentEvent = '';
          }
        }
      }

      if (finalMeta) setStreamMetadata(finalMeta);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to stream response');
      }
    } finally {
      setIsStreaming(false);
    }
  }, [getFreshAccessToken, openStream, reset]);

  return { streamedContent, streamMetadata, isStreaming, error, sendMessage, reset };
}
