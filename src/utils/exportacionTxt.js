export const exportarTxtAfip = (ventasLista, comprasLista, nombreCliente) => {
  // Función auxiliar para rellenar números con ceros a la izquierda sin coma decimal (ej: 150.50 -> 000000000015050)
  const padNum = (num, length) => {
    let s = Math.abs(num || 0).toFixed(2).replace('.', '');
    return s.padStart(length, '0');
  };
  
  // Función auxiliar para rellenar texto con espacios a la derecha
  const padStr = (str, length) => {
    return (str || '').substring(0, length).padEnd(length, ' ');
  };

  const formatDate = (dateStr) => {
    // DD/MM/YYYY -> YYYYMMDD
    if (!dateStr) return '00000000';
    const [d, m, y] = dateStr.split('/');
    return `${y}${m}${d}`;
  };

  const mapTipoComp = (tipoStr) => {
    const str = String(tipoStr).toUpperCase();
    if (str.includes('FACTURA A')) return '001';
    if (str.includes('NOTA DE DÉBITO A')) return '002';
    if (str.includes('NOTA DE CRÉDITO A')) return '003';
    if (str.includes('FACTURA B')) return '006';
    if (str.includes('NOTA DE DÉBITO B')) return '007';
    if (str.includes('NOTA DE CRÉDITO B')) return '008';
    if (str.includes('FACTURA C')) return '011';
    if (str.includes('NOTA DE DÉBITO C')) return '012';
    if (str.includes('NOTA DE CRÉDITO C')) return '013';
    return '000';
  };

  const generarVentas = () => {
    let cabecera = '';
    let alicuotas = '';
    
    ventasLista.forEach(v => {
      const fecha = formatDate(v.fecha);
      const tipo = mapTipoComp(v.tipoComp);
      const pv = padNum(v.puntoVenta || 0, 5);
      const nro = padNum(v.numero || 0, 20);
      const docTipo = (v.cuit && v.cuit.length === 11) ? '80' : '99';
      const docNro = padStr(v.cuit || '0', 20);
      const nombre = padStr(v.razon_social || 'Consumidor Final', 30);
      const total = padNum(v.total, 15);
      const noGrav = padNum(v.noGravado, 15);
      const neto = padNum(v.neto, 15);
      const exento = padNum(v.exento, 15);
      const iva = padNum(v.iva, 15);
      
      // Estructura simplificada Cabecera (Beta MVP)
      cabecera += `${fecha}${tipo}${pv}${nro}${nro}${docTipo}${docNro}${nombre}${total}${noGrav}${neto}${iva}${exento}${'0'.repeat(45)}\n`;
      
      // Estructura simplificada Alícuotas
      if (v.neto21 > 0) alicuotas += `${tipo}${pv}${nro}${docTipo}${docNro}${padNum(v.neto21, 15)}0005${padNum(v.iva21, 15)}\n`;
      if (v.neto105 > 0) alicuotas += `${tipo}${pv}${nro}${docTipo}${docNro}${padNum(v.neto105, 15)}0004${padNum(v.iva105, 15)}\n`;
      if (v.neto27 > 0) alicuotas += `${tipo}${pv}${nro}${docTipo}${docNro}${padNum(v.neto27, 15)}0006${padNum(v.iva27, 15)}\n`;
    });
    
    return { cabecera, alicuotas };
  };

  const ventasTxt = generarVentas();

  const descargar = (contenido, nombreArchivo) => {
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', nombreArchivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (ventasLista.length > 0) {
    descargar(ventasTxt.cabecera, `VENTAS_${nombreCliente}_REGINFO_CV_CABECERA.txt`);
    descargar(ventasTxt.alicuotas, `VENTAS_${nombreCliente}_REGINFO_CV_ALICUOTAS.txt`);
  } else {
    alert('No hay ventas para exportar a TXT');
  }
};
