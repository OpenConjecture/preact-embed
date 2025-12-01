/**
 * Preact Habitat Modern
 * A lightweight (~1KB) framework for embedding Preact micro-components in any DOM.
 *
 * Features:
 * - TypeScript-first with full type safety
 * - Shadow DOM support for style isolation
 * - Intersection Observer for lazy loading
 * - Custom Elements integration
 * - Event-based communication between widgets
 * - SSR hydration support
 * - Cleanup/unmount capabilities
 */

import { h, render, hydrate, ComponentType, VNode } from 'preact';

// ============================================================================
// Types
// ============================================================================

export interface HabitatOptions<P extends object = {}> {
  /** CSS selector to find mount points */
  selector?: string;
  /** Default props for all widget instances */
  defaultProps?: Partial<P>;
  /** Mount in the parent node of the script tag (inline mode) */
  inline?: boolean;
  /** Remove innerHTML before mounting */
  clean?: boolean;
  /** Allow script tag to specify mount target via data-mount-in attribute */
  clientSpecified?: boolean;
  /** Enable Shadow DOM for style isolation */
  shadowRoot?: boolean | ShadowRootInit;
  /** Lazy load using Intersection Observer */
  lazy?: boolean | IntersectionObserverInit;
  /** Hydrate instead of render (for SSR) */
  hydrate?: boolean;
  /** Custom element tag name (registers as Web Component) */
  tagName?: string;
  /** Called before each widget mounts */
  onBeforeMount?: (element: Element, props: P) => void | P;
  /** Called after each widget mounts */
  onMounted?: (element: Element, props: P) => void;
  /** Called when widget unmounts */
  onUnmount?: (element: Element) => void;
}

export interface WidgetInstance<P extends object = {}> {
  element: Element;
  props: P;
  unmount: () => void;
  update: (newProps: Partial<P>) => void;
}

export interface HabitatResult<P extends object = {}> {
  render: (options?: HabitatOptions<P>) => WidgetInstance<P>[];
  renderOne: (element: Element, props?: Partial<P>) => WidgetInstance<P>;
  unmountAll: () => void;
  instances: WidgetInstance<P>[];
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert kebab-case to camelCase
 * data-prop-hello-world => helloWorld
 */
function camelCase(str: string): string {
  return str.replace(/-([a-z])/gi, (_, letter) => letter.toUpperCase());
}

/**
 * Get the currently executing script element
 */
function getCurrentScript(): HTMLScriptElement | null {
  if (document.currentScript) {
    return document.currentScript as HTMLScriptElement;
  }
  // Fallback for older browsers
  const scripts = document.getElementsByTagName('script');
  return scripts[scripts.length - 1] as HTMLScriptElement;
}

/**
 * Parse JSON safely with error handling
 */
function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    console.warn('[preact-habitat] Failed to parse JSON props:', json);
    return fallback;
  }
}

/**
 * Collect props from element's data-prop-* attributes
 */
function getPropsFromAttributes(element: Element): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const attrs = element.attributes;

  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr.name.startsWith('data-prop-')) {
      const propName = camelCase(attr.name.slice(10)); // Remove 'data-prop-'
      let value: unknown = attr.value;

      // Try to parse as JSON for objects/arrays/booleans/numbers
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (value === 'null') value = null;
      else if (!isNaN(Number(value)) && value !== '') value = Number(value);
      else {
        try {
          const parsed = JSON.parse(value as string);
          if (typeof parsed === 'object') value = parsed;
        } catch {
          // Keep as string
        }
      }

      props[propName] = value;
    }
  }

  return props;
}

/**
 * Collect props from script tags inside element
 */
function getPropsFromScripts(element: Element): Record<string, unknown> {
  const scripts = element.querySelectorAll(
    'script[type="application/json"], script[type="text/props"]'
  );

  let props: Record<string, unknown> = {};

  scripts.forEach((script) => {
    const content = script.innerHTML.trim();
    if (content) {
      const parsed = safeJsonParse(content, {});
      props = { ...props, ...parsed };
    }
  });

  return props;
}

/**
 * Collect all props for an element
 */
function collectProps<P extends object>(
  element: Element,
  defaultProps?: Partial<P>
): P {
  const attrProps = getPropsFromAttributes(element);
  const scriptProps = getPropsFromScripts(element);

  return {
    ...defaultProps,
    ...scriptProps,
    ...attrProps,
  } as P;
}

/**
 * Find all host elements based on options
 */
