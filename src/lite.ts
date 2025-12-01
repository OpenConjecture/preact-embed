/**
 * Preact Habitat Modern - Lite Version
 *
 * Ultra-lightweight (~500B) habitat for simple use cases.
 * Use the full version for Shadow DOM, Custom Elements, Signals, etc.
 */

import { h, render, ComponentType } from 'preact';

type Props = Record<string, unknown>;

/**
 * Convert kebab-case to camelCase
 */
const cc = (s: string) => s.replace(/-([a-z])/gi, (_, l) => l.toUpperCase());

/**
 * Parse a value from string to appropriate type
 */
const pv = (v: string): unknown => {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  const n = Number(v);
  if (!isNaN(n) && v !== '') return n;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

/**
 * Get props from element
 */
const gp = (el: Element, d: Props = {}): Props => {
  const p: Props = { ...d };

  // From data-prop-* attributes
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    if (a.name.startsWith('data-prop-')) {
      p[cc(a.name.slice(10))] = pv(a.value);
    }
  }

  // From JSON script
  const s = el.querySelector('script[type="application/json"],script[type="text/props"]');
  if (s) {
    try {
      Object.assign(p, JSON.parse(s.innerHTML));
    } catch {}
  }

  return p;
};

/**
 * Create a habitat for a component
 */
export default function habitat<P extends Props = Props>(W: ComponentType<P>) {
  return {
    render(opts: { selector?: string; defaultProps?: Partial<P>; clean?: boolean } = {}) {
      const { selector = '[data-widget]', defaultProps, clean } = opts;
      const els = document.querySelectorAll(selector);
      const instances: { el: Element; unmount: () => void }[] = [];

      els.forEach((el) => {
        if (clean) el.innerHTML = '';
        const props = gp(el, defaultProps) as P;
        render(h(W, props), el);
        instances.push({
          el,
          unmount: () => render(null, el),
        });
      });

      return instances;
    },
  };
}

export { h, render };
