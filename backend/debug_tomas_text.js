const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navegando a Login AFIP...');
  await page.goto('https://auth.afip.gob.ar/contribuyente_/login.xhtml', { waitUntil: 'networkidle2' });

  console.log('Ingresando CUIT...');
  await page.type('input[name="F1:username"]', '20416994413');
  await page.click('input[id="F1:btnSiguiente"]');

  console.log('Ingresando Clave Fiscal...');
  await page.waitForSelector('input[name="F1:password"]', { visible: true });
  await page.type('input[name="F1:password"]', 'Hola2011@@');
  await page.click('input[id="F1:btnIngresar"]');

  console.log('Esperando navegación...');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  console.log('Esperando buscador...');
  const searchSelector = '#buscadorInput, input[type="search"], input[placeholder*="cesit"], input[placeholder*="trámites"]';
  await page.waitForSelector(searchSelector, { visible: true, timeout: 20000 });
  console.log('¡Buscador encontrado con éxito!');
  
  await browser.close();
})();
