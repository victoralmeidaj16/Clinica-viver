import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { recordPatientMoodRemote } from '../api/patientClient';

const MOODS = [
  { level: 1, label: 'Muito Mal', emoji: '😢' },
  { level: 2, label: 'Ansioso', emoji: '😟' },
  { level: 3, label: 'Neutro', emoji: '😐' },
  { level: 4, label: 'Bem', emoji: '🙂' },
  { level: 5, label: 'Excelente', emoji: '😄' },
];

const EMOTIONS = ['Ansiedade', 'Calma', 'Foco', 'Gratidão', 'Irritação', 'Cansaço'];

interface MoodTrackerProps {
  onMoodSaved?: () => void;
}

export default function MoodTracker({ onMoodSaved }: MoodTrackerProps) {
  const [selectedMood, setSelectedMood] = useState<number | null>(4);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(['Calma', 'Foco']);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  const toggleEmotion = (emotion: string) => {
    if (selectedEmotions.includes(emotion)) {
      setSelectedEmotions(selectedEmotions.filter((e) => e !== emotion));
    } else {
      setSelectedEmotions([...selectedEmotions, emotion]);
    }
  };

  const handleSelectMood = (level: number) => {
    setSelectedMood(level);
    recordPatientMoodRemote({
      level: level as 1 | 2 | 3 | 4 | 5,
      emotions: selectedEmotions,
    }).then(() => {
      setSavedStatus('Humor registrado com sucesso!');
      if (onMoodSaved) onMoodSaved();
      setTimeout(() => setSavedStatus(null), 3000);
    });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Diário de Humor Hoje 💭</Text>
      <Text style={styles.subtitle}>Como você está se sentindo neste momento?</Text>

      {/* Seleção de Nível 1 a 5 */}
      <View style={styles.moodRow}>
        {MOODS.map((item) => {
          const isSelected = selectedMood === item.level;
          return (
            <TouchableOpacity
              key={item.level}
              style={[styles.moodItem, isSelected && styles.moodItemSelected]}
              onPress={() => handleSelectMood(item.level)}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={[styles.moodLabel, isSelected && styles.moodLabelSelected]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Seleção de Tags de Emoção */}
      <Text style={styles.sectionLabel}>Tags de Emoções:</Text>
      <View style={styles.tagWrap}>
        {EMOTIONS.map((emo) => {
          const active = selectedEmotions.includes(emo);
          return (
            <TouchableOpacity
              key={emo}
              style={[styles.tag, active && styles.tagActive]}
              onPress={() => toggleEmotion(emo)}
            >
              <Text style={[styles.tagText, active && styles.tagTextActive]}>{emo}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {savedStatus && <Text style={styles.savedFeedback}>{savedStatus}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.ink,
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    marginBottom: 16,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  moodItem: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    backgroundColor: colors.soft,
    width: 58,
  },
  moodItemSelected: {
    backgroundColor: colors.primary,
  },
  emoji: {
    fontSize: 22,
  },
  moodLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.muted,
    marginTop: 4,
  },
  moodLabelSelected: {
    color: colors.surface,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.ink,
    marginBottom: 8,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: colors.canvas,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tagActive: {
    backgroundColor: colors.capriSoft,
    borderColor: colors.capri,
  },
  tagText: {
    fontSize: 11,
    color: colors.muted,
  },
  tagTextActive: {
    color: colors.primaryDark,
    fontWeight: 'bold',
  },
  savedFeedback: {
    marginTop: 12,
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
