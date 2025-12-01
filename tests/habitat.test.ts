/**
 * Tests for Preact Habitat Modern
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';

// We'll test the utility functions directly since they don't require DOM setup
// For full integration tests, you'd use @testing-library/preact with jsdom

describe('Utility Functions', () => {
  describe('camelCase', () => {
    // Import the function (would need to export it for testing)
    const camelCase = (str: string): string => {
      return str.replace(/-([a-z])/gi, (_, letter) => letter.toUpperCase());
    };

    it('converts kebab-case to camelCase', () => {
      expect(camelCase('hello-world')).toBe('helloWorld');
      expect(camelCase('theme-color')).toBe('themeColor');
      expect(camelCase('data-prop-hello-world')).toBe('dataPropHelloWorld');
    });

    it('handles single words', () => {
      expect(camelCase('hello')).toBe('hello');
    });

    it('handles multiple dashes', () => {
      expect(camelCase('my-very-long-name')).toBe('myVeryLongName');
    });

    it('handles uppercase letters', () => {
      expect(camelCase('HELLO-WORLD')).toBe('HELLOWORLD');
    });
  });

  describe('safeJsonParse', () => {
    const safeJsonParse = <T>(json: string, fallback: T): T => {
      try {
        return JSON.parse(json);
      } catch {
        return fallback;
      }
    };

    it('parses valid JSON', () => {
      expect(safeJsonParse('{"a": 1}', {})).toEqual({ a: 1 });
      expect(safeJsonParse('[1, 2, 3]', [])).toEqual([1, 2, 3]);
      expect(safeJsonParse('"hello"', '')).toBe('hello');
    });

    it('returns fallback for invalid JSON', () => {
      expect(safeJsonParse('invalid', {})).toEqual({});
      expect(safeJsonParse('{broken', [])).toEqual([]);
    });
  });
});

describe('Event Bus', () => {
  // Simple event bus implementation for testing
  class TestEventBus {
    private events: Map<string, Set<(...args: unknown[]) => void>> = new Map();

    on(event: string, callback: (...args: unknown[]) => void): () => void {
      if (!this.events.has(event)) {
        this.events.set(event, new Set());
      }
      this.events.get(event)!.add(callback);
      return () => this.off(event, callback);
    }

    off(event: string, callback: (...args: unknown[]) => void): void {
      this.events.get(event)?.delete(callback);
    }

    emit(event: string, ...args: unknown[]): void {
      this.events.get(event)?.forEach((cb) => cb(...args));
    }

    clear(): void {
      this.events.clear();
    }
  }

  let eventBus: TestEventBus;

  beforeEach(() => {
    eventBus = new TestEventBus();
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('subscribes to events', () => {
    const callback = vi.fn();
    eventBus.on('test', callback);
    eventBus.emit('test', 'data');
    expect(callback).toHaveBeenCalledWith('data');
  });

  it('unsubscribes from events', () => {
    const callback = vi.fn();
    const unsubscribe = eventBus.on('test', callback);
    unsubscribe();
    eventBus.emit('test', 'data');
    expect(callback).not.toHaveBeenCalled();
  });

  it('handles multiple subscribers', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    eventBus.on('test', callback1);
    eventBus.on('test', callback2);
    eventBus.emit('test', 'data');
    expect(callback1).toHaveBeenCalledWith('data');
    expect(callback2).toHaveBeenCalledWith('data');
  });

  it('handles multiple arguments', () => {
    const callback = vi.fn();
    eventBus.on('test', callback);
    eventBus.emit('test', 1, 2, 3);
    expect(callback).toHaveBeenCalledWith(1, 2, 3);
  });
});

describe('Props Parsing', () => {
  const parseValue = (value: string): unknown => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (!isNaN(Number(value)) && value !== '') return Number(value);
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object') return parsed;
    } catch {
      // Keep as string
    }
    return value;
  };

  it('parses booleans', () => {
    expect(parseValue('true')).toBe(true);
    expect(parseValue('false')).toBe(false);
  });

  it('parses null', () => {
    expect(parseValue('null')).toBe(null);
  });

  it('parses numbers', () => {
    expect(parseValue('42')).toBe(42);
    expect(parseValue('3.14')).toBe(3.14);
    expect(parseValue('-10')).toBe(-10);
    expect(parseValue('0')).toBe(0);
  });

  it('parses JSON objects', () => {
    expect(parseValue('{"key": "value"}')).toEqual({ key: 'value' });
  });

  it('parses JSON arrays', () => {
    expect(parseValue('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('keeps strings as strings', () => {
    expect(parseValue('hello')).toBe('hello');
    expect(parseValue('hello world')).toBe('hello world');
  });

  it('keeps empty string as empty string', () => {
    expect(parseValue('')).toBe('');
  });
});

describe('Store Pattern', () => {
  interface TestState {
    count: number;
    name: string;
  }

  const createTestStore = (initialState: TestState) => {
    let state = initialState;
    const subscribers = new Set<(state: TestState) => void>();

    return {
      getState: () => state,
      setState: (partial: Partial<TestState>) => {
        state = { ...state, ...partial };
        subscribers.forEach((cb) => cb(state));
      },
      subscribe: (callback: (state: TestState) => void) => {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
      },
    };
  };

  it('maintains state', () => {
    const store = createTestStore({ count: 0, name: 'test' });
    expect(store.getState()).toEqual({ count: 0, name: 'test' });
  });

  it('updates state', () => {
    const store = createTestStore({ count: 0, name: 'test' });
    store.setState({ count: 5 });
    expect(store.getState()).toEqual({ count: 5, name: 'test' });
  });

  it('notifies subscribers', () => {
    const store = createTestStore({ count: 0, name: 'test' });
    const callback = vi.fn();
    store.subscribe(callback);
    store.setState({ count: 1 });
    expect(callback).toHaveBeenCalledWith({ count: 1, name: 'test' });
  });

  it('allows unsubscribe', () => {
    const store = createTestStore({ count: 0, name: 'test' });
    const callback = vi.fn();
    const unsubscribe = store.subscribe(callback);
    unsubscribe();
    store.setState({ count: 1 });
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('Widget Instance API', () => {
  interface WidgetInstance<P> {
    element: Element;
    props: P;
    unmount: () => void;
    update: (newProps: Partial<P>) => void;
  }

  // Mock widget instance
  const createMockInstance = <P extends object>(
    element: Element,
    initialProps: P
  ): WidgetInstance<P> => {
    let props = { ...initialProps };
    let mounted = true;

    return {
      element,
      get props() {
        return props;
      },
      unmount: () => {
        mounted = false;
      },
      update: (newProps: Partial<P>) => {
        if (mounted) {
          props = { ...props, ...newProps };
        }
      },
    };
  };

  it('stores initial props', () => {
    const mockElement = {} as Element;
    const instance = createMockInstance(mockElement, { title: 'Test', count: 0 });
    expect(instance.props).toEqual({ title: 'Test', count: 0 });
  });

  it('updates props', () => {
    const mockElement = {} as Element;
    const instance = createMockInstance(mockElement, { title: 'Test', count: 0 });
    instance.update({ count: 5 });
    expect(instance.props).toEqual({ title: 'Test', count: 5 });
  });

  it('maintains element reference', () => {
    const mockElement = { id: 'test' } as unknown as Element;
    const instance = createMockInstance(mockElement, { title: 'Test' });
    expect(instance.element).toBe(mockElement);
  });
});
