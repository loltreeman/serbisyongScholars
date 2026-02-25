import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function SignUp() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    student_id: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await axios.post('/api/signup/', formData);
      console.log('Success:', response.data);
      alert('Account created! Please check your email for verification.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data || 'Something went wrong');
      console.error(err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-neutral-900 border border-neutral-800 text-white text-sm px-4 py-3 rounded focus:outline-none focus:border-blue-500 transition-colors placeholder:text-neutral-600";

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12 font-mono">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Brand */}
        <div className="mb-10">
          <p className="text-[10px] tracking-[0.3em] text-neutral-600 uppercase mb-2">Ateneo de Manila</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">serbisyong<span className="text-blue-400">Scholar</span></h1>
          <div className="mt-3 h-px w-12 bg-blue-400" />
        </div>

        <h2 className="text-[11px] tracking-[0.25em] text-neutral-500 uppercase mb-6">Create your account</h2>

        {error && (
          <div className="mb-5 px-4 py-3 border border-red-900/60 bg-red-950/30 text-red-400 text-xs rounded">
            {typeof error === 'string' ? error : JSON.stringify(error)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleChange} required />
            <input className={inputClass} name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleChange} required />
          </div>

          <input className={inputClass} name="student_id" placeholder="Student ID (6 digits)" value={formData.student_id} onChange={handleChange} maxLength="6" required />
          <input className={inputClass} name="username" placeholder="Username" value={formData.username} onChange={handleChange} required />
          <input className={inputClass} name="email" placeholder="Email (@student.ateneo.edu)" type="email" value={formData.email} onChange={handleChange} required />

          <div className="pt-1 border-t border-neutral-800 space-y-3">
            <input className={inputClass} name="password" placeholder="Password (min 8 characters)" type="password" value={formData.password} onChange={handleChange} required />
            <input className={inputClass} name="password_confirm" placeholder="Confirm Password" type="password" value={formData.password_confirm} onChange={handleChange} required />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-black text-xs font-bold tracking-[0.15em] uppercase px-4 py-3 rounded transition-colors"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-neutral-600">
          Already have an account?{' '}
          <a href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
            Login
          </a>
        </p>
      </div>
    </div>
  );
}

export default SignUp;