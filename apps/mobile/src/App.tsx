import React from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { colors } from './theme/colors';
import NextSessionCard from './components/NextSessionCard';
import MoodTracker from './components/MoodTracker';
import PatientTasks from './components/PatientTasks';
import HabitsTracker from './components/HabitsTracker';
import PreSessionAssessment from './components/PreSessionAssessment';
import SessionSummaryCard from './components/SessionSummaryCard';
import { DEMO_PATIENT_HANDOFF } from './data/demoPatientHandoff';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />

      {/* Header do App Mobile */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, Mariana 👋</Text>
          <Text style={styles.subgreeting}>Acompanhamento Terapêutico Thats Life</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>M</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Card de Próxima Consulta */}
        <NextSessionCard />

        {/* Conteúdo pós-sessão revisado pelo profissional */}
        <SessionSummaryCard handoff={DEMO_PATIENT_HANDOFF} />

        {/* Tarefas autorizadas no mesmo conteúdo pós-sessão */}
        <PatientTasks handoff={DEMO_PATIENT_HANDOFF} />

        {/* Avaliação Pré-Sessão (PHQ-9 / GAD-7) */}
        <PreSessionAssessment />

        {/* Diário de Humor */}
        <MoodTracker />

        {/* Hábitos & Autocuidado */}
        <HabitsTracker />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  subgreeting: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
});
