# GitHub Pages + Supabase 설정

이 사이트는 Supabase 무료 프로젝트를 공유 DB로 사용합니다. 로그인 없이 쓰도록 설정하므로 공개 사이트 방문자는 지출과 설정을 읽고, 지출을 추가·삭제하고, 기차 지원금과 인원을 바꿀 수 있습니다. 민감한 정보는 입력하지 마세요.

## 1. Supabase 프로젝트 만들기

1. [Supabase](https://supabase.com/)에서 무료 프로젝트를 만듭니다.
2. 프로젝트의 **SQL Editor**에서 `supabase-setup.sql` 전체를 실행합니다.
3. 프로젝트의 **Project URL**과 **anon / publishable key**를 복사합니다. `service_role` 키는 절대 사용하지 마세요.

## 2. 사이트에 연결하기

`supabase-config.js`를 열고 두 값을 바꿉니다.

```js
window.TRIP_SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY'
};
```

브라우저에 공개되는 anon / publishable key만 넣으세요. `service_role` 키는 절대 넣지 마세요. RLS는 켜져 있지만 anon 공개 정책이므로, 누구나 DB를 읽고 지출을 추가·삭제할 수 있습니다.

## 3. GitHub Pages 배포

`index.html`, `expenses.html`, JavaScript/CSS 파일과 `supabase-config.js`를 저장소에 올립니다. GitHub 저장소의 **Settings → Pages**에서 배포 브랜치와 폴더를 선택합니다. 배포 URL을 친구들과 공유하면 함께 지출을 기록할 수 있습니다.

`file://`로 직접 열면 브라우저의 네트워크 정책 때문에 DB 요청이 막힐 수 있습니다. GitHub Pages 주소나 로컬 HTTP 서버에서 테스트하세요.

## 저장 내용

- 지출 항목은 추가·삭제 즉시 Supabase에 저장됩니다.
- 친구가 입력한 변경 사항은 Realtime으로 다른 접속자 화면에 반영됩니다.
- 정산 인원과 독일 친구 기차 지원금도 모든 접속자가 공유합니다.
