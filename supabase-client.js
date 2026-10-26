(() => {
  const config = window.TRIP_SUPABASE_CONFIG;
  const hasConfig =
    config &&
    /^https:\/\/.+\.supabase\.co$/.test(config.url) &&
    config.anonKey &&
    config.anonKey !== 'YOUR_SUPABASE_ANON_KEY';

  if (!window.supabase?.createClient) {
    window.tripDatabase = { client: null, error: 'Supabase 라이브러리를 불러오지 못했어요.' };
    console.error('Supabase JS library is unavailable.');
    return;
  }

  if (!hasConfig) {
    window.tripDatabase = { client: null, error: 'Supabase URL과 anon key를 설정해 주세요.' };
    return;
  }

  window.tripDatabase = {
    client: window.supabase.createClient(config.url, config.anonKey),
    error: null
  };
})();
