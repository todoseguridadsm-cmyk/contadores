import React, { useState, useEffect, useRef } from 'react';
import { MoreHorizontal, Download, Edit2, Trash2, X, RefreshCw, Filter, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { procesarComprobantes } from '../utils/calculos';

export const CATEGORIAS_INFO = {
  'A': { label: 'Tipo A - Gran Contribuyente', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  'B': { label: 'Tipo B - Resp. Inscripto', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  'C': { label: 'Tipo C - Monotributo / Pyme', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  'D': { label: 'Tipo D - Exento / Eventual', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  'E': { label: 'Tipo E - Observación / Especial', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }
};

export function getCategoriaCliente(cliente) {
  if (!cliente) return 'A';
  return cliente.categoria || localStorage.getItem(`cliente_cat_${cliente.id}`) || 'A';
}

export function obtenerCodigo3DCliente(cliente, idx = 0) {
  if (!cliente) return '000';
  if (cliente.codigo_3d) return String(cliente.codigo_3d).padStart(3, '0');
  if (cliente.nro_cliente) return String(cliente.nro_cliente).padStart(3, '0');
  if (cliente.id && !isNaN(Number(cliente.id))) return String(cliente.id).padStart(3, '0');
  
  if (cliente.id && typeof cliente.id === 'string') {
    let hash = 0;
    for (let i = 0; i < cliente.id.length; i++) {
      hash = cliente.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const num = Math.abs(hash % 900) + 100;
    return String(num).padStart(3, '0');
  }

  const num = (idx + 101);
  return String(num).padStart(3, '0');
}

export default function ClientesView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [selectedClients, setSelectedClients] = useState([]);

  // Filtros y Orden
  const [filtroCategoria, setFiltroCategoria] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [ordenDirectorio, setOrdenDirectorio] = useState('alfabetico'); // 'alfabetico' | 'numerico'

  // Bulk Sync states
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [bulkStatusText, setBulkStatusText] = useState('');
  const cancelBulkRef = useRef(false);

  // ATM Upload
  const fileInputRef = useRef(null);
  const [atmUploadClienteId, setAtmUploadClienteId] = useState(null);

  // Selector de Fechas para la Sincronización
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [cuit, setCuit] = useState('');
  const [claveFiscal, setClaveFiscal] = useState('');
  const [claveAtm, setClaveAtm] = useState('');
  const [tipoContribuyente, setTipoContribuyente] = useState('FISICA');
  const [cuitRepresentante, setCuitRepresentante] = useState('');
  const [categoria, setCategoria] = useState('A');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQuickChangeCategoria = async (clienteId, cat) => {
    localStorage.setItem(`cliente_cat_${clienteId}`, cat);
    setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, categoria: cat } : c));
    try {
      await supabase.from('clientes').update({ categoria: cat }).eq('id', clienteId);
    } catch (e) {
      // Ignora si la columna categoria no se creó en DB aún, ya está en localStorage
    }
  };

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
    setClaveAtm('');
    setTipoContribuyente('FISICA');
    setCuitRepresentante('');
    setCategoria('A');
    setIsModalOpen(true);
  };

  const openEditModal = (cliente) => {
    setEditingId(cliente.id);
    setNombre(cliente.nombre);
    setCuit(cliente.cuit);
    setClaveFiscal(cliente.clave_fiscal);
    setClaveAtm(cliente.clave_atm || '');
    setTipoContribuyente(cliente.tipo_contribuyente || 'FISICA');
    setCuitRepresentante(cliente.cuit_representante || '');
    setCategoria(getCategoriaCliente(cliente));
    setIsEditModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if(!import.meta.env.VITE_SUPABASE_URL) throw new Error("No database connected");

      if (editingId) {
        localStorage.setItem(`cliente_cat_${editingId}`, categoria);
        const { error } = await supabase
          .from('clientes')
          .update({ nombre, cuit, clave_fiscal: claveFiscal, clave_atm: claveAtm, tipo_contribuyente: tipoContribuyente, cuit_representante: cuitRepresentante, categoria })
          .eq('id', editingId);
        
        if (error) {
           if (error.message.includes('categoria')) {
             await supabase
               .from('clientes')
               .update({ nombre, cuit, clave_fiscal: claveFiscal, clave_atm: claveAtm, tipo_contribuyente: tipoContribuyente, cuit_representante: cuitRepresentante })
               .eq('id', editingId);
           } else if (error.message.includes('tipo_contribuyente') || error.message.includes('cuit_representante')) {
               alert("Debes agregar las columnas 'tipo_contribuyente' y 'cuit_representante' (ambas tipo texto) a tu tabla 'clientes' en Supabase para usar esta función.");
           } else throw error;
        }
        setIsEditModalOpen(false);
      } else {
        const nuevoCliente = { 
          nombre, 
          cuit, 
          clave_fiscal: claveFiscal,
          clave_atm: claveAtm,
          tipo_contribuyente: tipoContribuyente,
          cuit_representante: cuitRepresentante,
          categoria,
          estado: 'Pendiente Sincronización',
          ultima_sincronizacion: 'Nunca'
        };
        const { error, data } = await supabase.from('clientes').insert([nuevoCliente]).select();
        if (error) {
           if (error.message.includes('categoria')) {
             const fallbackCliente = {
               nombre, cuit, clave_fiscal: claveFiscal, tipo_contribuyente: tipoContribuyente, cuit_representante: cuitRepresentante, estado: 'Pendiente Sincronización', ultima_sincronizacion: 'Nunca'
             };
             const { data: d2 } = await supabase.from('clientes').insert([fallbackCliente]).select();
             if (d2 && d2[0]) {
               localStorage.setItem(`cliente_cat_${d2[0].id}`, categoria);
             }
           } else if (error.message.includes('tipo_contribuyente') || error.message.includes('cuit_representante')) {
               alert("Debes agregar las columnas 'tipo_contribuyente' y 'cuit_representante' (ambas tipo texto) a tu tabla 'clientes' en Supabase para usar esta función.");
           } else throw error;
        } else if (data && data[0]) {
          localStorage.setItem(`cliente_cat_${data[0].id}`, categoria);
        }
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

      // 1. Obtener los comprobantes cargados por foto en base de datos para no pisarlos
      const { data: dbCliente } = await supabase
        .from('clientes')
        .select('compras_json, ventas_json')
        .eq('id', cliente.id)
        .single();
      
      const comprasPrevias = dbCliente?.compras_json?.lista || [];
      const ventasPrevias = dbCliente?.ventas_json?.lista || [];

      // Filtrar los que son de origen 'foto'
      const fotosCompras = comprasPrevias.filter(item => item.origen === 'foto');
      const fotosVentas = ventasPrevias.filter(item => item.origen === 'foto');

      // Marcar los de AFIP con origen 'afip'
      const afipCompras = (data.compras.lista || []).map(item => ({ ...item, origen: 'afip' }));
      const afipVentas = (data.ventas.lista || []).map(item => ({ ...item, origen: 'afip' }));

      // Unificar y recalcular totales
      const comprasUnificadas = [...fotosCompras, ...afipCompras];
      const ventasUnificadas = [...fotosVentas, ...afipVentas];

      const comprasFinal = procesarComprobantes(comprasUnificadas);
      const ventasFinal = procesarComprobantes(ventasUnificadas);

      // Conservamos cualquier otra información (ej: notificaciones) que esté dentro de ventas_json
      const ventasGuardar = {
        ...ventasFinal,
        notificaciones: dbCliente?.ventas_json?.notificaciones || [],
        historial_anual: dbCliente?.ventas_json?.historial_anual || {}
      };

      setSyncProgress(100);
      if (!isBulk) {
        setTimeout(() => {
          alert(`Sincronización Exitosa para ${cliente.nombre}\nVentas Netas: $${ventasFinal.totalNetoGravado}\nCompras Netas: $${comprasFinal.totalNetoGravado}`);
        }, 100);
      }
      
      // Actualizamos estado en base de datos junto con los cálculos json unificados
      const { error } = await supabase
        .from('clientes')
        .update({ 
          estado: 'Al día', 
          ultima_sincronizacion: new Date().toLocaleString(),
          ventas_json: ventasGuardar,
          compras_json: comprasFinal
        })
        .eq('id', cliente.id);
      await fetchClientes();

    } catch (error) {
      let errorMsg = error.message;
      if (errorMsg.includes('buscadorInput') || errorMsg.includes('cartel bloqueante') || errorMsg.includes('ARCA')) {
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

  const handleSyncATM = (cliente) => {
    setAtmUploadClienteId(cliente.id);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleATMFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !atmUploadClienteId) return;

    const cliente = clientes.find(c => c.id === atmUploadClienteId);
    setSyncingId(`atm-${cliente.id}`);
    
    try {
      const formData = new FormData();
      formData.append('atmFile', file);
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/upload-atm-test`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error subiendo archivo');
      
      alert("¡Archivo subido exitosamente al servidor para que el Bot lo analice!\nPor favor, decile a la IA que el archivo ya está subido.");
    } catch (error) {
      alert(`⚠️ ERROR AL SUBIR ARCHIVO ATM\n\n${error.message}`);
    } finally {
      setSyncingId(null);
      setAtmUploadClienteId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-main)' }}>Tipo de Contribuyente</label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="radio" value="FISICA" checked={tipoContribuyente === 'FISICA'} onChange={(e) => setTipoContribuyente(e.target.value)} />
              Persona Física
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="radio" value="JURIDICA" checked={tipoContribuyente === 'JURIDICA'} onChange={(e) => setTipoContribuyente(e.target.value)} />
              Persona Jurídica (Empresa)
            </label>
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-main)' }}>{tipoContribuyente === 'JURIDICA' ? 'Nombre Fantasía / Responsable' : 'Nombre Completo'}</label>
          <input type="text" className="input-field" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-main)' }}>CUIT {tipoContribuyente === 'JURIDICA' ? 'de la Empresa' : ''}</label>
          <input type="text" className="input-field" value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="Sin guiones" required />
        </div>
        {tipoContribuyente === 'JURIDICA' && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-main)' }}>CUIT Representante Legal</label>
            <input type="text" className="input-field" value={cuitRepresentante} onChange={(e) => setCuitRepresentante(e.target.value)} placeholder="Sin guiones" required />
          </div>
        )}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-main)' }}>Categoría / Tipo de Cliente</label>
          <select className="input-field" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="A">Tipo A - Gran Contribuyente / Prioridad Alta</option>
            <option value="B">Tipo B - Responsable Inscripto Estándar</option>
            <option value="C">Tipo C - Monotributo / Pyme</option>
            <option value="D">Tipo D - Exento / Eventual</option>
            <option value="E">Tipo E - Observación / Especial</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-main)' }}>Clave Fiscal (AFIP)</label>
          <input type="password" className="input-field" value={claveFiscal} onChange={(e) => setClaveFiscal(e.target.value)} required />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-main)' }}>Clave ATM (Mendoza) <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Opcional)</span></label>
          <input type="password" className="input-field" value={claveAtm} onChange={(e) => setClaveAtm(e.target.value)} placeholder="Dejar en blanco si ingresas por AFIP" />
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

  const clientesFiltrados = clientes.filter(cliente => {
    const cat = getCategoriaCliente(cliente);
    const coincideCategoria = filtroCategoria === 'TODOS' || cat === filtroCategoria;
    
    const cleanSearch = searchTerm.trim().toLowerCase().replace(/\D/g, '');
    const cleanCuit = (cliente.cuit || '').replace(/\D/g, '');
    
    const coincideTexto = !searchTerm || 
      (cliente.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (cleanSearch && cleanCuit.includes(cleanSearch)) ||
      cliente.cuit?.includes(searchTerm) ||
      cliente.id?.toString() === searchTerm ||
      obtenerCodigo3DCliente(cliente).includes(searchTerm);
    return coincideCategoria && coincideTexto;
  });

  return (
    <div className="content-area" style={{ position: 'relative' }}>
      {/* Hidden File Input para ATM */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".xls,.xlsx,.csv,.txt" 
        onChange={handleATMFileUpload} 
      />
      
      <div className="page-header">
        <div>
          <h1 className="page-title">Directorio de Clientes</h1>
          <p className="page-subtitle">Gestiona las conexiones a AFIP, categoriza por Tipo (A-E) y sincroniza individualmente.</p>
        </div>
        <button className="btn btn-primary" onClick={openNewModal}>Nuevo Cliente</button>
      </div>

      {/* Barra de Filtros por Categoría y Búsqueda */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Filter size={16} /> FILTRAR POR TIPO:
            </span>
            <button 
              className={`btn ${filtroCategoria === 'TODOS' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFiltroCategoria('TODOS')}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
            >
              Todos ({clientes.length})
            </button>
            {Object.keys(CATEGORIAS_INFO).map(catKey => {
              const count = clientes.filter(c => getCategoriaCliente(c) === catKey).length;
              return (
                <button
                  key={catKey}
                  onClick={() => setFiltroCategoria(catKey)}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${CATEGORIAS_INFO[catKey].color}`,
                    background: filtroCategoria === catKey ? CATEGORIAS_INFO[catKey].color : CATEGORIAS_INFO[catKey].bg,
                    color: filtroCategoria === catKey ? '#fff' : CATEGORIAS_INFO[catKey].color,
                    transition: 'all 0.2s'
                  }}
                >
                  Tipo {catKey} ({count})
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Buscar por nombre, CUIT o #ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.25rem', width: '100%', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Ordenar por:</span>
            <select
              className="input-field"
              value={ordenDirectorio}
              onChange={e => setOrdenDirectorio(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem', fontWeight: 700 }}
            >
              <option value="alfabetico">Alfabético (A - Z)</option>
              <option value="numerico">N° Cliente (#001 - #999)</option>
              <option value="cuit">CUIT (Menor a Mayor)</option>
            </select>
          </div>
        </div>
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

      <div className="card full-width" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando clientes...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '920px' }}>
            <thead style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '0.75rem 0.6rem', width: '36px' }}>
                  <input 
                    type="checkbox" 
                    checked={clientesFiltrados.length > 0 && selectedClients.length === clientesFiltrados.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedClients(clientesFiltrados.map(c => c.id));
                      } else {
                        setSelectedClients([]);
                      }
                    }}
                    style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                  />
                </th>
                <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cód.</th>
                <th style={{ padding: '0.75rem 0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>Cliente</th>
                <th style={{ padding: '0.75rem 0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>Categoría</th>
                <th style={{ padding: '0.75rem 0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>CUIT</th>
                <th style={{ padding: '0.75rem 0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>Última Sinc.</th>
                <th style={{ padding: '0.75rem 0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>Estado</th>
                <th style={{ padding: '0.75rem 0.8rem', textAlign: 'right', minWidth: '190px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados
              .sort((a, b) => {
                if (ordenDirectorio === 'numerico') {
                  const codA = obtenerCodigo3DCliente(a, clientes.indexOf(a));
                  const codB = obtenerCodigo3DCliente(b, clientes.indexOf(b));
                  return codA.localeCompare(codB);
                }
                if (ordenDirectorio === 'cuit') {
                  return (a.cuit || '').localeCompare(b.cuit || '');
                }
                return (a.nombre || '').localeCompare(b.nombre || '');
              })
              .map((cliente) => {
                const cod3d = obtenerCodigo3DCliente(cliente, clientes.indexOf(cliente));
                return (
                <tr key={cliente.id} style={{ borderBottom: '1px solid var(--border-light)', background: selectedClients.includes(cliente.id) ? 'var(--secondary-bg)' : 'transparent' }}>
                  <td style={{ padding: '0.75rem 0.6rem' }}>
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
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: 'var(--primary)' }}>#{cod3d}</td>
                  <td style={{ padding: '0.75rem 0.6rem', fontWeight: 600, color: 'var(--text-main)' }}>{cliente.nombre}</td>
                  <td style={{ padding: '0.75rem 0.6rem' }}>
                    <select
                      value={getCategoriaCliente(cliente)}
                      onChange={(e) => handleQuickChangeCategoria(cliente.id, e.target.value)}
                      style={{
                        background: CATEGORIAS_INFO[getCategoriaCliente(cliente)]?.bg || 'var(--bg-main)',
                        color: CATEGORIAS_INFO[getCategoriaCliente(cliente)]?.color || 'var(--text-main)',
                        border: `1px solid ${CATEGORIAS_INFO[getCategoriaCliente(cliente)]?.color}`,
                        borderRadius: '8px',
                        padding: '0.25rem 0.45rem',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="A">Tipo A - Gran Contrib.</option>
                      <option value="B">Tipo B - Resp. Inscripto</option>
                      <option value="C">Tipo C - Monotributo</option>
                      <option value="D">Tipo D - Exento</option>
                      <option value="E">Tipo E - Observación</option>
                    </select>
                  </td>
                  <td style={{ padding: '0.75rem 0.6rem', color: 'var(--text-muted)' }}>{cliente.cuit}</td>
                  <td style={{ padding: '0.75rem 0.6rem', color: 'var(--text-muted)' }}>{cliente.ultima_sincronizacion || 'Nunca'}</td>
                  <td style={{ padding: '0.75rem 0.6rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.65rem', 
                      borderRadius: '20px', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      background: (cliente.estado || '').includes('Al día') ? 'var(--success-bg)' : (cliente.estado || '').includes('Error') ? 'var(--danger-bg)' : 'var(--warning)',
                      color: (cliente.estado || '').includes('Al día') ? 'var(--success)' : (cliente.estado || '').includes('Error') ? 'var(--danger)' : '#000'
                    }}>
                      {cliente.estado || 'Pendiente'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ 
                          padding: '0.25rem 0.5rem', 
                          fontSize: '0.75rem',
                          position: 'relative',
                          overflow: 'hidden',
                          border: '1px solid var(--border-color)',
                          background: syncingId === `atm-${cliente.id}` ? 'var(--secondary-bg)' : 'transparent',
                          color: syncingId === `atm-${cliente.id}` ? '#fff' : 'var(--primary)',
                          minWidth: '90px'
                        }}
                        onClick={() => handleSyncATM(cliente)}
                        disabled={syncingId === `atm-${cliente.id}` || syncingId === cliente.id}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, position: 'relative' }}>
                          <RefreshCw size={14} className={syncingId === `atm-${cliente.id}` ? 'spin' : ''} style={{ marginRight: '4px' }} />
                          {syncingId === `atm-${cliente.id}` ? `ATM...` : 'ATM'}
                        </div>
                      </button>
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
                        disabled={syncingId === cliente.id || syncingId === `atm-${cliente.id}`}
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
                          {syncingId === cliente.id ? `Trabajando... ${syncProgress}%` : 'AFIP'}
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
              );
            })}
              {clientes.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
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
