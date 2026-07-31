'use client';

import React, { useState } from 'react';
import AudioRecorder from '@/components/cockpit/AudioRecorder';
import SoapEditor from '@/components/cockpit/SoapEditor';
import OneClickApprovalModal from '@/components/cockpit/OneClickApprovalModal';
import PreSessionBriefingCard from '@/components/cockpit/PreSessionBriefingCard';
import { INITIAL_PATIENTS, Paciente } from '@/lib/mockData';
import { DEMO_PRE_SESSION_BRIEFINGS } from '@/lib/demoPreSessionCheckIn';
import { processAudioToSoap, GeneratedSoapResult } from '@/lib/soapAiEngine';
import type { PatientHandoff } from '@thats-life/core';
import { Zap, Sparkles, CheckCircle2 } from 'lucide-react';

const PROFESSIONAL_NAME = 'Dra. Camila Vasconcelos';

export default function CockpitPage() {
  const patients: Paciente[] = INITIAL_PATIENTS;
  const [selectedPatientId, setSelectedPatientId] = useState<string>(INITIAL_PATIENTS[0].id);
  const [isProcessing, setIsProcessing] = useState(false);
  const [soapData, setSoapData] = useState<GeneratedSoapResult | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSoapData, setModalSoapData] = useState<GeneratedSoapResult | null>(null);
  const [modalPatientHandoff, setModalPatientHandoff] = useState<PatientHandoff | null>(null);
  const [shareWithPatient, setShareWithPatient] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const [patientContentDelivered, setPatientContentDelivered] = useState(false);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  const handleGenerateSoap = async (durationSeconds: number) => {
    setIsProcessing(true);
    try {
      const result = await processAudioToSoap(
        selectedPatient.id,
        selectedPatient.nome,
        durationSeconds
      );
      setSoapData(result);
    } catch (err) {
      console.error('Erro ao gerar SOAP:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenOneClickModal = (
    finalSoap: GeneratedSoapResult,
    patientHandoff: PatientHandoff,
    sharePatientContent: boolean,
    sendWsp: boolean
  ) => {
    setModalSoapData(finalSoap);
    setModalPatientHandoff(patientHandoff);
    setShareWithPatient(sharePatientContent);
    setSendWhatsApp(sendWsp);
    setIsModalOpen(true);
  };

  const handleSuccessFinish = (deliveredHandoff: PatientHandoff | null) => {
    setPatientContentDelivered(deliveredHandoff?.status === 'delivered');
    setShowNotification(true);
    setSoapData(null);
    setTimeout(() => setShowNotification(false), 5000);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalSoapData(null);
    setModalPatientHandoff(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast de sucesso pós 1-clique */}
      {showNotification && (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6" />
            <div>
              <p className="font-extrabold text-sm">Simulação Pós-Sessão Concluída ⚡</p>
              <p className="text-xs text-emerald-100">
                {patientContentDelivered
                  ? 'Resumo e tarefas foram aprovados e simulados no app. Nenhum dado foi persistido.'
                  : 'Prontuário aprovado sem conteúdo para o paciente. Nenhum dado foi persistido.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Title Banner */}
      <div className="flex items-center justify-between">
        <div>
          <span className="chip-accent text-[11px] mb-1">Workflow do Psicólogo</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <Zap className="w-6 h-6 text-accent fill-accent" />
            Cockpit de Atendimento 1-Clique
          </h1>
          <p className="text-xs text-muted">
            Grave o atendimento, gere a evolução SOAP por IA e automatize o envio pós-sessão com um único clique.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-surface px-4 py-2 rounded-2xl border border-line shadow-card text-xs font-semibold text-ink">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <span>Demonstração de IA: dados simulados</span>
        </div>
      </div>

      {/* 1. Gravador / Entrada de Áudio */}
      <AudioRecorder
        patients={patients}
        selectedPatientId={selectedPatientId}
        onSelectPatient={setSelectedPatientId}
        onGenerateSoap={handleGenerateSoap}
        isProcessing={isProcessing}
      />

      <PreSessionBriefingCard
        briefing={DEMO_PRE_SESSION_BRIEFINGS[selectedPatient.id] ?? null}
      />

      {/* 2. Editor & Revisão SOAP */}
      <SoapEditor
        key={`${selectedPatientId}:${soapData?.sessionId ?? 'empty'}`}
        soapData={soapData}
        patientId={selectedPatient.id}
        patientName={selectedPatient.nome}
        nextSessionLabel={selectedPatient.proximaSessao}
        professionalName={PROFESSIONAL_NAME}
        onOpenOneClickModal={handleOpenOneClickModal}
      />

      {/* Modal de Confirmação 1-Clique */}
      {modalSoapData && modalPatientHandoff ? (
        <OneClickApprovalModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          soapData={modalSoapData}
          patientHandoff={modalPatientHandoff}
          patientName={selectedPatient.nome}
          professionalName={PROFESSIONAL_NAME}
          shareWithPatient={shareWithPatient}
          sendWhatsApp={sendWhatsApp}
          onSuccessFinish={handleSuccessFinish}
        />
      ) : null}
    </div>
  );
}
