// src/lib/quoteEngine.js
// Pure calculation functions for BrokerIQ quoting engine.
// No Supabase imports — all data is passed in.

/**
 * Calculate age as of a given reference date.
 */
export function calculateAge(dob, referenceDate) {
  if (!dob) return 0
  const birth = new Date(dob)
  const ref = referenceDate ? new Date(referenceDate) : new Date()
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--
  return Math.max(0, age)
}

/**
 * Derive a display plan type from network_type + hsa_eligible.
 * Returns 'HMO', 'PPO/HSA', 'PPO', or the raw network_type.
 */
export function getPlanType(plan) {
  const nt = (plan.network_type || '').toUpperCase()
  if (nt.includes('HMO')) return 'HMO'
  if (plan.hsa_eligible) return 'PPO/HSA'
  if (nt.includes('PPO') || nt.includes('EPO')) return 'PPO'
  return plan.network_type || 'Other'
}

/**
 * Find the monthly rate for a given age from a plan's rate rows.
 * Expects rows: [{ age_min, age_max, monthly_rate }, ...]
 * Returns a float or null if no match found.
 */
export function findRateForAge(planRates, age) {
  const match = planRates.find(r => r.age_min <= age && r.age_max >= age)
  return match ? parseFloat(match.monthly_rate) : null
}

/**
 * Given raw rate rows for multiple plans (from Supabase),
 * deduplicate so each plan keeps only its most recent effective_date's rows.
 *
 * Input:  [{ medical_plan_id, age_min, age_max, monthly_rate, effective_date }, ...]
 * Output: { [planId]: [rateRow, ...] }
 */
export function buildRatesByPlan(rateRows) {
  // Group all rows by plan
  const grouped = {}
  for (const row of rateRows) {
    const pid = row.medical_plan_id
    if (!grouped[pid]) grouped[pid] = []
    grouped[pid].push(row)
  }
  // For each plan, keep only rows with the maximum effective_date
  for (const pid of Object.keys(grouped)) {
    const rows = grouped[pid]
    const maxDate = rows.reduce((m, r) => (r.effective_date > m ? r.effective_date : m), '')
    grouped[pid] = rows.filter(r => r.effective_date === maxDate)
  }
  return grouped
}

/**
 * Calculate the total monthly premium for one plan across the entire census.
 *
 * CA small group dependent rating rules:
 *   - Employee: rated at their individual age
 *   - Spouse / Domestic Partner: rated at their individual age
 *   - Children: rated individually, but only the 3 OLDEST children
 *     (sorted by age descending → highest rates first).
 *     Children beyond the 3rd are covered at $0.
 *
 * Returns:
 *   totalPremium   — total monthly group premium
 *   employeeCount  — number of subscriber (Employee) records
 *   memberBreakdown — per-member detail array for drill-down display
 */
export function calculatePlanPremium(census, planRates, effectiveDate) {
  if (!planRates || planRates.length === 0) {
    return { totalPremium: 0, employeeCount: 0, memberBreakdown: [], hasRates: false }
  }

  // Build family units keyed by EID
  const families = {}
  for (const member of census) {
    const eid = member.eid
    if (!families[eid]) families[eid] = []
    families[eid].push(member)
  }

  let totalPremium = 0
  let employeeCount = 0
  const memberBreakdown = []

  for (const members of Object.values(families)) {
    const employee = members.find(m => m.relationship === 'Employee')
    if (!employee) continue // skip orphaned dependents
    employeeCount++

    // — Employee —
    const empAge = calculateAge(employee.date_of_birth, effectiveDate)
    const empRate = findRateForAge(planRates, empAge) ?? 0
    totalPremium += empRate
    memberBreakdown.push({
      eid: employee.eid,
      name: `${employee.first_name} ${employee.last_name}`,
      relationship: 'Employee',
      age: empAge,
      rate: empRate,
      capped: false,
    })

    // — Spouse / Domestic Partner —
    const spousesDPs = members.filter(m =>
      m.relationship === 'Spouse' || m.relationship === 'Domestic Partner'
    )
    for (const dep of spousesDPs) {
      const age = calculateAge(dep.date_of_birth, effectiveDate)
      const rate = findRateForAge(planRates, age) ?? 0
      totalPremium += rate
      memberBreakdown.push({
        eid: dep.eid,
        name: `${dep.first_name} ${dep.last_name}`,
        relationship: dep.relationship,
        age,
        rate,
        capped: false,
      })
    }

    // — Children: CA 3-child cap —
    // Sort oldest → youngest so the 3 highest rates are always charged.
    const children = members
      .filter(m => m.relationship === 'Child')
      .map(c => ({ ...c, age: calculateAge(c.date_of_birth, effectiveDate) }))
      .sort((a, b) => b.age - a.age) // oldest (= most expensive) first

    children.forEach((child, idx) => {
      const capped = idx >= 3
      const rate = capped ? 0 : (findRateForAge(planRates, child.age) ?? 0)
      totalPremium += rate
      memberBreakdown.push({
        eid: child.eid,
        name: `${child.first_name} ${child.last_name}`,
        relationship: 'Child',
        age: child.age,
        rate,
        capped, // true = covered free under 3-child rule
      })
    })
  }

  return { totalPremium, employeeCount, memberBreakdown, hasRates: true }
}

/**
 * Apply an employer contribution model to a plan's calculated premium.
 *
 * Flat dollar: employer pays $X per subscriber employee.
 *   Total employer cost = X * employeeCount (capped at totalPremium).
 *
 * Percentage: employer pays X% of the sum of all subscriber (Employee) rates.
 *   Dependents are always employee-paid.
 *
 * Returns:
 *   employerTotal  — total employer monthly contribution
 *   employeeTotal  — total employee monthly cost (totalPremium - employerTotal)
 *   avgPerEmployee — employeeTotal / employeeCount
 */
export function applyContribution(totalPremium, employeeCount, memberBreakdown, contribution) {
  const amount = parseFloat(contribution.value) || 0
  let employerTotal = 0

  if (contribution.type === 'flat') {
    employerTotal = Math.min(amount * employeeCount, totalPremium)
  } else if (contribution.type === 'percentage') {
    const pct = Math.min(amount, 100) / 100
    const employeeOnlyTotal = memberBreakdown
      .filter(m => m.relationship === 'Employee')
      .reduce((sum, m) => sum + m.rate, 0)
    employerTotal = Math.min(employeeOnlyTotal * pct, totalPremium)
  }

  const employeeTotal = Math.max(0, totalPremium - employerTotal)
  const avgPerEmployee = employeeCount > 0 ? employeeTotal / employeeCount : 0

  return {
    employerTotal: Math.round(employerTotal * 100) / 100,
    employeeTotal: Math.round(employeeTotal * 100) / 100,
    avgPerEmployee: Math.round(avgPerEmployee * 100) / 100,
  }
}

