'use client';

import { type ReactNode, useState } from 'react';

export function ConfirmPrompt({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return <div role="alertdialog" aria-label={message} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
    <span className="min-w-0 flex-1 font-bold">{message}</span>
    <button type="button" onClick={onCancel} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-black">Cancelar</button>
    <button type="button" autoFocus onClick={onConfirm} className="rounded-lg bg-amber-700 px-3 py-1.5 font-black text-white">Confirmar</button>
  </div>;
}

/** Botão de ação destrutiva em dois passos: o primeiro clique só pede confirmação. */
export function ConfirmButton({ message, onConfirm, className, title, children }: {
  message: string; onConfirm: () => void; className?: string; title?: string; children: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) return <ConfirmPrompt message={message} onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); onConfirm(); }} />;
  return <button type="button" onClick={() => setConfirming(true)} className={className} title={title}>{children}</button>;
}
