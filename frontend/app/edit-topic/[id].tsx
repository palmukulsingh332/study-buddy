import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Topic {
  id: string;
  subject_id: string;
  subject_name: string;
  name: string;
  notes: string;
  created_at: string;
  revision_dates: Array<{
    date: string;
    day_number: number;
    completed: boolean;
  }>;
}

export default function EditTopicScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [topicName, setTopicName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTopic();
  }, [id]);

  const fetchTopic = async () => {
    try {
      const response = await fetch(`${API_URL}/api/topics/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTopic(data);
        setTopicName(data.name);
        setNotes(data.notes || '');
      } else {
        Alert.alert('Error', 'Topic not found');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching topic:', error);
      Alert.alert('Error', 'Failed to load topic');
    } finally {
      setLoading(false);
    }
  };

  const updateTopic = async () => {
    if (!topicName.trim()) {
      Alert.alert('Error', 'Please enter a topic name');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/api/topics/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: topicName.trim(),
          notes: notes.trim(),
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Topic updated successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to update topic');
      }
    } catch (error) {
      console.error('Error updating topic:', error);
      Alert.alert('Error', 'Failed to update topic');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ade80" />
      </View>
    );
  }

  if (!topic) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Subject Info */}
        <View style={styles.section}>
          <Text style={styles.label}>Subject</Text>
          <View style={styles.subjectCard}>
            <Ionicons name="book" size={20} color="#a5b4fc" />
            <Text style={styles.subjectName}>{topic.subject_name}</Text>
          </View>
        </View>

        {/* Topic Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Topic Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter topic name"
            placeholderTextColor="#6b7280"
            value={topicName}
            onChangeText={setTopicName}
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add any notes or details..."
            placeholderTextColor="#6b7280"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Revision Schedule */}
        <View style={styles.section}>
          <Text style={styles.label}>Revision Schedule</Text>
          <View style={styles.scheduleCard}>
            {topic.revision_dates.map((revision) => (
              <View key={revision.day_number} style={styles.scheduleItem}>
                <View style={styles.scheduleLeft}>
                  <View
                    style={[
                      styles.scheduleBadge,
                      { backgroundColor: getColorForDay(revision.day_number) },
                    ]}
                  >
                    <Text style={styles.scheduleBadgeText}>Day {revision.day_number}</Text>
                  </View>
                  <Text style={styles.scheduleDate}>{formatDate(revision.date)}</Text>
                </View>
                <View style={styles.scheduleStatus}>
                  {revision.completed ? (
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                      <Text style={styles.completedText}>Done</Text>
                    </View>
                  ) : (
                    <View style={styles.pendingBadge}>
                      <Ionicons name="time" size={16} color="#f59e0b" />
                      <Text style={styles.pendingText}>Pending</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Created Date */}
        <View style={styles.createdInfo}>
          <Ionicons name="calendar-outline" size={14} color="#6b7280" />
          <Text style={styles.createdText}>
            Created on {formatDate(topic.created_at)}
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={updateTopic}
          disabled={saving}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.submitButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getColorForDay = (day: number) => {
  switch (day) {
    case 2:
      return '#f59e0b';
    case 7:
      return '#3b82f6';
    case 14:
      return '#8b5cf6';
    default:
      return '#6b7280';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  subjectCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectName: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
  },
  scheduleCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 65,
    alignItems: 'center',
  },
  scheduleBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleDate: {
    color: '#fff',
    fontSize: 15,
  },
  scheduleStatus: {},
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completedText: {
    color: '#4ade80',
    fontSize: 13,
    marginLeft: 4,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingText: {
    color: '#f59e0b',
    fontSize: 13,
    marginLeft: 4,
  },
  createdInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  createdText: {
    color: '#6b7280',
    fontSize: 14,
    marginLeft: 6,
  },
  submitButton: {
    backgroundColor: '#4ade80',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});
