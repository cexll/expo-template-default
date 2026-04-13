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
