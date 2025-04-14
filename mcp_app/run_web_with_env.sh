#!/bin/bash

ENV_FILE=assets/.env

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 환경 파일 $ENV_FILE 이 존재하지 않습니다!"
  exit 1
fi

echo "🔧 .env 로부터 환경변수를 읽고 flutter run 실행 중..."

# dart-define 옵션 생성
DART_DEFINES=""
while IFS='=' read -r key value || [[ -n "$key" ]]; do
  # 공백, 주석 무시
  [[ -z "$key" || "$key" == \#* ]] && continue
  DART_DEFINES+="--dart-define=$key=$value "
done < "$ENV_FILE"

# flutter run 실행
echo "🚀 fvm flutter run -d chrome $DART_DEFINES"
fvm flutter run -d chrome $DART_DEFINES