'use client';

import React, { useState } from 'react';
import { Paciente } from '@/lib/mockData';
import { UserPlus, X, Save } from 'lucide-react';

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPatient: (newPatient: Paciente) => void;
}

export default function NewPatientModal({ isOpen, onClose, onAddPatient }: NewPatientModalProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [planoAtendimento, setPlanoAtendimento] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !telefone) return;

    const newPatient: Paciente = {
      id: `pac_${Date.now()}`,
      nome,
      email: email || `${nome.toLowerCase().replace(/\s+/g, '.')}@email.com`,
      telefone,
      dataNascimento: dataNascimento || '1998-05-20',
      dataInicioTratamento: new Date().toISOString().split('T')[0],
      status: 'ativo',
      ultimaSessao: 'Nenhuma',
      proximaSessao: 'A agendar',
      planoAtendimento: planoAtendimento || 'Avaliação Psicológica Inicial',
      historicoSessoesCount: 0,
      tarefasAtivasCount: 0,
    };

    onAddPatient(newPatient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-ink p-1">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-line pb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-ink">Cadastrar Novo Paciente</h3>
            <p className="text-xs text-muted">Preencha as informações do novo atendimento</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-ink mb-1 block">Nome Completo *</label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Gabriel Alves..."
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-ink mb-1 block">Telefone (WhatsApp) *</label>
              <input
                type="text"
                required
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-8888"
                className="input"
              />
            </div>
            <div>
              <label className="font-bold text-ink mb-1 block">Data de Nascimento</label>
              <input
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-ink mb-1 block">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="paciente@email.com"
              className="input"
            />
          </div>

          <div>
            <label className="font-bold text-ink mb-1 block">Plano Terapêutico Inicial</label>
            <input
              type="text"
              value={planoAtendimento}
              onChange={(e) => setPlanoAtendimento(e.target.value)}
              placeholder="Ex: TCC para Ansiedade Social..."
              className="input"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-ghost text-xs">
              Cancelar
            </button>
            <button type="submit" className="btn-primary text-xs py-2.5">
              <Save className="w-4 h-4" />
              <span>Salvar Paciente</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
