import { useEffect, useState, useCallback } from 'react';
import {
  Briefcase, Calendar, Clock, DollarSign, MapPin, Plus, Users,
  Building2, FileText, CheckCircle2, XCircle, Stethoscope, Trash2,
  Video, Phone, MapPin as MapIcon, Award, FileUp, Download,
  Bell, User as UserIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type {
  Hospital, Job, Application, ApplicationWithNurse,
  HospitalDocument, Notification,
} from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge, Button, Input, Select, Spinner, EmptyState, Textarea, useToast } from '@/components/ui';
import { formatCurrency, formatDate, formatDateTime, cn, getInitials } from '@/lib/utils';

type Tab = 'jobs' | 'applications' | 'interviews' | 'profile' | 'documents' | 'notifications';

export function HospitalPortal({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { user } = useAuth();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [loadingHospital, setLoadingHospital] = useState(true);

  useEffect(() => {
    async function loadHospital() {
      const { data } = await supabase
        .from('hospitals')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      setHospital(data as Hospital | null);
      setLoadingHospital(false);
    }
    loadHospital();
  }, [user]);

  if (loadingHospital) return <Spinner className="py-20" />;

  if (!hospital) {
    return <CreateHospitalForm onCreated={(h) => setHospital(h)} />;
  }

  switch (tab) {
    case 'jobs': return <ManageJobs hospital={hospital} onNavigateApplications={() => setTab('applications')} />;
    case 'applications': return <ReviewApplications hospital={hospital} />;
    case 'interviews': return <ManageInterviews hospital={hospital} />;
    case 'profile': return <HospitalProfile hospital={hospital} onUpdate={setHospital} />;
    case 'documents': return <HospitalDocuments hospital={hospital} />;
    case 'notifications': return <HospitalNotifications />;
  }
}

// ============ CREATE HOSPITAL FORM ============
function CreateHospitalForm({ onCreated }: { onCreated: (h: Hospital) => void }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalType, setHospitalType] = useState<Hospital['hospital_type']>('private');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [beds, setBeds] = useState('');
  const [departments, setDepartments] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase.from('hospitals').insert({
      user_id: user!.id,
      name: hospitalName,
      hospital_name: hospitalName,
      hospital_type: hospitalType,
      location: `${city}, ${state}`,
      address, city, state, pincode,
      number_of_beds: beds ? parseInt(beds) : null,
      departments: departments || null,
      contact_person: contactPerson || null,
      phone: phone || null,
      contact_email: contactEmail || null,
      description: description || null,
    }).select().single();
    setSaving(false);
    if (error) { showToast('error', 'Failed to create hospital profile: ' + error.message); return; }
    if (data) { showToast('success', 'Hospital profile created successfully'); onCreated(data as Hospital); }
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
            <Building2 className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Set Up Your Hospital Profile</h2>
            <p className="text-sm text-slate-500">Tell nurses about your facility</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Hospital name" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} placeholder="St. Mary's Medical Center" required />
          <Select label="Hospital type" value={hospitalType || ''} onChange={(e) => setHospitalType(e.target.value as Hospital['hospital_type'])} required>
            <option value="private">Private</option>
            <option value="government">Government</option>
            <option value="trust">Trust</option>
            <option value="clinic">Clinic</option>
          </Select>
          <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Medical Drive" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} required />
            <Input label="State" value={state} onChange={(e) => setState(e.target.value)} required />
            <Input label="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Number of beds" type="number" min={0} value={beds} onChange={(e) => setBeds(e.target.value)} />
            <Input label="Departments" value={departments} onChange={(e) => setDepartments(e.target.value)} placeholder="ICU, ER, Surgery..." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Contact person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Input label="Contact email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your hospital..." rows={3} />
          <Button type="submit" disabled={saving} size="lg">{saving ? 'Creating...' : 'Create Hospital Profile'}</Button>
        </form>
      </Card>
    </div>
  );
}

