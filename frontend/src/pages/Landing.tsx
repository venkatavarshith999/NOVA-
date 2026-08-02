import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Share2, ShieldCheck, Sparkles, FileSearch, BarChart3, ArrowRight,
  Network, MessagesSquare, ChevronDown, FileText, Zap,
  GitCompareArrows, FileBarChart, Shield, CheckCircle2,
} from "lucide-react";
import Logo from "../components/Logo";
import ConstellationBackground from "../components/ConstellationBackground";

const FEATURES = [
  { icon: Network, title: "Graph RAG", desc: "Every answer is retrieved through both semantic search and knowledge-graph traversal, then merged before generation." },
  { icon: Share2, title: "Knowledge Graph", desc: "Entities and relationships extracted from your documents become an interactive, explorable graph." },
  { icon: ShieldCheck, title: "Zero Hallucination", desc: "Nova AI declines to answer when evidence is insufficient — every claim traces back to a source." },
  { icon: FileSearch, title: "Citation Engine", desc: "Answers carry inline citations with filename, page number, and the exact supporting excerpt." },
  { icon: BarChart3, title: "Analytics", desc: "Track entity distributions, processing throughput, and answer confidence across your document library." },
  { icon: Sparkles, title: "Multi-Modal Ingestion", desc: "PDFs, Word docs, spreadsheets, images, and audio logs all feed the same unified graph." },
];

const PIPELINE = [
  { label: "Upload", desc: "Drop compliance PDFs, contracts, audio logs, or spreadsheets" },
  { label: "Extract", desc: "OCR, parsing, and speech-to-text normalize every format to text" },
  { label: "Chunk & Embed", desc: "Content is split and embedded into a searchable vector space" },
  { label: "Build Graph", desc: "Entities and relationships are extracted into a live knowledge graph" },
  { label: "Ask", desc: "Hybrid Graph RAG answers questions with citations and a confidence score" },
];

const FAQS = [
  { q: "How does Nova AI avoid hallucinations?", a: "Every answer is grounded in retrieved evidence from both the vector index and the knowledge graph. If retrieval confidence falls below a minimum threshold, Nova AI explicitly says it doesn't have enough evidence rather than guessing." },
  { q: "What file formats are supported?", a: "PDF, DOCX, TXT, CSV, XLSX, images (with OCR), and audio logs (with speech-to-text) all feed into the same document pipeline." },
  { q: "Can I see how an answer was derived?", a: "Yes — every answer includes inline citations with filename, page number, the supporting excerpt, and the related knowledge graph entities used as evidence." },
  { q: "Is my data isolated per organization?", a: "Documents, entities, and conversations are scoped to your account with JWT-authenticated, role-based access." },
];

const ADVANCED = [
  { icon: GitCompareArrows, title: "Document Comparison", desc: "Compare two policies side by side — shared entities, unique findings, and relationship differences." },
  { icon: Shield, title: "Risk Detection", desc: "Automatically scan your knowledge graph for compliance gaps, unlinked policies, and missing controls." },
  { icon: Zap, title: "Impact Analysis", desc: "Select any entity and instantly see all directly and indirectly affected policies and departments." },
  { icon: FileBarChart, title: "Report Generation", desc: "Generate downloadable compliance reports with risk summaries, entity breakdowns, and graph statistics." },
];

const DEMO_CONVERSATION = [
  { role: "user", text: "Can customer data be stored outside India?" },
  { role: "ai", text: "According to the Data Localization Policy [Source 1], customer personal data classified as 'sensitive' must be stored within Indian data centers. Cross-border transfer requires explicit DPO approval and adherence to GDPR adequacy requirements [Source 2].", confidence: 91 },
  { role: "user", text: "Which department approves this?" },
  { role: "ai", text: "The Data Protection Office (DPO) is the approving authority for cross-border data transfers, as stated in the Data Governance Framework [Source 1]. The Legal Compliance team provides secondary review for jurisdictions without adequacy agreements [Source 3].", confidence: 87 },
];

