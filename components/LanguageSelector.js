import { useEffect, useState } from "react"
import { ArrowLeftRight } from "lucide-react"

export default function LanguageSelector({ onChange }) {
  const languages = [
    { name: "Auto Detect", code: "un" },
    { name: "English", code: "us" },
    { name: "Vietnamese", code: "vn" },
    { name: "Japanese", code: "jp" },
    { name: "Korean", code: "kr" },
    { name: "Chinese", code: "cn" }
  ]

  const [from, setFrom] = useState(languages[2]) // Default to Vietnamese (was 1, now 2 because of Auto Detect)
  const [to, setTo] = useState(languages[1]) // Default to English
  const [rotate, setRotate] = useState(false)

  useEffect(() => {
    onChange?.(from.name, to.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])

  const swapLanguage = () => {
    setRotate(true)
    setTimeout(() => {
      setFrom(to)
      setTo(from)
      setRotate(false)
    }, 300)
  }

  return (
    <div className="flex flex-row items-center justify-center gap-4 w-full max-w-xl px-4">

      {/* FROM LANGUAGE */}
      <div className="flex items-center gap-3 bg-black/20 backdrop-blur-md border border-white/5 px-6 py-3 rounded-[2rem] w-full md:w-auto transition-all">
        <img
          src={`https://flagcdn.com/w40/${from.code}.png`}
          className="w-6 h-6 rounded-full object-cover border border-white/10"
          alt={from.name}
        />
        <select
          value={from.name}
          onChange={(e) => setFrom(languages.find(l => l.name === e.target.value))}
          className="bg-transparent outline-none text-white font-bold cursor-pointer appearance-none pr-4 text-xs"
        >
          {languages.map(lang => (
            <option key={lang.name} value={lang.name} className="bg-[#0F172A] text-white">
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* SWAP BUTTON */}
      <button
        onClick={swapLanguage}
        className={`bg-blue-600 p-2.5 rounded-full shadow-lg transition-all duration-300 active:scale-90 flex-shrink-0 ${rotate ? "rotate-180" : ""
          }`}
      >
        <ArrowLeftRight size={16} className="text-white" />
      </button>

      {/* TO LANGUAGE */}
      <div className="flex items-center gap-3 bg-black/20 backdrop-blur-md border border-white/5 px-6 py-3 rounded-[2rem] w-full md:w-auto transition-all">
        <img
          src={`https://flagcdn.com/w40/${to.code}.png`}
          className="w-6 h-6 rounded-full object-cover border border-white/10"
          alt={to.name}
        />
        <select
          value={to.name}
          onChange={(e) => setTo(languages.find(l => l.name === e.target.value))}
          className="bg-transparent outline-none text-white font-bold cursor-pointer appearance-none pr-4 text-xs"
        >
          {languages.map(lang => (
            <option key={lang.name} value={lang.name} className="bg-[#0F172A] text-white">
              {lang.name}
            </option>
          ))}
        </select>
      </div>

    </div>
  )
}