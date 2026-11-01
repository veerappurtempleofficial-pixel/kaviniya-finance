import React, { useState } from 'react';
import { Lock, KeyRound, ShieldCheck, X, UserCheck } from 'lucide-react';

interface LoginModalProps {
  users: any[];
  currentUser: any;
  onLoginSuccess: (token: string, user: any) => void;
  onQuickSwitch: (userId: string) => void;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  users,
  currentUser,
  onLoginSuccess,
  onQuickSwitch,
  onClose,
}) => {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('Owner@123');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      onLoginSuccess(data.token, data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, phone, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setMessage(data.message);
      setMode('login');
      setPassword(newPassword);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1D2F]/70 p-4">
      <div className="w-full max-w-md bg-white border border-[#D5DCE4] rounded-[4px] shadow-2xl overflow-hidden">
        <div className="bg-[#14283F] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#B78727]" />
              <span className="text-sm font-bold tracking-wider uppercase">
                KAVINIYA FINANCE • Operator Security
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Role-Based Access Control & Session Authentication
            </p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-[3px]">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-3 p-2.5 bg-[#EBF7F5] border border-[#188A78]/30 text-[#188A78] text-xs rounded-[3px]">
              {message}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Operator Username / Email
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#D5DCE4] rounded-[3px] focus:outline-none focus:border-[#244B70]"
                  placeholder="owner / admin / murugan"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#D5DCE4] rounded-[3px] focus:outline-none focus:border-[#244B70]"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-xs text-[#244B70] hover:underline flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3" />
                  Reset Password Workflow
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#14283F] hover:bg-[#244B70] text-white text-xs font-semibold rounded-[3px] flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {loading ? 'Authenticating...' : 'Authenticate Session'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#D5DCE4] rounded-[3px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Registered Mobile Number (Verification)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9840112233"
                  className="w-full px-3 py-2 text-xs border border-[#D5DCE4] rounded-[3px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 text-xs border border-[#D5DCE4] rounded-[3px]"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-slate-600 hover:underline"
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#188A78] text-white text-xs font-semibold rounded-[3px]"
                >
                  Verify & Reset Password
                </button>
              </div>
            </form>
          )}

          {/* Quick Role Switcher for Evaluation */}
          <div className="mt-5 pt-4 border-t border-[#E8EDF2]">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#244B70]" />
              Instant Role Switcher (Verify RBAC Permissions)
            </div>
            <div className="space-y-1.5">
              {users.map((u) => {
                const isActive = currentUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onQuickSwitch(u.id);
                      onClose();
                    }}
                    className={`w-full text-left px-3 py-2 rounded-[3px] border text-xs flex items-center justify-between transition-colors ${
                      isActive
                        ? 'bg-[#EDF2F7] border-[#244B70] font-semibold text-[#14283F]'
                        : 'bg-[#F7F8FA] border-[#E8EDF2] hover:border-[#244B70]/50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-[#14283F]">{u.full_name}</div>
                      <div className="text-[10px] text-slate-500">
                        User: <span className="font-mono">{u.username}</span> • {u.branch_name || 'Chennai HO'}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-[2px] ${
                        u.role_code === 'OWNER'
                          ? 'bg-[#FBF6EB] text-[#B78727] border border-[#E6D09C]'
                          : u.role_code === 'ADMIN'
                          ? 'bg-[#EDF2F7] text-[#244B70] border border-[#244B70]/20'
                          : 'bg-[#EBF7F5] text-[#188A78] border border-[#188A78]/20'
                      }`}
                    >
                      {u.role_code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
