import { useEffect, useState } from 'react';
import { getHealth } from '../../services/healthService.js';

export default function ApiStatus() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const controller = new AbortController();

    async function checkApi() {
      try {
        await getHealth({ signal: controller.signal });
        setStatus('connected');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setStatus('unavailable');
        }
      }
    }

    checkApi();

    return () => controller.abort();
  }, []);

  const messages = {
    checking: 'Checking API connection…',
    connected: 'API connected',
    unavailable: 'API unavailable',
  };

  return (
    <p
      className="api-status"
      data-state={status}
      role="status"
      aria-live="polite"
    >
      {messages[status]}
    </p>
  );
}
