'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, MapPin, RefreshCw, Search } from 'lucide-react';

interface Estado { id: number; sigla: string; nome: string }
interface Municipio { id: number; nome: string }

interface Props {
  estadoUf: string;
  cidade: string;
  onEstadoChange: (uf: string) => void;
  onCidadeChange: (cidade: string) => void;
  required?: boolean;
}

const normalizeSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

export function BrazilLocationFields({ estadoUf, cidade, onEstadoChange, onCidadeChange, required = true }: Props) {
  const [estados, setEstados] = useState<Estado[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [municipiosUf, setMunicipiosUf] = useState('');
  const [busca, setBusca] = useState(cidade);
  const [aberto, setAberto] = useState(false);
  const [carregandoEstados, setCarregandoEstados] = useState(true);
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [erroEstados, setErroEstados] = useState<string | null>(null);
  const [erroCidades, setErroCidades] = useState<string | null>(null);
  const [tentativaEstados, setTentativaEstados] = useState(0);
  const [tentativaCidades, setTentativaCidades] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/public/localidades', { cache: 'force-cache' })
      .then(async (response) => {
        const body = await response.json() as { success: boolean; data?: Estado[]; error?: string };
        if (!response.ok || !body.success) throw new Error(body.error);
        if (active) {
          setEstados(body.data ?? []);
          setErroEstados(null);
        }
      })
      .catch(() => active && setErroEstados('Não foi possível carregar os estados.'))
      .finally(() => active && setCarregandoEstados(false));
    return () => { active = false; };
  }, [tentativaEstados]);

  useEffect(() => {
    if (!estadoUf) return;
    let active = true;
    fetch(`/api/public/localidades?uf=${encodeURIComponent(estadoUf)}`, { cache: 'force-cache' })
      .then(async (response) => {
        const body = await response.json() as { success: boolean; data?: Municipio[]; error?: string };
        if (!response.ok || !body.success) throw new Error(body.error);
        if (active) {
          setMunicipios(body.data ?? []);
          setMunicipiosUf(estadoUf);
          setErroCidades(null);
        }
      })
      .catch(() => active && setErroCidades('Não foi possível carregar as cidades desta UF.'))
      .finally(() => active && setCarregandoCidades(false));
    return () => { active = false; };
  }, [estadoUf, tentativaCidades]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtrados = useMemo(() => {
    const term = normalizeSearch(busca.trim());
    return municipios.filter((item) => !term || normalizeSearch(item.nome).includes(term)).slice(0, 80);
  }, [busca, municipios]);

  const erro = erroEstados ?? erroCidades;
  const cidadeCarregando = Boolean(estadoUf) && !erroCidades && (carregandoCidades || municipiosUf !== estadoUf);

  const inputClass = 'w-full border border-slate-300 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600 disabled:bg-slate-100 disabled:text-slate-400';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label htmlFor="psicologo-estado" className="font-bold text-slate-700 block mb-1">Estado {required && <span className="text-rose-500">*</span>}</label>
        <div className="relative">
          <select id="psicologo-estado" required={required} disabled={carregandoEstados} value={estadoUf} onChange={(event) => { onEstadoChange(event.target.value); onCidadeChange(''); setMunicipios([]); setMunicipiosUf(''); setBusca(''); setErroCidades(null); setCarregandoCidades(Boolean(event.target.value)); setAberto(false); }} className={`${inputClass} appearance-none pr-10`}>
            <option value="">{carregandoEstados ? 'Carregando estados…' : 'Selecione o estado'}</option>
            {estados.map((estado) => <option key={estado.id} value={estado.sigla}>{estado.nome} ({estado.sigla})</option>)}
          </select>
          {carregandoEstados ? <Loader2 className="absolute right-3 top-3.5 w-4 h-4 animate-spin text-purple-600" /> : <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />}
        </div>
      </div>

      <div ref={containerRef} className="relative">
        <label htmlFor="psicologo-cidade" className="font-bold text-slate-700 block mb-1">Cidade {required && <span className="text-rose-500">*</span>}</label>
        <div className="relative">
          <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
          <input id="psicologo-cidade" type="text" role="combobox" aria-expanded={aberto} aria-controls="lista-cidades" aria-autocomplete="list" required={required} disabled={!estadoUf || cidadeCarregando || Boolean(erro)} value={cidade || busca} onFocus={() => setAberto(true)} onChange={(event) => { setBusca(event.target.value); onCidadeChange(''); setAberto(true); }} placeholder={!estadoUf ? 'Selecione primeiro o estado' : cidadeCarregando ? 'Carregando cidades…' : 'Digite para filtrar'} className={`${inputClass} pl-10`} autoComplete="off" />
          {cidadeCarregando && <Loader2 className="absolute right-3 top-3.5 w-4 h-4 animate-spin text-purple-600" />}
        </div>
        {aberto && estadoUf && !cidadeCarregando && !erro && (
          <div id="lista-cidades" role="listbox" className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-purple-100 bg-white p-1 shadow-xl">
            {filtrados.length ? filtrados.map((municipio) => (
              <button key={municipio.id} type="button" role="option" aria-selected={cidade === municipio.nome} onClick={() => { setBusca(municipio.nome); onCidadeChange(municipio.nome); setAberto(false); }} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-800">
                <MapPin className="w-3.5 h-3.5 text-purple-500" />{municipio.nome}
              </button>
            )) : <p className="px-3 py-4 text-center text-xs text-slate-500">Nenhuma cidade encontrada.</p>}
          </div>
        )}
      </div>

      {erro && <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"><span>{erro}</span><button type="button" onClick={() => { if (erroEstados) { setErroEstados(null); setCarregandoEstados(true); setTentativaEstados((value) => value + 1); } else { setErroCidades(null); setCarregandoCidades(true); setTentativaCidades((value) => value + 1); } }} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 border border-rose-200"><RefreshCw className="w-3 h-3" />Tentar novamente</button></div>}
    </div>
  );
}
