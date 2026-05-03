'use client'

import { useState } from 'react'
import { CheckCircle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Objetivo = 'leads' | 'vendas' | 'whatsapp'

interface OnboardingData {
  empresa: string
  produto: string
  publicoAlvo: string
  ticketMedio: string
  whatsapp: string
  site: string
  objetivo: Objetivo | ''
  orcamento: string
}

const OBJETIVOS: { key: Objetivo; label: string; desc: string }[] = [
  { key: 'leads', label: 'Leads', desc: 'Capturar contatos interessados' },
  { key: 'vendas', label: 'Vendas online', desc: 'Vender diretamente pelo anúncio' },
  { key: 'whatsapp', label: 'Mensagens WhatsApp', desc: 'Atrair clientes para o WhatsApp' },
]

const STORE_KEY = 'idealpro_onboarding'

function saveOnboarding(data: OnboardingData) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORE_KEY) || '[]')
    existing.push({ ...data, submittedAt: new Date().toISOString() })
    localStorage.setItem(STORE_KEY, JSON.stringify(existing))
  } catch {}
}

export default function OnboardingPage() {
  const [form, setForm] = useState<OnboardingData>({
    empresa: '', produto: '', publicoAlvo: '', ticketMedio: '',
    whatsapp: '', site: '', objetivo: '', orcamento: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof OnboardingData, string>>>({})

  const set = (k: keyof OnboardingData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const validate = () => {
    const e: Partial<Record<keyof OnboardingData, string>> = {}
    if (!form.empresa.trim()) e.empresa = 'Campo obrigatório'
    if (!form.produto.trim()) e.produto = 'Campo obrigatório'
    if (!form.publicoAlvo.trim()) e.publicoAlvo = 'Campo obrigatório'
    if (!form.objetivo) e.objetivo = 'Selecione um objetivo'
    if (!form.orcamento.trim()) e.orcamento = 'Campo obrigatório'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    saveOnboarding(form)
    setSubmitted(true)
  }

  const inputClass = (field: keyof OnboardingData) => cn(
    'w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-white',
    errors[field] ? 'border-red-300 focus:ring-red-300' : 'border-gray-200'
  )

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 text-white px-6 py-5">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center font-black text-lg">IP</div>
            <span className="font-bold text-lg tracking-tight">Ideal Pro</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-9 h-9 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Dados recebidos!</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Obrigado, <strong>{form.empresa}</strong>! Nossa equipe entrará em contato em breve pelo WhatsApp para dar início às suas campanhas.
            </p>
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 text-left space-y-1">
              <p><strong>Objetivo:</strong> {OBJETIVOS.find(o => o.key === form.objetivo)?.label}</p>
              <p><strong>Orçamento:</strong> R$ {form.orcamento}/mês</p>
              {form.whatsapp && <p><strong>WhatsApp:</strong> {form.whatsapp}</p>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 text-white px-6 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center font-black text-lg">IP</div>
            <span className="font-bold text-lg tracking-tight">Ideal Pro Marketing</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">Vamos começar!</h1>
          <p className="text-gray-300 text-sm">Preencha as informações abaixo para começarmos a criar suas campanhas</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={submit} className="space-y-4">

            {/* Basic info card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">1</span>
                Sobre o seu negócio
              </h2>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nome da empresa *</label>
                <input type="text" value={form.empresa} onChange={set('empresa')}
                  placeholder="Ex: Clínica Bella, Loja do João..." className={inputClass('empresa')} />
                {errors.empresa && <p className="text-xs text-red-500 mt-1">{errors.empresa}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Produto ou serviço principal *</label>
                <input type="text" value={form.produto} onChange={set('produto')}
                  placeholder="Ex: Consultas estéticas, Roupas femininas, Cursos online..."
                  className={inputClass('produto')} />
                {errors.produto && <p className="text-xs text-red-500 mt-1">{errors.produto}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Público-alvo — quem compra? *</label>
                <textarea value={form.publicoAlvo} onChange={set('publicoAlvo')}
                  placeholder="Ex: Mulheres de 25-45 anos, que trabalham e buscam tratamentos estéticos..."
                  rows={3} className={cn(inputClass('publicoAlvo'), 'resize-none')} />
                {errors.publicoAlvo && <p className="text-xs text-red-500 mt-1">{errors.publicoAlvo}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Ticket médio / Meta de CPP (R$)</label>
                  <input type="number" min="0" step="0.01" value={form.ticketMedio} onChange={set('ticketMedio')}
                    placeholder="Ex: 150" className={inputClass('ticketMedio')} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">URL do site</label>
                  <input type="url" value={form.site} onChange={set('site')}
                    placeholder="https://seusite.com.br" className={inputClass('site')} />
                </div>
              </div>
            </div>

            {/* Campaign card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">2</span>
                Objetivos e orçamento
              </h2>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Objetivo principal *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {OBJETIVOS.map(obj => (
                    <button
                      key={obj.key}
                      type="button"
                      onClick={() => { setForm(prev => ({ ...prev, objetivo: obj.key })); setErrors(prev => ({ ...prev, objetivo: undefined })) }}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        form.objetivo === obj.key
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      )}
                    >
                      <p className={cn('text-sm font-bold', form.objetivo === obj.key ? 'text-blue-700' : 'text-gray-800')}>{obj.label}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{obj.desc}</p>
                    </button>
                  ))}
                </div>
                {errors.objetivo && <p className="text-xs text-red-500 mt-1">{errors.objetivo}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Orçamento mensal (R$) *</label>
                <input type="number" min="0" step="1" value={form.orcamento} onChange={set('orcamento')}
                  placeholder="Ex: 3000" className={inputClass('orcamento')} />
                {errors.orcamento && <p className="text-xs text-red-500 mt-1">{errors.orcamento}</p>}
              </div>
            </div>

            {/* Contact card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-4">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">3</span>
                Contato para relatórios
              </h2>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">WhatsApp para relatórios</label>
                <input type="text" value={form.whatsapp} onChange={set('whatsapp')}
                  placeholder="Ex: 5511999999999 (com DDI)" className={inputClass('whatsapp')} />
                <p className="text-[10px] text-gray-400 mt-1">Você receberá seus relatórios semanais aqui</p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl text-sm font-bold transition-all shadow-md"
            >
              Enviar e começar
              <ChevronRight className="w-4 h-4" />
            </button>
            <p className="text-center text-[11px] text-gray-400">Seus dados são 100% seguros e não são compartilhados com terceiros.</p>
          </form>
        </div>
      </div>
    </div>
  )
}
