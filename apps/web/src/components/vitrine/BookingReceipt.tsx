export function BookingReceipt({ protocolo, whatsappEnviado }: {
  protocolo?: string;
  whatsappEnviado: boolean;
}) {
  return (
    <div className="space-y-2" role="status">
      {protocolo && <p className="font-bold">Protocolo: {protocolo}</p>}
      {whatsappEnviado ? (
        <p>O aviso de recebimento foi enviado ao WhatsApp informado. As próximas orientações serão enviadas após a confirmação do profissional.</p>
      ) : (
        <p className="text-amber-900">Sua solicitação está registrada, mas não conseguimos confirmar o envio do aviso por WhatsApp. Entre em contato com a clínica pelo botão de WhatsApp desta página e informe o protocolo para conferir seu telefone. Não é necessário fazer outro cadastro.</p>
      )}
    </div>
  );
}
