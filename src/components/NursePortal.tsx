import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Calendar, Clock, DollarSign, MapPin, Search, Stethoscope, Send, Briefcase,
  User as UserIcon, CheckCircle2, XCircle, FileText, Bookmark, BookmarkCheck,
  Video, Phone, MapPin as MapIcon, Bell, Award, Building2, FileUp,
  Trash2, Download, Home as HomeIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type {
  JobWithHospital, Application, ApplicationWithJob, NurseProfile,
  NurseDocument, SavedJob, Notification, InterviewWithApplication,
} from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge, Button, Input, Select, Spinner, EmptyState, Textarea, useToast } from '@/components/ui';
import {
  formatCurrency, formatDate, cn, getInitials,
} from '@/lib/utils';

type Tab = 'browse' | 'applications' | 'saved' | 'interviews' | 'profile' | 'documents' | 'notifications';

export function NursePortal({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  switch (tab) {
    case 'browse': return <BrowseJobs />;
    case 'applications': return <MyApplications />;
    case 'saved': return <SavedJobs onBrowse={() => setTab('browse')} />;
    case 'interviews': return <MyInterviews />;
    case 'profile': return <NurseProfileTab />;
    case 'documents': return <MyDocuments />;
    case 'notifications': return <MyNotifications />;
  }
}

// ============ BROWSE JOBS ============
function BrowseJobs() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<JobWithHospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<JobWithHospital | null>(null);
  const [coverMessage, setCoverMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: jobData }, { data: appData }, { data: savedData }] = await Promise.all([
      supabase
        .from('jobs')
        .select('*, hospitals(id, hospital_name, name, city, state, verification_status)')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase.from('applications').select('job_id').eq('nurse_id', user!.id).not('job_id', 'is', null),
      supabase.from('saved_jobs').select('job_id').eq('nurse_id', user!.id),
    ]);

    setJobs(jobData as JobWithHospital[] || []);
    setAppliedJobIds(new Set((appData as Application[] || []).map((a) => a.job_id).filter(Boolean) as string[]));
    setSavedJobIds(new Set((savedData as SavedJob[] || []).map((s) => s.job_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => { if (j.department) set.add(j.department); });
    return Array.from(set).sort();
  }, [jobs]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => { if (j.location) set.add(j.location); });
    return Array.from(set).sort();
  }, [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (filterDept !== 'all' && j.department !== filterDept) return false;
      if (filterLocation !== 'all' && j.location !== filterLocation) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          j.job_title.toLowerCase().includes(q) ||
          j.department.toLowerCase().includes(q) ||
          j.hospitals?.hospital_name?.toLowerCase().includes(q) ||
          j.hospitals?.name?.toLowerCase().includes(q) ||
          j.location?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [jobs, search, filterDept, filterLocation]);

  async function handleApply() {
    if (!selectedJob || !user) return;
    setApplying(true);
    setApplyError(null);

    const { error } = await supabase.from('applications').insert({
      job_id: selectedJob.id,
      nurse_id: user.id,
      status: 'applied',
      cover_message: coverMessage || null,
    });

    if (error) {
      setApplyError(error.message);
      setApplying(false);
      return;
    }

    await supabase.rpc('create_notification', {
      p_user_id: user.id,
      p_title: 'Application Submitted',
      p_message: `You applied for ${selectedJob.job_title}`,
      p_type: 'application',
    });

    setAppliedJobIds(new Set([...appliedJobIds, selectedJob.id]));
    setSelectedJob(null);
    setCoverMessage('');
    setApplying(false);
    showToast('success', 'Application submitted successfully!');
  }

  async function toggleSave(jobId: string) {
    if (savedJobIds.has(jobId)) {
      const { error } = await supabase.from('saved_jobs').delete().eq('nurse_id', user!.id).eq('job_id', jobId);
      if (error) { showToast('error', 'Failed to remove saved job'); return; }
      setSavedJobIds(new Set([...savedJobIds].filter((id) => id !== jobId)));
    } else {
      const { error } = await supabase.from('saved_jobs').insert({ nurse_id: user!.id, job_id: jobId });
      if (error) { showToast('error', 'Failed to save job'); return; }
      setSavedJobIds(new Set([...savedJobIds, jobId]));
    }
  }

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search jobs, departments, hospitals..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="sm:w-44">
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
        <Select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="sm:w-40">
          <option value="all">All locations</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
      </div>

      <p className="text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? 'job' : 'jobs'} available</p>

      {filtered.length === 0 ? (
        <EmptyState icon={<Briefcase className="h-7 w-7" />} title="No jobs found" description="Try adjusting your search or filters to find available positions." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((job) => {
            const hospitalName = job.hospitals?.hospital_name || job.hospitals?.name || 'Hospital';
            const hospitalLocation = [job.hospitals?.city, job.hospitals?.state].filter(Boolean).join(', ') || job.location || '';
            return (
              <Card key={job.id} className="flex flex-col">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{job.job_title}</h3>
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{hospitalName}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSave(job.id)}
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 transition-colors"
                    title={savedJobIds.has(job.id) ? 'Unsave' : 'Save job'}
                  >
                    {savedJobIds.has(job.id) ? <BookmarkCheck className="h-5 w-5 text-primary-600" /> : <Bookmark className="h-5 w-5" />}
                  </button>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-slate-400" /> {job.department}</div>
                  {job.location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /> {job.location}</div>}
                  {job.experience_required != null && <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-slate-400" /> {job.experience_required}+ yrs experience</div>}
                  {job.salary_min && job.salary_max && (
                    <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-slate-400" /> {formatCurrency(job.salary_min)} – {formatCurrency(job.salary_max)}</div>
                  )}
                  {job.required_skills && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {job.required_skills.split(',').slice(0, 3).map((s, i) => (
                        <Badge key={i} color="teal">{s.trim()}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Badge color={job.vacancies > 1 ? 'blue' : 'slate'}>{job.vacancies} {job.vacancies === 1 ? 'opening' : 'openings'}</Badge>
                    {job.accommodation_available && <Badge color="green"><HomeIcon className="h-3 w-3" /> Housing</Badge>}
                  </div>
                  {appliedJobIds.has(job.id) ? (
                    <Badge color="green"><CheckCircle2 className="h-3 w-3" /> Applied</Badge>
                  ) : (
                    <Button size="sm" onClick={() => { setSelectedJob(job); setCoverMessage(''); setApplyError(null); }}>
                      <Send className="h-3.5 w-3.5" /> Apply
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selectedJob && (
        <Modal onClose={() => setSelectedJob(null)} title="Apply for Position">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">{selectedJob.job_title}</h3>
              <p className="mt-1 text-sm text-slate-600">{selectedJob.hospitals?.hospital_name || selectedJob.hospitals?.name} — {selectedJob.department}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                {selectedJob.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedJob.location}</span>}
                {selectedJob.salary_min && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> {formatCurrency(selectedJob.salary_min)}+</span>}
              </div>
              {selectedJob.job_description && <p className="mt-2 text-sm text-slate-600">{selectedJob.job_description}</p>}
            </div>

            <Textarea
              label="Cover message (optional)"
              value={coverMessage}
              onChange={(e) => setCoverMessage(e.target.value)}
              placeholder="Tell the hospital why you're a great fit..."
              rows={4}
            />

            {applyError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{applyError}</div>}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setSelectedJob(null)}>Cancel</Button>
              <Button onClick={handleApply} disabled={applying}>{applying ? 'Submitting...' : 'Submit Application'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============ MY APPLICATIONS ============
function MyApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('applications')
        .select('*, jobs(*, hospitals(id, hospital_name, name, city, state)), profiles(id, full_name, profile_photo, email, phone, specialty, city, state)')
        .eq('nurse_id', user!.id)
        .not('job_id', 'is', null)
        .order('created_at', { ascending: false });
      setApplications(data as ApplicationWithJob[] || []);
      setLoading(false);
    }
    load();
  }, [user]);

  const filtered = filter === 'all' ? applications : applications.filter((a) => a.status === filter);

  const statusConfig: Record<string, { color: 'amber' | 'blue' | 'green' | 'red' | 'slate' | 'teal'; label: string }> = {
    applied: { color: 'blue', label: 'Applied' },
    under_review: { color: 'amber', label: 'Under Review' },
    shortlisted: { color: 'teal', label: 'Shortlisted' },
    interview_scheduled: { color: 'blue', label: 'Interview Scheduled' },
    selected: { color: 'green', label: 'Selected' },
    joined: { color: 'green', label: 'Joined' },
    rejected: { color: 'red', label: 'Rejected' },
    pending: { color: 'amber', label: 'Pending' },
    accepted: { color: 'green', label: 'Accepted' },
    withdrawn: { color: 'slate', label: 'Withdrawn' },
  };

  if (loading) return <Spinner className="py-20" />;

  const filterOptions = ['all', 'applied', 'under_review', 'shortlisted', 'interview_scheduled', 'selected', 'rejected'];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              filter === f ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:bg-slate-100'
            )}
          >
            {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-7 w-7" />} title="No applications yet" description="Browse available jobs and apply to start your job search." />
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => {
            const sc = statusConfig[app.status] || statusConfig.applied;
            const job = app.jobs;
            const hospitalName = job?.hospitals?.hospital_name || job?.hospitals?.name || 'Hospital';
            return (
              <Card key={app.id} className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-slate-900">{job?.job_title || 'Position'}</h3>
                    <Badge color={sc.color}>{sc.label}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {hospitalName}</span>
                    <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> {job?.department}</span>
                    {job?.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>}
                  </div>
                  {app.cover_message && <p className="mt-2 text-sm text-slate-400">"{app.cover_message}"</p>}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-slate-400">Applied</div>
                  <div className="text-sm text-slate-600">{formatDate(app.created_at)}</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ SAVED JOBS ============
function SavedJobs({ onBrowse }: { onBrowse: () => void }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [saved, setSaved] = useState<(SavedJob & { jobs: JobWithHospital['jobs'] & { hospitals: JobWithHospital['hospitals'] } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('saved_jobs')
        .select('*, jobs(*, hospitals(id, hospital_name, name, city, state, verification_status))')
        .eq('nurse_id', user!.id)
        .order('created_at', { ascending: false });
      setSaved(data as any || []);
      setLoading(false);
    }
    load();
  }, [user]);

  async function removeSaved(jobId: string) {
    const { error } = await supabase.from('saved_jobs').delete().eq('nurse_id', user!.id).eq('job_id', jobId);
    if (error) { showToast('error', 'Failed to remove saved job'); return; }
    setSaved(saved.filter((s) => s.job_id !== jobId));
    showToast('success', 'Job removed from saved');
  }

  if (loading) return <Spinner className="py-20" />;

  if (saved.length === 0) {
    return (
      <EmptyState
        icon={<Bookmark className="h-7 w-7" />}
        title="No saved jobs"
        description="Save jobs you're interested in to find them quickly later."
        action={<Button onClick={onBrowse}>Browse Jobs</Button>}
      />
    );
  }

  return (
    <div className="space-y-3">
      {saved.map((s) => {
        const job = s.jobs;
        const hospitalName = job?.hospitals?.hospital_name || job?.hospitals?.name || 'Hospital';
        return (
          <Card key={s.id} className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-900">{job?.job_title}</h3>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {hospitalName}</span>
                <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> {job?.department}</span>
                {job?.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>}
              </div>
            </div>
            <button
              onClick={() => removeSaved(s.job_id)}
              className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Remove from saved"
            >
              <BookmarkCheck className="h-5 w-5" />
            </button>
          </Card>
        );
      })}
    </div>
  );
}

// ============ MY INTERVIEWS ============
function MyInterviews() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<InterviewWithApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('interviews')
        .select('*, applications!inner(*, jobs!inner(id, job_title, department, hospitals(id, hospital_name, name)))')
        .eq('applications.nurse_id', user!.id)
        .order('interview_date', { ascending: true });
      setInterviews(data as InterviewWithApplication[] || []);
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) return <Spinner className="py-20" />;

  if (interviews.length === 0) {
    return (
      <EmptyState
        icon={<Video className="h-7 w-7" />}
        title="No interviews scheduled"
        description="When a hospital schedules an interview with you, it will appear here."
      />
    );
  }

  const typeIcon: Record<string, React.ReactNode> = {
    in_person: <MapIcon className="h-4 w-4" />,
    video: <Video className="h-4 w-4" />,
    phone: <Phone className="h-4 w-4" />,
  };

  return (
    <div className="space-y-3">
      {interviews.map((iv) => (
        <Card key={iv.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">{iv.applications.jobs?.job_title}</h3>
                <Badge color={iv.status === 'scheduled' ? 'blue' : iv.status === 'completed' ? 'green' : iv.status === 'cancelled' ? 'red' : 'amber'}>
                  {iv.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">{iv.applications.jobs?.hospitals?.hospital_name || iv.applications.jobs?.hospitals?.name}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" /> {formatDate(iv.interview_date)}</span>
                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-400" /> {iv.interview_time}</span>
                <span className="flex items-center gap-1.5 capitalize">{typeIcon[iv.interview_type]} {iv.interview_type.replace('_', ' ')}</span>
                {iv.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-slate-400" /> {iv.location}</span>}
              </div>
              {iv.meeting_link && (
                <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
                  <Video className="h-3.5 w-3.5" /> Join meeting
                </a>
              )}
              {iv.notes && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{iv.notes}</p>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============ NURSE PROFILE ============
function NurseProfileTab() {
  const { profile, user, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [nurseProfile, setNurseProfile] = useState<NurseProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [city, setCity] = useState(profile?.city || '');
  const [state, setState] = useState(profile?.state || '');
  const [bio, setBio] = useState(profile?.bio || '');

  const [qualification, setQualification] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [regAuthority, setRegAuthority] = useState('');
  const [totalExp, setTotalExp] = useState('');
  const [prevHospital, setPrevHospital] = useState('');
  const [departments, setDepartments] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [shiftPref, setShiftPref] = useState<NurseProfile['shift_preference']>('flexible');
  const [availability, setAvailability] = useState<NurseProfile['availability']>('immediately');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('nurse_profiles')
        .select('*')
        .eq('nurse_id', user!.id)
        .maybeSingle();

      if (data) {
        const np = data as NurseProfile;
        setNurseProfile(np);
        setQualification(np.qualification || '');
        setRegNumber(np.nursing_registration_number || '');
        setRegAuthority(np.registration_authority || '');
        setTotalExp(np.total_experience?.toString() || '');
        setPrevHospital(np.previous_hospital || '');
        setDepartments(np.departments || '');
        setPreferredLocation(np.preferred_location || '');
        setExpectedSalary(np.expected_salary?.toString() || '');
        setShiftPref(np.shift_preference || 'flexible');
        setAvailability(np.availability || 'immediately');
      }
      setLoading(false);
    }
    load();
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const { error: profileError } = await supabase.from('profiles').update({
      full_name: fullName, phone: phone || null, city: city || null,
      state: state || null, bio: bio || null,
    }).eq('id', user!.id);

    if (profileError) {
      showToast('error', 'Failed to save profile: ' + profileError.message);
      setSaving(false);
      return;
    }

    const npData = {
      nurse_id: user!.id,
      qualification: qualification || null,
      nursing_registration_number: regNumber || null,
      registration_authority: regAuthority || null,
      total_experience: totalExp ? parseInt(totalExp) : null,
      previous_hospital: prevHospital || null,
      departments: departments || null,
      preferred_location: preferredLocation || null,
      expected_salary: expectedSalary ? parseFloat(expectedSalary) : null,
      shift_preference: shiftPref,
      availability: availability,
    };

    const npResult = nurseProfile
      ? await supabase.from('nurse_profiles').update(npData).eq('nurse_id', user!.id)
      : await supabase.from('nurse_profiles').insert(npData);

    if (npResult.error) {
      showToast('error', 'Failed to save professional details: ' + npResult.error.message);
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSaving(false);
    setSaved(true);
    showToast('success', 'Profile saved successfully');
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-xl font-semibold text-primary-700">
            {profile?.full_name ? getInitials(profile.full_name) : <UserIcon className="h-8 w-8" />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{profile?.full_name}</h2>
            <p className="text-sm text-slate-500">{profile?.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge color={profile?.verification_status === 'verified' ? 'green' : profile?.verification_status === 'rejected' ? 'red' : 'amber'}>
                <Award className="h-3 w-3" /> {profile?.verification_status || 'pending'}
              </Badge>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 uppercase tracking-wide">Basic Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
              <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
              <Input label="State" value={state} onChange={(e) => setState(e.target.value)} />
              <div className="sm:col-span-2">
                <Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell hospitals about yourself..." rows={3} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 uppercase tracking-wide">Professional Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Qualification" value={qualification} onChange={(e) => setQualification(e.target.value)} placeholder="BSc Nursing, GNM..." />
              <Input label="Registration number" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="RN-12345" />
              <Input label="Registration authority" value={regAuthority} onChange={(e) => setRegAuthority(e.target.value)} placeholder="INC, State Council..." />
              <Input label="Total experience (years)" type="number" min={0} value={totalExp} onChange={(e) => setTotalExp(e.target.value)} />
              <Input label="Previous hospital" value={prevHospital} onChange={(e) => setPrevHospital(e.target.value)} />
              <Input label="Departments / Skills" value={departments} onChange={(e) => setDepartments(e.target.value)} placeholder="ICU, ER, Pediatrics..." />
              <Input label="Preferred location" value={preferredLocation} onChange={(e) => setPreferredLocation(e.target.value)} />
              <Input label="Expected salary (monthly)" type="number" min={0} value={expectedSalary} onChange={(e) => setExpectedSalary(e.target.value)} placeholder="50000" />
              <Select label="Shift preference" value={shiftPref || ''} onChange={(e) => setShiftPref(e.target.value as NurseProfile['shift_preference'])}>
                <option value="flexible">Flexible</option>
                <option value="day">Day</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </Select>
              <Select label="Availability" value={availability || ''} onChange={(e) => setAvailability(e.target.value as NurseProfile['availability'])}>
                <option value="immediately">Immediately</option>
                <option value="2_weeks">2 weeks notice</option>
                <option value="1_month">1 month notice</option>
                <option value="not_available">Not available</option>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</Button>
            {saved && <span className="text-sm text-emerald-600 animate-fade-in">Saved successfully</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}

// ============ MY DOCUMENTS ============
function MyDocuments() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [docs, setDocs] = useState<NurseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const docTypes: { value: NurseDocument['document_type']; label: string }[] = [
    { value: 'qualification', label: 'Qualification Certificate' },
    { value: 'registration', label: 'Nursing Registration' },
    { value: 'experience', label: 'Experience Certificate' },
    { value: 'id_proof', label: 'ID Proof' },
    { value: 'resume', label: 'Resume' },
    { value: 'other', label: 'Other' },
  ];

  async function loadDocs() {
    const { data } = await supabase.from('nurse_documents').select('*').eq('nurse_id', user!.id).order('created_at', { ascending: false });
    setDocs(data as NurseDocument[] || []);
    setLoading(false);
  }

  useEffect(() => { loadDocs(); }, []);

  async function uploadFile(file: File, docType: NurseDocument['document_type']) {
    if (!user) return;
    setUploading(true);

    const ext = file.name.split('.').pop();
    const fileName = `${user.id}/${docType}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('nurse-documents')
      .upload(fileName, file);

    if (uploadError) {
      showToast('error', 'Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from('nurse_documents').insert({
      nurse_id: user.id,
      document_type: docType,
      file_name: file.name,
      file_url: fileName,
      file_size: file.size,
      mime_type: file.type,
    });

    if (dbError) {
      showToast('error', 'Failed to save document record: ' + dbError.message);
      setUploading(false);
      return;
    }

    setUploading(false);
    showToast('success', 'Document uploaded successfully');
    loadDocs();
  }

  async function deleteDoc(doc: NurseDocument) {
    if (!confirm('Delete this document?')) return;
    const { error: storageError } = await supabase.storage.from('nurse-documents').remove([doc.file_url]);
    if (storageError) { showToast('error', 'Failed to delete file: ' + storageError.message); return; }
    const { error: dbError } = await supabase.from('nurse_documents').delete().eq('id', doc.id);
    if (dbError) { showToast('error', 'Failed to delete document: ' + dbError.message); return; }
    setDocs(docs.filter((d) => d.id !== doc.id));
    showToast('success', 'Document deleted');
  }

  async function downloadDoc(doc: NurseDocument) {
    const { data, error } = await supabase.storage.from('nurse-documents').createSignedUrl(doc.file_url, 3600);
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
            <label
              key={dt.value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 p-4 transition-colors hover:border-primary-400 hover:bg-primary-50/30"
            >
              <FileUp className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">{dt.label}</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file, dt.value);
                }}
                disabled={uploading}
              />
            </label>
          ))}
        </div>
        {uploading && <p className="mt-3 text-sm text-primary-600">Uploading...</p>}
      </Card>

      {docs.length === 0 ? (
        <EmptyState icon={<FileText className="h-7 w-7" />} title="No documents uploaded" description="Upload your certificates and credentials for verification." />
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <Card key={doc.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">{doc.file_name}</div>
                  <div className="text-xs text-slate-500 capitalize">{doc.document_type.replace('_', ' ')}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge color={doc.verification_status === 'verified' ? 'green' : doc.verification_status === 'rejected' ? 'red' : 'amber'}>
                  {doc.verification_status}
                </Badge>
                <button onClick={() => downloadDoc(doc)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Download">
                  <Download className="h-4 w-4" />
                </button>
                <button onClick={() => deleteDoc(doc)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ NOTIFICATIONS ============
function MyNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setNotifications(data as Notification[] || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user!.id).eq('is_read', false);
    setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
  }

  if (loading) return <Spinner className="py-20" />;

  if (notifications.length === 0) {
    return <EmptyState icon={<Bell className="h-7 w-7" />} title="No notifications" description="You'll see updates about your applications and interviews here." />;
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button>
      </div>
      {notifications.map((n) => (
        <Card
          key={n.id}
          className={cn('flex items-start gap-3', !n.is_read && 'border-primary-200 bg-primary-50/30')}
          onClick={() => !n.is_read && markRead(n.id)}
        >
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

// ============ SHARED MODAL ============
function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
        <h2 className="mb-4 text-lg font-bold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}
