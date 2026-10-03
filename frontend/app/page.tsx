"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  Code2,
  Database,
  History,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Terminal,
  UserCheck,
  User,
  LogOut,
  X,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PIPELINE_STEPS = [
  { id: "INPUT", label: "INCIDENT", icon: Terminal, desc: "Report received" },
  { id: "INVESTIGATE", label: "INVESTIGATE", icon: Brain, desc: "Telemetry & LLM analysis" },
  { id: "MEMORY", label: "REMEMBER", icon: Database, desc: "Organizational memory" },
  { id: "REASONING", label: "REASON", icon: Sparkles, desc: "Failures vs successes" },
  { id: "RECOMMEND", label: "RECOMMEND", icon: Zap, desc: "Targeted remediation" },
  { id: "APPROVAL", label: "APPROVE", icon: UserCheck, desc: "Human authorization" },
  { id: "EXECUTE", label: "EXECUTE", icon: Play, desc: "Simulated safe action" },
  { id: "VERIFY", label: "VERIFY", icon: CheckCircle2, desc: "Telemetry before & after" },
  { id: "REMEMBER", label: "LEARN", icon: History, desc: "Committed to memory" },
];

const PRESET_EXAMPLES = [
  {
    label: "Payment DB Pool",
    text: "Payment API is returning HTTP 500 errors and database connections are timing out. Customers are unable to complete payments.",
  },
  {
    label: "Notification Queue",
    text: "Customers are reporting that notifications are arriving several minutes late and the notification queue keeps growing.",
  },
  {
    label: "Auth Redis Pool",
    text: "The authentication service is experiencing failures because the Redis connection pool is exhausted.",
  },
  {
    label: "Checkout Deploy",
    text: "The checkout service started failing immediately after the latest deployment.",
  },
];