function AnimatedStat({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 2000;
    const startTime = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + (end - start) * eased));
      if (progress >= 1) clearInterval(timer);
    }, 30);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <div className="text-center">
      <p className="text-3xl sm:text-4xl font-display font-semibold text-gradient">
        {count.toLocaleString()}{suffix}
      </p>
      <p className="text-sm text-slate-400 mt-1">{label}</p>
    </div>
  );
}

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [demoStep, setDemoStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setDemoStep((s) => (s < DEMO_CONVERSATION.length - 1 ? s + 1 : s));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-void-900/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-display font-semibold text-lg tracking-tight">Nova AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pipeline" className="hover:text-white transition-colors">How it works</a>
            <a href="#demo" className="hover:text-white transition-colors">Demo</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-300 hover:text-white transition-colors hidden sm:block">Log in</Link>
            <Link to="/signup" className="btn-primary text-sm px-4 py-2">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-40 pb-32 px-6">
        <div className="absolute inset-0 h-[640px] top-0">
          <ConstellationBackground density={54} />
        </div>
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-violet-300 mb-6"
          >
            <Sparkles size={12} /> Multi-Modal Graph RAG for Enterprise Compliance
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-display font-semibold tracking-tight leading-[1.05]"
          >
            Transform compliance
            <br />
            <span className="text-gradient">documents into knowledge</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto"
          >
            Nova AI reads your PDFs, audio logs, tables, and schematics, builds a live entity-relationship
            graph, and answers compliance questions with citation-backed, zero-hallucination responses.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/signup" className="btn-primary px-7 py-3.5 text-base">
              Get Started <ArrowRight size={17} />
            </Link>
            <a href="#demo" className="btn-secondary px-7 py-3.5 text-base">
              <Sparkles size={17} /> See Demo
            </a>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
          <AnimatedStat value={7} label="File Formats Supported" suffix="+" />
          <AnimatedStat value={13} label="Entity Types Extracted" />
          <AnimatedStat value={10} label="Relationship Types" />
          <AnimatedStat value={100} label="Citation Accuracy" suffix="%" />
        </div>
      </section>

      {/* Feature cards */}
      <section id="features" className="relative py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold">Built for zero-hallucination compliance</h2>
            <p className="mt-4 text-slate-400">Every layer of Nova AI is designed around one constraint: never answer without evidence.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="card glass-hover group"
              >
                <div className="w-10 h-10 rounded-lg bg-nova-gradient-soft border border-violet-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon size={19} className="text-violet-300" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Advanced features */}
      <section className="relative py-24 px-6 border-t border-white/[0.06] bg-void-950/40">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold">Advanced compliance intelligence</h2>
            <p className="mt-4 text-slate-400">Beyond Q&A — Nova AI provides deep analysis tools for compliance teams.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {ADVANCED.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="card glass-hover flex gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-nova-gradient-soft border border-violet-500/20 flex items-center justify-center shrink-0">
                  <f.icon size={22} className="text-violet-300" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg mb-1">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="relative py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold">From raw document to cited answer</h2>
            <p className="mt-4 text-slate-400">A single pipeline carries every file format through extraction, graph construction, and retrieval.</p>
          </div>
          <div className="grid md:grid-cols-5 gap-4">
            {PIPELINE.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative"
              >
                <div className="card h-full">
                  <span className="font-mono text-xs text-violet-400">{String(i + 1).padStart(2, "0")}</span>
                  <h4 className="font-display font-semibold mt-2 mb-1.5">{step.label}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
                {i < PIPELINE.length - 1 && (
                  <ArrowRight size={16} className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2 text-void-600 z-10" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo */}
      <section id="demo" className="relative py-24 px-6 border-t border-white/[0.06] bg-void-950/40">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold">See Nova AI in action</h2>
            <p className="mt-4 text-slate-400">Watch how Nova AI answers compliance questions with cited evidence.</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-5 text-sm text-slate-400">
              <MessagesSquare size={16} /> Ask Nova — Live Demo
            </div>
            <div className="space-y-4 min-h-[280px]">
              {DEMO_CONVERSATION.slice(0, demoStep + 1).map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="bg-nova-gradient rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-md">
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-lg space-y-2">
                        <p className="text-slate-200">{msg.text}</p>
                        <div className="flex items-center gap-2 pt-1">
                          <div className="w-16 h-1.5 rounded-full bg-void-700 overflow-hidden">
                            <div className="h-full bg-mint-400" style={{ width: `${msg.confidence}%` }} />
                          </div>
                          <span className="text-xs font-mono text-mint-400">{msg.confidence}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
              {demoStep < DEMO_CONVERSATION.length - 1 && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  Nova AI is thinking…
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Trust indicators */}
      <section className="relative py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: ShieldCheck, title: "Evidence-First", desc: "Every claim backed by source documents" },
              { icon: CheckCircle2, title: "Zero Hallucination", desc: "Declines when evidence is insufficient" },
              { icon: FileText, title: "Full Traceability", desc: "Citations with file, page, and excerpt" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-mint-400/10 border border-mint-400/20 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon size={16} className="text-mint-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative py-24 px-6 border-t border-white/[0.06] bg-void-950/40">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-10 text-center">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQS.map((item, i) => (
              <div key={item.q} className="card cursor-pointer" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{item.q}</h4>
                  <ChevronDown size={18} className={`text-slate-500 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </div>
                {openFaq === i && <p className="mt-3 text-sm text-slate-400 leading-relaxed">{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-4">Ready to transform your compliance?</h2>
          <p className="text-slate-400 mb-8">Start building your compliance knowledge graph in minutes. No credit card required.</p>
          <Link to="/signup" className="btn-primary px-8 py-4 text-base">
            Get Started Free <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span className="font-display font-semibold">Nova AI</span>
          </div>
          <p className="text-xs text-slate-500">© 2026 Nova AI. Built for the Gen AI Hackathon — Domain 3.</p>
          <a href="https://github.com" className="text-slate-500 hover:text-white transition-colors text-sm font-medium">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
