import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      const username = localStorage.getItem('loggedInUsername');
      if (!username) { navigate('/login'); return; }
      try {
        const response = await axios.get(`/api/scholar/dashboard/?username=${username}`);
        setData(response.data);
      } catch (err) {
        console.error('Error:', err);
        // If Django says the user/profile doesn't exist, send them back to login
        if (err.response?.status === 401 || err.response?.status === 404) navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-mono">
      <div className="text-neutral-600 text-xs tracking-widest animate-pulse">LOADING...</div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-mono">
      <div className="text-neutral-600 text-xs">No data available.</div>
    </div>
  );

  const percentage = Math.min((data.rendered_hours / data.required_hours) * 100, 100);
  const remaining = Math.max(data.required_hours - data.rendered_hours, 0);
  const isComplete = percentage >= 100;

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-mono text-white">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-neutral-900 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold tracking-tight text-white">
            serbisyong<span className="text-blue-400">Scholar</span>
          </h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-[10px] tracking-[0.2em] uppercase text-neutral-500 hover:text-red-400 transition-colors border border-neutral-800 hover:border-red-900 px-3 py-1.5 rounded"
        >
          Logout
        </button>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Welcome + Meta */}
        <div>
          <p className="text-[10px] tracking-[0.3em] text-neutral-600 uppercase mb-1">Dashboard</p>
          <h2 className="text-2xl font-bold text-white">Welcome back, {data.name}.</h2>
          <p className="mt-1 text-xs text-neutral-500">
            {data.student_id} &nbsp;·&nbsp; {data.is_dormer ? 'Dormer' : 'Non-Dormer'}
          </p>
        </div>

        {/* Progress card */}
        <div className="border border-neutral-800 rounded-lg p-6 bg-neutral-950/60">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] tracking-[0.25em] text-neutral-600 uppercase">Service Hours</p>
              <p className="mt-1 text-4xl font-bold text-white tabular-nums">
                {data.rendered_hours}
                <span className="text-neutral-600 text-xl font-normal"> / {data.required_hours}</span>
              </p>
            </div>
            <div className="text-right">
              <span className={`text-[10px] tracking-[0.2em] uppercase font-bold px-2 py-1 rounded ${isComplete ? 'bg-blue-500/10 text-blue-400' : 'bg-neutral-800 text-neutral-400'}`}>
                {isComplete ? '✓ Complete' : `${remaining} hrs left`}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-blue-400' : 'bg-blue-500'}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-neutral-600 tabular-nums">{percentage.toFixed(1)}% complete</p>

          {data.carry_over > 0 && (
            <p className="mt-3 text-[11px] text-blue-400">↑ Carry-over: {data.carry_over} hrs applied</p>
          )}
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Required', value: data.required_hours },
            { label: 'Rendered', value: data.rendered_hours },
            { label: 'Carry-over', value: data.carry_over },
          ].map(({ label, value }) => (
            <div key={label} className="border border-neutral-800 rounded-lg px-4 py-4 bg-neutral-950/40">
              <p className="text-[9px] tracking-[0.25em] text-neutral-600 uppercase">{label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* Service logs */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[10px] tracking-[0.25em] text-neutral-600 uppercase">Service Hours History</p>
            <div className="flex-1 h-px bg-neutral-900" />
            <span className="text-[10px] text-neutral-700">{data.service_logs.length} entries</span>
          </div>

          {data.service_logs.length === 0 ? (
            <div className="border border-neutral-800/50 border-dashed rounded-lg p-8 text-center">
              <p className="text-xs text-neutral-700">No service hours recorded yet.</p>
            </div>
          ) : (
            <div className="border border-neutral-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/50">
                    <th className="text-left px-4 py-3 text-[10px] tracking-[0.2em] text-neutral-600 uppercase font-normal">Date</th>
                    <th className="text-left px-4 py-3 text-[10px] tracking-[0.2em] text-neutral-600 uppercase font-normal">Activity</th>
                    <th className="text-left px-4 py-3 text-[10px] tracking-[0.2em] text-neutral-600 uppercase font-normal">Office</th>
                    <th className="text-right px-4 py-3 text-[10px] tracking-[0.2em] text-neutral-600 uppercase font-normal">Hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {data.service_logs.map((log, index) => (
                    <tr
                      key={index}
                      className="border-b border-neutral-900 hover:bg-neutral-900/40 transition-colors last:border-0"
                    >
                      <td className="px-4 py-3 text-neutral-500 tabular-nums whitespace-nowrap">{log.date}</td>
                      <td className="px-4 py-3 text-neutral-300">{log.activity}</td>
                      <td className="px-4 py-3 text-neutral-500">{log.office}</td>
                      <td className="px-4 py-3 text-right text-blue-400 font-bold tabular-nums">{log.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;