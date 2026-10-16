import { redirect } from 'next/navigation';

// "Meu Painel" saiu do portal do psicólogo. A rota continua existindo só para
// que links antigos (e-mails, WhatsApp, favoritos) caiam na nova tela inicial.
export default function CockpitRedirect() {
  redirect('/pacientes');
}
