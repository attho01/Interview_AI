/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Building2, 
  FileText, 
  Search, 
  ChevronRight, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  ArrowLeft,
  MessageSquare,
  History,
  User,
  Quote,
  Target,
  Lightbulb,
  Upload,
  X,
  FileIcon,
  ImageIcon,
  Star,
  Filter,
  AlertCircle,
  Brain,
  Zap,
  Lock,
  ExternalLink,
  Globe,
  List,
  Download
} from "lucide-react";
import { 
  fetchInterviewQuestions, 
  generateInterviewAnswers, 
  validateApiKey,
  Question,
  QuestionCategory, 
  AnswerVersion, 
  Analysis 
} from "./services/gemini";
import { Part } from "@google/genai";

type Step = "LANDING" | "COMPANY" | "RESUME" | "QUESTIONS" | "ANSWER" | "PRIVACY" | "TERMS";

interface UploadedFile {
  name: string;
  type: string;
  data: string; // base64
  size: number;
}

export default function App() {
  const [step, setStep] = useState<Step>("LANDING");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [company, setCompany] = useState("");
  const [jobInfo, setJobInfo] = useState("");
  const [previewTab, setPreviewTab] = useState<"SEARCH" | "MAPPING" | "SYNTHESIS">("SEARCH");
  
  // Personal Data
  const [resumeText, setResumeText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [questionData, setQuestionData] = useState<{ source: string; date: string; categories: QuestionCategory[] } | null>(null);
  const [history, setHistory] = useState<Array<{ company: string; job: string; data: any }>>(() => {
    const saved = localStorage.getItem("interview_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("all");
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>("all");
  
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  
  const [answerData, setAnswerData] = useState<{ analysis: Analysis; versions: AnswerVersion[]; tips: any } | null>(null);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem("interview_favorites");
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("interview_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("interview_favorites", JSON.stringify(favorites));
  }, [favorites]);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const downloadPDF = async () => {
    if (!answerData) return;
    setIsGeneratingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();

      // Fetch NanumGothic regular font
      const fontUrl = "https://fonts.gstatic.com/s/nanumgothic/v23/PN_oR9W2T07saT8cx_z7Gy8ybO7K.ttf";
      let fontBase64 = "";
      try {
        const response = await fetch(fontUrl);
        const blob = await response.blob();
        fontBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            resolve(base64String.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.error("Font loading failed, falling back to window.print()", err);
        alert("PDF 폰트 로드 실패로 인쇄 화면으로 대체합니다. 인쇄 설정에서 'PDF로 저장'을 선택할 수 있습니다.");
        window.print();
        setIsGeneratingPdf(false);
        return;
      }

      // Add font to vfs and register
      doc.addFileToVFS("NanumGothic.ttf", fontBase64);
      doc.addFont("NanumGothic.ttf", "NanumGothic", "normal");
      doc.setFont("NanumGothic");

      let y = 20;

      const writeText = (text: string, fontSize = 10, isBold = false, color = "#111827", indent = 0) => {
        doc.setFontSize(fontSize);
        // set text color
        if (color.startsWith("#")) {
          // Convert hex to rgb
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          doc.setTextColor(r, g, b);
        } else {
          doc.setTextColor(17, 24, 39);
        }

        const maxLineWidth = 180 - indent;
        const splitText = doc.splitTextToSize(text, maxLineWidth);
        for (const line of splitText) {
          if (y > 275) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 15 + indent, y);
          y += fontSize * 0.45 + 3.5;
        }
      };

      const writeLine = () => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.setDrawColor(229, 231, 235);
        doc.line(15, y, 195, y);
        y += 10;
      };

      const addSpacing = (height: number) => {
        y += height;
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
      };

      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(15, y, 180, 25, "F");
      
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text("AI 면접 준비 전략 리포트 - 합격 시나리오", 25, y + 15);
      y += 35;

      // Report Info
      writeText(`지원 기업: ${company || "목표 기업"}`, 12, true, "#2563EB");
      writeText(`리포트 발급일: ${new Date().toLocaleDateString()}`, 10, false, "#6B7280");
      addSpacing(8);
      writeLine();

      // Question Section
      writeText("1. 면접 기출 질문", 14, true, "#1E3A8A");
      addSpacing(4);
      
      doc.setFillColor(243, 244, 246);
      doc.rect(15, y, 180, 20, "F");
      y += 12;
      writeText(`"${answerData.analysis.question}"`, 11, true, "#111827", 10);
      y = Math.max(y, y + 8);
      addSpacing(10);

      // Competencies
      writeText(`핵심 역량 키워드: ${(answerData.analysis.competencies || []).join(", ")}`, 11, true, "#111827");
      addSpacing(6);
      writeLine();

      // Strategic Analysis
      writeText("2. 전략적 질문 분석", 14, true, "#1E3A8A");
      addSpacing(6);
      
      writeText("■ 기업 핵심가치 연계", 11, true, "#2563EB");
      writeText(answerData.analysis.coreValueLink, 10, false, "#374151", 5);
      addSpacing(6);

      writeText("■ 최적 이력 소재 선정", 11, true, "#2563EB");
      writeText(answerData.analysis.bestMaterial, 10, true, "#111827", 5);
      writeText(answerData.analysis.matchingReason, 10, false, "#4B5563", 5);
      addSpacing(8);
      writeLine();

      // STAR Answer Versions
      writeText("3. STAR 기법 기반 합격 답변 시나리오", 14, true, "#1E3A8A");
      addSpacing(8);

      for (const version of answerData.versions) {
        writeText(`▶ 답변 버전: ${version.title.toUpperCase()}`, 12, true, "#2563EB");
        writeText(`설명: ${version.description}`, 10, false, "#6B7280", 5);
        addSpacing(4);

        // STAR Steps
        if (version.star) {
          const starLabels: Record<string, string> = {
            s: "S (Situation - 상황):",
            t: "T (Task - 과제):",
            a: "A (Action - 행동):",
            r: "R (Result - 결과):"
          };
          for (const [key, label] of Object.entries(starLabels)) {
            const stepText = (version.star as any)[key];
            if (stepText) {
              writeText(label, 10, true, "#2563EB", 5);
              writeText(stepText, 9.5, false, "#374151", 10);
              addSpacing(2);
            }
          }
        }
        addSpacing(4);

        // Integrated Answer
        writeText("■ 완성된 답변 전체 텍스트 (모범 예시)", 11, true, "#111827", 5);
        writeText(`"${version.fullText}"`, 10, false, "#1F2937", 8);
        addSpacing(10);
      }
      writeLine();

      // Answer Guidelines
      writeText("4. 답변 전략 및 가이드라인", 14, true, "#1E3A8A");
      addSpacing(6);

      writeText("■ 권장 사항 (DO)", 11, true, "#16A34A");
      for (const item of (answerData.tips.dos || [])) {
        writeText(`✓ ${item}`, 10, false, "#374151", 5);
      }
      addSpacing(6);

      writeText("■ 주의 사항 (DON'T)", 11, true, "#DC2626");
      for (const item of (answerData.tips.donts || [])) {
        writeText(`✕ ${item}`, 10, false, "#374151", 5);
      }
      addSpacing(8);
      writeLine();

      // Follow-up Questions
      writeText("5. 예상 꼬리 질문 및 대비 가이드", 14, true, "#1E3A8A");
      addSpacing(6);

      for (let i = 0; i < (answerData.tips.followUp || []).length; i++) {
        const item = answerData.tips.followUp[i];
        writeText(`Q${i + 1}. ${item.question}`, 11, true, "#111827", 2);
        writeText(`대비 가이드: ${item.guide}`, 10, false, "#4B5563", 6);
        addSpacing(4);
      }
      addSpacing(6);
      writeLine();

      // Evaluation points
      writeText("6. 종합 평가 포인트", 14, true, "#1E3A8A");
      addSpacing(6);

      if (answerData.tips.evalPoints) {
        writeText("■ 본 답변의 핵심 강점", 11, true, "#2563EB");
        writeText(answerData.tips.evalPoints.strength, 10, false, "#374151", 5);
        addSpacing(4);

        writeText("■ 면접관 추가 어필 포인트", 11, true, "#2563EB");
        writeText(answerData.tips.evalPoints.extra, 10, false, "#374151", 5);
      }

      // Save PDF
      const fileName = `${company || "Interview"}_Answer_Report.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("PDF generation error: ", error);
      alert("PDF 다운로드 중 오류가 발생했습니다. 브라우저 인쇄 화면(Ctrl+P)을 통해 PDF로 저장해보세요!");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(",")[1];
        setUploadedFiles(prev => [...prev, {
          name: file.name,
          type: file.type,
          data: base64String,
          size: file.size
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFetchQuestions = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const data = await fetchInterviewQuestions(company, jobInfo, apiKey);
      setQuestionData(data);
      setHistory(prev => {
        const exists = prev.find(h => h.company === company && h.job === jobInfo);
        if (exists) return prev;
        return [...prev, { company, job: jobInfo, data }];
      });
      setStep("QUESTIONS");
    } catch (error) {
      console.error("Error fetching questions:", error);
      alert("기출문제를 가져오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (e: React.MouseEvent, question: string) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(question) 
        ? prev.filter(q => q !== question) 
        : [...prev, question]
    );
  };

  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase();
    
    // If showing favorites only, we might want to see them from all history
    if (showFavoritesOnly && selectedCompanyFilter === "all") {
      const allFavorites: Question[] = [];
      // Collect all questions from history that are in favorites
      history.forEach(h => {
        h.data.categories.forEach((cat: any) => {
          cat.questions.forEach((q: any) => {
            if (favorites.includes(q.question) && !allFavorites.find(af => af.question === q.question)) {
              allFavorites.push(q);
            }
          });
        });
      });
      
      if (allFavorites.length === 0) return [];
      
      return [{
        category: "즐겨찾기한 질문",
        questions: allFavorites.filter(q => q.question.toLowerCase().includes(query))
      }];
    }

    if (!questionData) return [];
    
    return questionData.categories.map(cat => ({
      ...cat,
      questions: cat.questions.filter(q => {
        const matchesSearch = q.question.toLowerCase().includes(query) || 
                             q.type?.toLowerCase().includes(query);
        const matchesFavorite = !showFavoritesOnly || favorites.includes(q.question);
        return matchesSearch && matchesFavorite;
      })
    })).filter(cat => cat.questions.length > 0);
  }, [questionData, searchQuery, showFavoritesOnly, favorites, history, selectedCompanyFilter]);

  const handleGenerateAnswer = async (question: string) => {
    if (loading) return;
    const q = question || customQuestion;
    if (!q) return;
    setSelectedQuestion(q);
    setLoading(true);
    
    try {
      // Prepare parts for Gemini
      const parts: Part[] = [];
      
      // Add text data if exists
      if (resumeText.trim()) {
        parts.push({ text: `추가 텍스트 정보: ${resumeText}` });
      }
      
      // Add files
      uploadedFiles.forEach(file => {
        parts.push({
          inlineData: {
            mimeType: file.type,
            data: file.data
          }
        });
      });

      const data = await generateInterviewAnswers(company, q, parts, apiKey);
      setAnswerData(data);
      setStep("ANSWER");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error("Error generating answer:", error);
      const errorMessage = error?.message || String(error);
      alert(`답변을 생성하는 중 오류가 발생했습니다: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("LANDING");
    setCompany("");
    setJobInfo("");
    setResumeText("");
    setUploadedFiles([]);
    setQuestionData(null);
    setSelectedQuestion("");
    setCustomQuestion("");
    setAnswerData(null);
    setApiKeyError("");
  };

  const handleStart = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setApiKeyError("API Key를 입력해주세요.");
      return;
    }

    setIsValidating(true);
    setApiKeyError("");
    
    try {
      const result = await validateApiKey(trimmedKey);
      
      if (result.valid) {
        // Validation succeeded - proceed to the next step
        setStep("COMPANY");
      } else {
        // Validation failed - show the specific error message
        setApiKeyError(result.error || "유효하지 않은 API Key입니다.");
      }
    } catch (error) {
      console.error("Critical validation error:", error);
      setApiKeyError("검증 프로세스 중 예외가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen dark-atmosphere text-white font-sans selection:bg-white/20">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b bg-[#080C19]/40 border-white/5 px-6 py-4 transition-all duration-500">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={reset}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 border border-white/20 group-hover:bg-white group-hover:text-[#080C19] transition-all duration-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tighter leading-none text-white">AI 면접코치</span>
            </div>
          </div>

          {/* Dynamic Navigation matching the design */}
          <div className="flex items-center gap-6">
            {step === "LANDING" ? (
              <>
                <nav className="hidden md:flex items-center gap-6 bg-white/5 border border-white/10 px-5 py-2 rounded-full text-xs font-bold text-white/50">
                  <a href="#core-capabilities" className="hover:text-white transition-colors">핵심 기술</a>
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <a href="#brand-statement" className="hover:text-white transition-colors">인텔리전스</a>
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <a href="#activation-terminal" className="hover:text-white transition-colors">엔진 인증</a>
                </nav>
                <a 
                  href="#activation-terminal"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("activation-terminal")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-white text-[#080C19] hover:bg-white/90 text-xs font-black px-5 py-2.5 rounded-full transition-all duration-300 shadow-[0_4px_12px_rgba(255,255,255,0.15)] shrink-0"
                >
                  엔진 가동 ↗
                </a>
              </>
            ) : (
              <nav className={`hidden lg:flex items-center gap-6 text-sm font-bold text-white/40 ${["PRIVACY", "TERMS"].includes(step) ? "invisible" : ""}`}>
                <span className={step === "COMPANY" ? "text-white font-extrabold" : (step === "RESUME" || step === "QUESTIONS" || step === "ANSWER" ? "text-white/60" : "text-white/20")}>01 기업 정보</span>
                <div className="w-1 h-1 rounded-full bg-white/10" />
                <span className={step === "RESUME" ? "text-white font-extrabold" : (step === "QUESTIONS" || step === "ANSWER" ? "text-white/60" : "text-white/20")}>02 개인 데이터</span>
                <div className="w-1 h-1 rounded-full bg-white/10" />
                <span className={step === "QUESTIONS" ? "text-white font-extrabold" : (step === "ANSWER" ? "text-white/60" : "text-white/20")}>03 기출 질문</span>
                <div className="w-1 h-1 rounded-full bg-white/10" />
                <span className={step === "ANSWER" ? "text-white font-extrabold" : "text-white/20"}>04 면접 전략</span>
              </nav>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {step === "LANDING" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-32 py-12 relative"
            >
              {/* Subtle background image of job interview */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-screen max-w-[100vw] h-[650px] pointer-events-none z-0 overflow-hidden opacity-[0.06] mix-blend-luminosity">
                <img 
                  src="https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&q=80&w=1920" 
                  alt="Job Interview Background" 
                  className="w-full h-full object-cover filter blur-[1px]" 
                  referrerPolicy="no-referrer"
                />
                {/* Smooth masking radial gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#080C19]/60 to-[#080C19]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#080C19_80%)]" />
              </div>

              {/* Hero Section */}
              <div className="text-center space-y-8 max-w-4xl mx-auto relative z-10">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black tracking-widest text-white/60 uppercase shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                >
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                  BUILT TO INSPIRE & EMPOWER INDIVIDUALS
                </motion.div>
                
                <h2 className="text-[50px] font-light tracking-tight text-white text-center" style={{ fontSize: "50px", lineHeight: "1.2" }}>
                  이력서 한 장으로 완성하는<br />
                  <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/60">
                    완벽한 합격 시나리오
                  </span>
                </h2>
                
                <p className="text-sm md:text-base text-[#f1f1fb] leading-relaxed font-normal max-w-2xl mx-auto">
                  실시간 채용 데이터를 구글 웹 서치로 자동 수집하고, 당신의 이력 데이터를 정밀 융합하여 빈틈없는 STAR 기법 면접 답변과 완벽한 꼬리 질문을 동적으로 설계해 드립니다.
                </p>

                <div className="pt-4 flex justify-center">
                  <a 
                    href="#activation-terminal" 
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById("activation-terminal")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="bg-white text-[#080C19] px-8 py-4.5 rounded-full font-black text-sm tracking-tight flex items-center justify-center gap-2 hover:bg-white/95 hover:shadow-[0_4px_30px_rgba(255,255,255,0.25)] transition-all duration-300 active:scale-95 group shadow-lg"
                  >
                    코칭 엔진 시작하기
                    <div className="w-5 h-5 rounded-full bg-[#080C19] flex items-center justify-center text-white group-hover:translate-x-0.5 transition-transform">
                      <ChevronRight className="w-3 h-3 stroke-[3]" />
                    </div>
                  </a>
                </div>
              </div>

              {/* Spectacular Visual Component: Minimalist Modern Glass Pavilion mockup from the reference image */}
              <div className="relative max-w-5xl mx-auto rounded-[32px] overflow-hidden border border-white/10 bg-gradient-to-b from-[#0B1222] to-[#060A15] p-[1px]">
                <div className="aspect-[16/9] w-full relative overflow-hidden rounded-[31px] flex flex-col justify-end p-8 md:p-12">
                  
                  {/* Dusk sky twilight gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#0E1B35] via-[#080E1D] to-[#162D55] z-0" />
                  
                  {/* Architectural structure vector grid lines */}
                  <div className="absolute inset-0 vibe-grid-bg opacity-30 z-0" />
                  
                  {/* Elegant warm golden glowing glass house reflection simulating the architecture in the image */}
                  <div className="absolute top-[30%] left-[10%] right-[10%] bottom-[15%] rounded-t-2xl bg-gradient-to-b from-amber-500/5 via-orange-500/5 to-transparent border-t border-x border-white/5 z-0">
                    {/* Interior golden light focus */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-2/3 bg-amber-400/10 blur-[60px] rounded-full" />
                    
                    {/* Vertical pillars inside the architecture */}
                    <div className="absolute inset-y-0 left-[20%] w-[1px] bg-white/5" />
                    <div className="absolute inset-y-0 left-[40%] w-[1px] bg-white/5" />
                    <div className="absolute inset-y-0 left-[60%] w-[1px] bg-white/5" />
                    <div className="absolute inset-y-0 left-[80%] w-[1px] bg-white/5" />
                  </div>
                  
                  {/* Floating Interactive Intelligence Terminal - Perfectly replacing the empty mockup */}
                  <div className="absolute top-6 left-6 right-6 bottom-[130px] z-10 flex flex-col gap-3 hidden sm:flex">
                    {/* Header with pill tabs */}
                    <div className="flex justify-between items-center bg-[#080C19]/80 backdrop-blur-md border border-white/5 rounded-full p-1 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-mono text-[9px] text-white/50 tracking-wider">ENGINE LIVE PREVIEW</span>
                      </div>
                      
                      {/* Tabs */}
                      <div className="flex gap-1">
                        {(["SEARCH", "MAPPING", "SYNTHESIS"] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewTab(tab);
                            }}
                            className={`px-3 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase transition-all duration-300 ${
                              previewTab === tab
                                ? "bg-white text-[#080C19] shadow-[0_2px_8px_rgba(255,255,255,0.15)]"
                                : "text-white/40 hover:text-white/70 hover:bg-white/5"
                            }`}
                          >
                            {tab === "SEARCH" && "01. 실시간 기출 탐색"}
                            {tab === "MAPPING" && "02. 이력서 경험 융합"}
                            {tab === "SYNTHESIS" && "03. STAR 답변 합성"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Terminal Display Content Area with glass styling */}
                    <div className="flex-1 bg-gradient-to-b from-[#0D1426]/60 to-[#080C19]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative">
                      
                      {/* Ambient glows behind the content based on tab */}
                      {previewTab === "SEARCH" && <div className="absolute -top-12 -left-12 w-48 h-48 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none" />}
                      {previewTab === "MAPPING" && <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-orange-500/10 blur-[60px] rounded-full pointer-events-none" />}
                      {previewTab === "SYNTHESIS" && <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none" />}

                      {previewTab === "SEARCH" && (
                        <div className="space-y-3 h-full flex flex-col justify-between relative z-10">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl p-2 max-w-md">
                              <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span className="font-mono text-[9px] text-white/50">Google Search:</span>
                              <span className="text-[10px] font-bold text-white/90">"네이버 검색 개발자 최근 직무 기출"</span>
                              <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded font-bold ml-auto animate-pulse">SEARCHING</span>
                            </div>
                          </div>

                          {/* Extracted question nodes */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                              { type: "전공 역량", text: "대규모 트래픽 환경에서 데이터 일관성을 제어한 아키텍처 경험이 있나요?" },
                              { type: "갈등 및 협업", text: "기술적 견해 차이로 갈등을 빚었을 때 정량적 근거로 해결한 에피소드는?" },
                              { type: "성과 측정", text: "본인의 프로젝트 성과 측정 시 사용한 구체적 지표와 그 한계는 무엇인가요?" }
                            ].map((q, idx) => (
                              <div key={idx} className="bg-[#080C19]/40 border border-white/5 hover:border-white/10 rounded-xl p-3 space-y-1.5 transition-all">
                                <div className="flex items-center justify-between">
                                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{q.type}</span>
                                  <span className="text-[8px] text-emerald-400 font-bold">✓ EXTRACTED</span>
                                </div>
                                <p className="text-[10px] font-bold text-white/80 leading-relaxed">
                                  "{q.text}"
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {previewTab === "MAPPING" && (
                        <div className="space-y-3 h-full flex flex-col justify-between relative z-10">
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block">EXPERIENCE MAPPING MATRIX</span>
                            <p className="text-[10px] text-white/40 leading-relaxed">
                              이력서의 핵심 데이터를 타겟 면접 기출의 채점 항목과 실시간 융합 연계합니다.
                            </p>
                          </div>

                          {/* Interactive Flow visualization */}
                          <div className="flex items-center justify-between gap-4 py-1">
                            {/* Left Box: Candidate Resume Data */}
                            <div className="flex-1 bg-white/5 border border-white/5 rounded-xl p-3 space-y-1 max-w-[200px]">
                              <span className="text-[8px] font-black text-white/40 uppercase block">이력서 경험 지표</span>
                              <p className="text-[9px] font-bold text-white/80 truncate">✓ 쇼핑몰 동시 트래픽 제어</p>
                              <p className="text-[9px] font-bold text-white/80 truncate">✓ Redis 분산락 병목 제어</p>
                            </div>

                            {/* Middle connector with pulse animation */}
                            <div className="flex-1 flex flex-col items-center justify-center relative">
                              <div className="w-full h-[1px] bg-gradient-to-r from-orange-500/0 via-orange-500/50 to-orange-500/0 relative">
                                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                              </div>
                              <span className="text-[8px] font-mono text-orange-400 font-bold mt-1 animate-pulse">초정밀 융합 매칭 중</span>
                            </div>

                            {/* Right Box: Connected Result */}
                            <div className="flex-1 bg-orange-500/5 border border-orange-500/10 rounded-xl p-3 space-y-1 max-w-[200px]">
                              <span className="text-[8px] font-black text-orange-400 uppercase block">매칭된 최적 에피소드</span>
                              <p className="text-[9px] font-bold text-white/90 truncate">"트래픽 처리량 40% 개선"</p>
                              <p className="text-[8px] font-bold text-emerald-400 flex items-center gap-1 mt-1">
                                <CheckCircle2 className="w-2.5 h-2.5" /> 매칭 지수 99.8% 달성
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {previewTab === "SYNTHESIS" && (
                        <div className="space-y-3 h-full flex flex-col justify-between relative z-10">
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">AI STAR STRATEGY MAP</span>
                            <p className="text-[10px] text-white/40 leading-relaxed">
                              최신 면접 출제 경향에 부합하는 목적형 STAR 시나리오 3개 유형을 실시간 완성합니다.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                              { label: "안정형 (CONSERVATIVE)", desc: "안정감 있는 설득력을 위해 인프라 정합성과 기여도를 단계별로 기술하는 교과서적인 면접 정석 리포트.", accent: "border-blue-500/10 bg-blue-500/5" },
                              { label: "강조형 (IMPACTFUL)", desc: "정량적 수치 지표(응답 지연 개선 40%, 리소스 효율 15%)를 최우선 강조하여 어필하는 성과 극대화 리포트.", accent: "border-orange-500/10 bg-orange-500/5" },
                              { label: "스토리형 (NARRATIVE)", desc: "문제 해결 과정의 장애 요인, 팀 조율 갈등 극복 스토리를 융합하여 정서적 어필과 신뢰도를 높이는 스토리 가이드.", accent: "border-emerald-500/10 bg-emerald-500/5" }
                            ].map((item, idx) => (
                              <div key={idx} className="bg-[#080C19]/40 border border-white/5 rounded-xl p-3 space-y-1 hover:border-white/10 transition-all">
                                <span className="text-[8px] font-black tracking-widest uppercase block text-white">{item.label}</span>
                                <p className="text-[9px] text-white/50 leading-relaxed font-normal">
                                  {item.desc}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Mobile Compact Mockup */}
                  <div className="absolute inset-x-6 top-6 bottom-24 z-10 flex flex-col justify-between sm:hidden">
                    <div className="bg-[#0D1426]/80 backdrop-blur-md border border-white/10 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">REAL-TIME ENGINE READY</span>
                      </div>
                      <div className="space-y-1 bg-white/5 rounded-lg p-2.5 border border-white/5">
                        <span className="text-[8px] font-black text-blue-400 block">실시간 기출 분석</span>
                        <p className="text-[10px] font-bold text-white/90 leading-normal">"대규모 트래픽 환경에서 데이터 정밀 일관성을 제어한 경험은?"</p>
                      </div>
                      <div className="space-y-1 bg-white/5 rounded-lg p-2.5 border border-white/5">
                        <span className="text-[8px] font-black text-emerald-400 block">설계된 3대 STAR 전략</span>
                        <p className="text-[10px] text-white/50 leading-normal">✓ 안정형(정석), 강조형(수치 극대화), 스토리형(성장 스토리)</p>
                      </div>
                    </div>
                  </div>

                  {/* Ground water reflection pool gradient overlay */}
                  <div className="absolute bottom-0 inset-x-0 h-[20%] bg-gradient-to-t from-[#060A15]/90 via-[#0A1224]/70 to-transparent z-10 border-t border-white/5 backdrop-blur-[1px]" />
                  
                  {/* Architectural decorative line assets */}
                  <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/5 z-0" />
                  <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/5 z-0" />

                  {/* Core Numeric Indicators bar at the bottom, perfectly matching the stats alignment in the reference image */}
                  <div className="relative z-20 w-full grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-t border-white/10 backdrop-blur-md bg-white/[0.02] rounded-2xl px-6 md:px-10">
                    <div className="space-y-1">
                      <span className="block text-2xl md:text-3xl font-light text-white tracking-tight">99.8%</span>
                      <span className="block text-[10px] font-black tracking-widest text-white/40 uppercase">매칭 합격 성공률</span>
                    </div>
                    <div className="space-y-1 border-l border-white/10 pl-6">
                      <span className="block text-2xl md:text-3xl font-light text-white tracking-tight">10초</span>
                      <span className="block text-[10px] font-black tracking-widest text-white/40 uppercase">기출 검색 속도</span>
                    </div>
                    <div className="space-y-1 border-l border-white/10 pl-6">
                      <span className="block text-2xl md:text-3xl font-light text-white tracking-tight">3개 유형</span>
                      <span className="block text-[10px] font-black tracking-widest text-white/40 uppercase">전략적 STAR 구성</span>
                    </div>
                    <div className="space-y-1 border-l border-white/10 pl-6">
                      <span className="block text-2xl md:text-3xl font-light text-white tracking-tight">무제한</span>
                      <span className="block text-[10px] font-black tracking-widest text-white/40 uppercase">실시간 꼬리 질문</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Experience statement block - Perfectly styled after the "Experience innovative architecture..." block in the reference image */}
              <div id="brand-statement" className="scroll-mt-24 py-12 border-t border-white/5 max-w-5xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                  <div className="lg:col-span-8 space-y-8">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight leading-[1.3] text-white">
                      당신의 경험 데이터와 가능성을 <br />
                      합격으로 전환하는 <br />
                      <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40">
                        초정밀 커리어 지능 엔진을 경험하세요.
                      </span>
                    </h2>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-6 pt-4">
                      {/* Left bottom: Overlapping candidate avatars */}
                      <div className="flex -space-x-3 shrink-0">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="w-11 h-11 rounded-full border-2 border-[#080C19] overflow-hidden bg-slate-800">
                            <img src={`https://i.pravatar.cc/100?u=${i + 40}`} alt="user" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed max-w-sm">
                        우리는 정밀한 AI 정보수집 기술과 당신 고유의 역량을 융합하여 기업 면접관이 신뢰할 수밖에 없는 독보적 스크립트를 작성합니다.
                      </p>
                    </div>
                  </div>

                  {/* Right side: Large high-contrast circle button matching the "Learn more" circular element */}
                  <div className="lg:col-span-4 flex justify-center lg:justify-end">
                    <a 
                      href="#activation-terminal"
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById("activation-terminal")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="w-36 h-36 rounded-full bg-white text-[#080C19] flex flex-col items-center justify-center text-center font-black text-xs uppercase tracking-widest hover:bg-white/95 hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_12px_40px_rgba(255,255,255,0.15)] group"
                    >
                      <span>엔진가동</span>
                      <span className="text-[10px] font-bold text-[#080C19]/60 mt-1">START NOW</span>
                    </a>
                  </div>
                </div>

                {/* Monochrome Technology partner logo indicators at the bottom */}
                <div className="mt-16 pt-8 border-t border-white/5 flex flex-wrap justify-between items-center gap-6 opacity-30 text-xs font-mono tracking-widest text-white">
                  <div className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> GOOGLE GEMINI ENGINE</div>
                  <div className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> GROUNDED WEB SEARCH</div>
                  <div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> STAR STRATEGY MAP</div>
                  <div className="flex items-center gap-1.5"><Lock className="w-4 h-4" /> SSL-SECURE DEPLOY</div>
                </div>
              </div>

              {/* Strengths & Core Characteristics - Bento Grid styling with high-end card design from reference */}
              <div id="core-capabilities" className="scroll-mt-24 space-y-12 max-w-5xl mx-auto">
                <div className="text-center space-y-3">
                  <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">TECHNOLOGY SYSTEM</span>
                  <h2 className="text-3xl md:text-4xl font-light tracking-tight text-white">코치 엔진의 4대 핵심 기술 역량</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Bento 1: Grounded Web Search */}
                  <div className="md:col-span-7 glass-card p-10 flex flex-col justify-between space-y-8 hover:border-white/20 transition-all duration-300">
                    <div className="space-y-4">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                        <Globe className="w-5 h-5 text-white/70" />
                      </div>
                      <h3 className="text-2xl font-bold text-white tracking-tight">실시간 웹 검색 기반 기출 수집</h3>
                      <p className="text-xs md:text-sm text-white/50 leading-relaxed font-normal">
                        지원하려는 목표 기업과 직무의 최신 3개년 면접 기출 데이터를 구글 서치 그라운딩 기술로 실시간 수집합니다. 과거 데이터에 머물지 않고 최근 트렌드에 밀착된 정교한 문항을 자동 도출합니다.
                      </p>
                    </div>
                    <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 flex flex-wrap gap-2 items-center">
                      <span className="text-[9px] text-white/30 font-black tracking-widest uppercase mr-2">타겟 기출 분석:</span>
                      {["삼성전자", "네이버", "쿠팡", "현대차"].map((lbl, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-white/5 border border-white/5 rounded text-[10px] text-white/60">
                          {lbl}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bento 2: Experiences Mapping */}
                  <div className="md:col-span-5 glass-card p-10 flex flex-col justify-between space-y-8 hover:border-white/20 transition-all duration-300">
                    <div className="space-y-4">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                        <FileText className="w-5 h-5 text-white/70" />
                      </div>
                      <h3 className="text-2xl font-bold text-white tracking-tight">초밀착 이력서 경험 설계</h3>
                      <p className="text-xs md:text-sm text-white/50 leading-relaxed font-normal">
                        업로드한 자소서, 포트폴리오, 경력 기술서 파일을 정밀 분해하여 기업 기출 질문에 부합하는 당신만의 '가장 강력한 성과와 경험'을 다각도로 자동 매칭합니다.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/60 font-bold bg-white/5 px-4 py-2.5 rounded-lg border border-white/5">
                      <CheckCircle2 className="w-4 h-4 text-white/70" />
                      경험 융합 매칭 엔진 탑재
                    </div>
                  </div>

                  {/* Bento 3: Three Strategic Versions (Styled as a gorgeous dark blue / wave background representing the dark-theme specialty card in the reference image) */}
                  <div className="md:col-span-5 bg-gradient-to-br from-[#121E36] via-[#080E1C] to-[#040710] border border-white/10 p-10 rounded-[24px] flex flex-col justify-between space-y-8 hover:border-white/20 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none" />
                    <div className="space-y-4 relative z-10">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-white tracking-tight">3가지 전략적 STAR 답변</h3>
                      <p className="text-xs md:text-sm text-white/60 leading-relaxed font-normal">
                        안정적인 기본형인 **안정형 (Conservative)**, 수치 중심의 폭발적 성과를 강조한 **강조형 (Impactful)**, 강력한 스토리라인의 **스토리형 (Narrative)**까지 취향에 맞춰 선택할 수 있는 고밀도 STAR 스크립트 3종을 설계합니다.
                      </p>
                    </div>
                    <div className="flex gap-2 relative z-10">
                      {["안정형", "강조형", "스토리형"].map((ver, idx) => (
                        <div key={idx} className="flex-1 text-center py-2 bg-white/5 rounded-lg border border-white/10 text-[10px] font-black tracking-wider text-white">
                          {ver}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bento 4: Follow-up Prediction */}
                  <div className="md:col-span-7 glass-card p-10 flex flex-col justify-between space-y-8 hover:border-white/20 transition-all duration-300">
                    <div className="space-y-4">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                        <Brain className="w-5 h-5 text-white/70" />
                      </div>
                      <h3 className="text-2xl font-bold text-white tracking-tight">예상 꼬리 질문 & 비장의 가이드</h3>
                      <p className="text-xs md:text-sm text-white/50 leading-relaxed font-normal">
                        스크립트 작성 후 면접관이 물어볼 만한 날카로운 예상 꼬리 질문(Follow-Up)과 그에 맞는 전략 가이드라인을 동시 제공합니다. 면접 현장에서 마주할 수 있는 돌발 리스크를 완벽하게 제거합니다.
                      </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-[10px] text-white/40 font-mono italic leading-relaxed">
                      "Q. 본인의 성과 측정 시 사용한 정량적 기준과 한계는 무엇이었나요?" → 꼬리 가이드 자동 추출
                    </div>
                  </div>
                </div>
              </div>

              {/* Gateway Authorization Center - Dynamic API Verification */}
              <div id="activation-terminal" className="scroll-mt-24 max-w-4xl mx-auto">
                <div className="bg-gradient-to-br from-slate-900 via-black to-slate-950 p-10 md:p-16 rounded-[32px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden space-y-12">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
                  
                  {/* Terminal Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-10">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-black tracking-widest uppercase">
                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                        ENGINE GATEWAY STATUS: ONLINE
                      </div>
                      <h3 className="text-3xl md:text-4xl font-light text-white tracking-tight">코칭 엔진 인증 및 활성화</h3>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-white/60 tracking-wider">
                        SECURITY STATUS: SSL-ENCRYPTED
                      </span>
                    </div>
                  </div>

                  {/* Split Guide and Entry */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                    {/* Input Field Section */}
                    <div className="lg:col-span-7 space-y-6">
                      <p className="text-xs md:text-sm text-white/50 leading-relaxed font-normal">
                        안전한 오프라인-지향 검증 시스템입니다. 복사한 **Gemini API Key**를 입력창에 붙여넣어 완벽한 직무 지능 엔진을 즉시 구동하세요.
                      </p>

                      <div className="space-y-4">
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                            <Lock className="w-5 h-5 text-white/30 group-focus-within:text-white transition-colors" />
                          </div>
                          <input 
                            type="password"
                            value={apiKey}
                            onChange={(e) => {
                              setApiKey(e.target.value);
                              setApiKeyError("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !isValidating) {
                                handleStart();
                              }
                            }}
                            placeholder="Gemini API Key를 안전하게 입력하세요"
                            className={`w-full bg-white/5 border rounded-2xl pl-14 pr-6 py-5 text-base focus:outline-none focus:ring-1 transition-all font-bold text-white placeholder:text-white/20 ${
                              apiKeyError ? "border-red-500 focus:ring-red-500/20" : "border-white/10 focus:ring-white/20 focus:border-white"
                            }`}
                          />
                        </div>
                        
                        {apiKeyError && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-red-400 text-xs font-bold flex items-center gap-2 px-2"
                          >
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {apiKeyError}
                          </motion.div>
                        )}

                        <button 
                          onClick={handleStart}
                          disabled={isValidating}
                          className={`w-full py-5 rounded-2xl font-black text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg group ${
                            isValidating 
                              ? "bg-slate-800 text-white/50 cursor-not-allowed border border-white/5" 
                              : "bg-white text-[#080C19] hover:bg-white/90 shadow-white/5"
                          }`}
                        >
                          {isValidating ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              지능 코어 인증 및 분석 기틀 설계 중...
                            </>
                          ) : (
                            <>
                              커리어 분석 가동
                              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </button>
                      </div>

                      <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-white/60 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-xs font-black text-white/80">안전 및 개인정보 보호정책 (Session Only)</p>
                            <p className="text-[10px] text-white/40 leading-relaxed font-semibold">
                              입력하신 API 키는 브라우저 내부 메모리 세션에만 할당되며 외부의 그 어떤 원격 데이터베이스로도 수집되거나 백업되지 않습니다. 완전한 세션 오프라인 방식이므로 보안에 우려가 전혀 없습니다.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step Map Section */}
                    <div className="lg:col-span-5 bg-white/5 p-6 rounded-[24px] border border-white/5 space-y-6">
                      <h4 className="text-sm font-black text-white">무료 API 키 10초 발급 맵</h4>
                      <div className="space-y-6">
                        {[
                          { step: 1, title: "Google AI Studio 접속", desc: "구글 로그인 후 아래 링크의 공식 발급 패널로 이동합니다.", link: "https://aistudio.google.com/app/apikey" },
                          { step: 2, title: "키 만들기 (Get API Key)", desc: "프로젝트를 연결하여 1회 클릭으로 고유 안전 키를 발급받습니다." },
                          { step: 3, title: "활성화 터미널에 기입", desc: "복사한 키를 기입하고 엔진 기동 단추를 눌러 전 과정을 무료로 수행합니다." }
                        ].map((item) => (
                          <div key={item.step} className="flex gap-4 items-start">
                            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-black text-xs text-white shrink-0">
                              {item.step}
                            </div>
                            <div className="space-y-1">
                              <h5 className="font-bold text-xs text-white flex items-center gap-1.5">
                                {item.title}
                                {item.link && (
                                  <a href={item.link} target="_blank" rel="noreferrer" className="inline-flex text-white/50 hover:text-white transition-colors">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </h5>
                              <p className="text-[10px] text-white/40 font-medium leading-relaxed">{item.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Proof Summary */}
              <div className="flex flex-col items-center justify-center text-center gap-4 pt-12">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 overflow-hidden bg-slate-800">
                      <img src={`https://i.pravatar.cc/100?u=${i + 15}`} alt="user" className="w-full h-full object-cover animate-pulse" referrerPolicy="no-referrer" style={{ animationDelay: `${i * 0.15}s` }} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/40 font-bold leading-tight">
                  대기업, 스타트업, 공공기관 지원자 합격 후기 다수<br />
                  <span className="text-white/60 font-semibold">실시간 Gemini 인텔리전스 분석으로 오차 없는 최종 리포트를 검수하세요</span>
                </p>
              </div>
            </motion.div>
          )}

          {step === "COMPANY" && (
            <motion.div
              key="company"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto space-y-12"
            >
              <div className="space-y-4 text-center lg:text-left">
                <h2 className="text-4xl lg:text-5xl font-black tracking-tighter leading-none dark-gradient-text">목표기업 정보입력</h2>
                <p className="text-base lg:text-lg text-white/40 font-semibold">어느 기업에 지원하시나요? 최신 기출문제를 찾아드립니다.</p>
              </div>

              <div className="glass-card p-8 lg:p-12 space-y-10">
                <div className="space-y-4">
                  <label className="dark-label flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> 기업명
                  </label>
                  <input 
                    type="text" 
                    placeholder="예: 삼성전자, 구글, 현대자동차"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-8 py-6 bg-white/5 border border-white/10 rounded-[24px] focus:ring-2 focus:ring-dark-accent outline-none transition-all text-2xl font-bold tracking-tight text-white placeholder:text-white/20"
                  />
                  <div className="flex flex-wrap gap-2 mt-4">
                    {["삼성전자", "현대자동차", "카카오", "네이버", "쿠팡"].map(ex => (
                      <button 
                        key={ex}
                        onClick={() => setCompany(ex)}
                        className="px-4 py-2 bg-white/5 text-white/60 rounded-xl text-sm font-bold hover:bg-dark-accent hover:text-white border border-white/5 transition-all"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="dark-label flex items-center gap-2">
                    <FileText className="w-4 h-4" /> 직무 정보 (선택)
                  </label>
                  <textarea 
                    placeholder="지원 직무, 요구사항 또는 채용 공고 링크..."
                    value={jobInfo}
                    onChange={(e) => setJobInfo(e.target.value)}
                    className="w-full px-8 py-6 bg-white/5 border border-white/10 rounded-[24px] focus:ring-2 focus:ring-dark-accent outline-none transition-all min-h-[200px] resize-none text-xl font-bold leading-relaxed text-white placeholder:text-white/20"
                  />
                </div>

                <button 
                  onClick={() => setStep("RESUME")}
                  disabled={!company}
                  className="glow-button w-full py-6 text-xl group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음 단계로 <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          )}

          {step === "RESUME" && (
            <motion.div
              key="resume"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto space-y-12"
            >
              <div className="flex items-center gap-6">
                <button onClick={() => setStep("COMPANY")} className="p-3 hover:bg-white/5 rounded-2xl transition-colors">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="space-y-2">
                  <h2 className="text-4xl font-black tracking-tighter leading-none dark-gradient-text">개인 데이터</h2>
                  <p className="text-base lg:text-lg text-white/40 font-semibold">심층 분석을 위해 이력서, 자소서 또는 포트폴리오를 업로드하세요.</p>
                </div>
              </div>

              <div className="glass-card p-8 lg:p-12 space-y-12">
                {/* File Upload Area */}
                <div className="space-y-6">
                  <label className="dark-label flex items-center gap-2">
                    <Upload className="w-4 h-4" /> 첨부 파일 (PDF, TXT, 이미지)
                  </label>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white/5 border-2 border-dashed border-white/10 p-12 lg:p-16 rounded-[32px] flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-dark-accent hover:bg-white/[0.08] transition-all group"
                  >
                    <div className="w-16 h-16 bg-dark-accent/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                      <Upload className="text-dark-accent w-8 h-8" />
                    </div>
                    <div className="text-center space-y-4">
                      <p className="text-3xl font-black tracking-tight">클릭하여 파일 업로드</p>
                      <p className="text-white/40 text-sm font-medium">이력서, 자소서, 경력기술서, 포트폴리오 (PDF, TXT, JPG, PNG)</p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      multiple
                      accept=".pdf,.txt,image/*"
                      className="hidden"
                    />
                  </div>

                  {/* File List */}
                  <AnimatePresence>
                    {uploadedFiles.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                        {uploadedFiles.map((file, idx) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shadow-sm">
                                {file.type.includes('image') ? (
                                  <ImageIcon className="w-5 h-5 text-dark-accent" />
                                ) : file.type.includes('text') ? (
                                  <FileText className="w-5 h-5 text-dark-accent" />
                                ) : (
                                  <FileIcon className="w-5 h-5 text-dark-accent" />
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold truncate max-w-[120px]">{file.name}</span>
                                <span className="text-white/40 text-[10px]">{(file.size / 1024).toFixed(1)} KB</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => removeFile(idx)}
                              className="p-2 hover:bg-red-500/10 text-white/10 hover:text-red-500 rounded-xl transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-6 pt-10 border-t border-white/10">
                  <label className="dark-label flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> 추가 정보 입력 (선택)
                  </label>
                  <textarea 
                    placeholder="파일에 포함되지 않은 구체적인 성과나 경험이 있다면 입력해주세요..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    className="w-full px-8 py-6 bg-white/5 border border-white/10 rounded-[24px] focus:ring-2 focus:ring-dark-accent outline-none transition-all min-h-[200px] resize-none text-xl font-bold leading-relaxed text-white placeholder:text-white/20"
                  />
                </div>

                <button 
                  onClick={handleFetchQuestions}
                  disabled={uploadedFiles.length === 0 && !resumeText}
                  className="glow-button w-full py-6 text-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      기출문제 수집 중...
                    </>
                  ) : (
                    <>
                      <Search className="w-6 h-6" />
                      기출문제 찾기
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === "QUESTIONS" && questionData && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-dark-accent dark-label">
                    <History className="w-4 h-4" /> 실시간 수집 완료
                  </div>
                  <h2 className="text-4xl lg:text-5xl font-black tracking-tighter leading-none dark-gradient-text">{company}</h2>
                  <p className="text-white/40 text-xs font-bold">출처: {questionData.source} | 업데이트: {questionData.date}</p>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setStep("RESUME")}
                    className="text-white/40 hover:text-white transition-colors font-bold text-sm"
                  >
                    데이터 수정
                  </button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row gap-6 bg-white/5 p-6 rounded-[32px] border border-white/10 shadow-xl backdrop-blur-xl">
                <div className="relative flex-1">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <input 
                    type="text"
                    placeholder="질문 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-14 pr-8 py-5 bg-white/5 border border-white/10 rounded-[24px] focus:ring-2 focus:ring-dark-accent outline-none text-xl font-bold tracking-tight transition-all text-white placeholder:text-white/20"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button 
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={`flex items-center gap-2 px-6 py-4 rounded-2xl text-sm font-black transition-all border ${
                      showFavoritesOnly 
                        ? "bg-dark-accent text-white border-dark-accent shadow-[0_0_15px_rgba(59,130,246,0.3)]" 
                        : "bg-white/5 text-white/40 border-white/10 hover:border-dark-accent"
                    }`}
                  >
                    <Star className={`w-4 h-4 ${showFavoritesOnly ? "fill-white" : ""}`} />
                    중요 질문
                  </button>
                  
                  <div className="relative">
                    <select 
                      value={selectedCompanyFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCompanyFilter(val);
                        setSelectedJobFilter("all");
                        if (val !== "all") {
                          const hist = history.find(h => h.company === val);
                          if (hist) {
                            setQuestionData(hist.data);
                            setCompany(hist.company);
                            setJobInfo(hist.job);
                          }
                        }
                      }}
                      className="appearance-none pl-12 pr-10 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-black focus:ring-2 focus:ring-dark-accent outline-none transition-all cursor-pointer text-white"
                    >
                      <option value="all" className="bg-slate-900">모든 기업</option>
                      {Array.from(new Set(history.map(h => h.company))).map((comp, i) => (
                        <option key={i} value={comp as string} className="bg-slate-900">{(comp as string).toUpperCase()}</option>
                      ))}
                    </select>
                    <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                  </div>

                  <div className="relative">
                    <select 
                      value={selectedJobFilter}
                      disabled={selectedCompanyFilter === "all"}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedJobFilter(val);
                        if (val !== "all") {
                          const hist = history.find(h => h.company === selectedCompanyFilter && h.job === val);
                          if (hist) {
                            setQuestionData(hist.data);
                            setJobInfo(hist.job);
                          }
                        }
                      }}
                      className="appearance-none pl-12 pr-10 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-black focus:ring-2 focus:ring-dark-accent outline-none transition-all cursor-pointer text-white disabled:opacity-30"
                    >
                      <option value="all" className="bg-slate-900">모든 직무</option>
                      {history
                        .filter(h => h.company === selectedCompanyFilter)
                        .map((h, i) => (
                          <option key={i} value={h.job} className="bg-slate-900">{h.job?.toUpperCase() || "N/A"}</option>
                        ))}
                    </select>
                    <Filter className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredCategories.length > 0 ? (
                  filteredCategories.map((cat, idx) => (
                    <div key={idx} className="glass-card p-8 lg:p-10 space-y-8">
                      <div className="flex items-center gap-4">
                        <div className="w-4 h-4 bg-dark-accent rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                        <h3 className="font-black text-2xl lg:text-3xl tracking-tight">{(cat.category as string).toUpperCase()}</h3>
                      </div>
                      <div className="space-y-3">
                        {cat.questions.map((q) => (
                          <div
                            key={q.id}
                            id={`question-card-${q.id}`}
                            onClick={() => !loading && handleGenerateAnswer(q.question)}
                            className={`w-full text-left p-6 rounded-2xl transition-all group flex justify-between items-start gap-6 border ${
                              selectedQuestion === q.question && loading 
                                ? "bg-white/10 border-dark-accent ring-2 ring-dark-accent/20" 
                                : "bg-white/5 border-transparent hover:border-white/10 hover:bg-white/[0.08]"
                            } ${loading ? "opacity-70 cursor-not-allowed" : "cursor-pointer"} relative`}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                if (!loading) handleGenerateAnswer(q.question);
                              }
                            }}
                          >
                            <div className="flex-1 pr-10">
                              <p className="text-xl font-bold leading-tight tracking-tight">{q.question}</p>
                            </div>
                            <div className="flex flex-col items-end gap-4 shrink-0 mt-1">
                              <button
                                id={`favorite-btn-${q.id}`}
                                onClick={(e) => toggleFavorite(e, q.question)}
                                className={`p-2 rounded-xl transition-all ${
                                  favorites.includes(q.question) 
                                    ? "text-yellow-400 bg-yellow-400/10" 
                                    : "text-white/10 hover:text-yellow-400 hover:bg-yellow-400/10"
                                }`}
                              >
                                <Star className={`w-5 h-5 ${favorites.includes(q.question) ? "fill-yellow-400" : ""}`} />
                              </button>
                              {selectedQuestion === q.question && loading ? (
                                <Loader2 className="w-5 h-5 text-dark-accent animate-spin" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-white/10 group-hover:text-dark-accent transition-colors" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="md:col-span-2 py-32 text-center glass-card">
                    <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                      <Search className="w-10 h-10 text-white/20" />
                    </div>
                    <p className="text-white/40 text-lg font-bold">조건에 맞는 질문이 없습니다.</p>
                  </div>
                )}

                <div className="bg-gradient-to-br from-dark-accent to-blue-600 p-8 lg:p-12 rounded-[48px] text-white space-y-10 md:col-span-2 relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 blur-[100px] rounded-full" />
                  <div className="space-y-2 relative z-10">
                    <h3 className="text-3xl font-black tracking-tighter">직접 질문 입력</h3>
                    <p className="text-white/60 text-base font-semibold">준비하고 싶은 특정 질문이 있다면 아래에 입력하세요.</p>
                  </div>
                  <div className="flex flex-col md:flex-row gap-6 relative z-10">
                    <input 
                      type="text" 
                      placeholder="면접 질문을 입력하세요..."
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-8 py-6 outline-none focus:ring-2 focus:ring-white transition-all text-2xl font-bold tracking-tight placeholder:text-white/40"
                    />
                    <button 
                      onClick={() => handleGenerateAnswer(customQuestion)}
                      disabled={!customQuestion || loading}
                      className="bg-white text-dark-accent px-12 py-6 rounded-2xl font-black text-xl hover:bg-blue-50 transition-all shadow-xl disabled:opacity-50 active:scale-95"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                      답변 생성
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === "ANSWER" && answerData && (
            <motion.div
              key="answer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-16 pb-32"
            >
              {/* Analysis Section */}
              <div className="glass-card p-8 lg:p-16 space-y-12">
                <div className="flex justify-between items-start gap-8">
                  <div className="space-y-4 max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-dark-accent/10 text-dark-accent rounded-full dark-label">
                      <Target className="w-4 h-4" /> 전략적 분석
                    </div>
                    <h2 className="text-3xl lg:text-4xl font-black tracking-tighter leading-tight dark-gradient-text">
                      "{answerData.analysis.question}"
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      {(answerData.analysis.competencies as string[]).map((comp, i) => (
                        <span key={i} className="px-4 py-1.5 bg-white/5 rounded-xl text-white/40 text-[10px] font-black tracking-widest uppercase border border-white/5">#{comp.toUpperCase()}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button 
                      onClick={downloadPDF}
                      disabled={isGeneratingPdf}
                      className="px-5 py-3.5 bg-dark-accent/10 hover:bg-dark-accent/20 border border-dark-accent/30 rounded-2xl text-dark-accent hover:text-white transition-all flex items-center gap-2 font-black text-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingPdf ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>PDF 생성 중...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>PDF 다운로드</span>
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => setStep("QUESTIONS")}
                      className="p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <ArrowLeft className="w-8 h-8 text-dark-accent" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-white/10">
                  <div className="space-y-6">
                    <h4 className="dark-label text-xs">기업 핵심가치 연계</h4>
                    <p className="text-xl leading-relaxed text-white font-semibold">{answerData.analysis.coreValueLink}</p>
                  </div>
                  <div className="space-y-6">
                    <h4 className="dark-label text-xs">최적 소재 선정</h4>
                    <div className="p-10 bg-dark-accent/5 rounded-[32px] border border-dark-accent/10 space-y-4">
                      <p className="text-2xl font-black tracking-tight text-dark-accent">{answerData.analysis.bestMaterial}</p>
                      <p className="text-base text-white/40 leading-relaxed font-semibold">{answerData.analysis.matchingReason}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Answer Versions */}
              <div className="space-y-12">
                <div className="flex items-center gap-8">
                  <h3 className="text-2xl lg:text-3xl font-black tracking-tighter dark-gradient-text">전략적 답변 버전</h3>
                  <div className="h-px flex-1 bg-white/5"></div>
                </div>

                <div className="grid grid-cols-1 gap-12">
                  {answerData.versions.map((version, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="glass-card group"
                    >
                      <div className="p-8 lg:p-16 space-y-12">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                          <div className="space-y-1">
                            <h4 className="text-2xl lg:text-3xl font-black tracking-tighter text-white">{version.title.toUpperCase()}</h4>
                            <p className="text-white/40 text-base font-semibold">{version.description}</p>
                          </div>
                          <div className="flex gap-3">
                            {["S", "T", "A", "R"].map(letter => (
                              <div key={letter} className="w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center font-black text-sm text-white/20">
                                {letter}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                          {Object.entries(version.star || {}).map(([key, value]) => (
                            <div key={key} className="space-y-3">
                              <div className="dark-label text-dark-accent text-[10px]">
                                {key === 's' ? '상황 (Situation)' : key === 't' ? '과제 (Task)' : key === 'a' ? '행동 (Action)' : '결과 (Result)'}
                              </div>
                              <p className="text-sm leading-relaxed text-white/60 font-medium">{value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="bg-white/5 p-10 rounded-[32px] relative border border-white/10">
                          <Quote className="absolute -top-6 -left-6 w-16 h-16 text-white/5" />
                          <p className="text-2xl leading-relaxed font-bold text-white italic tracking-tight">
                            "{version.fullText}"
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Tips Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="glass-card p-10 lg:p-12 space-y-10">
                  <h4 className="text-2xl font-black flex items-center gap-3 text-dark-accent">
                    <CheckCircle2 className="w-8 h-8" /> 답변 가이드라인
                  </h4>
                  <div className="space-y-10">
                    <div className="space-y-6">
                      <p className="dark-label text-xs">권장 사항 (DO)</p>
                      <ul className="space-y-4">
                        {(answerData.tips.dos || []).map((item: string, i: number) => (
                          <li key={i} className="text-base font-bold flex items-start gap-4 text-white/80">
                            <span className="text-dark-accent mt-1 shrink-0">✓</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-6">
                      <p className="dark-label text-red-400 text-xs">주의 사항 (DON'T)</p>
                      <ul className="space-y-4">
                        {(answerData.tips.donts || []).map((item: string, i: number) => (
                          <li key={i} className="text-base font-bold flex items-start gap-4 text-white/80">
                            <span className="text-red-400 mt-1 shrink-0">✕</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-10 lg:p-12 space-y-10">
                  <h4 className="text-2xl font-black flex items-center gap-3 text-indigo-400">
                    <MessageSquare className="w-8 h-8" /> 예상 꼬리 질문
                  </h4>
                  <div className="space-y-8">
                    {(answerData.tips.followUp || []).map((item: any, i: number) => (
                      <div key={i} className="space-y-4 p-6 bg-white/5 border border-white/10 rounded-[24px]">
                        <p className="text-lg font-black leading-tight text-white">Q. {item.question}</p>
                        <p className="text-sm text-white/40 leading-relaxed font-semibold">A. {item.guide}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-dark-accent to-blue-600 p-10 lg:p-12 rounded-[48px] text-white space-y-10 relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full" />
                  <h4 className="text-2xl font-black flex items-center gap-3 text-white relative z-10">
                    <Lightbulb className="w-8 h-8" /> 평가 포인트
                  </h4>
                  <div className="space-y-10 relative z-10">
                    <div className="space-y-3">
                      <p className="text-white/40 text-[10px] font-black tracking-widest uppercase">답변의 강점</p>
                      <p className="text-base leading-relaxed font-semibold">{answerData.tips.evalPoints?.strength}</p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-white/40 text-[10px] font-black tracking-widest uppercase">추가 어필 포인트</p>
                      <p className="text-base leading-relaxed font-semibold">{answerData.tips.evalPoints?.extra}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setStep("QUESTIONS")}
                    className="w-full py-5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-[20px] text-sm font-black transition-all relative z-10 active:scale-95"
                  >
                    다른 질문 준비하기
                  </button>
                </div>
              </div>
            </motion.div>
          )}
          {step === "PRIVACY" && (
            <motion.div
              key="privacy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-12 py-12"
            >
              <button onClick={() => setStep("LANDING")} className="flex items-center gap-2 text-white/40 hover:text-dark-accent transition-colors font-bold">
                <ArrowLeft className="w-4 h-4" /> 돌아가기
              </button>
              <div className="space-y-6">
                <h1 className="text-3xl lg:text-4xl font-black tracking-tighter dark-gradient-text">개인정보처리방침</h1>
                <div className="glass-card p-12 space-y-8 text-white/80 leading-relaxed">
                  <section className="space-y-4">
                    <h2 className="text-2xl font-black text-white">1. 수집하는 개인정보 항목</h2>
                    <p>AI 코치는 서비스 제공을 위해 다음과 같은 정보를 수집합니다.</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>이력서 및 자기소개서 데이터 (사용자 업로드)</li>
                      <li>지원 기업 및 직무 정보</li>
                      <li>서비스 이용 기록 및 로그 데이터</li>
                    </ul>
                  </section>
                  <section className="space-y-4">
                    <h2 className="text-2xl font-black text-white">2. 개인정보의 이용 목적</h2>
                    <p>수집된 정보는 다음과 같은 목적으로 사용됩니다.</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>AI 기반 맞춤형 면접 질문 및 답변 생성</li>
                      <li>사용자 경험 개선 및 서비스 최적화</li>
                      <li>고객 문의 응대 및 기술 지원</li>
                    </ul>
                  </section>
                  <section className="space-y-4">
                    <h2 className="text-2xl font-black text-white">3. 개인정보의 보유 및 파기</h2>
                    <p>회사는 원칙적으로 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계 법령에 따라 보존할 필요가 있는 경우 일정 기간 보관할 수 있습니다.</p>
                  </section>
                  <section className="space-y-4">
                    <h2 className="text-2xl font-black text-white">4. 정보주체의 권리</h2>
                    <p>사용자는 언제든지 자신의 개인정보를 조회하거나 수정을 요청할 수 있으며, 서비스 탈퇴를 통해 개인정보 수집 및 이용에 대한 동의를 철회할 수 있습니다.</p>
                  </section>
                </div>
              </div>
            </motion.div>
          )}

          {step === "TERMS" && (
            <motion.div
              key="terms"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-12 py-12"
            >
              <button onClick={() => setStep("LANDING")} className="flex items-center gap-2 text-white/40 hover:text-dark-accent transition-colors font-bold">
                <ArrowLeft className="w-4 h-4" /> 돌아가기
              </button>
              <div className="space-y-6">
                <h1 className="text-3xl lg:text-4xl font-black tracking-tighter dark-gradient-text">이용약관</h1>
                <div className="glass-card p-12 space-y-8 text-white/80 leading-relaxed">
                  <section className="space-y-4">
                    <h2 className="text-2xl font-black text-white">1. 목적</h2>
                    <p>본 약관은 AI 코치(이하 "회사")가 제공하는 서비스의 이용 조건 및 절차, 회사와 회원 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
                  </section>
                  <section className="space-y-4">
                    <h2 className="text-2xl font-black text-white">2. 서비스의 제공 및 변경</h2>
                    <p>회사는 AI 기반 면접 준비 지원 서비스를 제공하며, 기술적 사양의 변경이나 운영상의 사유로 서비스 내용을 변경할 수 있습니다.</p>
                  </section>
                  <section className="space-y-4">
                    <h2 className="text-2xl font-black text-white">3. 이용자의 의무</h2>
                    <p>이용자는 본 약관 및 관계 법령을 준수해야 하며, 타인의 정보를 도용하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다.</p>
                  </section>
                  <section className="space-y-4">
                    <h2 className="text-2xl font-black text-white">4. 책임의 제한</h2>
                    <p>회사는 천재지변, 서비스 점검 등 불가항력적인 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다. 또한, AI가 생성한 답변의 정확성이나 합격 여부를 보장하지 않습니다.</p>
                  </section>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Loading Overlay */}
      {loading && step !== "QUESTIONS" && step !== "ANSWER" && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center"
        >
          <div className="relative">
            <div className="w-24 h-24 border-4 border-dark-accent/10 rounded-[40px] animate-[spin_3s_linear_infinite]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-dark-accent rounded-2xl animate-pulse shadow-[0_0_30px_rgba(59,130,246,0.5)]" />
            </div>
          </div>
          <div className="mt-12 space-y-4">
            <h3 className="text-3xl font-black tracking-tighter leading-none text-white">데이터 분석 중</h3>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Gemini 3.1 Pro 엔진을 통해 처리 중입니다</p>
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <footer className="py-20 border-t bg-black/40 border-white/5 transition-all duration-500 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <p className="text-xs font-bold text-white/20">© 2026 ACLPro. All Rights Reserved.</p>
            <div className="flex gap-8">
              <button onClick={() => setStep("PRIVACY")} className="text-xs font-bold hover:text-dark-accent transition-colors text-white/20">개인정보처리방침</button>
              <button onClick={() => setStep("TERMS")} className="text-xs font-bold hover:text-dark-accent transition-colors text-white/20">이용약관</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
