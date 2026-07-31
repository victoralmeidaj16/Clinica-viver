import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

export default function HabitsTracker() {
  const habits = [
    { title: 'Respiração Diafragmática (10min)', count: '5 dias seguidos', icon: '🫁' },
    { title: 'Higiene do Sono (Desconectar 22h)', count: '4 dias seguidos', icon: '🌙' },
    { title: 'Exercício Físico Leve (Caminhada)', count: '3 dias seguidos', icon: '🚶' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Hábitos & Autocuidado 🌱</Text>
      <Text style={styles.subtitle}>Rotina de bem-estar monitorada pela clínica</Text>

      <View style={styles.habitList}>
        {habits.map((habit, idx) => (
          <View key={idx} style={styles.habitItem}>
            <View style={styles.habitLeft}>
              <Text style={styles.habitIcon}>{habit.icon}</Text>
              <View>
                <Text style={styles.habitTitle}>{habit.title}</Text>
                <Text style={styles.habitCount}>🔥 {habit.count}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.checkBtn}>
              <Text style={styles.checkBtnText}>+ Concluir</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
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
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    marginBottom: 14,
  },
  habitList: {
    gap: 10,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.soft,
    padding: 12,
    borderRadius: 14,
  },
  habitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  habitIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  habitTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.ink,
  },
  habitCount: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: 'bold',
    marginTop: 2,
  },
  checkBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  checkBtnText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: 'bold',
  },
});
