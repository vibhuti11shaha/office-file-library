import React, { useState, useEffect, Component } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  handleFirestoreError,
  OperationType
} from './firebase';
import { LogIn, LogOut, Plus, Search, QrCode, Library, Settings, User as UserIcon, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AdminDashboard from './components/AdminDashboard';
import FileList from './components/FileList';
import QRScanner from './components/QRScanner';
import FileDetailView from './components/FileDetailView';
import { cn } from './lib/utils';

export type FileData = {
  id: string;
  name: string;
  fileType: string;
  fileIdNo: string;
  company: string;
  year: string;
  location: string;
  status: 'available' | 'checked-out';
  checkedOutBy?: string;
  checkedOutByName?: string;
  activeHistoryId?: string;
  fileMonitor?: string;
  fileMonitorId?: string;
  lastUpdated: any;
};

export type FilterOption = {
  id: string;
  category: 'fileType' | 'company' | 'year';
  value: string;
};

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user' | 'monitor';
  status: 'pending' | 'approved' | 'rejected';
};

export default function App() {
  const [error, setError] = useState<any>(null);

  if (error) {
    let errorMessage = "Something went wrong.";
    try {
      if (error && typeof error.message === 'string') {
        const parsed = JSON.parse(error.message);
        if (parsed.error && parsed.error.includes('Missing or insufficient permissions')) {
          errorMessage = "Permission Denied: You don't have access to this resource.";
        }
      }
    } catch (e) {}

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F4] p-6">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-serif font-medium">Application Error</h2>
          <p className="text-stone-500 leading-relaxed">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-medium"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return (
    <LibraryApp onError={setError} />
  );
}

