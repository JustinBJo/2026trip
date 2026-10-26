const recommendationForm = document.querySelector('#recommendation-form');
const recommendationList = document.querySelector('#recommendation-list');
const recommendationEmpty = document.querySelector('#recommendation-empty');
const recommendationCount = document.querySelector('#recommendation-count');
const recommendationFeedback = document.querySelector('#recommendation-feedback');
const connectionStatus = document.querySelector('#connection-status');
const database = window.tripDatabase;
const voterStorageKey = 'winter-run-voter-id';
let voterId;
let recommendations = [];
let votes = [];

function setConnectionError(message) {
  connectionStatus.textContent = message;
  recommendationForm.querySelector('button[type="submit"]').disabled = true;
}

function getVoterId() {
  try {
    let storedId = localStorage.getItem(voterStorageKey);
    if (!storedId) {
      storedId = createVoterId();
      localStorage.setItem(voterStorageKey, storedId);
    }
    return storedId;
  } catch (error) {
    console.error('Could not persist recommendation voter id.', error);
    return createVoterId();
  }
}

function createVoterId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function renderRecommendations() {
  recommendationCount.textContent = String(recommendations.length);
  recommendationEmpty.hidden = recommendations.length > 0;
  recommendationList.replaceChildren();

  const voteTotals = new Map();
  for (const vote of votes) {
    const tally = voteTotals.get(vote.recommendation_id) ?? { up: 0, down: 0 };
    if (vote.vote === 1) tally.up += 1;
    if (vote.vote === -1) tally.down += 1;
    voteTotals.set(vote.recommendation_id, tally);
  }

  const sortedRecommendations = [...recommendations].sort((left, right) => {
    const leftVotes = voteTotals.get(left.id) ?? { up: 0, down: 0 };
    const rightVotes = voteTotals.get(right.id) ?? { up: 0, down: 0 };
    const scoreDifference = rightVotes.up - rightVotes.down - (leftVotes.up - leftVotes.down);
    return scoreDifference || new Date(right.created_at) - new Date(left.created_at);
  });

  for (const recommendation of sortedRecommendations) {
    const tally = voteTotals.get(recommendation.id) ?? { up: 0, down: 0 };
    const myVote = votes.find((vote) =>
      vote.recommendation_id === recommendation.id && vote.voter_id === voterId
    )?.vote;
    const card = document.createElement('article');
    card.className = 'recommendation-card';

    const copy = document.createElement('div');
    copy.className = 'recommendation-copy';
    const title = document.createElement('h3');
    title.textContent = recommendation.title;
    const description = document.createElement('p');
    description.textContent = recommendation.description;
    copy.append(title, description);

    const actions = document.createElement('div');
    actions.className = 'recommendation-votes';
    for (const option of [
      { value: 1, label: '👍', count: tally.up, text: '좋아요' },
      { value: -1, label: '👎', count: tally.down, text: '별로예요' }
    ]) {
      const button = document.createElement('button');
      button.className = `vote-button${myVote === option.value ? ' is-selected' : ''}`;
      button.type = 'button';
      button.setAttribute('aria-label', `${option.text} ${option.count}표`);
      button.setAttribute('aria-pressed', String(myVote === option.value));
      button.textContent = `${option.label} ${option.count}`;
      button.addEventListener('click', () => submitVote(recommendation.id, option.value, actions));
      actions.append(button);
    }

    const controls = document.createElement('div');
    controls.className = 'recommendation-controls';
    const deleteButton = document.createElement('button');
    deleteButton.className = 'recommendation-delete-button';
    deleteButton.type = 'button';
    deleteButton.textContent = '삭제';
    deleteButton.setAttribute('aria-label', `${recommendation.title} 추천 삭제`);
    deleteButton.addEventListener('click', () => removeRecommendation(recommendation, deleteButton));
    controls.append(actions, deleteButton);

    card.append(copy, controls);
    recommendationList.append(card);
  }
}

