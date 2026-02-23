import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const username = localStorage.getItem('loggedInUsername');
    
    if (!username) {
      navigate('/login');
      return;
    }

    try {
      const response = await axios.get(`http://localhost:8000/api/scholar/dashboard/?username=${username}`);
      setData(response.data);
    } catch (err) {
      console.error('Error:', err);
      // If Django says the user/profile doesn't exist, send them back to login
      if (err.response?.status === 401 || err.response?.status === 404) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) return <div>Loading...</div>;
  if (!data) return <div>No data</div>;

  const percentage = (data.rendered_hours / data.required_hours) * 100;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Welcome back, {data.name}!</h1>
        <button onClick={handleLogout} style={{ padding: '10px 20px', cursor: 'pointer' }}>Logout</button>
      </div>

      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h2>Service Hour Progress</h2>
        <p>Student ID: {data.student_id}</p>
        <p>Status: {data.is_dormer ? 'Dormer' : 'Non-Dormer'}</p>
        
        <div style={{ marginTop: '20px' }}>
          <p><strong>Rendered Hours:</strong> {data.rendered_hours} / {data.required_hours}</p>
          <div style={{
            width: '100%',
            height: '30px',
            backgroundColor: '#e9ecef',
            borderRadius: '15px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${Math.min(percentage, 100)}%`,
              height: '100%',
              backgroundColor: percentage >= 100 ? '#28a745' : '#007bff',
              transition: 'width 0.5s'
            }} />
          </div>
          <p style={{ marginTop: '10px' }}>{percentage.toFixed(1)}% Complete</p>
        </div>

        {data.carry_over > 0 && (
          <p style={{ color: '#28a745', marginTop: '10px' }}>
            ✓ Carry-over Hours: {data.carry_over}
          </p>
        )}
      </div>

      <div style={{ marginTop: '30px' }}>
        <h2>Service Hours History</h2>
        {data.service_logs.length === 0 ? (
          <p>No service hours recorded yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#007bff', color: 'white' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Activity</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Office</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Hours</th>
              </tr>
            </thead>
            <tbody>
              {data.service_logs.map((log, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px' }}>{log.date}</td>
                  <td style={{ padding: '10px' }}>{log.activity}</td>
                  <td style={{ padding: '10px' }}>{log.office}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{log.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;