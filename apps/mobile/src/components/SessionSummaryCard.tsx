import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PatientHandoff } from '@thats-life/core';
import { colors } from '../theme/colors';

interface SessionSummaryCardProps {
  handoff: PatientHandoff;
}

export default function SessionSummaryCard({ handoff }: SessionSummaryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.badge}>PLANO PÓS-SESSÃO</Text>
        <Text style={styles.reviewed}>✓ Revisado</Text>
      </View>

      <Text style={styles.title}>Seu plano para esta semana</Text>
      <Text style={styles.summary}>{handoff.summary}</Text>

      <View style={styles.footer}>
        <Text style={styles.professional}>Revisado por {handoff.professionalName}</Text>
        {handoff.nextSessionLabel ? (
          <Text style={styles.nextSession}>Próxima sessão: {handoff.nextSessionLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.capriSoft,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A7E8FF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  reviewed: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  summary: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#A7E8FF',
    marginTop: 14,
    paddingTop: 12,
  },
  professional: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  nextSession: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 5,
  },
});
