'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  PlusCircle, Loader2, Check, AlertTriangle, ChevronDown, RefreshCw,
  Search, X, Trash2, Plus, Users, MapPin, Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

const OBJECTIVES = [
  { value: 'OUTCOME_LEADS',         label: 'Captação de leads' },
  { value: 'OUTCOME_SALES',         label: 'Vendas / Conversões' },
  { value: 'OUTCOME_TRAFFIC',       label: 'Tráfego para site' },
  { value: 'OUTCOME_ENGAGEMENT',    label: 'Engajamento' },
  { value: 'OUTCOME_AWARENESS',     label: 'Reconhecimento' },
  { value: 'OUTCOME_APP_PROMOTION', label: 'Promoção de app' },
]

const OPT_GOALS: Record<string, { value: string; label: string }[]> = {
  OUTCOME_LEADS:        [{ value: 'LEAD_GENERATION', label: 'Geração de leads' }, { value: 'CONVERSATIONS', label: 'Conversas (WhatsApp)' }, { value: 'OFFSITE_CONVERSIONS', label: 'Conversões (Pixel)' }],
  OUTCOME_SALES:        [{ value: 'CONVERSATIONS', label: 'Conversas (WhatsApp)' }, { value: 'OFFSITE_CONVERSIONS', label: 'Conversões (Pixel)' }, { value: 'LINK_CLICKS', label: 'Cliques no link' }],
  OUTCOME_TRAFFIC:      [{ value: 'LINK_CLICKS', label: 'Cliques no link' }, { value: 'LANDING_PAGE_VIEWS', label: 'Visualizações da página' }],
  OUTCOME_ENGAGEMENT:   [{ value: 'POST_ENGAGEMENT', label: 'Engajamento no post' }, { value: 'LINK_CLICKS', label: 'Cliques no link' }],
  OUTCOME_AWARENESS:    [{ value: 'REACH', label: 'Alcance' }, { value: 'IMPRESSIONS', label: 'Impressões' }],
  OUTCOME_APP_PROMOTION:[{ value: 'APP_INSTALLS', label: 'Instalações de app' }],
}

const CTA_OPTIONS = [
  { value: 'LEARN_MORE', label: 'Saiba mais' },
  { value: 'SIGN_UP', label: 'Cadastre-se' },
  { value: 'SHOP_NOW', label: 'Compre agora' },
  { value: 'CONTACT_US', label: 'Fale conosco' },
  { value: 'GET_QUOTE', label: 'Solicitar orçamento' },
  { value: 'BOOK_NOW', label: 'Reserve agora' },
  { value: 'DOWNLOAD', label: 'Baixar' },
  { value: 'WHATSAPP_MESSAGE', label: 'Mensagem no WhatsApp' },
]

interface GeoItem { key: string; label: string; geoArray: string; lat?: number; lng?: number }
interface Interest { id: string; name: string; path?: string }
interface Audience { id: string; name: string; subtype: string; size: number }
interface Creative { id: string; name: string; adName: string; thumbnail?: string }
interface Pixel { id: string; name: string }

interface AdsetConfig {
  uid: string
  name: string
  dailyBudget: string
  gender: 'all' | 'female' | 'male'
  ageMin: string
  ageMax: string
  geoMode: 'search' | 'country'
  geoKey: string
  geoArray: string
  geoLat: string
  geoLng: string
  geoRadius: string
  countries: string
  excludedGeos: GeoItem[]
  audiences: string[]
  excludedAudiences: string[]
  interests: Interest[]
  igFeed: boolean
  igStory: boolean
  igReels: boolean
  fbFeed: boolean
  fbStory: boolean
}

const newAdset = (index: number): AdsetConfig => ({
  uid: `${Date.now()}-${index}`,
  name: '',
  dailyBudget: '',
  gender: 'all',
  ageMin: '18',
  ageMax: '65',
  geoMode: 'search',
  geoKey: '',
  geoArray: '',
  geoLat: '',
  geoLng: '',
  geoRadius: '5',
  countries: 'BR',
  excludedGeos: [],
  audiences: [],
  excludedAudiences: [],
  interests: [],
  igFeed: true,
  igStory: true,
  igReels: true,
  fbFeed: false,
  fbStory: false,
})

