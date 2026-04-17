import React, { useState } from 'react';
import { FileData, FilterOption, UserProfile } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { Library, Filter, X, QrCode, User, CheckCircle2, AlertCircle, Download, MapPin, Tag, Hash, Building2, Calendar, Paperclip, History } from 'lucide-react';
import { db, doc, updateDoc, serverTimestamp, handleFirestoreError, OperationType, collection, setDoc, query, where, orderBy, limit, getDocs } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '../lib/utils';
import AttachmentManager from './AttachmentManager';

interface FileListProps {
  files: FileData[];
  user: any;
  userProfile: UserProfile | null;
  filterOptions: FilterOption[];
  filters: {
    fileType: string;
    company: string;
    year: string;
  };
  setFilters: React.Dispatch<React.SetStateAction<{
    fileType: string;
    company: string;
    year: string;
  }>>;
  onFileClick?: (fileId: string, scrollToHistory?: boolean) => void;
}

export default function FileList({ files, user, userProfile, filterOptions, filters, setFilters, onFileClick }: FileListProps) {
  const [selectedFileForQR, setSelectedFileForQR] = useState<FileData | null>(null);
  const [selectedFileForAttachments, setSelectedFileForAttachments] = useState<FileData | null>(null);
  const hasActiveFilters = filters.fileType || filters.company || filters.year;
  const isAdmin = userProfile?.role === 'admin' || user?.email === 'team@sathibazar.in' || user?.email === 'vibhuti.11.shaha@gmail.com';

  const clearFilters = () => {
    setFilters({ fileType: '', company: '', year: '' });
  };

  const toggleStatus = async (file: FileData) => {
    const isCheckedOut = file.status === 'checked-out';
    const isMonitor = userProfile?.role === 'monitor';
    const isAdminRole = userProfile?.role === 'admin' || user?.email === 'team@sathibazar.in' || user?.email === 'vibhuti.11.shaha@gmail.com';
    const isAssignedMonitor = isMonitor && file.fileMonitorId === user.email;

    if (isCheckedOut && !isAdminRole && !isAssignedMonitor) return;

    try {
      if (isCheckedOut) {
        await updateDoc(doc(db, 'files', file.id), {
          status: 'available',
          checkedOutBy: null,
          checkedOutByName: null,
          activeHistoryId: null,
          lastUpdated: serverTimestamp()
        });

        // Record return in history
        if (file.activeHistoryId) {
          try {
            await updateDoc(doc(db, `files/${file.id}/history`, file.activeHistoryId), {
              returnTimestamp: serverTimestamp(),
              returnedBy: user.uid,
              returnedByName: user.displayName || user.email || 'User'
            });
            console.log('Return history recorded successfully');
          } catch (historyError) {
            console.error('Failed to record return history:', historyError);
          }
        }
      } else {
        const fileRef = doc(db, 'files', file.id);
        const historyRef = doc(collection(db, `files/${file.id}/history`));
        
        await updateDoc(fileRef, {
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
          handleFirestoreError(historyError, OperationType.CREATE, `files/${file.id}/history`);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `files/${file.id}`);
    }
  };

  const downloadQR = (file: FileData) => {
    const svg = document.getElementById(`qr-${file.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR-${file.name}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  return (
    <div className="space-y-8">
      {/* Filters UI */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-stone-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-stone-900 font-serif font-medium">
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </div>
          {hasActiveFilters && (
            <button 
              onClick={clearFilters}
              className="text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear All
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(['fileType', 'company', 'year'] as const).map(category => (
            <div key={category} className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">
                {category === 'fileType' ? 'Type' : category === 'company' ? 'Company' : 'Year'}
              </label>
              <select 
                value={filters[category]}
                onChange={(e) => setFilters(prev => ({ ...prev, [category]: e.target.value }))}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all appearance-none cursor-pointer"
              >
                <option value="">All {category === 'fileType' ? 'Types' : category === 'company' ? 'Companies' : 'Years'}</option>
                {filterOptions.filter(o => o.category === category).map(o => (
                  <option key={o.id} value={o.value}>{o.value}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-stone-400 space-y-4">
          <Library className="w-12 h-12 opacity-20" />
          <p className="font-serif italic">No files found matching your criteria.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] shadow-sm border border-stone-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
              <thead>
                <tr className="bg-stone-50/50 text-[10px] uppercase tracking-widest font-bold text-stone-400">
                  <th className="px-6 py-5">File Name</th>
                  <th className="px-4 py-5">ID No.</th>
                  <th className="px-4 py-5">Type</th>
                  <th className="px-4 py-5">Company</th>
                  <th className="px-4 py-5">Year</th>
                  <th className="px-4 py-5">Location</th>
                  <th className="px-4 py-5">Status</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {files.map((file) => {
                  const isCheckedOut = file.status === 'checked-out';
                  const isOwner = file.checkedOutBy === user.uid;
                  const isMonitor = userProfile?.role === 'monitor';
                  const isAdminRole = userProfile?.role === 'admin' || user?.email === 'team@sathibazar.in' || user?.email === 'vibhuti.11.shaha@gmail.com';
                  const isAssignedMonitor = isMonitor && file.fileMonitorId === user.email;
                  const canReturn = isAdminRole || isAssignedMonitor;
                  
                  return (
                    <tr key={file.id} className="hover:bg-stone-50/30 transition-colors group">
                      <td className="px-6 py-5">
                        <button 
                          className="font-serif font-medium text-stone-900 hover:text-stone-600 transition-colors text-left focus:outline-none focus:underline"
                          onClick={() => onFileClick?.(file.id)}
                        >
                          {file.name}
                        </button>
                      </td>
                      <td className="px-4 py-5 text-sm text-stone-600 font-mono">{file.fileIdNo}</td>
                      <td className="px-4 py-5">
                        <span className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-md">{file.fileType}</span>
                      </td>
                      <td className="px-4 py-5 text-sm text-stone-600">{file.company}</td>
                      <td className="px-4 py-5 text-sm text-stone-600">{file.year}</td>
                      <td className="px-4 py-5">
                        <div className="flex items-center gap-1.5 text-stone-500 text-sm">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{file.location}</span>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        {isCheckedOut ? (
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-0.5">Checked Out</span>
                            <span className="text-xs text-stone-400 truncate max-w-[120px]" title={file.checkedOutByName}>by {file.checkedOutByName}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Available</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setSelectedFileForAttachments(file)}
                            className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                            title="Attachments"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setSelectedFileForQR(file)}
                            className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                            title="View QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          {(userProfile?.role === 'admin' || userProfile?.role === 'monitor' || user?.email === 'team@sathibazar.in' || user?.email === 'vibhuti.11.shaha@gmail.com') && (
                            <button 
                              onClick={() => onFileClick?.(file.id, true)}
                              className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                              title="Checkout History"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => toggleStatus(file)}
                            disabled={isCheckedOut && !canReturn}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-medium transition-all shadow-sm",
                              isCheckedOut 
                                ? (canReturn ? "bg-stone-900 text-white hover:bg-stone-800" : "bg-stone-100 text-stone-400 cursor-not-allowed")
                                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/10"
                            )}
                          >
                            {isCheckedOut ? (canReturn ? 'Return' : 'Taken') : 'Check Out'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attachment Manager Modal */}
      <AnimatePresence>
        {selectedFileForAttachments && (
          <AttachmentManager 
            file={selectedFileForAttachments} 
            user={user} 
            userProfile={userProfile}
            onClose={() => setSelectedFileForAttachments(null)} 
          />
        )}
      </AnimatePresence>

      {/* QR Code Modal Overlay */}
      <AnimatePresence>
        {selectedFileForQR && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm"
            onClick={() => setSelectedFileForQR(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl text-center"
              onClick={e => e.stopPropagation()}
            >
              <h4 className="text-2xl font-serif font-medium mb-2">{selectedFileForQR.name}</h4>
              <p className="text-stone-400 text-sm mb-8 uppercase tracking-widest font-bold">File QR Code</p>
              
              <div className="bg-stone-50 p-8 rounded-3xl mb-8 flex justify-center border border-stone-100">
                <QRCodeSVG 
                  id={`qr-${selectedFileForQR.id}`}
                  value={selectedFileForQR.fileIdNo} 
                  size={256}
                  level="M"
                  includeMargin={true}
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => downloadQR(selectedFileForQR)}
                  className="flex-1 bg-stone-900 text-white py-4 rounded-2xl font-medium hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download
                </button>
                <button 
                  onClick={() => setSelectedFileForQR(null)}
                  className="px-6 py-4 border border-stone-200 text-stone-500 rounded-2xl font-medium hover:bg-stone-50 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
