/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, ChangeEvent } from "react";
import { 
  ShoppingBag, 
  Menu, 
  Search,
  Star, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft,
  ChevronRight,
  Truck, 
  ShieldCheck, 
  ArrowRight,
  Droplets,
  Sparkles,
  Zap,
  Moon,
  Sun,
  Flame,
  Instagram,
  Facebook,
  Mail,
  CreditCard,
  Copy,
  Check,
  QrCode,
  MapPin,
  User,
  Phone,
  FileText,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { extractPixFromFruitfyPayload, pickOrderUuidForApi } from "./pixExtract";
import { mergeUrlParamsFromLocation, toFruitfyUtmPayload } from "./urlParams";

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const centsFromBRL = (value: number) => Math.round(value * 100);

const formatCep = (digits: string) => {
  const d = digits.slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

const formatCpf = (digits: string) => {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const formatPhoneBr = (digits: string) => {
  const d = digits.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length === 0) return `(${ddd}) `;
  if (d.length <= 6) return `(${ddd}) ${rest}`;
  if (d.length <= 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
};

const inputMaskedClass =
  "w-full px-4 py-3 rounded-xl border border-[#E8F4FA] bg-[#F8FCFE] focus:outline-none focus:border-[#2AADE4] focus:ring-2 focus:ring-[#2AADE4]/15 transition-all text-sm tabular-nums tracking-wide text-[#0F3D5C] placeholder:text-[#9BB8C8]";

const ORDER_BUMPS = [
  {
    id: "pdrn",
    name: "PDRN - Zencial",
    price: 34.9,
    image: "/orderbump-pdrn.png",
    description:
      "Acrescente o PDRN e intensifique sua rotina anti-idade com regeneração avançada, mais firmeza, hidratação e redução visível de rugas.",
  },
  {
    id: "envy-hair",
    name: "Envy Hair",
    price: 29.9,
    image: "/orderbump-envy-hair.png",
    description:
      "Fortaleça seus fios! O Envy Hair é um sérum capilar desenvolvido para fortalecer, estimular o crescimento saudável, reduzir a quebra e deixar os cabelos mais fortes, brilhantes e revitalizados.",
  },
] as const;

// --- Checkout Components ---

const CheckoutHeader = () => (
  <header className="bg-white py-4 border-b border-[#E8F4FA] sticky top-0 z-50">
    <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
      <div className="h-6">
        <img 
          src="https://i.ibb.co/Kcb9fST2/image.png" 
          alt="Zencial Logo" 
          className="h-full w-auto object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="flex items-center gap-2 text-[#0F3D5C] font-bold text-sm uppercase tracking-wider">
        <ShieldCheck size={18} className="text-[#2AADE4]" />
        Checkout Seguro
      </div>
    </div>
  </header>
);

const Checkout = ({ kit, onBack, onFinish }: { kit: any, onBack: () => void, onFinish: (data: any) => Promise<void> }) => {
  const [step, setStep] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [shipping, setShipping] = useState<'free' | 'sedex'>('free');
  const [cepLoading, setCepLoading] = useState(false);
  const [address, setAddress] = useState({
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedBumps, setSelectedBumps] = useState<Record<string, boolean>>({});

  const toggleOrderBump = (id: string) => {
    setSelectedBumps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCepChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const digits = onlyDigits(e.target.value).slice(0, 8);
    const formatted = formatCep(digits);
    setAddress((prev) => ({ ...prev, cep: formatted }));

    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setAddress((prev) => ({
            ...prev,
            cep: formatted,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
          }));
        }
      } catch (error) {
        console.error("Erro ao buscar CEP", error);
      } finally {
        setCepLoading(false);
      }
    }
  };

  const cepDigits = onlyDigits(address.cep);

  const subtotal = kit.price * quantity;
  const activeOrderBumps = ORDER_BUMPS.filter((bump) => selectedBumps[bump.id]);
  const orderBumpPrice = activeOrderBumps.reduce((sum, bump) => sum + bump.price, 0);
  const shippingPrice = shipping === 'sedex' ? 19.45 : 0;
  const total = subtotal + orderBumpPrice + shippingPrice;
  
  const handleSubmitOrder = async () => {
    setSubmitError(null);
    const requiredFieldsFilled =
      customer.name.trim() &&
      customer.email.trim() &&
      customer.cpf.trim() &&
      customer.phone.trim();

    if (!requiredFieldsFilled) {
      setSubmitError("Preencha nome, e-mail, CPF e telefone para continuar.");
      return;
    }

    setSubmitting(true);
    try {
      await onFinish({
        total,
        customer,
        address,
        shipping,
        quantity,
        orderBumps: activeOrderBumps,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível gerar o PIX.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FCFE] pb-20">
      <CheckoutHeader />
      
      <main className="max-w-5xl mx-auto px-4 py-8">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#5A8FA6] text-sm mb-8 hover:text-[#2AADE4] transition-colors"
        >
          <ChevronLeft size={16} />
          Voltar para a loja
        </button>

        <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
          {/* Form Section */}
          <div className="space-y-6">
            {/* Dados Pessoais */}
            <section className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E8F4FA] shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-[#E8F4FA] pb-4">
                <div className="w-10 h-10 bg-[#E8F4FA] rounded-full flex items-center justify-center text-[#2AADE4]">
                  <User size={20} />
                </div>
                <h2 className="text-lg font-bold text-[#0F3D5C]">Dados Pessoais</h2>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F3D5C] uppercase tracking-wider">Nome Completo</label>
                  <input 
                    type="text" 
                    placeholder="Seu nome completo"
                    className="w-full px-4 py-3 rounded-xl border border-[#E8F4FA] bg-[#F8FCFE] focus:outline-none focus:border-[#2AADE4] transition-colors text-sm"
                    value={customer.name}
                    onChange={e => setCustomer({...customer, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F3D5C] uppercase tracking-wider">E-mail</label>
                  <input 
                    type="email" 
                    placeholder="seu@email.com"
                    className="w-full px-4 py-3 rounded-xl border border-[#E8F4FA] bg-[#F8FCFE] focus:outline-none focus:border-[#2AADE4] transition-colors text-sm"
                    value={customer.email}
                    onChange={e => setCustomer({...customer, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F3D5C] uppercase tracking-wider">CPF</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={inputMaskedClass}
                    value={customer.cpf}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        cpf: formatCpf(onlyDigits(e.target.value)),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F3D5C] uppercase tracking-wider">Celular / WhatsApp</label>
                  <input 
                    type="tel" 
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className={inputMaskedClass}
                    value={customer.phone}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        phone: formatPhoneBr(onlyDigits(e.target.value)),
                      })
                    }
                  />
                </div>
              </div>
            </section>

            {/* Entrega */}
            <section className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E8F4FA] shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-[#E8F4FA] pb-4">
                <div className="w-10 h-10 bg-[#E8F4FA] rounded-full flex items-center justify-center text-[#2AADE4]">
                  <MapPin size={20} />
                </div>
                <h2 className="text-lg font-bold text-[#0F3D5C]">Dados de Entrega</h2>
              </div>
              
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F3D5C] uppercase tracking-wider">CEP</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="00000-000"
                      maxLength={9}
                      className={inputMaskedClass}
                      value={address.cep}
                      onChange={handleCepChange}
                    />
                    {cepLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#2AADE4] border-t-transparent rounded-full animate-spin"></div>}
                  </div>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-[#0F3D5C] uppercase tracking-wider">Endereço</label>
                  <input 
                    type="text" 
                    placeholder="Rua, Avenida..."
                    className="w-full px-4 py-3 rounded-xl border border-[#E8F4FA] bg-[#F8FCFE] focus:outline-none focus:border-[#2AADE4] transition-colors text-sm"
                    value={address.street}
                    onChange={e => setAddress({...address, street: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F3D5C] uppercase tracking-wider">Número</label>
                  <input 
                    type="text" 
                    placeholder="123"
                    className="w-full px-4 py-3 rounded-xl border border-[#E8F4FA] bg-[#F8FCFE] focus:outline-none focus:border-[#2AADE4] transition-colors text-sm"
                    value={address.number}
                    onChange={e => setAddress({...address, number: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F3D5C] uppercase tracking-wider">Complemento</label>
                  <input 
                    type="text" 
                    placeholder="Apto, Bloco..."
                    className="w-full px-4 py-3 rounded-xl border border-[#E8F4FA] bg-[#F8FCFE] focus:outline-none focus:border-[#2AADE4] transition-colors text-sm"
                    value={address.complement}
                    onChange={e => setAddress({...address, complement: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F3D5C] uppercase tracking-wider">Bairro</label>
                  <input 
                    type="text" 
                    placeholder="Bairro"
                    className="w-full px-4 py-3 rounded-xl border border-[#E8F4FA] bg-[#F8FCFE] focus:outline-none focus:border-[#2AADE4] transition-colors text-sm"
                    value={address.neighborhood}
                    onChange={e => setAddress({...address, neighborhood: e.target.value})}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-[#0F3D5C] uppercase tracking-wider">Cidade</label>
                  <input 
                    type="text" 
                    placeholder="Cidade"
                    className="w-full px-4 py-3 rounded-xl border border-[#E8F4FA] bg-[#F8FCFE] focus:outline-none focus:border-[#2AADE4] transition-colors text-sm"
                    value={address.city}
                    onChange={e => setAddress({...address, city: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F3D5C] uppercase tracking-wider">Estado</label>
                  <input 
                    type="text" 
                    placeholder="UF"
                    className="w-full px-4 py-3 rounded-xl border border-[#E8F4FA] bg-[#F8FCFE] focus:outline-none focus:border-[#2AADE4] transition-colors text-sm"
                    value={address.state}
                    onChange={e => setAddress({...address, state: e.target.value})}
                  />
                </div>
              </div>

              {cepDigits.length === 8 && (
                <div className="space-y-4 pt-4 border-t border-[#E8F4FA]">
                  <label className="text-xs font-bold text-[#0F3D5C] uppercase tracking-wider">Escolha o Frete</label>
                  <div className="grid gap-3">
                    <button 
                      onClick={() => setShipping('free')}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${shipping === 'free' ? 'border-[#2AADE4] bg-[#E8F4FA]' : 'border-[#E8F4FA] hover:border-[#C5DFEC]'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${shipping === 'free' ? 'border-[#2AADE4]' : 'border-[#5A8FA6]'}`}>
                          {shipping === 'free' && <div className="w-2.5 h-2.5 bg-[#2AADE4] rounded-full" />}
                        </div>
                        <div>
                          <p className="font-bold text-[#0F3D5C] text-sm">Frete Grátis</p>
                          <p className="text-xs text-[#5A8FA6]">7 a 10 dias úteis</p>
                        </div>
                      </div>
                      <span className="font-bold text-[#2AADE4] text-sm">Grátis</span>
                    </button>
                    <button 
                      onClick={() => setShipping('sedex')}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${shipping === 'sedex' ? 'border-[#2AADE4] bg-[#E8F4FA]' : 'border-[#E8F4FA] hover:border-[#C5DFEC]'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${shipping === 'sedex' ? 'border-[#2AADE4]' : 'border-[#5A8FA6]'}`}>
                          {shipping === 'sedex' && <div className="w-2.5 h-2.5 bg-[#2AADE4] rounded-full" />}
                        </div>
                        <div>
                          <p className="font-bold text-[#0F3D5C] text-sm">SEDEX Express</p>
                          <p className="text-xs text-[#5A8FA6]">2 a 3 dias úteis</p>
                        </div>
                      </div>
                      <span className="font-bold text-[#0F3D5C] text-sm">R$ 19,45</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Order Bumps */}
            <section className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-dashed border-[#2AADE4] shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-[#2AADE4] text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                  Ofertas exclusivas
                </span>
              </div>
              <div className="space-y-3">
                {ORDER_BUMPS.map((bump) => {
                  const isSelected = !!selectedBumps[bump.id];
                  return (
                    <button
                      key={bump.id}
                      type="button"
                      onClick={() => toggleOrderBump(bump.id)}
                      className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                        isSelected
                          ? "border-[#2AADE4] bg-[#E8F4FA]"
                          : "border-[#E8F4FA] hover:border-[#2AADE4]/40"
                      }`}
                    >
                      <div className="flex gap-4">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#E8F4FA] rounded-xl overflow-hidden flex-shrink-0">
                          <img
                            src={bump.image}
                            alt={bump.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-[#0F3D5C] text-sm sm:text-base leading-tight">
                              {bump.name}
                            </h3>
                            <p className="font-black text-[#2AADE4] text-sm sm:text-base whitespace-nowrap">
                              R$ {bump.price.toFixed(2).replace(".", ",")}
                            </p>
                          </div>
                          <p className="text-xs sm:text-sm text-[#5A8FA6] leading-relaxed">
                            {bump.description}
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <div
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected
                                  ? "border-[#2AADE4] bg-[#2AADE4] text-white"
                                  : "border-[#C5DFEC] bg-white"
                              }`}
                            >
                              {isSelected && <Check size={14} strokeWidth={3} />}
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-[#0F3D5C]">
                              Sim, quero adicionar esta oferta!
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Pagamento */}
            <section className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E8F4FA] shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-[#E8F4FA] pb-4">
                <div className="w-10 h-10 bg-[#E8F4FA] rounded-full flex items-center justify-center text-[#2AADE4]">
                  <Zap size={20} />
                </div>
                <h2 className="text-lg font-bold text-[#0F3D5C]">Pagamento</h2>
              </div>
              
              <div className="p-4 rounded-2xl border-2 border-[#2AADE4] bg-[#E8F4FA] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#2AADE4] shadow-sm">
                    <Zap size={20} fill="currentColor" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0F3D5C] text-sm">PIX</p>
                    <p className="text-xs text-[#5A8FA6]">Aprovação imediata</p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-[#5A8FA6] text-center italic">
                O código PIX será gerado após a finalização do pedido.
              </p>
            </section>
          </div>

          {/* Summary Section */}
          <div className="lg:sticky lg:top-28 space-y-6">
            <section className="bg-white p-6 rounded-3xl border border-[#E8F4FA] shadow-lg space-y-6">
              <h2 className="text-lg font-bold text-[#0F3D5C] border-b border-[#E8F4FA] pb-4">Resumo do Pedido</h2>
              
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-[#E8F4FA] rounded-xl overflow-hidden flex-shrink-0 border border-[#E8F4FA]">
                  <img src={kit.image} alt={kit.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-bold text-[#0F3D5C] text-sm leading-tight">{kit.name}</h3>
                  <p className="text-xs text-[#5A8FA6]">Sérum GHK-CU · Peptídeos de Cobre, Colágeno e Ácido Hialurônico</p>
                  
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center border border-[#E8F4FA] rounded-lg overflow-hidden">
                      <button 
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-2 py-1 hover:bg-[#E8F4FA] text-[#2AADE4] transition-colors"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <span className="px-3 py-1 text-xs font-bold text-[#0F3D5C] border-x border-[#E8F4FA] min-w-[32px] text-center">
                        {quantity}
                      </span>
                      <button 
                        onClick={() => setQuantity(quantity + 1)}
                        className="px-2 py-1 hover:bg-[#E8F4FA] text-[#2AADE4] transition-colors"
                      >
                        <ChevronUp size={14} />
                      </button>
                    </div>
                    <p className="font-bold text-[#0F3D5C] text-sm">R$ {subtotal.toFixed(2).replace('.', ',')}</p>
                  </div>
                </div>
              </div>

              {activeOrderBumps.map((bump) => (
                <div key={bump.id} className="flex gap-4 pt-2 border-t border-[#E8F4FA]">
                  <div className="w-20 h-20 bg-[#E8F4FA] rounded-xl overflow-hidden flex-shrink-0 border border-[#E8F4FA]">
                    <img src={bump.image} alt={bump.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h3 className="font-bold text-[#0F3D5C] text-sm leading-tight">{bump.name}</h3>
                    <p className="text-xs text-[#5A8FA6]">Oferta adicional</p>
                    <p className="font-bold text-[#0F3D5C] text-sm pt-2">
                      R$ {bump.price.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
              ))}

              <div className="space-y-3 pt-4 border-t border-[#E8F4FA]">
                <div className="flex justify-between text-sm">
                  <span className="text-[#5A8FA6]">Subtotal</span>
                  <span className="text-[#0F3D5C] font-medium">R$ {(subtotal + orderBumpPrice).toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#5A8FA6]">Frete</span>
                  <span className="text-[#2AADE4] font-bold">{shippingPrice > 0 ? `R$ ${shippingPrice.toFixed(2).replace('.', ',')}` : 'GRÁTIS'}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-[#E8F4FA]">
                  <span className="font-bold text-[#0F3D5C]">Total</span>
                  <div className="text-right">
                    <p className="text-2xl font-black text-[#0F3D5C]">R$ {total.toFixed(2).replace('.', ',')}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={submitting}
                className="w-full py-4 bg-[#2AADE4] text-white rounded-full font-bold hover:bg-[#155A7A] transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 group"
              >
                {submitting ? "GERANDO PIX..." : "FINALIZAR PEDIDO"}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              {submitError && (
                <p className="text-xs text-red-500 text-center">{submitError}</p>
              )}

              <div className="flex items-center justify-center gap-4 pt-4 opacity-50 grayscale">
                <div className="flex items-center gap-1 text-[10px] font-bold text-[#0F3D5C]">
                  <ShieldCheck size={12} />
                  COMPRA SEGURA
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

const POST_PIX_PAID_REDIRECT_DEFAULT = "https://rastreiogummy.netlify.app/";
const POST_PIX_POLL_MS = 200;

const PixSuccess = ({ orderData, onReset }: { orderData: any, onReset: () => void }) => {
  const [copied, setCopied] = useState(false);
  const pixCode = orderData.pixCode;
  const qrCodeImage = orderData.qrCodeImage;
  const orderUuid =
    (typeof orderData.orderId === "string" && orderData.orderId) ||
    pickOrderUuidForApi(orderData.gatewayPayload);

  useEffect(() => {
    const redirectUrl =
      (import.meta.env.VITE_PIX_PAID_REDIRECT_URL as string | undefined)?.trim() ||
      POST_PIX_PAID_REDIRECT_DEFAULT;
    if (!orderUuid) return;

    let cancelled = false;
    let inFlight = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const started = Date.now();
    const maxMs = 2 * 60 * 60 * 1000;
    const terminalFail = new Set([
      "canceled",
      "cancelled",
      "refused",
      "failed",
      "refunded",
      "chargeback",
    ]);

    const stop = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const tick = async () => {
      if (cancelled || inFlight) return;
      if (Date.now() - started > maxMs) {
        stop();
        return;
      }
      inFlight = true;
      try {
        const r = await fetch(`/api/order/${encodeURIComponent(orderUuid)}`);
        const j = await r.json();
        if (cancelled) return;
        const status = typeof j?.data?.status === "string" ? j.data.status : "";
        if (status === "paid") {
          stop();
          window.location.replace(redirectUrl);
          return;
        }
        if (terminalFail.has(status)) stop();
      } catch {
        /* próximo ciclo */
      } finally {
        inFlight = false;
      }
    };

    intervalId = setInterval(tick, POST_PIX_POLL_MS);
    void tick();

    return () => {
      cancelled = true;
      stop();
    };
  }, [orderUuid]);

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F8FCFE] pb-20">
      <CheckoutHeader />
      
      <main className="max-w-2xl mx-auto px-4 py-12 text-center space-y-8">
        <div className="space-y-4">
          <div className="w-20 h-20 bg-[#E8F4FA] rounded-full flex items-center justify-center text-[#2AADE4] mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F3D5C]">Pedido Realizado com Sucesso!</h1>
          <p className="text-[#5A8FA6] max-w-md mx-auto">
            Falta pouco! Realize o pagamento via PIX para que possamos enviar seu Sérum GHK-CU o quanto antes.
          </p>
          {orderUuid ? (
            <p className="text-xs text-[#2AADE4] font-medium max-w-md mx-auto">
              Aguardando confirmação do pagamento… você será redirecionado assim que o PIX for aprovado.
            </p>
          ) : (
            <p className="text-xs text-amber-700/90 max-w-md mx-auto">
              Não foi possível identificar o pedido para acompanhamento automático. Após pagar, guarde o comprovante.
            </p>
          )}
        </div>

        <div className="bg-white p-8 rounded-3xl border border-[#E8F4FA] shadow-xl space-y-8">
          <div className="space-y-2">
            <p className="text-xs font-bold text-[#5A8FA6] uppercase tracking-widest">Valor a pagar</p>
            <p className="text-4xl font-black text-[#0F3D5C]">R$ {orderData.total.toFixed(2).replace('.', ',')}</p>
          </div>

          <div className="bg-[#E8F4FA] p-6 rounded-2xl inline-block border-2 border-[#C5DFEC]">
            {qrCodeImage ? (
              <img
                src={qrCodeImage.startsWith("data:") ? qrCodeImage : `data:image/png;base64,${qrCodeImage}`}
                alt="QR Code PIX"
                className="w-[180px] h-[180px] object-contain"
              />
            ) : (
              <QrCode size={180} className="text-[#0F3D5C]" />
            )}
          </div>

          <div className="space-y-4">
            <p className="text-sm font-bold text-[#0F3D5C]">Código PIX Copia e Cola</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text" 
                readOnly 
                value={pixCode}
                className="flex-1 bg-[#F8FCFE] border border-[#E8F4FA] rounded-xl px-4 py-3 text-xs text-[#5A8FA6] truncate"
              />
              <button 
                onClick={handleCopy}
                className="w-full sm:w-auto bg-[#2AADE4] text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#155A7A] transition-all"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 text-left max-w-md mx-auto">
          <h3 className="font-bold text-[#0F3D5C] flex items-center gap-2">
            <Clock size={18} className="text-[#2AADE4]" />
            Como pagar?
          </h3>
          <ol className="space-y-3 text-sm text-[#5A8FA6]">
            <li className="flex gap-3">
              <span className="w-5 h-5 bg-[#E8F4FA] rounded-full flex items-center justify-center text-[10px] font-bold text-[#2AADE4] flex-shrink-0">1</span>
              Abra o app do seu banco e escolha a opção PIX.
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 bg-[#E8F4FA] rounded-full flex items-center justify-center text-[10px] font-bold text-[#2AADE4] flex-shrink-0">2</span>
              Escaneie o QR Code ou cole o código acima.
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 bg-[#E8F4FA] rounded-full flex items-center justify-center text-[10px] font-bold text-[#2AADE4] flex-shrink-0">3</span>
              Confirme os dados e finalize o pagamento.
            </li>
          </ol>
        </div>

        <button 
          onClick={onReset}
          className="text-[#5A8FA6] text-sm font-medium hover:text-[#2AADE4] transition-colors pt-8"
        >
          Voltar para a página inicial
        </button>
      </main>
    </div>
  );
};


const AnnouncementBar = () => (
  <div className="bg-[#E8F4FA] text-[#2AADE4] text-[10px] py-2 px-4 text-center font-medium tracking-wider uppercase border-b border-[#C5DFEC]">
    FRETE GRÁTIS PARA TODO O BRASIL
  </div>
);

const Header = ({ cartCount }: { cartCount: number }) => {
  return (
    <header className="bg-white py-3 sm:py-4 border-b border-[#E8F4FA] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
        <button className="text-[#5A8FA6] p-1">
          <Menu size={24} sm:size={28} strokeWidth={1.5} />
        </button>
        
        <div className="h-8 sm:h-10">
          <img 
            src="https://i.ibb.co/Kcb9fST2/image.png" 
            alt="Zencial Logo" 
            className="h-full w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button className="text-[#5A8FA6] p-1">
            <Search size={20} sm:size={24} strokeWidth={1.5} />
          </button>
          <button className="relative text-[#5A8FA6] p-1">
            <ShoppingBag size={20} sm:size={24} strokeWidth={1.5} />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 bg-[#2AADE4] text-white text-[8px] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

const DarkHero = () => (
  <section className="bg-[#155A7A] text-white py-12 sm:py-16 px-4 sm:px-6 text-center space-y-6 sm:space-y-8">
    <div className="flex items-center justify-center gap-4 sm:gap-8 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-80 pb-4 border-b border-white/10">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" />
        Regeneração Celular
      </div>
      <div className="flex items-center gap-2">
        <Sun size={12} sm:size={14} />
        Peptídeo Biomimético
      </div>
    </div>

    <div className="relative max-w-4xl mx-auto rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
      <img 
        src="/ghk-cu-dark-hero.png" 
        alt="Tratamento avançado com GHK-CU — estimula colágeno, reduz rugas, hidrata e regenera a pele" 
        className="w-full h-auto object-contain"
      />
    </div>

    <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
      Renove sua pele, <br />
      noite após noite.
    </h2>

    <p className="text-sm leading-relaxed text-[#E8F4FA] text-center max-w-md mx-auto px-2">
      O <strong>Sérum GHK-CU Zencial</strong> combina <strong>peptídeos de cobre GHK-Cu</strong>, 
      <strong> ácido hialurônico</strong> e <strong>colágeno hidrolisado</strong> — uma fórmula com 
      peptídeo biomimético de ação regenerativa e antissinais que favorece colágeno, elastina e 
      uma aparência mais firme, luminosa e regenerada.
    </p>

    <div className="pt-2 sm:pt-4">
      <button 
        onClick={() => document.getElementById('kits')?.scrollIntoView({ behavior: 'smooth' })}
        className="w-full sm:w-auto bg-white text-[#0F3D5C] px-6 sm:px-10 py-4 sm:py-5 rounded-full font-bold text-xs sm:text-sm shadow-xl active:scale-95 transition-transform"
      >
        Quero uma pele mais firme e rejuvenescida!
      </button>
    </div>
  </section>
);

const SkinIssuesCarousel = () => {
  const issues = [
    { title: "Rugas e linhas finas", img: "https://i.ibb.co/27tLYkFL/image.png" },
    { title: "Flacidez facial", img: "https://i.ibb.co/yB6x2v8Q/image.png" },
    { title: "Pele opaca", img: "https://i.ibb.co/LdrPYnbq/image.png" },
    { title: "Ressecamento", img: "https://i.ibb.co/BVFMcVGc/image.png" },
    { title: "Perda de elasticidade", img: "https://i.ibb.co/x86pGBJ5/image.png" },
  ];

  // Double the array for infinite effect
  const doubledIssues = [...issues, ...issues];
  const itemWidth = 160;
  const gap = 16;
  const totalDistance = (itemWidth + gap) * issues.length;

  return (
    <section className="bg-[#155A7A] pb-12 overflow-hidden">
      <motion.div 
        className="flex gap-4 px-6"
        animate={{
          x: [0, -totalDistance],
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 20,
            ease: "linear",
          },
        }}
        style={{ width: "max-content" }}
      >
        {doubledIssues.map((issue, i) => (
          <div key={i} style={{ width: `${itemWidth}px` }} className="bg-white rounded-xl p-1.5 shadow-lg">
            <div className="aspect-square rounded-lg overflow-hidden mb-2">
              <img src={issue.img} alt={issue.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <p className="font-bold text-[#0F3D5C] text-[11px] leading-tight px-1 pb-1 text-center">{issue.title}</p>
          </div>
        ))}
      </motion.div>
    </section>
  );
};

const LandingHero = () => (
  <section className="relative min-h-[80vh] sm:min-h-[90vh] flex items-center pt-12 sm:pt-20 pb-20 sm:pb-32 overflow-hidden bg-white">
    {/* Decorative elements */}
    <div className="absolute top-0 right-0 w-1/2 h-full bg-[#E8F4FA] -z-10 rounded-l-[100px] hidden lg:block"></div>
    <div className="absolute top-20 right-20 w-64 h-64 bg-[#2AADE4]/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
    
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="space-y-8 sm:space-y-12 text-center"
      >
        <div className="space-y-6 sm:space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#E8F4FA] rounded-full text-[10px] sm:text-xs font-bold text-[#2AADE4] uppercase tracking-widest mx-auto">
            <Sparkles size={14} /> GHK-Cu · Lançamento Zencial
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-[#0F3D5C] leading-[1.1] tracking-tight">
            Sua pele firme, <br />
            <span className="text-[#2AADE4]">luminosa</span> <br className="hidden sm:block" />
            e regenerada.
          </h1>
        </div>

        {/* Image moved below title */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative max-w-4xl mx-auto px-4 sm:px-0"
        >
          <div className="relative z-10 rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-[0_30px_60px_-15px_rgba(42,173,228,0.25)]">
            <img 
              src="/ghk-cu-hero.png" 
              alt="Sérum GHK-CU Zencial — Peptídeos de Cobre, Colágeno e Ácido Hialurônico" 
              className="w-full h-auto object-contain"
            />
          </div>
        </motion.div>
        
        <div className="space-y-8 sm:space-y-10">
          <p className="text-lg sm:text-xl text-[#5A8FA6] max-w-2xl leading-relaxed mx-auto">
            Peptídeo biomimético de cobre com ação regenerativa e antissinais. Favorece a síntese de colágeno e elastina, melhora a hidratação profunda e promove renovação cutânea progressiva com uso contínuo.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => {
                document.getElementById('kits')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-[#2AADE4] text-white px-8 sm:px-10 py-5 sm:py-6 rounded-full font-bold text-base sm:text-lg shadow-2xl shadow-blue-200 hover:bg-[#155A7A] transition-all transform hover:scale-105 flex items-center justify-center gap-3 group mx-auto sm:mx-0"
            >
              QUERO MINHA TRANSFORMAÇÃO
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-6 sm:pt-8 border-t border-[#E8F4FA] max-w-lg mx-auto">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white overflow-hidden bg-gray-100">
                  <img src={`https://randomuser.me/api/portraits/women/${i + 10}.jpg`} alt="User" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex justify-center sm:justify-start text-[#2AADE4]">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" stroke="none" />)}
              </div>
              <p className="text-[10px] sm:text-xs text-[#5A8FA6] font-medium">+15.000 pessoas com pele transformada</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

const Benefits = () => (
  <section id="beneficios" className="py-12 sm:py-20 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16 space-y-3 sm:space-y-4">
        <h2 className="text-2xl sm:text-4xl font-bold text-[#0F3D5C] tracking-tight">
          O que o Sérum GHK-CU faz por você?
        </h2>
        <p className="text-sm sm:text-base text-[#5A8FA6]">
          Uma fórmula anti-idade desenvolvida para tratar os sinais visíveis do envelhecimento de forma completa e contínua.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {[
          { icon: <Sparkles />, title: "Reduz Rugas", desc: "Diminui a aparência de linhas finas e rugas com o uso diário contínuo." },
          { icon: <Droplets />, title: "Hidratação Profunda", desc: "O ácido hialurônico atrai e retém água na pele, promovendo maciez, conforto e viço desde os primeiros dias." },
          { icon: <Zap />, title: "Firmeza & Elasticidade", desc: "Estimula a produção natural de colágeno e elastina para uma pele mais tonificada." },
          { icon: <CheckCircle2 />, title: "Pele Luminosa", desc: "Uniformiza o aspecto da pele, melhora a textura e aumenta o viço natural." },
        ].map((benefit, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="p-6 sm:p-8 rounded-2xl border border-[#E8F4FA] hover:border-[#2AADE4]/20 hover:shadow-xl transition-all group"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#E8F4FA] rounded-xl flex items-center justify-center text-[#2AADE4] mb-4 sm:mb-6 group-hover:bg-[#2AADE4] group-hover:text-white transition-colors">
              {benefit.icon}
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[#0F3D5C] mb-2 sm:mb-3">{benefit.title}</h3>
            <p className="text-[#5A8FA6] leading-relaxed text-xs sm:text-sm">{benefit.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const Technology = () => (
  <section id="tecnologia" className="py-12 sm:py-20 bg-[#155A7A] text-white overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 sm:gap-16 items-center">
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="space-y-6 sm:space-y-8 text-center lg:text-left"
      >
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold leading-tight">
            Sinalização biológica <br />
            <span className="text-[#A8D4E8]">que reativa a qualidade da pele.</span>
          </h2>
          <p className="text-[#E8F4FA]/80 text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
            O GHK-Cu atua como peptídeo biomimético, favorecendo fibroblastos, colágeno, elasticidade 
            e renovação visível. O ácido hialurônico e o colágeno hidrolisado complementam a fórmula 
            com hidratação profunda e suporte estrutural.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 text-left max-w-md mx-auto lg:mx-0">
          {[
            "GHK-Cu (Tripeptídeo de Cobre) — ação regenerativa e antissinais",
            "Ácido Hialurônico — hidratação profunda e retenção de água",
            "Colágeno Hidrolisado — suporte à firmeza e textura da pele",
            "Resultados progressivos com uso contínuo diário"
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 sm:gap-4">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={12} sm:size={14} className="text-white" />
              </div>
              <span className="text-sm sm:text-base font-medium text-[#E8F4FA]">{item}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="relative px-4 sm:px-0"
      >
        <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10">
          <img 
            src="/ghk-cu-tecnologia.png" 
            alt="GHK-Cu — efeito imediato no tratamento de rugas com peptídeo de cobre, colágeno e ácido hialurônico" 
            className="w-full h-auto object-contain"
          />
        </div>
      </motion.div>
    </div>
  </section>
);

const Ingredients = () => (
  <section id="ingredientes" className="py-12 sm:py-20 bg-[#E8F4FA]/30">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16 space-y-3 sm:space-y-4">
        <h2 className="text-2xl sm:text-4xl font-bold text-[#0F3D5C] tracking-tight">
          Uma fórmula estruturada para diferentes necessidades da pele
        </h2>
        <p className="text-sm sm:text-base text-[#5A8FA6]">
          GHK-Cu (Tripeptídeo de Cobre), Ácido Hialurônico e Colágeno Hidrolisado em sinergia.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {[
          { name: "GHK-Cu (Tripeptídeo de Cobre)", desc: "Peptídeo biomimético associado ao cobre. Favorece fibroblastos, colágeno e elastina. Eixo de renovação, firmeza aparente e vitalidade progressiva da pele." },
          { name: "Ácido Hialurônico", desc: "Atrai e retém água na pele, contribuindo para hidratação adequada, conforto cutâneo e aparência visualmente mais preenchida, macia e com viço." },
          { name: "Colágeno Hidrolisado", desc: "Proteína estrutural ligada à sustentação e firmeza. Auxilia na textura, no toque e na percepção de pele mais uniforme e bem cuidada." },
        ].map((item, i) => (
          <div key={i} className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E8F4FA] hover:shadow-lg transition-all">
            <h4 className="text-base sm:text-lg font-bold text-[#2AADE4] mb-2">{item.name}</h4>
            <p className="text-xs sm:text-sm text-[#5A8FA6] leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const KitBenefits = ({ items }: { items: string[] }) => (
  <ul className="w-full space-y-2.5 text-left px-1">
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#5A8FA6] leading-snug">
        <CheckCircle2 size={16} className="text-[#2AADE4] flex-shrink-0 mt-0.5" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const Kits = ({ onAddToCart }: { onAddToCart: (kit: any) => void }) => (
  <section id="kits" className="py-12 sm:py-20 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-10 sm:mb-16 space-y-3 sm:space-y-4">
        <h2 className="text-2xl sm:text-4xl font-bold text-[#0F3D5C] tracking-tight">
          Escolha seu Kit e Comece sua Transformação
        </h2>
        <p className="text-sm sm:text-base text-[#5A8FA6]">Economize comprando os kits de tratamento anti-idade completo.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12 lg:gap-8 items-center">
        {/* Kit 1 */}
        <div className="border border-[#E8F4FA] rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center space-y-6 hover:shadow-xl transition-all">
          <p className="text-[10px] font-bold text-[#5A8FA6] uppercase tracking-widest">Tratamento 1 Mês</p>
          <div className="w-40 h-40 sm:w-48 sm:h-48 bg-[#E8F4FA] rounded-2xl overflow-hidden">
            <img src="/kit-1-unidade.png" alt="Kit 1 Unidade GHK-Cu Zencial" className="w-full h-full object-contain" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-[#0F3D5C]">1 Unidade</h3>
          <div className="space-y-1">
            <p className="text-[#5A8FA6] line-through text-xs sm:text-sm">R$ 79,80</p>
            <p className="text-3xl sm:text-4xl font-bold text-[#0F3D5C]">R$ 39,90</p>
          </div>
          <KitBenefits items={[
            "Ideal para conhecer a fórmula GHK-Cu",
            "Hidratação profunda desde os primeiros dias",
            "Frete grátis para todo o Brasil",
          ]} />
          <button onClick={() => onAddToCart({ id: 1, name: "1 Unidade", price: 39.90, image: "/kit-1-unidade.png" })} className="w-full py-4 bg-[#E8F4FA] text-[#2AADE4] rounded-full font-bold hover:bg-[#2AADE4] hover:text-white transition-all text-sm sm:text-base">
            COMPRAR AGORA
          </button>
        </div>

        {/* Kit 2 - Popular */}
        <div className="border-2 border-[#2AADE4] rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center space-y-6 shadow-2xl relative sm:transform sm:scale-105 bg-white z-10">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#2AADE4] text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
            Mais Vendido
          </div>
          <p className="text-[10px] font-bold text-[#0F3D5C] uppercase tracking-widest">Tratamento 2 Meses</p>
          <div className="w-40 h-40 sm:w-48 sm:h-48 bg-[#E8F4FA] rounded-2xl overflow-hidden">
            <img src="/kit-2-unidades.png" alt="Kit 2 Unidades GHK-Cu Zencial" className="w-full h-full object-contain" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-[#0F3D5C]">2 Unidades</h3>
          <div className="space-y-1">
            <p className="text-[#5A8FA6] line-through text-xs sm:text-sm">R$ 139,80</p>
            <p className="text-3xl sm:text-4xl font-bold text-[#0F3D5C]">R$ 69,90</p>
            <p className="text-xs sm:text-sm text-[#2AADE4] font-bold">Economia de R$ 69,90</p>
          </div>
          <KitBenefits items={[
            "2 meses de tratamento contínuo",
            "Firmeza, elasticidade e textura em evolução",
            "Melhor custo-benefício para resultados visíveis",
          ]} />
          <button onClick={() => onAddToCart({ id: 2, name: "2 Unidades", price: 69.90, image: "/kit-2-unidades.png" })} className="w-full py-4 bg-[#2AADE4] text-white rounded-full font-bold hover:bg-[#155A7A] transition-all shadow-lg shadow-blue-200 text-sm sm:text-base">
            APROVEITAR OFERTA
          </button>
        </div>

        {/* Kit 3 */}
        <div className="border border-[#E8F4FA] rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center space-y-6 hover:shadow-xl transition-all">
          <p className="text-[10px] font-bold text-[#5A8FA6] uppercase tracking-widest">Tratamento 3 Meses</p>
          <div className="w-40 h-40 sm:w-48 sm:h-48 bg-[#E8F4FA] rounded-2xl overflow-hidden">
            <img src="/kit-3-unidades.png" alt="Kit 3 Unidades GHK-Cu Zencial" className="w-full h-full object-contain" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-[#0F3D5C]">3 Unidades</h3>
          <div className="space-y-1">
            <p className="text-[#5A8FA6] line-through text-xs sm:text-sm">R$ 199,80</p>
            <p className="text-3xl sm:text-4xl font-bold text-[#0F3D5C]">R$ 99,90</p>
            <p className="text-xs sm:text-sm text-[#2AADE4] font-bold">50% de Desconto</p>
          </div>
          <KitBenefits items={[
            "Protocolo completo de 3 meses",
            "Renovação cutânea e luminosidade progressiva",
            "Máxima economia para manutenção da rotina",
          ]} />
          <button onClick={() => onAddToCart({ id: 3, name: "3 Unidades", price: 99.90, image: "/kit-3-unidades.png" })} className="w-full py-4 bg-[#E8F4FA] text-[#2AADE4] rounded-full font-bold hover:bg-[#2AADE4] hover:text-white transition-all text-sm sm:text-base">
            COMPRAR AGORA
          </button>
        </div>
      </div>
    </div>
  </section>
);

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-12 sm:py-20 bg-[#E8F4FA]/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-4xl font-bold text-[#0F3D5C] text-center mb-10 sm:mb-16 tracking-tight">
          Dúvidas Frequentes
        </h2>
        
        <div className="space-y-3 sm:space-y-4">
          {[
            { q: "Em quanto tempo vejo resultados?", a: "Os primeiros sinais de hidratação e luminosidade podem aparecer em poucas semanas. Para melhora visível de firmeza, elasticidade e redução de rugas, recomendamos o uso contínuo por pelo menos 30 a 60 dias, de manhã e/ou à noite." },
            { q: "Para quem o Sérum GHK-CU é indicado?", a: "É indicado para homens e mulheres com pele madura, quem deseja prevenir sinais do envelhecimento, pessoas com linhas finas, flacidez, ressecamento ou textura irregular — e para quem busca uma rotina anti-idade com hidratação intensa." },
            { q: "Pode ser usado em peles sensíveis?", a: "Sim! A fórmula foi desenvolvida para alta compatibilidade cutânea. O GHK-Cu é um peptídeo biomimético e o sérum possui textura leve de rápida absorção. Em peles sensíveis, recomenda-se iniciar gradualmente." },
            { q: "Como devo aplicar o sérum?", a: "Lave o rosto, seque completamente, aplique algumas gotas e espalhe suavemente até a absorção. Utilize antes do hidratante, diariamente pela manhã e/ou à noite. Pela manhã, finalize sempre com protetor solar." },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E8F4FA] overflow-hidden">
              <button 
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 sm:px-8 py-5 sm:py-6 flex items-center justify-between text-left hover:bg-[#E8F4FA]/50 transition-colors"
              >
                <span className="font-bold text-[#0F3D5C] text-sm sm:text-base pr-4">{item.q}</span>
                <ChevronDown className={`text-[#2AADE4] transition-transform flex-shrink-0 ${openIndex === i ? 'rotate-180' : ''}`} size={20} />
              </button>
              <motion.div 
                initial={false}
                animate={{ height: openIndex === i ? 'auto' : 0, opacity: openIndex === i ? 1 : 0 }}
                className="overflow-hidden"
              >
                <div className="px-6 sm:px-8 pb-6 sm:pb-8 text-xs sm:text-sm text-[#5A8FA6] leading-relaxed">
                  {item.a}
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Footer = () => (
  <footer className="bg-white pt-12 sm:pt-20 pb-24 sm:pb-12 border-t border-[#E8F4FA]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-12 mb-12 sm:mb-16">
        <div className="space-y-4 sm:space-y-6 text-center sm:text-left">
          <div className="h-8 sm:h-10 flex justify-center sm:justify-start">
            <img 
              src="https://i.ibb.co/Kcb9fST2/image.png" 
              alt="Zencial Logo" 
              className="h-full w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-xs sm:text-sm text-[#5A8FA6] leading-relaxed">
            Skincare avançado com GHK-Cu, ácido hialurônico e colágeno hidrolisado para firmeza, hidratação e regeneração da pele.
          </p>
          <div className="flex justify-center sm:justify-start gap-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#E8F4FA] flex items-center justify-center text-[#2AADE4] hover:bg-[#2AADE4] hover:text-white transition-all cursor-pointer">
              <Instagram size={18} sm:size={20} />
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#E8F4FA] flex items-center justify-center text-[#2AADE4] hover:bg-[#2AADE4] hover:text-white transition-all cursor-pointer">
              <Facebook size={18} sm:size={20} />
            </div>
          </div>
        </div>

        <div className="text-center sm:text-left">
          <h4 className="font-bold text-[#0F3D5C] mb-4 sm:mb-6 text-sm sm:text-base uppercase tracking-widest">Navegação</h4>
          <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-[#5A8FA6]">
            <li className="hover:text-[#2AADE4] cursor-pointer transition-colors">Início</li>
            <li className="hover:text-[#2AADE4] cursor-pointer transition-colors">Benefícios</li>
            <li className="hover:text-[#2AADE4] cursor-pointer transition-colors">Tecnologia</li>
            <li className="hover:text-[#2AADE4] cursor-pointer transition-colors">Kits</li>
          </ul>
        </div>

        <div className="text-center sm:text-left">
          <h4 className="font-bold text-[#0F3D5C] mb-4 sm:mb-6 text-sm sm:text-base uppercase tracking-widest">Suporte</h4>
          <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-[#5A8FA6]">
            <li className="hover:text-[#2AADE4] cursor-pointer transition-colors">Rastrear Pedido</li>
            <li className="hover:text-[#2AADE4] cursor-pointer transition-colors">Políticas de Envio</li>
            <li className="hover:text-[#2AADE4] cursor-pointer transition-colors">Trocas e Devoluções</li>
            <li className="hover:text-[#2AADE4] cursor-pointer transition-colors">Termos de Uso</li>
          </ul>
        </div>

        <div className="text-center sm:text-left">
          <h4 className="font-bold text-[#0F3D5C] mb-4 sm:mb-6 text-sm sm:text-base uppercase tracking-widest">Contato</h4>
          <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-[#5A8FA6]">
            <li className="flex items-center justify-center sm:justify-start gap-3">
              <Mail size={16} className="text-[#2AADE4]" />
              sac@zencial.com.br
            </li>
            <li className="flex items-center justify-center sm:justify-start gap-3">
              <ShieldCheck size={16} className="text-[#2AADE4]" />
              Compra 100% Segura
            </li>
          </ul>
        </div>
      </div>

      <div className="pt-8 sm:pt-12 border-t border-[#E8F4FA] flex flex-col sm:flex-row justify-between items-center gap-6 sm:gap-8">
        <p className="text-[10px] sm:text-xs text-[#5A8FA6] text-center sm:text-left">
          © 2024 Zencial. Todos os direitos reservados. CNPJ: 00.000.000/0001-00
        </p>
        <div className="flex gap-4 sm:gap-6 opacity-50 grayscale hover:grayscale-0 transition-all">
          <CreditCard size={24} sm:size={32} />
          <div className="text-[10px] sm:text-xs font-bold text-[#0F3D5C]">VISA</div>
          <div className="text-[10px] sm:text-xs font-bold text-[#0F3D5C]">MASTERCARD</div>
          <div className="text-[10px] sm:text-xs font-bold text-[#0F3D5C]">PIX</div>
        </div>
      </div>
    </div>
  </footer>
);

// --- Main App ---

export default function App() {
  const [cartCount, setCartCount] = useState(0);
  const [view, setView] = useState<'landing' | 'checkout' | 'pix'>('landing');
  const [selectedKit, setSelectedKit] = useState<any>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [urlParams, setUrlParams] = useState<Record<string, string>>(() =>
    mergeUrlParamsFromLocation()
  );

  useEffect(() => {
    const sync = () => setUrlParams(mergeUrlParamsFromLocation());
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [view]);

  const handleAddToCart = (kitData: any) => {
    setSelectedKit(kitData);
    setView('checkout');
    window.scrollTo(0, 0);
  };

  const handleFinishOrder = async (data: any) => {
    const utmPayload = toFruitfyUtmPayload(urlParams);
    const response = await fetch("/api/pix/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.customer.name.trim(),
        email: data.customer.email.trim(),
        cpf: onlyDigits(data.customer.cpf),
        phone: onlyDigits(data.customer.phone),
        amount: centsFromBRL(data.total),
        quantity: data.quantity,
        utm: utmPayload,
      }),
    });

    const payload = await response.json();

    if (!response.ok || payload?.success === false) {
      const validationDetail =
        payload?.errors && typeof payload.errors === "object"
          ? Object.entries(payload.errors as Record<string, unknown>)
              .map(([field, value]) => {
                const text = Array.isArray(value) ? value.join(", ") : String(value);
                return `${field}: ${text}`;
              })
              .join(" · ")
          : "";
      const message =
        [payload?.message, validationDetail].filter(Boolean).join(" — ") ||
        "Não foi possível criar cobrança PIX na Fruitfy.";
      throw new Error(message);
    }

    const pixData = extractPixFromFruitfyPayload(payload);
    setOrderData({
      ...data,
      total: pixData.amount > 0 ? pixData.amount / 100 : data.total,
      pixCode: pixData.pixCode,
      qrCodeImage: pixData.qrCodeImage,
      orderId: pixData.orderId,
      gatewayPayload: pixData.raw,
    });
    setView('pix');
    window.scrollTo(0, 0);
  };

  if (view === 'checkout' && selectedKit) {
    return <Checkout kit={selectedKit} onBack={() => setView('landing')} onFinish={handleFinishOrder} />;
  }

  if (view === 'pix' && orderData) {
    return <PixSuccess orderData={orderData} onReset={() => setView('landing')} />;
  }

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-[#2AADE4] selection:text-white">
      <AnnouncementBar />
      <Header cartCount={cartCount} />
      
      <main>
        <LandingHero />
        
        <section className="py-8 bg-white border-y border-[#E8F4FA]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap justify-center items-center gap-8 sm:gap-16 opacity-40 grayscale">
            {["ANVISA", "CRUELTY FREE", "DERMATOLOGICAMENTE TESTADO", "HIPOALERGÊNICO"].map((logo, i) => (
              <span key={i} className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-[#0F3D5C]">{logo}</span>
            ))}
          </div>
        </section>

        <DarkHero />
        <SkinIssuesCarousel />

        <Benefits />
        <Technology />
        
        <section className="py-12 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 sm:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <img 
                src="/ghk-cu-mecanismo.png" 
                alt="Tratamento com GHK-Cu — estimula colágeno, elastina e renovação celular" 
                className="w-full h-auto object-contain rounded-2xl sm:rounded-3xl shadow-2xl"
              />
            </div>
            <div className="order-1 lg:order-2 space-y-4 sm:space-y-6 text-center lg:text-left">
              <h2 className="text-2xl sm:text-4xl font-bold text-[#0F3D5C] tracking-tight">
                Por que esta fórmula funciona?
              </h2>
              <p className="text-sm sm:text-base text-[#5A8FA6] leading-relaxed">
                O GHK-Cu é um peptídeo biomimético que atua como sinalizador biológico, favorecendo 
                a atividade dos fibroblastos e a síntese de colágeno, elastina e componentes da matriz cutânea.
              </p>
              <p className="text-sm sm:text-base text-[#5A8FA6] leading-relaxed">
                Combinado ao ácido hialurônico — que melhora a retenção de água — e ao colágeno hidrolisado, 
                que reforça o suporte estrutural, o sérum atua em múltiplas camadas para resultados 
                progressivos de hidratação, textura, firmeza e luminosidade.
              </p>
            </div>
          </div>
        </section>

        <Ingredients />
        
        <section className="py-12 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 sm:gap-16 items-center">
            <div className="space-y-6 sm:space-y-8 text-center lg:text-left">
              <h2 className="text-2xl sm:text-4xl font-bold text-[#0F3D5C] tracking-tight">Modo de Usar</h2>
              <div className="space-y-6 sm:space-y-8 text-left">
                {[
                  { step: "01", title: "Limpeza", desc: "Lave o rosto com seu sabonete facial de preferência e seque completamente com uma toalha macia." },
                  { step: "02", title: "Aplicação", desc: "Aplique algumas gotas do Sérum GHK-CU na palma da mão ou diretamente no rosto." },
                  { step: "03", title: "Absorção", desc: "Espalhe suavemente com movimentos ascendentes até a completa absorção do sérum." },
                  { step: "04", title: "Hidratação", desc: "Finalize com seu hidratante habitual. Pela manhã, use sempre protetor solar após a rotina." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 sm:gap-6">
                    <span className="text-3xl sm:text-4xl font-black text-[#E8F4FA] tabular-nums">{item.step}</span>
                    <div className="space-y-1">
                      <h4 className="font-bold text-[#0F3D5C] text-sm sm:text-base">{item.title}</h4>
                      <p className="text-xs sm:text-sm text-[#5A8FA6] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative px-4 sm:px-0">
              <img 
                src="https://i.ibb.co/wZspKs5V/image.png" 
                alt="Como usar o Sérum GHK-CU Zencial" 
                className="rounded-2xl sm:rounded-3xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl sm:rounded-3xl"></div>
            </div>
          </div>
        </section>

        <Kits onAddToCart={handleAddToCart} />

        <section className="py-20 bg-[#E8F4FA]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center space-y-8">
            <div className="w-20 h-20 bg-[#2AADE4] text-white rounded-full flex items-center justify-center mx-auto mb-8">
              <ShieldCheck size={40} />
            </div>
            <h2 className="text-3xl font-bold text-[#0F3D5C]">Garantia Blindada de 30 Dias</h2>
            <p className="text-[#5A8FA6] max-w-2xl mx-auto leading-relaxed">
              Temos tanta confiança na eficácia do Sérum GHK-CU que oferecemos uma garantia incondicional. 
              Se em 30 dias você não notar uma melhora visível na firmeza, hidratação ou textura da sua pele, 
              devolvemos 100% do seu dinheiro. Sem perguntas, sem burocracia.
            </p>
          </div>
        </section>

        <section className="py-20 bg-[#155A7A] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center space-y-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">O que dizem nossas clientes</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { name: "Mariana S.", text: "Minhas linhas finas diminuíram visivelmente e a pele ficou muito mais firme. Estou encantada!", location: "São Paulo, SP", images: ["/reviews/feedback-1.png", "/reviews/feedback-2.png"] },
                { name: "Carla R.", text: "Usei por 2 meses e a flacidez melhorou bastante. Minha pele está mais hidratada e com viço.", location: "Rio de Janeiro, RJ", images: ["/reviews/feedback-3.png", "/reviews/feedback-4.png"] },
                { name: "Patrícia L.", text: "Minha pele estava opaca e ressecada. O Sérum GHK-CU devolveu a luminosidade e a maciez. Recomendo!", location: "Curitiba, PR", images: ["/reviews/feedback-5.png", "/reviews/feedback-6.png"] },
                { name: "Fernanda M.", text: "A textura da pele melhorou muito e o tom ficou mais uniforme. Sinto a pele mais elástica no dia a dia.", location: "Belo Horizonte, MG", images: ["/reviews/feedback-7.png", "/reviews/feedback-8.png"] },
                { name: "Renata A.", text: "Comecei pelo kit de 2 unidades e notei diferença na firmeza e na hidratação. Produto sério e de qualidade.", location: "Brasília, DF", images: ["/reviews/feedback-9.png", "/reviews/feedback-10.png"] },
              ].map((review, i) => (
                <div key={i} className="bg-white/5 p-8 rounded-2xl border border-white/10 text-left space-y-4">
                  <div className="flex text-[#2AADE4]">
                    {[...Array(5)].map((_, j) => <Star key={j} size={14} fill="currentColor" stroke="none" />)}
                  </div>
                  <p className="text-[#E8F4FA] italic leading-relaxed">"{review.text}"</p>
                  <div className="flex gap-2">
                    {review.images.map((src, j) => (
                      <img
                        key={j}
                        src={src}
                        alt={`Foto do produto enviada por ${review.name}`}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-white/15 shadow-sm"
                      />
                    ))}
                  </div>
                  <div>
                    <p className="font-bold text-white">{review.name}</p>
                    <p className="text-xs text-[#5A8FA6]">{review.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        <FAQ />
      </main>

      <Footer />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          animation: marquee 30s linear infinite;
        }
      `}} />
    </div>
  );
}
