import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, Eye, Calendar, User, Search, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function BandejaView() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBandeja();
  }, []);

  const fetchBandeja = async () => {
    setLoading(true);
    try {
      if (!import.meta.env.VITE_SUPABASE_URL) return;
      const { data, error } = await supabase.from('clientes').select('id, nombre, cuit, ventas_json');
      if (error) throw error;
      setClientes(data || []);
    } catch (e) {
      console.error('Error fetching bandeja:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleForceScrape = async () => {
    setSyncing(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/force-ventanilla`, { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Escaneo iniciado en segundo plano.');
    } catch (err) {
      alert('Error al forzar el escaneo: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const marcarComoLeido = async (clienteId, notifId) => {
    // Actualización optimista
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente || !cliente.ventas_json || !cliente.ventas_json.notificaciones) return;

    const nuevasNotif = cliente.ventas_json.notificaciones.map(n => 
      n.id === notifId ? { ...n, leido: true } : n
    );

    const nuevasVentasJson = { ...cliente.ventas_json, notificaciones: nuevasNotif };

    setClientes(prev => prev.map(c => 
      c.id === clienteId ? { ...c, ventas_json: nuevasVentasJson } : c
    ));

    try {
      await supabase.from('clientes').update({ ventas_json: nuevasVentasJson }).eq('id', clienteId);
    } catch (error) {
      console.error('Error al actualizar estado:', error);
    }
  };

  // Filtrado y procesamiento
  const allNotifications = [];
  clientes.forEach(cliente => {
    if (cliente.ventas_json && cliente.ventas_json.notificaciones) {
      cliente.ventas_json.notificaciones.forEach(notif => {
        allNotifications.push({
          ...notif,
          clienteNombre: cliente.nombre,
          clienteCuit: cliente.cuit,
          clienteId: cliente.id
        });
      });
    }
  });

  // Ordenar: No leídos primero, luego por fecha (descendente simulado)
  allNotifications.sort((a, b) => {
    if (a.leido === b.leido) {
      // Si ambos están en el mismo estado, ordenar por ID (que es Date.now())
      return parseInt(b.id || 0) - parseInt(a.id || 0);
    }
    return a.leido ? 1 : -1;
  });

  const filteredNotifications = allNotifications.filter(n => 
    n.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.asunto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.cuit?.includes(searchTerm)
  );

  return (
    <div className="content-area">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-color)', margin: 0 }}>
            <Bell size={24} className="text-primary" />
            e-Ventanilla AFIP
          </h2>
          <p className="subtitle" style={{ margin: '0.5rem 0 0 0' }}>Bandeja de entrada centralizada de notificaciones fiscales.</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <Search size={18} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
            <input 
              type="text" 
              placeholder="Buscar cliente o asunto..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', outline: 'none', width: '200px' }}
            />
          </div>
          
          <button 
            className="btn btn-secondary" 
            onClick={fetchBandeja}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={18} />
            Actualizar
          </button>
          
          <button 
            className="btn btn-primary" 
            onClick={handleForceScrape}
            disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Mail size={18} />
            {syncing ? 'Forzando Lectura...' : 'Forzar Lectura AFIP'}
          </button>
        </div>
      </div>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader size={32} className="spin" style={{ margin: '0 auto 1rem' }} />
            <p>Cargando bandeja de entrada...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Mail size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3>No hay notificaciones</h3>
            <p>El buzón de e-Ventanilla está vacío o no hay resultados para tu búsqueda.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '1rem', width: '50px' }}>Estado</th>
                  <th style={{ padding: '1rem' }}>Cliente</th>
                  <th style={{ padding: '1rem' }}>Asunto</th>
                  <th style={{ padding: '1rem' }}>Fecha</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotifications.map((notif) => (
                  <tr key={`${notif.clienteId}-${notif.id}`} style={{ 
                    borderBottom: '1px solid var(--border-light)', 
                    background: notif.leido ? 'transparent' : 'rgba(56, 189, 248, 0.05)',
                    transition: 'background 0.2s ease'
                  }}>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ 
                        width: '10px', height: '10px', borderRadius: '50%', margin: '0 auto',
                        background: notif.leido ? 'var(--text-muted)' : 'var(--primary)',
                        boxShadow: notif.leido ? 'none' : '0 0 8px var(--primary)'
                      }}></div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: notif.leido ? 400 : 600, color: 'var(--text-color)' }}>
                        {notif.clienteNombre}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CUIT: {notif.clienteCuit}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: notif.leido ? 400 : 600, color: 'var(--text-color)' }}>{notif.asunto}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                        {notif.cuerpo}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={14} />
                        {notif.fecha}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {!notif.leido ? (
                        <button 
                          className="icon-btn" 
                          onClick={() => marcarComoLeido(notif.clienteId, notif.id)}
                          title="Marcar como Leído"
                          style={{ color: 'var(--success)', background: 'rgba(34, 197, 94, 0.1)', padding: '0.5rem', borderRadius: '6px' }}
                        >
                          <CheckCircle size={18} />
                        </button>
                      ) : (
                        <button 
                          className="icon-btn" 
                          title="Visto"
                          disabled
                          style={{ color: 'var(--text-muted)', padding: '0.5rem' }}
                        >
                          <Eye size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