// ─── Sub-components ──────────────────────────────────────────────────────────

function LocationSearch({
  onSelect,
  placeholder = 'Digite o bairro ou cidade...',
}: {
  onSelect: (loc: GeoItem) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const r = await fetch(`/api/meta/location-search?q=${encodeURIComponent(q)}`)
      const d = await r.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setResults((d.data || []).map((l: any) => ({
        key: l.key, label: l.label, geoArray: l.geoArray, lat: l.lat, lng: l.lng,
      })))
      setOpen(true)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  const handleChange = (v: string) => {
    setQuery(v)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(v), 400)
  }

  const handleSelect = (loc: GeoItem) => {
    onSelect(loc)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text" value={query} onChange={e => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-lg pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {(query || loading) && (
          <button type="button" onClick={() => { setQuery(''); setResults([]) }}
            className="absolute right-2 top-1/2 -translate-y-1/2">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" /> : <X className="w-3.5 h-3.5 text-gray-400" />}
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map(loc => (
            <button key={loc.key} type="button" onClick={() => handleSelect(loc)}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0">
              <p className="font-medium text-gray-800">{loc.label}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function InterestSearch({ selected, onAdd, onRemove }: {
  selected: Interest[]
  onAdd: (i: Interest) => void
  onRemove: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Interest[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const r = await fetch(`/api/meta/interest-search?q=${encodeURIComponent(q)}`)
      const d = await r.json()
      setResults(d.data || [])
      setOpen(true)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  const handleChange = (v: string) => {
    setQuery(v)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(v), 400)
  }

  const handleSelect = (i: Interest) => {
    if (!selected.find(s => s.id === i.id)) onAdd(i)
    setQuery(''); setResults([]); setOpen(false)
  }

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text" value={query} onChange={e => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Pesquisar interesses, comportamentos..."
          className="w-full border border-gray-300 rounded-lg pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {(query || loading) && (
          <button type="button" onClick={() => { setQuery(''); setResults([]) }}
            className="absolute right-2 top-1/2 -translate-y-1/2">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" /> : <X className="w-3.5 h-3.5 text-gray-400" />}
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {results.map(i => (
            <button key={i.id} type="button" onClick={() => handleSelect(i)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0">
              <p className="font-medium text-gray-800">{i.name}</p>
              {i.path && <p className="text-[10px] text-gray-400">{i.path}</p>}
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map(i => (
            <span key={i.id} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-2 py-1 text-xs font-medium">
              {i.name}
              <button type="button" onClick={() => onRemove(i.id)}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function AudiencePicker({ audiences, selected, onToggle, label, color = 'blue' }: {
  audiences: Audience[]
  selected: string[]
  onToggle: (id: string) => void
  label: string
  color?: 'blue' | 'red'
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const filtered = audiences.filter(a => a.name.toLowerCase().includes(q.toLowerCase()))
  const selectedItems = audiences.filter(a => selected.includes(a.id))
  const accent = color === 'red' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'

  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
          open ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
        )}>
        <span className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5" />
          {label}
          {selected.length > 0 && <span className="bg-blue-600 text-white rounded-full px-1.5 text-[10px]">{selected.length}</span>}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input type="text" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar público..."
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400" />
          </div>
          {audiences.length === 0 && (
            <p className="text-xs text-gray-400 px-3 py-3">Nenhum público personalizado encontrado.</p>
          )}
          <div className="max-h-40 overflow-y-auto">
            {filtered.map(a => (
              <label key={a.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0">
                <input type="checkbox" checked={selected.includes(a.id)} onChange={() => onToggle(a.id)}
                  className="w-3.5 h-3.5 accent-blue-600 rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{a.name}</p>
                  <p className="text-[10px] text-gray-400">{a.subtype} · {a.size > 0 ? `~${(a.size / 1000).toFixed(0)}k` : '?'}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedItems.map(a => (
            <span key={a.id} className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium border', accent)}>
              {a.name}
              <button type="button" onClick={() => onToggle(a.id)}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Adset section ───────────────────────────────────────────────────────────

function AdsetSection({
  adset, index, total, audiences, budgetType,
  onChange, onRemove,
}: {
  adset: AdsetConfig
  index: number
  total: number
  audiences: Audience[]
  budgetType: 'CBO' | 'ADSET'
  onChange: (updated: AdsetConfig) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(index === 0)

  const up = (patch: Partial<AdsetConfig>) => onChange({ ...adset, ...patch })

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        <button type="button" onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 flex-1 text-left">
          <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', expanded && 'rotate-180')} />
          <span className="text-sm font-semibold text-gray-700">
            {adset.name || `Conjunto ${index + 1}`}
          </span>
          {adset.geoKey && <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"><MapPin className="w-2.5 h-2.5 inline mr-0.5" />{adset.geoKey}</span>}
        </button>
        {total > 1 && (
          <button type="button" onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 py-4 space-y-4">

          {/* Nome do conjunto */}
          <div>
            <label className="field-label">Nome do conjunto</label>
            <input type="text" value={adset.name} onChange={e => up({ name: e.target.value })}
              placeholder={`Conjunto ${index + 1} — Tatuapé / Mulheres 35-55`}
              className="field-input" />
          </div>

          {/* Orçamento individual (só ADSET) */}
          {budgetType === 'ADSET' && (
            <div>
              <label className="field-label">Orçamento diário deste conjunto (R$)</label>
              <input type="number" value={adset.dailyBudget} onChange={e => up({ dailyBudget: e.target.value })}
                placeholder="Ex: 30" min="1" step="0.01" className="field-input" />
            </div>
          )}

          {/* Público */}
          <div>
            <p className="section-title">Público</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="field-label">Gênero</label>
                <select value={adset.gender} onChange={e => up({ gender: e.target.value as AdsetConfig['gender'] })} className="field-input">
                  <option value="all">Todos</option>
                  <option value="female">Feminino</option>
                  <option value="male">Masculino</option>
                </select>
              </div>
              <div>
                <label className="field-label">Idade mín.</label>
                <input type="number" value={adset.ageMin} onChange={e => up({ ageMin: e.target.value })} min="18" max="65" className="field-input" />
              </div>
              <div>
                <label className="field-label">Idade máx.</label>
                <input type="number" value={adset.ageMax} onChange={e => up({ ageMax: e.target.value })} min="18" max="65" className="field-input" />
              </div>
            </div>

            {/* Audiences */}
            <div className="space-y-2">
              <AudiencePicker
                audiences={audiences}
                selected={adset.audiences}
                onToggle={id => up({ audiences: adset.audiences.includes(id) ? adset.audiences.filter(a => a !== id) : [...adset.audiences, id] })}
                label="Incluir públicos personalizados"
                color="blue"
              />
              <AudiencePicker
                audiences={audiences}
                selected={adset.excludedAudiences}
                onToggle={id => up({ excludedAudiences: adset.excludedAudiences.includes(id) ? adset.excludedAudiences.filter(a => a !== id) : [...adset.excludedAudiences, id] })}
                label="Excluir públicos personalizados"
                color="red"
              />
            </div>
          </div>

          {/* Direcionamento detalhado */}
          <div>
            <p className="section-title">Direcionamento detalhado</p>
            <div className="relative">
              <InterestSearch
                selected={adset.interests}
                onAdd={i => up({ interests: [...adset.interests, i] })}
                onRemove={id => up({ interests: adset.interests.filter(i => i.id !== id) })}
              />
            </div>
          </div>

          {/* Localização */}
          <div>
            <p className="section-title">Localização — incluir</p>
            <div className="flex gap-2 mb-3">
              {(['search', 'country'] as const).map(m => (
                <button key={m} type="button" onClick={() => up({ geoMode: m })}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    adset.geoMode === m ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                  {m === 'search' ? '📍 Bairro / Cidade' : '🌍 País'}
                </button>
              ))}
            </div>

            {adset.geoMode === 'search' ? (
              <div>
                <LocationSearch
                  placeholder="Digite bairro ou cidade para incluir..."
                  onSelect={loc => up({ geoKey: loc.key, geoArray: loc.geoArray, geoLat: String(loc.lat || ''), geoLng: String(loc.lng || '') })}
                />
                {adset.geoKey && (
                  <div className="flex items-center justify-between mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-blue-700 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Região incluída (key: {adset.geoKey})
                    </span>
                    <button type="button" onClick={() => up({ geoKey: '', geoArray: '', geoLat: '', geoLng: '' })}
                      className="text-blue-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="field-label">País(es) — código ISO separado por vírgula</label>
                <input type="text" value={adset.countries} onChange={e => up({ countries: e.target.value })}
                  placeholder="BR" className="field-input" />
              </div>
            )}
          </div>

          {/* Excluir regiões */}
          <div>
            <p className="section-title">Localização — excluir</p>
            <LocationSearch
              placeholder="Digite bairro ou cidade para excluir..."
              onSelect={loc => {
                if (!adset.excludedGeos.find(g => g.key === loc.key))
                  up({ excludedGeos: [...adset.excludedGeos, loc] })
              }}
            />
            {adset.excludedGeos.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {adset.excludedGeos.map(g => (
                  <span key={g.key} className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 rounded-lg px-2 py-1 text-xs font-medium">
                    <X className="w-3 h-3" /> {g.label}
                    <button type="button" onClick={() => up({ excludedGeos: adset.excludedGeos.filter(e => e.key !== g.key) })}>
                      <X className="w-3 h-3 ml-0.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Posicionamentos */}
          <div>
            <p className="section-title">Posicionamentos</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              {[
                { label: 'IG Feed', field: 'igFeed' as const },
                { label: 'IG Stories', field: 'igStory' as const },
                { label: 'IG Reels', field: 'igReels' as const },
                { label: 'FB Feed', field: 'fbFeed' as const },
                { label: 'FB Stories', field: 'fbStory' as const },
              ].map(({ label, field }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <input type="checkbox" checked={adset[field]} onChange={e => up({ [field]: e.target.checked })}
                    className="w-4 h-4 rounded accent-blue-600" />
                  <span className="text-xs text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

// ─── Main form ───────────────────────────────────────────────────────────────

interface Props { accountId: string }

export function CreateCampaignForm({ accountId }: Props) {
  const [open, setOpen] = useState(false)

  // Assets
  const [pixels, setPixels] = useState<Pixel[]>([])
  const [whatsappNumbers, setWhatsappNumbers] = useState<string[]>([])
  const [pageIds, setPageIds] = useState<string[]>([])
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)

  // Campaign
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('OUTCOME_SALES')
  const [optGoal, setOptGoal] = useState('')
  const [budgetType, setBudgetType] = useState<'CBO' | 'ADSET'>('ADSET')
  const [budget, setBudget] = useState('')

  // Destination
  const [destinationType, setDestinationType] = useState<'WHATSAPP' | 'PIXEL' | 'NONE'>('WHATSAPP')
  const [selectedWhatsapp, setSelectedWhatsapp] = useState('')
  const [customWhatsapp, setCustomWhatsapp] = useState('')
  const [selectedPage, setSelectedPage] = useState('')
  const [selectedPixel, setSelectedPixel] = useState('')

  // Ad copy
  const [adText, setAdText] = useState('')
  const [adHeadline, setAdHeadline] = useState('')
  const [adDescription, setAdDescription] = useState('')
  const [adLinkUrl, setAdLinkUrl] = useState('')
  const [adCta, setAdCta] = useState('LEARN_MORE')

  // Creatives
  const [selectedCreatives, setSelectedCreatives] = useState<string[]>([])

  // Adsets
  const [adsets, setAdsets] = useState<AdsetConfig[]>([newAdset(0)])

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const resolvedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`
  const availableGoals = OPT_GOALS[objective] || []
  const resolvedGoal = optGoal || availableGoals[0]?.value || ''
  const whatsappToUse = selectedWhatsapp || customWhatsapp

  const loadAssets = async () => {
    setLoadingAssets(true)
    try {
      const r = await fetch(`/api/meta/account/${resolvedAccountId}/assets`)
      const d = await r.json()
      setPixels(d.pixels || [])
      setWhatsappNumbers(d.whatsappNumbers || [])
      setPageIds(d.pageIds || [])
      setCreatives(d.creatives || [])
      setAudiences(d.audiences || [])
      if (d.whatsappNumbers?.[0]) setSelectedWhatsapp(d.whatsappNumbers[0])
      if (d.pageIds?.[0]) setSelectedPage(d.pageIds[0])
      if (d.pixels?.[0]) setSelectedPixel(d.pixels[0].id)
    } catch { /* silent */ }
    finally { setLoadingAssets(false) }
  }

  useEffect(() => { if (open) loadAssets() }, [open]) // eslint-disable-line

  const toggleCreative = (id: string) =>
    setSelectedCreatives(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])

  const updateAdset = (idx: number, updated: AdsetConfig) =>
    setAdsets(prev => prev.map((a, i) => i === idx ? updated : a))

  const addAdset = () => setAdsets(prev => [...prev, newAdset(prev.length)])

  const removeAdset = (idx: number) => setAdsets(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !budget) return
    setLoading(true)
    setResult(null)

    // Build adsets array for API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adsetsPayload = adsets.map((ac, idx) => {
      const igPos = [ac.igFeed && 'stream', ac.igStory && 'story', ac.igReels && 'reels'].filter(Boolean).join(',')
      const fbPos = [ac.fbFeed && 'feed', ac.fbStory && 'story'].filter(Boolean).join(',')
      return {
        name: ac.name || `${name} — Conjunto ${idx + 1}`,
        daily_budget: budgetType === 'ADSET' ? (ac.dailyBudget || budget) : undefined,
        gender: ac.gender,
        age_min: ac.ageMin,
        age_max: ac.ageMax,
        geo_key: ac.geoKey || undefined,
        geo_array: ac.geoArray || undefined,
        geo_lat: ac.geoLat || undefined,
        geo_lng: ac.geoLng || undefined,
        geo_radius: ac.geoRadius,
        countries: ac.geoMode === 'country' ? ac.countries : undefined,
        excluded_geos: ac.excludedGeos.length > 0 ? ac.excludedGeos.map(g => ({ key: g.key, array: g.geoArray })) : undefined,
        custom_audiences: ac.audiences.length > 0 ? ac.audiences : undefined,
        excluded_audiences: ac.excludedAudiences.length > 0 ? ac.excludedAudiences : undefined,
        interests: ac.interests.length > 0 ? ac.interests.map(i => ({ id: i.id, name: i.name })) : undefined,
        placements_ig: igPos,
        placements_fb: fbPos,
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: Record<string, any> = {
      name: name.trim(),
      objective,
      optimization_goal: resolvedGoal,
      budget_type: budgetType,
      daily_budget: budget,
      adsets: adsetsPayload,
    }

    if (destinationType === 'WHATSAPP' && whatsappToUse && selectedPage) {
      p.destination_type = 'WHATSAPP'
      p.whatsapp_number = whatsappToUse
      p.page_id = selectedPage
    } else if (destinationType === 'PIXEL' && selectedPixel) {
      p.pixel_id = selectedPixel
    }

    if (adText) {
      p.ad_primary_text = adText
      if (adHeadline) p.ad_headline = adHeadline
      if (adDescription) p.ad_description = adDescription
      if (adLinkUrl) p.ad_link_url = adLinkUrl
      p.ad_cta = adCta
    }

    if (selectedCreatives.length > 0) p.creative_ids = selectedCreatives.join(',')

    try {
      const res = await fetch('/api/meta/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'create_campaign_full', entityId: resolvedAccountId, params: p }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro ao criar')
      setResult({ ok: true, msg: data.message })
      setName(''); setBudget(''); setSelectedCreatives([]); setAdText(''); setAdHeadline(''); setAdDescription(''); setAdLinkUrl('')
      setAdsets([newAdset(0)])
    } catch (err) {
      setResult({ ok: false, msg: String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => { setOpen(o => !o); setResult(null) }}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
            <PlusCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Criar campanha</p>
            <p className="text-xs text-gray-400">Campanha + conjuntos + anúncios — tudo pausado para revisão</p>
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 px-6 py-5 space-y-6">

          {/* CAMPANHA */}
          <section>
            <p className="section-title">Campanha</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="field-label">Nome *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required
                  placeholder="Ex: VENDAS / WHATSAPP — TATUAPÉ — MULHERES"
                  className="field-input" />
              </div>
              <div>
                <label className="field-label">Objetivo *</label>
                <select value={objective} onChange={e => { setObjective(e.target.value); setOptGoal('') }} className="field-input">
                  {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Meta de otimização</label>
                <select value={resolvedGoal} onChange={e => setOptGoal(e.target.value)} className="field-input">
                  {availableGoals.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* ORÇAMENTO */}
          <section>
            <p className="section-title">Orçamento</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Tipo</label>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
                  {(['CBO', 'ADSET'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setBudgetType(t)}
                      className={cn('flex-1 py-2 font-medium transition-colors',
                        budgetType === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                      {t === 'CBO' ? 'CBO (campanha)' : 'Por conjunto'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">
                  {budgetType === 'CBO' ? 'Orçamento da campanha (R$/dia) *' : 'Orçamento padrão por conjunto (R$/dia) *'}
                </label>
                <input type="number" value={budget} onChange={e => setBudget(e.target.value)}
                  placeholder="Ex: 30" min="1" step="0.01" required className="field-input" />
              </div>
            </div>
          </section>

          {/* DESTINO */}
          <section>
            <p className="section-title">Destino do anúncio</p>
            <div className="flex gap-2 mb-3">
              {(['WHATSAPP', 'PIXEL', 'NONE'] as const).map(d => (
                <button key={d} type="button" onClick={() => setDestinationType(d)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    destinationType === d ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                  {d === 'WHATSAPP' ? '📱 WhatsApp' : d === 'PIXEL' ? '📊 Pixel' : '🔗 Sem destino'}
                </button>
              ))}
            </div>

            {destinationType === 'WHATSAPP' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Número WhatsApp *</label>
                  {loadingAssets ? <p className="text-xs text-gray-400 py-2">Carregando...</p> : (
                    <div className="space-y-2">
                      {whatsappNumbers.length > 0 && (
                        <select value={selectedWhatsapp} onChange={e => setSelectedWhatsapp(e.target.value)} className="field-input">
                          <option value="">— Selecionar número cadastrado —</option>
                          {whatsappNumbers.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      )}
                      <input type="text" value={customWhatsapp} onChange={e => setCustomWhatsapp(e.target.value)}
                        placeholder={whatsappNumbers.length > 0 ? 'Ou digitar outro número (5511...)' : '5511999999999'}
                        className="field-input text-xs" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="field-label">Page ID *</label>
                  {loadingAssets ? <p className="text-xs text-gray-400 py-2">Carregando...</p>
                    : pageIds.length > 0
                      ? <select value={selectedPage} onChange={e => setSelectedPage(e.target.value)} className="field-input">
                          <option value="">— Selecionar página —</option>
                          {pageIds.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      : <input type="text" value={selectedPage} onChange={e => setSelectedPage(e.target.value)}
                          placeholder="ID da página Facebook" className="field-input" />}
                </div>
              </div>
            )}

            {destinationType === 'PIXEL' && (
              <div>
                <label className="field-label">Pixel</label>
                {loadingAssets ? <p className="text-xs text-gray-400 py-2">Carregando...</p>
                  : pixels.length > 0
                    ? <select value={selectedPixel} onChange={e => setSelectedPixel(e.target.value)} className="field-input">
                        {pixels.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                      </select>
                    : <input type="text" value={selectedPixel} onChange={e => setSelectedPixel(e.target.value)}
                        placeholder="ID do pixel" className="field-input" />}
              </div>
            )}
          </section>

          {/* CONJUNTOS DE ANÚNCIO */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="section-title !mb-0">Conjuntos de anúncio</p>
              <button type="button" onClick={addAdset}
                className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:underline">
                <Plus className="w-3.5 h-3.5" /> Adicionar conjunto
              </button>
            </div>
            <div className="space-y-3">
              {adsets.map((adset, idx) => (
                <AdsetSection
                  key={adset.uid}
                  adset={adset}
                  index={idx}
                  total={adsets.length}
                  audiences={audiences}
                  budgetType={budgetType}
                  onChange={updated => updateAdset(idx, updated)}
                  onRemove={() => removeAdset(idx)}
                />
              ))}
            </div>
          </section>

          {/* COPY DO ANÚNCIO */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <p className="section-title !mb-0">Copy do anúncio</p>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {destinationType === 'WHATSAPP' ? 'obrigatório para criar anúncio' : 'opcional'}
              </span>
            </div>
            {destinationType === 'WHATSAPP' && (
              <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
                📱 Para anúncios de WhatsApp, o sistema cria o criativo automaticamente com o texto abaixo + CTA de mensagem. Preencha ao menos o texto principal.
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className="field-label">Texto principal{destinationType === 'WHATSAPP' ? ' *' : ''}</label>
                <textarea value={adText} onChange={e => setAdText(e.target.value)} rows={3}
                  placeholder="Texto que aparece antes da imagem/vídeo no anúncio..."
                  className="field-input resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Título / Headline</label>
                  <input type="text" value={adHeadline} onChange={e => setAdHeadline(e.target.value)}
                    placeholder="Título do link ou card" className="field-input" />
                </div>
                <div>
                  <label className="field-label">Descrição</label>
                  <input type="text" value={adDescription} onChange={e => setAdDescription(e.target.value)}
                    placeholder="Descrição abaixo do título" className="field-input" />
                </div>
              </div>
              {destinationType !== 'WHATSAPP' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">URL de destino</label>
                    <input type="url" value={adLinkUrl} onChange={e => setAdLinkUrl(e.target.value)}
                      placeholder="https://seusite.com.br" className="field-input" />
                  </div>
                  <div>
                    <label className="field-label">Botão CTA</label>
                    <select value={adCta} onChange={e => setAdCta(e.target.value)} className="field-input">
                      {CTA_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* CRIATIVOS */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="section-title !mb-0">
                  {destinationType === 'WHATSAPP' ? 'Imagem do anúncio (WhatsApp)' : 'Criativos existentes'}
                </p>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">opcional</span>
              </div>
              <button type="button" onClick={loadAssets} disabled={loadingAssets}
                className="text-[10px] text-blue-500 flex items-center gap-1 hover:underline disabled:opacity-40">
                {loadingAssets ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Recarregar
              </button>
            </div>
            {destinationType === 'WHATSAPP' && (
              <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
                📱 Selecione a imagem que será usada no anúncio de WhatsApp. O sistema combina a imagem com o texto da copy e cria o criativo automaticamente.
              </p>
            )}
            {loadingAssets && <p className="text-xs text-gray-400">Carregando criativos...</p>}
            {!loadingAssets && creatives.length === 0 && (
              <p className="text-xs text-gray-400">
                {destinationType === 'WHATSAPP'
                  ? 'Nenhuma imagem encontrada. Sem imagem selecionada, os anúncios precisam ser criados no Gerenciador.'
                  : 'Nenhum criativo encontrado — preencha a copy acima para criar.'}
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {creatives.map(cr => (
                <button key={cr.id} type="button" onClick={() => toggleCreative(cr.id)}
                  className={cn('relative rounded-xl border-2 overflow-hidden text-left transition-all',
                    selectedCreatives.includes(cr.id) ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300')}>
                  {cr.thumbnail
                    ? <img src={cr.thumbnail} alt={cr.name} className="w-full h-20 object-cover bg-gray-100" />
                    : <div className="w-full h-20 bg-gray-100 flex items-center justify-center">
                        <Target className="w-5 h-5 text-gray-300" />
                      </div>}
                  <p className="text-[10px] font-medium text-gray-700 truncate px-2 py-1.5 bg-white">{cr.adName}</p>
                  {selectedCreatives.includes(cr.id) && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            {selectedCreatives.length > 0 && (
              <p className="text-xs text-blue-600 mt-2 font-medium">{selectedCreatives.length} criativo(s) selecionado(s)</p>
            )}
          </section>

          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="text-base leading-none">⚠️</span>
            <span>Tudo criado como <strong>PAUSADO</strong>. Revise no Gerenciador antes de publicar.</span>
          </div>

          {result && (
            <div className={cn('flex items-start gap-2 rounded-lg px-3 py-3 text-sm',
              result.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800')}>
              {result.ok ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{result.msg}</span>
            </div>
          )}

          <button type="submit" disabled={loading || !name.trim() || !budget}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            {loading ? 'Criando...' : `Criar campanha + ${adsets.length} conjunto(s)`}
          </button>
        </form>
      )}

      <style jsx>{`
        .section-title { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; display: block; }
        .field-label { display: block; font-size: 11px; font-weight: 500; color: #6b7280; margin-bottom: 4px; }
        .field-input { width: 100%; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 12px; font-size: 13px; outline: none; background: white; }
        .field-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
      `}</style>
    </div>
  )
}
