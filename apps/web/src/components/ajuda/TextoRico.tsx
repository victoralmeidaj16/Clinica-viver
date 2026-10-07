import { partesTexto } from '@/lib/ajuda/textoRico';

export default function TextoRico({ texto }: { texto: string }) {
  return (
    <>
      {partesTexto(texto).map((parte, i) => {
        if (parte.estilo === 'negrito') return <strong key={i} className="font-bold text-ink">{parte.texto}</strong>;
        if (parte.estilo === 'italico') return <em key={i}>{parte.texto}</em>;
        return <span key={i}>{parte.texto}</span>;
      })}
    </>
  );
}
