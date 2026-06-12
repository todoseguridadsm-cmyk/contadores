import React, { useState } from 'react';
import { Lock, User, Receipt, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      // 1. Verificar la Llave Maestra (Súper Administrador Hardcodeado)
      if (username === 'Contadorpro' && password === 'BRN2347') {
        const superUser = {
          id: 'superadmin',
          username: 'Contadorpro',
          role: 'superadmin',
          permisos: ['dashboard', 'clientes', 'tickets', 'usuarios']
        };
        onLoginSuccess(superUser);
        setLoading(false);
        return;
      }

      // 2. Si no es el Maestro, verificar en la base de datos de Empleados
      if(!import.meta.env.VITE_SUPABASE_URL) {
        throw new Error("Sin conexión a la base de datos");
      }

      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        throw new Error("Usuario o contraseña incorrectos");
      }

      // Si el empleado existe, lo logueamos
      onLoginSuccess({
        id: data.id,
        username: data.username,
        role: data.role,
        permisos: data.permisos || []
      });

    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      minHeight: '100vh', width: '100vw', background: 'var(--bg-main)',
      position: 'absolute', top: 0, left: 0, zIndex: 9999
    }}>
      <div className="card glass" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', 
            background: 'var(--primary-glow)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' 
          }}>
            <Receipt size={40} className="primary-text" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Acceso Restringido</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            CRM ContadoresPro
          </p>
        </div>

        {errorMsg && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', 
            color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', 
            marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' 
          }}>
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>Usuario</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="input-field" 
                style={{ paddingLeft: '2.5rem', width: '100%' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="password" 
                className="input-field" 
                style={{ paddingLeft: '2.5rem', width: '100%' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', fontSize: '1rem', padding: '0.75rem' }}
            disabled={loading}
          >
            {loading ? 'Verificando...' : 'Ingresar al Sistema'}
          </button>
        </form>
        
      </div>
    </div>
  );
}
