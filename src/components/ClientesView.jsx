import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Download, Edit2, Trash2, X, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ClientesView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);

  // Selector de Fechas para la Sincronización
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Form states
  const [editingId, setEditingId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [cuit, setCuit] = useState('');
  const [claveFiscal, setClaveFiscal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchClientes();
    // Fechas por defecto: 1 del mes hasta hoy
    const hoy = new Date();
    const diaMes = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const año = hoy.getFullYear();
    setFechaDesde(`${año}-${mes}-01`);
    setFechaHasta(`${año}-${mes}-${diaMes}`);
  }, []);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      if(!import.meta.env.VITE_SUPABASE_URL) throw new Error("No supabase config");
      const { data, error } = await supabase.from('clientes').select('*').order('id', { ascending: true });
      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error("Error fetching clientes", error);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setNombre('');
    setCuit('');
    setClaveFiscal('');
    setIsModalOpen(true);
  };

  const openEditModal = (cliente) => {
    setEditingId(cliente.id);
    setNombre(cliente.nombre);
    setCuit(cliente.cuit);
    setClaveFiscal(cliente.clave_fiscal);
    setIsEditModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if(!import.meta.env.VITE_SUPABASE_URL) throw new Error("No database connected");

      if (editingId) {
        // Edit Mode
        const { error } = await supabase
          .from('clientes')
          .update({ nombre, cuit, clave_fiscal: claveFiscal })
          .eq('id', editingId);
        
        if (error) throw error;
        setIsEditModalOpen(false);
      } else {
        // Create Mode
        const nuevoCliente = { 
          nombre, 
          cuit, 
          clave_fiscal: claveFiscal,
          estado: 'Pendiente Sincronización',
          ultima_sincronizacion: 'Nunca'
        };
        const { error } = await supabase.from('clientes').insert([nuevoCliente]);
        if (error) throw error;
        setIsModalOpen(false);
      }
      
      await fetchClientes();
    } catch (error) {
      console.error("Error guardando cliente:", error);
      alert("Hubo un error al guardar el cliente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, nombreCliente) => {
    if (window.confirm(`¿Estás seguro que deseas eliminar a ${nombreCliente}?`)) {
      try {
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) throw error;
        await fetchClientes();
      } catch (error) {
        alert("Error al eliminar: " + error.message);
      }
    }
  };

  const handleSyncAFIP = async (cliente) => {
    setSyncingId(cliente.id);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/sync-afip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cuit: cliente.cuit, 
          clave_fiscal: cliente.clave_fiscal,
          fechaDesde,
          fechaHasta
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error desconocido');

      alert(`Sincronización Exitosa para ${cliente.nombre}\nVentas Netas: $${data.ventas.totalNetoGravado}\nCompras Netas: $${data.compras.totalNetoGravado}`);
      
      // Actualizamos estado en base de datos junto con los cálculos json
      const { error } = await supabase
        .from('clientes')
        .update({ 
          estado: 'Al día', 
          ultima_sincronizacion: new Date().toLocaleString(),
          ventas_json: data.ventas,
          compras_json: data.compras
        })
        .eq('id', cliente.id);
      fetchClientes();

    } catch (error) {
      alert(`Error al sincronizar: ${error.message}`);
      await supabase.from('clientes').update({ estado: 'Error de Sync' }).eq('id', cliente.id);
      fetchClientes();
    } finally {
      setSyncingId(null);
    }
  };

  const renderModalContent = (title) => (
    <div className="card" style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
      <button 
        onClick={() => { setIsModalOpen(false); setIsEditModalOpen(false); }}
        className="icon-btn" 
        style={{ position: 'absolute', top: '1rem', right: '1rem' }}
      >
        <X size={20} />
      </button>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>{title}</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nombre o Razón Social</label>
          <input type="text" className="input-field" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>CUIT</label>
          <input type="text" className="input-field" placeholder="Ej: 20123456789" value={cuit} onChange={(e) => setCuit(e.target.value)} required />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Clave Fiscal (AFIP)</label>
          <input type="password" className="input-field" value={claveFiscal} onChange={(e) => setClaveFiscal(e.target.value)} required />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => { setIsModalOpen(false); setIsEditModalOpen(false); }} style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="content-area" style={{ position: 'relative' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Directorio de Clientes</h1>
          <p className="page-subtitle">Gestiona las conexiones a AFIP y sincroniza individualmente.</p>
        </div>
        <button className="btn btn-primary" onClick={openNewModal}>Nuevo Cliente</button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>Rango a Extraer: Desde</label>
          <input type="date" className="input-field" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>Hasta</label>
          <input type="date" className="input-field" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
        </div>
        <div style={{ flex: 1, paddingBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          * Estas fechas se inyectarán en AFIP cuando hagas clic en el botón Sincronizar de la tabla.
        </div>
      </div>

      <div className="card full-width" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando clientes...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Cliente</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>CUIT</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Última Sincronización</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Estado</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-main)' }}>{cliente.nombre}</td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)' }}>{cliente.cuit}</td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)' }}>{cliente.ultima_sincronizacion || 'Nunca'}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '20px', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      background: (cliente.estado || '').includes('Al día') ? 'var(--success-bg)' : (cliente.estado || '').includes('Error') ? 'var(--danger-bg)' : 'var(--warning)',
                      color: (cliente.estado || '').includes('Al día') ? 'var(--success)' : (cliente.estado || '').includes('Error') ? 'var(--danger)' : '#000'
                    }}>
                      {cliente.estado || 'Pendiente'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleSyncAFIP(cliente)}
                        disabled={syncingId === cliente.id}
                      >
                        <RefreshCw size={14} className={syncingId === cliente.id ? 'spin' : ''} style={{ marginRight: '4px' }} />
                        {syncingId === cliente.id ? 'Bot trabajando...' : 'Sincronizar'}
                      </button>
                      <button className="icon-btn" title="Editar Cliente" onClick={() => openEditModal(cliente)}>
                        <Edit2 size={18} />
                      </button>
                      <button className="icon-btn" style={{color: 'var(--danger)'}} title="Eliminar" onClick={() => handleDelete(cliente.id, cliente.nombre)}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay clientes registrados. ¡Agrega uno nuevo!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal overlay */}
      {(isModalOpen || isEditModalOpen) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          {isModalOpen && renderModalContent("Añadir Nuevo Cliente")}
          {isEditModalOpen && renderModalContent("Modificar Cliente")}
        </div>
      )}
    </div>
  );
}