// ============ MANAGE JOBS ============
function ManageJobs({ hospital, onNavigateApplications }: { hospital: Hospital; onNavigateApplications: () => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});

  const loadJobs = useCallback(async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('hospital_id', hospital.id)
      .order('created_at', { ascending: false });
    const jobList = data as Job[] || [];
    setJobs(jobList);
    setLoading(false);

    if (jobList.length > 0) {
      const { data: apps } = await supabase
        .from('applications')
        .select('job_id')
        .in('job_id', jobList.map((j) => j.id));
      const counts: Record<string, number> = {};
      (apps || []).forEach((a: { job_id: string }) => {
        if (a.job_id) counts[a.job_id] = (counts[a.job_id] || 0) + 1;
      });
      setAppCounts(counts);
    }
  }, [hospital.id]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  if (loading) return <Spinner className="py-20" />;

  const statusConfig: Record<string, { color: 'green' | 'blue' | 'amber' | 'red' | 'slate'; label: string }> = {
    active: { color: 'green', label: 'Active' },
    pending_approval: { color: 'amber', label: 'Pending Approval' },
    draft: { color: 'slate', label: 'Draft' },
    closed: { color: 'slate', label: 'Closed' },
    rejected: { color: 'red', label: 'Rejected' },
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} posted</p>
        <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Post New Job</Button>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-7 w-7" />}
          title="No jobs posted yet"
          description="Post your first job to start receiving applications from nurses."
          action={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Post New Job</Button>}
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const sc = statusConfig[job.status] || statusConfig.draft;
            return (
              <Card key={job.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{job.job_title}</h3>
                      <Badge color={sc.color}>{sc.label}</Badge>
                      <Badge color="slate">{job.vacancies} {job.vacancies === 1 ? 'opening' : 'openings'}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-500">
                      <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> {job.department}</span>
                      {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>}
                      {job.experience_required != null && <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {job.experience_required}+ yrs</span>}
                      {job.salary_min && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> {formatCurrency(job.salary_min)}+</span>}
                    </div>
                    {job.job_description && <p className="mt-2 text-sm text-slate-400 line-clamp-2">{job.job_description}</p>}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      onClick={onNavigateApplications}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
                    >
                      <Users className="h-4 w-4" />
                      {appCounts[job.id] || 0} {(appCounts[job.id] || 0) === 1 ? 'app' : 'apps'}
                    </button>
                    <JobActions job={job} onChanged={loadJobs} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <JobFormModal
          hospitalId={hospital.id}
          hospitalName={hospital.hospital_name || hospital.name}
          hospitalLocation={hospital.location}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); loadJobs(); }}
        />
      )}
    </div>
  );
}

