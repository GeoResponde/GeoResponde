import React, { useState } from 'react';


export function BuildingDamageForm({ onCancel }: { onCancel: () => void }) {
  // Generic form state
  const [formData, setFormData] = useState({
    building_name: '',
    address: '',
    city: '',
    damage_level: 'UNKNOWN',
    description: '',
    lat: '',
    lng: '',
    reporter_name: '',
    reporter_email: '',
    reporter_phone: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; referenceId?: string; providerName?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const pkg = {
        type: 'building_damage',
        payload: {
          ...formData,
          lat: formData.lat ? parseFloat(formData.lat) : undefined,
          lng: formData.lng ? parseFloat(formData.lng) : undefined
        },
        timestamp: new Date().toISOString()
      };

      const res = await fetch('http://127.0.0.1:3001/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pkg)
      });
      
      const data = await res.json();
      
      if (data.success) {
        setResult({ success: true, referenceId: data.referenceId, providerName: data.providerName });
      } else {
        setResult({ success: false });
      }
    } catch (err) {
      setResult({ success: false });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result?.success) {
    return (
      <div style={{ backgroundColor: '#1e293b', padding: '40px', borderRadius: '12px', border: '1px solid #10b981', textAlign: 'center' }}>
        <h2 style={{ color: '#10b981', marginTop: 0 }}>Report Submitted Successfully</h2>
        <p style={{ color: '#cbd5e1' }}>
          ✓ Your report was successfully delivered to <strong>{result.providerName || 'TerremotoVenezuela'}</strong>.
        </p>
        {result.referenceId && (
          <p style={{ color: '#cbd5e1' }}>
            Reference ID: <strong>{result.referenceId}</strong>
          </p>
        )}
        <button 
          onClick={onCancel}
          style={{ marginTop: '20px', padding: '12px 24px', backgroundColor: '#3498db', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Return to Report Menu
        </button>
      </div>
    );
  }

  const inputStyle = { width: '100%', padding: '12px', marginBottom: '16px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '40px', borderRadius: '12px', border: '1px solid #334155' }}>
      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        ← Back
      </button>
      
      <h2 style={{ color: '#fff', marginTop: 0, marginBottom: '24px' }}>Building Damage Report</h2>

      <form onSubmit={handleSubmit}>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>Building Name *</label>
          <input type="text" value={formData.building_name} onChange={e => setFormData({...formData, building_name: e.target.value})} style={inputStyle} required />
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>Address *</label>
          <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={inputStyle} required />
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>City *</label>
          <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} style={inputStyle} required />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>Damage Level *</label>
          <select value={formData.damage_level} onChange={e => setFormData({...formData, damage_level: e.target.value})} style={inputStyle} required>
            <option value="UNKNOWN">Unknown</option>
            <option value="MINOR">Minor</option>
            <option value="MODERATE">Moderate</option>
            <option value="SEVERE">Severe</option>
            <option value="DESTROYED">Destroyed</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>Description</label>
          <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{...inputStyle, minHeight: '100px'}} />
        </div>

        <div className="mobile-col" style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>Latitude (Optional)</label>
            <input type="number" step="any" value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>Longitude (Optional)</label>
            <input type="number" step="any" value={formData.lng} onChange={e => setFormData({...formData, lng: e.target.value})} style={inputStyle} />
          </div>
        </div>

        <hr style={{ borderColor: '#334155', margin: '24px 0' }} />

        <h3 style={{ color: '#fff', marginBottom: '16px' }}>Contact Information (Optional)</h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>Your Name</label>
          <input type="text" value={formData.reporter_name} onChange={e => setFormData({...formData, reporter_name: e.target.value})} style={inputStyle} />
        </div>

        <div className="mobile-col" style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>Email</label>
            <input type="email" value={formData.reporter_email} onChange={e => setFormData({...formData, reporter_email: e.target.value})} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>Phone</label>
            <input type="tel" value={formData.reporter_phone} onChange={e => setFormData({...formData, reporter_phone: e.target.value})} style={inputStyle} />
          </div>
        </div>
        
        {result?.success === false && (
          <div style={{ color: '#ef4444', marginBottom: '16px' }}>
            Failed to submit report. Please try again.
          </div>
        )}

        <button 
          type="submit" 
          disabled={isSubmitting}
          style={{ 
            width: '100%', 
            padding: '16px', 
            backgroundColor: isSubmitting ? '#475569' : '#3498db', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: isSubmitting ? 'not-allowed' : 'pointer', 
            fontWeight: 'bold',
            fontSize: '18px'
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
