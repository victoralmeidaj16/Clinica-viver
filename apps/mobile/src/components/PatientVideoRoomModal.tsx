import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { colors } from '../theme/colors';

interface PatientVideoRoomModalProps {
  onClose: () => void;
}

export default function PatientVideoRoomModal({ onClose }: PatientVideoRoomModalProps) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      
      {/* Header do Vídeo no App Mobile */}
      <View style={styles.header}>
        <View style={styles.statusGroup}>
          <View style={styles.greenDot} />
          <Text style={styles.headerTitle}>SESSÃO AO VIVO • Dra. Mariana</Text>
        </View>
        <TouchableOpacity style={styles.leaveBtn} onPress={onClose}>
          <Text style={styles.leaveBtnText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Janela Principal: Psicóloga */}
      <View style={styles.mainVideoArea}>
        <View style={styles.placeholderContainer}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>M</Text>
          </View>
          <Text style={styles.videoName}>Dra. Mariana Souza</Text>
          <Text style={styles.videoStatus}>Vídeo HD Conectado (WebRTC)</Text>
        </View>

        {/* Floating PIP Video: Paciente (Você) */}
        <View style={styles.pipVideoCard}>
          <View style={styles.pipAvatarCircle}>
            <Text style={styles.pipAvatarText}>Você</Text>
          </View>
          <Text style={styles.pipName}>Sua Câmera</Text>
        </View>
      </View>

      {/* Controles do Paciente (Mic, Vídeo, Desconectar) */}
      <View style={styles.controlsBar}>
        <TouchableOpacity style={styles.controlBtn}>
          <Text style={styles.controlIcon}>🎙️</Text>
          <Text style={styles.controlLabel}>Mudo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn}>
          <Text style={styles.controlIcon}>📹</Text>
          <Text style={styles.controlLabel}>Câmera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={onClose}>
          <Text style={styles.controlIcon}>📞</Text>
          <Text style={[styles.controlLabel, { color: '#ffffff' }]}>Encerrar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    height: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 8,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  leaveBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  leaveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mainVideoArea: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  placeholderContainer: {
    alignItems: 'center',
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#4338ca',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  videoName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  videoStatus: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  pipVideoCard: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 110,
    height: 150,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  pipAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipAvatarText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  pipName: {
    color: '#cbd5e1',
    fontSize: 10,
    marginTop: 6,
  },
  controlsBar: {
    height: 90,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1e293b',
  },
  endCallBtn: {
    backgroundColor: '#dc2626',
  },
  controlIcon: {
    fontSize: 20,
  },
  controlLabel: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
});
