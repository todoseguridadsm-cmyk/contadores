import React, { useState, useEffect } from 'react';
import { Database, Filter, Search, Calendar, TrendingUp, TrendingDown, DollarSign, Download, Eye, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CATEGORIAS_INFO, getCategoriaCliente } from './ClientesView';

export default function AnualView() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [anioSeleccionado, setAnioSeleccionado] = useState(String(new Date().getFullYear()));
  const [clienteDetalle, setClienteDetalle] = useState(null);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      if (!import.meta.env.VITE_SUPABASE_URL) return;
      const { data, error } = await supabase.from('clientes').select('*').order('nombre', { ascending: true });
      if (!error) setClientes(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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

  const calcularAnualCliente = (cliente) => {
    const historial = obtenerHistorialCliente(cliente);
    const anioData = historial[anioSeleccionado] || {};
    const meses = Object.values(anioData);

    // Si hay meses archivados en la nube, sumamos todos los meses del año
    if (meses.length > 0) {
      const sumaVentasNeto = meses.reduce((acc, m) => acc + Number(m.ventasNeto || 0), 0);
      const sumaComprasNeto = meses.reduce((acc, m) => acc + Number(m.comprasNeto || 0), 0);
      const sumaVentasIva = meses.reduce((acc, m) => acc + Number(m.ventasIva || 0), 0);
      const sumaComprasIva = meses.reduce((acc, m) => acc + Number(m.comprasIva || 0), 0);
      return {
        ventasNeto: sumaVentasNeto,
        comprasNeto: sumaComprasNeto,
        ventasIva: sumaVentasIva,
        comprasIva: sumaComprasIva,
        mesesArchivados: meses.map(m => m.mes)
      };
    }

    // Si no tiene meses guardados en el historial explícito, usamos la última carga de ventas_json / compras_json como referencia
    const ventasNeto = Number(cliente.ventas_json?.totalNetoGravado || 0);
    const comprasNeto = Number(cliente.compras_json?.totalNetoGravado || 0);
    const ventasIva = Number(cliente.ventas_json?.totalIVA || 0);
    const comprasIva = Number(cliente.compras_json?.totalIVA || 0);

    return {
      ventasNeto,
      comprasNeto,
      ventasIva,
      comprasIva,
      mesesArchivados: (ventasNeto > 0 || comprasNeto > 0) ? ['Última Carga'] : []
    };
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(amount) || 0);

  const clientesFiltrados = clientes.filter(cliente => {
    const cat = getCategoriaCliente(cliente);
    const coincideCategoria = filtroCategoria === 'TODOS' || cat === filtroCategoria;
    const coincideTexto = !searchTerm ||
      cliente.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.cuit?.includes(searchTerm);
    return coincideCategoria && coincideTexto;
  });

  // Totales Globales del Año para los clientes filtrados
  const totalGlobalVentasNeto = clientesFiltrados.reduce((acc, c) => acc + calcularAnualCliente(c).ventasNeto, 0);
  const totalGlobalComprasNeto = clientesFiltrados.reduce((acc, c) => acc + calcularAnualCliente(c).comprasNeto, 0);

  const nombresMeses = {
    '1': 'Enero', '2': 'Febrero', '3': 'Marzo', '4': 'Abril', '5': 'Mayo', '6': 'Junio',
    '7': 'Julio', '8': 'Agosto', '9': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
  };

  return (
    <div className="content-area" style={{ position: 'relative' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Resúmenes Anualizados en la Nube</h1>
          <p className="page-subtitle">Analiza los números anualizados (Neto de Ventas y Neto de Compras) por Categoría (A - E) guardados en Supabase.</p>
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

      {/* KPI Globales Anualizados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--success)', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL NETO DE VENTAS ANUAL ({anioSeleccionado})</span>
            <TrendingUp size={24} style={{ color: 'var(--success)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--success)' }}>
            {formatMoney(totalGlobalVentasNeto)}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Suma de todos los clientes filtrados</p>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #3b82f6', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL NETO DE COMPRAS ANUAL ({anioSeleccionado})</span>
            <TrendingDown size={24} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#3b82f6' }}>
            {formatMoney(totalGlobalComprasNeto)}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Suma de todos los clientes filtrados</p>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--primary)', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>DIFERENCIA NETA (VENTAS - COMPRAS)</span>
            <DollarSign size={24} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: (totalGlobalVentasNeto - totalGlobalComprasNeto) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatMoney(totalGlobalVentasNeto - totalGlobalComprasNeto)}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Margen neto acumulado del año</p>
        </div>
      </div>

      {/* Filtros de Categoría y Búsqueda */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Filter size={16} /> FILTRAR POR CATEGORÍA:
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
                    color: filtroCategoria === catKey ? '#fff' : CATEGORIAS_INFO[catKey].color
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
              placeholder="Buscar por cliente o CUIT..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.25rem', width: '100%', fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>

      {/* Tabla Anual por Cliente */}
      <div className="card full-width" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando resúmenes anuales de Supabase...</p>
        ) : clientesFiltrados.length === 0 ? (
          <p style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron clientes para esta categoría o criterio de búsqueda.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cliente</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Categoría (Modificar)</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>CUIT</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Neto Ventas Anual</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Neto Compras Anual</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Meses en Nube</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Detalle Mes a Mes</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map(cliente => {
                const anual = calcularAnualCliente(cliente);
                const cat = getCategoriaCliente(cliente);
                return (
                  <tr key={cliente.id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {cliente.nombre}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <select
                        value={cat}
                        onChange={(e) => handleQuickChangeCategoria(cliente.id, e.target.value)}
                        style={{
                          background: CATEGORIAS_INFO[cat]?.bg || 'var(--bg-main)',
                          color: CATEGORIAS_INFO[cat]?.color || 'var(--text-main)',
                          border: `1px solid ${CATEGORIAS_INFO[cat]?.color}`,
                          borderRadius: '8px',
                          padding: '0.28rem 0.6rem',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="A">Tipo A - Gran Contribuyente</option>
                        <option value="B">Tipo B - Resp. Inscripto</option>
                        <option value="C">Tipo C - Monotributo</option>
                        <option value="D">Tipo D - Exento</option>
                        <option value="E">Tipo E - Observación</option>
                      </select>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)' }}>
                      {cliente.cuit}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                      {formatMoney(anual.ventasNeto)}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>
                      {formatMoney(anual.comprasNeto)}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {anual.mesesArchivados.length > 0 ? anual.mesesArchivados.map((m, idx) => (
                          <span key={idx} style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: 'var(--secondary-bg)',
                            color: 'var(--text-main)'
                          }}>
                            {nombresMeses[m] || m}
                          </span>
                        )) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sin archivar</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setClienteDetalle(cliente)}
                        style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                      >
                        <Eye size={16} /> Ver Mes a Mes
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Desglose Mes a Mes del Año */}
      {clienteDetalle && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0, 0, 0, 0.6)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, padding: '1.5rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button
              onClick={() => setClienteDetalle(null)}
              className="icon-btn"
              style={{ position: 'absolute', top: '1rem', right: '1rem' }}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>
              Desglose Anual {anioSeleccionado}: {clienteDetalle.nombre}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
              Categoría: Tipo {getCategoriaCliente(clienteDetalle)} | CUIT: {clienteDetalle.cuit}
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '1.5rem' }}>
              <thead style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem' }}>Mes</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Neto Ventas</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>IVA Ventas</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Neto Compras</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>IVA Compras</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Diferencia Neta</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(mesNum => {
                  const historial = obtenerHistorialCliente(clienteDetalle);
                  const mesData = (historial[anioSeleccionado] && historial[anioSeleccionado][String(mesNum)]) || {};
                  const ventasN = Number(mesData.ventasNeto || 0);
                  const comprasN = Number(mesData.comprasNeto || 0);
                  const ventasI = Number(mesData.ventasIva || 0);
                  const comprasI = Number(mesData.comprasIva || 0);
                  const diff = ventasN - comprasN;

                  return (
                    <tr key={mesNum} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                        {nombresMeses[String(mesNum)]}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: ventasN > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {formatMoney(ventasN)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {formatMoney(ventasI)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: comprasN > 0 ? '#3b82f6' : 'var(--text-muted)' }}>
                        {formatMoney(comprasN)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {formatMoney(comprasI)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: diff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {formatMoney(diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setClienteDetalle(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
