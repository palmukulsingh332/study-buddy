import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Subject {
  id: string;
  name: string;
  created_at: string;
}

export default function SubjectsScreen() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({});

  const fetchSubjects = async () => {
    try {
      const response = await fetch(`${API_URL}/api/subjects`);
      if (response.ok) {
        const data = await response.json();
        setSubjects(data);
        
        // Fetch topic counts for each subject
        const counts: Record<string, number> = {};
        for (const subject of data) {
          try {
            const topicsRes = await fetch(`${API_URL}/api/subjects/${subject.id}/topics`);
            if (topicsRes.ok) {
              const topics = await topicsRes.json();
              counts[subject.id] = topics.length;
            }
          } catch (e) {
            counts[subject.id] = 0;
          }
        }
        setTopicCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSubjects();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSubjects();
    setRefreshing(false);
  };

  const addSubject = async () => {
    if (!newSubjectName.trim()) {
      Alert.alert('Error', 'Please enter a subject name');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/subjects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newSubjectName.trim() }),
      });

      if (response.ok) {
        setNewSubjectName('');
        setModalVisible(false);
        fetchSubjects();
      } else {
        Alert.alert('Error', 'Failed to add subject');
      }
    } catch (error) {
      console.error('Error adding subject:', error);
      Alert.alert('Error', 'Failed to add subject');
    }
  };

  const updateSubject = async () => {
    if (!editSubjectName.trim() || !editingSubject) {
      Alert.alert('Error', 'Please enter a subject name');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/subjects/${editingSubject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editSubjectName.trim() }),
      });

      if (response.ok) {
        setEditSubjectName('');
        setEditingSubject(null);
        setEditModalVisible(false);
        fetchSubjects();
      } else {
        Alert.alert('Error', 'Failed to update subject');
      }
    } catch (error) {
      console.error('Error updating subject:', error);
      Alert.alert('Error', 'Failed to update subject');
    }
  };

  const deleteSubject = (subject: Subject) => {
    Alert.alert(
      'Delete Subject',
      `Are you sure you want to delete "${subject.name}"? This will also delete all topics under this subject.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/subjects/${subject.id}`, {
                method: 'DELETE',
              });

              if (response.ok) {
                fetchSubjects();
              } else {
                Alert.alert('Error', 'Failed to delete subject');
              }
            } catch (error) {
              console.error('Error deleting subject:', error);
              Alert.alert('Error', 'Failed to delete subject');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (subject: Subject) => {
    setEditingSubject(subject);
    setEditSubjectName(subject.name);
    setEditModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {subjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="library-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyText}>No subjects yet</Text>
            <Text style={styles.emptySubtext}>Add your first subject to get started</Text>
          </View>
        ) : (
          subjects.map((subject) => (
            <TouchableOpacity
              key={subject.id}
              style={styles.subjectCard}
              onPress={() => router.push(`/subject/${subject.id}`)}
            >
              <View style={styles.subjectInfo}>
                <View style={styles.iconContainer}>
                  <Ionicons name="book" size={24} color="#a5b4fc" />
                </View>
                <View style={styles.subjectTextContainer}>
                  <Text style={styles.subjectName}>{subject.name}</Text>
                  <Text style={styles.topicCount}>
                    {topicCounts[subject.id] || 0} topics
                  </Text>
                </View>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => openEditModal(subject)}
                >
                  <Ionicons name="pencil" size={20} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => deleteSubject(subject)}
                >
                  <Ionicons name="trash" size={20} color="#ef4444" />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={24} color="#6b7280" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add Subject FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Subject Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Subject</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Subject name (e.g., Surgery, Medicine)"
              placeholderTextColor="#6b7280"
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              autoFocus
            />
            <TouchableOpacity style={styles.submitButton} onPress={addSubject}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Add Subject</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Subject Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Subject</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Subject name"
              placeholderTextColor="#6b7280"
              value={editSubjectName}
              onChangeText={setEditSubjectName}
              autoFocus
            />
            <TouchableOpacity style={styles.submitButton} onPress={updateSubject}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Update Subject</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
  },
  subjectCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2a2a40',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  subjectTextContainer: {
    flex: 1,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  topicCount: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginRight: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4ade80',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  input: {
    backgroundColor: '#2a2a40',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#4ade80',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
