'use client'

import { useState } from 'react'
import { Settings, Key, Globe, CheckCircle, XCircle, RefreshCw, Copy, Check, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

interface ApiStatus { ok: boolean; detail: string }

export default function ConfiguracoesPage() {
  const [metaStatus, setMetaStatus] = useState<ApiStatus | null>(null)
  const [googleStatus, setGoogleStatus] = useState<ApiStatus | null>(null)
  const [checkingMeta, setCheckingMeta] = useState(false)
  const [checkingGoogle, setCheckingGoogle] = useState(false)

  const checkMeta = async () => {
    setCheckingMeta(true)
    try {
      const res = await fetch('/api/meta/accounts')
      const data = await res.json()
      if (data.error) setMetaStatus({ ok: false, detail: data.error })
      else setMetaStatus({ ok: true, detail: `${data.length || 0} contas acessíveis` })
    } catch (e) {
      setMetaStatus({ ok: false, detail: String(e) })
    } finally { setCheckingMeta(false) }
  }

  const checkGoogle = async () => {
    setCheckingGoogle(true)
    try {
      const res = await fetch('/api/google/accounts')
      const data = await res.json()
      if (data.error) setGoogleStatus({ ok: false, detail: data.developer_token_status === 'TEST_ONLY' ? 'Aguardando aprovação Basic Access' : data.error })
      else setGoogleStatus({ ok: true, detail: `${data.total || 0} contas acessíveis` })
    } catch (e) {
      setGoogleStatus({ ok: false, detail: String(e) })
    } finally { setCheckingGoogle(false) }
  }

  const envVars = [
    { key: 'META_ACCESS_TOKEN', label: 'Meta Access Token', platform: 'Meta Ads' },
    { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', platform: 'Claude AI' },
    { key: 'GOOGLE_ADS_DEVELOPER_TOKEN', label: 'Google Developer Token', platform: 'Google Ads' },
    { key: 'GOOGLE_ADS_MCC_ID', label: 'MCC ID', platform: 'Google Ads' },
    { key: 'GOOGLE_ADS_CLIENT_ID', label: 'Client ID', platform: 'Google Ads' },
    { key: 'GOOGLE_ADS_CLIENT_SECRET', label: 'Client Secret', platform: 'Google Ads' },
    { key: 'GOOGLE_ADS_REFRESH_TOKEN', label: 'Refresh Token', platform: 'Google Ads' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 flex-shrink-0">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold">Configurações</h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Status das integrações e variáveis do sistema</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">

        {/* Acesso */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-gray-500" />
            <h2 className="font-bold text-gray-900 text-sm">Acesso ao sistema</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div>
                <p className="text-xs font-semibold text-gray-700">E-mail</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">idealproads@outlook.com</p>
              </div>
              <CopyBtn text="idealproads@outlook.com" />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-xs font-semibold text-gray-700">Senha</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">agencia1234</p>
              </div>
              <CopyBtn text="agencia1234" />
            </div>
          </div>
        </div>

        {/* API Status */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-gray-500" />
            <h2 className="font-bold text-gray-900 text-sm">Status das integrações</h2>
          </div>
          <div className="space-y-3">
            {/* Meta */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-black">M</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Meta Ads</p>
                  {metaStatus && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {metaStatus.ok
                        ? <CheckCircle className="w-3 h-3 text-green-500" />
                        : <XCircle className="w-3 h-3 text-red-500" />}
                      <p className={cn('text-[10px]', metaStatus.ok ? 'text-green-600' : 'text-red-500')}>{metaStatus.detail}</p>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={checkMeta}
                disabled={checkingMeta}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors"
              >
                <RefreshCw className={cn('w-3 h-3', checkingMeta && 'animate-spin')} />
                Testar
              </button>
            </div>

            {/* Google */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-red-500 to-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-black">G</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Google Ads</p>
                  {googleStatus ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      {googleStatus.ok
                        ? <CheckCircle className="w-3 h-3 text-green-500" />
                        : <XCircle className="w-3 h-3 text-red-500" />}
                      <p className={cn('text-[10px]', googleStatus.ok ? 'text-green-600' : 'text-red-500')}>{googleStatus.detail}</p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 mt-0.5">Aguardando aprovação Basic Access</p>
                  )}
                </div>
              </div>
              <button
                onClick={checkGoogle}
                disabled={checkingGoogle}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
              >
                <RefreshCw className={cn('w-3 h-3', checkingGoogle && 'animate-spin')} />
                Testar
              </button>
            </div>

            {/* Claude AI */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-black">AI</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Claude AI (Anthropic)</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Verificar saldo em console.anthropic.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Env Vars */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-4 h-4 text-gray-500" />
            <h2 className="font-bold text-gray-900 text-sm">Variáveis de ambiente</h2>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">configuradas no Vercel</span>
          </div>
          <div className="space-y-2">
            {envVars.map(v => (
              <div key={v.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-xs font-mono font-semibold text-gray-700">{v.key}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{v.label} · {v.platform}</p>
                </div>
                <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-3">
                  Configurada
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">
            Para alterar: acesse vercel.com → projeto idealpro → Settings → Environment Variables
          </p>
        </div>

        {/* Deploy info */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-gray-500" />
            <h2 className="font-bold text-gray-900 text-sm">Publicação</h2>
          </div>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-gray-500">URL do sistema</span>
              <a href="https://idealpro.vercel.app" target="_blank" rel="noreferrer" className="text-blue-600 font-mono hover:underline">idealpro.vercel.app</a>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-gray-500">Repositório</span>
              <span className="font-mono text-gray-700">automacaoidealpro-debug/idealpro</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-gray-500">Deploy automático</span>
              <span className="text-green-600 font-medium">Ativo — a cada push no GitHub</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
