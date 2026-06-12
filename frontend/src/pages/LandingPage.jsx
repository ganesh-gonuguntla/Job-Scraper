import { Link } from 'react-router-dom';
import {
  Bot,
  Search,
  Target,
  Mail,
  Send,
  BarChart3,
  ArrowRight,
  Zap,
  Shield,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Navbar } from '@/components/layout/Navbar';

const features = [
  {
    icon: Search,
    title: 'Continuous Job Discovery',
    description: 'Scrapes career pages and job boards 24/7, matching roles to your profile automatically.',
    color: 'from-brand-500 to-brand-600',
  },
  {
    icon: Target,
    title: 'Smart Match Scoring',
    description: 'Semantic + skill overlap scoring. Jobs ≥40% match proceed to application pipeline.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: Bot,
    title: 'Resume Optimization',
    description: 'ATS-tailored resume rewrites per job — truthful, keyword-aligned, never fabricated.',
    color: 'from-accent-500 to-pink-600',
  },
  {
    icon: Mail,
    title: 'Dynamic Emails',
    description: 'Unique, situation-specific emails for every application — no templates, ever.',
    color: 'from-cyan-500 to-blue-600',
  },
  {
    icon: Send,
    title: 'Auto Apply & Send',
    description: 'Submits via official portals and emails HR directly when contacts are discovered.',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: Clock,
    title: 'Follow-Up Agent',
    description: 'Monitors responses and sends polite follow-ups after your configured wait period.',
    color: 'from-amber-500 to-orange-600',
  },
];

const pipeline = [
  'Upload Resume',
  'Job Search',
  'Match ≥40%',
  'Find HR Contact',
  'Optimize Resume',
  'Generate Email',
  'Apply & Send',
  'Track & Follow Up',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        <div className="max-w-5xl mx-auto text-center relative">
          <Badge variant="accent" className="mb-6 px-4 py-1.5 text-sm">
            <Zap className="w-3.5 h-3.5 mr-1.5 inline" />
            Fully Autonomous Career Agent
          </Badge>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
            Your AI applies to jobs{' '}
            <span className="gradient-text">while you sleep</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload your resume once. Our multi-agent AI discovers matching jobs, optimizes your resume,
            finds recruiter emails, and applies — end to end, automatically.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="animate-pulse-glow">
                Start Applying Free
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" size="lg">
                Sign In
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-6 mt-10 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" /> No fabricated skills
            </span>
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-brand-400" /> Full transparency dashboard
            </span>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10 text-white">
            Autonomous Pipeline
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {pipeline.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="glass rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-500/30 text-brand-300 text-xs flex items-center justify-center font-bold">
                    {i + 1}
                  </span>
                  {step}
                </div>
                {i < pipeline.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-slate-600 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              9 AI Agents, <span className="gradient-text">One Mission</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              LangGraph-orchestrated agents handle every step from resume parsing to follow-up emails.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, description, color }) => (
              <Card key={title} className="group hover:scale-[1.02] hover:glow">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <Card className="text-center glow border-brand-500/30 p-10">
            <CardContent>
              <h2 className="text-3xl font-bold mb-4">Ready to land your next role?</h2>
              <p className="text-slate-400 mb-8">
                Set up your profile in minutes. The agent handles the rest.
              </p>
              <Link to="/register">
                <Button size="lg">
                  Create Free Account
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="py-8 text-center text-slate-600 text-sm border-t border-white/5">
        ApplyAI — Autonomous Job Application Agent
      </footer>
    </div>
  );
}