const INVESTIGATION_SEQUENCE = [
  { step: "UNDERSTAND", label: "UNDERSTAND", desc: "Parsing incident report & error telemetry" },
  { step: "SEARCH MEMORY", label: "SEARCH MEMORY", desc: "Searching historical organizational cases" },
  { step: "COMPARE", label: "COMPARE", desc: "Evaluating past failures vs successful fixes" },
  { step: "DECIDE", label: "DECIDE", desc: "Synthesizing verified remediation plan" },
];

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [inputQuery, setInputQuery] = useState(
    "Payment API is returning HTTP 500 errors and database connections are timing out. Customers are unable to complete payments."
  );
  const [incident, setIncident] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [stage, setStage] = useState<string>("INPUT");
  const [running, setRunning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Ready. Tell MemoryDesk what broke."
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approving, setApproving] = useState<boolean>(false);
  const [showMemoryDrawer, setShowMemoryDrawer] = useState<boolean>(false);
  const [showTraceModal, setShowTraceModal] = useState<boolean>(false);
  const [expandFullReasoning, setExpandFullReasoning] = useState<boolean>(false);
  const [expandActivityTrace, setExpandActivityTrace] = useState<boolean>(false);
  const [historicalIncidents, setHistoricalIncidents] = useState<any[]>([]);
  const [personalIncidents, setPersonalIncidents] = useState<any[]>([]);
  const [organizationalIncidents, setOrganizationalIncidents] = useState<any[]>([]);

  // ── PURPOSEFUL ANIMATION STATES ───────────────────────────────────────────
  const [isInvestigating, setIsInvestigating] = useState<boolean>(false);
  const [activeInvStep, setActiveInvStep] = useState<number>(0);
  const [submittedText, setSubmittedText] = useState<string>("");
  const [memoryState, setMemoryState] = useState<"idle" | "searching" | "found">("idle");
  const [animatedSimilarity, setAnimatedSimilarity] = useState<number>(0);
  const [approvalButtonState, setApprovalButtonState] = useState<"ready" | "approved" | "executing" | "executed">("ready");
  const [executionProgress, setExecutionProgress] = useState<number>(0);
  const [telemetryTransitioned, setTelemetryTransitioned] = useState<boolean>(false);

  const getAuthHeader = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("memorydesk_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const token = localStorage.getItem("memorydesk_token");
    const storedUser = localStorage.getItem("memorydesk_user");

    if (!token) {
      router.push("/login");
      return;
    }

    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) { }
    }

    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          localStorage.removeItem("memorydesk_token");
          localStorage.removeItem("memorydesk_user");
          router.push("/login");
        } else {
          return res.json();
        }
      })
      .then((data) => {
        if (data) {
          setCurrentUser(data);
          localStorage.setItem("memorydesk_user", JSON.stringify(data));
        }
      })
      .catch(() => { });

    loadMemoryDatabase();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch(`${API}/api/auth/logout`, { method: "POST" });
    } catch (e) { }
    localStorage.removeItem("memorydesk_token");
    localStorage.removeItem("memorydesk_user");
    router.push("/login");
  };

  // Load organizational + personal memory
  const loadMemoryDatabase = async () => {
    try {
      const res = await fetch(`${API}/api/memory`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.memories) {
          setHistoricalIncidents(data.memories);
        }
        if (data.personal_memories) {
          setPersonalIncidents(data.personal_memories);
        }
        if (data.organizational_memories) {
          setOrganizationalIncidents(data.organizational_memories);
        }
      }
    } catch (err) {
      console.warn("Could not pre-fetch historical memory list:", err);
    }
  };

  // Animate similarity percentage counter when memory match found
  useEffect(() => {
    if (incident?.memory?.similarity) {
      const target = incident.memory.similarity;
      let start = 0;
      const stepTime = 15;
      const totalSteps = 35;
      const increment = target / totalSteps;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        start += increment;
        if (step >= totalSteps) {
          setAnimatedSimilarity(target);
          clearInterval(timer);
        } else {
          setAnimatedSimilarity(Math.floor(start));
        }
      }, stepTime);

      return () => clearInterval(timer);
    }
  }, [incident?.memory?.similarity]);

  // Handle live incident submission
  const handleInvestigate = async () => {
    if (!inputQuery.trim()) return;

    setRunning(true);
    setErrorMessage(null);
    setSubmittedText(inputQuery);
    setIsInvestigating(true);
    setActiveInvStep(0);
    setIncident(null);
    setApprovalButtonState("ready");
    setTelemetryTransitioned(false);
    setStatusMessage("Agent investigating: Understanding what happened...");
    setStage("INVESTIGATE");

    const invInterval = setInterval(() => {
      setActiveInvStep((prev) => {
        if (prev < 3) return prev + 1;
        return prev;
      });
    }, 700);

    try {
      const res = await fetch(`${API}/api/agent/incidents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ message: inputQuery.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Agent investigation service encountered an error.");
      }

      clearInterval(invInterval);
      setActiveInvStep(3);
      await wait(300);

      setIncident(data);
      setAudit(data.audit || []);

      if (data.memory?.found) {
        setMemoryState("found");
        setStatusMessage(
          data.memory?.is_personal
            ? `Memory match found: ${data.memory.incident_id} (From Your Incident History)`
            : `Memory match found: ${data.memory.incident_id} (${data.memory.similarity}% similarity)`
        );
      } else {
        setMemoryState("idle");
        setStatusMessage("No closely related memory found. Synthesizing first-principles fix.");
      }

      setStage(data.approval?.approved ? "APPROVED" : "WAITING_FOR_APPROVAL");
      setIsInvestigating(false);
      loadMemoryDatabase();
    } catch (err: any) {
      clearInterval(invInterval);
      setIsInvestigating(false);
      setErrorMessage(
        err.message ||
        "The agent investigation service could not be reached. Please check backend connectivity."
      );
      setStatusMessage("Investigation error occurred.");
    } finally {
      setRunning(false);
    }
  };

  // Step 5 & 6: Human Approval & Execution
  const approveAndExecute = async () => {
    if (!incident || approving) return;

    setApproving(true);
    setApprovalButtonState("approved");
    setStatusMessage("Human approved recommendation. Initiating safe remediation...");
    setStage("APPROVAL");

    try {
      // 1. Post Approval
      const appRes = await fetch(`${API}/api/incidents/${incident.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ approved: true }),
      });
      const appData = await appRes.json();
      setIncident((prev: any) => ({ ...prev, approval: appData.approval, status: appData.status }));
      setAudit(appData.audit || []);

      await wait(450);

      // 2. Execute Remediation
      setApprovalButtonState("executing");
      setStage("EXECUTE");
      setStatusMessage("Executing remediation...");

      let p = 0;
      const pInterval = setInterval(() => {
        p += 20;
        if (p <= 90) setExecutionProgress(p);
      }, 150);

      const execRes = await fetch(`${API}/api/incidents/${incident.id}/execute`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      const execData = await execRes.json();
      clearInterval(pInterval);
      setExecutionProgress(100);

      setIncident((prev: any) => ({ ...prev, execution: execData.execution, status: execData.status }));
      setAudit(execData.audit || []);
      setApprovalButtonState("executed");
      setStatusMessage("Remediation executed. Awaiting telemetry verification...");

      await wait(450);

      // 3. Automated Verification
      setStage("VERIFY");
      setStatusMessage("Verifying recovery telemetry...");

      const verRes = await fetch(`${API}/api/incidents/${incident.id}/verify`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      const verData = await verRes.json();

      setIncident((prev: any) => ({
        ...prev,
        verification: verData.verification,
        verification_status: verData.verification_status,
        status: verData.status,
      }));
      setAudit(verData.audit || []);

      // Trigger animated bar chart transition
      setTimeout(() => {
        setTelemetryTransitioned(true);
      }, 250);

      await wait(800);

      // 4. Resolve & Commit to Organizational Memory
      const resRes = await fetch(`${API}/api/incidents/${incident.id}/resolve`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      const resData = await resRes.json();

      setIncident((prev: any) => ({
        ...prev,
        status: "RESOLVED",
        memory: resData.memory || prev.memory,
        new_memory_record: resData.new_memory_record || prev.new_memory_record,
      }));
      setAudit(resData.audit || []);
      setStage("REMEMBER");
      setStatusMessage(
        resData.new_memory_record?.failed_action
          ? `MEMORY UPDATED: Learned that '${resData.new_memory_record.failed_action}' failed and '${resData.new_memory_record.successful_action}' succeeded.`
          : "Incident resolved and permanently committed to organizational memory."
      );

      // Refresh memory list
      loadMemoryDatabase();
    } catch (err: any) {
      setErrorMessage("Action sequence encountered an issue: " + err.message);
      setStatusMessage("Resolution failed.");
    } finally {
      setApproving(false);
    }
  };

  // Reset to intake form
  const handleReset = () => {
    setIncident(null);
    setAudit([]);
    setStage("INPUT");
    setRunning(false);
    setIsInvestigating(false);
    setErrorMessage(null);
    setStatusMessage("Ready. Tell MemoryDesk what broke.");
    setApprovalButtonState("ready");
    setTelemetryTransitioned(false);
    setAnimatedSimilarity(0);
  };

  const getPipelineIndex = (currStage: string): number => {
    switch (currStage) {
      case "INPUT": return 0;
      case "INVESTIGATE": return 1;
      case "MEMORY": return 2;
      case "WAITING_FOR_APPROVAL": return 4;
      case "APPROVAL": return 5;
      case "EXECUTE": return 6;
      case "VERIFY": return 7;
      case "REMEMBER": return 8;
      default: return 3;
    }
  };

  const activePipelineIndex = getPipelineIndex(stage);

  const verificationMetrics = incident?.verification?.metrics || (
    incident?.verification?.before && incident?.verification?.after
      ? Object.keys(incident.verification.before).map((key) => ({
        id: key,
        label: key.replace(/_/g, " ").toUpperCase(),
        before: incident.verification.before[key],
        after: incident.verification.after[key],
        status_before: "Spiking",
        status_after: "Recovered",
        subtext: "Restored to normal operating baseline",
        bar_before: 90,
        bar_after: 5,
      }))
      : []
  );

  return (
    <main className="min-h-screen bg-[#fef9ed] text-[#5d524b] font-serif relative overflow-x-hidden selection:bg-[#fbd3be] selection:text-[#2e4d4d]">
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* ── TOP HEADER / MASTHEAD AREA (DEEP TEAL) ─────────────────────────── */}
        <header className="sticky top-0 z-40 bg-[#2e4d4d] border-b border-[#3b5e5e] text-[#fef9ed] transition-colors">
          <div className="max-w-[1240px] mx-auto px-6 h-16 flex items-center justify-between">
            {/* BRAND */}
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-full bg-[#fef9ed] flex items-center justify-center text-[#2e4d4d]">
                <Brain size={18} />
              </div>
              <div>
                <span className="font-serif text-lg font-normal tracking-tight text-[#fef9ed]">
                  MemoryDesk
                </span>
                <span className="ml-2 text-[10px] font-mono tracking-wider text-[#cec7bc] uppercase font-medium">
                  Incident Intelligence
                </span>
              </div>
            </div>

            {/* TOP ACTIONS */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMemoryDrawer(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#3b5e5e]/60 hover:bg-[#3b5e5e] border border-[#cec7bc]/30 text-xs font-mono text-[#fef9ed] transition cursor-pointer"
                title="Browse all organizational & personal memories"
              >
                <Database size={13} className="text-[#fbd3be]" />
                <span>Memories ({personalIncidents.length} personal · {organizationalIncidents.length || 10} org)</span>
              </button>

              {incident && (
                <button
                  onClick={() => setShowTraceModal(true)}
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#3b5e5e]/40 hover:bg-[#3b5e5e] border border-[#cec7bc]/30 text-xs font-mono text-[#cec7bc] hover:text-[#fef9ed] transition cursor-pointer"
                  title="View full Groq agent JSON reasoning trace"
                >
                  <Code2 size={13} />
                  <span>Agent Trace</span>
                </button>
              )}

              <div className="hidden sm:block h-4 w-px bg-[#cec7bc]/25" />

              <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[#cec7bc]">
                <span className="w-2 h-2 rounded-full bg-[#fbd3be]" />
                Groq LLM Active
              </span>

              <div className="h-4 w-px bg-[#cec7bc]/25" />

              {/* CURRENT USER & LOGOUT */}
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3b5e5e]/70 border border-[#cec7bc]/30 text-[11px] text-[#fef9ed] font-mono">
                    <User size={12} className="text-[#fbd3be]" />
                    <span className="truncate max-w-[150px]">{currentUser.username || currentUser.name || currentUser.email}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Log out of MemoryDesk"
                    className="flex items-center gap-1 text-[11px] font-mono text-[#cec7bc] hover:text-[#fbd3be] transition cursor-pointer px-2.5 py-1 rounded-full hover:bg-[#3b5e5e]/50"
                  >
                    <LogOut size={12} />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="text-xs font-mono font-medium text-[#fbd3be] hover:text-[#fef9ed] transition underline"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* ── VISUAL AGENT PIPELINE TRACKER ───────────────────────────────────── */}
        <section className="bg-[#f5f0e4] border-b border-[#cec7bc]">
          <div className="max-w-[1240px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between gap-4 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] font-medium text-[#72675b] bg-[#fef9ed] px-3 py-0.5 rounded-full border border-[#cec7bc]">
                  Agent Execution Pipeline
                </span>
                {incident && (
                  <span className="text-xs font-mono text-[#2e4d4d] bg-[#fef9ed] px-2.5 py-0.5 rounded-full border border-[#cec7bc]">
                    {incident.id}
                  </span>
                )}
              </div>

              {/* THREE VISUALLY DISTINCT STATUS BADGES */}
              <div className="flex items-center gap-2">
                {errorMessage ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-mono bg-[#8c5462]/10 text-[#8c5462] border border-[#8c5462]/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8c5462]" />
                    INVESTIGATION SERVICE ERROR
                  </span>
                ) : incident && incident.memory?.found === false ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-mono bg-[#fbd3be]/40 text-[#5d524b] border border-[#cec7bc]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#72675b]" />
                    NO RELEVANT MEMORY FOUND
                  </span>
                ) : incident ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-mono bg-[#2e4d4d]/10 text-[#2e4d4d] border border-[#2e4d4d]/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2e4d4d]" />
                    INCIDENT RECEIVED
                  </span>
                ) : null}

                <div className="text-xs font-serif italic text-[#72675b] bg-[#fef9ed] px-3.5 py-0.5 rounded-full border border-[#cec7bc] truncate max-w-md">
                  {statusMessage}
                </div>
              </div>
            </div>

            {/* PIPELINE NODES */}
            <div className="overflow-x-auto pb-1 pt-1">
              <div className="flex items-center min-w-[940px] justify-between">
                {PIPELINE_STEPS.map((step, idx) => {
                  const isPassed = incident ? idx < activePipelineIndex : false;
                  const isCurrent = incident ? idx === activePipelineIndex : (isInvestigating ? idx === 1 : idx === 0);
                  const IconComponent = step.icon;

                  return (
                    <div key={step.id} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border ${isCurrent
                            ? "bg-[#2e4d4d] text-[#fef9ed] border-[#2e4d4d]"
                            : isPassed
                              ? "bg-[#fef9ed] text-[#2e4d4d] border-[#cec7bc]"
                              : "bg-[#f5f0e4] text-[#72675b] border-[#cec7bc]"
                            }`}
                        >
                          {isPassed ? (
                            <Check size={14} className="text-[#2e4d4d]" />
                          ) : (
                            <IconComponent size={14} />
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-mono tracking-tight mt-1.5 whitespace-nowrap ${isCurrent
                            ? "text-[#2e4d4d] font-bold"
                            : isPassed
                              ? "text-[#5d524b]"
                              : "text-[#72675b]"
                            }`}
                        >
                          {step.label}
                        </span>
                      </div>

                      {/* Connecting Line */}
                      {idx < PIPELINE_STEPS.length - 1 && (
                        <div className="h-px flex-1 mx-2 relative overflow-hidden bg-[#cec7bc]">
                          {isPassed ? (
                            <div className="h-full bg-[#2e4d4d]" />
                          ) : isCurrent ? (
                            <div className="h-full w-full bg-[#2e4d4d] animate-flow-beam" />
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 1 & 2: INCIDENT ARRIVES & INVESTIGATION SEQUENCE ───────── */}
        {isInvestigating && !incident && (
          <section className="max-w-[900px] mx-auto px-6 py-10 animate-fade-scale">
            <div className="bg-[#f5f0e4] rounded-[25px] border border-[#cec7bc] p-8 shadow-none relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2e4d4d] text-[#fef9ed] flex items-center justify-center animate-agent-pulse">
                    <Brain size={20} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-mono tracking-[0.14em] text-[#72675b]">
                      AGENT INVESTIGATION IN PROGRESS
                    </div>
                    <h3 className="text-2xl font-serif font-normal text-[#2e4d4d]">
                      Understanding what happened...
                    </h3>
                  </div>
                </div>
                <span className="text-xs font-mono px-3.5 py-1 bg-[#fef9ed] border border-[#cec7bc] rounded-full text-[#2e4d4d] flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin text-[#2e4d4d]" />
                  Groq Agent Active
                </span>
              </div>

              {/* Submitted Incident Quote */}
              <div className="bg-[#fef9ed] rounded-[16px] p-4 border border-[#cec7bc] mt-3">
                <div className="text-[10px] uppercase font-mono text-[#72675b] mb-1">
                  Incident Report
                </div>
                <p className="text-sm font-serif italic text-[#5d524b]">
                  &ldquo;{submittedText}&rdquo;
                </p>
              </div>

              {/* 4-Step Investigation Sequence */}
              <div className="mt-8 pt-6 border-t border-[#cec7bc]">
                <div className="text-center text-[10px] font-mono uppercase tracking-widest text-[#72675b] mb-4">
                  Investigation Pipeline Sequence
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {INVESTIGATION_SEQUENCE.map((item, idx) => {
                    const isActive = idx === activeInvStep;
                    const isDone = idx < activeInvStep;

                    return (
                      <div
                        key={item.step}
                        className={`rounded-[16px] p-4 border transition-all duration-200 ${isActive
                          ? "bg-[#2e4d4d] text-[#fef9ed] border-[#2e4d4d]"
                          : isDone
                            ? "bg-[#fef9ed] text-[#5d524b] border-[#cec7bc]"
                            : "bg-[#f5f0e4] text-[#72675b] border-[#cec7bc]/60"
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-[10px] font-mono uppercase tracking-wider ${isActive ? "text-[#fbd3be]" : "text-[#72675b]"
                              }`}
                          >
                            Step 0{idx + 1}
                          </span>
                          {isDone ? (
                            <Check size={14} className="text-[#2e4d4d]" />
                          ) : isActive ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#fbd3be] animate-ping" />
                          ) : null}
                        </div>

                        <div className="font-mono text-xs tracking-tight">
                          {item.label}
                        </div>
                        <div
                          className={`text-[11px] font-serif mt-1 line-clamp-2 leading-tight ${isActive ? "text-[#fef9ed]/90" : "text-[#72675b]"
                            }`}
                        >
                          {item.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── PRIMARY INPUT HERO (WHEN NO INCIDENT AND NOT INVESTIGATING) ──────── */}
        {!incident && !isInvestigating && (
          <div className="flex-1 flex flex-col">
            {/* HERO MASTHEAD SECTION (DEEP TEAL) */}
            <section className="bg-[#2e4d4d] text-[#fef9ed] pt-16 pb-20 px-6 text-center border-b border-[#3b5e5e]">
              <div className="max-w-[960px] mx-auto">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#3b5e5e]/60 border border-[#cec7bc]/30 text-[11px] font-mono text-[#fbd3be] mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#fbd3be]" />
                  ORGANIZATIONAL MEMORY AI AGENT
                </div>

                {/* EDITORIAL SERIF HEADLINE */}
                <div className="space-y-1">
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-normal tracking-tight text-[#cec7bc]">
                    Something broke.
                  </h1>
                  <div className="flex items-center justify-center gap-2 text-[#fbd3be] py-1">
                    <ArrowDown size={18} className="animate-bounce" />
                  </div>
                  <h2 className="text-4xl sm:text-5xl md:text-6xl font-serif font-normal tracking-tight text-[#fef9ed]">
                    MemoryDesk <span className="italic text-[#fbd3be]">remembers.</span>
                  </h2>
                </div>

                <p className="max-w-xl mx-auto mt-5 text-sm sm:text-base text-[#cec7bc] font-serif leading-relaxed">
                  An AI teammate that turns past failures into future capability.
                  Compare against organizational memory, learn what failed, and execute verified fixes.
                </p>
              </div>
            </section>

            {/* INPUT SECTION (WARM PAPER SURFACE ON PARCHMENT) */}
            <section className="max-w-[1020px] mx-auto px-6 -mt-10 mb-14 w-full animate-fade-scale">
              <div className="bg-[#f5f0e4] rounded-[25px] border border-[#cec7bc] p-6 md:p-8 shadow-none">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-mono tracking-[0.14em] text-[#72675b] font-medium">
                    Live Incident Report
                  </span>
                  <span className="text-xs text-[#72675b] font-serif italic">Natural language free-text input</span>
                </div>

                <textarea
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder='Example: "Payment API is returning HTTP 500 errors and database connections are timing out. Customers are unable to complete payments."'
                  rows={3}
                  className="w-full rounded-[20px] border border-[#cec7bc] bg-[#fef9ed] p-4 text-[15px] text-[#5d524b] placeholder:text-[#cec7bc] focus:border-[#2e4d4d] focus:outline-none transition leading-relaxed resize-none font-serif"
                />

                {/* FAQs */}
                <div className="mt-4 pt-3 border-t border-[#cec7bc]/50">
                  <div className="text-[10px] uppercase font-mono tracking-[0.14em] text-[#72675b] mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2e4d4d]"></span>
                    FAQs
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {PRESET_EXAMPLES.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setInputQuery(p.text)}
                        className="text-[11px] px-3.5 py-1.5 rounded-full bg-[#fef9ed] hover:bg-[#eae3d4] text-[#5d524b] border border-[#cec7bc] transition font-mono cursor-pointer active:scale-98"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ACCOUNT INCIDENT MEMORY STATUS INDICATOR */}
                <div className="mt-3.5 px-3.5 py-2.5 rounded-[16px] bg-[#fef9ed] border border-[#cec7bc] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#72675b]">
                  <div className="flex items-center gap-2 font-serif">
                    <span className={`w-2 h-2 rounded-full ${personalIncidents.length > 0 ? "bg-[#2e4d4d]" : "bg-[#cec7bc]"}`} />
                    {personalIncidents.length === 0 ? (
                      <span className="italic text-[#72675b]">
                        Your incident history is empty. Resolved incidents will become part of your MemoryDesk experience.
                      </span>
                    ) : (
                      <span className="text-[#5d524b]">
                        Your Incident History: <strong className="text-[#2e4d4d] font-bold font-mono">{personalIncidents.length} personal {personalIncidents.length === 1 ? "incident" : "incidents"}</strong> active in memory
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMemoryDrawer(true)}
                    className="text-[11px] font-mono text-[#2e4d4d] hover:text-[#5d524b] transition underline self-end sm:self-auto cursor-pointer"
                  >
                    Browse organizational memory ({organizationalIncidents.length || 10}) →
                  </button>
                </div>

                {/* ACTION BAR */}
                <div className="mt-6 pt-5 border-t border-[#cec7bc]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-[#72675b] flex items-center gap-2 font-serif italic">
                    <Brain size={14} className="text-[#2e4d4d] shrink-0" />
                    <span>Powered by Groq LLM · Dynamic candidate retrieval & reasoning</span>
                  </div>

                  <button
                    onClick={handleInvestigate}
                    disabled={running || !inputQuery.trim()}
                    className="bg-[#2e4d4d] hover:bg-[#253f3f] text-[#fef9ed] px-8 py-3.5 rounded-full text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2.5 disabled:opacity-50 transition shrink-0 cursor-pointer border border-[#2e4d4d]"
                  >
                    {running ? (
                      <RefreshCw size={14} className="animate-spin text-[#fbd3be]" />
                    ) : (
                      <ArrowRight size={14} className="text-[#fbd3be]" />
                    )}
                    <span>{running ? "Groq Agent Investigating..." : "Investigate Incident →"}</span>
                  </button>
                </div>

                {/* ERROR BANNER IF ANY */}
                {errorMessage && (
                  <div className="mt-4 p-4 rounded-[16px] bg-[#8c5462]/10 border border-[#8c5462]/40 text-[#8c5462] text-xs flex items-start gap-3 animate-fade-scale">
                    <div className="w-5 h-5 rounded-full bg-[#8c5462]/20 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle size={13} className="text-[#8c5462]" />
                    </div>
                    <div>
                      <div className="font-mono text-[#8c5462] text-xs font-bold uppercase">
                        INVESTIGATION SERVICE ERROR
                      </div>
                      <div className="mt-1 font-serif font-medium text-[#8c5462]">
                        &ldquo;Investigation service unavailable&rdquo;
                      </div>
                      <div className="mt-0.5 text-xs text-[#8c5462]/90">
                        {errorMessage}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ── INCIDENT WORKSPACE (JURY DEMO SCREEN) ──────────────────────────── */}
        {incident && (
          <div className="max-w-[1240px] mx-auto px-6 py-8 space-y-6 animate-fade-scale w-full flex-1">
            {/* TOP CONTROLS */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1 rounded-full text-[10px] font-mono tracking-wider bg-[#2e4d4d] text-[#fef9ed]">
                  LIVE INCIDENT #{incident.id.replace("INC-", "")}
                </span>
                <span className="text-xs font-mono text-[#72675b]">
                  Created {new Date(incident.created_at).toLocaleTimeString()}
                </span>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#f5f0e4] hover:bg-[#eae3d4] border border-[#cec7bc] text-xs font-mono text-[#5d524b] cursor-pointer transition"
              >
                <RotateCcw size={13} />
                <span>Report New Incident</span>
              </button>
            </div>

            {/* ── ROW 1: "WHAT YOU REPORTED" + "AI CLASSIFICATION" ───────────── */}
            <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5 items-stretch">
              {/* WHAT YOU REPORTED */}
              <div className="bg-[#f5f0e4] rounded-[25px] p-6 border border-[#cec7bc] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#8c5462]" />
                      <span className="text-[11px] font-mono tracking-widest text-[#72675b] uppercase">
                        WHAT YOU REPORTED
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#72675b] bg-[#fef9ed] px-2 py-0.5 rounded border border-[#cec7bc]">RAW INPUT</span>
                  </div>

                  <div className="text-xl md:text-2xl font-serif text-[#2e4d4d] leading-snug mt-2">
                    &ldquo;{incident.message}&rdquo;
                  </div>
                </div>

                {/* AI UNDERSTANDING & CLASSIFICATION */}
                <div className="mt-5 pt-4 border-t border-[#cec7bc]/50">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[#72675b] mb-2">
                    AI Classification
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono">
                    <span className="px-3 py-1 rounded-full bg-[#fef9ed] text-[#5d524b] border border-[#cec7bc] text-xs flex items-center gap-1.5">
                      <Activity size={12} className="text-[#2e4d4d]" />
                      <span>{incident.category || "Transaction / API"}</span>
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs border ${incident.severity === "CRITICAL"
                        ? "bg-[#8c5462]/10 text-[#8c5462] border-[#8c5462]/30"
                        : "bg-[#fbd3be]/40 text-[#5d524b] border-[#cec7bc]"
                        }`}
                    >
                      {incident.severity || "HIGH"} SEVERITY
                    </span>
                    <span className="px-3 py-1 rounded-full bg-[#fef9ed] text-[#5d524b] text-xs flex items-center gap-1.5 border border-[#cec7bc]">
                      <Sparkles size={12} className="text-[#2e4d4d]" />
                      <span>Groq: {incident.llm_model}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* TELEMETRY SIGNALS EXTRACTED */}
              <div className="bg-[#f5f0e4] rounded-[25px] p-6 border border-[#cec7bc] flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-mono tracking-widest text-[#72675b] uppercase mb-3">
                    EXTRACTED TELEMETRY SIGNALS
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#fef9ed] rounded-[16px] p-3.5 border border-[#cec7bc] text-center">
                      <div className="text-[10px] uppercase font-mono text-[#72675b]">HTTP 500</div>
                      <div className="text-xl font-serif text-[#8c5462] mt-1 font-mono">
                        {incident.evidence?.metrics?.http_500_rate || "17.9%"}
                      </div>
                      <div className="text-[9px] text-[#8c5462] mt-0.5 font-serif italic">Critical Spike</div>
                    </div>

                    <div className="bg-[#fef9ed] rounded-[16px] p-3.5 border border-[#cec7bc] text-center">
                      <div className="text-[10px] uppercase font-mono text-[#72675b]">DB Pool</div>
                      <div className="text-xl font-serif text-[#8c5462] mt-1 font-mono">
                        {incident.evidence?.metrics?.db_pool_utilization || "98%"}
                      </div>
                      <div className="text-[9px] text-[#8c5462] mt-0.5 font-serif italic">Saturated</div>
                    </div>

                    <div className="bg-[#fef9ed] rounded-[16px] p-3.5 border border-[#cec7bc] text-center">
                      <div className="text-[10px] uppercase font-mono text-[#72675b]">P99 Latency</div>
                      <div className="text-xl font-serif text-[#72675b] mt-1 font-mono">
                        {incident.evidence?.metrics?.latency_ms ? `${incident.evidence.metrics.latency_ms}ms` : "5100ms"}
                      </div>
                      <div className="text-[9px] text-[#72675b] mt-0.5 font-serif italic">Timing out</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#cec7bc]/50 text-xs text-[#72675b] flex items-center gap-2 font-serif italic">
                  <CheckCircle2 size={14} className="text-[#2e4d4d] shrink-0" />
                  <span>Signals correlated with 10 historical organizational cases</span>
                </div>
              </div>
            </div>

            {/* ── ROW 2A: "🧠 MEMORY DISCOVERY" CARD (WHEN RELEVANT PRECEDENT FOUND) ───── */}
            {incident.memory?.found && (
              <div className={`rounded-[25px] p-6 md:p-8 border ${incident.memory?.is_personal
                ? "bg-gradient-to-br from-[#fbd3be]/25 via-[#f5f0e4] to-[#f5f0e4] border-[#2e4d4d]"
                : "bg-[#f5f0e4] border-[#cec7bc]"
                }`}>
                {/* Visual Connection */}
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono bg-[#fef9ed] px-3.5 py-1.5 rounded-full border border-[#cec7bc] mb-4 inline-flex">
                  <span className="text-[#5d524b]">CURRENT INCIDENT</span>
                  <span className="text-[#72675b]">── similar experience found ──→</span>
                  <span className={incident.memory?.is_personal ? "text-[#2e4d4d] font-bold" : "text-[#2e4d4d] font-medium"}>
                    {incident.memory?.is_personal
                      ? `🧠 FIRST SEEN IN YOUR INCIDENT HISTORY (${incident.memory.incident_id})`
                      : `🧠 PAST EXPERIENCE (${incident.memory.incident_id})`}
                  </span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div>
                    <div className={`inline-flex items-center gap-2 text-[10px] uppercase font-mono tracking-[0.14em] px-3 py-0.5 rounded-full border ${incident.memory?.is_personal
                      ? "bg-[#2e4d4d] text-[#fef9ed] border-[#2e4d4d]"
                      : "bg-[#fef9ed] text-[#2e4d4d] border-[#cec7bc]"
                      }`}>
                      <Brain size={12} />
                      <span>
                        {incident.memory?.is_personal
                          ? "Memory match found · First seen in your incident history"
                          : (memoryState === "searching"
                            ? "Searching previous experiences..."
                            : "Memory found · Organizational precedent")}
                      </span>
                    </div>

                    <h3 className="text-2xl md:text-3xl font-serif font-normal text-[#2e4d4d] mt-2">
                      {incident.memory.incident_id} · {incident.memory.title}
                    </h3>

                    <p className="text-xs text-[#72675b] mt-1 font-serif">
                      Historical Root Cause: <strong className="text-[#2e4d4d] font-serif font-normal italic">{incident.memory.root_cause}</strong>
                    </p>
                  </div>

                  {/* SIMILARITY COUNTER */}
                  <div className="bg-[#fef9ed] rounded-[20px] p-4 md:px-6 md:py-4 border border-[#cec7bc] text-center shrink-0">
                    <div className="text-4xl md:text-5xl font-mono text-[#2e4d4d] tabular-nums">
                      {animatedSimilarity || incident.memory.similarity}%
                    </div>
                    <div className="text-[10px] uppercase font-mono tracking-widest text-[#72675b] mt-0.5">
                      SIMILARITY MATCH
                    </div>
                  </div>
                </div>

                {/* SIDE-BY-SIDE SYMPTOM COMPARISON */}
                <div className="mt-6 pt-5 border-t border-[#cec7bc]/50">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[#72675b] mb-3">
                    {incident.memory?.is_personal
                      ? "Pattern Alignment: Current Incident vs. Your Previous Incident Experience"
                      : "Symptom Alignment: Current Incident vs. Historical Incident"}
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    {incident.memory.why_similar?.map((reason: string, idx: number) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2.5 rounded-[16px] px-3.5 py-3 text-xs border ${reason.includes("your incident history")
                          ? "bg-[#2e4d4d]/10 text-[#2e4d4d] border-[#2e4d4d]/30 font-medium"
                          : "bg-[#fef9ed] text-[#5d524b] border-[#cec7bc]"
                          }`}
                      >
                        <CheckCircle2 size={15} className={reason.includes("your incident history") ? "text-[#2e4d4d] shrink-0" : "text-[#72675b] shrink-0"} />
                        <span className="font-serif">{reason}</span>
                      </div>
                    ))}
                  </div>

                  {incident.memory.important_difference && (
                    <div className="mt-3 text-xs text-[#5d524b] bg-[#fef9ed] rounded-[16px] px-3.5 py-2 border border-[#cec7bc] flex items-center gap-2 font-serif">
                      <span className="text-[9px] uppercase font-mono text-[#2e4d4d] px-2 py-0.5 bg-[#f5f0e4] rounded border border-[#cec7bc]">
                        Context Difference
                      </span>
                      <span>{incident.memory.important_difference}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── ROW 2B: NO MEMORY FOUND ───── */}
            {!incident.memory?.found && (
              <div className="rounded-[25px] bg-[#f5f0e4] border border-[#fbd3be] p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div>
                    <div className="inline-flex items-center gap-2 text-[10px] uppercase font-mono tracking-[0.14em] px-3 py-0.5 rounded-full bg-[#fbd3be]/40 text-[#5d524b] border border-[#cec7bc]">
                      <Brain size={12} className="text-[#2e4d4d]" />
                      <span>NO CLOSELY RELATED EXPERIENCE FOUND</span>
                    </div>

                    <h3 className="text-2xl md:text-3xl font-serif font-normal text-[#2e4d4d] mt-2">
                      &ldquo;We couldn&apos;t find a previous incident that closely matches this problem.&rdquo;
                    </h3>

                    <p className="text-xs text-[#72675b] mt-1.5 font-serif leading-relaxed max-w-2xl">
                      MemoryDesk evaluated all 10 organizational historical precedents and verified that this represents a novel incident pattern.
                    </p>
                    <div className="mt-2.5 text-xs font-serif italic text-[#5d524b] bg-[#fef9ed] px-3.5 py-2 rounded-[16px] border border-[#cec7bc] inline-block">
                      &ldquo;MemoryDesk doesn&apos;t invent a previous experience when none exists.&rdquo;
                    </div>
                  </div>

                  {/* ZERO MATCH CALLOUT */}
                  <div className="bg-[#fef9ed] rounded-[20px] p-4 md:px-6 md:py-4 border border-[#cec7bc] text-center shrink-0">
                    <div className="text-4xl md:text-5xl font-mono text-[#72675b]">
                      0%
                    </div>
                    <div className="text-[10px] uppercase font-mono tracking-widest text-[#72675b] mt-0.5">
                      NO PRECEDENT IN MEMORY
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#cec7bc]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#72675b] font-serif">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[#2e4d4d] shrink-0" />
                    <span>Reasoning proceeds using first-principles evidence and live telemetry.</span>
                  </div>
                  <span className="text-[11px] font-mono">
                    Novel Incident · Resolution will establish future organizational memory
                  </span>
                </div>
              </div>
            )}

            {/* ── ROW 3A: FAILED VS SUCCESSFUL ACTIONS ── */}
            {incident.memory?.found && (
              <div className="space-y-4">
                <div className="text-center">
                  <span className={`text-[11px] font-mono uppercase tracking-widest px-3.5 py-1 rounded-full border ${incident.memory?.is_personal
                    ? "bg-[#2e4d4d] text-[#fef9ed] border-[#2e4d4d]"
                    : "bg-[#f5f0e4] text-[#2e4d4d] border-[#cec7bc]"
                    }`}>
                    {incident.memory?.is_personal
                      ? `YOUR PREVIOUS EXPERIENCE · WHAT FAILED VS. WHAT WORKED (${incident.memory.incident_id})`
                      : "HISTORICAL EXPERIENCE · WHAT FAILED VS. WHAT WORKED"}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-5 items-stretch">
                  {/* ❌ PREVIOUSLY FAILED (MUTED FADED ROSE) */}
                  <div className="bg-[#f5f0e4] rounded-[25px] p-6 border border-[#8c5462]/35 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-mono text-[#8c5462]">
                          <div className="w-5 h-5 rounded-full bg-[#8c5462]/10 flex items-center justify-center border border-[#8c5462]/30">
                            <X size={12} className="text-[#8c5462]" />
                          </div>
                          <span>
                            {incident.memory?.is_personal ? `FAILED IN YOUR INCIDENT: ${incident.memory.incident_id}` : `FAILED: ${incident.memory.incident_id}`}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono uppercase tracking-wider bg-[#8c5462]/10 text-[#8c5462] px-2.5 py-0.5 rounded-full border border-[#8c5462]/30">
                          Didn't solve the problem
                        </span>
                      </div>

                      <div className="text-xl font-serif text-[#5d524b] mt-4 flex items-center gap-2">
                        <span className="text-[#8c5462] font-mono">✕</span>
                        <span>{incident.memory.failed_action || incident.memory.failed_actions?.[0] || "Restart payment service"}</span>
                      </div>

                      <div className="mt-2 text-xs text-[#8c5462] bg-[#fef9ed] p-3 rounded-[16px] border border-[#8c5462]/20 font-serif">
                        Result: {incident.memory.failed_result || "Didn't solve the problem. Service remained unhealthy and connections timed out."}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#cec7bc]/50 text-xs text-[#72675b] font-serif">
                      <strong className="text-[#8c5462] font-medium">MemoryDesk Warning:</strong> Historical precedent proves blind restarts waste critical minutes.
                    </div>
                  </div>

                  {/* ✓ PREVIOUSLY WORKED (SUBTLE DEEP TEAL) */}
                  <div className={`rounded-[25px] p-6 border flex flex-col justify-between ${incident.memory?.is_personal
                    ? "bg-[#f5f0e4] border-[#2e4d4d]"
                    : "bg-[#f5f0e4] border-[#2e4d4d]/60"
                    }`}>
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-mono text-[#2e4d4d]">
                          <div className="w-5 h-5 rounded-full bg-[#2e4d4d]/10 flex items-center justify-center border border-[#2e4d4d]/30">
                            <Check size={12} className="text-[#2e4d4d]" />
                          </div>
                          <span>
                            {incident.memory?.is_personal ? `WORKED IN YOUR INCIDENT: ${incident.memory.incident_id}` : `SUCCESSFUL: ${incident.memory.incident_id}`}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono uppercase tracking-wider bg-[#2e4d4d]/10 text-[#2e4d4d] px-2.5 py-0.5 rounded-full border border-[#2e4d4d]/30">
                          Problem recovered
                        </span>
                      </div>

                      <div className="text-xl font-serif text-[#2e4d4d] mt-4 flex items-center gap-2">
                        <span className="text-[#2e4d4d] font-mono">✓</span>
                        <span>{incident.memory.successful_action || incident.memory.successful_actions?.[0] || "Increase database connection pool from 10 to 50"}</span>
                      </div>

                      <div className="mt-2 text-xs text-[#2e4d4d] bg-[#fef9ed] p-3 rounded-[16px] border border-[#2e4d4d]/20 font-serif">
                        Result: {incident.memory.successful_result || "Problem recovered. Database pool pressure dropped and API returned to healthy state."}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#cec7bc]/50 text-xs text-[#72675b] font-serif">
                      <strong className="text-[#2e4d4d] font-medium">Proven Precedent:</strong> Directly drives the current AI recommendation.
                    </div>
                  </div>
                </div>

                {/* ANIMATED PATH */}
                <div className="flex flex-col items-center justify-center pt-2 pb-1">
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f5f0e4] border border-[#cec7bc] text-xs font-mono text-[#5d524b]">
                    <span>PAST EXPERIENCE</span>
                    <span className="text-[#72675b]">→</span>
                    <span className="text-[#2e4d4d]">SUCCESSFUL ACTION</span>
                    <span className="text-[#72675b]">→</span>
                    <span>CURRENT RECOMMENDATION</span>
                  </div>
                  <div className="text-[11px] font-serif italic text-[#72675b] mt-1">
                    &ldquo;MemoryDesk learned from previous trial and error.&rdquo;
                  </div>
                </div>
              </div>
            )}

            {/* ── ROW 3B: NO MEMORY FOUND CONTEXT CARD ── */}
            {!incident.memory?.found && (
              <div className="bg-[#f5f0e4] rounded-[25px] p-6 border border-[#cec7bc]">
                <div className="flex items-center gap-2 text-xs font-mono text-[#2e4d4d] mb-2">
                  <Sparkles size={14} className="text-[#2e4d4d]" />
                  <span className="uppercase tracking-wider">FIRST-PRINCIPLES INVESTIGATION</span>
                </div>
                <p className="text-xs text-[#5d524b] font-serif leading-relaxed">
                  Because no historical precedent exists in institutional memory, MemoryDesk avoids speculative comparisons. The recommendation below is synthesized directly from observed error signals and technical classification. Once this remediation is approved and verified, it will be automatically committed to organizational memory for future engineers.
                </p>
              </div>
            )}

            {/* ── ROW 4: AGENT DECISION CHAIN ─────────────────────────────────── */}
            <div className="bg-[#f5f0e4] rounded-[25px] p-6 border border-[#cec7bc]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase font-mono tracking-[0.14em] text-[#72675b]">
                  AGENT REASONING PIPELINE
                </span>
                <button
                  onClick={() => setExpandFullReasoning(!expandFullReasoning)}
                  className="text-xs font-serif text-[#2e4d4d] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{expandFullReasoning ? "Hide Full LLM Text" : "View Full LLM Explanation"}</span>
                  {expandFullReasoning ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* 5 NODES */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-[#fef9ed] rounded-[16px] p-3.5 border border-[#cec7bc]">
                  <div className="text-[9px] uppercase font-mono text-[#72675b]">
                    1. OBSERVED
                  </div>
                  <div className="text-xs font-serif text-[#5d524b] mt-1.5 leading-snug">
                    {incident.category || "Service error"} symptoms detected
                  </div>
                </div>

                <div className="bg-[#fef9ed] rounded-[16px] p-3.5 border border-[#cec7bc]">
                  <div className="text-[9px] uppercase font-mono text-[#72675b]">
                    2. MEMORY
                  </div>
                  <div className="text-xs font-serif text-[#2e4d4d] mt-1.5 leading-snug">
                    {incident.memory?.found
                      ? `Matched ${incident.memory.incident_id} (${animatedSimilarity || incident.memory.similarity}%)`
                      : "No precedent in memory (0%)"}
                  </div>
                </div>

                <div className={`rounded-[16px] p-3.5 border ${incident.memory?.found ? "bg-[#8c5462]/10 border-[#8c5462]/30 text-[#8c5462]" : "bg-[#fef9ed] border-[#cec7bc] text-[#72675b]"}`}>
                  <div className={`text-[9px] uppercase font-mono ${incident.memory?.found ? "text-[#8c5462]" : "text-[#72675b]"}`}>
                    3. LEARNING
                  </div>
                  <div className="text-xs font-serif mt-1.5 leading-snug">
                    {incident.memory?.found ? "Restart previously failed ✕" : "Novel pattern (no prior trial)"}
                  </div>
                </div>

                <div className="bg-[#fef9ed] rounded-[16px] p-3.5 border border-[#cec7bc]">
                  <div className="text-[9px] uppercase font-mono text-[#2e4d4d]">
                    4. DECISION
                  </div>
                  <div className="text-xs font-serif text-[#5d524b] mt-1.5 leading-snug">
                    {incident.memory?.found ? "Apply proven DB pool expansion" : "Synthesized first-principles fix"}
                  </div>
                </div>

                <div className="bg-[#2e4d4d] text-[#fef9ed] rounded-[16px] p-3.5 col-span-2 md:col-span-1 border border-[#2e4d4d]">
                  <div className="text-[9px] uppercase font-mono text-[#fbd3be]">
                    5. RECOMMEND
                  </div>
                  <div className="text-xs font-serif text-[#fef9ed] mt-1.5 leading-snug truncate">
                    {incident.recommendation?.action || "Remediation"}
                  </div>
                </div>
              </div>

              {/* EXPANDABLE FULL LLM REASONING */}
              {expandFullReasoning && (
                <div className="mt-4 p-4 rounded-[16px] bg-[#fef9ed] text-[#5d524b] border border-[#cec7bc]">
                  <div className="text-[10px] uppercase font-mono text-[#72675b] mb-1">
                    Full Natural Language Explanation (Groq LLM)
                  </div>
                  <p className="text-xs md:text-sm text-[#5d524b] leading-relaxed font-serif italic">
                    &ldquo;{incident.memory?.why_memory_changed || incident.agent?.recommendation?.why_memory_changed}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* ── ROW 5: AI RECOMMENDATION & HUMAN APPROVAL ───────────────────── */}
            <div className="rounded-[25px] bg-[#f5f0e4] border border-[#cec7bc] p-7 md:p-9 shadow-none">
              <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-center">
                <div>
                  <div className="flex items-center gap-2 text-[#2e4d4d] text-[10px] font-mono uppercase tracking-[0.14em]">
                    <Zap size={14} className="text-[#2e4d4d]" />
                    <span>
                      {incident.memory?.found
                        ? "MEMORYDESK RECOMMENDS"
                        : "MEMORYDESK RECOMMENDS (NOVEL INCIDENT)"}
                    </span>
                  </div>

                  <h3 className="text-2xl md:text-4xl font-serif text-[#2e4d4d] tracking-tight mt-2 font-normal">
                    {incident.recommendation?.action || incident.agent?.recommendation?.action}
                  </h3>

                  <p className="text-[#72675b] text-xs md:text-sm leading-relaxed mt-2.5 max-w-xl font-serif italic">
                    {incident.memory?.found
                      ? "“Because this approach worked for a similar incident before.”"
                      : "“Synthesized from observed telemetry and error classification (no prior experience in memory).”"}
                  </p>

                  <p className="text-[#5d524b] text-xs leading-relaxed mt-1 max-w-xl font-serif">
                    {incident.recommendation?.reason || incident.agent?.recommendation?.reason}
                  </p>

                  {incident.recommendation?.sufficient_information === false && (
                    <div className="mt-3 p-3 rounded-[16px] bg-[#fbd3be]/30 border border-[#cec7bc] text-xs text-[#5d524b] font-serif">
                      <strong className="text-[#2e4d4d] block mb-0.5">Additional Diagnostic Information Needed:</strong>
                      {incident.recommendation?.missing_information || "Inspect service logs and endpoint metrics before executing changes."}
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2 font-mono">
                    <span className="px-3 py-1 bg-[#fef9ed] rounded-full text-[10px] text-[#72675b] border border-[#cec7bc]">
                      {incident.recommendation?.risk || "LOW"} RISK
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[10px] border ${incident.memory?.found ? "bg-[#2e4d4d]/10 text-[#2e4d4d] border-[#2e4d4d]/30" : "bg-[#fbd3be]/40 text-[#5d524b] border-[#cec7bc]"}`}>
                      {incident.memory?.found ? "MEMORY SUPPORTED" : "NOVEL PATTERN"}
                    </span>
                    <span className="px-3 py-1 bg-[#fef9ed] rounded-full text-[10px] text-[#2e4d4d] border border-[#cec7bc]">
                      HUMAN APPROVAL REQUIRED
                    </span>
                  </div>
                </div>

                {/* APPROVE & EXECUTE CARD */}
                <div className="bg-[#fef9ed] rounded-[20px] p-5 border border-[#cec7bc] flex flex-col justify-between shadow-none">
                  <div>
                    <div className="text-[10px] uppercase font-mono tracking-widest text-[#72675b]">
                      SAFETY GUARDRAIL
                    </div>
                    <div className="mt-2 text-xs text-[#5d524b] leading-relaxed bg-[#f5f0e4] p-3 rounded-[16px] border border-[#cec7bc] font-serif">
                      <span className="font-mono text-[#8c5462] font-bold">Avoid: </span>
                      <span>
                        {incident.recommendation?.failed_action_warning ||
                          "Review metrics before approval."}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5">
                    {/* PROGRESS INDICATOR DURING EXECUTION */}
                    {approvalButtonState === "executing" && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-[11px] font-mono text-[#2e4d4d] mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <RefreshCw size={12} className="animate-spin text-[#2e4d4d]" />
                            APPLYING FIX...
                          </span>
                          <span>{executionProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#cec7bc] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#2e4d4d] rounded-full transition-all duration-300"
                            style={{ width: `${executionProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* APPROVAL BUTTON */}
                    <button
                      onClick={approveAndExecute}
                      disabled={
                        stage === "EXECUTE" ||
                        stage === "VERIFY" ||
                        stage === "REMEMBER" ||
                        approving
                      }
                      className={`w-full py-3.5 rounded-full text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer border ${approvalButtonState === "approved" || approvalButtonState === "executed" || stage === "REMEMBER"
                        ? "bg-[#2e4d4d] text-[#fef9ed] border-[#2e4d4d]"
                        : "bg-[#2e4d4d] hover:bg-[#253f3f] text-[#fef9ed] border-[#2e4d4d]"
                        }`}
                    >
                      {approvalButtonState === "approved" ? (
                        <>
                          <Check size={15} className="text-[#fef9ed]" />
                          <span>APPROVED ✓</span>
                        </>
                      ) : approvalButtonState === "executing" ? (
                        <>
                          <RefreshCw size={14} className="animate-spin text-[#fef9ed]" />
                          <span>APPLYING FIX...</span>
                        </>
                      ) : approvalButtonState === "executed" || stage === "REMEMBER" ? (
                        <>
                          <Check size={15} className="text-[#fef9ed]" />
                          <span>✓ FIX APPLIED</span>
                        </>
                      ) : (
                        <>
                          <Check size={15} className="text-[#fbd3be]" />
                          <span>APPROVE &amp; TRY FIX →</span>
                        </>
                      )}
                    </button>

                    <div className="text-[10px] text-[#72675b] text-center mt-2 font-serif italic">
                      Simulated safe execution with automated verification
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── ROW 6: BEFORE → AFTER TELEMETRY VISUALIZATION ────────────────── */}
            {Boolean(incident?.verification?.verified) && (stage === "VERIFY" || stage === "REMEMBER") && (
              <div className="rounded-[25px] bg-[#f5f0e4] border border-[#2e4d4d] p-6 md:p-8 animate-fade-scale shadow-none">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#2e4d4d] text-[#fef9ed] flex items-center justify-center shrink-0">
                      <Check size={15} />
                    </div>
                    <div>
                      <h4 className="text-xl font-serif text-[#2e4d4d] font-normal">
                        ✓ FIX VERIFIED · System recovered.
                      </h4>
                      <p className="text-xs text-[#72675b] font-serif">
                        {incident?.verification?.explanation || "Operational telemetry recovered to normal healthy operating baseline."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto font-mono">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#fef9ed] text-[#72675b] text-[9px] tracking-wider border border-[#cec7bc]">
                      CONTROLLED SIMULATION
                    </span>
                    <span className="px-3 py-0.5 rounded-full bg-[#2e4d4d] text-[#fef9ed] text-[10px]">
                      ✓ FIX VERIFIED
                    </span>
                  </div>
                </div>

                {/* METRIC COMPARISON BARS */}
                <div className="grid md:grid-cols-3 gap-4">
                  {verificationMetrics.map((metric: any, idx: number) => {
                    const isBefore = !telemetryTransitioned;
                    const barWidth = isBefore ? `${metric.bar_before ?? 90}%` : `${metric.bar_after ?? 5}%`;
                    const currentStatus = isBefore ? metric.status_before : metric.status_after;

                    return (
                      <div key={metric.id || idx} className="bg-[#fef9ed] rounded-[16px] p-4 border border-[#cec7bc]">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-[10px] uppercase text-[#72675b] tracking-wider">
                            {metric.label}
                          </span>
                          <span className="text-[10px] text-[#2e4d4d]">
                            {isBefore ? `${metric.before} (${currentStatus})` : `${metric.after} (${currentStatus})`}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between mt-2 font-mono">
                          <span className="text-sm text-[#8c5462] line-through">{metric.before}</span>
                          <span className="text-xs text-[#72675b] font-serif italic">→ recovered</span>
                          <span className="text-2xl font-serif text-[#2e4d4d]">{metric.after}</span>
                        </div>

                        {/* Bar */}
                        <div className="w-full h-2 bg-[#cec7bc]/50 rounded-full mt-2.5 overflow-hidden">
                          <div
                            style={{ width: barWidth }}
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${telemetryTransitioned
                              ? "bg-[#2e4d4d]"
                              : "bg-[#8c5462]"
                              }`}
                          />
                        </div>
                        <div className="text-[9px] text-[#72675b] font-serif italic mt-1.5 truncate">
                          {metric.subtext || "Verified healthy"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── ROW 7: AGENT ACTIVITY / BACKEND TRACE ────────────────────────── */}
            <div className="bg-[#f5f0e4] rounded-[20px] border border-[#cec7bc] overflow-hidden transition-all duration-300">
              {/* CLICKABLE HEADER */}
              <button
                type="button"
                onClick={() => setExpandActivityTrace(!expandActivityTrace)}
                className="w-full p-4 md:px-6 md:py-3.5 flex items-center justify-between hover:bg-[#eae3d4]/50 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#2e4d4d]" />
                  <div>
                    <span className="text-[9px] uppercase font-mono tracking-[0.14em] text-[#72675b] block">
                      REAL-TIME TRACE
                    </span>
                    <h4 className="text-sm font-mono text-[#5d524b] flex items-center gap-2">
                      AGENT ACTIVITY
                      <span className="text-[11px] text-[#72675b] font-serif italic">
                        · {audit.length} lifecycle events
                      </span>
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#2e4d4d] bg-[#fef9ed] px-3.5 py-1 rounded-full border border-[#cec7bc] flex items-center gap-1.5 hover:bg-[#eae3d4] transition-colors">
                    {expandActivityTrace ? (
                      <>
                        <span>Hide trace</span>
                        <ChevronUp size={13} />
                      </>
                    ) : (
                      <>
                        <span>View trace →</span>
                        <ChevronDown size={13} />
                      </>
                    )}
                  </span>
                </div>
              </button>

              {/* EVENT TRACE */}
              {expandActivityTrace && (
                <div className="px-6 pb-5 pt-2 border-t border-[#cec7bc]/50 animate-fade-scale">
                  <div className="divide-y divide-[#cec7bc]/40 font-mono text-xs">
                    {audit.map((evt, idx) => (
                      <div key={idx} className="py-2.5 flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#2e4d4d] mt-1.5 shrink-0" />
                        <div className="text-[#72675b] text-[10px] shrink-0 w-16">
                          {new Date(evt.time).toLocaleTimeString()}
                        </div>
                        <div className="text-[#5d524b] w-48 shrink-0 font-medium">
                          {evt.event}
                        </div>
                        <div className="text-[#72675b] flex-1 text-[11px]">
                          {evt.detail}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── ROW 8: REMEMBER & THE MEMORY NETWORK (CLOSING THE LOOP) ─────── */}
            <div className={`rounded-[25px] border p-7 transition-all duration-300 ${stage === "REMEMBER"
              ? "bg-[#f5f0e4] border-[#2e4d4d]"
              : "bg-[#f5f0e4] border-[#cec7bc]"
              }`}>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-mono tracking-[0.14em] ${stage === "REMEMBER" ? "text-[#2e4d4d] font-bold" : "text-[#72675b]"
                        }`}>
                        {stage === "REMEMBER" ? "MEMORY UPDATED" : "THE ORGANIZATIONAL MEMORY NETWORK"}
                      </span>
                      {stage === "REMEMBER" && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#2e4d4d] text-[#fef9ed] text-[9px] font-mono animate-success-pop">
                          COMMITTED TO YOUR INCIDENT HISTORY ✓
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl md:text-2xl font-serif text-[#2e4d4d] mt-1 font-normal">
                      {stage === "REMEMBER"
                        ? "MemoryDesk learned from this incident."
                        : "Every resolved incident turns into future organizational capability."}
                    </h3>
                  </div>

                  {/* VISUAL LOOP CHIPS */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-[#5d524b] shrink-0">
                    <span className="px-2.5 py-1 rounded-full bg-[#fef9ed] border border-[#cec7bc]">PAST EXPERIENCE</span>
                    <span className="text-[#72675b]">──┐</span>
                    <span className="px-2.5 py-1 rounded-full bg-[#fef9ed] border border-[#cec7bc]">CURRENT INCIDENT</span>
                    <span className="text-[#72675b]">──┼──→</span>
                    <span className="px-3 py-1 rounded-full bg-[#2e4d4d] text-[#fef9ed] flex items-center gap-1.5 border border-[#2e4d4d]">
                      <span>SAVED TO MEMORY</span>
                      <RotateCcw size={11} />
                    </span>
                    <span className="text-[#2e4d4d] font-bold text-sm">↺</span>
                  </div>
                </div>

                {stage === "REMEMBER" ? (
                  <div className="grid md:grid-cols-4 gap-3.5 pt-4 border-t border-[#cec7bc]/50 text-xs">
                    {/* 1. WHAT HAPPENED */}
                    <div className="bg-[#fef9ed] rounded-[16px] p-4 border border-[#cec7bc] flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-mono text-[#72675b] tracking-wider">
                          WHAT HAPPENED
                        </div>
                        <p className="text-[#5d524b] font-serif mt-1.5 leading-relaxed text-[12px]">
                          {incident.summary || incident.title}
                        </p>
                      </div>
                      <div className="text-[9px] text-[#72675b] mt-2 font-mono">
                        Incident #{incident.id.replace("INC-", "")}
                      </div>
                    </div>

                    {/* 2. WHAT FAILED */}
                    <div className="bg-[#fef9ed] rounded-[16px] p-4 border border-[#8c5462]/30 flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-mono text-[#8c5462] tracking-wider flex items-center gap-1">
                          <X size={12} />
                          <span>WHAT FAILED</span>
                        </div>
                        <p className="text-[#8c5462] font-serif mt-1.5 leading-relaxed text-[12px]">
                          ✕ {incident.memory?.failed_action || incident.memory?.failed_actions?.[0] || "Restarting a worker"} did not resolve the backlog.
                        </p>
                      </div>
                      <div className="text-[9px] text-[#8c5462] mt-2 font-mono">
                        Avoided in future
                      </div>
                    </div>

                    {/* 3. WHAT WORKED */}
                    <div className="bg-[#fef9ed] rounded-[16px] p-4 border border-[#2e4d4d]/30 flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-mono text-[#2e4d4d] tracking-wider flex items-center gap-1">
                          <Check size={12} />
                          <span>WHAT WORKED</span>
                        </div>
                        <p className="text-[#2e4d4d] font-serif mt-1.5 leading-relaxed text-[12px]">
                          ✓ {incident.execution?.action || incident.recommendation?.action || "Scaling workers"} restored processing capacity.
                        </p>
                      </div>
                      <div className="text-[9px] text-[#2e4d4d] mt-2 font-mono">
                        Proven remediation
                      </div>
                    </div>

                    {/* 4. WHAT MEMORYDESK WILL REMEMBER */}
                    <div className="bg-[#fef9ed] rounded-[16px] p-4 border border-[#cec7bc] flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-mono text-[#2e4d4d] tracking-wider flex items-center gap-1">
                          <Brain size={12} />
                          <span>WHAT MEMORYDESK WILL REMEMBER</span>
                        </div>
                        <p className="text-[#5d524b] font-serif mt-1.5 leading-relaxed text-[12px]">
                          MemoryDesk will use this experience when a similar incident occurs in your account.
                        </p>
                      </div>
                      <div className="text-[9px] text-[#2e4d4d] mt-2 font-mono">
                        Future recall active
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#72675b] max-w-xl font-serif">
                    When approved and resolved, this incident outcome permanently commits to your account&apos;s private institutional memory.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── AGENT TRACE MODAL ────────────────────────────────────────────────── */}
        {showTraceModal && incident && (
          <div className="fixed inset-0 z-50 bg-[#2e4d4d]/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#f5f0e4] rounded-[25px] max-w-3xl w-full max-h-[85vh] flex flex-col border border-[#cec7bc] overflow-hidden animate-fade-scale text-[#5d524b]">
              <div className="p-6 border-b border-[#cec7bc] flex items-center justify-between bg-[#fef9ed]">
                <div className="flex items-center gap-2.5">
                  <Code2 size={18} className="text-[#2e4d4d]" />
                  <div>
                    <h3 className="text-base font-serif text-[#2e4d4d]">
                      Agent Trace &amp; Debug View
                    </h3>
                    <div className="text-[10px] font-mono text-[#72675b]">
                      Incident {incident.id} · Model {incident.llm_model}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowTraceModal(false)}
                  className="w-8 h-8 rounded-full bg-[#f5f0e4] hover:bg-[#eae3d4] flex items-center justify-center text-[#5d524b] border border-[#cec7bc] cursor-pointer transition"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs text-[#5d524b]">
                <div>
                  <div className="text-[10px] font-mono text-[#72675b] uppercase mb-1">
                    1. USER INPUT
                  </div>
                  <div className="bg-[#fef9ed] p-3 rounded-[16px] border border-[#cec7bc] text-[#5d524b] font-serif">
                    {incident.message}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono text-[#72675b] uppercase mb-1">
                    2. GROQ LLM STRUCTURED OUTPUT (Raw)
                  </div>
                  <pre className="bg-[#fef9ed] text-[#2e4d4d] p-3 rounded-[16px] overflow-x-auto text-[11px] leading-relaxed border border-[#cec7bc]">
                    {JSON.stringify(incident.llm_result, null, 2)}
                  </pre>
                </div>

                <div>
                  <div className="text-[10px] font-mono text-[#72675b] uppercase mb-1">
                    3. CANDIDATE RETRIEVAL PRE-FILTER
                  </div>
                  <div className="bg-[#fef9ed] p-3 rounded-[16px] border border-[#cec7bc] space-y-1">
                    {incident.matches?.map((m: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[11px]">
                        <span>{m.incident_id} · {m.title}</span>
                        <span className="text-[#2e4d4d] font-bold">{m.similarity}% candidate score</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono text-[#72675b] uppercase mb-1">
                    4. VERIFICATION PAYLOAD
                  </div>
                  <pre className="bg-[#fef9ed] p-3 rounded-[16px] border border-[#cec7bc] overflow-x-auto text-[11px] text-[#2e4d4d]">
                    {JSON.stringify(incident.verification, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORICAL MEMORY STORE MODAL ───────────────────────────────────── */}
        {showMemoryDrawer && (
          <div className="fixed inset-0 z-50 bg-[#2e4d4d]/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#f5f0e4] rounded-[25px] max-w-2xl w-full max-h-[80vh] flex flex-col border border-[#cec7bc] overflow-hidden animate-fade-scale text-[#5d524b]">
              <div className="p-6 border-b border-[#cec7bc] flex items-center justify-between bg-[#fef9ed]">
                <div>
                  <div className="text-[10px] uppercase font-mono tracking-[0.14em] text-[#72675b]">
                    ORGANIZATIONAL MEMORY STORE
                  </div>
                  <h3 className="text-lg font-serif text-[#2e4d4d] mt-0.5">
                    Historical Incident Precedents
                  </h3>
                </div>
                <button
                  onClick={() => setShowMemoryDrawer(false)}
                  className="w-8 h-8 rounded-full bg-[#f5f0e4] hover:bg-[#eae3d4] flex items-center justify-center text-[#5d524b] border border-[#cec7bc] cursor-pointer transition"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="overflow-y-auto p-6 space-y-6">
                {/* 1. YOUR INCIDENT HISTORY */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[#2e4d4d] font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2e4d4d]" />
                      YOUR INCIDENT HISTORY ({personalIncidents.length})
                    </span>
                    <span className="text-[10px] font-mono text-[#72675b]">
                      Private to your account
                    </span>
                  </div>

                  {personalIncidents.length === 0 ? (
                    <div className="p-4 rounded-[16px] border border-dashed border-[#cec7bc] bg-[#fef9ed] text-center py-6 text-xs text-[#72675b]">
                      <Brain size={20} className="mx-auto text-[#72675b] mb-2" />
                      <p className="font-serif text-[#5d524b]">Your incident history is empty.</p>
                      <p className="text-[11px] text-[#72675b] mt-1 font-serif italic">Resolved incidents will become part of your MemoryDesk experience.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {personalIncidents.map((m) => (
                        <div
                          key={m.id}
                          className="p-4 rounded-[16px] border border-[#2e4d4d]/30 bg-[#fef9ed]"
                        >
                          <div className="flex items-center justify-between font-mono">
                            <span className="text-xs text-[#2e4d4d] font-bold">
                              {m.id} · {m.title}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#2e4d4d] text-[#fef9ed]">
                              YOUR INCIDENT HISTORY
                            </span>
                          </div>
                          <div className="text-xs text-[#5d524b] mt-1.5 leading-relaxed font-serif">
                            {m.description}
                          </div>
                          <div className="mt-2.5 pt-2 border-t border-[#cec7bc]/50 grid grid-cols-2 gap-2 text-[10px] font-mono">
                            <div className="text-[#8c5462] flex items-center gap-1 truncate">
                              <X size={11} className="shrink-0" />
                              <span className="truncate">Failed: {m.failed_actions?.[0]}</span>
                            </div>
                            <div className="text-[#2e4d4d] flex items-center gap-1 truncate font-bold">
                              <Check size={11} className="shrink-0" />
                              <span className="truncate">Worked: {m.successful_actions?.[0]}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. ORGANIZATIONAL EXPERIENCE */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[#5d524b] font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#72675b]" />
                      ORGANIZATIONAL EXPERIENCE ({organizationalIncidents.length || 10})
                    </span>
                    <span className="text-[10px] font-mono text-[#72675b]">
                      Shared knowledge base
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {(organizationalIncidents.length > 0 ? organizationalIncidents : historicalIncidents).map((m) => (
                      <div
                        key={m.id}
                        className="p-4 rounded-[16px] border border-[#cec7bc] bg-[#fef9ed]"
                      >
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-xs text-[#5d524b] font-medium">
                            {m.id} · {m.title}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f5f0e4] text-[#72675b] border border-[#cec7bc]">
                            {m.service}
                          </span>
                        </div>
                        <div className="text-xs text-[#72675b] mt-1.5 leading-relaxed font-serif">
                          {m.description}
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-[#cec7bc]/50 grid grid-cols-2 gap-2 text-[10px] font-mono">
                          <div className="text-[#8c5462] flex items-center gap-1 truncate">
                            <X size={11} className="shrink-0" />
                            <span className="truncate">Failed: {m.failed_actions?.[0]}</span>
                          </div>
                          <div className="text-[#2e4d4d] flex items-center gap-1 truncate">
                            <Check size={11} className="shrink-0" />
                            <span className="truncate">Worked: {m.successful_actions?.[0]}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
        <footer className="border-t border-[#cec7bc] bg-[#fef9ed] mt-auto py-6 text-center text-[11px] font-serif text-[#72675b]">
          MemoryDesk · Autonomous AI teammate turning software incidents into permanent institutional memory
        </footer>
      </div>
    </main>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
