import React, { useState, useEffect, useRef } from 'react';
import { db, collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, handleFirestoreError, OperationType } from '../firebase';
import { supabase, SUPABASE_BUCKET } from '../supabase';
import { X, Upload, File, Image as ImageIcon, Trash2, ExternalLink, Loader2, Paperclip, Camera, Check, RefreshCw, Edit2, Eye, Download, AlertTriangle, User, Calendar, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FileData, UserProfile } from '../App';
import ConfirmationModal from './ConfirmationModal';

interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: any;
  storagePath?: string;
}

interface AttachmentManagerProps {
  file: FileData;
  user: any;
  userProfile: UserProfile | null;
  onClose: () => void;
  isDetailView?: boolean;
}

export default function AttachmentManager({ file, user, userProfile, onClose, isDetailView = false }: AttachmentManagerProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const isAdmin = userProfile?.role === 'admin' || user?.email === 'team@sathibazar.in' || user?.email === 'vibhuti.11.shaha@gmail.com';
  const isMonitor = userProfile?.role === 'monitor';
  const canUpload = isAdmin || isMonitor;

  useEffect(() => {
    const q = collection(db, `files/${file.id}/attachments`);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attachment));
      setAttachments(data.sort((a, b) => b.uploadedAt?.seconds - a.uploadedAt?.seconds));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `files/${file.id}/attachments`);
    });
    return () => unsubscribe();
  }, [file.id]);

  const uploadFile = async (selectedFile: File | Blob, fileName: string, fileType: string) => {
    if (!user) return;
    try {
      const timestamp = Date.now();
      const storagePath = `${file.id}/${timestamp}_${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(storagePath);

      const attachmentData = {
        name: fileName,
        type: fileType,
        url: publicUrl,
        size: selectedFile.size,
        storagePath: storagePath,
        uploadedBy: user.uid,
        uploadedByName: user.displayName || user.email || 'User',
        uploadedAt: serverTimestamp(),
      };

      const attachmentRef = doc(collection(db, `files/${file.id}/attachments`));
      await setDoc(attachmentRef, attachmentData);
    } catch (error: any) {
      console.error('Detailed error in uploadFile:', error);
      setError(error.message || 'Unknown error during upload');
      throw error;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const f = selectedFiles[i];
        await uploadFile(f, f.name, f.type);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload some files.');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
      setCapturedImage(null);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setCapturedImage(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleCameraUpload = async () => {
    if (!capturedImage) return;
    setUploading(true);
    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      await uploadFile(blob, `camera_capture_${Date.now()}.jpg`, 'image/jpeg');
      stopCamera();
    } catch (error) {
      console.error('Camera upload error:', error);
      setError('Failed to upload captured image.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachment: Attachment) => {
    if (!isAdmin) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'Delete Attachment',
      message: `Are you sure you want to delete "${attachment.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, `files/${file.id}/attachments`, attachment.id));
          if (attachment.storagePath) {
            await supabase.storage.from(SUPABASE_BUCKET).remove([attachment.storagePath]);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `files/${file.id}/attachments/${attachment.id}`);
        }
      },
      type: 'danger'
    });
  };

  const handleRename = async (attachment: Attachment) => {
    if (!editName.trim() || editName === attachment.name) {
      setEditingId(null);
      return;
    }

    try {
      const { updateDoc: updateFirestoreDoc } = await import('../firebase');
      await updateFirestoreDoc(doc(db, `files/${file.id}/attachments`, attachment.id), {
        name: editName.trim()
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `files/${file.id}/attachments/${attachment.id}`);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download file.');
    }
  };

  const renderContent = () => {
    const filteredAttachments = attachments.filter(a => 
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-2xl font-serif font-medium text-stone-900">{file.name}</h4>
            <p className="text-stone-400 text-xs uppercase tracking-widest font-bold mt-1">Attachments & Documents</p>
          </div>
          {!isDetailView && (
            <button 
              onClick={onClose}
              className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input 
            type="text"
            placeholder="Search attachments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-50 border border-stone-100 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2">
          {attachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-stone-300 space-y-3">
              <Paperclip className="w-12 h-12 opacity-20" />
              <p className="font-serif italic">No attachments yet.</p>
            </div>
          ) : filteredAttachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-stone-300 space-y-3">
              <Search className="w-12 h-12 opacity-20" />
              <p className="font-serif italic">No attachments match your search.</p>
            </div>
          ) : (
            <div className={isDetailView ? "divide-y divide-stone-50" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
              {filteredAttachments.map((attachment) => (
              <div 
                key={attachment.id} 
                className={isDetailView 
                  ? "py-6 flex items-center gap-6 group" 
                  : "bg-stone-50 border border-stone-100 rounded-2xl p-4 flex items-center gap-4 group hover:border-stone-200 transition-all"
                }
              >
                <div 
                  className={isDetailView 
                    ? "w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center shrink-0 shadow-sm text-stone-400 cursor-pointer hover:bg-stone-200 transition-colors"
                    : "w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-stone-400 cursor-pointer hover:bg-stone-50 transition-colors"
                  }
                  onClick={() => setPreviewUrl(attachment.url)}
                >
                  {attachment.type.startsWith('image/') ? (
                    <ImageIcon className={isDetailView ? "w-8 h-8" : "w-5 h-5"} />
                  ) : (
                    <File className={isDetailView ? "w-8 h-8" : "w-5 h-5"} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  {editingId === attachment.id ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 bg-white border border-stone-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleRename(attachment)}
                      />
                      <button onClick={() => handleRename(attachment)} className="text-emerald-600 p-1">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-stone-400 p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <p className={isDetailView ? "text-lg font-serif font-medium text-stone-900 truncate" : "text-sm font-medium text-stone-900 truncate"} title={attachment.name}>{attachment.name}</p>
                        {(isAdmin || (isMonitor && attachment.uploadedBy === user.uid)) && (
                          <button 
                            onClick={() => {
                              setEditingId(attachment.id);
                              setEditName(attachment.name);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-stone-900 transition-all"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-stone-400" />
                          <p className="text-[11px] text-stone-500 uppercase tracking-widest font-bold">By {attachment.uploadedByName}</p>
                        </div>
                        <span className="w-1 h-1 bg-stone-200 rounded-full" />
                        <div className="flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5 text-stone-400" />
                          <p className="text-[11px] text-stone-500 uppercase tracking-widest font-bold">{formatFileSize(attachment.size)}</p>
                        </div>
                        <span className="w-1 h-1 bg-stone-200 rounded-full" />
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          <p className="text-[11px] text-stone-500 uppercase tracking-widest font-bold">
                            {attachment.uploadedAt?.toDate?.() ? attachment.uploadedAt.toDate().toLocaleDateString() : 'Recently'}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPreviewUrl(attachment.url)}
                    className="p-2.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all"
                    title="Preview"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDownload(attachment.url, attachment.name)}
                    className="p-2.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => handleDeleteAttachment(attachment)}
                      className="p-2.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canUpload && (
        <div className="pt-6 border-t border-stone-100 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <label className="relative flex items-center justify-center gap-3 bg-stone-900 text-white py-4 rounded-2xl font-medium cursor-pointer hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10 overflow-hidden">
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>Upload Files</span>
                </>
              )}
              <input 
                type="file" 
                className="hidden" 
                onChange={handleFileUpload}
                disabled={uploading}
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
            </label>
            <button 
              onClick={startCamera}
              disabled={uploading}
              className="flex items-center justify-center gap-3 bg-stone-100 text-stone-900 py-4 rounded-2xl font-medium hover:bg-stone-200 transition-all border border-stone-200"
            >
              <Camera className="w-5 h-5" />
              <span>Use Camera</span>
            </button>
          </div>
          <p className="text-center text-[10px] text-stone-400 uppercase tracking-widest font-bold">
            Multiple files supported • Images, PDF, Word, Text
          </p>
        </div>
      )}
    </>
    );
  };

  if (isDetailView) {
    return (
      <div className="relative">
        {renderContent()}
        {/* Preview Modal */}
        <AnimatePresence>
          {previewUrl && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/90 backdrop-blur-md"
              onClick={() => setPreviewUrl(null)}
            >
              <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                <button 
                  onClick={() => setPreviewUrl(null)}
                  className="absolute -top-12 right-0 p-2 text-white hover:text-stone-300 transition-colors"
                >
                  <X className="w-8 h-8" />
                </button>
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Preview+Not+Available';
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Camera Modal */}
        <AnimatePresence>
          {isCameraOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black p-4"
            >
              <div className="relative w-full max-w-lg aspect-[3/4] bg-stone-900 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                <div className="flex-1 relative">
                  {!capturedImage ? (
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      src={capturedImage} 
                      alt="Captured" 
                      className="w-full h-full object-cover"
                    />
                  )}
                  
                  <button 
                    onClick={stopCamera}
                    className="absolute top-6 right-6 p-3 bg-black/50 backdrop-blur-md text-white rounded-full hover:bg-black/70 transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-8 bg-stone-900 flex items-center justify-center gap-8">
                  {!capturedImage ? (
                    <button 
                      onClick={capturePhoto}
                      className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform active:scale-95 shadow-xl"
                    >
                      <div className="w-16 h-16 border-4 border-stone-900 rounded-full" />
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => setCapturedImage(null)}
                        className="flex flex-col items-center gap-2 text-white/60 hover:text-white transition-colors"
                      >
                        <div className="p-4 bg-white/10 rounded-full">
                          <RefreshCw className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] uppercase tracking-widest font-bold">Retake</span>
                      </button>
                      <button 
                        onClick={handleCameraUpload}
                        disabled={uploading}
                        className="flex flex-col items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <div className="p-6 bg-emerald-500/20 rounded-full">
                          {uploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Check className="w-8 h-8" />}
                        </div>
                        <span className="text-[10px] uppercase tracking-widest font-bold">Upload</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmationModal 
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
        />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {renderContent()}
        
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-24 left-8 right-8 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-xs flex items-center justify-between z-50"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)}>
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview Modal (Nested) */}
        <AnimatePresence>
          {previewUrl && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/90 backdrop-blur-md"
              onClick={() => setPreviewUrl(null)}
            >
              <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                <button 
                  onClick={() => setPreviewUrl(null)}
                  className="absolute -top-12 right-0 p-2 text-white hover:text-stone-300 transition-colors"
                >
                  <X className="w-8 h-8" />
                </button>
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Preview+Not+Available';
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Camera Modal (Nested) */}
        <AnimatePresence>
          {isCameraOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black p-4"
            >
              <div className="relative w-full max-w-lg aspect-[3/4] bg-stone-900 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                <div className="flex-1 relative">
                  {!capturedImage ? (
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      src={capturedImage} 
                      alt="Captured" 
                      className="w-full h-full object-cover"
                    />
                  )}
                  
                  <button 
                    onClick={stopCamera}
                    className="absolute top-6 right-6 p-3 bg-black/50 backdrop-blur-md text-white rounded-full hover:bg-black/70 transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-8 bg-stone-900 flex items-center justify-center gap-8">
                  {!capturedImage ? (
                    <button 
                      onClick={capturePhoto}
                      className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform active:scale-95 shadow-xl"
                    >
                      <div className="w-16 h-16 border-4 border-stone-900 rounded-full" />
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => setCapturedImage(null)}
                        className="flex flex-col items-center gap-2 text-white/60 hover:text-white transition-colors"
                      >
                        <div className="p-4 bg-white/10 rounded-full">
                          <RefreshCw className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] uppercase tracking-widest font-bold">Retake</span>
                      </button>
                      <button 
                        onClick={handleCameraUpload}
                        disabled={uploading}
                        className="flex flex-col items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <div className="p-6 bg-emerald-500/20 rounded-full">
                          {uploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Check className="w-8 h-8" />}
                        </div>
                        <span className="text-[10px] uppercase tracking-widest font-bold">Upload</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmationModal 
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
        />
      </motion.div>
    </motion.div>
  );
}
