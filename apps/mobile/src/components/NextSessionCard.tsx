import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

export default function NextSessionCard() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.badge}>Próxima Consulta</Text>
        <Text style={styles.status}>Confirmada</Text>
      </View>

      <Text style={styles.doctorName}>Dra. Camila Vasconcelos</Text>
      <Text style={styles.specialty}>Psicoterapia TCC • Individual</Text>

      <View style={styles.timeBox}>
        <Text style={styles.timeText}>📅 Quarta-feira, 05 de Agosto às 14:00</Text>
        <Text style={styles.locationText}>💻 Atendimento Online (Google Meet)</Text>
      </View>

      <TouchableOpacity style={styles.wspBtn}>
        <Text style={styles.wspBtnText}>💬 Falar com a Dra. Camila no WhatsApp</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: colors.surface,
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  status: {
    color: colors.capri,
    fontSize: 11,
    fontWeight: 'bold',
  },
  doctorName: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: 'bold',
  },
  specialty: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  timeBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  timeText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: 'bold',
  },
  locationText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 4,
  },
  wspBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  wspBtnText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: 'bold',
  },
});
