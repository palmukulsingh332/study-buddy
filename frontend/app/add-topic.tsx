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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { addDays, format } from 'date-fns';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Subject {
  id: string;
  name: string;
  created_at: string;
}

export default function AddTopicScreen() {
  const router = useRouter();
  const { subjectId } = useLocalSearchParams<{ subjectId?: string }>();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjectId || '');
  const [topicName, setTopicName] = useState('');
  const [notes, setNotes] = useState('');
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (subjectId) {
      setSelectedSubjectId(subjectId);
    }
  }, [subjectId]);

  const fetchSubjects = async () => {
    try {
      const response = await fetch(`${API_URL}/api/subjects`);
      if (response.ok) {
        const data = await response.json();
        setSubjects(data);
        if (!subjectId && data.length > 0) {
          setSelectedSubjectId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const scheduleNotifications = async (topicName: string, subjectName: string) => {
    if (Platform.OS === 'web') return;

    const revisionDays = [2, 7, 14];
    const now = new Date();

    for (const day of revisionDays) {
      const revisionDate = addDays(now, day);
      // Set notification for 9 AM on the revision day
      revisionDate.setHours(9, 0, 0, 0);

      // Only schedule if the date is in the future
      if (revisionDate > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Time to revise: ${topicName}`,
            body: `Day ${day} revision for ${subjectName}`,
            data: { topicName, subjectName, day },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: revisionDate,
          },
        });
      }
    }
  };

  const addTopic = async () => {
    if (!selectedSubjectId) {
      Alert.alert('Error', 'Please select a subject');
      return;
    }

    if (!topicName.trim()) {
      Alert.alert('Error', 'Please enter a topic name');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject_id: selectedSubjectId,
          name: topicName.trim(),
          notes: notes.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Schedule notifications
        const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
        if (selectedSubject) {
          await scheduleNotifications(topicName.trim(), selectedSubject.name);
        }

        Alert.alert('Success', 'Topic added successfully with revision reminders!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to add topic');
      }
    } catch (error) {
      console.error('Error adding topic:', error);
      Alert.alert('Error', 'Failed to add topic');
    } finally {
      setLoading(false);
    }
  };

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const today = new Date();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Subject Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Subject</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setShowSubjectPicker(!showSubjectPicker)}
          >
            <View style={styles.selectorContent}>
              <Ionicons name="book" size={20} color="#a5b4fc" />
              <Text style={styles.selectorText}>
                {selectedSubject ? selectedSubject.name : 'Select a subject'}
              </Text>
            </View>
            <Ionicons
              name={showSubjectPicker ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#6b7280"
            />
          </TouchableOpacity>

          {showSubjectPicker && (
            <View style={styles.pickerDropdown}>
              {subjects.length === 0 ? (
                <View style={styles.noSubjectsContainer}>
                  <Text style={styles.noSubjectsText}>No subjects available</Text>
                  <TouchableOpacity
                    style={styles.createSubjectButton}
                    onPress={() => router.push('/subjects')}
                  >
                    <Text style={styles.createSubjectText}>Create Subject</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                subjects.map((subject) => (
                  <TouchableOpacity
                    key={subject.id}
                    style={[
                      styles.pickerItem,
                      selectedSubjectId === subject.id && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedSubjectId(subject.id);
                      setShowSubjectPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedSubjectId === subject.id && styles.pickerItemTextSelected,
                      ]}
                    >
                      {subject.name}
                    </Text>
                    {selectedSubjectId === subject.id && (
                      <Ionicons name="checkmark" size={20} color="#4ade80" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        {/* Topic Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Topic Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Bowel Obstruction"
            placeholderTextColor="#6b7280"
            value={topicName}
            onChangeText={setTopicName}
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add any notes or details about this topic..."
            placeholderTextColor="#6b7280"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Revision Schedule Preview */}
        <View style={styles.section}>
          <Text style={styles.label}>Revision Schedule</Text>
          <View style={styles.scheduleCard}>
            <View style={styles.scheduleItem}>
              <View style={[styles.scheduleBadge, { backgroundColor: '#f59e0b' }]}>
                <Text style={styles.scheduleBadgeText}>Day 2</Text>
              </View>
              <Text style={styles.scheduleDate}>{format(addDays(today, 2), 'dd MMM yyyy')}</Text>
            </View>
            <View style={styles.scheduleItem}>
              <View style={[styles.scheduleBadge, { backgroundColor: '#3b82f6' }]}>
                <Text style={styles.scheduleBadgeText}>Day 7</Text>
              </View>
              <Text style={styles.scheduleDate}>{format(addDays(today, 7), 'dd MMM yyyy')}</Text>
            </View>
            <View style={styles.scheduleItem}>
              <View style={[styles.scheduleBadge, { backgroundColor: '#8b5cf6' }]}>
                <Text style={styles.scheduleBadgeText}>Day 14</Text>
              </View>
              <Text style={styles.scheduleDate}>{format(addDays(today, 14), 'dd MMM yyyy')}</Text>
            </View>
          </View>
          <Text style={styles.scheduleNote}>
            <Ionicons name="notifications" size={14} color="#6b7280" /> You'll receive reminders on these dates
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={addTopic}
          disabled={loading}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.submitButtonText}>
            {loading ? 'Adding...' : 'Add Topic'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
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
  selector: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectorText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  pickerDropdown: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  pickerItem: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a40',
  },
  pickerItemSelected: {
    backgroundColor: '#2a2a40',
  },
  pickerItemText: {
    color: '#fff',
    fontSize: 16,
  },
  pickerItemTextSelected: {
    color: '#4ade80',
  },
  noSubjectsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noSubjectsText: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 12,
  },
  createSubjectButton: {
    backgroundColor: '#4ade80',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createSubjectText: {
    color: '#fff',
    fontWeight: '600',
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
    marginBottom: 12,
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
  scheduleNote: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#4ade80',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
