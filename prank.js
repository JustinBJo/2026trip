const prankDialog = document.createElement('dialog');
prankDialog.className = 'prank-dialog';
prankDialog.id = 'prank-dialog';
prankDialog.setAttribute('aria-labelledby', 'prank-title');
prankDialog.innerHTML = `
  <section class="prank-view" id="prank-alert-view">
    <h2 id="prank-title" style="color:red;">!!당신의 기기는 감염되었습니다!!</h2>
    <img class="prank-photo" src="assets/YH.jpg" alt="김영훈 바이러스 사진">
    <p class="prank-intro">감염된 바이러스 목록:</p>
    <ul class="virus-list">
      <li><strong>김영훈 바이러스</strong><span>한 달 동안 김영훈 얼굴이 됨</span></li>
      <li><strong>9의 저주</strong><span>한 달 동안 늑구 산책시켜야 함</span></li>
      <li><strong>목</strong><span>어떻게 사람 성이 목ㅋㅋ</span></li>
      <li><strong>윤</strong><span>어게인</span></li>
    </ul>
    <h3 style="color:red;">바이러스를 해제하려면 지금 당장</h3>
    <h4>NL84INGB0797298932로<br/>구구.구구 유로를 송금하세요.</h4>
    <div class="prank-actions">
      <button class="prank-action prank-action-primary" id="prank-dismiss" type="button">닫기</button>
    </div>
  </section>
`;
document.body.append(prankDialog);

const prankConfirmDialog = document.createElement('dialog');
prankConfirmDialog.className = 'prank-dialog prank-confirm-dialog';
prankConfirmDialog.setAttribute('aria-labelledby', 'prank-confirm-title');
prankConfirmDialog.innerHTML = `
  <section class="prank-view prank-confirm-view">
    <h2 id="prank-confirm-title">정말 무시하시겠습니까?</h2>
    <p class="prank-confirm-copy">이 경고를 무시하고 계속하시겠습니까?</p>
    <div class="prank-actions is-split">
      <button class="prank-action" id="prank-no" type="button">아니오</button>
      <button class="prank-action prank-action-primary" id="prank-yes" type="button">예</button>
    </div>
  </section>
`;
document.body.append(prankConfirmDialog);

const prankRedirectUrl = 'https://www.ing.nl/payreq/m/ZjT1Nqkv9AbuhatjR1aVuqls4iV4wFEN';

for (const trigger of document.querySelectorAll('[data-prank-trigger]')) {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    if (!prankDialog.open) prankDialog.showModal();
  });
}

prankDialog.querySelector('#prank-dismiss').addEventListener('click', () => {
  prankDialog.close();
  prankConfirmDialog.showModal();
});
prankConfirmDialog.querySelector('#prank-no').addEventListener('click', () => prankConfirmDialog.close());
prankConfirmDialog.querySelector('#prank-yes').addEventListener('click', () => {
  prankConfirmDialog.close();
  prankDialog.close();
  window.location.assign(prankRedirectUrl);
});
prankDialog.addEventListener('click', (event) => {
  if (event.target === prankDialog) prankDialog.close();
});
prankConfirmDialog.addEventListener('click', (event) => {
  if (event.target === prankConfirmDialog) prankConfirmDialog.close();
});
