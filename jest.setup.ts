jest.mock('react-native-css', () => {
  const React = require('react');

  return {
    useCssElement(Component: React.ComponentType<any>, props: Record<string, unknown>) {
      const nextProps = { ...props };
      delete nextProps.className;
      delete nextProps.contentContainerClassName;
      return React.createElement(Component, nextProps);
    },
  };
});

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Minimal localStorage shim for Node/Jest (used by web fallbacks in token storage and other runtime glue).
if (!globalThis.localStorage) {
  type Value = string;
  class LocalStorageMock {
    private store = new Map<string, Value>();
    get length() {
      return this.store.size;
    }
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.has(key) ? this.store.get(key)! : null;
    }
    key(index: number) {
      return Array.from(this.store.keys())[index] ?? null;
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
    setItem(key: string, value: string) {
      this.store.set(String(key), String(value));
    }
  }

  // eslint-disable-next-line no-global-assign
  (globalThis as any).localStorage = new LocalStorageMock();
}
