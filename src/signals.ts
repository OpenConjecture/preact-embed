/**
 * Preact Habitat Modern - Signals Integration
 *
 * Optional module for using @preact/signals with habitat widgets.
 * Enables reactive state sharing between widgets without prop drilling.
 */

import { signal, computed, effect, batch, Signal, ReadonlySignal } from '@preact/signals';
import { useSignal, useComputed, useSignalEffect } from '@preact/signals';

// ============================================================================
// Signal Store for Cross-Widget State
// ============================================================================

type SignalStore = Map<string, Signal<unknown>>;

const globalStore: SignalStore = new Map();

/**
 * Get or create a global signal by key
 */
export function getSignal<T>(key: string, initialValue: T): Signal<T> {
  if (!globalStore.has(key)) {
    globalStore.set(key, signal(initialValue));
  }
  return globalStore.get(key) as Signal<T>;
}

/**
 * Check if a signal exists in the global store
 */
export function hasSignal(key: string): boolean {
  return globalStore.has(key);
}

/**
 * Remove a signal from the global store
 */
export function deleteSignal(key: string): boolean {
  return globalStore.delete(key);
}

/**
 * Clear all signals from the global store
 */
export function clearSignals(): void {
  globalStore.clear();
}

/**
 * Get all signal keys
 */
export function getSignalKeys(): string[] {
  return Array.from(globalStore.keys());
}

// ============================================================================
// Reactive Store Pattern
// ============================================================================

export interface StoreActions<S> {
  [key: string]: (state: S, ...args: any[]) => Partial<S> | void;
}

export interface Store<S, A extends StoreActions<S>> {
  state: Signal<S>;
  actions: { [K in keyof A]: (...args: Parameters<A[K]> extends [S, ...infer R] ? R : never[]) => void };
  subscribe: (callback: (state: S) => void) => () => void;
  getSnapshot: () => S;
}

/**
 * Create a reactive store with actions
 */
export function createStore<S extends object, A extends StoreActions<S>>(
  initialState: S,
  actions: A
): Store<S, A> {
  const state = signal<S>(initialState);

  const boundActions = {} as Store<S, A>['actions'];

  for (const key in actions) {
    (boundActions as any)[key] = (...args: any[]) => {
      const result = actions[key](state.peek(), ...args);
      if (result !== undefined) {
        batch(() => {
          state.value = { ...state.peek(), ...result };
        });
      }
    };
  }

  const subscribe = (callback: (state: S) => void): (() => void) => {
    return effect(() => {
      callback(state.value);
    });
  };

  const getSnapshot = (): S => state.peek();

  return {
    state,
    actions: boundActions,
    subscribe,
    getSnapshot,
  };
}

// ============================================================================
// Widget Context with Signals
// ============================================================================

import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

export interface WidgetContext<T = unknown> {
  id: string;
  data: Signal<T>;
  parentData?: Signal<unknown>;
}

const WidgetContextInternal = createContext<WidgetContext | null>(null);

export const WidgetProvider = WidgetContextInternal.Provider;

/**
 * Hook to access widget context
 */
export function useWidgetContext<T = unknown>(): WidgetContext<T> | null {
  return useContext(WidgetContextInternal) as WidgetContext<T> | null;
}

/**
 * Hook to create a reactive connection to a global signal
 */
export function useGlobalSignal<T>(key: string, initialValue: T): Signal<T> {
  return getSignal(key, initialValue);
}

// ============================================================================
// Computed Values for Derived State
// ============================================================================

/**
 * Create a computed value that derives from multiple signals
 */
export function createDerived<T>(fn: () => T): ReadonlySignal<T> {
  return computed(fn);
}

// ============================================================================
// Re-exports from @preact/signals
// ============================================================================

export {
  signal,
  computed,
  effect,
  batch,
  useSignal,
  useComputed,
  useSignalEffect,
  Signal,
  ReadonlySignal,
};
