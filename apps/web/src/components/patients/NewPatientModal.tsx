'use client';

import React, { useEffect, useState } from 'react';
import type { ProfessionalProfile } from '@thats-life/core';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import { UserPlus, X, Save } from 'lucide-react';

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Chamado após o cadastro persistir, para a lista recarregar da API. */
  onPatientCreated: () => void | Promise<void>;
}

export default function NewPatientModal({ isOpen, onClose, onPatientCreated }: NewPatientModalProps) {
  const [nome, setNome] = useState('');
  const [nomeSocial, setNomeSocial] = useState('');
  const [temNomeSocial, setTemNomeSocial] = useState(false);
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [numeroResidencia, setNumeroResidencia] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [professionals, setProfessionals] = useState<readonly ProfessionalProfile[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Todo paciente nasce atribuído a um profissional: é essa atribuição que
  // decide, depois, quem pode abrir o prontuário dele.
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    applicationRequest<ProfessionalProfile[]>('/professionals')
      .then((items) => {
        if (!mounted) return;
        setProfessionals(items);
        setProfessionalId((current) => current || items[0]?.id || '');
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !telefone || saving) return;

    setSaving(true);
    setError(null);
    try {
      await applicationRequest('/patients', {
        method: 'POST',
        headers: commandHeaders(),
        body: JSON.stringify({
          displayName: temNomeSocial && nomeSocial ? nomeSocial : nome,
          legalName: nome,
          socialName: temNomeSocial ? nomeSocial : undefined,
          phone: telefone,
          email: email || undefined,
          birthDate: dataNascimento || undefined,
          professionalId: professionalId || undefined,
        }),
      });
      await onPatientCreated();
      setNome('');
      setNomeSocial('');
      setTemNomeSocial(false);
      setEmail('');
      setTelefone('');
      setNumeroResidencia('');
      setDataNascimento('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cadastrar o paciente.');
    } finally {
      setSaving(false);
    }
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
            <div className="mt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-ink select-none">
                <input
                  type="checkbox"
                  checked={temNomeSocial}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setTemNomeSocial(checked);
                    if (!checked) setNomeSocial('');
                  }}
                  className="w-4 h-4 rounded border-line text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <span>Possui Nome Social?</span>
              </label>
            </div>
          </div>

          {temNomeSocial && (
            <div className="animate-in fade-in duration-200">
              <label className="font-bold text-ink mb-1 block">
                Nome Social <span className="text-muted font-normal">(como prefere ser chamado)</span>
              </label>
              <input
                type="text"
                value={nomeSocial}
                onChange={(e) => setNomeSocial(e.target.value)}
                placeholder="Digite o nome social..."
                className="input"
              />
            </div>
          )}

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

          <div className="grid grid-cols-2 gap-3">
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
              <label className="font-bold text-ink mb-1 block">Nº Residência</label>
              <input
                type="text"
                value={numeroResidencia}
                onChange={(e) => setNumeroResidencia(e.target.value)}
                placeholder="Ex: 123"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-ink mb-1 block">Profissional Responsável *</label>
            <select
              required
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              className="input"
            >
              {professionals.length === 0 && <option value="">Nenhum profissional cadastrado</option>}
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.displayName} — {professional.councilType} {professional.councilRegistration}
                </option>
              ))}
            </select>
            {professionals.length === 0 && (
              <p className="text-[11px] text-muted mt-1">
                Cadastre um profissional antes de registrar pacientes.
              </p>
            )}
          </div>

          {error && (
            <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
              {error}
            </p>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-ghost text-xs" disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary text-xs py-2.5" disabled={saving}>
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando…' : 'Salvar Paciente'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
