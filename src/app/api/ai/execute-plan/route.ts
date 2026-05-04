import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const client = new Anthropic()

interface Creative { id: string; name: string; format: string; status: string; notes?: string }
interface Campaign { id: string; name: string; status: string; spend?: number; results?: number }

const PLAN_TOOL: Anthropic.Tool = {
  name: 'generate_plan',
  description: 'Gera um plano de execução de ações Meta Ads para aprovação do gestor.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Resumo do plano em 1-2 frases' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id:               { type: 'string' },
            type:             { type: 'string', enum: ['pause_campaign','activate_campaign','pause_adset','activate_adset','update_adset_budget','update_campaign_budget','create_campaign','info'] },
            description:      { type: 'string', description: 'Descrição clara em português' },
            entityId:         { type: 'string', description: 'ID da campanha/conjunto; para create_campaign: act_{accountId}; para info: vazio' },
            params:           { type: 'object', additionalProperties: true },
            risk:             { type: 'string', enum: ['low','medium','high'] },
            estimated_impact: { type: 'string' },
            creative_used:    { type: 'string' },
          },
          required: ['id','type','description','entityId','risk','estimated_impact'],
        },
      },
    },
    required: ['summary','actions'],
  },
}

export async function POST(req: Request) {
  const { instruction, accountId: rawAccountId, accountName, campaigns, creatives, spend, resultLabel, analysisSummary } = await req.json()
  const accountId = rawAccountId?.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`

  const campaignList = (campaigns as Campaign[] || []).slice(0, 15).map((c: Campaign) =>
    `- ID:${c.id} | ${c.name} | ${c.status}${c.spend ? ` | R$${c.spend.toFixed(0)}` : ''}${c.results ? ` | ${c.results} result.` : ''}`
  ).join('\n')

  const creativeList = (creatives as Creative[] || []).slice(0, 10).map((c: Creative) =>
    `- ${c.name} (${c.format}, ${c.status})`
  ).join('\n')

  const prompt = `Você é o sistema de execução do Ideal Pro (agência de marketing digital brasileira).
Gere um plano de ação Meta Ads para o gestor revisar e aprovar. NUNCA execute sem aprovação.

CONTA: ${accountName} (ID: ${accountId})
INVESTIDO: R$${(spend || 0).toFixed(0)} | RESULTADO: ${resultLabel || 'Resultados'}

CAMPANHAS ATIVAS:
${campaignList || 'Nenhuma'}

CRIATIVOS:
${creativeList || 'Nenhum'}

${analysisSummary ? `DIAGNÓSTICO ANTERIOR:\n${analysisSummary.slice(0, 500)}\n` : ''}
PEDIDO: ${instruction}

Regras:
- pause/activate/budget → entityId = ID da campanha ou conjunto
- create_campaign → entityId = "act_${accountId}", params = {name, objective, status:"PAUSED"}
- info → entityId = "" (recomendação sem execução)
- update_*_budget → params = {daily_budget: "valor em centavos"}
- Máximo 6 ações por plano`

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      tools: [PLAN_TOOL],
      tool_choice: { type: 'tool', name: 'generate_plan' },
      messages: [{ role: 'user', content: prompt }],
    })

    const toolBlock = msg.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return NextResponse.json({ summary: 'Não foi possível gerar o plano. Tente novamente.', actions: [] })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = toolBlock.input as any
    if (Array.isArray(plan.actions)) {
      plan.actions = plan.actions.map((action: { type: string; entityId?: string }) => {
        if (action.type === 'create_campaign') {
          return { ...action, entityId: accountId }
        }
        return action
      })
    }

    return NextResponse.json(plan)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