function findHostElements<P extends object = {}>(options: HabitatOptions<P>): Element[] {
  const { selector, inline, clientSpecified } = options;
  const elements: Element[] = [];

  if (inline) {
    const script = getCurrentScript();
    if (script?.parentElement) {
      elements.push(script.parentElement);
    }
  } else if (clientSpecified) {
    const script = getCurrentScript();
    const mountIn = script?.getAttribute('data-mount-in');
    if (mountIn) {
      const found = document.querySelectorAll(mountIn);
      found.forEach((el) => elements.push(el));
    }
  } else if (selector) {
    const found = document.querySelectorAll(selector);
    found.forEach((el) => elements.push(el));
  }

  return elements;
}

// ============================================================================
// Widget Storage (for tracking mounted instances)
// ============================================================================

const HABITAT_KEY = Symbol('preact-habitat');

interface HabitatMeta {
  root: Element | ShadowRoot;
  vnode: VNode<{}> | null;
  unmount: () => void;
}

function setHabitatMeta(element: Element, meta: HabitatMeta): void {
  (element as any)[HABITAT_KEY] = meta;
}

function getHabitatMeta(element: Element): HabitatMeta | undefined {
  return (element as any)[HABITAT_KEY];
}

function clearHabitatMeta(element: Element): void {
  delete (element as any)[HABITAT_KEY];
}

// ============================================================================
// Core Habitat Factory
// ============================================================================

/**
 * Create a habitat for a Preact component
 */
export function habitat<P extends object = {}>(
  Widget: ComponentType<P>
): HabitatResult<P> {
  const instances: WidgetInstance<P>[] = [];
  let globalOptions: HabitatOptions<P> = {};

  /**
   * Render a single widget instance
   */
  function renderOne(
    element: Element,
    overrideProps?: Partial<P>
  ): WidgetInstance<P> {
    // Check if already mounted
    const existingMeta = getHabitatMeta(element);
    if (existingMeta) {
      console.warn('[preact-habitat] Element already has a mounted widget');
      existingMeta.unmount();
    }

    // Collect props
    let props = collectProps<P>(element, {
      ...globalOptions.defaultProps,
      ...overrideProps,
    });

    // Call onBeforeMount hook
    if (globalOptions.onBeforeMount) {
      const modified = globalOptions.onBeforeMount(element, props);
      if (modified) props = modified;
    }

    // Clean if requested
    if (globalOptions.clean) {
      // Remove all children except script tags with props
      const children = Array.from(element.childNodes);
      children.forEach((child) => {
        if (
          child.nodeType === Node.ELEMENT_NODE &&
          (child as Element).tagName === 'SCRIPT' &&
          ((child as Element).getAttribute('type') === 'application/json' ||
            (child as Element).getAttribute('type') === 'text/props')
        ) {
          return; // Keep prop scripts
        }
        child.parentNode?.removeChild(child);
      });
    }

    // Determine render root (regular or shadow)
    let root: Element | ShadowRoot = element;
    if (globalOptions.shadowRoot) {
      const shadowInit: ShadowRootInit =
        typeof globalOptions.shadowRoot === 'object'
          ? globalOptions.shadowRoot
          : { mode: 'open' };
      root = element.attachShadow(shadowInit);
    }

    // Create the widget VNode
    const vnode = h(Widget, props as any);

    // Render or hydrate
    const renderFn = globalOptions.hydrate ? hydrate : render;

    // Perform the render
    const doRender = () => {
      renderFn(vnode, root as Element);
    };

    // Handle lazy loading
    if (globalOptions.lazy) {
      const observerOptions: IntersectionObserverInit =
        typeof globalOptions.lazy === 'object' ? globalOptions.lazy : {};

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            doRender();
            observer.disconnect();
          }
        });
      }, observerOptions);

      observer.observe(element);
    } else {
      doRender();
    }

    // Create unmount function
    const unmount = () => {
      render(null, root as Element);
      clearHabitatMeta(element);
      globalOptions.onUnmount?.(element);

      // Remove from instances array
      const idx = instances.findIndex((i) => i.element === element);
      if (idx > -1) instances.splice(idx, 1);
    };

    // Create update function
    const update = (newProps: Partial<P>) => {
      props = { ...props, ...newProps };
      render(h(Widget, props as any), root as Element);
    };

    // Store metadata
    setHabitatMeta(element, { root, vnode: vnode as VNode<{}>, unmount });

    // Create instance
    const instance: WidgetInstance<P> = {
      element,
      props,
      unmount,
      update,
    };

    instances.push(instance);

    // Call onMounted hook
    globalOptions.onMounted?.(element, props);

    return instance;
  }

  /**
   * Render widgets to all matching elements
   */
  function renderAll(options: HabitatOptions<P> = {}): WidgetInstance<P>[] {
    globalOptions = options;

    // Handle custom elements registration
    if (options.tagName) {
      registerCustomElement(options.tagName, Widget, options);
      return instances;
    }

    const elements = findHostElements(options);
    const newInstances: WidgetInstance<P>[] = [];

    elements.forEach((element) => {
      const instance = renderOne(element);
      newInstances.push(instance);
    });

    return newInstances;
  }

  /**
   * Unmount all widget instances
   */
  function unmountAll(): void {
    [...instances].forEach((instance) => instance.unmount());
  }

  return {
    render: renderAll,
    renderOne,
    unmountAll,
    instances,
  };
}

