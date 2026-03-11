import { useRef, useState, useCallback } from "react";
import { useDraggable } from "./hooks/useDraggable";

interface StickyInfoBoxProps {
  schoolData: Record<string, string>;
  itemData: Record<string, string>;
  history: any[];
  date?: string;
  setDate?: (date: string) => void;
  isDateEditable?: boolean;
  no_bapp?: string;
}

function LogCard({ log }: { log: any }) {
  const isPositive =
    log.status.toLowerCase().includes("setuju") ||
    log.status.toLowerCase().includes("terima");
  return (
    <div
      className={`border rounded p-2 ${isPositive
        ? "bg-green-900/20 border-green-900/50"
        : "bg-red-900/20 border-red-900/50"
        }`}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="text-[10px] text-zinc-500 font-mono">{log.date}</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isPositive
            ? "bg-green-900/50 text-green-400"
            : "bg-red-900/50 text-red-400"
            }`}
        >
          {log.status}
        </span>
      </div>
      {log.user && (
        <div className="text-xs font-semibold text-zinc-300 mb-0.5">
          {log.user}
        </div>
      )}
      <div className="text-xs text-zinc-400 italic">{log.note}</div>
    </div>
  );
}

function HistoryList({ logs }: { logs: any[] }) {
  const [showOldRejections, setShowOldRejections] = useState(false);

  const rejectionLogs = logs.filter(
    (l) =>
      !l.status.toLowerCase().includes("setuju") &&
      !l.status.toLowerCase().includes("terima")
  );
  const approvalLogs = logs.filter(
    (l) =>
      l.status.toLowerCase().includes("setuju") ||
      l.status.toLowerCase().includes("terima")
  );

  // index 0 = terbaru (newest-first), selalu ditampilkan di bawah
  const lastRejection = rejectionLogs[0];
  const secondRejection = rejectionLogs[1]; // terbaru kedua

  // Cek apakah log rejection terbaru dari admin/TIM M2
  const isLastRejectionFromAdmin =
    lastRejection &&
    (lastRejection.user?.toLowerCase().includes("admin") ||
      lastRejection.user?.toLowerCase().includes("tim m2"));

  // Jika admin: [2+] collapsible, jika bukan: [1+] collapsible
  const olderRejections = isLastRejectionFromAdmin
    ? rejectionLogs.slice(2)
    : rejectionLogs.slice(1);

  return (
    <div className="space-y-2">
      {/* Rejection logs */}
      {rejectionLogs.length > 0 && (
        <div className="space-y-2">
          {/* Penolakan lama (collapsible, di atas dengan indent) */}
          {olderRejections.length > 0 && (
            <>
              <button
                onClick={() => setShowOldRejections((v) => !v)}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 w-full text-left"
              >
                {showOldRejections
                  ? "▲ Sembunyikan penolakan lama"
                  : `▼ Lihat ${olderRejections.length} penolakan lama`}
              </button>
              {showOldRejections && (
                <div className="space-y-2 border-l-2 border-red-900/40 pl-2 opacity-70">
                  {/* Oldest on top (reverse newest-first array) */}
                  {[...olderRejections].reverse().map((log, idx) => (
                    <LogCard key={idx} log={log} />
                  ))}
                </div>
              )}
            </>
          )}
          {/* +1 rejection (terbaru kedua) — hanya jika last rejection dari admin/TIM M2 */}
          {isLastRejectionFromAdmin && secondRejection && (
            <div className="border-l-2 border-yellow-700/40 pl-2 opacity-80 space-y-1">
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">
                Log Sebelumnya
              </div>
              <LogCard log={secondRejection} />
            </div>
          )}
          {/* Log rejection terbaru — selalu di paling bawah */}
          {lastRejection && <LogCard log={lastRejection} />}
        </div>
      )}

      {/* Approval logs */}
      {approvalLogs.map((log, idx) => (
        <LogCard key={`a-${idx}`} log={log} />
      ))}
    </div>
  );
}

export default function StickyInfoBox({
  schoolData,
  itemData,
  history,
  date,
  setDate,
  isDateEditable = false,
  no_bapp,
}: StickyInfoBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null!);
  const { position, handleMouseDown } = useDraggable<HTMLDivElement>(
    boxRef,
    "sticky-info-box",
  );

  const [showHistory, setShowHistory] = useState(true);

  // Resize state
  const [size, setSize] = useState({ width: 320, height: NaN }); // NaN = auto height
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 320, h: 0 });

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    const currentH = boxRef.current?.offsetHeight ?? 400;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: size.width,
      h: currentH,
    };

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const dw = ev.clientX - resizeStart.current.x;
      const dh = ev.clientY - resizeStart.current.y;
      setSize({
        width: Math.max(240, resizeStart.current.w + dw),
        height: Math.max(200, resizeStart.current.h + dh),
      });
    };
    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [size.width]);

  // Admin log detection (for popup in history section)
  const logs: any[] = history || [];

  return (
    <div
      ref={boxRef}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        touchAction: "none",
        zIndex: 1000,
        width: `${size.width}px`,
        height: isNaN(size.height) ? undefined : `${size.height}px`,
        minWidth: "240px",
        minHeight: "200px",
        borderRadius: "8px",
        fontFamily: "sans-serif",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        backgroundColor: "#18181b",
        border: "2px solid #3f3f46",
      }}
      className="text-zinc-100 flex flex-col max-h-[90vh]"
    >
      {/* Header */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 18px",
          cursor: "move",
          borderBottom: "1px solid #3f3f46",
          backgroundColor: "#27272a",
          borderTopLeftRadius: "6px",
          borderTopRightRadius: "6px",
          flexShrink: 0,
        }}
      >
        <span className="font-bold text-yellow-500 text-sm">
          {schoolData.nama_sekolah || "-"}
        </span>
      </div>

      {/* Content */}
      <div
        className="p-3 text-sm space-y-3 bg-zinc-900 text-white overflow-y-auto custom-scrollbar flex-1"
        onClick={(e) => e.stopPropagation()}
      >
        {/* School Info */}
        <div className="space-y-2">
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              NPSN
            </div>
            <div className="text-lg font-mono text-yellow-500">
              {schoolData.npsn || "-"}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Serial Number
            </div>
            <div className="text-lg font-mono text-yellow-500">
              {itemData.serial_number || "-"}
            </div>
          </div>
          {no_bapp && (
            <div>
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                No BAPP
              </div>
              <div className="text-xs font-mono text-emerald-400 break-all">
                {no_bapp}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Alamat
            </div>
            <div className="text-xs text-white truncate">
              {schoolData.alamat || "-"}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Kecamatan
            </div>
            <div className="text-xs text-white truncate">
              {schoolData.kecamatan || "-"}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Model / Series
            </div>
            <div className="text-sm font-medium text-zinc-200 truncate" title={itemData.nama_barang}>
              {itemData.nama_barang || "-"}
            </div>
          </div>
        </div>

        <hr className="border-zinc-700" />

        {/* Date Input */}
        {date !== undefined && setDate && (
          <div>
            <label className="text-xs font-bold text-yellow-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <span className="text-lg"></span> Tanggal Verifikasi
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min="2025-12-01"
              max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`}
              disabled={!isDateEditable}
              onWheel={(e) => {
                if (!date || !isDateEditable) return;
                const currentDate = new Date(date);
                const daysToAdd = e.deltaY > 0 ? -1 : 1;
                currentDate.setDate(currentDate.getDate() + daysToAdd);
                const minDate = new Date("2025-12-01");
                const maxDate = new Date();
                maxDate.setHours(0, 0, 0, 0);
                minDate.setHours(0, 0, 0, 0);
                currentDate.setHours(0, 0, 0, 0);
                if (currentDate < minDate || currentDate > maxDate) return;
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, "0");
                const day = String(currentDate.getDate()).padStart(2, "0");
                setDate(`${year}-${month}-${day}`);
              }}
              className={`w-full border-2 rounded px-3 py-2 font-bold focus:outline-none focus:ring-2 text-lg shadow-[0_0_15px_rgba(234,179,8,0.2)] transition-colors
                ${isDateEditable
                  ? "bg-yellow-900/20 border-yellow-500 text-yellow-100 focus:border-yellow-400 focus:ring-yellow-500/50"
                  : "bg-zinc-800/50 border-zinc-700 text-zinc-500 cursor-not-allowed opacity-70"
                }`}
            />
            <p className="text-[11px] text-yellow-500/80 mt-1 font-medium italic">
              {isDateEditable ? "* Pastikan tanggal sesuai dengan BAPP" : "* Tanggal hanya bisa diedit jika TGL BAPP diset manual"}
            </p>
          </div>
        )}

        <hr className="border-zinc-700" />

        {/* History Info */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Riwayat Approval
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-zinc-500 hover:text-zinc-300 focus:outline-none"
            >
              {showHistory ? "▲ Sembunyikan" : "▼ Tampilkan"}
            </button>
          </div>

          {showHistory && (
            logs.length > 0 ? (
              <HistoryList logs={logs} />
            ) : (
              <div className="text-xs text-zinc-600 italic">
                Belum ada riwayat.
              </div>
            )
          )}
        </div>
      </div>

      {/* Resize Handle — pojok kanan bawah */}
      <div
        onMouseDown={handleResizeMouseDown}
        title="Drag untuk resize"
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: "18px",
          height: "18px",
          cursor: "nwse-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottomRightRadius: "6px",
          zIndex: 10,
        }}
      >
        {/* Resize grip icon */}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M9 1L1 9M9 5L5 9M9 9H9" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
