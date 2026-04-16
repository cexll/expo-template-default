import type { ReactElement } from 'react';
import { useCssElement } from 'react-native-css';
import {
  Image as RNImage,
  type ImageProps as RNImageProps,
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  ScrollView as RNScrollView,
  type ScrollViewProps as RNScrollViewProps,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  Text as RNText,
  type TextProps as RNTextProps,
  View as RNView,
  type ViewProps as RNViewProps,
} from 'react-native';
import {
  SafeAreaView as RNSafeAreaView,
  type SafeAreaViewProps as RNSafeAreaViewProps,
} from 'react-native-safe-area-context';

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

export type ImageProps = RNImageProps & {
  className?: string;
};

export function Image(props: ImageProps): ReactElement {
  return useCssElement(RNImage as any, props as any, {
    className: 'style',
  }) as ReactElement;
}

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

export type TextInputProps = RNTextInputProps & {
  className?: string;
};

export function TextInput(props: TextInputProps): ReactElement {
  return useCssElement(RNTextInput as any, props as any, {
    className: 'style',
  }) as ReactElement;
}

export type SafeAreaViewProps = RNSafeAreaViewProps & {
  className?: string;
};

export function SafeAreaView(props: SafeAreaViewProps): ReactElement {
  return useCssElement(RNSafeAreaView as any, props as any, {
    className: 'style',
  }) as ReactElement;
}
