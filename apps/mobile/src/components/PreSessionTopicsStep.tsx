import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from './preSessionAssessmentStyles';

interface PreSessionTopicsStepProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export default function PreSessionTopicsStep({
  value,
  onChange,
  onSubmit,
}: PreSessionTopicsStepProps) {
  return (
    <View style={styles.quizBody}>
      <View style={styles.optionalHeading}>
        <Text style={styles.stepCount}>Preparação para a sessão</Text>
        <Text style={styles.optionalBadge}>Opcional</Text>
      </View>
      <Text style={styles.questionText}>Assuntos que você gostaria de abordar</Text>
      <Text style={styles.subtext}>
        Conte, se quiser, o que considera importante conversar na próxima sessão.
        Você pode deixar este campo em branco.
      </Text>
      <TextInput
        accessibilityLabel="Assuntos que você gostaria de abordar"
        multiline
        maxLength={1_000}
        onChangeText={onChange}
        placeholder="Ex.: sono, trabalho, relacionamentos..."
        placeholderTextColor="#8C8395"
        style={styles.topicsInput}
        textAlignVertical="top"
        value={value}
      />
      <Text style={styles.characterCount}>{value.length}/1000</Text>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onSubmit}
        style={styles.submitButton}
      >
        <Text style={styles.submitButtonText}>
          {value.trim() ? 'Enviar check-in' : 'Enviar sem adicionar assuntos'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.privacyText}>
        O texto será exibido ao profissional como escrito por você e não será
        inserido automaticamente no prontuário.
      </Text>
    </View>
  );
}
