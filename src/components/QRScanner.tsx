import { Html5Qrcode } from "html5-qrcode";
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { db, doc, getDoc, updateDoc, serverTimestamp, handleFirestoreError, OperationType, collection, query, where, getDocs, setDoc, orderBy, limit } from '../firebase';
import { Camera, RefreshCcw, X, CheckCircle2, AlertCircle, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FileData, UserProfile, FilterOption } from '../App';
import { cn } from '../lib/utils';

export default function QRScanner({ user, userProfile, filterOptions, onComplete }: { user: any, userProfile: UserProfile | null, filterOptions: FilterOption[], onComplete: () => void }) {
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [scannedFile, setScannedFile] = useState<FileData | null>(null);
  
  // Use a ref to prevent multiple scans from triggering simultaneously
  const isProcessingRef = useRef(false);
  const processCheckout = useCallback(async (scannedValue: string, company?: string) => {
    setStatus('processing');
    setScanning(false); // Stop camera once processing starts
    try {
      let fileDoc: any = null;

      if (company) {
        // Manual entry with company
        const q = query(
          collection(db, 'files'), 
          where('fileIdNo', '==', scannedValue),
          where('company', '==', company)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          fileDoc = querySnapshot.docs[0];
        }
      } else {
        // Try to get by Firestore ID first (for QR codes that might use doc ID)
        const docRef = doc(db, 'files', scannedValue);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          fileDoc = docSnap;
        } else {
          // If not found, try to query by fileIdNo
          const q = query(collection(db, 'files'), where('fileIdNo', '==', scannedValue));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            fileDoc = querySnapshot.docs[0];
          }
        }
      }

      if (!fileDoc || !fileDoc.exists()) {
        setStatus('error');
        setMessage(company 
          ? `File ID "${scannedValue}" not found for company "${company}".`
          : 'Invalid QR code. File not found in library.'
        );
        return;
      }

      const fileData = { id: fileDoc.id, ...fileDoc.data() } as FileData;
      setScannedFile(fileData);

      if (fileData.status === 'checked-out') {
        const isMonitor = userProfile?.role === 'monitor';
        const isAdminRole = userProfile?.role === 'admin' || user?.email === 'team@sathibazar.in' || user?.email === 'vibhuti.11.shaha@gmail.com';
        const isAssignedMonitor = isMonitor && fileData.fileMonitorId === user.email;

        if (isAdminRole || isAssignedMonitor) {
          // Authorized to return
          await updateDoc(doc(db, 'files', fileDoc.id), {
            status: 'available',
            checkedOutBy: null,
            checkedOutByName: null,
            activeHistoryId: null,
            lastUpdated: serverTimestamp()
          });

          // Record return in history
          if (fileData.activeHistoryId) {
            try {
              await updateDoc(doc(db, `files/${fileDoc.id}/history`, fileData.activeHistoryId), {
                returnTimestamp: serverTimestamp(),
                returnedBy: user.uid,
                returnedByName: user.displayName || user.email || 'User'
              });
              console.log('Return history recorded successfully');
            } catch (historyError) {
              console.error('Failed to record return history:', historyError);
            }
          }

          setStatus('success');
          setMessage(`Successfully returned "${fileData.name}" to library.`);
        } else if (isMonitor) {
          // Monitor but not the assigned one
          setStatus('error');
          setMessage(`You are not authorized to return this file. Only the assigned File Monitor or an Admin can return it.`);
        } else {
          // Regular users
          if (fileData.checkedOutBy === user.uid) {
            // User trying to return their own file
            setStatus('error');
            setMessage(`Only the assigned File Monitor or an Admin can return files to the library.`);
          } else {
            // User checking out a file that was with someone else
            const historyRef = doc(collection(db, `files/${fileDoc.id}/history`));
            await updateDoc(doc(db, 'files', fileDoc.id), {
              status: 'checked-out',
              checkedOutBy: user.uid,
              checkedOutByName: user.displayName || user.email || 'User',
              activeHistoryId: historyRef.id,
              lastUpdated: serverTimestamp()
            });
            
            // Record history
            try {
              await setDoc(historyRef, {
                userId: user.uid,
                userName: user.displayName || user.email || 'User',
                checkoutTimestamp: serverTimestamp()
              });
              console.log('Checkout history recorded successfully');
            } catch (historyError) {
              console.error('Failed to record checkout history:', historyError);
              handleFirestoreError(historyError, OperationType.CREATE, `files/${fileDoc.id}/history`);
            }
            
            setStatus('success');
            setMessage(`"${fileData.name}" is now checked out by you.`);
          }
        }
      } else {
        // Available, anyone can check it out
        const historyRef = doc(collection(db, `files/${fileDoc.id}/history`));
        await updateDoc(doc(db, 'files', fileDoc.id), {
          status: 'checked-out',
          checkedOutBy: user.uid,
          checkedOutByName: user.displayName || user.email || 'User',
          activeHistoryId: historyRef.id,
          lastUpdated: serverTimestamp()
        });
        
        // Record history
        try {
          await setDoc(historyRef, {
            userId: user.uid,
            userName: user.displayName || user.email || 'User',
            checkoutTimestamp: serverTimestamp()
          });
          console.log('Checkout history recorded successfully');
        } catch (historyError) {
          console.error('Failed to record checkout history:', historyError);
          handleFirestoreError(historyError, OperationType.CREATE, `files/${fileDoc.id}/history`);
        }
        
        setStatus('success');
        setMessage(`Successfully checked out "${fileData.name}"`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `files/${scannedValue}`);
    }
  }, [user, userProfile]);
