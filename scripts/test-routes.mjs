const PORT = 3030;
const BASE_URL = `http://localhost:${PORT}`;
const LOCALES = ['ko', 'en', 'es', 'ja', 'ar'];
const PATHS = [
  '',
  '/matches/today',
  '/leagues',
  '/daily/today',
  '/about',
  '/privacy',
  '/terms',
  '/teams'
];

async function checkRoute(url) {
  try {
    // Node.js 18+ built-in fetch 사용
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'ko-KR,ko;q=0.9'
      }
    });
    return {
      url,
      status: response.status,
      ok: response.ok
    };
  } catch (error) {
    return {
      url,
      status: 'ERROR',
      ok: false,
      message: error.message
    };
  }
}

async function runTests() {
  console.log(`🚀 Starting smoke test on ${BASE_URL}...\n`);
  
  let total = 0;
  let passed = 0;

  for (const locale of LOCALES) {
    console.log(`🌐 Testing locale: ${locale.toUpperCase()}`);
    for (const path of PATHS) {
      const url = `${BASE_URL}/${locale}${path}`;
      const result = await checkRoute(url);
      total++;
      
      if (result.ok) {
        console.log(` ✅ [200] ${path || '/'}`);
        passed++;
      } else {
        console.log(` ❌ [${result.status}] ${path || '/'} - ${result.message || 'Failed'}`);
      }
    }
    console.log('');
  }

  console.log(`\n📊 Test Summary: ${passed}/${total} passed`);
  if (passed === total) {
    console.log('✨ All systems go! Ready to push.');
  } else {
    console.log('⚠️ Some routes failed. Please check the server logs (likely DB Schema issue).');
  }
}

runTests();