function JobActions({ job, onChanged }: { job: Job; onChanged: () => void }) {
  const { showToast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this job? This will also delete all applications.')) return;
    setDeleting(true);
    const { error } = await supabase.from('jobs').delete().eq('id', job.id);
    setDeleting(false);
    if (error) { showToast('error', 'Failed to delete job: ' + error.message); return; }
    showToast('success', 'Job deleted');
    onChanged();
  }

  async function toggleStatus() {
    const newStatus = job.status === 'active' ? 'closed' : 'active';
    const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', job.id);
    if (error) { showToast('error', 'Failed to update job status'); return; }
    showToast('success', newStatus === 'active' ? 'Job reopened' : 'Job closed');
    onChanged();
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={toggleStatus} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title={job.status === 'active' ? 'Close job' : 'Reopen job'}>
        {job.status === 'active' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      </button>
      <button onClick={handleDelete} disabled={deleting} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete job">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function JobFormModal({ hospitalId, hospitalName, hospitalLocation, onClose, onCreated }: {
  hospitalId: string; hospitalName: string; hospitalLocation: string;
  onClose: () => void; onCreated: () => void;
}) {
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [qualificationReq, setQualificationReq] = useState('');
  const [experienceReq, setExperienceReq] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [location, setLocation] = useState(hospitalLocation || '');
  const [vacancies, setVacancies] = useState('1');
  const [accommodation, setAccommodation] = useState(false);
  const [description, setDescription] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error: err } = await supabase.from('jobs').insert({
      hospital_id: hospitalId,
      job_title: jobTitle,
      department,
      qualification_required: qualificationReq || null,
      experience_required: experienceReq ? parseInt(experienceReq) : null,
      salary_min: salaryMin ? parseFloat(salaryMin) : null,
      salary_max: salaryMax ? parseFloat(salaryMax) : null,
      location: location || null,
      vacancies: parseInt(vacancies) || 1,
      accommodation_available: accommodation,
      job_description: description || null,
      required_skills: requiredSkills || null,
      status: 'pending_approval',
    });

    setSaving(false);
    if (err) { showToast('error', 'Failed to post job: ' + err.message); return; }
    showToast('success', 'Job submitted for approval');
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Post a New Job</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="ICU Staff Nurse" required />
          <Input label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Intensive Care Unit" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Qualification required" value={qualificationReq} onChange={(e) => setQualificationReq(e.target.value)} placeholder="BSc Nursing" />
            <Input label="Experience required (years)" type="number" min={0} value={experienceReq} onChange={(e) => setExperienceReq(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Salary min (monthly)" type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="40000" />
            <Input label="Salary max (monthly)" type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="60000" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Mumbai, Maharashtra" />
            <Input label="Vacancies" type="number" min={1} value={vacancies} onChange={(e) => setVacancies(e.target.value)} />
          </div>
          <Input label="Required skills" value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} placeholder="ICU, Ventilator, Critical Care" />
          <Textarea label="Job description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the role and responsibilities..." rows={4} />
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={accommodation} onChange={(e) => setAccommodation(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-sm text-slate-700">Accommodation available</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Posting...' : 'Submit for Approval'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ REVIEW APPLICATIONS ============
function ReviewApplications({ hospital }: { hospital: Hospital }) {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationWithNurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingApps, setLoadingApps] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [schedulingApp, setSchedulingApp] = useState<ApplicationWithNurse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    async function loadJobs() {
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('hospital_id', hospital.id)
        .order('created_at', { ascending: false });
      const jobList = data as Job[] || [];
      setJobs(jobList);
      if (jobList.length > 0) setSelectedJobId(jobList[0].id);
      setLoading(false);
    }
    loadJobs();
  }, [hospital.id]);

  const loadApps = useCallback(async () => {
    if (!selectedJobId) return;
    setLoadingApps(true);
    const { data } = await supabase
      .from('applications')
      .select('*, profiles(id, full_name, profile_photo, email, phone, specialty, city, state, verification_status), nurse_profiles(qualification, total_experience, departments, verification_status, expected_salary), interviews(*)')
      .eq('job_id', selectedJobId)
      .order('created_at', { ascending: false });
    setApplications(data as ApplicationWithNurse[] || []);
    setLoadingApps(false);
  }, [selectedJobId]);

  useEffect(() => { loadApps(); }, [loadApps]);

  async function updateAppStatus(appId: string, nurseId: string, jobTitle: string, status: Application['status']) {
    setBusy(appId);
    const { error } = await supabase.from('applications').update({ status }).eq('id', appId);

    if (error) {
      setBusy(null);
      const msg = error.message.includes('completed interview')
        ? 'Cannot select without a completed interview. Schedule and complete an interview first.'
        : error.message;
      showToast('error', msg);
      return;
    }

    setApplications(applications.map((a) => a.id === appId ? { ...a, status } : a));

    const statusLabels: Record<string, string> = {
      under_review: 'Under Review', shortlisted: 'Shortlisted', selected: 'Selected',
      rejected: 'Rejected', joined: 'Joined', interview_scheduled: 'Interview Scheduled',
    };
    await supabase.rpc('create_notification', {
      p_user_id: nurseId,
      p_title: `Application ${statusLabels[status] || status}`,
      p_message: `Your application for ${jobTitle} has been ${statusLabels[status] || status}.`,
      p_type: 'application',
    });
    setBusy(null);
    showToast('success', `Application ${statusLabels[status] || status}.`);
  }

  async function scheduleInterview(app: ApplicationWithNurse, data: { date: string; time: string; type: 'in_person' | 'video' | 'phone'; link?: string; loc?: string; notes?: string }) {
    setBusy(app.id);
    const { error: ivError } = await supabase.from('interviews').insert({
      application_id: app.id,
      interview_date: data.date,
      interview_time: data.time,
      interview_type: data.type,
      meeting_link: data.link || null,
      location: data.loc || null,
      notes: data.notes || null,
      status: 'scheduled',
    });

    if (ivError) {
      setBusy(null);
      showToast('error', `Failed to schedule interview: ${ivError.message}`);
      return;
    }

    const { error: appError } = await supabase
      .from('applications')
      .update({ status: 'interview_scheduled' })
      .eq('id', app.id);

    if (appError) {
      setBusy(null);
      showToast('error', `Failed to update application: ${appError.message}`);
      return;
    }

    const jobTitle = jobs.find((j) => j.id === selectedJobId)?.job_title || '';
    await supabase.rpc('create_notification', {
      p_user_id: app.nurse_id,
      p_title: 'Interview Scheduled',
      p_message: `Your interview for ${jobTitle} has been scheduled for ${data.date} at ${data.time}.`,
      p_type: 'interview',
    });

    setBusy(null);
    setShowInterviewModal(false);
    setSchedulingApp(null);
    showToast('success', 'Interview scheduled successfully.');
    loadApps();
  }

  async function markInterviewCompleted(app: ApplicationWithNurse) {
    const completedInterview = app.interviews?.find((iv) => iv.status === 'scheduled');
    if (!completedInterview) return;
    setBusy(app.id);
    const { error } = await supabase
      .from('interviews')
      .update({ status: 'completed' })
      .eq('id', completedInterview.id);

    if (error) {
      setBusy(null);
      showToast('error', `Failed to mark interview complete: ${error.message}`);
      return;
    }

    const jobTitle = jobs.find((j) => j.id === selectedJobId)?.job_title || '';
    await supabase.rpc('create_notification', {
      p_user_id: app.nurse_id,
      p_title: 'Interview Completed',
      p_message: `Your interview for ${jobTitle} has been marked as completed. You will be notified of the outcome soon.`,
      p_type: 'interview',
    });

    setBusy(null);
    showToast('success', 'Interview marked as completed. You can now Select or Reject.');
    loadApps();
  }

  if (loading) return <Spinner className="py-20" />;

  if (jobs.length === 0) {
    return <EmptyState icon={<FileText className="h-7 w-7" />} title="No jobs to review" description="Post jobs first, then you'll see applications here." />;
  }

  const statusConfig: Record<string, { color: 'amber' | 'blue' | 'green' | 'red' | 'slate' | 'teal'; label: string }> = {
    applied: { color: 'blue', label: 'Applied' },
    under_review: { color: 'amber', label: 'Under Review' },
    shortlisted: { color: 'teal', label: 'Shortlisted' },
    interview_scheduled: { color: 'blue', label: 'Interview Stage' },
    selected: { color: 'green', label: 'Selected' },
    joined: { color: 'green', label: 'Joined' },
    rejected: { color: 'red', label: 'Rejected' },
  };

  const jobTitle = jobs.find((j) => j.id === selectedJobId)?.job_title || '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {jobs.map((job) => (
          <button
            key={job.id}
            onClick={() => setSelectedJobId(job.id)}
            className={cn(
              'rounded-lg border px-3.5 py-2 text-sm font-medium transition-all',
              selectedJobId === job.id ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            )}
          >
            {job.job_title}
          </button>
        ))}
      </div>

      {loadingApps ? (
        <Spinner className="py-12" />
      ) : applications.length === 0 ? (
        <EmptyState icon={<Users className="h-7 w-7" />} title="No applications yet" description="When nurses apply for this job, they'll appear here for review." />
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const sc = statusConfig[app.status] || statusConfig.applied;
            const p = app.profiles;
            const np = app.nurse_profiles;
            const scheduledInterview = app.interviews?.find((iv) => iv.status === 'scheduled');
            const completedInterview = app.interviews?.find((iv) => iv.status === 'completed');
            const interviewReady = !!completedInterview;

            return (
              <Card key={app.id} className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                      {p?.full_name ? getInitials(p.full_name) : <UserIcon className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold text-slate-900">{p?.full_name}</h3>
                        <Badge color={sc.color}>{sc.label}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        {np?.qualification && <span>{np.qualification}</span>}
                        {np?.total_experience != null && <span>{np.total_experience} yrs exp</span>}
                        {np?.departments && <span>{np.departments}</span>}
                      </div>
                    </div>
                  </div>
                  {app.cover_message && <p className="mt-2 text-sm text-slate-400">"{app.cover_message}"</p>}
                  <p className="mt-1.5 text-xs text-slate-400">Applied {formatDateTime(app.created_at)}</p>

                  {/* Interview details when scheduled or completed */}
                  {(scheduledInterview || completedInterview) && (() => {
                    const iv = completedInterview || scheduledInterview!;
                    return (
                      <div className={cn(
                        'mt-3 rounded-lg border p-3 text-sm',
                        completedInterview ? 'border-emerald-200 bg-emerald-50/50' : 'border-blue-200 bg-blue-50/50'
                      )}>
                        <div className="flex items-center gap-2 font-medium text-slate-700">
                          {completedInterview ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Calendar className="h-4 w-4 text-blue-600" />}
                          Interview {iv.status === 'completed' ? 'Completed' : 'Scheduled'}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {formatDate(iv.interview_date)}</span>
                          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {iv.interview_time}</span>
                          <span className="flex items-center gap-1.5 capitalize">
                            {iv.interview_type === 'in_person' ? <MapIcon className="h-3.5 w-3.5" /> : iv.interview_type === 'video' ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                            {iv.interview_type.replace('_', ' ')}
                          </span>
                        </div>
                        {iv.meeting_link && <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-primary-600 hover:underline"><Video className="h-3 w-3" /> Join meeting</a>}
                        {iv.notes && <p className="mt-1.5 text-xs text-slate-500">{iv.notes}</p>}
                      </div>
                    );
                  })()}
                </div>

                <div className="shrink-0">
                  {app.status === 'applied' || app.status === 'pending' ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="danger" disabled={busy === app.id} onClick={() => updateAppStatus(app.id, app.nurse_id, jobTitle, 'rejected')}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button size="sm" disabled={busy === app.id} onClick={() => updateAppStatus(app.id, app.nurse_id, jobTitle, 'shortlisted')}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Shortlist
                      </Button>
                    </div>
                  ) : app.status === 'shortlisted' ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="danger" disabled={busy === app.id} onClick={() => updateAppStatus(app.id, app.nurse_id, jobTitle, 'rejected')}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button size="sm" disabled={busy === app.id} onClick={() => { setSchedulingApp(app); setShowInterviewModal(true); }}>
                        <Calendar className="h-3.5 w-3.5" /> Schedule Interview
                      </Button>
                    </div>
                  ) : app.status === 'interview_scheduled' && !interviewReady ? (
                    <Button size="sm" disabled={busy === app.id} onClick={() => markInterviewCompleted(app)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Interview Completed
                    </Button>
                  ) : app.status === 'interview_scheduled' && interviewReady ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="danger" disabled={busy === app.id} onClick={() => updateAppStatus(app.id, app.nurse_id, jobTitle, 'rejected')}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button size="sm" disabled={busy === app.id} onClick={() => updateAppStatus(app.id, app.nurse_id, jobTitle, 'selected')}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Select
                      </Button>
                    </div>
                  ) : app.status === 'selected' ? (
                    <Button size="sm" variant="secondary" disabled={busy === app.id} onClick={() => updateAppStatus(app.id, app.nurse_id, jobTitle, 'joined')}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Joined
                    </Button>
                  ) : (
                    <Badge color={sc.color}>{sc.label}</Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showInterviewModal && schedulingApp && (
        <ScheduleInterviewModal
          nurseName={schedulingApp.profiles?.full_name || 'Candidate'}
          jobTitle={jobTitle}
          onClose={() => { setShowInterviewModal(false); setSchedulingApp(null); }}
          onSchedule={(data) => scheduleInterview(schedulingApp, data)}
          saving={busy === schedulingApp.id}
        />
      )}
    </div>
  );
}

// ============ SCHEDULE INTERVIEW MODAL ============
function ScheduleInterviewModal({ nurseName, jobTitle, onClose, onSchedule, saving }: {
  nurseName: string;
  jobTitle: string;
  onClose: () => void;
  onSchedule: (data: { date: string; time: string; type: 'in_person' | 'video' | 'phone'; link?: string; loc?: string; notes?: string }) => void;
  saving: boolean;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<'in_person' | 'video' | 'phone'>('video');
  const [link, setLink] = useState('');
  const [loc, setLoc] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) { setError('Please select a date and time.'); return; }
    if (type === 'video' && !link) { setError('Please provide a meeting link for video interviews.'); return; }
    if (type === 'in_person' && !loc) { setError('Please provide a location for in-person interviews.'); return; }
    setError(null);
    onSchedule({ date, time, type, link: link || undefined, loc: loc || undefined, notes: notes || undefined });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
        <h2 className="mb-1 text-lg font-bold text-slate-900">Schedule Interview</h2>
        <p className="mb-4 text-sm text-slate-500">{nurseName} — {jobTitle}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
          <Select label="Interview type" value={type} onChange={(e) => setType(e.target.value as 'in_person' | 'video' | 'phone')}>
            <option value="video">Video Call</option>
            <option value="in_person">In Person</option>
            <option value="phone">Phone Call</option>
          </Select>
          {type === 'video' && (
            <Input label="Meeting link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." />
          )}
          {type === 'in_person' && (
            <Input label="Location" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Conference Room A, 3rd Floor" />
          )}
          <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any instructions for the candidate..." rows={3} />

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Scheduling...' : 'Schedule Interview'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ MANAGE INTERVIEWS ============
function ManageInterviews({ hospital }: { hospital: Hospital }) {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const { data: jobs } = await supabase.from('jobs').select('id').eq('hospital_id', hospital.id);
      const jobIds = (jobs || []).map((j: { id: string }) => j.id);
      if (jobIds.length === 0) { setLoading(false); return; }

      const { data: apps } = await supabase
        .from('applications')
        .select('*, jobs!inner(id, job_title, department, hospitals!inner(id, hospital_name, name)), profiles(full_name)')
        .in('job_id', jobIds)
        .in('status', ['shortlisted', 'interview_scheduled']);

      const appIds = (apps || []).map((a: { id: string }) => a.id);
      let ivData: any[] = [];
      if (appIds.length > 0) {
        const { data: ivs } = await supabase
          .from('interviews')
          .select('*, applications!inner(id, nurse_id, jobs!inner(job_title, hospitals!inner(hospital_name, name)), profiles(full_name))')
          .in('application_id', appIds)
          .order('interview_date', { ascending: true });
        ivData = ivs || [];
      }

      setInterviews(ivData);
      setLoading(false);
    }
    load();
  }, [hospital.id]);

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{interviews.length} {interviews.length === 1 ? 'interview' : 'interviews'} scheduled</p>
      </div>

      {interviews.length === 0 ? (
        <EmptyState
          icon={<Video className="h-7 w-7" />}
          title="No interviews scheduled"
          description="Shortlist candidates from the Applications tab, then schedule interviews here."
        />
      ) : (
        <div className="space-y-3">
          {interviews.map((iv) => (
            <Card key={iv.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{iv.applications?.profiles?.full_name}</h3>
                    <Badge color={iv.status === 'scheduled' ? 'blue' : iv.status === 'completed' ? 'green' : iv.status === 'cancelled' ? 'red' : 'amber'}>
                      {iv.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{iv.applications?.jobs?.job_title}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" /> {formatDate(iv.interview_date)}</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-400" /> {iv.interview_time}</span>
                    <span className="flex items-center gap-1.5 capitalize">
                      {iv.interview_type === 'in_person' ? <MapIcon className="h-4 w-4" /> : iv.interview_type === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                      {iv.interview_type.replace('_', ' ')}
                    </span>
                  </div>
                  {iv.meeting_link && <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline"><Video className="h-3.5 w-3.5" /> Join meeting</a>}
                  {iv.notes && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{iv.notes}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ HOSPITAL PROFILE ============
function HospitalProfile({ hospital, onUpdate }: { hospital: Hospital; onUpdate: (h: Hospital) => void }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [hospitalName, setHospitalName] = useState(hospital.hospital_name || hospital.name);
  const [hospitalType, setHospitalType] = useState<Hospital['hospital_type']>(hospital.hospital_type);
  const [address, setAddress] = useState(hospital.address || '');
  const [city, setCity] = useState(hospital.city || '');
  const [state, setState] = useState(hospital.state || '');
  const [pincode, setPincode] = useState(hospital.pincode || '');
  const [beds, setBeds] = useState(hospital.number_of_beds?.toString() || '');
  const [departments, setDepartments] = useState(hospital.departments || '');
  const [contactPerson, setContactPerson] = useState(hospital.contact_person || '');
  const [phone, setPhone] = useState(hospital.phone || '');
  const [contactEmail, setContactEmail] = useState(hospital.contact_email || '');
  const [description, setDescription] = useState(hospital.description || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const { data, error } = await supabase.from('hospitals').update({
      hospital_name: hospitalName,
      name: hospitalName,
      hospital_type: hospitalType,
      address, city, state, pincode,
      number_of_beds: beds ? parseInt(beds) : null,
      departments: departments || null,
      contact_person: contactPerson || null,
      phone: phone || null,
      contact_email: contactEmail || null,
      description: description || null,
      location: `${city}, ${state}`,
    }).eq('id', hospital.id).select().single();
    setSaving(false);
    if (error) { showToast('error', 'Failed to save profile: ' + error.message); return; }
    setSaved(true);
    showToast('success', 'Profile saved successfully');
    setTimeout(() => setSaved(false), 3000);
    if (data) onUpdate(data as Hospital);
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-100">
            <Building2 className="h-8 w-8 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{hospital.hospital_name || hospital.name}</h2>
            <p className="text-sm text-slate-500">{hospital.city}, {hospital.state}</p>
            <Badge color={hospital.verification_status === 'verified' ? 'green' : hospital.verification_status === 'rejected' ? 'red' : 'amber'}>
              <Award className="h-3 w-3" /> {hospital.verification_status}
            </Badge>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Hospital name" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} required />
          <Select label="Hospital type" value={hospitalType || ''} onChange={(e) => setHospitalType(e.target.value as Hospital['hospital_type'])}>
            <option value="private">Private</option>
            <option value="government">Government</option>
            <option value="trust">Trust</option>
            <option value="clinic">Clinic</option>
          </Select>
          <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} required />
            <Input label="State" value={state} onChange={(e) => setState(e.target.value)} required />
            <Input label="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Number of beds" type="number" min={0} value={beds} onChange={(e) => setBeds(e.target.value)} />
            <Input label="Departments" value={departments} onChange={(e) => setDepartments(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Contact person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Input label="Contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            {saved && <span className="text-sm text-emerald-600 animate-fade-in">Saved successfully</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}

// ============ HOSPITAL DOCUMENTS ============
function HospitalDocuments({ hospital }: { hospital: Hospital }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [docs, setDocs] = useState<HospitalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const docTypes: { value: HospitalDocument['document_type']; label: string }[] = [
    { value: 'registration', label: 'Hospital Registration' },
    { value: 'license', label: 'Medical License' },
    { value: 'tax', label: 'Tax Document' },
    { value: 'other', label: 'Other' },
  ];

  async function loadDocs() {
    const { data } = await supabase.from('hospital_documents').select('*').eq('hospital_id', hospital.id).order('created_at', { ascending: false });
    setDocs(data as HospitalDocument[] || []);
    setLoading(false);
  }

  useEffect(() => { loadDocs(); }, []);

  async function uploadFile(file: File, docType: HospitalDocument['document_type']) {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `${hospital.id}/${docType}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('hospital-documents').upload(fileName, file);
    if (uploadError) { showToast('error', 'Upload failed: ' + uploadError.message); setUploading(false); return; }

    const { error: dbError } = await supabase.from('hospital_documents').insert({
      hospital_id: hospital.id, document_type: docType,
      file_name: file.name, file_url: fileName, file_size: file.size, mime_type: file.type,
    });
    if (dbError) { showToast('error', 'Failed to save document: ' + dbError.message); setUploading(false); return; }
    setUploading(false);
    showToast('success', 'Document uploaded successfully');
    loadDocs();
  }

  async function deleteDoc(doc: HospitalDocument) {
    if (!confirm('Delete this document?')) return;
    const { error: storageError } = await supabase.storage.from('hospital-documents').remove([doc.file_url]);
    if (storageError) { showToast('error', 'Failed to delete file: ' + storageError.message); return; }
    const { error: dbError } = await supabase.from('hospital_documents').delete().eq('id', doc.id);
    if (dbError) { showToast('error', 'Failed to delete document: ' + dbError.message); return; }
    setDocs(docs.filter((d) => d.id !== doc.id));
    showToast('success', 'Document deleted');
  }

  async function downloadDoc(doc: HospitalDocument) {
    const { data, error } = await supabase.storage.from('hospital-documents').createSignedUrl(doc.file_url, 3600);
    if (error) { showToast('error', 'Failed to generate download link'); return; }
    if (data) window.open(data.signedUrl, '_blank');
  }

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="max-w-3xl space-y-5">
      <Card>
        <h3 className="mb-4 font-semibold text-slate-900">Upload Documents</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {docTypes.map((dt) => (
            <label key={dt.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 p-4 transition-colors hover:border-primary-400 hover:bg-primary-50/30">
              <FileUp className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">{dt.label}</span>
              <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, dt.value); }} disabled={uploading} />
            </label>
          ))}
        </div>
        {uploading && <p className="mt-3 text-sm text-primary-600">Uploading...</p>}
      </Card>

      {docs.length === 0 ? (
        <EmptyState icon={<FileText className="h-7 w-7" />} title="No documents uploaded" description="Upload your hospital registration and license documents for verification." />
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <Card key={doc.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100"><FileText className="h-5 w-5 text-slate-500" /></div>
                <div>
                  <div className="text-sm font-medium text-slate-800">{doc.file_name}</div>
                  <div className="text-xs text-slate-500 capitalize">{doc.document_type}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge color={doc.verification_status === 'verified' ? 'green' : doc.verification_status === 'rejected' ? 'red' : 'amber'}>{doc.verification_status}</Badge>
                <button onClick={() => downloadDoc(doc)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"><Download className="h-4 w-4" /></button>
                <button onClick={() => deleteDoc(doc)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ HOSPITAL NOTIFICATIONS ============
function HospitalNotifications() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    setNotifications(data as Notification[] || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function markAllRead() {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user!.id).eq('is_read', false);
    if (error) { showToast('error', 'Failed to mark notifications as read'); return; }
    setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
  }

  if (loading) return <Spinner className="py-20" />;

  if (notifications.length === 0) {
    return <EmptyState icon={<Bell className="h-7 w-7" />} title="No notifications" description="You'll see updates about job approvals and applications here." />;
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button></div>
      {notifications.map((n) => (
        <Card key={n.id} className={cn('flex items-start gap-3', !n.is_read && 'border-primary-200 bg-primary-50/30')}>
          <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', n.is_read ? 'bg-slate-100 text-slate-400' : 'bg-primary-100 text-primary-600')}>
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-slate-900">{n.title}</h3>
              {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary-500" />}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{n.message}</p>
            <p className="mt-1 text-xs text-slate-400">{formatDate(n.created_at)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
