const expenseForm = document.querySelector('#expense-form');
const expenseList = document.querySelector('#expense-list');
const emptyState = document.querySelector('#empty-state');
const totalAmount = document.querySelector('#total-amount');
const perPersonAmount = document.querySelector('#per-person-amount');
const expenseCount = document.querySelector('#expense-count');
const participantCount = document.querySelector('#participant-count');
const listFeedback = document.querySelector('#list-feedback');
const connectionStatus = document.querySelector('#connection-status');
const database = window.tripDatabase;
let expenses = [];

function setConnectionError(message) {
  connectionStatus.textContent = message;
  expenseForm.querySelector('button[type="submit"]').disabled = true;
  participantCount.disabled = true;
}

function formatAmount(amount) {
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
}

function renderExpenses() {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const participantTotal = Number(participantCount.value);
  totalAmount.textContent = formatAmount(total);
  perPersonAmount.textContent = Number.isInteger(participantTotal) && participantTotal > 0
    ? formatAmount(total / participantTotal)
    : '—';
  expenseCount.textContent = String(expenses.length);
  emptyState.hidden = expenses.length > 0;
  expenseList.replaceChildren();

  for (const expense of expenses) {
    const item = document.createElement('li');
    item.className = 'expense-row';

    const detail = document.createElement('div');
    const description = document.createElement('div');
    description.className = 'expense-description';
    description.textContent = expense.description;
    const meta = document.createElement('div');
    meta.className = 'expense-meta';
    meta.textContent = `${expense.payer} · ${formatDate(expense.created_at)}`;
    detail.append(description, meta);

    const amount = document.createElement('span');
    amount.className = 'expense-value';
    amount.textContent = formatAmount(expense.amount);

    const removeButton = document.createElement('button');
    removeButton.className = 'remove-expense';
    removeButton.type = 'button';
    removeButton.textContent = '×';
    removeButton.setAttribute('aria-label', `${expense.description} 지출 삭제`);
    removeButton.addEventListener('click', () => removeExpense(expense.id));

    item.append(detail, amount, removeButton);
    expenseList.append(item);
  }
}

async function loadExpenses() {
  const { data, error } = await database.client
    .from('trip_expenses')
    .select('id, description, payer, amount, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    listFeedback.textContent = `지출 내역을 불러오지 못했어요: ${error.message}`;
    console.error('Could not load shared expenses.', error);
    return;
  }

  expenses = data.map((expense) => ({ ...expense, amount: Number(expense.amount) }));
  listFeedback.textContent = '';
  renderExpenses();
}

async function saveParticipants() {
  const count = Number(participantCount.value);
  if (!Number.isInteger(count) || count < 1) {
    listFeedback.textContent = '정산 인원은 1명 이상으로 입력해 주세요.';
    return;
  }

  listFeedback.textContent = '정산 인원 저장 중...';
  const { error } = await database.client
    .from('trip_settings')
    .update({ participant_count: count, updated_at: new Date().toISOString() })
    .eq('id', true);

  if (error) {
    listFeedback.textContent = `정산 인원을 저장하지 못했어요: ${error.message}`;
    console.error('Could not save shared participant count.', error);
    return;
  }

  listFeedback.textContent = '';
}

async function removeExpense(id) {
  const { error } = await database.client
    .from('trip_expenses')
    .delete()
    .eq('id', id);

  if (error) {
    listFeedback.textContent = `지출을 삭제하지 못했어요: ${error.message}`;
    console.error('Could not delete shared expense.', error);
    return;
  }

  await loadExpenses();
}

async function initializeExpenses() {
  if (!database?.client) {
    setConnectionError(`${database?.error ?? 'DB 설정을 확인해 주세요.'} SUPABASE_SETUP.md를 참고하세요.`);
    return;
  }

  connectionStatus.textContent = '공유 DB 연결 중...';
  try {
    const { data: settings, error: settingsError } = await database.client
      .from('trip_settings')
      .select('participant_count')
      .eq('id', true)
      .maybeSingle();

    if (settingsError) throw settingsError;
    if (!settings) throw new Error('trip_settings 기본 행이 없습니다. supabase-setup.sql을 실행하세요.');

    participantCount.value = String(settings.participant_count);
    participantCount.disabled = false;
    expenseForm.querySelector('button[type="submit"]').disabled = false;
    await loadExpenses();
    connectionStatus.textContent = '공개 DB 연결됨 · 사이트 방문자는 누구나 지출을 읽고 수정할 수 있습니다.';

    database.client
      .channel('trip-expenses-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trip_expenses'
      }, loadExpenses)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'trip_settings',
        filter: 'id=eq.true'
      }, (payload) => {
        if (document.activeElement !== participantCount) {
          participantCount.value = String(payload.new.participant_count);
          renderExpenses();
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          connectionStatus.textContent = '실시간 연결 실패 · 새로고침 후 다시 시도하세요.';
        }
      });
  } catch (error) {
    setConnectionError(`공유 DB 연결 실패: ${error.message} · Supabase 설정과 SQL을 확인하세요.`);
    console.error('Could not initialize shared expenses.', error);
  }
}

participantCount.disabled = true;
expenseForm.querySelector('button[type="submit"]').disabled = true;

participantCount.addEventListener('change', saveParticipants);
participantCount.addEventListener('input', renderExpenses);

expenseForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const descriptionInput = document.querySelector('#expense-description');
  const payerInput = document.querySelector('#expense-payer');
  const amountInput = document.querySelector('#expense-amount');
  const description = descriptionInput.value.trim();
  const payer = payerInput.value.trim();
  const amount = Number(amountInput.value);

  if (!expenseForm.reportValidity() || !description || !payer || !Number.isFinite(amount) || amount <= 0) return;

  const submitButton = expenseForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  listFeedback.textContent = '지출 저장 중...';
  const { error } = await database.client
    .from('trip_expenses')
    .insert({ description, payer, amount });

  if (error) {
    listFeedback.textContent = `지출을 저장하지 못했어요: ${error.message}`;
    console.error('Could not save shared expense.', error);
    submitButton.disabled = false;
    return;
  }

  expenseForm.reset();
  submitButton.disabled = false;
  descriptionInput.focus();
  await loadExpenses();
});

initializeExpenses();
