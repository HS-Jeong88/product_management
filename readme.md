# 상품 관리 대시보드 프론트, 백엔드 작성

## 실행 방법

백엔드 의존성을 설치하고 서버를 실행합니다.

```powershell
cd back
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

FastAPI 문서는 `http://127.0.0.1:8000/docs`에서 확인할 수 있습니다.
프론트엔드는 정적 웹 서버(예: VS Code Live Server)로 `front/index.html`을 열어 실행합니다.
프론트엔드는 `http://127.0.0.1:8000` API에서 상품 데이터를 불러옵니다.
삭제 상품 목록은 `front/trash.html`에서 확인하고 상품 복원 또는 영구 삭제를 할 수 있습니다.

## 기능 설명

전체 상품, 총 재고 수량, ,재고 부족, 재고 자산 금액을 처음에 크고 잘보이게 표시.

서버에서 json파일로 저장되어있는 데이터 배열을 받아서 상품 목록을 표시한다.

맨 위에 인풋박스를 만들어서 value에 따라서 데이터 배열을 필터링, 필터링된 배열로 랜더링한다.

랜더링 시 제품 수량이 최소수량 미만이면 재고 부족 상품이다

상품 수정 버튼을 누르면 모달창을 띄우고 json파일 형식에 따라 입력칸 생성

상품 등록 버튼을 누르면 모달창을 띄우고 json파일 형식에 따라 입력칸 생성, 입력 후 확인 버튼을 누르면 서버에 저장된 json파일에 추가, 이 때 id는 자동으로 중복되지 않는 값으로 입력된다(기본 auto increase)

json파일 형식 예시
{ "id": 5, "code": "P005", "name": "삼성 SSD 1TB", "category": "저장장치", "price": 120000,"quantity": 25, "min_quantity": 5, "supplier": "삼성전자", "status": "판매중", "created_at": "2026-11-05", "deleted": false, "version": 1}

등록, 수정 시 입력항목은
id, status, created_at, deleted, version제외 나머지
id는 중복되지 않는 값 자동생성, status는 최소수량 < 수량일 시 판매중, 아니면 판매중지
created_at는 등록시 시간을 yyyy-MM-dd의 혁식으로 저장, deleted는 기본 false, version은 1

삭제 버튼을 누를 시 해당 제품의 deleted를 true로 변경, 화면에 렌더링하지 않는다.

api.js의 api에 메서드들을 만들어 crud 구현.
상품 등록 : HTML Form에서 상품 정보를 입력받고 JS Fetch로 FastAPI에 POST 요청한다. FastAPI는 입력 데이터를 받아 상품 ID를 생성하고 JSON 파일에 추가 저장한다.

- 상품 코드 중복 검사 : 상품 등록 요청이 들어오면 기존 JSON 배열을 순회한다. 동일한 상품 코드가 존재하면 등록을 거부하고 오류 메시지를 반환한다.
- 입력값 검증 : Pydantic을 이용해 필수값, 문자열 길이, 숫자 타입, 가격 및 재고의 최솟값을 검사한다. 검증 실패 시 저장하지 않고 422 오류를 반환한다.
  전체 조회 : FastAPI에서 JSON 파일을 읽고 전체 상품 데이터를 반환한다. JS는 반환받은 배열을 반복문으로 순회하여 상품 목록을 출력한다.
  상세 조회 : URL에 상품 ID를 전달한다. FastAPI는 JSON에서 해당 ID와 일치하는 상품을 찾아 반환한다.
- 상품명 검색 : 검색어를 Query Parameter로 전달한다. FastAPI에서 상품명을 소문자로 변환한 후 검색어가 포함된 상품만 필터링한다.
- 상품 코드 검색 : 입력받은 상품 코드와 JSON에 저장된 상품 코드를 비교하여 일치하는 상품을 반환한다.
- 판매 상태 필터 : 판매 상태를 기준으로 상품 배열을 필터링하여 판매중 또는 판매중지 상품만 조회한다.
- 가격 정렬 : 상품 배열을 가격 기준으로 오름차순 또는 내림차순 정렬한다.
- 재고 정렬 : 상품 배열을 재고 수량 기준으로 정렬한다.
- 페이지네이션 : 전체 상품 개수와 페이지 번호를 전달받는다. (page - 1) \* limit을 이용해 시작 위치를 계산하고 필요한 데이터만 반환한다.
  상품 수정 : 상품 ID로 기존 데이터를 조회하고 수정할 정보를 전달한다. FastAPI는 해당 상품을 찾아 변경된 값으로 교체한 후 JSON 파일에 저장한다.
- 부분 수정 : PATCH 요청으로 변경할 필드만 전달받는다. 기존 상품 데이터에 전달된 필드만 반영하고 나머지 값은 유지한다.
- 재고 수량 변경 : 현재 재고 수량에 변경할 수량을 반영한다. 결과가 0보다 작으면 변경을 거부하고 정상적인 경우에만 JSON에 저장한다.
- 상품 가격 수정 : 상품 ID로 기존 데이터를 찾고 새로운 가격을 전달받아 가격 필드만 변경한다.
  상품 삭제 : 삭제할 상품 ID를 전달한다. FastAPI는 해당 ID를 가진 데이터를 배열에서 제외하고 JSON 파일을 다시 저장한다.
- 삭제 전 검증 : 삭제 요청이 들어오면 해당 상품이 존재하는지 확인한다. 존재하지 않으면 오류를 반환한다.
- 삭제 확인 : S에서 사용자에게 삭제 여부를 확인받은 후 확인한 경우에만 DELETE 요청을 보낸다.

## rest api 구현

HTTP Method, API, 주소 역할
POST, /products, 상품 등록
GET, /products, 전체 상품 조회
GET, /products/1, 상품 상세 조회
GET, /products?name=모니터, 상품명 검색
GET, /products?category=전자제품, 카테고리 필터
GET, /products?sort=price&order=asc, 가격 정렬 <!-- api가 아니라 프론트에서 구현-->
GET, /products?page=1&limit=10, 페이지네이션 <!-- 구현 완료 -->
PATCH, /products/1, 부분 수정
PATCH, /products/1/quantity, 재고 수량 변경
DELETE, /products/1, 상품 삭제
