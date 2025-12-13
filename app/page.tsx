"use client";

import { useState, useMemo } from "react";
import { ThreadInfo } from "@/lib/types";

export default function Home() {
  const [tokenInput, setTokenInput] = useState("");
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Chưa đăng nhập");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // [NEW] State tìm kiếm
  const [searchTerm, setSearchTerm] = useState("");

  const handleLoginAndFetch = async () => {
    if (!tokenInput) {
      setStatus("Vui lòng nhập Token!");
      return;
    }

    setIsLoading(true);
    setStatus("Đang kết nối Zalo...");
    setThreads([]);

    try {
      let tokenParsed;
      try {
        tokenParsed = JSON.parse(tokenInput);
      } catch (e) {
        // Fallback: nếu user paste chuỗi raw, bọc lại
        if (typeof tokenInput === "string" && tokenInput.includes("zpw_sek")) {
          // Giả định đây là string cookie raw hoặc object chưa đúng chuẩn JSON
          // Nhưng tốt nhất cứ thử parse
          setStatus("Lỗi: Chuỗi Token không đúng định dạng JSON.");
          setIsLoading(false);
          return;
        }
        setStatus("Lỗi: Token phải là JSON hợp lệ.");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/get-threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenParsed }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lỗi API không xác định");
      }

      if (data.threads && Array.isArray(data.threads)) {
        setThreads(data.threads);
        setStatus(`Thành công! Tìm thấy ${data.threads.length} hội thoại.`);
      } else {
        setStatus("Thành công nhưng không tìm thấy hội thoại nào.");
      }
    } catch (e) {
      console.error(e);
      setStatus(`Lỗi: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // [NEW] Logic lọc danh sách theo từ khóa tìm kiếm
  const filteredThreads = useMemo(() => {
    if (!searchTerm) return threads;
    const lowerTerm = searchTerm.toLowerCase();
    return threads.filter(
      (t) =>
        t.name.toLowerCase().includes(lowerTerm) || t.id.includes(lowerTerm),
    );
  }, [threads, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-blue-400">
          Parent Online Lite (MVP)
        </h1>

        {/* Section 1: Token */}
        <div className="bg-gray-800 p-6 rounded-xl mb-8 border border-gray-700 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-200">
            1. Cấu hình Bot
          </h2>
          <textarea
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder='{"cookie": "...", "imei": "...", "userAgent": "..."}'
            className="w-full h-32 bg-gray-950 border border-gray-600 rounded-lg p-3 text-xs font-mono text-green-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-700"
          />
          <div className="mt-4">
            <button
              onClick={handleLoginAndFetch}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Đang tải...
                </>
              ) : (
                "Kiểm tra & Lấy danh sách hội thoại"
              )}
            </button>
          </div>
          {status && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm font-medium border ${
                status.startsWith("Lỗi")
                  ? "bg-red-900/30 border-red-800 text-red-300"
                  : "bg-gray-700/50 border-gray-600 text-gray-300"
              }`}
            >
              {status}
            </div>
          )}
        </div>

        {/* Section 2: Conversation List */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
            <h2 className="text-xl font-semibold text-gray-200">
              2. Danh sách Hội thoại
            </h2>

            {/* [NEW] Thanh tìm kiếm */}
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Tìm tên hoặc ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 pl-3 pr-10 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <span className="absolute right-3 top-2.5 text-gray-500 text-xs">
                {filteredThreads.length}
              </span>
            </div>
          </div>

          <div className="h-[500px] overflow-y-auto bg-gray-950 rounded-lg border border-gray-600 p-2 scrollbar-thin scrollbar-thumb-gray-700">
            {threads.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                <p>Chưa có dữ liệu.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredThreads.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-all group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {/* Avatar */}
                      <div className="relative w-10 h-10 shrink-0">
                        {t.avatar ? (
                          <img
                            src={t.avatar}
                            alt={t.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner ${
                              t.type === "group"
                                ? "bg-indigo-900 text-indigo-200"
                                : "bg-teal-900 text-teal-200"
                            }`}
                          >
                            {t.type === "group" ? "G" : "U"}
                          </div>
                        )}
                        {/* Badge Type */}
                        <div
                          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] border border-gray-900 ${
                            t.type === "group"
                              ? "bg-indigo-500 text-white"
                              : "bg-teal-500 text-black"
                          }`}
                        >
                          {t.type === "group" ? "G" : "U"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-gray-200 truncate pr-2 group-hover:text-white transition-colors text-sm md:text-base">
                          {t.name}
                        </p>
                        <p
                          className="text-xs text-gray-500 font-mono truncate"
                          title={t.id}
                        >
                          {t.id}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCopyId(t.id)}
                      className={`text-xs px-3 py-1.5 rounded font-medium transition-all shrink-0 ${
                        copiedId === t.id
                          ? "bg-green-600 text-white shadow-lg scale-105"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-500"
                      }`}
                    >
                      {copiedId === t.id ? "Đã Copy!" : "Copy ID"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
