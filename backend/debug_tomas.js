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
  await page.type('input[name="F1:password"]', 'Hola2011@@ ');
  await page.click('input[id="F1:btnIngresar"]');

  console.log('Esperando navegación...');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  console.log('Tomando captura...');
  await page.screenshot({ path: 'tomas_pelayes_debug.png', fullPage: true });

  console.log('Evaluando DOM...');
  const searchBarHTML = await page.evaluate(() => {
    const el = document.querySelector('#buscadorInput, input[type="search"]');
    return el ? el.outerHTML : 'NOT_FOUND';
  });
  console.log('SearchBar:', searchBarHTML);

  await browser.close();
})();
