'use client';

import React, { useState } from 'react';
import { Calendar, Clock, CreditCard, CheckCircle, Video, ShieldCheck, ArrowRight, User } from 'lucide-react';

export function AppointmentBookingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState<'date' | 'payment' | 'success'>('date');
  const [selectedDate, setSelectedDate] = useState('2026-08-05');
  const [selectedTime, setSelectedTime] = useState('14:00');

  if (!isOpen) return null;

  const handleConfirmPayment = () => {
    setStep('success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header do Modal */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
              <Calendar className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">Agendar Consulta Telepresencial</h3>
              <p className="text-xs text-slate-400">Dra. Mariana Souza • TCC Individual</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs font-bold p-1">
            ✕
          </button>
        </div>

        {/* Conteúdo dos Passos */}
        <div className="p-6 space-y-6 flex-1">
          {step === 'date' && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  1. Escolha a Data
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['2026-08-05', '2026-08-06', '2026-08-07'].map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDate(d)}
                      className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                        selectedDate === d
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {new Date(d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  2. Horários Disponíveis
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['09:00', '14:00', '16:30'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                        selectedTime === t
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{t}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resumo da Sessão */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-slate-700 font-medium">
                  <Video className="w-4 h-4 text-indigo-600" />
                  <span>Sessão Telepresencial Zoom (50 min)</span>
                </div>
                <span className="font-extrabold text-slate-900 text-sm">R$ 250,00</span>
              </div>

              <button
                onClick={() => setStep('payment')}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20"
              >
                <span>Avançar para Pagamento</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-emerald-900 text-xs font-medium">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Pagamento seguro em conformidade com CFP e emissão imediata de recibo financeiro.</span>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Selecione a Forma de Pagamento
                </label>

                <div className="p-4 border-2 border-indigo-600 bg-indigo-50/50 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">PIX Instantâneo</span>
                      <span className="text-[10px] text-slate-500">Confirmação em tempo real</span>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-indigo-600">Recomendado</span>
                </div>
              </div>

              <button
                onClick={handleConfirmPayment}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20"
              >
                <span>Pagar R$ 250,00 e Confirmar Agendamento</span>
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900">Agendamento Confirmado!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Sessão agendada para <span className="font-bold text-slate-800">{selectedDate} às {selectedTime}</span>. O link da sala estilo Zoom foi disponibilizado no seu painel e WhatsApp.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
              >
                Concluir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
