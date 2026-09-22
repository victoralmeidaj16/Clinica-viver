'use client';

import { Calendar, Clock, Globe, MapPin, CalendarDays, CheckCircle2 } from 'lucide-react';

interface Props {
  data: string;
  hora: string;
  duracaoMin: number;
  modalidade: 'online' | 'presencial';
  status: 'agendado' | 'realizado';
  setData: (value: string) => void;
  setHora: (value: string) => void;
  setDuracaoMin: (value: number) => void;
  setModalidade: (value: 'online' | 'presencial') => void;
  setStatus: (value: 'agendado' | 'realizado') => void;
}

export function EditSessionFields({ data, hora, duracaoMin, modalidade, status, setData, setHora, setDuracaoMin, setModalidade, setStatus }: Props) {
  return <>
          {/* Data e Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">Data *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 w-4 h-4 text-muted" />
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="input pl-9 text-xs font-bold w-full"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">Horário *</label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 w-4 h-4 text-muted" />
                <input
                  type="time"
                  required
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="input pl-9 text-xs font-bold w-full"
                />
              </div>
            </div>
          </div>

          {/* Duração & Modalidade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">Duração</label>
              <select
                value={duracaoMin}
                onChange={(e) => setDuracaoMin(Number(e.target.value))}
                className="input text-xs font-bold w-full bg-white"
              >
                <option value={30}>30 minutos</option>
                <option value={50}>50 minutos (Padrão)</option>
                <option value={60}>60 minutos (1 hora)</option>
                <option value={90}>90 minutos (1h 30m)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">Modalidade</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalidade('online')}
                  className={`py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition ${
                    modalidade === 'online'
                      ? 'bg-white text-psi-deep shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" /> Online
                </button>
                <button
                  type="button"
                  onClick={() => setModalidade('presencial')}
                  className={`py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition ${
                    modalidade === 'presencial'
                      ? 'bg-white text-psi-deep shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" /> Presencial
                </button>
              </div>
            </div>
          </div>

          {/* Status do Atendimento */}
          <div>
            <label className="text-xs font-bold text-ink block mb-1">Status do Atendimento</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('agendado')}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  status === 'agendado'
                    ? 'border-sky-300 bg-sky-50 text-sky-900 shadow-sm ring-2 ring-sky-400/20'
                    : 'border-line bg-white text-muted hover:bg-slate-50'
                }`}
              >
                <CalendarDays className="w-4 h-4 text-sky-600" /> Agendado
              </button>
              <button
                type="button"
                onClick={() => setStatus('realizado')}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  status === 'realizado'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm ring-2 ring-emerald-400/20'
                    : 'border-line bg-white text-muted hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Realizado
              </button>
            </div>
          </div>

  </>;
}
