# 한국고대금석문 탐색기

국사편찬위원회 한국사데이터베이스 XML 자료를 바탕으로 만든 한국고대금석문 탐색 웹 앱입니다.

## 주요 기능

- 금석문 386건 검색 및 상세 보기
- 시대/유형 필터와 정렬
- 한자 독음 표시: `韓(한)` 형식
- 원문 절, 메타데이터, 이미지 메타데이터 확인

## Streamlit 로컬 실행

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Streamlit Community Cloud 배포

1. 이 폴더를 GitHub 저장소로 올립니다.
2. <https://share.streamlit.io>에서 `Create app`을 선택합니다.
3. GitHub 저장소, 브랜치, 진입 파일 `app.py`를 선택합니다.
4. 배포를 실행하면 `streamlit.app` 주소가 생성됩니다.

## 파일 구조

- `app.py`: Streamlit Cloud 진입점
- `index.html`, `styles.css`, `app.js`: 정적 웹 앱
- `data/gskh-data.js`: XML에서 추출한 금석문 데이터
- `data/hanja-readings.js`: 자료에 등장하는 한자 독음 사전
- `scripts/`: 데이터 재생성 스크립트
