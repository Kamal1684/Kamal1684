const norm = (v) => String(v || "").trim().toLowerCase();

export function computeMatch(nurse, job) {
  if (!nurse || !job) return null;
  const checks = [];
  if (job.department) {
    const deps = (nurse.departments || []).map(norm);
    checks.push({ label: "Department", weight: 25, matched: deps.includes(norm(job.department)) });
  }
  if (job.location) {
    const locs = [norm(nurse.preferred_location), norm(nurse.city)].filter(Boolean);
    checks.push({ label: "Location", weight: 20, matched: locs.some((l) => norm(job.location).includes(l) || l.includes(norm(job.location))) });
  }
  if (job.shift) {
    const s = norm(nurse.preferred_shift);
    checks.push({ label: "Shift", weight: 15, matched: !!s && (s === norm(job.shift) || s === "flexible" || norm(job.shift) === "flexible") });
  }
  if (job.experience_required !== undefined && job.experience_required !== null && job.experience_required !== "") {
    checks.push({ label: "Experience", weight: 20, matched: Number(nurse.experience_years || 0) >= Number(job.experience_required) });
  }
  if (job.qualification_required) {
    checks.push({ label: "Qualification", weight: 10, matched: norm(nurse.qualification).includes(norm(job.qualification_required)) || norm(job.qualification_required).includes(norm(nurse.qualification)) });
  }
  if (job.salary_max) {
    checks.push({ label: "Salary", weight: 10, matched: !nurse.expected_salary || Number(job.salary_max) >= Number(nurse.expected_salary) });
  }
  const total = checks.reduce((a, c) => a + c.weight, 0);
  if (!total) return null;
  const earned = checks.reduce((a, c) => a + (c.matched ? c.weight : 0), 0);
  return { score: Math.round((earned / total) * 100), breakdown: checks };
}

export const REQUIRED_PROFILE_FIELDS = ["full_name", "phone", "city", "qualification", "experience_years", "departments"];

export function isProfileComplete(nurse) {
  if (!nurse) return false;
  return REQUIRED_PROFILE_FIELDS.every((f) => {
    const v = nurse[f];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && String(v).trim() !== "";
  });
}

export const PROFILE_FIELDS = [
  "full_name", "phone", "city", "state", "qualification", "registration_number",
  "experience_years", "departments", "preferred_location", "expected_salary", "preferred_shift",
];

export function profileCompletion(nurse) {
  if (!nurse) return 0;
  const filled = PROFILE_FIELDS.filter((f) => {
    const v = nurse[f];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && String(v).trim() !== "";
  });
  return Math.round((filled.length / PROFILE_FIELDS.length) * 100);
}

export const nurseSnapshot = (p) => !p ? {} : {
  nurse_name: p.full_name, nurse_phone: p.phone, nurse_qualification: p.qualification,
  nurse_experience_years: p.experience_years, nurse_departments: p.departments || [],
  nurse_location: [p.city, p.state].filter(Boolean).join(", "), nurse_city: p.city,
  nurse_verification_status: p.verification_status, nurse_preferred_shift: p.preferred_shift,
  nurse_expected_salary: p.expected_salary, nurse_preferred_location: p.preferred_location,
  nurse_accommodation_required: !!p.accommodation_required,
};

export const snapshotToNurse = (a) => ({
  full_name: a.nurse_name, qualification: a.nurse_qualification, experience_years: a.nurse_experience_years,
  departments: a.nurse_departments || [], city: a.nurse_city, preferred_location: a.nurse_preferred_location,
  preferred_shift: a.nurse_preferred_shift, expected_salary: a.nurse_expected_salary,
});