function LibraryApp({ onError }: { onError: (err: any) => void }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'library' | 'scan' | 'admin'>('library');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [shouldScrollToHistory, setShouldScrollToHistory] = useState(false);
  const [view, setView] = useState<'main' | 'file-detail'>('main');
  const [files, setFiles] = useState<FileData[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    fileType: '',
    company: '',
    year: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          // Get or create profile
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const isAdmin = user.email === 'team@sathibazar.in' || user.email === 'vibhuti.11.shaha@gmail.com';

          if (userDoc.exists()) {
            const currentProfile = userDoc.data() as UserProfile;
            let updatedProfile = { ...currentProfile };
            let needsUpdate = false;

            if (isAdmin && currentProfile.role !== 'admin') {
              updatedProfile.role = 'admin';
              updatedProfile.status = 'approved';
              needsUpdate = true;
            }

            if (needsUpdate) {
              await setDoc(doc(db, 'users', user.uid), updatedProfile);
              setProfile(updatedProfile);
            } else {
              setProfile(currentProfile);
            }
          } else {
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'User',
              role: isAdmin ? 'admin' : 'user',
              status: isAdmin ? 'approved' : 'pending'
            };
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          } catch (e) {
            onError(e);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'files');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const filesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileData));
      // Sort by fileIdNo in ascending order
      const sortedFiles = filesData.sort((a, b) => {
        return a.fileIdNo.localeCompare(b.fileIdNo, undefined, { numeric: true, sensitivity: 'base' });
      });
      setFiles(sortedFiles);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'files');
      } catch (e) {
        onError(e);
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'filterOptions');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const options = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FilterOption));
      setFilterOptions(options);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'filterOptions');
      } catch (e) {
        onError(e);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleNavigateToFile = (fileId: string, scrollToHistory: boolean = false) => {
    setSelectedFileId(fileId);
    setShouldScrollToHistory(scrollToHistory);
    setView('file-detail');
  };

  const handleBackToLibrary = () => {
    setView('main');
    setSelectedFileId(null);
    setShouldScrollToHistory(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F4]">
        <div className="animate-pulse text-2xl font-serif italic text-stone-500">Loading Library...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F4] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl p-10 shadow-xl shadow-stone-200/50 text-center"
        >
          <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <Library className="w-10 h-10 text-stone-800" />
          </div>
          <h1 className="text-4xl font-serif font-medium text-stone-900 mb-4 tracking-tight">Office Library</h1>
          <p className="text-stone-500 mb-10 leading-relaxed">
            A digital inventory for office files. Scan, track, and manage with ease.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full bg-stone-900 text-white rounded-2xl py-4 font-medium flex items-center justify-center gap-3 hover:bg-stone-800 transition-colors shadow-lg shadow-stone-900/20"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (profile?.status === 'pending') {
    return (
      <div className="min-h-screen bg-[#F5F5F4] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl p-10 shadow-xl shadow-stone-200/50 text-center"
        >
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-3xl font-serif font-medium text-stone-900 mb-4 tracking-tight">Approval Pending</h1>
          <p className="text-stone-500 mb-10 leading-relaxed">
            Your account has been created and is waiting for administrator approval. Please check back later.
          </p>
          <button 
            onClick={handleLogout}
            className="w-full bg-stone-100 text-stone-600 rounded-2xl py-4 font-medium flex items-center justify-center gap-3 hover:bg-stone-200 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </motion.div>
      </div>
    );
  }

  if (profile?.status === 'rejected') {
    return (
      <div className="min-h-screen bg-[#F5F5F4] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl p-10 shadow-xl shadow-stone-200/50 text-center"
        >
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <X className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-3xl font-serif font-medium text-stone-900 mb-4 tracking-tight">Access Denied</h1>
          <p className="text-stone-500 mb-10 leading-relaxed">
            Your request for access has been rejected by the administrator.
          </p>
          <button 
            onClick={handleLogout}
            className="w-full bg-stone-100 text-stone-600 rounded-2xl py-4 font-medium flex items-center justify-center gap-3 hover:bg-stone-200 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </motion.div>
      </div>
    );
  }

  const filteredFiles = files.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         f.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         f.fileIdNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         f.company.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = !filters.fileType || f.fileType === filters.fileType;
    const matchesCompany = !filters.company || f.company === filters.company;
    const matchesYear = !filters.year || f.year === filters.year;

    return matchesSearch && matchesType && matchesCompany && matchesYear;
  });

  return (
    <div className="min-h-screen bg-[#F5F5F4] pb-24">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={handleBackToLibrary}
        >
          <Library className="w-6 h-6 text-stone-800" />
          <h1 className="text-xl font-serif font-medium text-stone-900">Office Library</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium text-stone-900">{profile?.displayName}</span>
            <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">{profile?.role}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {view === 'main' ? (
            <>
              {activeTab === 'library' && (
                <motion.div
                  key="library"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input 
                      type="text"
                      placeholder="Search files or locations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all shadow-sm"
                    />
                  </div>
                  <FileList 
                    files={filteredFiles} 
                    user={user} 
                    userProfile={profile}
                    filterOptions={filterOptions}
                    filters={filters}
                    setFilters={setFilters}
                    onFileClick={handleNavigateToFile}
                  />
                </motion.div>
              )}

              {activeTab === 'scan' && (
                <motion.div
                  key="scan"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center"
                >
                  <QRScanner 
                    user={user} 
                    userProfile={profile} 
                    filterOptions={filterOptions}
                    onComplete={() => setActiveTab('library')} 
                  />
                </motion.div>
              )}

              {activeTab === 'admin' && (profile?.role === 'admin' || profile?.role === 'monitor' || user?.email === 'team@sathibazar.in' || user?.email === 'vibhuti.11.shaha@gmail.com') && (
                <motion.div
                  key="admin"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <AdminDashboard 
              filterOptions={filterOptions} 
              user={user} 
              userProfile={profile}
              onFileClick={handleNavigateToFile}
            />
                </motion.div>
              )}
            </>
          ) : (
            <motion.div
              key="file-detail"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {selectedFileId && (
                <FileDetailView 
                  fileId={selectedFileId} 
                  user={user} 
                  userProfile={profile}
                  onBack={handleBackToLibrary} 
                  scrollToHistory={shouldScrollToHistory}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      {view === 'main' && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md border border-stone-200 rounded-full px-4 py-2 shadow-2xl shadow-stone-900/10 flex items-center gap-2 z-20">
          <NavButton 
            active={activeTab === 'library'} 
            onClick={() => setActiveTab('library')}
            icon={<Library className="w-5 h-5" />}
            label="Library"
          />
          <NavButton 
            active={activeTab === 'scan'} 
            onClick={() => setActiveTab('scan')}
            icon={<QrCode className="w-5 h-5" />}
            label="Scan"
          />
          { (profile?.role === 'admin' || profile?.role === 'monitor' || user?.email === 'team@sathibazar.in' || user?.email === 'vibhuti.11.shaha@gmail.com') && (
            <NavButton 
              active={activeTab === 'admin'} 
              onClick={() => setActiveTab('admin')}
              icon={<Settings className="w-5 h-5" />}
              label="Admin"
            />
          )}
        </nav>
      )}
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300",
        active ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20" : "text-stone-500 hover:bg-stone-100"
      )}
    >
      {icon}
      {active && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}
