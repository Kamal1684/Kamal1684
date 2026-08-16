import { useEffect, useState, useCallback } from 'react';
import {
  Users, Briefcase, FileText, Building2, TrendingUp,
  Clock, ShieldCheck, CheckCircle2, XCircle, Award, Stethoscope,
  Activity as ActivityIcon, Video, UserCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, Hospital, Job, Application, Notification } from '@/lib/supabase';
import { Card, Badge, Spinner, Button, useToast } from '@/components/ui';
import { formatCurrency, formatDate, getInitials, cn } from '@/lib/utils';

type Tab = 'overview' | 'users' | 'jobs' | 'applications' | 'verifications' | 'activity';

export function AdminPortal({ tab }: { tab: Tab }) {
  const [stats, setStats] = useState({
    totalUsers: 0, nurses: 0, hospitals: 0, totalJobs: 0,
    activeJobs: 0, pendingJobs: 0, totalApplications: 0,
    pendingVerifications: 0, pendingHospitalVerifications: 0,
    interviewsScheduled: 0, selectedCount: 0, joinedCount: 0,
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<(Job & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> })[]>([]);
  const [applications, setApplications] = useState<(Application & { profiles: Pick<Profile, 'full_name'>; jobs: Pick<Job, 'job_title' | 'department'> & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> } })[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [nurseProfiles, setNurseProfiles] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [profilesRes, jobsRes, appsRes, hospitalsRes, nurseProfilesRes, notifRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('jobs').select('*, hospitals(hospital_name, name)').order('created_at', { ascending: false }),
      supabase.from('applications').select('*, profiles(full_name), jobs(job_title, department, hospitals(hospital_name, name))').order('created_at', { ascending: false }),
      supabase.from('hospitals').select('*').order('created_at', { ascending: false }),
      supabase.from('nurse_profiles').select('*, profiles(full_name, email, city, state, verification_status)').order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20),
    ]);

    const profileList = profilesRes.data as Profile[] || [];
    const jobList = jobsRes.data as (Job & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> })[] || [];
    const appList = appsRes.data as any[] || [];
    const hospitalList = hospitalsRes.data as Hospital[] || [];
    const nurseProfileList = nurseProfilesRes.data as any[] || [];
    const notifList = notifRes.data as Notification[] || [];

    setProfiles(profileList);
    setJobs(jobList);
    setApplications(appList);
    setHospitals(hospitalList);
    setNurseProfiles(nurseProfileList);
    setNotifications(notifList);

    const activeJobs = jobList.filter((j) => j.status === 'active');
    const pendingJobs = jobList.filter((j) => j.status === 'pending_approval');
    const pendingVerifications = profileList.filter((p) => p.verification_status === 'pending' && p.role === 'nurse');
    const pendingHospitalVerifications = hospitalList.filter((h) => h.verification_status === 'pending');

    setStats({
      totalUsers: profileList.length,
      nurses: profileList.filter((p) => p.role === 'nurse').length,
      hospitals: hospitalList.length,
      totalJobs: jobList.length,
      activeJobs: activeJobs.length,
      pendingJobs: pendingJobs.length,
      totalApplications: appList.length,
      pendingVerifications: pendingVerifications.length,
      pendingHospitalVerifications: pendingHospitalVerifications.length,
      interviewsScheduled: appList.filter((a) => a.status === 'interview_scheduled').length,
      selectedCount: appList.filter((a) => a.status === 'selected').length,
      joinedCount: appList.filter((a) => a.status === 'joined').length,
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <Spinner className="py-20" />;

  if (tab === 'overview') return <Overview stats={stats} recentApps={applications.slice(0, 5)} recentJobs={jobs.slice(0, 5)} recentActivity={notifications} />;
  if (tab === 'users') return <UsersList profiles={profiles} hospitals={hospitals} nurseProfiles={nurseProfiles} />;
  if (tab === 'jobs') return <JobsApproval jobs={jobs} onChanged={loadData} />;
  if (tab === 'applications') return <ApplicationsList applications={applications} />;
  if (tab === 'activity') return <ActivityFeed notifications={notifications} />;
  return <Verifications profiles={profiles} hospitals={hospitals} nurseProfiles={nurseProfiles} onChanged={loadData} />;
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', color)}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </Card>
  );
}

