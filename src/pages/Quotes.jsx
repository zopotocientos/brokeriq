// src/pages/Quotes.jsx
import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import {
  getPlanType,
  calculatePlanPremium,
  applyContribution,
  buildRatesByPlan,
} from '../lib/quoteEngine'

// ─── Constants ───────────────────────────────────────────────────────────────

const METAL_TIERS = ['Platinum', 'Gold', 'Silver', 'Bronze']
const PLAN_TYPES  = ['HMO', 'PPO', 'PPO/HSA']

const TIER_STYLE = {
  Platinum: { color: '#374151', bg: '#F1F5F9', border: '#94A3B8' },
  Gold:     { color: '#92400E', bg: '#FFFBEB', border: '#D97706' },
  Silver:   { color: '#374151', bg: '#F8FAFC', border: '#94A3B8' },
  Bronze:   { color: '#7C2D12', bg: '#FFF7ED', border: '#C2410C' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return '$' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

async function detectRegion(county, zip) {
  const { data: countyData } = await supabase
    .from('ca_counties')
    .select('region_number')
    .ilike('county_name', county || '')
    .single()

  if (!countyData) return null

  if ((county || '').toLowerCase().includes('los angeles')) {
    const { data: r15 } = await supabase
      .from('ca_la_region15_zips')
      .select('zip_code')
      .eq('zip_code', zip)
      .maybeSingle()
    return r15 ? 15 : 16
  }

  return countyData.region_number
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = ['Select Plans', 'Contribution', 'Results']
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
      {steps.map((label, i) => {
        const num  = i + 1
        const done = step > num
        const active = step === num
        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done || active ? '#1B4F8A' : '#E5E7EB',
                color: done || active ? '#FFFFFF' : '#6B7280',
                fontSize: '13px', fontWeight: '700',
              }}>
                {done ? '✓' : num}
              </div>
              <span style={{
                fontSize: '14px',
                fontWeight: active ? '600' : '400',
                color: active ? '#111827' : done ? '#1B4F8A' : '#9CA3AF',
              }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: '56px', height: '2px', margin: '0 12px',
                background: done ? '#1B4F8A' : '#E5E7EB',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function FilterSection({ title, children }) {
  return (
    <div style={{ marginBottom: '22px' }}>
      <div style={{
        fontSize: '11px', fontWeight: '700', color: '#9CA3AF',
        textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px',
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {children}
      </div>
    </div>
  )
}

function FilterCheckbox({ label, checked, onChange }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      cursor: 'pointer', fontSize: '14px', color: '#374151',
      userSelect: 'none',
    }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ cursor: 'pointer', accentColor: '#1B4F8A' }} />
      {label}
    </label>
  )
}

function TierBadge({ tier }) {
  const s = TIER_STYLE[tier] || { color: '#374151', bg: '#F3F4F6', border: '#E5E7EB' }
  return (
    <span style={{
      fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {tier}
    </span>
  )
}

function PlanRow({ plan, selected, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr 100px 90px 120px 120px 100px',
        padding: '11px 20px',
        borderBottom: '1px solid #F3F4F6',
        cursor: 'pointer',
        background: selected ? '#EEF4FF' : '#FFFFFF',
        alignItems: 'center',
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
        style={{ cursor: 'pointer', accentColor: '#1B4F8A' }}
      />
      <div style={{ fontSize: '14px', color: '#111827', fontWeight: '500', paddingRight: '12px' }}>
        {plan.plan_name}{plan.contract_code ? ` (${plan.contract_code})` : ""}
      </div>
      <TierBadge tier={plan.metal_tier} />
      <div style={{ fontSize: '13px', color: '#374151' }}>{getPlanType(plan)}</div>
      <div style={{ fontSize: '13px', color: '#374151' }}>
        {plan.deductible_individual != null ? `$${parseInt(plan.deductible_individual).toLocaleString()}` : '—'}
      </div>
      <div style={{ fontSize: '13px', color: '#374151' }}>
        {plan.oop_max_individual != null ? `$${parseInt(plan.oop_max_individual).toLocaleString()}` : '—'}
      </div>
      <div style={{ fontSize: '13px', color: '#374151' }}>
        {plan.pcp_copay != null ? `$${plan.pcp_copay}` : '—'}
      </div>
    </div>
  )
}

function ResultRow({ result, idx }) {
  const [expanded, setExpanded] = useState(false)
  const { plan, totalPremium, employerTotal, employeeTotal, avgPerEmployee, hasRates, employeeCount } = result
  const pt = getPlanType(plan)
  const ts = TIER_STYLE[plan.metal_tier] || {}

  return (
    <>
      <div
        onClick={() => hasRates && setExpanded(e => !e)}
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr 110px 90px 160px 160px 160px 140px',
          padding: '14px 20px',
          borderBottom: expanded ? 'none' : '1px solid #F3F4F6',
          background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
          alignItems: 'center',
          cursor: hasRates ? 'pointer' : 'default',
        }}
      >
        {/* Expand toggle */}
        <div style={{ color: '#9CA3AF', fontSize: '12px', userSelect: 'none' }}>
          {hasRates ? (expanded ? '▾' : '▸') : ''}
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{plan.plan_name}{plan.contract_code ? ` (${plan.contract_code})` : ""}</div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{plan.carriers?.name}</div>
        </div>
        <TierBadge tier={plan.metal_tier} />
        <div style={{ fontSize: '13px', color: '#374151' }}>{pt}</div>

        {hasRates ? (
          <>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{fmt(totalPremium)}</div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#059669' }}>{fmt(employerTotal)}</div>
            <div style={{ fontSize: '15px', color: '#374151' }}>{fmt(employeeTotal)}</div>
            <div style={{ fontSize: '14px', color: '#374151' }}>{fmt(avgPerEmployee)}</div>
          </>
        ) : (
          <div style={{ gridColumn: '5 / 9', fontSize: '13px', color: '#EF4444' }}>
            No rates found for this region
          </div>
        )}
      </div>

      {/* Expanded member breakdown */}
      {expanded && hasRates && (
        <div style={{
          background: '#F9FAFB', borderBottom: '1px solid #F3F4F6',
          padding: '12px 20px 16px 60px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Member Premium Breakdown
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '200px 120px 60px 120px',
            gap: '0', fontSize: '12px', fontWeight: '600', color: '#9CA3AF',
            padding: '4px 0 8px', borderBottom: '1px solid #E5E7EB', marginBottom: '6px',
          }}>
            <div>Name</div>
            <div>Relationship</div>
            <div>Age</div>
            <div>Monthly Rate</div>
          </div>
          {result.memberBreakdown.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'grid', gridTemplateColumns: '200px 120px 60px 120px',
                fontSize: '13px', color: m.capped ? '#9CA3AF' : '#374151',
                padding: '4px 0', borderBottom: '1px solid #F3F4F6',
              }}
            >
              <div style={{ fontWeight: m.relationship === 'Employee' ? '600' : '400' }}>{m.name}</div>
              <div>{m.relationship}{m.capped ? ' (free)' : ''}</div>
              <div>{m.age}</div>
              <div>{m.capped ? '—' : fmt(m.rate)}</div>
            </div>
          ))}
          <div style={{
            display: 'grid', gridTemplateColumns: '200px 120px 60px 120px',
            fontSize: '13px', fontWeight: '700', color: '#111827',
            padding: '8px 0 0',
          }}>
            <div>Total</div>
            <div>{employeeCount} employee{employeeCount !== 1 ? 's' : ''}</div>
            <div></div>
            <div>{fmt(totalPremium)}</div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Button styles ────────────────────────────────────────────────────────────

const primaryBtn = {
  background: '#1B4F8A', color: '#FFFFFF', border: 'none', borderRadius: '6px',
  padding: '10px 24px', fontSize: '14px', fontWeight: '600',
  cursor: 'pointer', fontFamily: 'Arial, sans-serif',
}
const secondaryBtn = {
  background: '#FFFFFF', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '6px',
  padding: '10px 20px', fontSize: '14px', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Quotes() {
  const { id: groupId } = useParams()

  // Data
  const [loading, setLoading]   = useState(true)
  const [group, setGroup]       = useState(null)
  const [census, setCensus]     = useState([])
  const [allPlans, setAllPlans] = useState([])
  const [carriers, setCarriers] = useState([])
  const [region, setRegion]     = useState(null)
  const [error, setError]       = useState(null)

  // Wizard state
  const [step, setStep] = useState(1)

  // Step 1
  const [selectedPlanIds, setSelectedPlanIds] = useState(new Set())
  const [filterCarrier,   setFilterCarrier]   = useState([])
  const [filterTier,      setFilterTier]      = useState([])
  const [filterType,      setFilterType]      = useState([])

  // Step 2
  const [contribution, setContribution] = useState({ type: 'flat', value: '' })

  // Step 3
  const [results,     setResults]     = useState([])
  const [calculating, setCalculating] = useState(false)

  // ── Load on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // Group
      const { data: grp, error: grpErr } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (grpErr || !grp) {
        setError('Group not found.')
        setLoading(false)
        return
      }
      setGroup(grp)

      // Census
      const { data: cens } = await supabase
        .from('census')
        .select('*')
        .eq('group_id', groupId)
      setCensus(cens || [])

      const empCount = (cens || []).filter(m => m.relationship === 'Employee').length

      // Region
      setRegion(grp.region_number)

      // Plans — direct distribution only, matching this group size
      // Fetch plans
const { data: plans } = await supabase
  .from('medical_plans')
  .select(`
    id, plan_name, network_type, metal_tier,
    deductible_individual, deductible_family,
    oop_max_individual, oop_max_family,
    pcp_copay, specialist_copay, er_copay,
    hsa_eligible, group_size_min, group_size_max,
    plan_id_code, contract_code, carrier_id, active
  `)
  .eq('active', true)
  .eq('distribution_channel', 'direct')
  .order('metal_tier')

// Fetch carriers separately and attach to plans
const { data: carrierList } = await supabase
  .from('carriers')
  .select('id, name, carrier_code')

const carrierMap = {}
for (const c of (carrierList || [])) {
  carrierMap[c.id] = c
}

const planList = (plans || []).map(p => ({
  ...p,
  carriers: carrierMap[p.carrier_id] || null
}))

console.log("planList:", planList); console.log("sample plan:", JSON.stringify(planList[0])); console.log("carrierList:", JSON.stringify(carrierList)); setAllPlans(planList)

const uniqueCarriers = {}
for (const p of planList) {
  if (p.carriers && !uniqueCarriers[p.carrier_id]) {
    uniqueCarriers[p.carrier_id] = p.carriers
  }
}
setCarriers(Object.values(uniqueCarriers).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)))

      setLoading(false)
    }
    load()
  }, [groupId])

  // ── Filtered plan list ─────────────────────────────────────────────────────

  const filteredPlans = useMemo(() => {
    return allPlans.filter(p => {
      if (filterCarrier.length && !filterCarrier.includes(p.carrier_id)) return false
      if (filterTier.length && !filterTier.includes(p.metal_tier)) return false
      if (filterType.length && !filterType.includes(getPlanType(p))) return false
      return true
    })
  }, [allPlans, filterCarrier, filterTier, filterType])

  const plansByCarrier = useMemo(() => {
    const grouped = {}
    for (const plan of filteredPlans) {
      const cid = plan.carrier_id
      if (!grouped[cid]) grouped[cid] = { carrier: plan.carriers, plans: [] }
      grouped[cid].plans.push(plan)
    }
    // Sort within each carrier: Platinum → Gold → Silver → Bronze, then by name
    const tierOrder = { Platinum: 0, Gold: 1, Silver: 2, Bronze: 3 }
    for (const g of Object.values(grouped)) {
      g.plans.sort((a, b) => {
        const td = (tierOrder[a.metal_tier] ?? 9) - (tierOrder[b.metal_tier] ?? 9)
        return td !== 0 ? td : a.plan_name.localeCompare(b.plan_name)
      })
    }
    return Object.values(grouped).filter(g => g.carrier).sort((a, b) => a.carrier.name.localeCompare(b.carrier.name))
  }, [filteredPlans])

  // ── Step 1 handlers ────────────────────────────────────────────────────────

  function togglePlan(planId) {
    setSelectedPlanIds(prev => {
      const next = new Set(prev)
      next.has(planId) ? next.delete(planId) : next.add(planId)
      return next
    })
  }

  function toggleCarrierAll(plans, select) {
    setSelectedPlanIds(prev => {
      const next = new Set(prev)
      plans.forEach(p => (select ? next.add(p.id) : next.delete(p.id)))
      return next
    })
  }

  function toggle(setter, value) {
    setter(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value])
  }

  // ── Step 3: calculate ──────────────────────────────────────────────────────

  async function runCalculation() {
    setCalculating(true)

    const planIds = Array.from(selectedPlanIds)

    // Fetch all rate rows for selected plans × this region × effective_date ≤ group date
    const { data: rateRows } = await supabase
      .from('medical_rates')
      .select('medical_plan_id, age_min, age_max, monthly_rate, effective_date')
      .in('medical_plan_id', planIds)
      .eq('region_number', region)
      .lte('effective_date', group.effective_date)
      .order('effective_date', { ascending: false })

    const ratesByPlan = buildRatesByPlan(rateRows || [])

    const contribValue = parseFloat(contribution.value) || 0
    const contrib = { type: contribution.type, value: contribValue }

    const selectedPlans = allPlans.filter(p => selectedPlanIds.has(p.id))

    const planResults = selectedPlans.map(plan => {
      const planRates = ratesByPlan[plan.id] || []
      const { totalPremium, employeeCount, memberBreakdown, hasRates } =
        calculatePlanPremium(census, planRates, group.effective_date)

      const { employerTotal, employeeTotal, avgPerEmployee } = hasRates
        ? applyContribution(totalPremium, employeeCount, memberBreakdown, contrib)
        : { employerTotal: 0, employeeTotal: 0, avgPerEmployee: 0 }

      return {
        plan,
        totalPremium,
        employeeCount,
        memberBreakdown,
        employerTotal,
        employeeTotal,
        avgPerEmployee,
        hasRates,
      }
    })

    // Sort: plans with rates first, then by total premium ascending
    planResults.sort((a, b) => {
      if (a.hasRates && !b.hasRates) return -1
      if (!a.hasRates && b.hasRates) return 1
      return a.totalPremium - b.totalPremium
    })

    setResults(planResults)
    setCalculating(false)
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goStep2() {
    if (selectedPlanIds.size === 0) return
    setStep(2)
    window.scrollTo(0, 0)
  }

  async function goStep3() {
    setStep(3)
    window.scrollTo(0, 0)
    await runCalculation()
  }

  function goBack() {
    setStep(s => s - 1)
    window.scrollTo(0, 0)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '60px', textAlign: 'center', color: '#6B7280' }}>
          Loading quote data…
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div style={{ padding: '60px', textAlign: 'center', color: '#EF4444' }}>{error}</div>
      </Layout>
    )
  }

  const empCount    = census.filter(m => m.relationship === 'Employee').length
  const memberCount = census.length

  return (
    <Layout>
      <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: '6px', fontSize: '13px', color: '#6B7280' }}>
          <Link to="/groups" style={{ color: '#6B7280', textDecoration: 'none' }}>Groups</Link>
          <span style={{ margin: '0 6px' }}>›</span>
          <Link to={`/groups/${groupId}/census`} style={{ color: '#6B7280', textDecoration: 'none' }}>
            {group?.employer_name}
          </Link>
          <span style={{ margin: '0 6px' }}>›</span>
          <span style={{ color: '#111827' }}>New Quote</span>
        </div>

        {/* Page header */}
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 4px' }}>
          New Quote
        </h1>
        <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 28px' }}>
          {group?.employer_name}
          {region && <> · <strong>Region {region}</strong></>}
          {' · '}<strong>Effective {group?.effective_date}</strong>
          {' · '}{empCount} employee{empCount !== 1 ? 's' : ''}
          {memberCount > empCount && `, ${memberCount - empCount} dependent${memberCount - empCount !== 1 ? 's' : ''}`}
        </p>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {/* ════════════════════ STEP 1: PLAN SELECTION ════════════════════ */}
        {step === 1 && (
          <div style={{ display: 'flex', gap: '24px' }}>

            {/* Filter sidebar */}
            <div style={{
              width: '210px', flexShrink: 0,
              background: '#FFFFFF', border: '1px solid #E5E7EB',
              borderRadius: '8px', padding: '20px', alignSelf: 'flex-start',
            }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '18px' }}>
                Filters
              </div>

              <FilterSection title="Carrier">
                {carriers.map(c => (
                  <FilterCheckbox
                    key={c.id}
                    label={c.name}
                    checked={filterCarrier.includes(c.id)}
                    onChange={() => toggle(setFilterCarrier, c.id)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Metal Tier">
                {METAL_TIERS.map(t => (
                  <FilterCheckbox
                    key={t}
                    label={t}
                    checked={filterTier.includes(t)}
                    onChange={() => toggle(setFilterTier, t)}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Plan Type">
                {PLAN_TYPES.map(t => (
                  <FilterCheckbox
                    key={t}
                    label={t}
                    checked={filterType.includes(t)}
                    onChange={() => toggle(setFilterType, t)}
                  />
                ))}
              </FilterSection>

              {(filterCarrier.length || filterTier.length || filterType.length) ? (
                <button
                  onClick={() => { setFilterCarrier([]); setFilterTier([]); setFilterType([]) }}
                  style={{
                    width: '100%', padding: '7px', fontSize: '13px',
                    color: '#EF4444', background: 'none', border: '1px solid #FECACA',
                    borderRadius: '6px', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
                  }}
                >
                  Clear Filters
                </button>
              ) : null}
            </div>

            {/* Plan list */}
            <div style={{ flex: 1, minWidth: 0 }}>

              {plansByCarrier.length === 0 ? (
                <div style={{
                  background: '#FFFFFF', border: '1px solid #E5E7EB',
                  borderRadius: '8px', padding: '48px', textAlign: 'center', color: '#6B7280',
                }}>
                  No plans match the current filters.
                </div>
              ) : plansByCarrier.map(({ carrier, plans: carrierPlans }) => {
                const selectedInCarrier = carrierPlans.filter(p => selectedPlanIds.has(p.id)).length
                const allInCarrierSelected = selectedInCarrier === carrierPlans.length

                return (
                  <div key={carrier.id} style={{
                    background: '#FFFFFF', border: '1px solid #E5E7EB',
                    borderRadius: '8px', marginBottom: '16px', overflow: 'hidden',
                  }}>
                    {/* Carrier header */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '13px 20px', background: '#F9FAFB',
                      borderBottom: '1px solid #E5E7EB',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>
                          {carrier.name}
                        </span>
                        <span style={{ fontSize: '13px', color: '#6B7280' }}>
                          {carrierPlans.length} plan{carrierPlans.length !== 1 ? 's' : ''}
                          {selectedInCarrier > 0 && (
                            <> · <span style={{ color: '#1B4F8A', fontWeight: '600' }}>{selectedInCarrier} selected</span></>
                          )}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleCarrierAll(carrierPlans, !allInCarrierSelected)}
                        style={{
                          fontSize: '13px', color: '#1B4F8A', background: 'none',
                          border: 'none', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
                        }}
                      >
                        {allInCarrierSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    {/* Column headers */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '36px 1fr 100px 90px 120px 120px 100px',
                      padding: '7px 20px',
                      background: '#FAFAFA', borderBottom: '1px solid #E5E7EB',
                      fontSize: '11px', fontWeight: '700', color: '#9CA3AF',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      <div />
                      <div>Plan Name</div>
                      <div>Tier</div>
                      <div>Type</div>
                      <div>Deductible</div>
                      <div>OOP Max</div>
                      <div>PCP Copay</div>
                    </div>

                    {/* Plan rows */}
                    {carrierPlans.map(plan => (
                      <PlanRow
                        key={plan.id}
                        plan={plan}
                        selected={selectedPlanIds.has(plan.id)}
                        onToggle={() => togglePlan(plan.id)}
                      />
                    ))}
                  </div>
                )
              })}

              {/* Continue bar */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 0',
              }}>
                <span style={{ fontSize: '14px', color: '#6B7280' }}>
                  {selectedPlanIds.size === 0
                    ? 'Select at least one plan to continue.'
                    : `${selectedPlanIds.size} plan${selectedPlanIds.size !== 1 ? 's' : ''} selected`}
                </span>
                <button
                  onClick={goStep2}
                  disabled={selectedPlanIds.size === 0}
                  style={{
                    ...primaryBtn,
                    background: selectedPlanIds.size > 0 ? '#1B4F8A' : '#D1D5DB',
                    cursor: selectedPlanIds.size > 0 ? 'pointer' : 'not-allowed',
                  }}
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════ STEP 2: CONTRIBUTION ════════════════════ */}
        {step === 2 && (
          <div style={{ maxWidth: '580px' }}>
            <div style={{
              background: '#FFFFFF', border: '1px solid #E5E7EB',
              borderRadius: '8px', padding: '36px',
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 8px' }}>
                Employer Contribution
              </h2>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 32px' }}>
                How much will the employer contribute toward monthly premiums?
              </p>

              {/* Type toggle */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
                  Contribution Type
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[
                    { value: 'flat',       label: 'Flat Dollar',  sub: 'Fixed $ per employee' },
                    { value: 'percentage', label: 'Percentage',   sub: '% of employee-only premium' },
                  ].map(opt => {
                    const active = contribution.type === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setContribution({ type: opt.value, value: '' })}
                        style={{
                          flex: 1, padding: '14px 16px', borderRadius: '8px', textAlign: 'left',
                          border: active ? '2px solid #1B4F8A' : '1px solid #E5E7EB',
                          background: active ? '#EEF4FF' : '#FFFFFF',
                          cursor: 'pointer', fontFamily: 'Arial, sans-serif',
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: '700', color: active ? '#1B4F8A' : '#111827' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{opt.sub}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Amount */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
                  {contribution.type === 'flat'
                    ? 'Amount Per Employee / Month'
                    : 'Percentage of Employee-Only Premium'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px', color: '#9CA3AF', fontWeight: '300' }}>
                    {contribution.type === 'flat' ? '$' : '%'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={contribution.type === 'percentage' ? 100 : undefined}
                    step="0.01"
                    value={contribution.value}
                    onChange={e => setContribution(c => ({ ...c, value: e.target.value }))}
                    placeholder={contribution.type === 'flat' ? '0.00' : '0'}
                    style={{
                      width: '160px', padding: '10px 14px', fontSize: '22px', fontWeight: '600',
                      border: '1px solid #E5E7EB', borderRadius: '6px',
                      color: '#111827', fontFamily: 'Arial, sans-serif', outline: 'none',
                    }}
                    autoFocus
                  />
                  <span style={{ fontSize: '14px', color: '#6B7280' }}>
                    {contribution.type === 'flat' ? 'per employee / month' : 'of employee-only premium'}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '12px' }}>
                  Dependent premiums are fully employee-paid under this model. Tiered and dependent contribution strategies are planned for a future release.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={goBack} style={secondaryBtn}>← Back</button>
                <button onClick={goStep3} style={primaryBtn}>
                  Calculate Quote →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════ STEP 3: RESULTS ════════════════════════ */}
        {step === 3 && (
          <div>
            {calculating ? (
              <div style={{ padding: '80px', textAlign: 'center', color: '#6B7280' }}>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>Calculating premiums…</div>
                <div style={{ fontSize: '13px' }}>
                  Rating {selectedPlanIds.size} plan{selectedPlanIds.size !== 1 ? 's' : ''} across {memberCount} member{memberCount !== 1 ? 's' : ''}
                </div>
              </div>
            ) : (
              <>
                {/* Stats bar */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Plans Quoted',   value: results.length },
                    { label: 'Subscribers',    value: empCount },
                    { label: 'Total Members',  value: memberCount },
                    { label: 'Rating Region',  value: region ? `Region ${region}` : '—' },
                    { label: 'Effective Date', value: group?.effective_date },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: '#FFFFFF', border: '1px solid #E5E7EB',
                      borderRadius: '8px', padding: '14px 22px', flex: '1', minWidth: '130px',
                    }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>{s.value}</div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '3px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Contribution summary pill */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: '#EEF4FF', border: '1px solid #BFDBFE',
                  borderRadius: '6px', padding: '8px 16px', marginBottom: '20px',
                  fontSize: '14px', color: '#1B4F8A',
                }}>
                  <span style={{ fontWeight: '700' }}>Employer Contribution:</span>
                  {contribution.type === 'flat'
                    ? `$${parseFloat(contribution.value || 0).toFixed(2)} flat per employee / month`
                    : `${parseFloat(contribution.value || 0).toFixed(1)}% of employee-only premium`}
                </div>

                {/* Results table */}
                <div style={{
                  background: '#FFFFFF', border: '1px solid #E5E7EB',
                  borderRadius: '8px', overflow: 'hidden',
                }}>
                  {/* Column headers */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr 110px 90px 160px 160px 160px 140px',
                    padding: '10px 20px',
                    background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
                    fontSize: '11px', fontWeight: '700', color: '#9CA3AF',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    <div />
                    <div>Plan</div>
                    <div>Tier</div>
                    <div>Type</div>
                    <div>Total Monthly</div>
                    <div>Employer Cost</div>
                    <div>Employee Cost</div>
                    <div>Avg / Employee</div>
                  </div>

                  {results.map((r, i) => (
                    <ResultRow key={r.plan.id} result={r} idx={i} />
                  ))}
                </div>

                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '10px' }}>
                  ▸ Click any row to expand the per-member premium breakdown.
                  Dependents beyond the 3rd child are shown as "free" per California small group rating rules.
                </p>

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', alignItems: 'center' }}>
                  <button onClick={goBack} style={secondaryBtn}>← Adjust Contribution</button>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => { setStep(1); setResults([]) }}
                      style={{ ...secondaryBtn, color: '#1B4F8A', borderColor: '#BFDBFE' }}
                    >
                      Start Over
                    </button>
                    {/* Save Quote — M6 */}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}








