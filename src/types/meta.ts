export interface AdAccount {
  id: string
  name: string
  account_status: number
  currency: string
  spend_cap?: string
  amount_spent?: string
  balance?: string
}

export interface AccountInsights {
  account_id: string
  account_name: string
  spend: string
  impressions: string
  clicks: string
  reach: string
  ctr: string
  cpm: string
  cpp: string
  actions?: Action[]
  date_start: string
  date_stop: string
}

export interface Action {
  action_type: string
  value: string
}

export interface Campaign {
  id: string
  name: string
  status: string
  effective_status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  spend?: string
}

export interface PixelData {
  id: string
  name: string
  code: string
  last_fired_time?: string
}

export interface ClientAccount {
  id: string
  name: string
  status: 'active' | 'paused' | 'error' | 'no_campaigns'
  healthScore: number
  dailySpend: number
  weeklySpend: number
  monthlySpend: number
  lastMonthSpend: number
  lastMonthResults: number
  monthResults: number
  activeCampaigns: number
  pausedCampaigns: number
  leads: number
  purchases: number
  conversations: number
  cpp: number
  ctr: number
  pixel: boolean
  alerts: Alert[]
}

export interface Alert {
  type: 'budget_ending' | 'campaign_stopped' | 'high_cpp' | 'low_ctr' | 'no_pixel'
  message: string
  severity: 'low' | 'medium' | 'high'
}
