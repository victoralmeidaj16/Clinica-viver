import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { colors } from '../theme/colors';

interface NextSessionCardProps {
  onJoinSession?: () => void;
}

export default function NextSessionCard({ onJoinSession }: NextSessionCardProps) {
  const handleOpenWhatsApp = () => {
    Linking.openURL('https://wa.me/5511999999999?text=Ol%C3%A1%20Dra.%20Camila%2C%20gostaria%20de%20tirar%20uma%20d%C3%BAvida.');
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.badge}>Sessão de Hoje</Text>
        <View style={styles.statusBox}>
          <View style={styles.pulseDot} />
          <Text style={styles.status}>Pronta para Iniciar</Text>
        </View>
      </View>

      <Text style={styles.doctorName}>Dra. Mariana Souza</Text>
      <Text style={styles.specialty}>Psicoterapia TCC • Sessão Telepresencial</Text>

      <View style={styles.timeBox}>
        <Text style={styles.timeText}>📅 Hoje às 15:30 (Em andamento)</Text>
        <Text style={styles.locationText}>🎥 Sala Virtual Privada (Thats Life Video)</Text>
      </View>

      {/* Botão de Entrar na Chamada estilo Zoom */}
      <TouchableOpacity
        style={styles.joinBtn}
        onPress={onJoinSession}
        activeOpacity={0.8}
      >
        <Text style={styles.joinBtnText}>📹 Entrar na Sala de Vídeo do Paciente</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.wspBtn} onPress={handleOpenWhatsApp}>
        <Text style={styles.wspBtnText}>💬 Falar com a Dra. Mariana no WhatsApp</Text>
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
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.capri,
    marginRight: 4,
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
  joinBtn: {
    backgroundColor: colors.capri,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  joinBtnText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  wspBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  wspBtnText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: 'bold',
  },
});
