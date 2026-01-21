import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
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

interface Subject {
  id: string;
  name: string;
  created_at: string;
}

export default function SubjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch subject details
      const subjectRes = await fetch(`${API_URL}/api/subjects/${id}`);
      if (subjectRes.ok) {
        const subjectData = await subjectRes.json();
        setSubject(subjectData);
      }

      // Fetch topics
      const topicsRes = await fetch(`${API_URL}/api/subjects/${id}/topics`);
      if (topicsRes.ok) {
        const topicsData = await topicsRes.json();
        setTopics(topicsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (id) {
        fetchData();
      }
    }, [id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const deleteTopic = (topic: Topic) => {
    Alert.alert(
      'Delete Topic',
      `Are you sure you want to delete "${topic.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/topics/${topic.id}`, {
                method: 'DELETE',
              });

              if (response.ok) {
                fetchData();
              } else {
                Alert.alert('Error', 'Failed to delete topic');
              }
            } catch (error) {
              console.error('Error deleting topic:', error);
              Alert.alert('Error', 'Failed to delete topic');
            }
          },
        },
      ]
    );
  };

  const getNextRevision = (revisionDates: Topic['revision_dates']) => {
    const incomplete = revisionDates.filter((rd) => !rd.completed);
    if (incomplete.length === 0) return null;
    return incomplete.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )[0];
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const getRevisionStatusColor = (revisionDates: Topic['revision_dates']) => {
    const completed = revisionDates.filter((rd) => rd.completed).length;
    if (completed === 3) return '#4ade80';
    if (completed >= 1) return '#f59e0b';
    return '#3b82f6';
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
        {/* Subject Header */}
        {subject && (
          <View style={styles.headerCard}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="book" size={32} color="#a5b4fc" />
            </View>
            <Text style={styles.headerTitle}>{subject.name}</Text>
            <Text style={styles.headerSubtitle}>{topics.length} topics</Text>
          </View>
        )}

        {/* Topics List */}
        {topics.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyText}>No topics yet</Text>
            <Text style={styles.emptySubtext}>Add topics to track your revisions</Text>
          </View>
        ) : (
          topics.map((topic) => {
            const nextRevision = getNextRevision(topic.revision_dates);
            const completedCount = topic.revision_dates.filter((rd) => rd.completed).length;

            return (
              <View
                key={topic.id}
                style={[
                  styles.topicCard,
                  { borderLeftColor: getRevisionStatusColor(topic.revision_dates) },
                ]}
              >
                <View style={styles.topicHeader}>
                  <Text style={styles.topicName}>{topic.name}</Text>
                  <View style={styles.topicActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => router.push(`/edit-topic/${topic.id}`)}
                    >
                      <Ionicons name="pencil" size={18} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => deleteTopic(topic)}
                    >
                      <Ionicons name="trash" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {topic.notes ? (
                  <Text style={styles.notesText} numberOfLines={2}>
                    {topic.notes}
                  </Text>
                ) : null}

                <View style={styles.revisionInfo}>
                  <Text style={styles.revisionTitle}>Revision Schedule:</Text>
                  <View style={styles.allRevisionsContainer}>
                    {topic.revision_dates
                      .sort((a, b) => a.day_number - b.day_number)
                      .map((revision) => (
                        <View key={revision.day_number} style={styles.revisionRow}>
                          <View style={[styles.dayBadge, { backgroundColor: getDayColor(revision.day_number) }]}>
                            <Text style={styles.dayBadgeText}>Day {revision.day_number}</Text>
                          </View>
                          <Text style={styles.revisionDateText}>{formatDate(revision.date)}</Text>
                          {revision.completed ? (
                            <View style={styles.statusCompleted}>
                              <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                            </View>
                          ) : (
                            <View style={styles.statusPending}>
                              <Ionicons name="time-outline" size={16} color="#f59e0b" />
                            </View>
                          )}
                        </View>
                      ))}
                  </View>

                  {completedCount === 3 && (
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#4ade80" />
                      <Text style={styles.completedText}>All revisions completed!</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.createdText}>
                  Added on {formatDate(topic.created_at)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Topic FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push({ pathname: '/add-topic', params: { subjectId: id } })}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
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
  headerCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#2a2a40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
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
  topicCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topicName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  topicActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  revisionInfo: {
    marginTop: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    color: '#6b7280',
    fontSize: 13,
    marginRight: 8,
  },
  progressDots: {
    flexDirection: 'row',
  },
  progressDot: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  progressDotText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  nextRevision: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextRevisionText: {
    color: '#888',
    fontSize: 13,
    marginLeft: 4,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  completedText: {
    color: '#4ade80',
    fontSize: 13,
    marginLeft: 4,
  },
  createdText: {
    color: '#4b5563',
    fontSize: 12,
    marginTop: 12,
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
});
