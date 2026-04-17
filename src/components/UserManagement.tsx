import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, doc, updateDoc, deleteDoc, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../App';
import { UserCheck, UserX, Trash2, Shield, User, Mail, Clock, Search, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmationModal from './ConfirmationModal';

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
    const q = collection(db, 'users');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile));
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'users', userId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'user' | 'monitor') => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove User',
      message: `Are you sure you want to remove user "${userName}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', userId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
        }
      },
      type: 'danger'
    });
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input 
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
          />
        </div>
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          <span>Total Users: {users.length}</span>
          <span className="w-1 h-1 bg-stone-200 rounded-full" />
          <span>Pending: {users.filter(u => u.status === 'pending').length}</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50 text-[10px] uppercase tracking-widest font-bold text-stone-400">
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filteredUsers.map(user => (
                <tr key={user.uid} className="hover:bg-stone-50/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-stone-900">{user.displayName}</p>
                        <p className="text-xs text-stone-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <select 
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.uid, e.target.value as any)}
                        className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                      >
                        <option value="user">User</option>
                        <option value="monitor">Monitor</option>
                        <option value="admin">Admin</option>
                      </select>
                      {user.role === 'admin' && <Shield className="w-3 h-3 text-stone-900" />}
                      {user.role === 'monitor' && <Clock className="w-3 h-3 text-amber-500" />}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                      user.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                      user.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleUpdateStatus(user.uid, 'approved')}
                            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Approve User"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(user.uid, 'rejected')}
                            className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                            title="Reject User"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {user.status === 'rejected' && (
                        <button 
                          onClick={() => handleUpdateStatus(user.uid, 'approved')}
                          className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Approve User"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      {user.status === 'approved' && user.role !== 'admin' && (
                        <button 
                          onClick={() => handleUpdateStatus(user.uid, 'rejected')}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                          title="Reject User"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleRemoveUser(user.uid, user.displayName)}
                        className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Remove User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-stone-400 italic">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
