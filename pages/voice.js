import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import Recorder from "../components/Recorder";
import LanguageSelector from "../components/LanguageSelector";
import { Mic2, Languages, Mic, Trash2, Copy, Check } from "lucide-react";
import ConversationSegments from "../components/ConversationSegments";
import ConversationSummary from "../components/ConversationSummary";
import API, { saveTranslation, BASE_URL } from "../services/api";
import { showAlert, showToast } from "../utils/alerts";

function VoiceDataBox({ title, icon: Icon, value, color, placeholder }) {
  return (
    <div className="bg-white/5 backdrop-blur-md p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-2xl transition-all hover:border-blue-500/30">
      <h3 className={`flex items-center gap-2 font-bold mb-4 md:mb-6 uppercase text-[10px] md:text-xs tracking-[0.2em] ${color}`}>
        <Icon size={16} /> {title}
      </h3>
      <textarea
        value={value}
        readOnly
        placeholder={placeholder || "Waiting for audio..."}
        className="w-full h-40 md:h-64 bg-transparent text-white text-xl md:text-2xl font-light outline-none resize-none placeholder:text-slate-800 leading-relaxed"
      />
    </div>
  );
}

export default function VoiceTranslate() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.replace("/login?next=/voice");
  }, [router]);

  const [segments, setSegments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [wsError, setWsError] = useState(null);
  const [sessionCredits, setSessionCredits] = useState(0); // Theo dõi credits tiêu thụ trong phiên
  const [langFrom, setLangFrom] = useState("Vietnamese");
  const [langTo, setLangTo] = useState("English");
  const [copied, setCopied] = useState(false);

  const audioQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const currentAudioRef = useRef(null);
  const ttsAbortControllerRef = useRef(null);

  const isRecordingRef = useRef(false);
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

  function getAuthHeader() {
    const token = localStorage.getItem("token");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  const lastPlayedInterimRef = useRef("");

  const speak = (text, lang = "auto", isFinal = true) => {
    if (!text?.trim()) return;

    // Đối với interim, chỉ nói nếu có sự thay đổi đáng kể và là câu dài hơn
    if (!isFinal) {
      if (text.length <= lastPlayedInterimRef.current.length || !text.startsWith(lastPlayedInterimRef.current)) {
        // Nếu câu mới ngắn hơn hoặc không phải là phần nối tiếp, kiểm tra xem có từ mới không
        const lastWords = lastPlayedInterimRef.current.split(" ");
        const newWords = text.split(" ");
        if (newWords.length <= lastWords.length) return;
      }

      // TỐI ƯU: Giảm ngưỡng từ 3 từ xuống 2 từ để nói cực sớm (Cabin mode)
      if (text.split(" ").length < 2) return;

      // Lưu lại để không phát lặp lại phần đã nói
      lastPlayedInterimRef.current = text;
    } else {
      // TỐI ƯU: Nếu là bản FINAL, kiểm tra xem bản interim gần nhất đã phát bao nhiêu rồi.
      // Nếu bản final không dài hơn đáng kể so với bản interim đã phát, chúng ta có thể bỏ qua
      // để tránh việc phát lại toàn bộ câu khi vừa mới phát xong bản interim.
      const alreadyPlayed = lastPlayedInterimRef.current;
      lastPlayedInterimRef.current = ""; // Reset cho lần sau

      if (text.length <= alreadyPlayed.length + 10 && text.startsWith(alreadyPlayed.substring(0, Math.min(alreadyPlayed.length, 10)))) {
        console.log("⏭️ Skipping final TTS: Interim already played most of it");
        return;
      }
    }

    // Bắt đầu fetch ngay lập tức để giảm độ trễ
    const fetchPromise = fetchTTS(text, lang);

    // Thêm vào hàng đợi kèm theo promise của fetch
    audioQueueRef.current.push({ text, lang, fetchPromise, isFinal });

    // Nếu đang nói thì không bắt đầu tiến trình mới
    if (isSpeakingRef.current) return;

    // Đánh dấu là đang nói ngay lập tức để tránh race condition
    isSpeakingRef.current = true;
    processAudioQueue();
  };

  const fetchTTS = async (text, lang) => {
    try {
      const token = localStorage.getItem("token");

      // TỐI ƯU: Sử dụng trực tiếp URL với token để Audio object có thể stream ngay lập tức
      // Điều này bỏ qua bước fetch -> blob -> objectURL, giúp giảm đáng kể độ trễ bắt đầu phát.
      const params = new URLSearchParams({
        text: text,
        lang: lang || "auto",
        token: token || ""
      });

      return `${BASE_URL}/translation/tts?${params.toString()}`;
    } catch (error) {
      console.error("❌ Prepare TTS URL error:", error);
      return null;
    }
  };

  const processAudioQueue = async () => {
    // Nếu ghi âm đã dừng, xóa hàng đợi và dừng lại
    if (!isRecordingRef.current) {
      console.log("⏹️ Audio queue stopped: Recording is off");
      audioQueueRef.current = [];
      isSpeakingRef.current = false;
      return;
    }

    // Nếu hàng đợi trống, kết thúc tiến trình
    if (audioQueueRef.current.length === 0) {
      console.log("Empty queue, stopping speaker");
      isSpeakingRef.current = false;
      return;
    }

    // TỐI ƯU: Giảm ngưỡng chờ người dùng nói từ 400ms xuống 200ms
    const isUserSpeaking = Date.now() - lastVoiceAtRef.current < 200;

    if (isUserSpeaking) {
      // Trong chế độ cabin, chúng ta ưu tiên phát âm thanh ngay lập tức
      console.log("⏳ User is speaking, but proceeding for real-time cabin experience...");
    }

    const item = audioQueueRef.current.shift();
    if (!item) {
      isSpeakingRef.current = false;
      return;
    }

    // TỐI ƯU: Nếu item hiện tại là interim, và trong hàng đợi đã có bản FINAL mới hơn,
    // hoặc có bản interim dài hơn, hãy bỏ qua bản interim cũ này để phát bản mới nhất.
    if (!item.isFinal && audioQueueRef.current.length > 0) {
      const hasBetterOption = audioQueueRef.current.some(next =>
        next.isFinal || (next.text.length > item.text.length && next.text.startsWith(item.text))
      );
      if (hasBetterOption) {
        console.log("⏩ Skipping old interim for a newer/longer version");
        setTimeout(processAudioQueue, 0);
        return;
      }
    }

    console.log(`🔊 Processing item: "${item.text.substring(0, 30)}..."`);
    const { fetchPromise } = item;

    try {
      const audioUrl = await fetchPromise;

      if (audioUrl && isRecordingRef.current) {
        console.log("🎵 Streaming audio from:", audioUrl);
        const audio = new Audio();

        // Thiết lập các thuộc tính quan trọng cho streaming
        audio.preload = "auto";
        audio.crossOrigin = "anonymous"; // Quan trọng khi gọi sang port khác

        currentAudioRef.current = audio;

        await new Promise((resolve) => {
          const cleanup = () => {
            console.log("✅ Audio finished/cleaned up");
            if (currentAudioRef.current === audio) currentAudioRef.current = null;
            resolve();
          };

          audio.oncanplaythrough = () => {
            console.log("▶️ Audio can play through, starting...");
            audio.play().catch(e => {
              console.error("❌ Play failed:", e);
              cleanup();
            });
          };

          audio.onended = cleanup;
          audio.onerror = (e) => {
            console.error("❌ Audio playback error event:", e);
            console.error("Audio error details:", audio.error);
            cleanup();
          };

          // Gán src cuối cùng để bắt đầu load
          audio.src = audioUrl;
          audio.load();

          // Safety timeout cho mỗi đoạn
          setTimeout(cleanup, 60000);
        });
      }
    } catch (err) {
      console.error("❌ Queue item processing error:", err);
    }

    // Tiếp tục xử lý phần tử tiếp theo ngay lập tức
    processAudioQueue();
  };

  const initAudioStreaming = async () => {
    streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    // Đảm bảo AudioContext luôn ở trạng thái running
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    processorRef.current.onaudioprocess = (e) => {
      // Silence detection
      try {
        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        const rms = Math.sqrt(sum / inputData.length);

        // Tăng ngưỡng RMS từ 0.01 lên 0.02 để tránh nhiễu/feedback
        if (rms > 0.02) {
          lastVoiceAtRef.current = Date.now();
        }
      } catch {
        // ignore
      }

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
        }
        socketRef.current.send(pcmData.buffer);
      }
    };

    source.connect(processorRef.current);
    // Cần kết nối tới destination để onaudioprocess hoạt động trong một số trình duyệt
    // Vì chúng ta không ghi gì vào outputBuffer, nó sẽ im lặng (không gây feedback)
    processorRef.current.connect(audioContextRef.current.destination);
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
      if (!hasContent) return prev;
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
      console.log("No content to summarize.");
      return Promise.resolve();
    }

    const payload = {
      source_lang: sourceLang,
      target_lang: targetLang,
      segments: validSegments.slice().reverse(),
    };

    return API.post("/translation/summary", payload)
      .then((res) => {
        setSummary(res.data);
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
      // 1. Dừng âm thanh đang phát ngay lập tức
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      // 2. Hủy các yêu cầu TTS đang fetch
      if (ttsAbortControllerRef.current) {
        ttsAbortControllerRef.current.abort();
        ttsAbortControllerRef.current = null;
      }

      // 3. Xóa sạch hàng đợi
      audioQueueRef.current = [];
      isSpeakingRef.current = false;

      // 4. Đóng WebSocket và các resource khác
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
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if ("speechSynthesis" in window) speechSynthesis.cancel();
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
        Promise.resolve(requestSummary(next)).catch(() => { });
      }
      return next;
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
      // Đảm bảo AudioContext được khởi tạo/resume ngay khi có tương tác người dùng
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000,
        });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      setWsError(null);
      hasReceivedDataRef.current = false;

      const token = localStorage.getItem("token");
      const wsUrl = BASE_URL.replace(/^http/, "ws") + "/tp/translate/ws";
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        isRecordingRef.current = true;
        setIsRecording(true);
        setSummary(null);
        lastVoiceAtRef.current = Date.now();
        currentSpeakerLangRef.current = null;

        socketRef.current.send(
          JSON.stringify({
            token: token,
            source_lang: sourceLang,
            target_lang: targetLang,
            service_type: "voice"
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

          if (newTrans) {
            // Xác định ngôn ngữ của bản dịch: nếu người nói là sourceLang thì bản dịch là targetLang và ngược lại
            const translationLang = speakerLang === sourceLang ? targetLang : sourceLang;
            speak(newTrans, translationLang, true);
          }

          saveTranslation({
            original: newOrg,
            translated: newTrans,
          }).catch((err) => console.error("Save error:", err));

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

          // TỐI ƯU: Phát âm thanh interim ngay khi đang dịch để đạt trải nghiệm cabin
          // Giảm ngưỡng từ 10 ký tự xuống 5 ký tự để phản hồi nhanh nhất có thể
          if (newTrans && newTrans.trim().length > 5) {
            const translationLang = speakerLang === sourceLang ? targetLang : sourceLang;
            speak(newTrans, translationLang, false);
          }
        }
      };

      socketRef.current.onclose = () => {
        isRecordingRef.current = false;
        setIsRecording(false);
      };

      socketRef.current.onerror = () => {
        setWsError("Không kết nối được máy chủ dịch giọng nói (WebSocket).");
        showAlert("Lỗi kết nối", "Không kết nối được máy chủ dịch giọng nói. Vui lòng thử lại sau.", "error");
        stopRecording({ skipSummary: true, skipCloseSegments: true });
      };
    } catch (err) {
      console.error("Recording Error:", err);
      setWsError("Không thể bắt đầu ghi âm / kết nối dịch.");
      showAlert("Lỗi thiết bị", "Không thể truy cập Microphone hoặc lỗi kết nối. Vui lòng kiểm tra lại quyền truy cập.", "error");
      stopRecording();
    }
  };

  const [isProcessingToggle, setIsProcessingToggle] = useState(false);

  const handleToggleRecord = async () => {
    if (isProcessingToggle) return;
    setIsProcessingToggle(true);
    try {
      if (isRecordingRef.current) {
        stopRecording();
      } else {
        await startRecording();
      }
    } finally {
      setIsProcessingToggle(false);
    }
  };

  const handleClearSummary = () => {
    setSummary(null);
    setSegments([]);
  };

  const clearAll = () => {
    setSegments([]);
    setSummary(null);
  };

  const copyResult = () => {
    if (!segments.length) return;
    const text = segments
      .slice()
      .reverse()
      .map((s) => `${s.original}\n${s.translated}`)
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    return () => stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#0F172A] text-white selection:bg-blue-500/30 transition-colors duration-300">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* MODE BADGE */}
        <div className="flex justify-center mb-8">
          <div className="px-4 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-full flex items-center gap-2 text-blue-400">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Voice Analysis Mode</span>
          </div>
        </div>

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