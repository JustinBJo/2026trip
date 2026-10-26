const expenseForm = document.querySelector('#expense-form');
const expenseList = document.querySelector('#expense-list');
const emptyState = document.querySelector('#empty-state');
const totalAmount = document.querySelector('#total-amount');
const perPersonAmount = document.querySelector('#per-person-amount');
const expenseCount = document.querySelector('#expense-count');
const listFeedback = document.querySelector('#list-feedback');
const connectionStatus = document.querySelector('#connection-status');
const settlementTotal = document.querySelector('#settlement-total');
const settlementPeople = document.querySelector('#settlement-people');
const settlementWarning = document.querySelector('#settlement-warning');
const database = window.tripDatabase;
const crew = ['법기', '영훈', '진구', '선형', '강욱', '정우', '재형', '정준', '준원'];
let expenses = [];

function setConnectionError(message) {
  connectionStatus.textContent = message;
  expenseForm.querySelector('button[type="submit"]').disabled = true;
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
  const eligibleExpenses = expenses.filter((expense) => crew.includes(expense.payer));
  const eligibleTotal = eligibleExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  totalAmount.textContent = formatAmount(total);
  perPersonAmount.textContent = formatAmount(eligibleTotal / crew.length);
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
    meta.textContent = `${expense.payer}${crew.includes(expense.payer) ? '' : ' · 결제자 확인 필요'} · ${formatDate(expense.created_at)}`;
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

  renderSettlements(eligibleExpenses);
}

function renderSettlements(eligibleExpenses) {
  const unknownPayerCount = expenses.length - eligibleExpenses.length;
  settlementWarning.hidden = unknownPayerCount === 0;
  settlementWarning.textContent = unknownPayerCount
    ? `결제자가 9명 명단과 일치하지 않는 지출 ${unknownPayerCount}건은 정산 계산에서 제외했습니다. 해당 지출을 삭제하고 명단에서 결제자를 다시 선택해 등록하세요.`
    : '';

  const paidByPerson = new Map(crew.map((name) => [name, 0]));
  const shareByPerson = new Map(crew.map((name) => [name, 0]));
  let remainderStart = 0;
  let eligibleTotalCents = 0;

  for (const expense of eligibleExpenses) {
    const cents = Math.round(expense.amount * 100);
    eligibleTotalCents += cents;
    paidByPerson.set(expense.payer, paidByPerson.get(expense.payer) + cents);
    const baseShare = Math.floor(cents / crew.length);
    const remainder = cents % crew.length;

    for (let index = 0; index < crew.length; index += 1) {
      const receivesExtraCent = (index - remainderStart + crew.length) % crew.length < remainder;
      shareByPerson.set(
        crew[index],
        shareByPerson.get(crew[index]) + baseShare + (receivesExtraCent ? 1 : 0)
      );
    }

    remainderStart = (remainderStart + remainder) % crew.length;
  }

  settlementTotal.textContent = `${formatAmount(eligibleTotalCents / 100)} · 계산 가능 지출`;

  const balances = crew.map((name, index) => ({
    name,
    order: index,
    cents: paidByPerson.get(name) - shareByPerson.get(name),
    transfers: []
  }));
  const debtors = balances
    .filter((person) => person.cents < 0)
    .map((person) => ({ ...person, remaining: -person.cents }))
    .sort((left, right) => right.remaining - left.remaining || left.order - right.order);
  const creditors = balances
    .filter((person) => person.cents > 0)
    .map((person) => ({ ...person, remaining: person.cents }))
    .sort((left, right) => right.remaining - left.remaining || left.order - right.order);

  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const cents = Math.min(debtor.remaining, creditor.remaining);
    debtor.transfers.push({ direction: 'pay', counterparty: creditor.name, cents });
    creditor.transfers.push({ direction: 'receive', counterparty: debtor.name, cents });
    debtor.remaining -= cents;
    creditor.remaining -= cents;
    if (debtor.remaining === 0) debtorIndex += 1;
    if (creditor.remaining === 0) creditorIndex += 1;
  }

  settlementPeople.replaceChildren();
  for (const person of balances) {
    const detail = document.createElement('details');
    detail.className = 'settlement-person';

    const summary = document.createElement('summary');
    summary.className = 'settlement-person-summary';
    const name = document.createElement('strong');
    name.className = 'settlement-person-name';
    name.textContent = person.name;
    const net = document.createElement('span');
    net.className = `settlement-net${person.cents < 0 ? ' is-owing' : person.cents > 0 ? ' is-owed' : ''}`;
    net.textContent = person.cents < 0
      ? `내기 ${formatAmount(-person.cents / 100)}`
      : person.cents > 0
        ? `받기 ${formatAmount(person.cents / 100)}`
        : '정산 없음';
    summary.append(name, net);

    const transferList = document.createElement('ul');
    transferList.className = 'settlement-transfer-list';
    if (person.transfers.length === 0) {
      const emptyTransfer = document.createElement('li');
      emptyTransfer.className = 'settlement-no-transfer';
      emptyTransfer.textContent = person.cents === 0
        ? '주고받을 금액이 없습니다.'
        : '송금 내역을 만들지 못했습니다. 지출 기록을 확인해 주세요.';
      transferList.append(emptyTransfer);
    } else {
      for (const transfer of person.transfers) {
        const row = document.createElement('li');
        row.className = 'settlement-transfer';
        const action = document.createElement('span');
        action.textContent = transfer.direction === 'pay'
          ? `${transfer.counterparty}에게 보내기`
          : `${transfer.counterparty}에게 받기`;
        const amount = document.createElement('strong');
        amount.textContent = formatAmount(transfer.cents / 100);
        row.append(action, amount);
        transferList.append(row);
      }
    }

    detail.append(summary, transferList);
    settlementPeople.append(detail);
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

expenseForm.querySelector('button[type="submit"]').disabled = true;

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

  listFeedback.textContent = '';
  expenseForm.reset();
  submitButton.disabled = false;
  descriptionInput.focus();
  await loadExpenses();
});

initializeExpenses();
