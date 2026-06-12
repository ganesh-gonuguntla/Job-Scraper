import { useState, useEffect } from 'react';
import {
  Bot,
  Briefcase,
  Mail,
  Target,
  Activity,
  Upload,
  Play,
  CheckCircle2,
  Clock,
  Settings,
  FileText,
  AlertCircle,
  RefreshCw,
  Plus,
  X,
  Send,
  Eye,
  Check,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Label } from '@/components/ui/Input';
import { useAuthStore } from '@/store/authStore';
import api from '@/api/client';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  
  // Tabs: 'overview', 'matches', 'applications', 'logs', 'settings'
  const [activeTab, setActiveTab] = useState('overview');
  
  // Data State
  const [profile, setProfile] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [applications, setApplications] = useState([]);
  const [logs, setLogs] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Forms/Modal State
  const [skillsInput, setSkillsInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [rolesInput, setRolesInput] = useState('');
  const [experienceInput, setExperienceInput] = useState('');
  
  // Preferences settings
  const [autoApply, setAutoApply] = useState(true);
  const [reviewBeforeSend, setReviewBeforeSend] = useState(false);
  const [matchThreshold, setMatchThreshold] = useState(40);
  const [followUpDays, setFollowUpDays] = useState(7);
  const [smtpPass, setSmtpPass] = useState('');
  
  // Selected Match for Tailoring details preview
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [previewResume, setPreviewResume] = useState('');
  const [tailoringLoading, setTailoringLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const [profRes, jobsRes, matchesRes, appsRes, logsRes] = await Promise.all([
        api.get('/profile').catch(() => ({ data: {} })),
        api.get('/jobs').catch(() => ({ data: { jobs: [] } })),
        api.get('/match').catch(() => ({ data: { matches: [] } })),
        api.get('/applications').catch(() => ({ data: { applications: [] } })),
        api.get('/settings/logs').catch(() => ({ data: { logs: [] } })),
      ]);

      const prof = profRes.data?.profile || {};
      setProfile(prof);
      setResumes(profRes.data?.resumes || []);
      setJobs(jobsRes.data?.jobs || []);
      setMatches(matchesRes.data?.matches || []);
      setApplications(appsRes.data?.applications || []);
      setLogs(logsRes.data?.logs || []);

      // Populate form states
      setSkillsInput(prof.skills?.join(', ') || '');
      setLocationInput(prof.location || '');
      setRolesInput(prof.target_roles?.join(', ') || '');
      setExperienceInput(prof.experience || '');

      // Populate preference states
      if (prof.preferences) {
        setAutoApply(prof.preferences.auto_apply !== false);
        setReviewBeforeSend(prof.preferences.review_before_send === true);
        setMatchThreshold(prof.preferences.match_threshold || 40);
        setFollowUpDays(prof.preferences.follow_up_days || 7);
        setSmtpPass(prof.preferences.smtp_pass || '');
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadResume(e) {
    e.preventDefault();
    if (!selectedFile) return;
    
    setUploadingResume(true);
    const formData = new FormData();
    formData.append('resume', selectedFile);
    
    try {
      await api.post('/resume/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSelectedFile(null);
      await fetchDashboardData();
      alert('Resume uploaded and parsed successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Resume upload failed');
    } finally {
      setUploadingResume(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    try {
      await api.post('/profile/skills', {
        skills: skillsInput.split(',').map(s => s.trim()).filter(Boolean),
        location: locationInput,
        target_roles: rolesInput.split(',').map(r => r.trim()).filter(Boolean),
        experience: experienceInput
      });
      await fetchDashboardData();
      alert('Profile details saved and updated successfully!');
    } catch (err) {
      alert('Failed to save profile details');
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    try {
      await api.patch('/settings', {
        auto_apply: autoApply,
        review_before_send: reviewBeforeSend,
        match_threshold: Number(matchThreshold),
        follow_up_days: Number(followUpDays),
        smtp_pass: smtpPass
      });
      await fetchDashboardData();
      alert('Preferences updated successfully!');
    } catch (err) {
      alert('Failed to save settings');
    }
  }

  async function runAgentPipeline() {
    setRunningAgent(true);
    try {
      await api.post('/settings/agent/run');
      await fetchDashboardData();
      alert('Agent pipeline execution completed!');
    } catch (err) {
      alert('Error running agent pipeline');
    } finally {
      setRunningAgent(false);
    }
  }

  async function handleTailorJob(match) {
    setSelectedMatch(match);
    setTailoringLoading(true);
    setDraftSubject('');
    setDraftBody('');
    setPreviewResume('');
    
    try {
      // 1. Generate Optimized Resume (Tailoring)
      const optRes = await api.post(`/generate-email/optimize-resume`, { match_id: match._id });
      setPreviewResume(optRes.data?.resume?.resume_text || 'Resume optimization in progress...');

      // 2. Generate Outreach Email
      const emailRes = await api.post('/generate-email', { match_id: match._id });
      setDraftSubject(emailRes.data?.email?.subject || '');
      setDraftBody(emailRes.data?.email?.body || '');
    } catch (err) {
      console.error('Error tailoring resume or draft email:', err);
    } finally {
      setTailoringLoading(false);
    }
  }

  async function handleSendApplication(matchId) {
    try {
      // Update match status to approved first if review_before_send is active
      await api.post('/apply', { match_id: matchId });
      alert('Application sent successfully!');
      setSelectedMatch(null);
      await fetchDashboardData();
    } catch (err) {
      alert('Failed to send application');
    }
  }

  const statCards = [
    { label: 'Jobs Discovered', value: jobs.length || '0', icon: Briefcase, color: 'text-brand-400' },
    { label: 'Qualified Matches', value: matches.filter(m => m.score >= matchThreshold).length || '0', icon: Target, color: 'text-violet-400' },
    { label: 'Applications Sent', value: applications.length || '0', icon: Mail, color: 'text-emerald-400' },
    { label: 'Agent Status', value: runningAgent ? 'Running...' : 'Active', icon: Bot, color: runningAgent ? 'text-amber-400 animate-pulse' : 'text-accent-400' },
  ];

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      <main className="pt-24 px-6 max-w-7xl mx-auto">
        {/* Page Title & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              SaaS Career Agent Panel
            </h1>
            <p className="text-slate-400">
              Welcome back, {user?.name || 'User'}. Monitor your automated job applications.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={fetchDashboardData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Sync Data
            </Button>
            <Button onClick={runAgentPipeline} disabled={runningAgent || loading}>
              <Play className="w-4 h-4 mr-2 fill-current" />
              {runningAgent ? 'Running Agent...' : 'Trigger Agent Run'}
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-4 pt-2">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-sm text-slate-400">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-white/10 gap-6 mb-8 overflow-x-auto">
          {[
            { id: 'overview', label: 'Profile & Resume', icon: FileText },
            { id: 'matches', label: 'Matching Roles', icon: Target },
            { id: 'applications', label: 'Outreach Log', icon: Mail },
            { id: 'logs', label: 'Agent Monitor', icon: Activity },
            { id: 'settings', label: 'Settings & Prefs', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 pb-4 text-sm font-semibold border-b-2 transition-all shrink-0 ${
                activeTab === id
                  ? 'border-brand-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-10 h-10 text-brand-400 animate-spin" />
          </div>
        ) : (
          <div>
            {/* Overview / Profile Tab */}
            {activeTab === 'overview' && (
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Upload & Files */}
                <div className="space-y-6 lg:col-span-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>Resume Upload</CardTitle>
                      <CardDescription>Upload PDF or DOCX file to extract resume intelligence</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleUploadResume} className="space-y-4">
                        <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-brand-500 transition-colors">
                          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <label className="cursor-pointer block">
                            <span className="text-sm text-brand-400 hover:underline">Select a file</span>
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.docx,.doc"
                              onChange={(e) => setSelectedFile(e.target.files[0])}
                            />
                          </label>
                          {selectedFile && (
                            <p className="text-xs text-slate-300 mt-2 font-medium bg-white/5 p-1.5 rounded">
                              {selectedFile.name}
                            </p>
                          )}
                        </div>
                        <Button type="submit" className="w-full" disabled={uploadingResume || !selectedFile}>
                          {uploadingResume ? 'Processing Resume...' : 'Parse & Embed'}
                        </Button>
                      </form>

                      {resumes.length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Parsed Resumes</h4>
                          <div className="space-y-2">
                            {resumes.map((r) => (
                              <div key={r._id} className="flex items-center justify-between p-3 rounded-lg bg-white/3 border border-white/5">
                                <div className="truncate pr-2">
                                  <p className="text-xs text-white truncate font-medium">
                                    {r.resume_url ? r.resume_url.split('/').pop() : 'Manual profile entry'}
                                  </p>
                                  <p className="text-[10px] text-slate-400">Source: {r.source}</p>
                                </div>
                                <Badge variant={r.embedding?.length > 0 ? 'success' : 'warning'}>
                                  {r.embedding?.length > 0 ? 'Embedded' : 'Pending'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Edit Profile Fields */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Profile Details</CardTitle>
                      <CardDescription>Enter qualifications manually to bootstrap agent matching</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="targetRoles">Target Job Roles</Label>
                            <Input
                              id="targetRoles"
                              placeholder="e.g. Software Engineer, Full Stack Developer"
                              value={rolesInput}
                              onChange={(e) => setRolesInput(e.target.value)}
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Separate roles with commas</p>
                          </div>
                          <div>
                            <Label htmlFor="location">Target Location</Label>
                            <Input
                              id="location"
                              placeholder="e.g. London, Remote, Hybrid"
                              value={locationInput}
                              onChange={(e) => setLocationInput(e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="skills">Technical Skills & Keywords</Label>
                          <Input
                            id="skills"
                            placeholder="e.g. React, Node.js, Python, MongoDB"
                            value={skillsInput}
                            onChange={(e) => setSkillsInput(e.target.value)}
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Separate skills with commas</p>
                        </div>

                        <div>
                          <Label htmlFor="experience">Professional Experience Summary</Label>
                          <Textarea
                            id="experience"
                            placeholder="Briefly summarize your previous roles and tenure (e.g. 3 years as a developer building web apps)..."
                            value={experienceInput}
                            onChange={(e) => setExperienceInput(e.target.value)}
                            rows={4}
                          />
                        </div>

                        <div className="flex justify-end">
                          <Button type="submit">
                            Save Changes
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Matches Tab */}
            {activeTab === 'matches' && (
              <div className="grid lg:grid-cols-3 gap-8">
                {/* List of matches */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-lg font-bold text-white mb-4">Discovered Matching Opportunities</h3>
                  {matches.length === 0 ? (
                    <div className="text-center py-12 bg-white/3 border border-white/5 rounded-2xl">
                      <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-300 font-medium">No matching jobs discovered yet</p>
                      <p className="text-sm text-slate-500 mt-1">Trigger the pipeline run to scan job postings.</p>
                    </div>
                  ) : (
                    matches.map((m) => {
                      const isHigh = m.score >= 70;
                      const isMid = m.score >= 50 && m.score < 70;
                      const isQualified = m.score >= matchThreshold;
                      
                      return (
                        <div
                          key={m._id}
                          className={`p-5 rounded-2xl glass border transition-all ${
                            selectedMatch?._id === m._id
                              ? 'border-brand-500 glow'
                              : 'border-white/5 hover:border-white/10'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div>
                              <h4 className="text-base font-bold text-white">{m.job_id?.title}</h4>
                              <p className="text-sm text-brand-300">{m.job_id?.company} — <span className="text-slate-400 text-xs">{m.job_id?.location}</span></p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                isHigh
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : isMid
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                              }`}
                            >
                              {m.score}% Match
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {m.job_id?.skills_required?.slice(0, 5).map((sk) => (
                              <Badge key={sk} variant="default" className="text-[10px]">
                                {sk}
                              </Badge>
                            ))}
                            {m.job_id?.skills_required?.length > 5 && (
                              <span className="text-[10px] text-slate-500 self-center">
                                +{m.job_id.skills_required.length - 5} more
                              </span>
                            )}
                          </div>

                          {m.missing_skills?.length > 0 && (
                            <div className="mt-3">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Missing keywords:</p>
                              <p className="text-xs text-rose-300">{m.missing_skills.slice(0, 6).join(', ')}</p>
                            </div>
                          )}

                          <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
                            <span className="text-xs text-slate-400">Status: <Badge variant={m.status === 'qualified' ? 'success' : m.status === 'low_match' ? 'warning' : 'default'}>{m.status}</Badge></span>
                            <div className="flex gap-2">
                              {isQualified && (
                                <Button size="sm" variant="secondary" onClick={() => handleTailorJob(m)}>
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  Review Outreach & Tailor
                                </Button>
                              )}
                              <a href={m.job_id?.apply_url} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="outline">Portal Link</Button>
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Tailoring & Apply actions preview panel */}
                <div className="lg:col-span-1">
                  <Card className="sticky top-24">
                    <CardHeader>
                      <CardTitle>Outreach tailoring preview</CardTitle>
                      <CardDescription>
                        {selectedMatch ? `Tailoring application for ${selectedMatch.job_id?.company}` : 'Select a qualified job on the left to preview cover letter & resume tailors.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {selectedMatch ? (
                        tailoringLoading ? (
                          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                            <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
                            <p className="text-sm font-medium">Re-writing resume & email draft...</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Draft Email */}
                            <div>
                              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Subject</Label>
                              <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white select-all font-mono font-medium mb-3">
                                {draftSubject || 'Loading Subject...'}
                              </div>

                              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Body</Label>
                              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto mb-3">
                                {draftBody || 'Loading outreach email draft...'}
                              </div>
                            </div>

                            {/* Resume tailored */}
                            <div>
                              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Optimized Resume Preview</Label>
                              <div className="bg-white/3 border border-white/10 rounded-lg p-3 text-[10px] text-slate-400 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                {previewResume || 'Optimizing bullet points...'}
                              </div>
                            </div>

                            <Button className="w-full mt-4" onClick={() => handleSendApplication(selectedMatch._id)}>
                              <Send className="w-4 h-4 mr-2" />
                              Approve & Dispatch Application
                            </Button>
                          </div>
                        )
                      ) : (
                        <div className="text-center py-16 text-slate-500 border-2 border-dashed border-white/5 rounded-xl">
                          <Bot className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                          <p className="text-sm">No job selected</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Applications Log Tab */}
            {activeTab === 'applications' && (
              <Card>
                <CardHeader>
                  <CardTitle>Sent Application Outreach Logs</CardTitle>
                  <CardDescription>Track all applications completed and follow-ups processed</CardDescription>
                </CardHeader>
                <CardContent>
                  {applications.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="font-medium">No application outreach records found</p>
                      <p className="text-xs text-slate-600">Dispatched emails will appear here.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400 text-xs font-bold uppercase tracking-wider">
                            <th className="pb-3 pr-4">Job / Company</th>
                            <th className="pb-3 pr-4">Location</th>
                            <th className="pb-3 pr-4">Sent Date</th>
                            <th className="pb-3 pr-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                          {applications.map((app) => (
                            <tr key={app._id} className="text-slate-300">
                              <td className="py-3 pr-4">
                                <div className="font-semibold text-white">{app.job_id?.title || 'Unknown Role'}</div>
                                <div className="text-xs text-brand-300">{app.job_id?.company || 'Unknown Company'}</div>
                              </td>
                              <td className="py-3 pr-4 text-xs text-slate-400">{app.job_id?.location || 'Remote'}</td>
                              <td className="py-3 pr-4 text-xs text-slate-400">
                                {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="py-3 pr-4">
                                <Badge
                                  variant={
                                    app.status === 'emailed'
                                      ? 'success'
                                      : app.status === 'followed_up'
                                      ? 'accent'
                                      : app.status === 'pending_review'
                                      ? 'warning'
                                      : 'danger'
                                  }
                                >
                                  {app.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Agent Logs Tab */}
            {activeTab === 'logs' && (
              <Card>
                <CardHeader>
                  <CardTitle>Autonomous Agent Run Log</CardTitle>
                  <CardDescription>Real-time database agent action outputs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-950 rounded-xl border border-white/10 p-5 font-mono text-xs text-emerald-400 overflow-y-auto max-h-[500px] space-y-2 select-all">
                    <p className="text-slate-500">// System logs pulled from db.agent_logs</p>
                    {logs.length === 0 ? (
                      <p className="text-slate-600">No logs generated. Run the agent pipeline to generate output.</p>
                    ) : (
                      logs.map((log) => (
                        <div key={log._id} className="border-b border-white/5 pb-2">
                          <p className="text-[10px] text-slate-500">{new Date(log.timestamp).toISOString()}</p>
                          <p>
                            <span className="text-brand-400">[{log.agent_name}]</span>{' '}
                            <span className="text-white font-bold">{log.action}</span> -{' '}
                            <Badge variant={log.status === 'completed' ? 'success' : 'warning'} className="px-1 text-[9px]">
                              {log.status}
                            </Badge>
                          </p>
                          {log.details && (
                            <pre className="text-slate-400 mt-1 text-[10px] bg-white/3 p-1.5 rounded select-all whitespace-pre-wrap">
                              {JSON.stringify(log.details)}
                            </pre>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Settings & Prefs Tab */}
            {activeTab === 'settings' && (
              <Card>
                <CardHeader>
                  <CardTitle>Agent Configuration</CardTitle>
                  <CardDescription>Configure autonomy levels and threshold boundaries</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveSettings} className="space-y-6 max-w-xl">
                    <div className="space-y-4">
                      {/* Checkboxes */}
                      <div className="flex items-center gap-3">
                        <input
                          id="autoApply"
                          type="checkbox"
                          checked={autoApply}
                          onChange={(e) => setAutoApply(e.target.checked)}
                          className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500"
                        />
                        <Label htmlFor="autoApply" className="mb-0 cursor-pointer">
                          Enable Auto Apply
                          <span className="block text-xs font-normal text-slate-500">Autonomous sending to emails and forms</span>
                        </Label>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          id="reviewBeforeSend"
                          type="checkbox"
                          checked={reviewBeforeSend}
                          onChange={(e) => setReviewBeforeSend(e.target.checked)}
                          className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500"
                        />
                        <Label htmlFor="reviewBeforeSend" className="mb-0 cursor-pointer">
                          Review before dispatch (Manual Gate)
                          <span className="block text-xs font-normal text-slate-500">Emails and optimized resumes are held for review</span>
                        </Label>
                      </div>
                    </div>

                    <hr className="border-white/10" />

                    {/* Numeric settings */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="matchThreshold">Match Decision Threshold (%)</Label>
                        <Input
                          id="matchThreshold"
                          type="number"
                          min="1"
                          max="100"
                          value={matchThreshold}
                          onChange={(e) => setMatchThreshold(e.target.value)}
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">Default value: 40%</span>
                      </div>
                      <div>
                        <Label htmlFor="followUpDays">Automatic Follow-up (days)</Label>
                        <Input
                          id="followUpDays"
                          type="number"
                          min="1"
                          value={followUpDays}
                          onChange={(e) => setFollowUpDays(e.target.value)}
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">Default value: 7 days</span>
                      </div>
                    </div>

                    <hr className="border-white/10" />

                    {/* Email Integration settings */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-2">Gmail SMTP Integration</h4>
                        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                          To enable the agent to automatically apply and send outreach emails on your behalf, configure your Gmail App Password. If left blank, the agent runs in dry-run/mock mode.
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="smtpPass">Gmail App Password</Label>
                        <Input
                          id="smtpPass"
                          type="password"
                          placeholder="•••• •••• •••• ••••"
                          value={smtpPass}
                          onChange={(e) => setSmtpPass(e.target.value)}
                        />
                      </div>

                      {/* Instructions Panel */}
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider block">How to configure Gmail SMTP</span>
                        <ol className="list-decimal pl-4 text-xs text-slate-400 space-y-1">
                          <li>Go to your <a href="https://myaccount.google.com/" target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">Google Account Settings</a> &gt; <strong>Security</strong>.</li>
                          <li>Ensure <strong>2-Step Verification</strong> is enabled under "How you sign in to Google".</li>
                          <li>Click on <strong>2-Step Verification</strong>, scroll to the bottom, and click <strong>App passwords</strong>.</li>
                          <li>Create a new App Password (e.g. named <code>ApplyAI</code>).</li>
                          <li>Copy the generated 16-character code and paste it in the field above.</li>
                        </ol>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit">
                        Save Preferences
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
