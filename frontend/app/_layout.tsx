import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, Pressable, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Custom back button component
function BackButton() {
  const router = useRouter();
  
  const handlePress = () => {
    router.back();
  };
  
  return (
    <Pressable 
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [
        styles.backButton,
        pressed && styles.backButtonPressed
      ]}
    >
      <Ionicons name="arrow-back" size={24} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 12,
    marginLeft: -4,
    marginRight: 8,
    cursor: 'pointer',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
});

export default function RootLayout() {
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'web') return;
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1a1a2e',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#0f0f1a',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Study Planner',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="subjects"
          options={{
            title: 'Subjects',
            headerShown: true,
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="subject/[id]"
          options={{
            title: 'Topics',
            headerShown: true,
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="add-topic"
          options={{
            title: 'Add Topic',
            headerShown: true,
            headerLeft: () => <BackButton />,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="edit-topic/[id]"
          options={{
            title: 'Edit Topic',
            headerShown: true,
            headerLeft: () => <BackButton />,
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  );
}
