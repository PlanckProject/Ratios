import React from 'react';
import {
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
  visible: boolean;
  title: string;
  onClose: () => void;
  scroll?: boolean;
}

export function BottomSheet({
  visible,
  title,
  onClose,
  scroll = true,
  children,
}: BottomSheetProps): React.JSX.Element {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.full}
      >
        <Pressable onPress={onClose} style={styles.scrim}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <IconButton icon="close" onPress={onClose} tone="surface" />
            </View>
            {content}
          </Pressable>
        </Pressable>
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