function Overview({ stats, recentApps, recentJobs }: {
  stats: typeof statsType;
  recentApps: (Application & { profiles: Pick<Profile, 'full_name'>; jobs: Pick<Job, 'job_title' | 'department'> & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> } })[];
  recentJobs: (Job & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> })[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-6 w-6 text-white" />} label="Total Users" value={stats.totalUsers} color="bg-primary-600" />
        <StatCard icon={<Briefcase className="h-6 w-6 text-white" />} label="Active Jobs" value={stats.activeJobs} color="bg-emerald-600" />
        <StatCard icon={<FileText className="h-6 w-6 text-white" />} label="Applications" value={stats.totalApplications} color="bg-amber-500" />
        <StatCard icon={<ShieldCheck className="h-6 w-6 text-white" />} label="Pending Verifications" value={stats.pendingVerifications + stats.pendingHospitalVerifications} color="bg-teal-600" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3">
          <Stethoscope className="h-5 w-5 text-primary-500" />
          <div>
            <div className="font-semibold text-slate-900">{stats.nurses} Nurses</div>
            <div className="text-sm text-slate-500">Registered professionals</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-emerald-500" />
          <div>
            <div className="font-semibold text-slate-900">{stats.hospitals} Hospitals</div>
            <div className="text-sm text-slate-500">Facility partners</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-500" />
          <div>
            <div className="font-semibold text-slate-900">{stats.pendingJobs} Pending Jobs</div>
            <div className="text-sm text-slate-500">Awaiting approval</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-teal-500" />
          <div>
            <div className="font-semibold text-slate-900">{stats.totalJobs} Total Jobs</div>
            <div className="text-sm text-slate-500">All time postings</div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3">
          <Video className="h-5 w-5 text-blue-500" />
          <div>
            <div className="font-semibold text-slate-900">{stats.interviewsScheduled}</div>
            <div className="text-sm text-slate-500">Interviews scheduled</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <UserCheck className="h-5 w-5 text-teal-500" />
          <div>
            <div className="font-semibold text-slate-900">{stats.selectedCount}</div>
            <div className="text-sm text-slate-500">Candidates selected</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <Award className="h-5 w-5 text-emerald-500" />
          <div>
            <div className="font-semibold text-slate-900">{stats.joinedCount}</div>
            <div className="text-sm text-slate-500">Nurses joined</div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <TrendingUp className="h-4 w-4 text-primary-500" /> Recent Applications
          </h3>
          {recentApps.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No applications yet</p>
          ) : (
            <div className="space-y-3">
              {recentApps.map((app) => (
                <div key={app.id} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{app.profiles?.full_name}</div>
                    <div className="text-xs text-slate-500">{app.jobs?.job_title} — {app.jobs?.hospitals?.hospital_name || app.jobs?.hospitals?.name}</div>
                  </div>
                  <Badge color={app.status === 'applied' ? 'blue' : app.status === 'shortlisted' ? 'teal' : app.status === 'selected' || app.status === 'joined' ? 'green' : app.status === 'rejected' ? 'red' : 'amber'}>
                    {app.status?.replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Briefcase className="h-4 w-4 text-primary-500" /> Recent Jobs
          </h3>
          {recentJobs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No jobs posted yet</p>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{job.job_title}</div>
                    <div className="text-xs text-slate-500">{job.hospitals?.hospital_name || job.hospitals?.name} — {job.department}</div>
                  </div>
                  <Badge color={job.status === 'active' ? 'green' : job.status === 'pending_approval' ? 'amber' : job.status === 'rejected' ? 'red' : 'slate'}>
                    {job.status?.replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

const statsType = {
  totalUsers: 0, nurses: 0, hospitals: 0, totalJobs: 0,
  activeJobs: 0, pendingJobs: 0, totalApplications: 0,
  pendingVerifications: 0, pendingHospitalVerifications: 0,
};

function UsersList({ profiles, hospitals, nurseProfiles }: { profiles: Profile[]; hospitals: Hospital[]; nurseProfiles: any[] }) {
  const [view, setView] = useState<'all' | 'nurses' | 'hospitals'>('all');

  const roleConfig: Record<string, { color: 'blue' | 'green' | 'teal'; label: string }> = {
    nurse: { color: 'blue', label: 'Nurse' },
    hospital: { color: 'green', label: 'Hospital' },
    admin: { color: 'teal', label: 'Admin' },
  };

  const verifyConfig: Record<string, { color: 'amber' | 'green' | 'red'; label: string }> = {
    pending: { color: 'amber', label: 'Pending' },
    verified: { color: 'green', label: 'Verified' },
    rejected: { color: 'red', label: 'Rejected' },
  };

  const nurseProfileMap = new Map(nurseProfiles.map((np) => [np.nurse_id, np]));
  const hospitalMap = new Map(hospitals.map((h) => [h.user_id, h]));

  const filtered = profiles.filter((p) => {
    if (view === 'nurses') return p.role === 'nurse';
    if (view === 'hospitals') return p.role === 'hospital';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={view === 'all' ? 'primary' : 'ghost'} onClick={() => setView('all')}>All ({profiles.length})</Button>
        <Button size="sm" variant={view === 'nurses' ? 'primary' : 'ghost'} onClick={() => setView('nurses')}>Nurses ({profiles.filter((p) => p.role === 'nurse').length})</Button>
        <Button size="sm" variant={view === 'hospitals' ? 'primary' : 'ghost'} onClick={() => setView('hospitals')}>Hospitals ({profiles.filter((p) => p.role === 'hospital').length})</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Verification</th>
                <th className="px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const rc = roleConfig[p.role] || roleConfig.nurse;
                const vc = verifyConfig[p.verification_status] || verifyConfig.pending;
                const np = nurseProfileMap.get(p.id);
                const hosp = hospitalMap.get(p.id);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {getInitials(p.full_name)}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-slate-800">{p.full_name}</span>
                          {p.role === 'nurse' && np?.qualification && (
                            <div className="text-xs text-slate-400">{np.qualification}</div>
                          )}
                          {p.role === 'hospital' && hosp && (
                            <div className="text-xs text-slate-400">{hosp.hospital_name || hosp.name} • {hosp.hospital_type}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{p.email}</td>
                    <td className="px-5 py-3"><Badge color={rc.color}>{rc.label}</Badge></td>
                    <td className="px-5 py-3"><Badge color={p.status === 'active' ? 'green' : 'red'}>{p.status}</Badge></td>
                    <td className="px-5 py-3"><Badge color={vc.color}>{vc.label}</Badge></td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(p.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function JobsApproval({ jobs, onChanged }: { jobs: (Job & { hospitals: Pick<Hospital, 'hospital_name' | 'name'> })[]; onChanged: () => void }) {
  const { showToast } = useToast();
  const [localJobs, setLocalJobs] = useState(jobs);
  const [updating, setUpdating] = useState<string | null>(null);

  async function updateJobStatus(jobId: string, status: 'active' | 'rejected') {
    setUpdating(jobId);
    const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId);
    setUpdating(null);
    if (error) { showToast('error', 'Failed to update job status: ' + error.message); return; }
    setLocalJobs(localJobs.map((j) => j.id === jobId ? { ...j, status } : j));
    showToast('success', status === 'active' ? 'Job approved and is now live' : 'Job rejected');
    onChanged();
  }

  const pending = localJobs.filter((j) => j.status === 'pending_approval');
  const others = localJobs.filter((j) => j.status !== 'pending_approval');

  const statusConfig: Record<string, { color: 'green' | 'blue' | 'amber' | 'red' | 'slate'; label: string }> = {
    active: { color: 'green', label: 'Active' },
    pending_approval: { color: 'amber', label: 'Pending' },
    draft: { color: 'slate', label: 'Draft' },
    closed: { color: 'slate', label: 'Closed' },
    rejected: { color: 'red', label: 'Rejected' },
  };

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">
            <Clock className="h-4 w-4 text-amber-500" /> Pending Approval ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map((job) => (
              <Card key={job.id} className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900">{job.job_title}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {job.hospitals?.hospital_name || job.hospitals?.name}</span>
                    <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> {job.department}</span>
                    {job.location && <span>{job.location}</span>}
                    {job.salary_min && <span>{formatCurrency(job.salary_min)}+</span>}
                  </div>
                  {job.job_description && <p className="mt-2 text-sm text-slate-400 line-clamp-2">{job.job_description}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="danger" disabled={updating === job.id} onClick={() => updateJobStatus(job.id, 'rejected')}>
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button size="sm" disabled={updating === job.id} onClick={() => updateJobStatus(job.id, 'active')}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700 uppercase tracking-wide">All Jobs ({others.length})</h3>
        {others.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No jobs to display</p>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Job Title</th>
                    <th className="px-5 py-3">Hospital</th>
                    <th className="px-5 py-3">Department</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Posted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {others.map((job) => {
                    const sc = statusConfig[job.status] || statusConfig.draft;
                    return (
                      <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-slate-800">{job.job_title}</td>
                        <td className="px-5 py-3 text-sm text-slate-500">{job.hospitals?.hospital_name || job.hospitals?.name}</td>
                        <td className="px-5 py-3 text-sm text-slate-500">{job.department}</td>
                        <td className="px-5 py-3"><Badge color={sc.color}>{sc.label}</Badge></td>
                        <td className="px-5 py-3 text-sm text-slate-500">{formatDate(job.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function ApplicationsList({ applications }: { applications: any[] }) {
  const statusColor: Record<string, 'amber' | 'blue' | 'green' | 'red' | 'slate' | 'teal'> = {
    applied: 'blue', under_review: 'amber', shortlisted: 'teal',
    interview_scheduled: 'blue', selected: 'green', joined: 'green', rejected: 'red',
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="px-5 py-3">Nurse</th>
              <th className="px-5 py-3">Job</th>
              <th className="px-5 py-3">Hospital</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Applied</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {applications.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">No applications yet</td></tr>
            ) : applications.map((app) => (
              <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-slate-800">{app.profiles?.full_name || 'Unknown'}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{app.jobs?.job_title || 'N/A'}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{app.jobs?.hospitals?.hospital_name || app.jobs?.hospitals?.name || 'N/A'}</td>
                <td className="px-5 py-3"><Badge color={statusColor[app.status] || 'slate'}>{app.status?.replace(/_/g, ' ')}</Badge></td>
                <td className="px-5 py-3 text-sm text-slate-500">{formatDate(app.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Verifications({ profiles, hospitals, onChanged }: {
  profiles: Profile[];
  hospitals: Hospital[];
  nurseProfiles: any[];
  onChanged: () => void;
}) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const pendingNurses = profiles.filter((p) => p.role === 'nurse' && p.verification_status === 'pending');
  const pendingHospitals = hospitals.filter((h) => h.verification_status === 'pending');

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function verifyProfile(profileId: string, nurseName: string, status: 'verified' | 'rejected') {
    setUpdating(profileId);
    const { error } = await supabase
      .from('profiles')
      .update({ verification_status: status, status: 'active' })
      .eq('id', profileId);

    if (error) {
      setUpdating(null);
      showToast('error', `Failed to update ${nurseName}: ${error.message}`);
      return;
    }

    await supabase
      .from('nurse_profiles')
      .update({ verification_status: status })
      .eq('nurse_id', profileId);

    setUpdating(null);
    showToast('success', `${nurseName} has been ${status === 'verified' ? 'verified' : 'rejected'}.`);
    onChanged();
  }

  async function verifyHospital(hospitalId: string, hospitalName: string, status: 'verified' | 'rejected') {
    setUpdating(hospitalId);
    const { error } = await supabase
      .from('hospitals')
      .update({ verification_status: status })
      .eq('id', hospitalId);

    if (error) {
      setUpdating(null);
      showToast('error', `Failed to update ${hospitalName}: ${error.message}`);
      return;
    }

    setUpdating(null);
    showToast('success', `${hospitalName} has been ${status === 'verified' ? 'verified' : 'rejected'}.`);
    onChanged();
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={cn(
          'fixed top-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg animate-slide-in',
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      {pendingNurses.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">
            <Stethoscope className="h-4 w-4 text-primary-500" /> Pending Nurse Verifications ({pendingNurses.length})
          </h3>
          <div className="space-y-3">
            {pendingNurses.map((nurse) => (
              <Card key={nurse.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                    {getInitials(nurse.full_name)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-800">{nurse.full_name}</div>
                    <div className="text-xs text-slate-500">{nurse.email} — {nurse.city}, {nurse.state}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" disabled={updating === nurse.id} onClick={() => verifyProfile(nurse.id, nurse.full_name, 'rejected')}>
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button size="sm" disabled={updating === nurse.id} onClick={() => verifyProfile(nurse.id, nurse.full_name, 'verified')}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pendingHospitals.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">
            <Building2 className="h-4 w-4 text-emerald-500" /> Pending Hospital Verifications ({pendingHospitals.length})
          </h3>
          <div className="space-y-3">
            {pendingHospitals.map((hospital) => (
              <Card key={hospital.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                    <Building2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-800">{hospital.hospital_name || hospital.name}</div>
                    <div className="text-xs text-slate-500">{hospital.city}, {hospital.state} — {hospital.hospital_type}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" disabled={updating === hospital.id} onClick={() => verifyHospital(hospital.id, hospital.hospital_name || hospital.name, 'rejected')}>
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button size="sm" disabled={updating === hospital.id} onClick={() => verifyHospital(hospital.id, hospital.hospital_name || hospital.name, 'verified')}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pendingNurses.length === 0 && pendingHospitals.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Award className="h-7 w-7" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-slate-800">All Verifications Complete</h3>
          <p className="max-w-sm text-sm text-slate-500">There are no pending nurse or hospital verifications right now.</p>
        </Card>
      )}
    </div>
  );
}
