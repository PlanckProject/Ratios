import React, { useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius } from '../constants/theme';
import { IconButton } from './IconButton';

interface BottomSheetProps extends React.PropsWithChildren {
  title: string;
  onClose: () => void;
}

export function BottomSheet({
  title,
  onClose,
  children,
}: BottomSheetProps): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.spring(progress, {
      friction: 11,
      tension: 105,
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.full}
      >
        <View style={styles.scrim}>
          <Pressable accessibilityLabel="Close sheet" onPress={onClose} style={StyleSheet.absoluteFill} />
          <Animated.View
            style={{
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [42, 0],
                  }),
                },
              ],
            }}
          >
            <View style={styles.sheet}>
              <View style={styles.grabber} />
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <IconButton icon="close" onPress={onClose} tone="surface" />
              </View>
              <ScrollView
                nestedScrollEnabled
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {children}
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.58)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '82%',
    minHeight: 220,
    overflow: 'hidden',
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 3,
    height: 5,
    marginBottom: 4,
    width: 52,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  content: {
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
});
