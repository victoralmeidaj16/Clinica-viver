import { PasswordResetLinkButton } from '@/components/gestao/PasswordResetLinkButton';

export default function GestaoRedefinirSenhaPage() {
  return <main className="mx-auto max-w-2xl space-y-5 p-6"><p className="text-xs font-bold uppercase tracking-wider text-purple-700">Gestão de acessos</p><h1 className="text-3xl font-black text-slate-900">Redefinir senha de psicólogo</h1><p className="text-sm leading-6 text-slate-600">Gere um link individual de uso único, válido por duas horas. Envie-o apenas ao psicólogo titular da conta.</p><PasswordResetLinkButton /></main>;
}
