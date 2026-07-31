import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { PatientHandoff, PatientHandoffTask } from '@thats-life/core';
import { colors } from '../theme/colors';

interface PatientTasksProps {
  handoff: PatientHandoff;
}

export default function PatientTasks({ handoff }: PatientTasksProps) {
  const [tasks, setTasks] = useState<PatientHandoffTask[]>(() =>
    handoff.tasks.map((task) => ({ ...task }))
  );

  const toggleTask = (id: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const doneCount = tasks.filter((task) => task.completed).length;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.heading}>
          <Text style={styles.title}>Tarefas da Semana 🎯</Text>
          <Text style={styles.subtitle}>
            Atividades autorizadas por {handoff.professionalName}
          </Text>
        </View>
        <Text style={styles.progressText}>{doneCount}/{tasks.length} concluídas</Text>
      </View>

      <View style={styles.taskList}>
        {tasks.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={[
              styles.taskItem,
              task.completed ? styles.taskItemDone : undefined,
            ]}
            onPress={() => toggleTask(task.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.completed }}
            accessibilityLabel={task.title}
          >
            <View
              style={[
                styles.checkbox,
                task.completed ? styles.checkboxDone : undefined,
              ]}
            >
              {task.completed ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text
              style={[
                styles.taskText,
                task.completed ? styles.taskTextDone : undefined,
              ]}
            >
              {task.title}
            </Text>
          </TouchableOpacity>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heading: {
    flex: 1,
    paddingRight: 8,
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
  },
  progressText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
    backgroundColor: colors.soft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  taskList: {
    gap: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  taskItemDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.muted,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  checkmark: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: 'bold',
  },
  taskText: {
    fontSize: 12,
    color: colors.ink,
    flex: 1,
  },
  taskTextDone: {
    textDecorationLine: 'line-through',
    color: colors.muted,
  },
});
