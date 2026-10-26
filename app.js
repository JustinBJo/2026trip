const trainSupportInput = document.querySelector('#train-support');
const trainSaveStatus = document.querySelector('#train-save-status');
const connectionStatus = document.querySelector('#connection-status');
const database = window.tripDatabase;
let saveTimer;

function showConnectionError(message) {
  connectionStatus.textContent = message;
  trainSaveStatus.textContent = 'DB 연결 오류';
  trainSupportInput.disabled = true;
}

function updateTrainAmount(value) {
  if (document.activeElement !== trainSupportInput) {
    trainSupportInput.value = value === null ? '' : String(value);
  }
  trainSaveStatus.textContent = '저장됨 · 실시간 공유';
}

async function saveTrainAmount() {
  const value = trainSupportInput.value;
  if (value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
    trainSaveStatus.textContent = '0 이상의 금액을 입력하세요';
    return;
  }

  trainSaveStatus.textContent = '저장 중...';
  const { data, error } = await database.client
    .from('trip_settings')
    .update({
      train_support_amount: value === '' ? null : Number(value),
      updated_at: new Date().toISOString()
    })
    .eq('id', true)
    .select('train_support_amount')
    .single();

  if (error) {
    trainSaveStatus.textContent = '저장 실패';
    connectionStatus.textContent = `기차 지원금을 저장하지 못했어요: ${error.message}`;
    console.error('Could not save shared train support amount.', error);
    return;
  }

  connectionStatus.textContent = '공개 DB 연결됨 · 사이트 방문자는 누구나 지원금을 읽고 수정할 수 있습니다.';
  updateTrainAmount(data.train_support_amount);
}

async function initializeTripSettings() {
  if (!database?.client) {
    showConnectionError(`${database?.error ?? 'DB 설정을 확인해 주세요.'} SUPABASE_SETUP.md를 참고하세요.`);
    return;
  }

  connectionStatus.textContent = '공유 DB 연결 중...';
  try {
    const { data, error } = await database.client
      .from('trip_settings')
      .select('train_support_amount')
      .eq('id', true)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('trip_settings 기본 행이 없습니다. supabase-setup.sql을 실행하세요.');

    updateTrainAmount(data.train_support_amount);
    trainSupportInput.disabled = false;
    connectionStatus.textContent = '공개 DB 연결됨 · 사이트 방문자는 누구나 지원금을 읽고 수정할 수 있습니다.';

    database.client
      .channel('trip-settings-live')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'trip_settings',
        filter: 'id=eq.true'
      }, (payload) => updateTrainAmount(payload.new.train_support_amount))
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          connectionStatus.textContent = '실시간 연결 실패 · 새로고침 후 다시 시도하세요.';
        }
      });
  } catch (error) {
    showConnectionError(`공유 DB 연결 실패: ${error.message} · Supabase 설정과 SQL을 확인하세요.`);
    console.error('Could not load shared trip settings.', error);
  }
}

trainSupportInput.disabled = true;
trainSupportInput.addEventListener('input', () => {
  window.clearTimeout(saveTimer);
  trainSaveStatus.textContent = '입력 중...';
  saveTimer = window.setTimeout(saveTrainAmount, 500);
});
trainSupportInput.addEventListener('change', () => {
  window.clearTimeout(saveTimer);
  saveTrainAmount();
});

initializeTripSettings();
