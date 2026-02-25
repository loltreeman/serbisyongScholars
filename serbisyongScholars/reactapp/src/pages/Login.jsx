import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login/', formData);
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('loggedInUsername', response.data.user.username);
      } else if (response.data.access) {
        localStorage.setItem('access', response.data.access);
        localStorage.setItem('refresh', response.data.refresh);
      }
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 font-mono">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="mb-10">
          <p className="text-[10px] tracking-[0.3em] text-neutral-600 uppercase mb-2">Ateneo de Manila</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">serbisyong<span className="text-blue-400">Scholar</span></h1>
          <div className="mt-3 h-px w-12 bg-blue-400" />
        </div>

        <h2 className="text-[11px] tracking-[0.25em] text-neutral-500 uppercase mb-6">Sign in to continue</h2>

        {error && (
          <div className="mb-5 px-4 py-3 border border-red-900/60 bg-red-950/30 text-red-400 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full bg-neutral-900 border border-neutral-800 text-white text-sm px-4 py-3 rounded focus:outline-none focus:border-blue-500 transition-colors placeholder:text-neutral-600"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
          />
          <input
            className="w-full bg-neutral-900 border border-neutral-800 text-white text-sm px-4 py-3 rounded focus:outline-none focus:border-blue-500 transition-colors placeholder:text-neutral-600"
            name="password"
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-black text-xs font-bold tracking-[0.15em] uppercase px-4 py-3 rounded transition-colors"
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-neutral-600">
          No account?{' '}
          <a href="/signup" className="text-blue-400 hover:text-blue-300 transition-colors">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

export default Login;