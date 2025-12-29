'use client';

import { useEffect, useState, useRef } from 'react';
import Login from '@/components/Login';
import ServiceAccountUpload from '@/components/ServiceAccountUpload';
import Sidebar, { defaultEvaluationValues } from '@/components/Sidebar';
import StickyInfoBox from '@/components/StickyInfoBox';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Helper Interface
interface ExtractedData {
  school: Record<string, string>;
  item: Record<string, string>;
  images: Array<{ src: string; title: string }>;
  history: string[]; // Simple array of strings for history
  extractedId: string;
  resi: string;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasServiceAccount, setHasServiceAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Sheet Data
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [fetchingData, setFetchingData] = useState(false);

  // Navigation
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

  // Detail Content
  const [selectedSn, setSelectedSn] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Parsed structured data
  const [parsedData, setParsedData] = useState<ExtractedData | null>(null);

  // Sidebar Form State
  const [evaluationForm, setEvaluationForm] = useState(defaultEvaluationValues);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Image Viewer State
  const [currentImageIndex, setCurrentImageIndex] = useState<number | null>(null);
  const [imageRotation, setImageRotation] = useState(0);

  // Verification Date
  const [verificationDate, setVerificationDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const session = localStorage.getItem('ci_session');
    const serviceAccount = localStorage.getItem('service_account_json');
    if (session) setIsAuthenticated(true);
    if (serviceAccount) setHasServiceAccount(true);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated && hasServiceAccount) fetchSheetData();
  }, [isAuthenticated, hasServiceAccount]);

  // Navigate/Auto-select Logic
  useEffect(() => {
    if (sheetData.length > 0) {
      if (currentTaskIndex < sheetData.length) {
        handleSelectItem(sheetData[currentTaskIndex]);
        // Reset Form
        setEvaluationForm(defaultEvaluationValues);
        setCustomReason('');
      } else {
        setSelectedSn(null);
        setParsedData(null);
      }
    }
  }, [sheetData, currentTaskIndex]);

  // State to hold extractedId temporarily before html parsing
  const [currentExtractedId, setCurrentExtractedId] = useState<string | null>(null);
  const [rawDataHtml, setRawDataHtml] = useState<string>('');

  // Parse HTML Effect
  useEffect(() => {
    if (rawDataHtml && currentExtractedId) {
      parseHtml(rawDataHtml, currentExtractedId);
    }
  }, [rawDataHtml, currentExtractedId]);

  // Keyboard Navigation for Image Viewer
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (currentImageIndex === null || !parsedData) return;
      if (e.key === "Escape" || e.key === "Space") setCurrentImageIndex(null);
      if (e.key === "ArrowRight") setCurrentImageIndex((p) => (p! + 1) % parsedData.images.length);
      if (e.key === "ArrowLeft") setCurrentImageIndex((p) => (p! - 1 + parsedData.images.length) % parsedData.images.length);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentImageIndex, parsedData]);


  const parseHtml = (html: string, initialExtractedId: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Helper to get input value by label
    const getValueByLabel = (labelText: string): string => {
      // Find label containing text
      const labels = Array.from(doc.querySelectorAll('label'));
      const targetLabel = labels.find(l => l.textContent?.trim().includes(labelText));
      if (targetLabel && targetLabel.parentElement) {
        const input = targetLabel.parentElement.querySelector('input, textarea');
        if (input) {
          // Try value property first, then attribute (for disabled inputs in parsed DOM)
          return (input as HTMLInputElement).value || input.getAttribute('value') || '';
        }
      }
      return '';
    };

    const school: Record<string, string> = {
      npsn: getValueByLabel('NPSN'),
      nama_sekolah: getValueByLabel('Nama Sekolah'),
      alamat: getValueByLabel('Alamat'),
      kecamatan: getValueByLabel('Kecamatan'),
      kabupaten: getValueByLabel('Kabupaten'),
      provinsi: getValueByLabel('Provinsi'),
      pic: 'N/A' // Not always present in standard labels
    };

    const item: Record<string, string> = {
      serial_number: getValueByLabel('Serial Number'),
      nama_barang: getValueByLabel('Nama Barang')
    };

    // Extract Resi
    let resi = getValueByLabel('No. Resi'); // Try exact label first
    if (!resi) resi = getValueByLabel('No Resi'); // Try "No Resi"

    if (!resi) {
      // Fallback: search raw text if label match fails
      const bodyText = doc.body.textContent || '';
      const resiMatch = bodyText.match(/No\.?\s*Resi\s*[:\n]?\s*([A-Z0-9]+)/i);
      if (resiMatch) resi = resiMatch[1];
    }

    // Extract ID from Approval Button
    const approvalBtn = doc.querySelector('button[onclick*="approvalFunc"]');
    const htmlId = approvalBtn?.getAttribute('data-id');

    // Images
    const imgs: Array<{ src: string; title: string }> = [];
    const imageCards = doc.querySelectorAll('.card .card-body .col-6'); // Selector based on the provided HTML structure
    imageCards.forEach(card => {
      const header = card.querySelector('.card-header');
      const img = card.querySelector('img');
      if (img) {
        imgs.push({
          title: header?.textContent?.trim() || 'Dokumentasi',
          src: img.getAttribute('src') || ''
        });
      }
    });

    setParsedData({
      school,
      item,
      images: imgs,
      history: [], // Simplify for now
      extractedId: htmlId || initialExtractedId, // Prefer ID found in HTML
      resi: resi || '-'
    });
  };

  const fetchSheetData = async () => {
    setFetchingData(true);
    try {
      // Auto-relogin check
      const storedUser = localStorage.getItem('username');
      const storedPass = localStorage.getItem('password');

      if (storedUser && storedPass) {
        try {
          // Attempt to renew session
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: storedUser, password: storedPass })
          });
          const loginData = await loginRes.json();
          if (loginData.success && loginData.cookie) {
            const match = loginData.cookie.match(/ci_session=([^;]+)/);
            if (match && match[1]) {
              localStorage.setItem('ci_session', match[1]);
              console.log('Session renewed automatically via fetchSheetData');
            }
          }
        } catch (e) {
          console.error('Silent relogin failed', e);
        }
      }

      const serviceAccountStr = localStorage.getItem('service_account_json');
      const verifikator = localStorage.getItem('nama') || localStorage.getItem('username'); // Fallback to username if nama not set

      if (!serviceAccountStr || !verifikator) {
        console.error("Missing service account or verifikator name");
        return;
      }

      const res = await fetch('/api/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceAccount: JSON.parse(serviceAccountStr), verifikator })
      });
      const json = await res.json();
      if (json.success) {
        setSheetData(json.data);
        setCurrentTaskIndex(0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingData(false);
    }
  };

  const handleSelectItem = async (item: any) => {
    setSelectedSn(item.serial_number);
    setDetailLoading(true);
    setRawDataHtml('');
    setParsedData(null);
    setCurrentExtractedId(null);

    let currentSessionId = localStorage.getItem('ci_session');
    try {
      const checkRes = await fetch('/api/check-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npsn: item.npsn, nama_sekolah: item.nama_sekolah, sn: item.serial_number, session_id: currentSessionId })
      });
      const checkJson = await checkRes.json();

      if (checkJson.newSessionId) {
        console.log('Session updated from check-approval', checkJson.newSessionId);
        currentSessionId = checkJson.newSessionId;
        localStorage.setItem('ci_session', currentSessionId!);
      }

      if (checkJson.extractedId) {
        setCurrentExtractedId(checkJson.extractedId);
        const detailRes = await fetch('/api/get-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: checkJson.extractedId, session_id: currentSessionId })
        });
        const detailJson = await detailRes.json();

        if (detailJson.newSessionId) {
          console.log('Session updated from get-detail', detailJson.newSessionId);
          localStorage.setItem('ci_session', detailJson.newSessionId);
        }

        if (detailJson.html) setRawDataHtml(detailJson.html);
      } else {
        // No ID found, maybe skip or show error
        console.log('No extracted ID found for this item');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitApproval = async (status: number, note: string) => {
    if (!parsedData || !parsedData.extractedId) return;
    setIsSubmitting(true);
    const session_id = localStorage.getItem('ci_session');

    try {
      const res = await fetch('/api/save-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          id: parsedData.extractedId,
          npsn: parsedData.school.npsn,
          resi: parsedData.resi,
          note,
          session_id
        })
      });
      const json = await res.json();
      if (json.newSessionId) {
        localStorage.setItem('ci_session', json.newSessionId);
      }

      if (json.success) {
        console.log('Approval submitted successfully');

        // --- Spreadsheet Update Integration ---
        await updateSpreadsheet(status === 2 ? 'OK' : 'TOLAK');
        // --------------------------------------

        handleSkip(false);
      } else {
        console.error('Approval submission failed', json.message);
        alert(`Gagal submit: ${json.message || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Submit error:', e);
      alert('Terjadi kesalahan saat submit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSpreadsheet = async (finalStatus: string) => {
    // Current item must have a row_index for this to work
    const currentItem = sheetData[currentTaskIndex];
    if (!currentItem || !currentItem.row_index) {
      console.warn('Cannot update spreadsheet: missing row index');
      return;
    }

    const updates = { ...evaluationForm };

    // Add Date Column (U)
    updates['U'] = verificationDate;

    // Filter out keys that don't look like column letters (just in case)
    const validUpdates: Record<string, string> = {};
    Object.keys(updates).forEach(key => {
      if (/^[A-Z]+$/.test(key)) {
        validUpdates[key] = updates[key];
      }
    });

    try {
      const serviceAccountStr = localStorage.getItem('service_account_json');
      if (!serviceAccountStr) return;

      const res = await fetch('/api/sheet/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceAccount: JSON.parse(serviceAccountStr),
          updates: [{
            rowIndex: currentItem.row_index,
            values: validUpdates
          }]
        })
      });
      const json = await res.json();
      if (json.success) {
        console.log('Spreadsheet updated successfully:', json.message);
      } else {
        console.error('Spreadsheet update failed:', json.message);
      }
    } catch (e) {
      console.error('Error updating spreadsheet:', e);
    }
  };


  const handleTerima = async () => {
    // Status 2 = Terima
    await submitApproval(2, '');
  };
  const handleTolak = async () => {
    // Status 3 = Tolak
    const note = customReason || 'Ditolak';
    await submitApproval(3, note);
  };
  const handleSkip = (skipped: boolean) => setCurrentTaskIndex(prev => prev + 1);
  const handleLoginSuccess = () => { setIsAuthenticated(true); if (localStorage.getItem('service_account_json')) setHasServiceAccount(true); };
  const handleUploadSuccess = () => setHasServiceAccount(true);

  const rotateImage = (dir: 'left' | 'right') => setImageRotation(p => dir === 'right' ? (p + 90) : (p - 90));

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Login onLoginSuccess={handleLoginSuccess} />;
  if (!hasServiceAccount) return <ServiceAccountUpload onUploadSuccess={handleUploadSuccess} />;

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-black overflow-hidden relative">
      {/* Sidebar */}
      <div className="flex-shrink-0 h-full">
        <Sidebar
          pendingCount={sheetData.length - currentTaskIndex}
          handleTerima={handleTerima}
          handleTolak={handleTolak}
          handleSkip={handleSkip}
          isSubmitting={isSubmitting}
          evaluationForm={evaluationForm}
          setEvaluationForm={setEvaluationForm}
          customReason={customReason}
          setCustomReason={setCustomReason}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 h-full overflow-y-auto p-4 md:p-6 bg-zinc-50/50 dark:bg-zinc-900/50">
        {parsedData && !detailLoading ? (
          <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-20">

            {/* Header Info Parsed */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 border-b dark:border-zinc-700 pb-2">Informasi Sekolah</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
                <InfoItem label="NPSN" value={parsedData.school.npsn} />
                <InfoItem label="Nama Sekolah" value={parsedData.school.nama_sekolah} />
                <InfoItem label="Kecamatan" value={parsedData.school.kecamatan} />
                <InfoItem label="Kabupaten/Kota" value={parsedData.school.kabupaten} />
                <InfoItem label="Provinsi" value={parsedData.school.provinsi} />
                <InfoItem label="Alamat" value={parsedData.school.alamat} full />
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 border-b dark:border-zinc-700 pb-2">Data Barang</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                <InfoItem label="Nama Barang" value={parsedData.item.nama_barang} />
                <InfoItem label="Serial Number" value={parsedData.item.serial_number} />
              </div>
            </div>

            {/* Image Gallery */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 border-b dark:border-zinc-700 pb-2">Dokumentasi Pengiriman</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {parsedData.images.map((img, idx) => (
                  <div key={idx} className="group relative cursor-pointer" onClick={() => { setCurrentImageIndex(idx); setImageRotation(0); }}>
                    <div className="aspect-square w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900">
                      <img src={img.src} alt={img.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <p className="mt-2 text-xs font-medium text-center text-zinc-600 dark:text-zinc-400 truncate">{img.title}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            {detailLoading ? 'Loading task data...' : (sheetData.length === 0 ? 'Fetching task list...' : 'All tasks completed!')}
          </div>
        )}
      </div>

      {/* Layout for Image Viewer Modal */}
      {currentImageIndex !== null && parsedData && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
          onClick={() => setCurrentImageIndex(null)}
        >
          {/* Sticky Info */}
          <StickyInfoBox schoolData={parsedData.school} itemData={parsedData.item} date={verificationDate} setDate={setVerificationDate} />

          {/* Toolbar */}
          <div className="absolute top-4 right-4 z-[60] flex gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => rotateImage('left')} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full font-bold transition-colors">↺</button>
            <button onClick={() => rotateImage('right')} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full font-bold transition-colors">↻</button>
            <button onClick={() => setCurrentImageIndex(null)} className="bg-red-500/80 hover:bg-red-600 text-white px-4 py-2 rounded-full font-bold transition-colors">✕</button>
          </div>

          {/* Main Image Area */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <TransformWrapper key={currentImageIndex + '-' + imageRotation} initialScale={1} centerOnInit>
              <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                <img
                  src={parsedData.images[currentImageIndex].src}
                  alt="Preview"
                  style={{ transform: `rotate(${imageRotation}deg)`, maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }}
                  className="rounded shadow-2xl transition-transform duration-200"
                />
              </TransformComponent>
            </TransformWrapper>
          </div>

          {/* Navigation Arrows */}
          <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex((currentImageIndex - 1 + parsedData.images.length) % parsedData.images.length); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-6xl transition-colors p-4">‹</button>
          <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex((currentImageIndex + 1) % parsedData.images.length); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-6xl transition-colors p-4">›</button>

          {/* Caption */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full text-white font-medium backdrop-blur-md">
            {parsedData.images[currentImageIndex].title} ({currentImageIndex + 1} / {parsedData.images.length})
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, full }: { label: string, value: string, full?: boolean }) {
  return (
    <div className={`flex flex-col ${full ? 'col-span-full' : ''}`}>
      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">{label}</span>
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded border border-zinc-200 dark:border-zinc-700/50 block min-h-[38px]">{value || '-'}</span>
    </div>
  );
}
