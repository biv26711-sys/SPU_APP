export function roundToOneDecimal(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 10) / 10;
}

export function calcDurationDays(laborHours, performers, hoursPerDay) {
  const hours = Math.max(0, parseFloat(laborHours) || 0);
  const p = Math.max(1, parseInt(performers, 10) || 1);
  const dayHours = Math.max(0.1, parseFloat(hoursPerDay) || 0);
  if (hours === 0) return 0;
  return roundToOneDecimal(hours / (dayHours * p));
}

export function calcLaborHours(durationDays, performers, hoursPerDay) {
  const days = Math.max(0, parseFloat(durationDays) || 0);
  const p = Math.max(1, parseInt(performers, 10) || 1);
  const dayHours = Math.max(0.1, parseFloat(hoursPerDay) || 0);
  if (days === 0) return 0;
  return roundToOneDecimal(days * dayHours * p);
}
