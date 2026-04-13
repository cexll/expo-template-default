import type { ReactElement } from 'react';
import { useCssElement } from 'react-native-css';
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  ScrollView as RNScrollView,
  type ScrollViewProps as RNScrollViewProps,
  Text as RNText,
  type TextProps as RNTextProps,
  View as RNView,
  type ViewProps as RNViewProps,
} from 'react-native';

export type ViewProps = RNViewProps & {
  className?: string;
};

export function View(props: ViewProps): ReactElement {
  return useCssElement(RNView, props, { className: 'style' }) as ReactElement;
}

export type TextProps = RNTextProps & {
  className?: string;
};

export function Text(props: TextProps): ReactElement {
  return useCssElement(RNText, props, { className: 'style' }) as ReactElement;
}

export type PressableProps = RNPressableProps & {
  className?: string;
};

export function Pressable(props: PressableProps): ReactElement {
  return useCssElement(RNPressable as any, props as any, {
    className: 'style',
  }) as ReactElement;
}

export type ScrollViewProps = RNScrollViewProps & {
  className?: string;
  contentContainerClassName?: string;
};

export function ScrollView(props: ScrollViewProps): ReactElement {
  return useCssElement(RNScrollView as any, props as any, {
    className: 'style',
    contentContainerClassName: 'contentContainerStyle',
  }) as ReactElement;
}