useEffect(() => {
  if (!scanning) return;

  const qrCodeScanner = new Html5Qrcode("reader");

  qrCodeScanner.start(
    { facingMode: "environment" },
    {
      fps: 5,
      qrbox: { width: 250, height: 250 }
    },
    (decodedText) => {
      if (!isProcessingRef.current) {
        isProcessingRef.current = true;
        setResult(decodedText);
        processCheckout(decodedText);
        qrCodeScanner.stop().catch(() => {});
      }
    },
    () => {}
  );

  return () => {
  try {
    qrCodeScanner.stop().catch(() => {});
  } catch {}
};
}, [scanning, processCheckout]);
  const companies = useMemo(() => 
    filterOptions.filter(opt => opt.category === 'company').map(opt => opt.value),
  [filterOptions]);

  // Memoize constraints to prevent camera glitching/restarts on re-render
  const constraints = useMemo(() => ({ 
    facingMode: 'environment',
    width: { min: 640, ideal: 1280 },
    height: { min: 480, ideal: 720 }
  }), []);
  const [manualId, setManualId] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [showManual, setShowManual] = useState(false);

  const handleManualSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim() && manualCompany) {
      setScanning(false);
      setResult(manualId.trim());
      processCheckout(manualId.trim(), manualCompany);
    }
  }, [manualId, manualCompany, processCheckout]);

  const handleError = useCallback((err: any) => {
    console.error(err);
    setStatus('error');
    setMessage('Could not access camera. Please check permissions.');
  }, []);

  const resetScanner = () => {
    isProcessingRef.current = false;
    setScanning(true);
    setResult(null);
    setStatus('idle');
    setMessage('');
    setScannedFile(null);
    setManualId('');
    setManualCompany('');
  };

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-serif font-medium text-stone-900">Scan QR Code</h2>
        <p className="text-stone-500">Point your camera at a file's QR code</p>
      </div>

      <div className="relative aspect-square bg-stone-900 rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white">
        {scanning ? (
          <>
            <div className="flex items-center justify-center h-full text-white">
  <div id="reader" className="w-full h-full"></div>
</div>
            {/* Scanning Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-12 border-2 border-white/50 rounded-3xl">
                <motion.div 
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
            <AnimatePresence mode="wait">
              {status === 'processing' && (
                <motion.div 
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-4"
                >
                  <RefreshCcw className="w-12 h-12 text-stone-400 animate-spin" />
                  <p className="text-stone-500 font-medium">Processing...</p>
                </motion.div>
              )}
              {status === 'success' && (
                <motion.div 
                  key="success"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-4 p-8 text-center"
                >
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-serif font-medium text-stone-900">Success!</h3>
                  <p className="text-stone-600 leading-relaxed">{message}</p>
                </motion.div>
              )}
              {status === 'error' && (
                <motion.div 
                  key="error"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-4 p-8 text-center"
                >
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-2">
                    <AlertCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h3 className="text-xl font-serif font-medium text-stone-900">Scan Failed</h3>
                  <p className="text-stone-600 leading-relaxed">{message}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {scanning && !showManual && (
          <button 
            onClick={() => setShowManual(true)}
            className="w-full bg-stone-100 text-stone-600 py-4 rounded-2xl font-medium hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
          >
            <Edit2 className="w-5 h-5" />
            Enter File ID Manually
          </button>
        )}

        {scanning && showManual && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Company</label>
              <select 
                value={manualCompany}
                onChange={(e) => setManualCompany(e.target.value)}
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all appearance-none cursor-pointer"
              >
                <option value="">Select Company</option>
                {companies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">File ID</label>
              <input 
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="Enter File ID (e.g., abc-123)"
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                type="submit"
                disabled={!manualId.trim() || !manualCompany}
                className={cn(
                  "flex-1 py-4 rounded-2xl font-medium transition-all",
                  (!manualId.trim() || !manualCompany)
                    ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                    : "bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-900/10"
                )}
              >
                Submit
              </button>
              <button 
                type="button"
                onClick={() => {
                  setShowManual(false);
                  setManualId('');
                  setManualCompany('');
                }}
                className="px-6 py-4 border border-stone-200 text-stone-500 rounded-2xl font-medium hover:bg-stone-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {!scanning && (
          <button 
            onClick={() => {
              resetScanner();
              setShowManual(false);
              setManualId('');
            }}
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-medium hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10 flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            Scan Another
          </button>
        )}
        <button 
          onClick={onComplete}
          className="w-full bg-white border border-stone-200 text-stone-600 py-4 rounded-2xl font-medium hover:bg-stone-50 transition-all flex items-center justify-center gap-2"
        >
          <Library className="w-5 h-5" />
          Back to Library
        </button>
      </div>
    </div>
  );
}

function Library({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m16 6 4 14" />
      <path d="M12 6v14" />
      <path d="M8 8v12" />
      <path d="M4 4v16" />
    </svg>
  );
}
