const noteForm = document.querySelector('#note-form');
const notesList = document.querySelector('#notes-list');
const notesEmpty = document.querySelector('#notes-empty');
const noteCount = document.querySelector('#note-count');
const noteFeedback = document.querySelector('#note-feedback');
const connectionStatus = document.querySelector('#connection-status');
const database = window.tripDatabase;
let notes = [];
let editingNoteId = null;

function setConnectionError(message) {
  connectionStatus.textContent = message;
  noteForm.querySelector('button[type="submit"]').disabled = true;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function renderNotes() {
  const openNoteIds = new Set(
    [...notesList.querySelectorAll('details[open]')].map((item) => item.dataset.noteId)
  );
  noteCount.textContent = String(notes.length);
  notesEmpty.hidden = notes.length > 0;
  notesList.replaceChildren();

  for (const note of notes) {
    const item = document.createElement('details');
    item.className = 'note-item';
    item.dataset.noteId = note.id;
    item.open = openNoteIds.has(note.id) || editingNoteId === note.id;

    const summary = document.createElement('summary');
    summary.className = 'note-summary';
    const title = document.createElement('strong');
    title.className = 'note-title';
    title.textContent = note.title;
    const date = document.createElement('span');
    date.className = 'note-date';
    date.textContent = formatDate(note.updated_at);
    summary.append(title, date);
    item.append(summary);

    const content = document.createElement('div');
    content.className = 'note-content';

    if (editingNoteId === note.id) {
      const editForm = document.createElement('form');
      editForm.className = 'note-edit-form';

      const titleLabel = document.createElement('label');
      titleLabel.className = 'form-field';
      const titleCaption = document.createElement('span');
      titleCaption.textContent = '제목';
      const titleInput = document.createElement('input');
      titleInput.name = 'title';
      titleInput.type = 'text';
      titleInput.maxLength = 100;
      titleInput.required = true;
      titleInput.value = note.title;
      titleLabel.append(titleCaption, titleInput);

      const bodyLabel = document.createElement('label');
      bodyLabel.className = 'form-field';
      const bodyCaption = document.createElement('span');
      bodyCaption.textContent = '내용';
      const bodyInput = document.createElement('textarea');
      bodyInput.name = 'content';
      bodyInput.maxLength = 10000;
      bodyInput.rows = 8;
      bodyInput.required = true;
      bodyInput.value = note.content;
      bodyLabel.append(bodyCaption, bodyInput);

      const actions = document.createElement('div');
      actions.className = 'note-actions';
      const saveButton = document.createElement('button');
      saveButton.className = 'button button-primary note-action-button';
      saveButton.type = 'submit';
      saveButton.textContent = '변경 저장';
      const cancelButton = document.createElement('button');
      cancelButton.className = 'button button-secondary note-action-button';
      cancelButton.type = 'button';
      cancelButton.textContent = '취소';
      cancelButton.addEventListener('click', () => {
        editingNoteId = null;
        noteFeedback.textContent = '';
        renderNotes();
      });
      actions.append(saveButton, cancelButton);

      editForm.append(titleLabel, bodyLabel, actions);
      editForm.addEventListener('submit', (event) => {
        event.preventDefault();
        saveNote(note.id, titleInput.value.trim(), bodyInput.value.trim(), saveButton);
      });
      content.append(editForm);
    } else {
      const body = document.createElement('p');
      body.className = 'note-body';
      body.textContent = note.content;
      const actions = document.createElement('div');
      actions.className = 'note-actions';
      const editButton = document.createElement('button');
      editButton.className = 'button button-secondary note-action-button';
      editButton.type = 'button';
      editButton.textContent = '수정';
      editButton.addEventListener('click', () => {
        editingNoteId = note.id;
        noteFeedback.textContent = '';
        renderNotes();
      });
      const deleteButton = document.createElement('button');
      deleteButton.className = 'note-delete-button';
      deleteButton.type = 'button';
      deleteButton.textContent = '삭제';
      deleteButton.addEventListener('click', () => removeNote(note, deleteButton));
      actions.append(editButton, deleteButton);
      content.append(body, actions);
    }

    item.append(content);
    notesList.append(item);
  }
}

async function loadNotes() {
  const { data, error } = await database.client
    .from('trip_notes')
    .select('id, title, content, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    noteFeedback.textContent = `메모를 불러오지 못했어요: ${error.message}`;
    connectionStatus.textContent = '메모 DB를 불러오지 못했어요. supabase-setup.sql을 실행했는지 확인하세요.';
    console.error('Could not load shared notes.', error);
    return false;
  }

  notes = data;
  if (noteFeedback.textContent.startsWith('메모를 불러오지 못했어요:')) {
    noteFeedback.textContent = '';
  }
  renderNotes();
  return true;
}

async function saveNote(id, title, content, button) {
  if (!title || !content) {
    noteFeedback.textContent = '제목과 내용을 입력해 주세요.';
    return;
  }

  button.disabled = true;
  noteFeedback.textContent = '메모 저장 중...';
  const { data, error } = await database.client
    .from('trip_notes')
    .update({ title, content, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');

  if (error) {
    noteFeedback.textContent = `메모를 저장하지 못했어요: ${error.message}`;
    console.error('Could not update shared note.', error);
    button.disabled = false;
    return;
  }

  if (!data?.length) {
    noteFeedback.textContent = '메모가 저장되지 않았어요. DB 수정 권한을 확인하세요.';
    button.disabled = false;
    return;
  }

  editingNoteId = null;
  if (await loadNotes()) noteFeedback.textContent = '수정 내용을 DB에 저장했어요.';
}

async function removeNote(note, button) {
  if (!window.confirm(`“${note.title}” 메모를 삭제할까요?`)) return;

  button.disabled = true;
  noteFeedback.textContent = '메모 삭제 중...';
  const { data, error } = await database.client
    .from('trip_notes')
    .delete()
    .eq('id', note.id)
    .select('id');

  if (error) {
    noteFeedback.textContent = `메모를 삭제하지 못했어요: ${error.message}`;
    console.error('Could not delete shared note.', error);
    button.disabled = false;
    return;
  }

  if (!data?.length) {
    noteFeedback.textContent = '메모가 삭제되지 않았어요. DB 삭제 권한을 확인하세요.';
    button.disabled = false;
    return;
  }

  if (editingNoteId === note.id) editingNoteId = null;
  if (await loadNotes()) noteFeedback.textContent = '메모를 DB에서 삭제했어요.';
}

async function initializeNotes() {
  if (!database?.client) {
    setConnectionError(`${database?.error ?? 'DB 설정을 확인해 주세요.'} SUPABASE_SETUP.md를 참고하세요.`);
    return;
  }

  connectionStatus.textContent = '공유 DB 연결 중...';
  try {
    const loaded = await loadNotes();
    if (!loaded) {
      noteForm.querySelector('button[type="submit"]').disabled = true;
      return;
    }

    noteForm.querySelector('button[type="submit"]').disabled = false;
    connectionStatus.textContent = '공개 메모장 · 사이트 방문자는 누구나 메모를 읽고 수정할 수 있습니다.';

    database.client
      .channel('trip-notes-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trip_notes'
      }, loadNotes)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          connectionStatus.textContent = '실시간 연결 실패 · 새로고침 후 다시 시도하세요.';
        }
      });
  } catch (error) {
    setConnectionError(`메모 DB 연결 실패: ${error.message} · SQL 설정을 확인하세요.`);
    console.error('Could not initialize shared notes.', error);
  }
}

noteForm.querySelector('button[type="submit"]').disabled = true;
noteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const titleInput = document.querySelector('#note-title');
  const contentInput = document.querySelector('#note-content');
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!noteForm.reportValidity() || !title || !content) return;

  const submitButton = noteForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  noteFeedback.textContent = '메모 저장 중...';
  try {
    const { data, error } = await database.client
      .from('trip_notes')
      .insert({ title, content })
      .select('id')
      .single();

    if (error) throw error;
    if (!data?.id) throw new Error('Database did not confirm the saved note.');

    noteForm.reset();
    titleInput.focus();
    const loaded = await loadNotes();
    if (loaded) noteFeedback.textContent = '메모를 DB에 저장했어요.';
  } catch (error) {
    noteFeedback.textContent = `메모 저장을 확인하지 못했어요: ${error.message}`;
    console.error('Could not confirm shared note save.', error);
  } finally {
    submitButton.disabled = false;
  }
});

initializeNotes();
