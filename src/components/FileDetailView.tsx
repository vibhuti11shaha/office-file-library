import React, { useState, useEffect, useRef } from 'react';
import { db, doc, getDoc, collection, query, where, onSnapshot, handleFirestoreError, OperationType, orderBy, limit } from '../firebase';
import { FileData, UserProfile } from '../App';
import { ArrowLeft, Calendar, User, Paperclip, FileText, Download, Eye, Edit2, Check, X, History, Clock, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AttachmentManager from './AttachmentManager';

interface CheckoutHistory {
  id: string;
  userId: string;
  userName: string;
  checkoutTimestamp: any;
  returnTimestamp?: any;
  returnedByName?: string;
}

interface FileDetailViewProps {
  fileId: string;
  user: any;
  userProfile: UserProfile | null;
  onBack: () => void;
  scrollToHistory?: boolean;
}

export default function FileDetailView({ fileId, user, userProfile, onBack, scrollToHistory }: FileDetailViewProps) {
  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<CheckoutHistory[]>([]);
  const historyRef = useRef<HTMLDivElement>(null);
  
  const isAdminOrMonitor = userProfile?.role === 'admin' || userProfile?.role === 'monitor' || user?.email === 'team@sathibazar.in' || user?.email === 'vibhuti.11.shaha@gmail.com';

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const docRef = doc(db, 'files', fileId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFile({ id: docSnap.id, ...docSnap.data() } as FileData);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `files/${fileId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
  }, [fileId]);

  useEffect(() => {
    if (!isAdminOrMonitor) return;

    const historyRef = collection(db, `files/${fileId}/history`);
    // Filter for last 15 days
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    
    const q = query(
      historyRef, 
      where('checkoutTimestamp', '>=', fifteenDaysAgo),
      orderBy('checkoutTimestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`Fetched ${snapshot.docs.length} history records for file ${fileId}`);
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CheckoutHistory));
      setHistory(historyData);
    }, (error) => {
      console.error('Error fetching history:', error);
      handleFirestoreError(error, OperationType.LIST, `files/${fileId}/history`);
    });

    return () => unsubscribe();
  }, [fileId, isAdminOrMonitor]);

  useEffect(() => {
    if (scrollToHistory && !loading && isAdminOrMonitor) {
      // Use a longer timeout to ensure the entry animation in App.tsx is complete
      // and the DOM is fully settled.
      const timer = setTimeout(() => {
        if (historyRef.current) {
          const headerOffset = 100; // Offset for the sticky header
          const elementPosition = historyRef.current.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [scrollToHistory, loading, isAdminOrMonitor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900"></div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-500">File not found.</p>
        <button onClick={onBack} className="mt-4 text-stone-900 font-medium flex items-center gap-2 mx-auto">
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Back to Library</span>
      </button>

      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-stone-100 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-serif font-medium text-stone-900">{file.name}</h2>
              <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-lg text-sm font-mono font-bold">
                #{file.fileIdNo}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-stone-500">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Added {file.createdAt?.toDate ? file.createdAt.toDate().toLocaleDateString() : 'Recently'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>Uploaded by {file.createdBy || 'System'}</span>
              </div>
              <div className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full text-xs font-medium">
                {file.fileType}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-widest ${
              file.status === 'available' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {file.status}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-stone-50 pt-8">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Company</span>
            <p className="text-stone-900 font-medium">{file.company}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Year</span>
            <p className="text-stone-900 font-medium">{file.year}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Location</span>
            <p className="text-stone-900 font-medium">{file.location}</p>
          </div>
          {isAdminOrMonitor && file.fileMonitor && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">File Monitor</span>
              <p className="text-stone-900 font-medium">{file.fileMonitor}</p>
            </div>
          )}
          {isAdminOrMonitor && file.fileMonitorId && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">File Monitor ID</span>
              <p className="text-stone-900 font-medium">{file.fileMonitorId}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-stone-100">
        <div className="flex items-center gap-3 mb-8">
          <Paperclip className="w-6 h-6 text-stone-900" />
          <h3 className="text-xl font-serif font-medium text-stone-900">Attachments</h3>
        </div>
        
        <AttachmentManager 
          file={file} 
          user={user} 
          userProfile={userProfile}
          onClose={() => {}} 
          isDetailView={true}
        />
      </div>

      {isAdminOrMonitor && (
        <div ref={historyRef} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-stone-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-stone-900" />
              <h3 className="text-xl font-serif font-medium text-stone-900">Checkout History</h3>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 bg-stone-50 px-3 py-1 rounded-full">
              Last 15 Days
            </span>
          </div>
          
          <div className="space-y-4">
            {history.length > 0 ? (
              <div className="divide-y divide-stone-50">
                {history.map((entry) => (
                  <div key={entry.id} className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-stone-50 rounded-full flex items-center justify-center text-stone-400 group-hover:bg-stone-900 group-hover:text-white transition-colors shrink-0">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-stone-900">{entry.userName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Checked Out</span>
                          <div className="flex items-center gap-1.5 text-stone-400">
                            <Clock className="w-3 h-3" />
                            <span className="text-xs">
                              {entry.checkoutTimestamp?.toDate ? entry.checkoutTimestamp.toDate().toLocaleString([], { 
                                month: 'short', 
                                day: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              }) : 'Just now'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {entry.returnTimestamp ? (
                      <div className="flex flex-col sm:items-end pl-16 sm:pl-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Returned</span>
                          <div className="flex items-center gap-1.5 text-stone-400">
                            <Clock className="w-3 h-3" />
                            <span className="text-xs">
                              {entry.returnTimestamp?.toDate ? entry.returnTimestamp.toDate().toLocaleString([], { 
                                month: 'short', 
                                day: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              }) : 'N/A'}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-stone-400">
                          by <span className="font-medium text-stone-600">{entry.returnedByName || 'System'}</span>
                        </p>
                      </div>
                    ) : (
                      <div className="pl-16 sm:pl-0">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-300 border border-stone-100 px-3 py-1 rounded-full">
                          Still Out
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-stone-50 rounded-3xl border border-dashed border-stone-200">
                <History className="w-8 h-8 text-stone-200 mx-auto mb-3" />
                <p className="text-stone-400 text-sm italic">No checkout history for the past 15 days.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
