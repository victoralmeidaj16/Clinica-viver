import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

export interface TimelineMilestone {
  id: string;
  dateLabel: string;
  title: string;
  category: 'record' | 'assessment' | 'milestone';
  summary: string;
  professionalName: string;
}

const DEMO_MILESTONES: TimelineMilestone[] = [
  {
    id: 'm-1',
    dateLabel: 'Hoje, 31 de Julho',
    title: 'Sessão Telepresencial & Alinhamento de Demandas',
    category: 'record',
    summary: 'Trabalhadas estratégias para gerenciamento de sobrecarga de trabalho e respiração diafragmática.',
    professionalName: 'Dra. Mariana Souza',
  },
  {
    id: 'm-2',
    dateLabel: '28 de Julho de 2026',
    title: 'Avaliação GAD-7 (Ansiedade Leve)',
    category: 'assessment',
    summary: 'Pontuação total: 8 pontos. Redução de 30% nos sintomas de ansiedade comparado ao mês anterior.',
    professionalName: 'Autopreenchido',
  },
  {
    id: 'm-3',
    dateLabel: '15 de Julho de 2026',
    title: 'Marco Clinico: Início da Prática de Autocuidado',
    category: 'milestone',
    summary: 'Estabelecimento da rotina diária de RPD e pausa de 10 min para descompressão.',
    professionalName: 'Dra. Mariana Souza',
  },
];

export default function PatientClinicalTimeline() {
  const [expandedId, setExpandedId] = useState<string | null>('m-1');

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.badge}>LINHA DO TEMPO TERAPÊUTICA</Text>
        <Text style={styles.countText}>{DEMO_MILESTONES.length} Marcos</Text>
      </View>

      <Text style={styles.title}>Sua Jornada de Evolução</Text>

      <View style={styles.timelineContainer}>
        {DEMO_MILESTONES.map((item, index) => {
          const isExpanded = expandedId === item.id;
          const isLast = index === DEMO_MILESTONES.length - 1;

          return (
            <View key={item.id} style={styles.itemRow}>
              {/* Linha Vertical de Progresso */}
              <View style={styles.leftColumn}>
                <View style={[styles.dot, item.category === 'milestone' && styles.goldDot]} />
                {!isLast && <View style={styles.verticalLine} />}
              </View>

              {/* Card de Marco */}
              <TouchableOpacity
                style={styles.rightContent}
                activeOpacity={0.8}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <Text style={styles.dateText}>{item.dateLabel}</Text>
                <Text style={styles.itemTitle}>{item.title}</Text>
                
                {isExpanded && (
                  <View style={styles.expandedBox}>
                    <Text style={styles.summaryText}>{item.summary}</Text>
                    <Text style={styles.profText}>📍 Registrado por: {item.professionalName}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  countText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 16,
  },
  timelineContainer: {
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  leftColumn: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  goldDot: {
    backgroundColor: colors.accent,
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.line,
    marginTop: 4,
  },
  rightContent: {
    flex: 1,
    backgroundColor: colors.canvas,
    borderRadius: 14,
    padding: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dateText: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  expandedBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  summaryText: {
    fontSize: 12,
    color: colors.ink,
    lineHeight: 18,
  },
  profText: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 6,
    fontWeight: '600',
  },
});
