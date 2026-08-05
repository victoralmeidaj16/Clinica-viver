'use client';

import React, { useState } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Calendar,
  Sparkles,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Send,
  HelpCircle,
} from 'lucide-react';

export default function TriagemSolicitarPage() {
  const [form, setForm] = useState({
    nomePaciente: '',
    telefoneWhatsApp: '',
    email: '',
    cpf: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: 'Porto Alegre',
    uf: 'RS',
    cep: '',
    modalidade: 'ACESSIVEL_SOCIAL',
    turno: 'TARDE',
    origemLead: 'Site Viver Mais',
    convenioEmpresarial: 'NENHUM',
  });

  const [enviado, setEnviado] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEnviado(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8 flex items-center justify-center">
      <div className="max-w-3xl w-full space-y-6">
        {/* Branding Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-psi-vibrant/20 border border-psi-vibrant/40 px-4 py-1.5 rounded-full text-psi-vibrant text-xs font-bold">
            <Sparkles className="w-4 h-4" />
            Clínica Escola Viver Mais Psicologia
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Solicitação de Agendamento
          </h1>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            Preencha seus dados abaixo. Nosso sistema atribuirá automaticamente um psicólogo disponível no seu turno de preferência.
          </p>
        </div>

        {enviado ? (
          <div className="bg-gradient-to-br from-emerald-900 to-slate-900 border border-emerald-500/40 rounded-3xl p-8 text-center space-y-4 shadow-contrast">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white">Solicitação Recebida com Sucesso!</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Um de nossos psicólogos qualificados entrará em contato pelo seu **WhatsApp** em até **24 horas** para agendar o horário da sua primeira consulta!
            </p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-slate-400 font-mono">
              Protocolo de Triagem: <span className="text-emerald-400 font-bold">#VM-{Math.floor(100000 + Math.random() * 900000)}</span>
            </div>
            <button
              type="button"
              onClick={() => setEnviado(false)}
              className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-bold text-xs px-6 py-3 rounded-2xl transition-all"
            >
              Realizar Nova Solicitação
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            {/* Modalidade */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                1. Modalidade de Atendimento
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, modalidade: 'ACESSIVEL_SOCIAL' })}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    form.modalidade === 'ACESSIVEL_SOCIAL'
                      ? 'bg-psi-vibrant border-psi-vibrant text-white shadow-lg shadow-psi-vibrant/30'
                      : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="font-extrabold text-sm">Atendimento Acessível</div>
                  <div className="text-[11px] opacity-80 mt-1">Tarifa Social / Renda Reduzida</div>
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, modalidade: 'PARTICULAR' })}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    form.modalidade === 'PARTICULAR'
                      ? 'bg-psi-vibrant border-psi-vibrant text-white shadow-lg shadow-psi-vibrant/30'
                      : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="font-extrabold text-sm">Atendimento Particular</div>
                  <div className="text-[11px] opacity-80 mt-1">Valor Padrão da Clínica</div>
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, modalidade: 'AVALIACAO_PSICOLOGICA' })}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    form.modalidade === 'AVALIACAO_PSICOLOGICA'
                      ? 'bg-psi-vibrant border-psi-vibrant text-white shadow-lg shadow-psi-vibrant/30'
                      : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="font-extrabold text-sm">Avaliação Psicológica</div>
                  <div className="text-[11px] opacity-80 mt-1">Testes & Laudos Clínicos</div>
                </button>
              </div>
            </div>

            {/* Turno */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                2. Turno de Preferência
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['MANHA', 'TARDE', 'NOITE'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, turno: t })}
                    className={`py-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                      form.turno === t
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {t === 'MANHA' ? 'Manhã (08h - 12h)' : t === 'TARDE' ? 'Tarde (13h - 18h)' : 'Noite (18h - 21h)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Dados Pessoais */}
            <div className="space-y-4 pt-2 border-t border-slate-700/60">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                3. Seus Dados Pessoais (Obrigatórios para Nota Fiscal)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={form.nomePaciente}
                    onChange={(e) => setForm({ ...form, nomePaciente: e.target.value })}
                    placeholder="Ex: João Pedro Severo"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-psi-vibrant"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 mb-1 block">WhatsApp com DDD</label>
                  <input
                    type="text"
                    required
                    value={form.telefoneWhatsApp}
                    onChange={(e) => setForm({ ...form, telefoneWhatsApp: e.target.value })}
                    placeholder="(51) 99999-9999"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-psi-vibrant"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 mb-1 block">CPF</label>
                  <input
                    type="text"
                    required
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-psi-vibrant"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 mb-1 block">E-mail</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-psi-vibrant"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Logradouro / Endereço</label>
                  <input
                    type="text"
                    required
                    value={form.logradouro}
                    onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
                    placeholder="Rua, Avenida..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-psi-vibrant"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Número / Apt</label>
                  <input
                    type="text"
                    required
                    value={form.numero}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                    placeholder="123, Apto 402"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-psi-vibrant"
                  />
                </div>
              </div>
            </div>

            {/* Origem & Convênio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-700/60">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Como ficou sabendo da clínica?</label>
                <select
                  value={form.origemLead}
                  onChange={(e) => setForm({ ...form, origemLead: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-psi-vibrant"
                >
                  <option value="Site Viver Mais">Site Viver Mais</option>
                  <option value="Tráfego Pago (Google Ads)">Tráfego Pago (Google Ads)</option>
                  <option value="Redes Sociais (Instagram)">Redes Sociais (Instagram)</option>
                  <option value="Indicação de Amigo">Indicação de Amigo/Familiar</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Possui Convênio Empresarial?</label>
                <select
                  value={form.convenioEmpresarial}
                  onChange={(e) => setForm({ ...form, convenioEmpresarial: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-psi-vibrant"
                >
                  <option value="NENHUM">Não (Atendimento Normal)</option>
                  <option value="CANGURU">Projeto Canguru Soluções (6 Sessões)</option>
                  <option value="OUTRO">Outra Empresa Parceira</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-sm py-4 rounded-2xl shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              FINALIZAR AGENDAMENTO
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
