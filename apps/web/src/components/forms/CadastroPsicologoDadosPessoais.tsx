import React from 'react';
import type { CamposCadastroPsicologoProps } from './cadastroPsicologoFormState';
import { Upload } from 'lucide-react';
import { BrazilLocationFields } from './BrazilLocationFields';
import { GenderFields } from './GenderFields';
import { maskBrazilPhoneInput } from '@/lib/brazilPhone';
import { processImageUpload } from '@/lib/imageUpload';

interface Props extends CamposCadastroPsicologoProps {
  temNomeSocialPsicologo: boolean;
  setTemNomeSocialPsicologo: React.Dispatch<React.SetStateAction<boolean>>;
}

export function CadastroPsicologoDadosPessoais({ formPsicologo, setFormPsicologo, temNomeSocialPsicologo, setTemNomeSocialPsicologo }: Props) {
  return <>
        <div className="space-y-3">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Nome Completo <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              value={formPsicologo.nomeCompleto}
              onChange={(e) => setFormPsicologo({ ...formPsicologo, nomeCompleto: e.target.value })}
              placeholder="Seu nome completo"
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
            />
            <div className="mt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={temNomeSocialPsicologo}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setTemNomeSocialPsicologo(checked);
                    if (!checked) {
                      setFormPsicologo((prev) => ({ ...prev, nomeSocial: '' }));
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                />
                <span>Possui Nome Social?</span>
              </label>
            </div>
          </div>

          {temNomeSocialPsicologo && (
            <div className="animate-in fade-in duration-200">
              <label className="font-bold text-slate-700 block mb-1">
                Nome Social <span className="text-slate-400 font-normal">(como prefere ser chamado)</span>
              </label>
              <input
                type="text"
                value={formPsicologo.nomeSocial}
                onChange={(e) => setFormPsicologo({ ...formPsicologo, nomeSocial: e.target.value })}
                placeholder="Digite seu nome social"
                className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
              />
            </div>
          )}
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Foto de Perfil <span className="text-rose-500">*</span>
          </label>
          {formPsicologo.fotoUrl ? (
            <div className="flex items-center gap-4 p-3 border border-purple-200 bg-purple-50/50 rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={formPsicologo.fotoUrl}
                alt="Foto de Perfil"
                className="w-16 h-16 rounded-full object-cover border-2 border-purple-500 shadow-sm"
              />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-purple-900">Foto carregada com sucesso</span>
                <button
                  type="button"
                  onClick={() => setFormPsicologo({ ...formPsicologo, fotoUrl: '' })}
                  className="text-xs text-rose-600 hover:text-rose-800 font-extrabold text-left underline"
                >
                  Remover / Trocar foto
                </button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-purple-200 hover:border-purple-500 bg-purple-50/30 hover:bg-purple-50/70 p-4 rounded-2xl cursor-pointer transition-all">
              <Upload className="w-6 h-6 text-purple-600 mb-1" />
              <span className="text-xs font-bold text-purple-900">Clique para enviar uma foto de perfil</span>
              <span className="text-[10px] text-slate-500">Envie um arquivo de imagem (PNG, JPG, WEBP)</span>
              <span className="text-[10px] text-slate-500">Prefira uma foto de rosto, com aparência profissional.</span>
              <input
                type="file"
                required
                aria-label="Foto de perfil"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const compressedDataUrl = await processImageUpload(file);
                      setFormPsicologo((prev) => ({ ...prev, fotoUrl: compressedDataUrl }));
                    } catch (err) {
                      console.error('Erro ao processar imagem:', err);
                      alert('Não foi possível processar a imagem selecionada. Tente outro formato.');
                    }
                  }
                }}
              />
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">E-mail Profissional <span className="text-rose-500">*</span></label>
            <input
              type="email"
              required
              value={formPsicologo.email}
              onChange={(e) => setFormPsicologo({ ...formPsicologo, email: e.target.value })}
              placeholder="seuemail@exemplo.com"
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Telefone / WhatsApp Profissional <span className="text-rose-500">*</span></label>
            <input
              type="tel"
              required
              value={formPsicologo.whatsapp}
              onChange={(e) => setFormPsicologo({ ...formPsicologo, whatsapp: maskBrazilPhoneInput(e.target.value) })}
              placeholder="(48) 99999-9999"
              inputMode="tel"
              autoComplete="tel"
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>

        <GenderFields
          idPrefix="psicologo"
          gender={formPsicologo.genero}
          other={formPsicologo.generoOutro}
          onGenderChange={(genero) => setFormPsicologo((current) => ({ ...current, genero }))}
          onOtherChange={(generoOutro) => setFormPsicologo((current) => ({ ...current, generoOutro }))}
        />

        <BrazilLocationFields
          estadoUf={formPsicologo.estadoUf}
          cidade={formPsicologo.cidade}
          onEstadoChange={(estadoUf) => setFormPsicologo((current) => ({ ...current, estadoUf, cidade: '' }))}
          onCidadeChange={(cidade) => setFormPsicologo((current) => ({ ...current, cidade }))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Rua / logradouro <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formPsicologo.logradouro}
              onChange={(e) => setFormPsicologo((current) => ({ ...current, logradouro: e.target.value }))}
              autoComplete="street-address"
              placeholder="Ex.: Rua das Flores, 123"
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Bairro <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formPsicologo.bairro}
              onChange={(e) => setFormPsicologo((current) => ({ ...current, bairro: e.target.value }))}
              autoComplete="address-level3"
              placeholder="Ex.: Centro"
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>

  </>;
}
