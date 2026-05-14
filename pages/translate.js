import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import Recorder from "../components/Recorder";
import LanguageSelector from "../components/LanguageSelector";
import ConversationSegments from "../components/ConversationSegments";
import ConversationSummary from "../components/ConversationSummary";
import { Trash2, Copy, Check } from "lucide-react";
import API, { saveTranslation, BASE_URL } from "../services/api";

import { showAlert, showToast, showConfirm } from "../utils/alerts";

// ==================== HELPER AUTH ====================
function getAuthHeader() {
  const token = localStorage.getItem("token");
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`
  };
}
// ====================================================

export default function TranslatePage() {
  const router = useRouter();

  // Require login để dùng trang dịch
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login?next=/translate");
    }
  }, [router]);

  const [segments, setSegments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [wsError, setWsError] = useState(null);
  const [sessionCredits, setSessionCredits] = useState(0); // Theo dõi credits tiêu thụ trong phiên
  const [copied, setCopied] = useState(false);
  const [langFrom, setLangFrom] = useState("Vietnamese");
  const [langTo, setLangTo] = useState("English");

  const handleSave = async (content) => {
    try {
      await saveTranslation({
        content: content,
        type: "text",
        source_lang: langFrom,
        target_lang: langTo,
      });
      showToast("Đã lưu vào lịch sử");
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  // ==================== REF ĐỂ TRÁNH RACE CONDITION ====================
  const isRecordingRef = useRef(false);
  // ================================================================

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const lastVoiceAtRef = useRef(Date.now());
  const lastSplitAtRef = useRef(0);
  const currentSpeakerLangRef = useRef(null);
  const hasReceivedDataRef = useRef(false);

  const langMap = useMemo(
    () => ({
      English: "en",
      Vietnamese: "vi",
      Japanese: "ja",
      Korean: "ko",
      Chinese: "zh",
    }),
    []
  );

  const sourceLang = langMap[langFrom] || "vi";
  const targetLang = langMap[langTo] || "en";

  const handleToggleRecord = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const newId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const ensureSegment = (opts = {}) => {
    setSegments((prev) => {
      const last = prev[0];
      if (!last || last.closed) {
        return [
          {
            id: newId(),
            createdAt: new Date().toISOString(),
            original: "",
            translated: "",
            interimOriginal: "",
            interimTranslated: "",
            speakerLang: opts.speakerLang ?? null,
            sourceLang,
            targetLang,
            closed: false,
          },
          ...prev,
        ];
      }
      return prev;
    });
  };

  const closeCurrentAndStartNew = (reason, opts = {}) => {
    const now = Date.now();
    if (now - lastSplitAtRef.current < 500) return;
    lastSplitAtRef.current = now;

    setSegments((prev) => {
      if (!prev.length) return prev;
      const [head, ...rest] = prev;
      const hasContent = (head.original || "").trim() || (head.translated || "").trim();
      if (!hasContent) {
        return prev;
      }
      return [
        {
          id: newId(),
          createdAt: new Date().toISOString(),
          original: "",
          translated: "",
          interimOriginal: "",
          interimTranslated: "",
          speakerLang: opts.speakerLang ?? head.speakerLang ?? null,
          sourceLang,
          targetLang,
          closed: false,
        },
        { ...head, interimOriginal: "", interimTranslated: "", closed: true, closedReason: reason },
        ...rest,
      ];
    });
  };

  const startRecording = async () => {
    setSessionCredits(0); // Reset số credits tiêu thụ
    // Kiểm tra số dư credits trước khi bắt đầu
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (!user.token_balance || user.token_balance <= 0) {
        showAlert(
          "Hết Credits",
          "Bạn đã sử dụng hết Credits, nạp thêm để tiếp tục.",
          "warning"
        ).then(() => {
          router.push("/billing");
        });
        return;
      }
    }

    try {
      setWsError(null);
      hasReceivedDataRef.current = false;
      const wsUrl = BASE_URL.replace("http://", "ws://").replace("https://", "wss://");
      socketRef.current = new WebSocket(`${wsUrl}/tp/translate/ws`);

      socketRef.current.onopen = () => {
        console.log("Connected to AI Server");
        isRecordingRef.current = true;
        setIsRecording(true);
        setSummary(null);
        lastVoiceAtRef.current = Date.now();
        currentSpeakerLangRef.current = null;

        const token = localStorage.getItem("token");
        socketRef.current.send(
          JSON.stringify({
            token,
            service_type: "translate",
            source_lang: sourceLang,
            target_lang: targetLang,
          })
        );

        initAudioStreaming();
      };

      socketRef.current.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        // Kiểm tra lỗi hết Credits từ Backend
        if (data?.error === "INSUFFICIENT_CREDITS") {
          stopRecording();
          showAlert(
            "Hết Credits",
            "Bạn đã sử dụng hết Credits, nạp thêm để tiếp tục.",
            "warning"
          ).then(() => {
            router.push("/billing");
          });
          return;
        }

        if (data?.error) {
          console.error("WS error payload:", data.error);
          setWsError(String(data.error));
          // stop + cleanup; do NOT create empty segments
          stopRecording({ skipSummary: true, skipCloseSegments: true });
          return;
        }
        const newOrg = data.original || "";
        const newTrans = data.translated || "";
        const speakerLang = data.speaker_lang || null;

        // Only create the first segment when we actually have content
        if (!hasReceivedDataRef.current && ((newOrg && newOrg.trim()) || (newTrans && newTrans.trim()))) {
          hasReceivedDataRef.current = true;
          ensureSegment({ speakerLang });
        }

        if (speakerLang && currentSpeakerLangRef.current && speakerLang !== currentSpeakerLangRef.current) {
          closeCurrentAndStartNew("lang_switch", { speakerLang });
        }
        if (speakerLang && !currentSpeakerLangRef.current) currentSpeakerLangRef.current = speakerLang;

        if (data.is_final) {
          ensureSegment({ speakerLang });
          setSegments((prev) => {
            if (!prev.length) return prev;
            const [head, ...rest] = prev;
            const appendOrg = newOrg ? (head.original ? `${head.original}\n${newOrg}` : newOrg) : head.original;
            const appendTrans = newTrans ? (head.translated ? `${head.translated}\n${newTrans}` : newTrans) : head.translated;
            return [{ ...head, original: appendOrg, translated: appendTrans, interimOriginal: "", interimTranslated: "", speakerLang: head.speakerLang ?? speakerLang }, ...rest];
          });

          // Save từng câu
          saveTranslation({ original: newOrg, translated: newTrans })
            .catch((err) => console.error("Save error:", err));

          // Cập nhật credits tiêu thụ và số dư
          if (data.credits_charged) {
            setSessionCredits((prev) => prev + data.credits_charged);
          }
          if (data.new_balance !== undefined) {
            const userStr = localStorage.getItem("user");
            if (userStr) {
              const user = JSON.parse(userStr);
              user.token_balance = data.new_balance;
              localStorage.setItem("user", JSON.stringify(user));
              window.dispatchEvent(new Event("userUpdate"));
            }
          }
        } else {
          ensureSegment({ speakerLang });
          setSegments((prev) => {
            if (!prev.length) return prev;
            const [head, ...rest] = prev;
            return [{ ...head, interimOriginal: newOrg, interimTranslated: newTrans, speakerLang: head.speakerLang ?? speakerLang }, ...rest];
          });
        }
      };

      socketRef.current.onclose = () => {
        console.log("Socket closed");
        isRecordingRef.current = false;
        setIsRecording(false);
      };

      socketRef.current.onerror = () => {
        setWsError("Không kết nối được máy chủ dịch giọng nói (WebSocket).");
        stopRecording({ skipSummary: true, skipCloseSegments: true });
      };

    } catch (err) {
      console.error("Recording Error:", err);
      setWsError("Không thể bắt đầu ghi âm / kết nối dịch.");
      stopRecording();
    }
  };

  const initAudioStreaming = async () => {
    streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    processorRef.current.onaudioprocess = (e) => {
      // Silence detection (~5s)
      try {
        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        const rms = Math.sqrt(sum / inputData.length);
        // Tăng ngưỡng RMS và bỏ feedback
        if (rms > 0.02) lastVoiceAtRef.current = Date.now();
      } catch {
        // ignore
      }

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        socketRef.current.send(pcmData.buffer);
      }
    };

    source.connect(processorRef.current);
    // Cần kết nối tới destination để onaudioprocess hoạt động trong một số trình duyệt
    // Vì chúng ta không ghi gì vào outputBuffer, nó sẽ im lặng (không gây feedback)
    processorRef.current.connect(audioContextRef.current.destination);
  };

  useEffect(() => {
    const t = setInterval(() => {
      if (!isRecordingRef.current) return;
      const silentFor = Date.now() - lastVoiceAtRef.current;
      // Tăng thời gian chờ im lặng lên 5s theo yêu cầu người dùng
      if (silentFor >= 5000) {
        closeCurrentAndStartNew("silence_5s", { speakerLang: currentSpeakerLangRef.current });
        lastVoiceAtRef.current = Date.now();
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestSummary = (finalSegments) => {
    const validSegments = (finalSegments || [])
      .map((s) => ({
        original: (s.original || "").trim(),
        translated: (s.translated || "").trim(),
        speaker_lang: s.speakerLang || null,
      }))
      .filter((s) => s.original || s.translated);

    if (validSegments.length === 0) {
      console.log("No content to summarize or save.");
      return Promise.resolve();
    }

    const payload = {
      source_lang: sourceLang,
      target_lang: targetLang,
      segments: validSegments.slice().reverse(), // API expects oldest-first
    };

    return API.post("/translation/summary", payload)
      .then(async (res) => {
        const summaryData = res.data;
        setSummary(summaryData);
        try {
          await saveTranslation({
            source_lang: langFrom,
            target_lang: langTo,
            segments: validSegments,
            summary: summaryData,
            type: "conversation"
          });
          console.log("Auto-saved conversation to history");
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      })
      .catch((e) => {
        console.error("Summary error:", e);
        setSummary({
          original: "",
          translated:
            "Không tạo được tóm tắt (chưa chạy Backend ở cổng 8000 hoặc lỗi mạng/máy chủ).",
        });
      });
  };

  const stopRecording = (opts = {}) => {
    const { skipSummary = false, skipCloseSegments = false } = opts || {};
    if (!isRecordingRef.current) return;

    isRecordingRef.current = false;
    setIsRecording(false);
    currentSpeakerLangRef.current = null;
    hasReceivedDataRef.current = false;

    try {
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    } catch (e) {
      console.error("Stop error:", e);
    }

    setSegments((prev) => {
      // Remove empty segments (created by toggles/errors)
      const cleaned = (prev || []).filter((s) => {
        const hasAny = (s?.original || "").trim() || (s?.translated || "").trim() || (s?.interimOriginal || "").trim() || (s?.interimTranslated || "").trim();
        return Boolean(hasAny);
      });

      if (skipCloseSegments) return cleaned;

      const next = cleaned.map((s) => ({ ...s, interimOriginal: "", interimTranslated: "", closed: true }));
      if (!skipSummary) {
        // Ensure no unhandled promise rejection (Next.js redbox)
        Promise.resolve(requestSummary(next)).catch(() => { });
      }
      return next;
    });
  };

  const clearAll = () => {
    setSegments([]);
    setSummary(null);
  };

  const copyResult = () => {
    const text = segments
      .slice()
      .reverse()
      .map((s) => s.translated)
      .filter(Boolean)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white selection:bg-blue-500/30 transition-colors duration-300">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* MAIN CONTROL BLOCK */}
        <div className="bg-[#1E293B]/30 backdrop-blur-md rounded-[2.5rem] border border-white/5 shadow-2xl p-10 md:p-14 mb-12">
          {/* TOP SECTION: LANGUAGES */}
          <div className="flex justify-center mb-10">
            <LanguageSelector onChange={(f, t) => { setLangFrom(f); setLangTo(t); }} />
          </div>

          {/* CENTER SECTION: RECORDER */}
          <div className="flex flex-col items-center justify-center">
            <Recorder isRecording={isRecording} onRecord={handleToggleRecord} />
          </div>
        </div>

        {/* TRANSCRIPTION SECTION */}
        <div className="w-full space-y-8">
          <ConversationSegments segments={segments} />

          {/* ACTIONS SECTION - Centered below segments */}
          <div className="flex justify-center gap-4 py-4">
            <button
              onClick={() => { setSegments([]); setSummary(null); }}
              className="flex items-center gap-2 px-8 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white text-xs font-black uppercase tracking-widest transition-all border border-white/5"
            >
              <Trash2 size={16} />
              Clear
            </button>
            <button
              onClick={() => {
                const text = segments.map(s => `[${s.sourceLang}]: ${s.original}\n[${s.targetLang}]: ${s.translated}`).join("\n\n");
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-2 px-10 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Đã copy!" : "Copy Result"}
            </button>
          </div>
        </div>

        {/* SUMMARY SECTION */}
        <div className="pt-24 border-t border-white/5">
          <ConversationSummary summary={summary} onClear={() => setSummary(null)} />
        </div>
      </main>

      {/* FOOTER DECOR */}
      <div className="fixed bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-blue-600/5 to-transparent pointer-events-none -z-10" />
    </div>
  );
}