// ============================================================================
// Custom Elements Integration
// ============================================================================

/**
 * Register a Preact component as a Custom Element
 */
export function registerCustomElement<P extends object>(
  tagName: string,
  Widget: ComponentType<P>,
  options: HabitatOptions<P> = {}
): void {
  if (customElements.get(tagName)) {
    console.warn(`[preact-habitat] Custom element "${tagName}" already registered`);
    return;
  }

  class PreactHabitatElement extends HTMLElement {
    private _props: P = {} as P;
    private _root: ShadowRoot | null = null;
    private _mounted = false;

    static get observedAttributes(): string[] {
      return []; // Can be customized
    }

    constructor() {
      super();
      if (options.shadowRoot !== false) {
        const shadowInit: ShadowRootInit =
          typeof options.shadowRoot === 'object'
            ? options.shadowRoot
            : { mode: 'open' };
        this._root = this.attachShadow(shadowInit);
      }
    }

    connectedCallback(): void {
      this._props = collectProps<P>(this, options.defaultProps);
      this._render();
      this._mounted = true;
    }

    disconnectedCallback(): void {
      if (this._mounted) {
        const target = this._root || this;
        render(null, target);
        this._mounted = false;
      }
    }

    attributeChangedCallback(): void {
      if (this._mounted) {
        this._props = collectProps<P>(this, options.defaultProps);
        this._render();
      }
    }

    private _render(): void {
      const target = this._root || this;
      render(h(Widget, this._props as any), target);
    }

    // Public API for programmatic updates
    setProps(newProps: Partial<P>): void {
      this._props = { ...this._props, ...newProps };
      if (this._mounted) {
        this._render();
      }
    }

    getProps(): P {
      return { ...this._props };
    }
  }

  customElements.define(tagName, PreactHabitatElement);
}

// ============================================================================
// Event Bus for Widget Communication
// ============================================================================

type EventCallback = (...args: unknown[]) => void;

class HabitatEventBus {
  private events: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback): void {
    this.events.get(event)?.delete(callback);
  }

  emit(event: string, ...args: unknown[]): void {
    this.events.get(event)?.forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`[preact-habitat] Error in event handler for "${event}":`, error);
      }
    });
  }

  clear(): void {
    this.events.clear();
  }
}

export const eventBus = new HabitatEventBus();

// ============================================================================
// React Hook for Event Bus
// ============================================================================

import { useEffect, useState, useCallback } from 'preact/hooks';

/**
 * Hook to subscribe to habitat events
 */
export function useHabitatEvent<T = unknown>(
  event: string,
  initialValue?: T
): [T | undefined, (value: T) => void] {
  const [value, setValue] = useState<T | undefined>(initialValue);

  useEffect(() => {
    const unsubscribe = eventBus.on(event, (data) => {
      setValue(data as T);
    });
    return unsubscribe;
  }, [event]);

  const emit = useCallback(
    (newValue: T) => {
      eventBus.emit(event, newValue);
    },
    [event]
  );

  return [value, emit];
}

// ============================================================================
// Utility Exports
// ============================================================================

export { h, render, hydrate } from 'preact';
export { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';

/**
 * Helper to create a habitat and immediately render
 */
export function mount<P extends object = {}>(
  Widget: ComponentType<P>,
  options: HabitatOptions<P> = {}
): WidgetInstance<P>[] {
  const { render } = habitat(Widget);
  return render(options);
}

/**
 * Auto-mount when DOM is ready
 */
export function autoMount<P extends object = {}>(
  Widget: ComponentType<P>,
  options: HabitatOptions<P> = {}
): void {
  const doMount = () => mount(Widget, options);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doMount);
  } else {
    doMount();
  }
}

// Default export
export default habitat;
