import React, { useState } from 'react';
import { Database, Mail, AlertCircle, CheckCircle, Loader, Shield } from 'lucide-react';

export default function BackupView() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleBackup = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus({ type: 'error', message: 'Por favor ingresa un correo electrónico válido.' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/backup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailDestino: email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error en el servidor al generar el respaldo.');
      }

      setStatus({ type: 'success', message: `¡Respaldo enviado con éxito a ${email}! Por favor, revisa también tu carpeta de Spam.` });
      setEmail('');
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Error de conexión con el servidor de respaldos.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-area">
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-color)' }}>
          <Shield size={24} className="text-primary" />
          Respaldo de Seguridad
        </h2>
        <p className="subtitle">Exporta la base de datos completa de Clientes y Tickets directamente a tu correo electrónico.</p>
      </div>

      <div className="glass" style={{ maxWidth: '600px', margin: '0 auto', padding: '2.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
        
        {/* Decorative background element */}
        <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'var(--primary)', opacity: '0.1', borderRadius: '50%', filter: 'blur(30px)' }}></div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Database size={32} className="text-primary" />
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Generar Backup Manual</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
            El sistema recopilará toda la información almacenada hasta este segundo exacto, generará un archivo seguro y lo enviará mediante nuestro sistema automatizado.
          </p>
        </div>

        <form onSubmit={handleBackup} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
              ¿A qué correo enviamos el respaldo?
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@estudio.com"
                required
                className="input-field"
                style={{ paddingLeft: '2.5rem', width: '100%' }}
                disabled={loading}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
            {loading ? (
              <>
                <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
                Empaquetando base de datos...
              </>
            ) : (
              <>
                Generar y Enviar Respaldo
              </>
            )}
          </button>
        </form>

        {status.message && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1rem', 
            borderRadius: '8px', 
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: '0.75rem',
            background: status.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${status.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
          }}>
            {status.type === 'success' ? (
              <CheckCircle size={20} style={{ color: 'rgb(34, 197, 94)', flexShrink: 0, marginTop: '2px' }} />
            ) : (
              <AlertCircle size={20} style={{ color: 'rgb(239, 68, 68)', flexShrink: 0, marginTop: '2px' }} />
            )}
            <p style={{ margin: 0, fontSize: '0.9rem', color: status.type === 'success' ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)' }}>
              {status.message}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
