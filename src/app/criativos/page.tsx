'use client'

import { useState, useEffect, useRef } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Image as ImageIcon, Upload, X, Check, Clock, Pause, Play, ChevronLeft, Plus, Search, Film, FileImage } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClientMeta {
  id: string
  name: string
  status: string
  monthlySpend: number
}

interface Creative {
  id: string
  name: string
  format: 'imagem' | 'video' | 'carrossel'
  status: 'ativo' | 'pausado' | 'em_analise' | 'reprovado'
  file?: string
  fileType?: string
  addedAt: string
  notes?: string
}

type CreativeStore = Record<string, Creative[]>

const FORMAT_ICONS = {
  imagem: FileImage,
  video: Film,
  carrossel: ImageIcon,
}

const STATUS_CFG = {
  ativo: { label: 'Ativo', color: 'bg-green-50 text-green-700 border-green-200' },
  pausado: { label: 'Pausado', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  em_analise: { label: 'Em análise', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  reprovado: { label: 'Reprovado', color: 'bg-red-50 text-red-700 border-red-200' },
}

const STORE_KEY = 'idealpro_criativos'

function loadStore(): CreativeStore {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') } catch { return {} }
}

function saveStore(store: CreativeStore) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

export default function CriativosPage() {
  const [clients, setClients] = useState<ClientMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ClientMeta | null>(null)
  const [store, setStore] = useState<CreativeStore>({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', format: 'imagem' as Creative['format'], status: 'em_analise' as Creative['status'], notes: '', file: '', fileType: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setStore(loadStore())
    fetch('/api/meta/accounts')
      .then(r => r.json())
      .then(d => {
        const active = (d.accounts || [])
          .filter((a: ClientMeta) => a.status === 'active' || a.status === 'no_campaigns' || a.status === 'error')
          .sort((a: ClientMeta, b: ClientMeta) => b.monthlySpend - a.monthlySpend)
        setClients(active)
      })
      .finally(() => setLoading(false))
  }, [])

  const creatives = selected ? (store[selected.id] || []) : []

  const addCreative = () => {
    if (!selected || !form.name) return
    const c: Creative = {
      id: Date.now().toString(),
      name: form.name,
      format: form.format,
      status: form.status,
      file: form.file || undefined,
      fileType: form.fileType || undefined,
      notes: form.notes || undefined,
      addedAt: new Date().toISOString(),
    }
    const next = { ...store, [selected.id]: [...(store[selected.id] || []), c] }
    setStore(next)
    saveStore(next)
    setForm({ name: '', format: 'imagem', status: 'em_analise', notes: '', file: '', fileType: '' })
    setShowForm(false)
  }

  const updateStatus = (creativeId: string, status: Creative['status']) => {
    if (!selected) return
    const next = {
      ...store,
      [selected.id]: (store[selected.id] || []).map(c => c.id === creativeId ? { ...c, status } : c),
    }
    setStore(next)
    saveStore(next)
  }

  const removeCreative = (creativeId: string) => {
    if (!selected) return
    const next = {
      ...store,
      [selected.id]: (store[selected.id] || []).filter(c => c.id !== creativeId),
    }
    setStore(next)
    saveStore(next)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setForm(f => ({ ...f, file: ev.target?.result as string, fileType: file.type, name: f.name || file.name.replace(/\.[^.]+$/, '') }))
    }
    reader.readAsDataURL(file)
  }

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  // — Folder view for a specific client —
  if (selected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{selected.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{selected.name}</h2>
                <p className="text-xs text-gray-400">{creatives.length} criativo{creatives.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar criativo
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-5 space-y-4">
          {/* Add form */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Novo criativo</h3>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome do criativo *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Banner produto V2"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Formato</label>
                  <select
                    value={form.format}
                    onChange={e => setForm(f => ({ ...f, format: e.target.value as Creative['format'] }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="imagem">Imagem</option>
                    <option value="video">Vídeo</option>
                    <option value="carrossel">Carrossel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status inicial</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Creative['status'] }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="em_analise">Em análise</option>
                    <option value="ativo">Ativo</option>
                    <option value="pausado">Pausado</option>
                    <option value="reprovado">Reprovado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Arquivo (opcional)</label>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {form.file ? 'Arquivo selecionado' : 'Clique para selecionar'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                  <input
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Briefing, CTA, público-alvo..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {form.file && form.fileType?.startsWith('image/') && (
                <div className="mt-3">
                  <img src={form.file} alt="preview" className="h-24 rounded-lg object-cover border border-gray-200" />
                </div>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button
                  onClick={addCreative}
                  disabled={!form.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Salvar criativo
                </button>
              </div>
            </div>
          )}

          {/* Creative grid */}
          {creatives.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
              <ImageIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="font-medium text-gray-500">Nenhum criativo cadastrado</p>
              <p className="text-sm text-gray-400 mt-1">Clique em "Adicionar criativo" para começar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {creatives.map(c => {
                const FmtIcon = FORMAT_ICONS[c.format]
                const st = STATUS_CFG[c.status]
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    {/* Preview */}
                    <div className="h-36 bg-gray-100 flex items-center justify-center relative">
                      {c.file && c.fileType?.startsWith('image/') ? (
                        <img src={c.file} alt={c.name} className="w-full h-full object-cover" />
                      ) : c.file && c.fileType?.startsWith('video/') ? (
                        <video src={c.file} className="w-full h-full object-cover" controls={false} />
                      ) : (
                        <FmtIcon className="w-10 h-10 text-gray-300" />
                      )}
                      <span className={`absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 rounded-full border ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{c.format}</p>
                        </div>
                      </div>
                      {c.notes && (
                        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{c.notes}</p>
                      )}
                      <p className="text-[10px] text-gray-300 mb-3">
                        {new Date(c.addedAt).toLocaleDateString('pt-BR')}
                      </p>
                      {/* Status actions */}
                      <div className="flex items-center gap-1.5">
                        {c.status !== 'ativo' && (
                          <button
                            onClick={() => updateStatus(c.id, 'ativo')}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                          >
                            <Play className="w-3 h-3" /> Ativar
                          </button>
                        )}
                        {c.status !== 'pausado' && (
                          <button
                            onClick={() => updateStatus(c.id, 'pausado')}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors"
                          >
                            <Pause className="w-3 h-3" /> Pausar
                          </button>
                        )}
                        <button
                          onClick={() => removeCreative(c.id)}
                          className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        >
                          <X className="w-3 h-3" /> Remover
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // — Client list view —
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <ImageIcon className="w-5 h-5 text-gray-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Biblioteca de Criativos</h1>
              <p className="text-gray-400 text-xs mt-0.5">Pasta de criativos por cliente</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-5">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(client => {
              const clientCreatives = store[client.id] || []
              const activeCount = clientCreatives.filter(c => c.status === 'ativo').length
              const pendingCount = clientCreatives.filter(c => c.status === 'em_analise').length
              return (
                <div
                  key={client.id}
                  onClick={() => setSelected(client)}
                  className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">{client.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{client.name}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(client.monthlySpend)}/mês</p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180 group-hover:text-gray-500 transition-colors" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-xl p-2">
                      <p className="text-lg font-bold text-gray-900">{clientCreatives.length}</p>
                      <p className="text-[10px] text-gray-400">Total</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-2">
                      <p className="text-lg font-bold text-green-700">{activeCount}</p>
                      <p className="text-[10px] text-green-500">Ativos</p>
                    </div>
                    <div className={cn('rounded-xl p-2', pendingCount > 0 ? 'bg-blue-50' : 'bg-gray-50')}>
                      <p className={cn('text-lg font-bold', pendingCount > 0 ? 'text-blue-700' : 'text-gray-400')}>{pendingCount}</p>
                      <p className={cn('text-[10px]', pendingCount > 0 ? 'text-blue-400' : 'text-gray-400')}>Pendentes</p>
                    </div>
                  </div>

                  {pendingCount > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1.5">
                      <Clock className="w-3 h-3" />
                      {pendingCount} criativo{pendingCount !== 1 ? 's' : ''} aguardando análise
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