async function loadRecommendations() {
  const [{ data: recommendationData, error: recommendationError }, { data: voteData, error: voteError }] =
    await Promise.all([
      database.client
        .from('trip_recommendations')
        .select('id, title, description, created_at')
        .order('created_at', { ascending: false }),
      database.client
        .from('trip_recommendation_votes')
        .select('recommendation_id, voter_id, vote')
        .order('created_at', { ascending: true })
    ]);

  if (recommendationError || voteError) {
    const error = recommendationError ?? voteError;
    recommendationFeedback.textContent = `추천을 불러오지 못했어요: ${error.message}`;
    connectionStatus.textContent = '추천 DB를 불러오지 못했어요. supabase-setup.sql을 실행했는지 확인하세요.';
    console.error('Could not load shared recommendations or votes.', error);
    return false;
  }

  recommendations = recommendationData;
  votes = voteData;
  recommendationFeedback.textContent = '';
  renderRecommendations();
  return true;
}

async function submitVote(recommendationId, vote, actions) {
  for (const button of actions.querySelectorAll('button')) button.disabled = true;
  recommendationFeedback.textContent = '투표 저장 중...';
  const { error } = await database.client
    .from('trip_recommendation_votes')
    .upsert(
      { recommendation_id: recommendationId, voter_id: voterId, vote },
      { onConflict: 'recommendation_id,voter_id' }
    );

  if (error) {
    recommendationFeedback.textContent = `투표를 저장하지 못했어요: ${error.message}`;
    console.error('Could not save recommendation vote.', error);
    for (const button of actions.querySelectorAll('button')) button.disabled = false;
    return;
  }

  await loadRecommendations();
}

async function removeRecommendation(recommendation, button) {
  if (!window.confirm(`“${recommendation.title}” 추천을 삭제할까요? 투표도 함께 삭제됩니다.`)) return;

  button.disabled = true;
  recommendationFeedback.textContent = '추천 삭제 중...';
  const { data, error } = await database.client
    .from('trip_recommendations')
    .delete()
    .eq('id', recommendation.id)
    .select('id');

  if (error) {
    recommendationFeedback.textContent = `추천을 삭제하지 못했어요: ${error.message}`;
    console.error('Could not delete recommendation.', error);
    button.disabled = false;
    return;
  }

  if (!data?.length) {
    recommendationFeedback.textContent = '추천이 삭제되지 않았어요. DB 삭제 권한을 확인하세요.';
    button.disabled = false;
    return;
  }

  await loadRecommendations();
}

async function initializeRecommendations() {
  if (!database?.client) {
    setConnectionError(`${database?.error ?? 'DB 설정을 확인해 주세요.'} SUPABASE_SETUP.md를 참고하세요.`);
    return;
  }

  voterId = getVoterId();
  connectionStatus.textContent = '공유 DB 연결 중...';
  try {
    const loaded = await loadRecommendations();
    if (!loaded) return;

    recommendationForm.querySelector('button[type="submit"]').disabled = false;
    connectionStatus.textContent = '공개 추천 게시판 · 방문자는 누구나 추천과 투표를 볼 수 있습니다.';

    database.client
      .channel('trip-recommendations-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trip_recommendations'
      }, loadRecommendations)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trip_recommendation_votes'
      }, loadRecommendations)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          connectionStatus.textContent = '실시간 연결 실패 · 새로고침 후 다시 시도하세요.';
        }
      });
  } catch (error) {
    setConnectionError(`추천 DB 연결 실패: ${error.message} · SQL 설정을 확인하세요.`);
    console.error('Could not initialize shared recommendations.', error);
  }
}

recommendationForm.querySelector('button[type="submit"]').disabled = true;
recommendationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const titleInput = document.querySelector('#recommendation-title');
  const descriptionInput = document.querySelector('#recommendation-description');
  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();

  if (!recommendationForm.reportValidity() || !title || !description) return;

  const submitButton = recommendationForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  recommendationFeedback.textContent = '추천 저장 중...';
  const { error } = await database.client
    .from('trip_recommendations')
    .insert({ title, description });

  if (error) {
    recommendationFeedback.textContent = `추천을 저장하지 못했어요: ${error.message}`;
    console.error('Could not save recommendation.', error);
    submitButton.disabled = false;
    return;
  }

  recommendationForm.reset();
  recommendationFeedback.textContent = '';
  submitButton.disabled = false;
  titleInput.focus();
  await loadRecommendations();
});

initializeRecommendations();
