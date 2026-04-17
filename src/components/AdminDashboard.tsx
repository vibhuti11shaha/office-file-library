import React, { useState, useEffect } from 'react';
import { db, collection, setDoc, doc, serverTimestamp, updateDoc, deleteDoc, handleFirestoreError, OperationType, onSnapshot } from '../firebase';
import { Plus, Trash2, Edit2, MapPin, FileText, Check, X, Tag, Hash, Building2, Calendar, Filter, Search, Paperclip, History, User, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FileData, FilterOption, UserProfile } from '../App';
import AttachmentManager from './AttachmentManager';
import UserManagement from './UserManagement';
import ConfirmationModal from './ConfirmationModal';
import { cn } from '../lib/utils';

interface AdminDashboardProps {
  filterOptions: FilterOption[];
  user: any;
  userProfile: UserProfile | null;
  onFileClick?: (fileId: string, scrollToHistory?: boolean) => void;
}

export default function AdminDashboard({ filterOptions, user, userProfile, onFileClick }: AdminDashboardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [fileType, setFileType] = useState('');
  const [fileIdNo, setFileIdNo] = useState('');
  const [company, setCompany] = useState('');
  const [year, setYear] = useState('');
  const [location, setLocation] = useState('');
  const [fileMonitor, setFileMonitor] = useState('');
  const [fileMonitorId, setFileMonitorId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [files, setFiles] = useState<FileData[]>([]);
  const [selectedFileForAttachments, setSelectedFileForAttachments] = useState<FileData | null>(null);
  const [activeAdminTab, setActiveAdminTab] = useState<'files' | 'users' | 'filters'>('files');
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

  useEffect(() => {
    const q = collection(db, 'files');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const filesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileData));
      // Sort by fileIdNo in ascending order
      const sortedFiles = filesData.sort((a, b) => {
        return a.fileIdNo.localeCompare(b.fileIdNo, undefined, { numeric: true, sensitivity: 'base' });
      });
      setFiles(sortedFiles);
    });
    return () => unsubscribe();
  }, []);

  // Filter Option Management State
  const [newOptionValue, setNewOptionValue] = useState('');
  const [newOptionCategory, setNewOptionCategory] = useState<'fileType' | 'company' | 'year'>('fileType');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !fileType || !fileIdNo || !company || !year || !location) return;

    try {
      const fileData = {
        name,
        fileType,
        fileIdNo,
        company,
        year,
        location,
        fileMonitor,
        fileMonitorId,
        lastUpdated: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'files', editingId), fileData);
      } else {
        const newFileRef = doc(collection(db, 'files'));
        await setDoc(newFileRef, {
          ...fileData,
          status: 'available'
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, editingId ? `files/${editingId}` : 'files');
    }
  };

  const handleEdit = (file: FileData) => {
    setName(file.name);
    setFileType(file.fileType);
    setFileIdNo(file.fileIdNo);
    setCompany(file.company);
    setYear(file.year);
    setLocation(file.location);
    setFileMonitor(file.fileMonitor || '');
    setFileMonitorId(file.fileMonitorId || '');
    setEditingId(file.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteFile = async (id: string, fileName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete File',
      message: `Are you sure you want to delete "${fileName}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'files', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `files/${id}`);
        }
      },
      type: 'danger'
    });
  };

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptionValue) return;

    try {
      const newOptionRef = doc(collection(db, 'filterOptions'));
      await setDoc(newOptionRef, {
        category: newOptionCategory,
        value: newOptionValue
      });
      setNewOptionValue('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'filterOptions');
    }
  };

  const handleDeleteOption = async (id: string, value: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Option',
      message: `Are you sure you want to delete the option "${value}"?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'filterOptions', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `filterOptions/${id}`);
        }
      },
      type: 'danger'
    });
  };

  const resetForm = () => {
    setName('');
    setFileType('');
    setFileIdNo('');
    setCompany('');
    setYear('');
    setLocation('');
    setFileMonitor('');
    setFileMonitorId('');
    setIsAdding(false);
    setEditingId(null);
  };

  const filteredAdminFiles = files.filter(f => 
    f.name.toLowerCase().includes(adminSearch.toLowerCase()) || 
    f.fileIdNo.toLowerCase().includes(adminSearch.toLowerCase()) ||
    f.location.toLowerCase().includes(adminSearch.toLowerCase()) ||
    f.company.toLowerCase().includes(adminSearch.toLowerCase())
  );

  return (
    <div className="space-y-12">
      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-stone-100 w-fit">
        <button 
          onClick={() => setActiveAdminTab('files')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-medium transition-all",
            activeAdminTab === 'files' ? "bg-stone-900 text-white shadow-lg shadow-stone-900/10" : "text-stone-500 hover:bg-stone-50"
          )}
        >
          Files
        </button>
        {userProfile?.role === 'admin' && (
          <>
            <button 
              onClick={() => setActiveAdminTab('users')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeAdminTab === 'users' ? "bg-stone-900 text-white shadow-lg shadow-stone-900/10" : "text-stone-500 hover:bg-stone-50"
              )}
            >
              Users
            </button>
            <button 
              onClick={() => setActiveAdminTab('filters')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeAdminTab === 'filters' ? "bg-stone-900 text-white shadow-lg shadow-stone-900/10" : "text-stone-500 hover:bg-stone-50"
              )}
            >
              Filters
            </button>
          </>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeAdminTab === 'files' && (
          <motion.div
            key="files-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-12"
          >
            {/* File Management Section */}
            <section className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-serif font-medium text-stone-900">Manage Files</h2>
                {!isAdding && (
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-2xl font-medium hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
                  >
                    <Plus className="w-5 h-5" />
                    Add New File
                  </button>
                )}
              </div>

              <AnimatePresence>
                {isAdding && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white rounded-3xl p-8 shadow-xl border border-stone-100"
                  >
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">File Name</label>
                          <div className="relative">
                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                            <input 
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="e.g., Q1 Financial Report"
                              className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">File Type</label>
                          <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                            <select 
                              value={fileType}
                              onChange={(e) => setFileType(e.target.value)}
                              className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all appearance-none"
                              required
                            >
                              <option value="">Select Type</option>
                              {filterOptions.filter(o => o.category === 'fileType').map(o => (
                                <option key={o.id} value={o.value}>{o.value}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">File ID No.</label>
                          <div className="relative">
                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                            <input 
                              type="text"
                              value={fileIdNo}
                              onChange={(e) => setFileIdNo(e.target.value)}
                              placeholder="e.g., FILE-2024-001"
                              className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Company</label>
                          <div className="relative">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                            <select 
                              value={company}
                              onChange={(e) => setCompany(e.target.value)}
                              className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all appearance-none"
                              required
                            >
                              <option value="">Select Company</option>
                              {filterOptions.filter(o => o.category === 'company').map(o => (
                                <option key={o.id} value={o.value}>{o.value}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Year / File No.</label>
                          <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                            <select 
                              value={year}
                              onChange={(e) => setYear(e.target.value)}
                              className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all appearance-none"
                              required
                            >
                              <option value="">Select Year</option>
                              {filterOptions.filter(o => o.category === 'year').map(o => (
                                <option key={o.id} value={o.value}>{o.value}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Location</label>
                          <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                            <input 
                              type="text"
                              value={location}
                              onChange={(e) => setLocation(e.target.value)}
                              placeholder="e.g., Cabinet A, Shelf 3"
                              className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">File Monitor</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                            <input 
                              type="text"
                              value={fileMonitor}
                              onChange={(e) => setFileMonitor(e.target.value)}
                              placeholder="Name of person uploading/monitoring"
                              disabled={userProfile?.role !== 'admin'}
                              className={cn(
                                "w-full border border-stone-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all",
                                userProfile?.role !== 'admin' ? "bg-stone-100 text-stone-500 cursor-not-allowed" : "bg-stone-50"
                              )}
                            />
                          </div>
                          {userProfile?.role !== 'admin' && (
                            <p className="text-[10px] text-stone-400 ml-1 italic">Only administrators can edit this field.</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">File Monitor ID (Email)</label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                            <input 
                              type="email"
                              value={fileMonitorId}
                              onChange={(e) => setFileMonitorId(e.target.value)}
                              placeholder="Email of person uploading/monitoring"
                              disabled={userProfile?.role !== 'admin'}
                              className={cn(
                                "w-full border border-stone-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all",
                                userProfile?.role !== 'admin' ? "bg-stone-100 text-stone-500 cursor-not-allowed" : "bg-stone-50"
                              )}
                            />
                          </div>
                          {userProfile?.role !== 'admin' && (
                            <p className="text-[10px] text-stone-400 ml-1 italic">Only administrators can edit this field.</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 pt-4">
                        <button 
                          type="submit"
                          className="flex-1 bg-stone-900 text-white py-4 rounded-2xl font-medium hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10 flex items-center justify-center gap-2"
                        >
                          <Check className="w-5 h-5" />
                          {editingId ? 'Update File' : 'Create File'}
                        </button>
                        <button 
                          type="button"
                          onClick={resetForm}
                          className="px-8 py-4 border border-stone-200 text-stone-500 rounded-2xl font-medium hover:bg-stone-50 transition-all flex items-center justify-center gap-2"
                        >
                          <X className="w-5 h-5" />
                          Cancel
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Admin Files List */}
              <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
                <div className="p-6 border-b border-stone-100 bg-stone-50/50">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input 
                      type="text"
                      placeholder="Search files to manage..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-stone-50 text-[10px] uppercase tracking-widest font-bold text-stone-400">
                        <th className="px-6 py-4">File Name</th>
                        <th className="px-6 py-4">ID No.</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Company</th>
                        <th className="px-6 py-4">Year</th>
                        <th className="px-6 py-4">Location</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {filteredAdminFiles.map(file => (
                        <tr key={file.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <button 
                              className="font-medium text-stone-900 hover:text-stone-600 transition-colors text-left focus:outline-none focus:underline"
                              onClick={() => onFileClick?.(file.id)}
                            >
                              {file.name}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm text-stone-600">{file.fileIdNo}</td>
                          <td className="px-6 py-4 text-sm text-stone-600">{file.fileType}</td>
                          <td className="px-6 py-4 text-sm text-stone-600">{file.company}</td>
                          <td className="px-6 py-4 text-sm text-stone-600">{file.year}</td>
                          <td className="px-6 py-4 text-sm text-stone-600">{file.location}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => setSelectedFileForAttachments(file)}
                                className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
                                title="Manage Attachments"
                              >
                                <Paperclip className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => onFileClick?.(file.id, true)}
                                className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
                                title="Checkout History"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              {userProfile?.role === 'admin' && (
                                <>
                                  <button 
                                    onClick={() => handleEdit(file)}
                                    className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteFile(file.id, file.name)}
                                    className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredAdminFiles.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-stone-400 italic">
                            No files found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {activeAdminTab === 'users' && (
          <motion.div
            key="users-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-serif font-medium text-stone-900">User Management</h2>
            </div>
            <UserManagement />
          </motion.div>
        )}

        {activeAdminTab === 'filters' && (
          <motion.div
            key="filters-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Filter Options Management Section */}
            <section className="space-y-8">
              <div className="flex items-center gap-3">
                <Filter className="w-6 h-6 text-stone-800" />
                <h2 className="text-2xl font-serif font-medium text-stone-900">Manage Filter Options</h2>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100 space-y-8">
                <form onSubmit={handleAddOption} className="flex flex-col md:flex-row gap-4">
                  <select 
                    value={newOptionCategory}
                    onChange={(e) => setNewOptionCategory(e.target.value as any)}
                    className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                  >
                    <option value="fileType">File Type</option>
                    <option value="company">Company</option>
                    <option value="year">Year</option>
                  </select>
                  <input 
                    type="text"
                    value={newOptionValue}
                    onChange={(e) => setNewOptionValue(e.target.value)}
                    placeholder="Add new option value..."
                    className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    required
                  />
                  <button 
                    type="submit"
                    className="bg-stone-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Option
                  </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {(['fileType', 'company', 'year'] as const).map(category => (
                    <div key={category} className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 border-b border-stone-100 pb-2">
                        {category === 'fileType' ? 'File Types' : category === 'company' ? 'Companies' : 'Years'}
                      </h3>
                      <div className="space-y-2">
                        {filterOptions.filter(o => o.category === category).map(option => (
                          <div key={option.id} className="flex items-center justify-between bg-stone-50 px-3 py-2 rounded-lg group">
                            <span className="text-sm text-stone-700">{option.value}</span>
                            <button 
                              onClick={() => handleDeleteOption(option.id, option.value)}
                              className="text-stone-300 hover:text-red-500 transition-colors opacity-40 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {filterOptions.filter(o => o.category === category).length === 0 && (
                          <p className="text-xs text-stone-400 italic">No options added yet.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-100">
        <p className="text-stone-500 text-sm italic p-4">
          Admin tip: Add your file types, companies, and years here first so they appear in the dropdowns when adding new files.
        </p>
      </div>

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
