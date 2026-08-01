import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function AssessmentChartCard() {
  const historyData = [
    { month: 'Mai', score: 14, label: 'Moderada' },
    { month: 'Jun', score: 11, label: 'Leve' },
    { month: 'Jul', score: 8, label: 'Leve' },
  ];

  const maxScore = 21; // GAD-7 max

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.badge}>EVOLUÇÃO PSICOMÉTRICA</Text>
        <Text style={styles.scaleName}>Escala GAD-7</Text>
      </View>

      <Text style={styles.title}>Evolução da Ansiedade</Text>
      <Text style={styles.subtitle}>Acompanhamento dos últimos 3 meses</Text>

      {/* Gráfico de Barras Psicométrico */}
      <View style={styles.chartContainer}>
        {historyData.map((item) => {
          const heightPercent = Math.round((item.score / maxScore) * 100);

          return (
            <View key={item.month} style={styles.barGroup}>
              <Text style={styles.barValue}>{item.score} pts</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${heightPercent}%` }]} />
              </View>
              <Text style={styles.barMonth}>{item.month}</Text>
              <Text style={styles.barLabel}>{item.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.footerInfo}>
        <Text style={styles.infoText}>
          📉 <Text style={{ fontWeight: 'bold' }}>Redução de 42%</Text> nos níveis de ansiedade desde o início da psicoterapia TCC.
        </Text>
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
    marginBottom: 6,
  },
  badge: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  scaleName: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 11,
    marginBottom: 20,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 140,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  barGroup: {
    alignItems: 'center',
    width: 60,
  },
  barValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.ink,
    marginBottom: 6,
  },
  barTrack: {
    width: 28,
    height: 80,
    backgroundColor: colors.canvas,
    borderRadius: 14,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 14,
  },
  barMonth: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.ink,
    marginTop: 6,
  },
  barLabel: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 2,
  },
  footerInfo: {
    marginTop: 14,
    padding: 10,
    backgroundColor: colors.capriSoft,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 11,
    color: colors.ink,
  },
});
