import { useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { NfsePreview } from './nfseTypes';

const dinheiro = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

const dataBr = (valor: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(`${valor}T12:00:00`));

const cpfMascarado = (digitos: string) => digitos.length === 11
  ? `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`
  : digitos;

export function NfsePreviewDetails({ previa, jaEmitida, salvandoCpf, onSalvarCpf }: {
  previa: NfsePreview;
  jaEmitida: boolean;
  salvandoCpf: boolean;
  onSalvarCpf: (cpf: string) => void;
}) {
  const [cpf, setCpf] = useState('');
  const digitosCpf = cpf.replace(/\D/g, '');
  const cpfPendente = previa.camposPendentes.some((campo) => campo.includes('CPF'));
  const possuiPendencias = previa.camposPendentes.length > 0;

  return (
    <>
      {possuiPendencias && (
        <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Antes de emitir, complete: <strong>{previa.camposPendentes.join(', ')}.</strong>
            {previa.camposPendentes.some((campo) => campo.includes('e-mail'))
              ? ' Atualize o e-mail no cadastro do paciente; é para ele que a nota será enviada.'
              : ''}
          </span>
        </div>
      )}

      {cpfPendente && !jaEmitida && (
        <div className="rounded-2xl border border-line p-4">
          <label htmlFor="cpf-tomador" className="text-[10px] font-bold uppercase tracking-wider text-muted">CPF do tomador</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="cpf-tomador" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
              value={cpf}
              onChange={(evento) => setCpf(cpfMascarado(evento.target.value.replace(/\D/g, '').slice(0, 11)))}
              className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-psi-vibrant"
            />
            <button type="button" onClick={() => onSalvarCpf(digitosCpf)} disabled={digitosCpf.length !== 11 || salvandoCpf} className="rounded-xl bg-psi-deep px-4 py-2 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {salvandoCpf ? 'Salvando…' : 'Salvar CPF'}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">Fica no cadastro do paciente e na triagem — é o mesmo CPF usado para marcar sessão pelo link.</p>
        </div>
      )}

      <dl className="grid gap-x-5 gap-y-4 rounded-2xl border border-line bg-slate-50/70 p-4 text-xs sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Tomador</dt>
          <dd className="mt-1 font-extrabold text-ink">{previa.paciente.nome}</dd>
          <dd className="text-muted">CPF: {previa.paciente.cpf ? cpfMascarado(previa.paciente.cpf) : 'Não informado'}</dd>
          {previa.paciente.email && <dd className="text-muted">{previa.paciente.email}</dd>}
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Competência do atendimento</dt>
          <dd className="mt-1 font-bold text-ink">{dataBr(previa.competencia)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Valor bruto do atendimento</dt>
          <dd className="mt-1 text-base font-black text-emerald-700">{dinheiro(previa.valorCents)}</dd>
        </div>
      </dl>

      {previa.ambiente === 'producao_restrita' && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-900">Ambiente restrito: esta confirmação é usada para homologação, não para emissão em produção.</p>
      )}

      <section className="rounded-2xl border border-line p-4 text-xs">
        <p className="font-extrabold text-ink">Serviço fiscal</p>
        <p className="mt-1 font-semibold text-ink">Psicologia</p>
        <p className="mt-1 text-muted">{previa.descricaoServico}</p>
        <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
          <p><span className="font-bold text-muted">Tributação Nacional:</span> {previa.servico.codigoTributacaoNacional}</p>
          <p><span className="font-bold text-muted">NBS:</span> {previa.servico.codigoNbs}</p>
          <p><span className="font-bold text-muted">Prestação:</span> {previa.servico.municipioPrestacao}/{previa.servico.ufPrestacao}</p>
          <p><span className="font-bold text-muted">Inscrição municipal:</span> {previa.servico.inscricaoMunicipal}</p>
        </div>
      </section>

      {!previa.integracaoConfigurada && (
        <div className="flex gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">A conferência está pronta, mas a emissão segue bloqueada.</p>
            {(previa.certificado?.impedimentos.length ?? 0) > 0 ? (
              <ul className="list-disc space-y-0.5 pl-4">
                {previa.certificado?.impedimentos.map((motivo) => <li key={motivo}>{motivo}</li>)}
              </ul>
            ) : <p>Configure e homologue o certificado digital da clínica na NFS-e Nacional.</p>}
          </div>
        </div>
      )}

      {previa.integracaoConfigurada && (previa.certificado?.alertas.length ?? 0) > 0 && (
        <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <div className="space-y-0.5">{previa.certificado?.alertas.map((alerta) => <p key={alerta}>{alerta}</p>)}</div>
        </div>
      )}
    </>
  );
}
