import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface Creative {
  id: string
  name: string
  format: string
  status: string
  notes?: string
}

interface Campaign {
  id: string
  name: string
  status: string
  spend?: number
  results?: number
}

export async function POST(req: Request) {
  const { instruction, accountId, accountName, campaigns, creatives, spend, resultLabel } = await req.json()

  const campaignList = (campaigns as Campaign[] || []).slice(0, 20).map((c: Campaign) =>
    `- ID: ${c.id} | ${c.name} | Status: ${c.status}${c.spend ? ` | Gasto: R$${c.spend.toFixed(2)}` : ''}${c.results ? ` | Resultados: ${c.results}` : ''}`
  ).join('\n')

  const creativeList = (creatives as Creative[] || []).map((c: Creative) =>
    `- ID: ${c.id} | ${c.name} | Formato: ${c.format} | Status: ${c.status}${c.notes ? ` | Obs: ${c.notes}` : ''}`
  ).join('\n')

  const prompt = `Você é o sistema de execução do Ideal Pro, uma agência de marketing digital brasileira.
Você analisa pedidos e gera planos de ação estruturados para campanhas Meta Ads.

IMPORTANTE: Nunca execute ações automaticamente sem aprovação. Sempre gere um plano para o gestor revisar.
Todas as ações devem ter descrição clara em português.

CONTA: ${accountName} (ID: ${accountId})
GASTO NO PERÍODO: R$${(spend || 0).toFixed(2)}
TIPO DE RESULTADO: ${resultLabel || 'Resultados'}

CAMPANHAS ATIVAS:
${campaignList || 'Nenhuma campanha disponível'}

CRIATIVOS DO CLIENTE NA PASTA:
${creativeList || 'Nenhum criativo cadastrado na pasta'}

PEDIDO DO GESTOR:
${instruction}

Gere um plano de execução em JSON com esta estrutura exata:
{
  "summary": "resumo do plano em 1-2 frases",
  "actions": [
    {
      "id": "1",
      "type": "pause_campaign | activate_campaign | pause_adset | activate_adset | update_adset_budget | update_campaign_budget | create_campaign | info",
      "description": "descrição clara da ação em português",
      "entityId": "id da entidade a ser modificada (vazio para create ou info)",
      "params": { "chave": "valor" },
      "risk": "low | medium | high",
      "estimated_impact": "impacto estimado desta ação",
      "creative_used": "nome do criativo da pasta se aplicável (ou null)"
    }
  ]
}

Para ações de tipo "info": use para recomendações sem execução automática.
Para update_adset_budget: params deve ter { "daily_budget": "valor em centavos como string, ex: 5000 = R$50" }
Para update_campaign_budget: params deve ter { "daily_budget": "valor em centavos" }
Para create_campaign: params deve ter { "name": "nome", "objective": "OUTCOME_LEADS|OUTCOME_TRAFFIC|OUTCOME_SALES", "status": "PAUSED" }
Se o gestor mencionar um criativo, referencie o nome exato da pasta no campo creative_used.
Responda APENAS com o JSON válido, sem markdown.`

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: 'Não foi possível gerar o plano.', actions: [] }

    return NextResponse.json(plan)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
