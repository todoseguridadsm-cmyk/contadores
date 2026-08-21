import React, { useState, useEffect } from 'react';
import { Database, Filter, Search, Calendar, TrendingUp, TrendingDown, DollarSign, Download, Eye, X, Edit3, Save, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CATEGORIAS_INFO, getCategoriaCliente, obtenerCodigo3DCliente } from './ClientesView';
import { exportarPlanillaAnual12MesesExcel } from '../utils/exportacion';

export default function AnualView() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [anioSeleccionado, setAnioSeleccionado] = useState(String(new Date().getFullYear()));
  
  // Cliente activo para ver y editar su planilla de 12 meses idéntica al Excel del contador
  const [clienteActivoId, setClienteActivoId] = useState('');
  const [edicionActiva, setEdicionActiva] = useState(false);
  const [guardandoPlanilla, setGuardandoPlanilla] = useState(false);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      if (!import.meta.env.VITE_SUPABASE_URL) return;
      const { data, error } = await supabase.from('clientes').select('*').order('nombre', { ascending: true });
      if (!error) {
        setClientes(data || []);
        if (data && data.length > 0 && !clienteActivoId) {
          setClienteActivoId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [clientSearchText, setClientSearchText] = useState('');
  const clienteSeleccionado = clientes.find(c => c.id == clienteActivoId) || null;

  useEffect(() => {
    if (clienteSeleccionado) {
      setClientSearchText(clienteSeleccionado.nombre);
    } else {
      setClientSearchText('');
    }
  }, [clienteActivoId, clientes]);

  const handleQuickChangeCategoria = async (clienteId, cat) => {
    localStorage.setItem(`cliente_cat_${clienteId}`, cat);
    setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, categoria: cat } : c));
    try {
      await supabase.from('clientes').update({ categoria: cat }).eq('id', clienteId);
    } catch (err) {}
  };

  const obtenerHistorialCliente = (cliente) => {
    if (!cliente) return {};
    return cliente.historial_anual || (cliente.ventas_json && cliente.ventas_json.historial_anual) || {};
  };

  const obtener12MesesCliente = (cliente) => {
    const historial = obtenerHistorialCliente(cliente);
    const anioData = historial[anioSeleccionado] || {};
    const mesesArray = [];
    for (let i = 1; i <= 12; i++) {
      const mesData = anioData[String(i)] || {};
      mesesArray.push({
        mes: i,
        ventasNeto: Number(mesData.ventasNeto || 0),
        ventasIva: Number(mesData.ventasIva || 0),
        comprasNeto: Number(mesData.comprasNeto || 0),
        comprasIva: Number(mesData.comprasIva || 0)
      });
    }
    return mesesArray;
  };

  const handleCambioCeldaMes = (mesIndex, campo, valor) => {
    if (!clienteSeleccionado) return;
    const historial = { ...obtenerHistorialCliente(clienteSeleccionado) };
    const anioData = { ...(historial[anioSeleccionado] || {}) };
    const mesKey = String(mesIndex + 1);
    const mesObj = { ...(anioData[mesKey] || {}) };
    mesObj[campo] = Number(valor) || 0;
    anioData[mesKey] = mesObj;
    historial[anioSeleccionado] = anioData;

    setClientes(prev => prev.map(c => c.id === clienteSeleccionado.id ? { ...c, historial_anual: historial } : c));
  };

  const handleGuardarPlanillaEnNube = async () => {
    if (!clienteSeleccionado) return;
    setGuardandoPlanilla(true);
    try {
      const historial = obtenerHistorialCliente(clienteSeleccionado);
      await supabase
        .from('clientes')
        .update({ historial_anual: historial })
        .eq('id', clienteSeleccionado.id);

      const ventasData = { ...(clienteSeleccionado.ventas_json || {}), historial_anual: historial };
      await supabase
        .from('clientes')
        .update({ ventas_json: ventasData })
        .eq('id', clienteSeleccionado.id);

      alert(`✅ ¡Planilla 12 Meses de ${clienteSeleccionado.nombre} guardada exitosamente en la nube!`);
      setEdicionActiva(false);
    } catch (e) {
      alert("Error al guardar en Supabase: " + e.message);
    } finally {
      setGuardandoPlanilla(false);
    }
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(amount) || 0);

  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const datos12Meses = clienteSeleccionado ? obtener12MesesCliente(clienteSeleccionado) : [];
  const totalVentasNeto = datos12Meses.reduce((acc, m) => acc + m.ventasNeto, 0);
  const totalVentasIva = datos12Meses.reduce((acc, m) => acc + m.ventasIva, 0);
  const totalComprasNeto = datos12Meses.reduce((acc, m) => acc + m.comprasNeto, 0);
  const totalComprasIva = datos12Meses.reduce((acc, m) => acc + m.comprasIva, 0);

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
      <div className="page-header">
        <div>
          <h1 className="page-title">Resumen Anual de 12 Meses</h1>
          <p className="page-subtitle">Planilla contable con los 12 meses (VENTAS | IVA DF | COMPRAS | IVA CF) y totales anualizados en la nube.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>AÑO FISCAL:</label>
          <select
            className="input-field"
            value={anioSeleccionado}
            onChange={e => setAnioSeleccionado(e.target.value)}
            style={{ fontWeight: 700, fontSize: '0.95rem', padding: '0.4rem 1rem' }}
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        </div>
      </div>

      {/* Directorio General de todos los clientes con su Resumen Anualizado */}
      <div className="card full-width" style={{ padding: 0, overflow: 'hidden', marginBottom: '2.5rem' }}>
        <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Filter size={16} /> FILTRAR CARTERA POR CATEGORÍA:
            </span>
            <button
              className={`btn ${filtroCategoria === 'TODOS' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFiltroCategoria('TODOS')}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
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
                    padding: '0.3rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${CATEGORIAS_INFO[catKey].color}`,
                    background: filtroCategoria === catKey ? CATEGORIAS_INFO[catKey].color : CATEGORIAS_INFO[catKey].bg,
                    color: filtroCategoria === catKey ? '#fff' : CATEGORIAS_INFO[catKey].color
                  }}
                >
                  Tipo {catKey} ({count})
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative', width: '250px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Buscar cliente por nombre..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.25rem', width: '100%', fontSize: '0.82rem' }}
            />
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
            <tr>
              <th style={{ padding: '0.85rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cliente</th>
              <th style={{ padding: '0.85rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Categoría</th>
              <th style={{ padding: '0.85rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Neto Ventas Anual</th>
              <th style={{ padding: '0.85rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Neto Compras Anual</th>
              <th style={{ padding: '0.85rem 1.5rem', textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.map(c => {
              const meses = obtener12MesesCliente(c);
              const totalV = meses.reduce((acc, m) => acc + m.ventasNeto, 0);
              const totalC = meses.reduce((acc, m) => acc + m.comprasNeto, 0);
              const cat = getCategoriaCliente(c);

              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-light)', background: c.id == clienteActivoId ? 'var(--secondary-bg)' : 'transparent' }}>
                  <td style={{ padding: '0.85rem 1.5rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--primary)', marginRight: '0.5rem' }}>#{obtenerCodigo3DCliente(c)}</span>{c.nombre}
                  </td>
                  <td style={{ padding: '0.85rem 1.5rem' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      background: CATEGORIAS_INFO[cat]?.bg,
                      color: CATEGORIAS_INFO[cat]?.color
                    }}>
                      Tipo {cat}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                    {formatMoney(totalV)}
                  </td>
                  <td style={{ padding: '0.85rem 1.5rem', textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>
                    {formatMoney(totalC)}
                  </td>
                  <td style={{ padding: '0.85rem 1.5rem', textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setClienteActivoId(c.id);
                        setTimeout(() => document.getElementById('planilla-anual')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                      }}
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      <Eye size={16} /> Ver su Planilla 12 Meses
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      
      {/* Selector de Cliente Principal para ver su Planilla de 12 Meses */}
      <div id="planilla-anual" className="card" style={{ marginBottom: '1.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>SELECCIONAR CLIENTE PARA PLANILLA ANUAL:</span>
            <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
              <input 
                list="anual-clientes-list"
                className="input-field" 
                placeholder="Escribe nombre, CUIT o #ID..."
                value={clientSearchText}
                onChange={(e) => {
                  const val = e.target.value;
                  setClientSearchText(val);
                  const match = clientes.find(c => c.nombre === val || `${c.nombre} (CUIT: ${c.cuit})` === val || c.id == val || String(c.id) === val || c.cuit === val);
                  if (match) setClienteActivoId(match.id);
                }}
                style={{ width: '100%', fontWeight: 700, fontSize: '0.95rem' }}
              />
              <datalist id="anual-clientes-list">
                {clientes.map(c => {
                  const cod3d = obtenerCodigo3DCliente(c);
                  return (
                    <option key={c.id} value={c.nombre}>
                      #{cod3d} - [Tipo {getCategoriaCliente(c)}] (CUIT: {c.cuit})
                    </option>
                  );
                })}
              </datalist>
            </div>
          </div>

          {clienteSeleccionado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <select
                value={getCategoriaCliente(clienteSeleccionado)}
                onChange={(e) => handleQuickChangeCategoria(clienteSeleccionado.id, e.target.value)}
                style={{
                  background: CATEGORIAS_INFO[getCategoriaCliente(clienteSeleccionado)]?.bg || 'var(--bg-main)',
                  color: CATEGORIAS_INFO[getCategoriaCliente(clienteSeleccionado)]?.color || 'var(--text-main)',
                  border: `1px solid ${CATEGORIAS_INFO[getCategoriaCliente(clienteSeleccionado)]?.color}`,
                  borderRadius: '8px',
                  padding: '0.45rem 0.85rem',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <option value="A">Tipo A - Gran Contribuyente</option>
                <option value="B">Tipo B - Resp. Inscripto</option>
                <option value="C">Tipo C - Monotributo</option>
                <option value="D">Tipo D - Exento</option>
                <option value="E">Tipo E - Observación</option>
              </select>

              <button
                className={`btn ${edicionActiva ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEdicionActiva(!edicionActiva)}
              >
                <Edit3 size={16} /> {edicionActiva ? 'Cerrar Edición' : 'Editar Mes a Mes'}
              </button>

              {edicionActiva && (
                <button
                  className="btn btn-primary"
                  onClick={handleGuardarPlanillaEnNube}
                  disabled={guardandoPlanilla}
                  style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                >
                  <Save size={16} /> {guardandoPlanilla ? 'Guardando en Nube...' : 'Guardar Cambios en Nube'}
                </button>
              )}

              <button
                className="btn btn-secondary"
                onClick={() => exportarPlanillaAnual12MesesExcel(clienteSeleccionado.nombre, anioSeleccionado, datos12Meses)}
                title="Exportar Planilla 12 Meses a Excel"
              >
                <FileSpreadsheet size={16} style={{ color: 'var(--success)' }} /> Exportar a Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PLANILLA ANUAL DE 12 MESES (Idéntica a la vista solicitada por el contador) */}
      {clienteSeleccionado && (
        <div className="card full-width" style={{ padding: 0, overflow: 'hidden', marginBottom: '2.5rem', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '1.25rem 1.5rem', background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Planilla Anual de 12 Meses ({anioSeleccionado}) — {clienteSeleccionado.nombre}
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                CUIT: {clienteSeleccionado.cuit} | Desglose contable mes a mes de Ventas Netas, IVA Débito Fiscal, Compras Netas e IVA Crédito Fiscal.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)', fontWeight: 700 }}>
                    MES
                  </th>
                  <th style={{ padding: '0.85rem 1.25rem', background: '#fce7f3', color: '#831843', borderBottom: '2px solid #f472b6', fontWeight: 800 }}>
                    VENTAS (NETO)
                  </th>
                  <th style={{ padding: '0.85rem 1.25rem', background: '#fdf2f8', color: '#831843', borderBottom: '2px solid #f472b6', fontWeight: 700 }}>
                    IVA DF
                  </th>
                  <th style={{ padding: '0.85rem 1.25rem', background: '#dbeafe', color: '#1e3a8a', borderBottom: '2px solid #60a5fa', fontWeight: 800 }}>
                    COMPRAS (NETO)
                  </th>
                  <th style={{ padding: '0.85rem 1.25rem', background: '#eff6ff', color: '#1e3a8a', borderBottom: '2px solid #60a5fa', fontWeight: 700 }}>
                    IVA CF
                  </th>
                  <th style={{ padding: '0.85rem 1.25rem', background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)', fontWeight: 800 }}>
                    SALDO IVA
                  </th>
                </tr>
              </thead>
              <tbody>
                {datos12Meses.map((item, idx) => {
                  const saldoIva = item.ventasIva - item.comprasIva;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-main)' }}>
                      <td style={{ padding: '0.65rem 1.25rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-main)' }}>
                        <span className="notranslate" translate="no">{nombresMeses[idx]}</span>
                      </td>

                      {/* VENTAS NETO */}
                      <td style={{ padding: '0.65rem 1.25rem', background: '#fff1f2', fontWeight: item.ventasNeto > 0 ? 700 : 400, color: item.ventasNeto > 0 ? '#9f1239' : 'var(--text-muted)' }}>
                        {edicionActiva ? (
                          <input
                            type="number"
                            className="input-field"
                            value={item.ventasNeto || ''}
                            placeholder="0"
                            onChange={e => handleCambioCeldaMes(idx, 'ventasNeto', e.target.value)}
                            style={{ width: '130px', textAlign: 'right', padding: '0.2rem 0.5rem', fontSize: '0.85rem', fontWeight: 700 }}
                          />
                        ) : (
                          formatMoney(item.ventasNeto)
                        )}
                      </td>

                      {/* IVA DF */}
                      <td style={{ padding: '0.65rem 1.25rem', color: item.ventasIva > 0 ? '#9f1239' : 'var(--text-muted)' }}>
                        {edicionActiva ? (
                          <input
                            type="number"
                            className="input-field"
                            value={item.ventasIva || ''}
                            placeholder="0"
                            onChange={e => handleCambioCeldaMes(idx, 'ventasIva', e.target.value)}
                            style={{ width: '115px', textAlign: 'right', padding: '0.2rem 0.5rem', fontSize: '0.85rem' }}
                          />
                        ) : (
                          formatMoney(item.ventasIva)
                        )}
                      </td>

                      {/* COMPRAS NETO */}
                      <td style={{ padding: '0.65rem 1.25rem', background: '#eff6ff', fontWeight: item.comprasNeto > 0 ? 700 : 400, color: item.comprasNeto > 0 ? '#1e40af' : 'var(--text-muted)' }}>
                        {edicionActiva ? (
                          <input
                            type="number"
                            className="input-field"
                            value={item.comprasNeto || ''}
                            placeholder="0"
                            onChange={e => handleCambioCeldaMes(idx, 'comprasNeto', e.target.value)}
                            style={{ width: '130px', textAlign: 'right', padding: '0.2rem 0.5rem', fontSize: '0.85rem', fontWeight: 700 }}
                          />
                        ) : (
                          formatMoney(item.comprasNeto)
                        )}
                      </td>

                      {/* IVA CF */}
                      <td style={{ padding: '0.65rem 1.25rem', color: item.comprasIva > 0 ? '#1e40af' : 'var(--text-muted)' }}>
                        {edicionActiva ? (
                          <input
                            type="number"
                            className="input-field"
                            value={item.comprasIva || ''}
                            placeholder="0"
                            onChange={e => handleCambioCeldaMes(idx, 'comprasIva', e.target.value)}
                            style={{ width: '115px', textAlign: 'right', padding: '0.2rem 0.5rem', fontSize: '0.85rem' }}
                          />
                        ) : (
                          formatMoney(item.comprasIva)
                        )}
                      </td>

                      {/* SALDO IVA */}
                      <td style={{ padding: '0.65rem 1.25rem', fontWeight: 700, color: saldoIva >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {formatMoney(saldoIva)}
                      </td>
                    </tr>
                  );
                })}

                {/* FILA DE TOTAL ANUAL (Resaltada igual a la planilla del contador) */}
                <tr style={{ background: '#f8fafc', borderTop: '3px solid var(--border-color)', fontWeight: 800, fontSize: '0.98rem' }}>
                  <td style={{ padding: '0.95rem 1.25rem', textAlign: 'left', color: 'var(--text-main)', textTransform: 'uppercase' }}>
                    TOTAL ANUAL
                  </td>
                  <td style={{ padding: '0.95rem 1.25rem', background: '#fbcfe8', color: '#831843' }}>
                    {formatMoney(totalVentasNeto)}
                  </td>
                  <td style={{ padding: '0.95rem 1.25rem', color: '#831843' }}>
                    {formatMoney(totalVentasIva)}
                  </td>
                  <td style={{ padding: '0.95rem 1.25rem', background: '#bfdbfe', color: '#1e3a8a' }}>
                    {formatMoney(totalComprasNeto)}
                  </td>
                  <td style={{ padding: '0.95rem 1.25rem', color: '#1e3a8a' }}>
                    {formatMoney(totalComprasIva)}
                  </td>
                  <td style={{ padding: '0.95rem 1.25rem', color: (totalVentasIva - totalComprasIva) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {formatMoney(totalVentasIva - totalComprasIva)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
