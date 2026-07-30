# 컨테이너 하나로 관리자 화면과 백엔드를 함께 서빙한다. 앱을 둘로 쪼개면
# ingress·CORS·환경변수가 두 배가 되는데, 데모 프로토타입에는 얻는 게 없다.
# ponytail: 화면과 API 의 배포 주기가 갈라지면 그때 나눈다.

# 1) 관리자 화면(React + Vite)을 정적 파일로 빌드
FROM node:24-alpine AS admin
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/extension/package.json apps/extension/package.json
# 확장 프로그램 워크스페이스는 postinstall 로 `wxt prepare` 를 돌린다. 배포에
# 필요하지 않은데 실패하면 빌드까지 같이 죽으므로 스크립트를 끄고 admin 만 설치한다.
RUN npm ci -w admin --include-workspace-root --ignore-scripts
COPY apps/admin apps/admin
RUN npm run build -w admin

# 2) 백엔드(FastAPI) + 1단계 산출물
FROM python:3.10-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY apps/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/backend/app ./app
# app/main.py 가 /app/static 을 찾는다
COPY --from=admin /src/apps/admin/dist ./static
EXPOSE 8000
# SQLite(/app/data/dev.db) 는 컨테이너와 함께 사라진다. 기동 시 seed() 가 다시
# 돌아 촬영용 데이터는 복원되지만, 수집 결과는 리비전이 바뀌면 유실된다.
# ponytail: 유지가 필요해지면 Azure Files 를 /app/data 에 마운트한다.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
