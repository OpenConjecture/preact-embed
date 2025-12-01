/**
 * Example: Counter Widget
 * Demonstrates various habitat features
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import habitat, { eventBus, useHabitatEvent } from '../src/index';

// ============================================================================
// Widget Component
// ============================================================================

interface CounterWidgetProps {
  title?: string;
  initialCount?: number;
  step?: number;
  theme?: 'light' | 'dark';
  broadcastChannel?: string;
}

export function CounterWidget({
  title = 'Counter',
  initialCount = 0,
  step = 1,
  theme = 'light',
  broadcastChannel,
}: CounterWidgetProps) {
  const [count, setCount] = useState(initialCount);

  // Listen for external count updates if channel is specified
  const [externalCount] = useHabitatEvent<number>(
    broadcastChannel ? `counter:${broadcastChannel}` : '__none__'
  );

  useEffect(() => {
    if (externalCount !== undefined) {
      setCount(externalCount);
    }
  }, [externalCount]);

  const increment = () => {
    const newCount = count + step;
    setCount(newCount);
    if (broadcastChannel) {
      eventBus.emit(`counter:${broadcastChannel}`, newCount);
    }
  };

  const decrement = () => {
    const newCount = count - step;
    setCount(newCount);
    if (broadcastChannel) {
      eventBus.emit(`counter:${broadcastChannel}`, newCount);
    }
  };

  const styles = {
    container: {
      fontFamily: 'system-ui, sans-serif',
      padding: '20px',
      borderRadius: '8px',
      backgroundColor: theme === 'dark' ? '#1a1a2e' : '#ffffff',
      color: theme === 'dark' ? '#eee' : '#333',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      textAlign: 'center' as const,
    },
    title: {
      margin: '0 0 16px 0',
      fontSize: '1.25rem',
    },
    count: {
      fontSize: '3rem',
      fontWeight: 'bold',
      margin: '16px 0',
    },
    buttonGroup: {
      display: 'flex',
      gap: '8px',
      justifyContent: 'center',
    },
    button: {
      padding: '8px 24px',
      fontSize: '1.25rem',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      backgroundColor: theme === 'dark' ? '#4a4a6a' : '#007bff',
      color: '#fff',
      transition: 'transform 0.1s, opacity 0.2s',
    },
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>{title}</h3>
      <div style={styles.count}>{count}</div>
      <div style={styles.buttonGroup}>
        <button
          style={styles.button}
          onClick={decrement}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          −
        </button>
        <button
          style={styles.button}
          onClick={increment}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Habitat Setup
// ============================================================================

const { render, renderOne, unmountAll, instances } = habitat(CounterWidget);

// Auto-render when DOM is ready
if (typeof document !== 'undefined') {
  const init = () => {
    // Standard mount
    render({
      selector: '[data-widget="counter"]',
      defaultProps: {
        theme: 'light',
      },
      onMounted: (element, props) => {
        console.log('[CounterWidget] Mounted:', element, props);
      },
    });

    // Shadow DOM mount
    render({
      selector: '[data-widget="counter-isolated"]',
      shadowRoot: true,
      defaultProps: {
        theme: 'dark',
      },
    });

    // Lazy load mount
    render({
      selector: '[data-widget="counter-lazy"]',
      lazy: {
        threshold: 0.5,
      },
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

// Export for manual control
export { render, renderOne, unmountAll, instances };
export default CounterWidget;
