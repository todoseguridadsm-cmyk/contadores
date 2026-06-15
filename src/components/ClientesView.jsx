import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Download, Edit2, Trash2, X, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ClientesView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [selectedClients, setSelectedClients] = useState([]);

  // Bulk Sync states
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [bulkStatusText, setBulkStatusText] = useState('');
  const cancelBulkRef = React.useRef(false);

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

  useEffect(() => {
    let interval;
    if (syncingId) {
      setSyncProgress(0);
      interval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 95) return 95; // Stop at 95% until done
          return prev + 1;
        });
      }, 1200); // 1% cada 1.2 segundos = ~114 segundos para llegar al 95%
    } else {
      setSyncProgress(0);
    }
    return () => clearInterval(interval);
  }, [syncingId]);

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

  const handleBulkSync = async () => {
    const clientsToSync = selectedClients.length > 0 
      ? clientes.filter(c => selectedClients.includes(c.id))
      : clientes;

    if (clientsToSync.length === 0) return;
    
    if (!window.confirm(`¿Iniciar sincronización en cola lenta para ${clientsToSync.length} clientes?\n\nEl sistema procesará uno, esperará 2 minutos para burlar a AFIP, y seguirá con el próximo. Puedes dejar la pestaña abierta e irte a tomar un café.`)) return;
    
    setIsBulkSyncing(true);
    cancelBulkRef.current = false;
    
    for (let i = 0; i < clientsToSync.length; i++) {
      if (cancelBulkRef.current) break;
      
      const cliente = clientsToSync[i];
      setBulkStatusText(`Sincronizando ${i + 1}/${clientsToSync.length}: ${cliente.nombre}...`);
      
      await handleSyncAFIP(cliente, true);
      
      if (i < clientsToSync.length - 1 && !cancelBulkRef.current) {
        // Pausa de 120 segundos
        for (let s = 120; s > 0; s--) {
          if (cancelBulkRef.current) break;
          setBulkStatusText(`Descanso de seguridad AFIP... Próximo en ${s} segs`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    
    setBulkStatusText('');
    setIsBulkSyncing(false);
    if (!cancelBulkRef.current) {
      alert('¡Sincronización Masiva Completada!');
    }
  };

  const cancelBulkSync = () => {
    cancelBulkRef.current = true;
    setBulkStatusText('Cancelando... (terminará la operación actual y se detendrá)');
  };

  const handleSyncAFIP = async (cliente, isBulk = false) => {
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

      setSyncProgress(100);
      if (!isBulk) {
        setTimeout(() => {
          alert(`Sincronización Exitosa para ${cliente.nombre}\nVentas Netas: $${data.ventas.totalNetoGravado}\nCompras Netas: $${data.compras.totalNetoGravado}`);
        }, 100);
      }
      
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
      await fetchClientes();

    } catch (error) {
      let errorMsg = error.message;
      if (errorMsg.includes('buscadorInput')) {
        errorMsg = 'AFIP requiere acción manual.\nInicia sesión en afip.gob.ar con este CUIT y cierra el cartel de aviso o completa el trámite obligatorio que está bloqueando la pantalla de inicio. Luego intenta sincronizar de nuevo.\n\nINFO TÉCNICA (DEBUG):\n' + errorMsg;
      } else if (errorMsg.includes('Emitidos') || errorMsg.includes('Recibidos') || errorMsg.includes('Mis Comprobantes no esté adherido')) {
        errorMsg = 'El cliente no tiene habilitado el servicio de "Mis Comprobantes" en AFIP, o su sesión requiere validación manual.';
      } else if (errorMsg.includes('Timeout') || errorMsg.includes('timeout') || errorMsg.includes('30000ms')) {
        errorMsg = 'La AFIP está demorando demasiado en responder o está caída. Intenta nuevamente más tarde.';
      } else if (errorMsg.toLowerCase().includes('clave') || errorMsg.toLowerCase().includes('login')) {
        errorMsg = 'La Clave Fiscal es incorrecta o ha expirado. Por favor, verifica las credenciales.';
      }

      if (!isBulk) {
        alert(`⚠️ ALERTA DE SINCRONIZACIÓN\n\n${errorMsg}`);
      } else {
        console.error(`Error bulk sync para ${cliente.nombre}: ${errorMsg}`);
      }
      await supabase.from('clientes').update({ estado: 'Error de Sync' }).eq('id', cliente.id);
      await fetchClientes();
    } finally {
      setSyncingId(null);
      setSyncProgress(0);
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

      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>Rango a Extraer: Desde</label>
          <input type="date" className="input-field" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>Hasta</label>
          <input type="date" className="input-field" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
        </div>
        <div style={{ flex: 1, paddingBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          * Estas fechas se inyectarán en AFIP al sincronizar.
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
          {isBulkSyncing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--warning-bg)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--warning)' }}>
              <span style={{ fontWeight: 600, color: '#000', fontSize: '0.9rem' }}>{bulkStatusText}</span>
              <button className="btn btn-secondary" onClick={cancelBulkSync} style={{ border: '1px solid var(--danger)', color: 'var(--danger)', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>
                Detener Cola
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={handleBulkSync} disabled={clientes.length === 0 || syncingId !== null}>
              {selectedClients.length > 0 ? `Sincronizar Seleccionados (${selectedClients.length})` : 'Sincronizar a Todos (Cola Lenta)'}
            </button>
          )}
        </div>
      </div>

      <div className="card full-width" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando clientes...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '1rem 1.5rem', width: '40px' }}>
                  <input 
                    type="checkbox" 
                    checked={clientes.length > 0 && selectedClients.length === clientes.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedClients(clientes.map(c => c.id));
                      } else {
                        setSelectedClients([]);
                      }
                    }}
                    style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                  />
                </th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Cliente</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>CUIT</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Última Sincronización</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Estado</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id} style={{ borderBottom: '1px solid var(--border-light)', background: selectedClients.includes(cliente.id) ? 'var(--secondary-bg)' : 'transparent' }}>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedClients.includes(cliente.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedClients([...selectedClients, cliente.id]);
                        } else {
                          setSelectedClients(selectedClients.filter(id => id !== cliente.id));
                        }
                      }}
                      style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    />
                  </td>
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
                        style={{ 
                          padding: '0.25rem 0.5rem', 
                          fontSize: '0.75rem',
                          position: 'relative',
                          overflow: 'hidden',
                          border: '1px solid var(--border-color)',
                          background: syncingId === cliente.id ? 'var(--secondary-bg)' : 'transparent',
                          color: syncingId === cliente.id ? '#fff' : 'inherit',
                          minWidth: '130px'
                        }}
                        onClick={() => handleSyncAFIP(cliente)}
                        disabled={syncingId === cliente.id}
                      >
                        {syncingId === cliente.id && (
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${syncProgress}%`,
                            backgroundColor: 'var(--success)',
                            zIndex: 0,
                            transition: 'width 0.5s ease',
                            opacity: 0.8
                          }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, position: 'relative', textShadow: syncingId === cliente.id ? '0 1px 2px rgba(0,0,0,0.5)' : 'none' }}>
                          <RefreshCw size={14} className={syncingId === cliente.id ? 'spin' : ''} style={{ marginRight: '4px' }} />
                          {syncingId === cliente.id ? `Trabajando... ${syncProgress}%` : 'Sincronizar'}
                        </div>
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
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
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
