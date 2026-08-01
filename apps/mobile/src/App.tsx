import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, StatusBar, ActivityIndicator, Modal } from 'react-native';
import { colors } from './theme/colors';
import NextSessionCard from './components/NextSessionCard';
import MoodTracker from './components/MoodTracker';
import PatientTasks from './components/PatientTasks';
import HabitsTracker from './components/HabitsTracker';
import PreSessionAssessment from './components/PreSessionAssessment';
import AssessmentChartCard from './components/AssessmentChartCard';
import SessionSummaryCard from './components/SessionSummaryCard';
import PatientVideoRoomModal from './components/PatientVideoRoomModal';
import PatientClinicalTimeline from './components/PatientClinicalTimeline';
import { DEMO_PATIENT_HANDOFF } from './data/demoPatientHandoff';
import { fetchPatientPortal, togglePatientTaskRemote, type PatientPortalData } from './api/patientClient';

export default function App() {
  const [portalData, setPortalData] = useState<PatientPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  useEffect(() => {
    fetchPatientPortal()
      .then((data) => setPortalData(data))
      .finally(() => setLoading(false));
  }, []);

  const handoff = portalData?.handoff ?? DEMO_PATIENT_HANDOFF;
  const tasks = portalData?.tasks ?? handoff.tasks.map((t) => ({ ...t }));
  const patientName = portalData?.patient.displayName ?? 'Mariana';

  const handleToggleTask = (id: string) => {
    togglePatientTaskRemote(id).then((result) => {
      setPortalData((prev) => (prev ? { ...prev, tasks: result.tasks } : prev));
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />

      {/* Header do App Mobile */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {patientName.split(' ')[0]} 👋</Text>
          <Text style={styles.subgreeting}>Acompanhamento Terapêutico Thats Life</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{patientName.charAt(0)}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Card de Próxima Consulta com gatilho da Sala de Vídeo */}
          <NextSessionCard onJoinSession={() => setIsVideoModalOpen(true)} />

          {/* Gráfico de Evolução Psicométrica (PHQ-9 e GAD-7) */}
          <AssessmentChartCard />

          {/* Linha do Tempo e Histórico de Marcos Clínicos do Paciente */}
          <PatientClinicalTimeline />

          {/* Conteúdo pós-sessão revisado pelo profissional */}
          <SessionSummaryCard handoff={handoff} />

          {/* Tarefas autorizadas no mesmo conteúdo pós-sessão */}
          <PatientTasks handoff={handoff} tasks={tasks} onToggleTask={handleToggleTask} />

          {/* Avaliação Pré-Sessão (PHQ-9 / GAD-7) */}
          <PreSessionAssessment />

          {/* Diário de Humor */}
          <MoodTracker />

          {/* Hábitos & Autocuidado */}
          <HabitsTracker />
        </ScrollView>
      )}

      {/* Modal da Sala de Vídeo Telepresencial para o Paciente */}
      <Modal
        visible={isVideoModalOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsVideoModalOpen(false)}
      >
        <PatientVideoRoomModal onClose={() => setIsVideoModalOpen(false)} />
      </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
